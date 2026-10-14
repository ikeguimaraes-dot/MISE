-- Optional emergency context; preserve existing records and approval rules.
CREATE OR REPLACE FUNCTION mise.extra_request_command(p_actor uuid, p_role text, p_command uuid, p_action text, p_request uuid, p_version integer, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'mise'
AS $function$
DECLARE s public.op_extra_solicitacao%ROWTYPE; prior mise.extra_request_events%ROWTYPE;
 unit uuid; day date; mon date; budget jsonb; old_status text; new_status text; signature jsonb;
 declared_requester text; job text; sector text; qty integer; rate numeric; cost numeric;
 row_data jsonb; person public.op_extra%ROWTYPE; position integer; named integer; added integer:=0;
 note text:=nullif(trim(p_data->>'note'),''); event_id uuid:=gen_random_uuid(); person_id uuid;
 employee_user uuid; role_ok boolean;
BEGIN
 IF p_actor IS NULL OR p_command IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'Identificadores obrigatórios'; END IF;
 signature:=jsonb_build_object('action',p_action,'request',p_request,'version',p_version,'role',p_role,'data_sha256',encode(sha256(convert_to(p_data::text,'UTF8')),'hex'));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_command::text,0));
 SELECT * INTO prior FROM mise.extra_request_events WHERE command_id=p_command;
 IF FOUND THEN
  IF prior.actor_id<>p_actor OR prior.command_payload<>signature THEN RAISE EXCEPTION 'Chave de reenvio já usada para outro comando'; END IF;
  IF NOT mise.extra_has_role(p_actor,(SELECT unit_id FROM public.op_extra_solicitacao WHERE id=prior.request_id),p_role) THEN RAISE EXCEPTION 'Permissão revogada'; END IF;
  RETURN jsonb_build_object('id',prior.request_id,'replayed',true,'status',prior.to_status);
 END IF;
 IF p_action='solicitar' THEN unit:=(p_data->>'unit_id')::uuid;day:=(p_data->>'data_trabalho')::date;
 ELSE SELECT unit_id,data_trabalho INTO unit,day FROM public.op_extra_solicitacao WHERE id=p_request AND mise_managed; END IF;
 IF unit IS NULL OR day IS NULL OR NOT mise.extra_has_role(p_actor,unit,p_role) THEN RAISE EXCEPTION 'Sem permissão para este papel/unidade'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.units WHERE id=unit AND active) THEN RAISE EXCEPTION 'Unidade indisponível'; END IF;
 mon:=date_trunc('week',day::timestamp)::date;
 PERFORM pg_advisory_xact_lock(hashtextextended(unit::text||':'||mon::text,0));
 PERFORM set_config('mise.extra_command','on',true);
 SELECT user_id INTO employee_user FROM public.employees WHERE id=p_actor;
 IF p_action='solicitar' THEN
  IF p_role NOT IN ('lider','caixa') THEN RAISE EXCEPTION 'Papel não pode solicitar'; END IF;
  SELECT nome INTO declared_requester FROM public.op_extra_solicitante WHERE id=(p_data->>'solicitante_cadastro_id')::uuid AND unit_id=unit AND ativo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selecione um solicitante ativo desta casa'; END IF;
  SELECT c.nome,c.setor_padrao INTO job,sector FROM public.op_extra_cargo c WHERE c.id=(p_data->>'cargo_id')::uuid AND c.ativo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selecione uma função ativa'; END IF;
  IF coalesce(p_data->>'quantidade','') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'Quantidade deve ser um inteiro maior que zero'; END IF;
  qty:=(p_data->>'quantidade')::integer;rate:=(p_data->>'valor_unitario')::numeric;
  IF rate IS NULL OR rate<=0 OR rate::text IN ('NaN','Infinity','-Infinity') OR rate<>round(rate,2) THEN RAISE EXCEPTION 'Informe uma diária positiva com até duas casas decimais'; END IF;
  IF nullif(p_data->>'periodo','') IS NULL THEN RAISE EXCEPTION 'Informe o período'; END IF;
  s:=jsonb_populate_record(NULL::public.op_extra_solicitacao,jsonb_build_object('periodo',p_data->>'periodo','motivo',p_data->>'motivo','pagadora','casa','emergencial',coalesce((p_data->>'emergencial')::boolean,false)));
  IF p_role='caixa' AND NOT s.emergencial THEN RAISE EXCEPTION 'Caixa registra somente emergências'; END IF;
  budget:=mise.extra_week_budget(unit,day);cost:=qty*rate;
  new_status:=CASE WHEN NOT s.emergencial AND cost>(budget->>'saldo')::numeric THEN 'aguardando_diretoria' ELSE 'solicitado' END;
  INSERT INTO public.op_extra_solicitacao(id,unit_id,data_solicitacao,data_trabalho,periodo,setor,funcao,quantidade,valor_unitario,motivo,motivo_detalhe,solicitante_nome,pagadora,status,emergencial,mise_managed,mise_requested_by,mise_version,mise_stage_at)
  VALUES(p_request,unit,(now() AT TIME ZONE 'America/Sao_Paulo')::date,day,s.periodo,sector,job,qty,rate,s.motivo,nullif(trim(p_data->>'motivo_detalhe'),''),declared_requester,s.pagadora,new_status::public.op_extra_status,s.emergencial,true,p_actor,1,now()) RETURNING * INTO s;
 ELSE
  SELECT * INTO s FROM public.op_extra_solicitacao WHERE id=p_request AND mise_managed FOR UPDATE;
  IF NOT FOUND OR p_version IS NULL OR s.mise_version<>p_version THEN RAISE EXCEPTION 'Solicitação atualizada. Recarregue antes de agir'; END IF;
  old_status:=s.status::text;new_status:=old_status;
  IF old_status IN ('cancelado','recusado') THEN RAISE EXCEPTION 'Solicitação encerrada'; END IF;
  IF p_action IN ('nomear_rh','nomear_emergencia') THEN
   IF NOT ((p_action='nomear_rh' AND p_role='rh') OR (p_action='nomear_emergencia' AND p_role='caixa' AND s.emergencial AND s.pagadora='casa')) OR old_status NOT IN ('solicitado','aprovado_rh') THEN RAISE EXCEPTION 'Nomeação indisponível nesta etapa'; END IF;
   IF jsonb_typeof(p_data->'pessoas') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Informe as pessoas'; END IF;
   IF jsonb_array_length(p_data->'pessoas')<1 OR jsonb_array_length(p_data->'pessoas')>s.quantidade THEN RAISE EXCEPTION 'Quantidade de pessoas inválida'; END IF;
   IF p_action='nomear_emergencia' AND p_data->>'pagadora' IS DISTINCT FROM 'casa' THEN RAISE EXCEPTION 'Emergência do caixa é paga pela casa'; END IF;
   IF p_data->>'pagadora' IS NULL OR p_data->>'pagadora' NOT IN ('casa','terceirizada') THEN RAISE EXCEPTION 'Selecione a pagadora'; END IF;
   IF EXISTS(SELECT 1 FROM public.op_extra WHERE solicitacao_id=p_request) AND s.pagadora::text<>p_data->>'pagadora' THEN RAISE EXCEPTION 'Preserve a pagadora das pessoas já nomeadas'; END IF;
   s.pagadora:=(jsonb_populate_record(NULL::public.op_extra_solicitacao,jsonb_build_object('pagadora',p_data->>'pagadora'))).pagadora;
   budget:=mise.extra_week_budget(unit,day,p_request);
   FOR row_data IN SELECT value FROM jsonb_array_elements(p_data->'pessoas') LOOP
    position:=(row_data->>'posicao')::integer;
    IF position IS NULL OR position<1 OR position>s.quantidade THEN RAISE EXCEPTION 'Posição inválida'; END IF;
    IF EXISTS(SELECT 1 FROM public.op_extra WHERE solicitacao_id=p_request AND mise_position=position) THEN RAISE EXCEPTION 'Posição já preenchida. Recarregue a solicitação'; END IF;
    rate:=coalesce((row_data->>'valor')::numeric,s.valor_unitario);
    IF rate<=0 OR rate::text IN ('NaN','Infinity','-Infinity') OR rate<>round(rate,2) THEN RAISE EXCEPTION 'Valor individual inválido'; END IF;
    IF nullif(trim(row_data->>'nome'),'') IS NULL OR (p_action='nomear_rh' AND NOT mise.extra_valid_cpf(row_data->>'cpf')) OR (nullif(row_data->>'cpf','') IS NOT NULL AND NOT mise.extra_valid_cpf(row_data->>'cpf')) THEN RAISE EXCEPTION 'Preencha nome e CPF válido de cada pessoa'; END IF;
    IF EXISTS(SELECT 1 FROM public.op_extra WHERE solicitacao_id=p_request AND cpf=row_data->>'cpf') THEN RAISE EXCEPTION 'Esta pessoa já foi nomeada nesta solicitação'; END IF;
    person_id:=gen_random_uuid();
    INSERT INTO public.op_extra(id,solicitacao_id,mise_position,unit_id,data_trabalho,data_solicitacao,periodo,setor,funcao,motivo,motivo_detalhe,solicitante_nome,nome,cpf,valor,pagadora,status,emergencial,solicitante_id,aprovador_rh_id,mise_managed,mise_requested_by,mise_rh_complete,mise_version,mise_stage_at,mise_emergency_decision)
    SELECT person_id,s.id,position,s.unit_id,s.data_trabalho,s.data_solicitacao,s.periodo,s.setor,s.funcao,s.motivo,s.motivo_detalhe,s.solicitante_nome,trim(row_data->>'nome'),nullif(row_data->>'cpf',''),rate,s.pagadora,'aprovado_rh',s.emergencial,e.user_id,CASE WHEN p_role='rh' THEN employee_user END,true,s.mise_requested_by,p_role='rh',1,now(),s.mise_emergency_decision FROM public.employees e WHERE e.id=s.mise_requested_by;
    added:=added+1;
   END LOOP;
   SELECT count(*),coalesce(sum(total),0) INTO named,cost FROM public.op_extra WHERE solicitacao_id=p_request AND status::text NOT IN ('cancelado','recusado');
   IF named>s.quantidade THEN RAISE EXCEPTION 'Pessoas excedem a quantidade solicitada'; END IF;
   new_status:=CASE WHEN NOT s.emergencial AND cost>(budget->>'saldo')::numeric AND cost>coalesce(s.mise_approved_total,0) THEN 'aguardando_diretoria' ELSE 'aprovado_rh' END;
   s.mise_named_at:=coalesce(s.mise_named_at,now());
   -- Payment already made/reserved is never rewritten. Unreleased people wait for the new approval.
   UPDATE public.op_extra SET status=new_status::public.op_extra_status,mise_version=mise_version+1,mise_stage_at=now()
   WHERE solicitacao_id=p_request AND status::text IN ('aprovado_rh','aguardando_diretoria');
  ELSIF p_action='aprovar' THEN
   IF p_role<>'diretor' OR old_status<>'aguardando_diretoria' OR note IS NULL THEN RAISE EXCEPTION 'Aprovação indisponível ou sem justificativa'; END IF;
   SELECT valor_consumido INTO s.mise_approved_total FROM mise.extra_request_summary WHERE id=p_request;
   new_status:=CASE WHEN s.mise_named_at IS NULL THEN 'solicitado' ELSE 'aprovado_rh' END;
   UPDATE public.op_extra SET status='aprovado_rh',mise_version=mise_version+1,mise_stage_at=now() WHERE solicitacao_id=p_request AND status='aguardando_diretoria';
  ELSIF p_action IN ('ratificar_emergencia','nao_ratificar_emergencia') THEN
   IF p_role<>'diretor' OR NOT s.emergencial OR s.mise_emergency_decision IS NOT NULL OR note IS NULL THEN RAISE EXCEPTION 'Revisão emergencial indisponível ou sem justificativa'; END IF;
   s.mise_emergency_decision:=CASE WHEN p_action='ratificar_emergencia' THEN 'aprovado' ELSE 'nao_ratificado' END;
   UPDATE public.op_extra SET mise_emergency_decision=s.mise_emergency_decision,mise_version=mise_version+1 WHERE solicitacao_id=p_request;
  ELSIF p_action IN ('cancelar','recusar') THEN
   role_ok:=(p_action='cancelar' AND p_role='lider' AND s.mise_requested_by=p_actor AND old_status IN ('solicitado','aguardando_diretoria')) OR (p_action='recusar' AND p_role='diretor' AND old_status='aguardando_diretoria');
   IF NOT role_ok OR note IS NULL THEN RAISE EXCEPTION 'Encerramento indisponível ou sem justificativa'; END IF;
   IF EXISTS(SELECT 1 FROM public.op_extra WHERE solicitacao_id=p_request AND status::text IN ('reservado_financeiro','pagamento_informado','pago')) THEN RAISE EXCEPTION 'Há pessoas com recurso liberado ou pago. Não é possível encerrar a solicitação'; END IF;
   new_status:=CASE WHEN p_action='recusar' THEN 'recusado' ELSE 'cancelado' END;
   UPDATE public.op_extra SET status=new_status::public.op_extra_status,mise_version=mise_version+1,mise_stage_at=now() WHERE solicitacao_id=p_request;
  ELSE RAISE EXCEPTION 'Ação desconhecida'; END IF;
  UPDATE public.op_extra_solicitacao SET status=new_status::public.op_extra_status,pagadora=s.pagadora,mise_version=mise_version+1,mise_stage_at=CASE WHEN old_status<>new_status THEN now() ELSE mise_stage_at END,mise_named_at=s.mise_named_at,mise_approved_total=s.mise_approved_total,mise_emergency_decision=s.mise_emergency_decision,updated_at=now() WHERE id=p_request;
 END IF;
 INSERT INTO mise.extra_request_events(id,request_id,actor_id,actor_role,action,from_status,to_status,note,allowance,command_id,command_payload)
 VALUES(event_id,p_request,p_actor,p_role,p_action,old_status,new_status,note,budget,p_command,signature);
 -- Each newly named person has its own audit trail, receipt and payment lifecycle.
 INSERT INTO mise.extra_events(extra_id,actor_id,actor_role,action,from_status,to_status,note,command_id,command_payload)
 SELECT e.id,p_actor,p_role,p_action,NULL,e.status::text,'Pessoa nomeada na solicitação',gen_random_uuid(),jsonb_build_object('request_event_id',event_id)
 FROM public.op_extra e WHERE e.solicitacao_id=p_request AND NOT EXISTS(SELECT 1 FROM mise.extra_events ev WHERE ev.extra_id=e.id);
 IF (p_action='solicitar' AND s.emergencial) OR (new_status='aguardando_diretoria' AND coalesce(old_status,'')<>new_status) THEN
  INSERT INTO public.notifications(user_id,tipo,titulo,mensagem,link)
  SELECT DISTINCT e.user_id,'extras',CASE WHEN s.emergencial THEN 'Solicitação emergencial de extras' ELSE 'Posições aguardando aprovação' END,'Há uma solicitação de posições que precisa de acompanhamento da diretoria.','/extras?unit_id='||unit||'&solicitacao_id='||p_request||'&data='||day FROM mise.extra_access a JOIN public.employees e ON e.id=a.employee_id WHERE a.unit_id=unit AND a.role='diretor' AND e.ativo AND e.user_id IS NOT NULL;
  INSERT INTO mise.extra_notification_outbox(request_event_id,request_id,payload)
  VALUES(event_id,p_request,jsonb_build_object('event_id',event_id,'tipo',CASE WHEN s.emergencial THEN 'extra_emergencial' ELSE 'aguardando_diretoria' END,'unit_id',unit,'data_trabalho',day,'total',coalesce(cost,s.valor_total),'link','/extras?unit_id='||unit||'&solicitacao_id='||p_request||'&data='||day));
 END IF;
 PERFORM set_config('mise.extra_command','off',true);
 RETURN jsonb_build_object('id',p_request,'status',new_status,'replayed',false,'nomeados',added);
END;
$function$;

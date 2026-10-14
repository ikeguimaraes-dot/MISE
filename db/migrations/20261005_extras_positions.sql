-- Position requests are separate from named people. No historical backfill.
-- Catalog and public request tables already exist in production.
ALTER TABLE public.op_extra_solicitacao ADD COLUMN IF NOT EXISTS mise_managed boolean NOT NULL DEFAULT false;
ALTER TABLE public.op_extra_solicitacao ADD COLUMN IF NOT EXISTS mise_requested_by uuid REFERENCES public.employees(id);
ALTER TABLE public.op_extra_solicitacao ADD COLUMN IF NOT EXISTS mise_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.op_extra_solicitacao ADD COLUMN IF NOT EXISTS mise_stage_at timestamptz;
ALTER TABLE public.op_extra_solicitacao ADD COLUMN IF NOT EXISTS mise_named_at timestamptz;
ALTER TABLE public.op_extra_solicitacao ADD COLUMN IF NOT EXISTS mise_approved_total numeric;
ALTER TABLE public.op_extra_solicitacao ADD COLUMN IF NOT EXISTS mise_emergency_decision text;
ALTER TABLE public.op_extra ADD COLUMN IF NOT EXISTS mise_position integer;
CREATE UNIQUE INDEX IF NOT EXISTS extra_request_position ON public.op_extra(solicitacao_id,mise_position) WHERE solicitacao_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS extra_request_week ON public.op_extra_solicitacao(unit_id,data_trabalho);
ALTER TABLE public.op_extra_solicitacao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.op_extra_solicitacao FROM anon,authenticated;
GRANT ALL ON public.op_extra_solicitacao TO service_role;
CREATE TRIGGER mise_extra_request_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.op_extra_solicitacao FOR EACH ROW EXECUTE FUNCTION mise.extra_write_guard();

CREATE TABLE mise.extra_request_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL REFERENCES public.op_extra_solicitacao,
 actor_id uuid NOT NULL REFERENCES public.employees,actor_role text NOT NULL,action text NOT NULL,
 from_status text,to_status text NOT NULL,note text,allowance jsonb,
 command_id uuid NOT NULL UNIQUE,command_payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON mise.extra_request_events(request_id,created_at);
ALTER TABLE mise.extra_request_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mise.extra_request_events FROM PUBLIC,anon,authenticated;
GRANT ALL ON mise.extra_request_events TO service_role;

-- Requested quantity/estimate never change. Once RH starts filling positions, only
-- named, active people consume allowance, including any differing individual rates.
CREATE OR REPLACE VIEW mise.extra_request_summary AS
SELECT s.*,coalesce(p.preenchidos,0)::integer AS preenchidos,
 coalesce(p.custo,0) AS valor_nomeado,
 CASE WHEN s.mise_named_at IS NULL THEN s.valor_total ELSE coalesce(p.custo,0) END AS valor_consumido,
 coalesce(p.pendentes,0)::integer AS pagamentos_pendentes,
 coalesce(p.preenchidos,0)<s.quantidade AS rh_pendente
FROM public.op_extra_solicitacao s LEFT JOIN LATERAL (
 SELECT count(*) FILTER(WHERE e.status::text NOT IN ('recusado','cancelado')) AS preenchidos,
 sum(e.total) FILTER(WHERE e.status::text NOT IN ('recusado','cancelado')) AS custo,
 count(*) FILTER(WHERE e.status::text NOT IN ('recusado','cancelado','pago')) AS pendentes
 FROM public.op_extra e WHERE e.solicitacao_id=s.id
) p ON true;
-- Unlinked records predate position requests (or originate in another system).
-- Preserve their cost once; never count named children twice.
CREATE OR REPLACE VIEW mise.extra_allowance_spend AS
SELECT id,unit_id,data_trabalho,valor_consumido AS total,status FROM mise.extra_request_summary
UNION ALL
SELECT id,unit_id,data_trabalho,total,status FROM public.op_extra WHERE solicitacao_id IS NULL;
REVOKE ALL ON mise.extra_request_summary,mise.extra_allowance_spend FROM PUBLIC,anon,authenticated;
GRANT SELECT ON mise.extra_request_summary,mise.extra_allowance_spend TO service_role;

CREATE OR REPLACE FUNCTION mise.extra_week_budget(p_unit uuid,p_day date,p_exclude uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,mise AS $$
DECLARE mon date:=date_trunc('week',p_day::timestamp)::date; sun date:=mon+6; goal numeric:=0;
 pct numeric; spent numeric; ceiling numeric; missing integer:=0; cfg_count integer; effective date;
BEGIN
 SELECT vigente_desde INTO effective FROM public.op_extra_alcada WHERE unit_id=p_unit AND vigente_desde<=p_day ORDER BY vigente_desde DESC LIMIT 1;
 SELECT count(*),max(percentual) INTO cfg_count,pct FROM public.op_extra_alcada WHERE unit_id=p_unit AND vigente_desde=effective;
 IF cfg_count>1 THEN RAISE EXCEPTION 'Alçada com vigência duplicada'; END IF;
 IF pct IS NOT NULL AND pct<0 THEN RAISE EXCEPTION 'Percentual inválido'; END IF;
 SELECT coalesce(sum(coalesce(o.meta,m.meta,0)),0),count(*) FILTER(WHERE o.id IS NULL AND m.id IS NULL)
 INTO goal,missing FROM generate_series(mon::timestamp,sun::timestamp,'1 day'::interval) d
 LEFT JOIN public.metas_dia_override o ON o.unit_id=p_unit AND o.data=d::date
 LEFT JOIN public.metas_dia_semana m ON m.unit_id=p_unit AND m.competencia=to_char(d,'YYYY-MM') AND m.dia_semana=extract(dow from d)::integer;
 SELECT coalesce(sum(total),0) INTO spent FROM mise.extra_allowance_spend
 WHERE unit_id=p_unit AND data_trabalho BETWEEN mon AND sun AND status::text NOT IN ('recusado','cancelado') AND (p_exclude IS NULL OR id<>p_exclude);
 ceiling:=round(goal*coalesce(pct,0)/100,2);
 RETURN jsonb_build_object('segunda',mon,'domingo',sun,'meta',goal,'percentual',pct,'vigente_desde',effective,'teto',ceiling,'usado',spent,'saldo',ceiling-spent,'dias_sem_meta',missing);
END;
$$;

-- Reuse delivery infrastructure without fabricating a person to send an alert.
ALTER TABLE mise.extra_notification_outbox ALTER COLUMN event_id DROP NOT NULL;
ALTER TABLE mise.extra_notification_outbox ALTER COLUMN extra_id DROP NOT NULL;
ALTER TABLE mise.extra_notification_outbox ADD COLUMN request_event_id uuid UNIQUE REFERENCES mise.extra_request_events;
ALTER TABLE mise.extra_notification_outbox ADD COLUMN request_id uuid REFERENCES public.op_extra_solicitacao;
ALTER TABLE mise.extra_notification_outbox ADD CONSTRAINT extra_outbox_origin CHECK (
 (event_id IS NOT NULL AND extra_id IS NOT NULL AND request_event_id IS NULL AND request_id IS NULL) OR
 (event_id IS NULL AND extra_id IS NULL AND request_event_id IS NOT NULL AND request_id IS NOT NULL));

CREATE OR REPLACE FUNCTION mise.extra_request_command(p_actor uuid,p_role text,p_command uuid,p_action text,p_request uuid,p_version integer,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,mise AS $$
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
  sector:=trim(p_data->>'setor');
  SELECT c.nome INTO job FROM public.op_extra_cargo c WHERE c.id=(p_data->>'cargo_id')::uuid AND c.ativo AND EXISTS(SELECT 1 FROM public.op_extra_cargo_setor cs WHERE cs.cargo_id=c.id AND cs.setor=sector) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selecione uma função ativa vinculada ao setor'; END IF;
  IF coalesce(p_data->>'quantidade','') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'Quantidade deve ser um inteiro maior que zero'; END IF;
  qty:=(p_data->>'quantidade')::integer;rate:=(p_data->>'valor_unitario')::numeric;
  IF rate IS NULL OR rate<=0 OR rate::text IN ('NaN','Infinity','-Infinity') OR rate<>round(rate,2) THEN RAISE EXCEPTION 'Informe uma diária positiva com até duas casas decimais'; END IF;
  IF nullif(p_data->>'periodo','') IS NULL OR nullif(trim(p_data->>'motivo_detalhe'),'') IS NULL THEN RAISE EXCEPTION 'Informe período e contexto'; END IF;
  s:=jsonb_populate_record(NULL::public.op_extra_solicitacao,jsonb_build_object('periodo',p_data->>'periodo','motivo',p_data->>'motivo','pagadora','casa','emergencial',coalesce((p_data->>'emergencial')::boolean,false)));
  IF p_role='caixa' AND NOT s.emergencial THEN RAISE EXCEPTION 'Caixa registra somente emergências'; END IF;
  budget:=mise.extra_week_budget(unit,day);cost:=qty*rate;
  new_status:=CASE WHEN NOT s.emergencial AND cost>(budget->>'saldo')::numeric THEN 'aguardando_diretoria' ELSE 'solicitado' END;
  INSERT INTO public.op_extra_solicitacao(id,unit_id,data_trabalho,periodo,setor,funcao,quantidade,valor_unitario,motivo,motivo_detalhe,solicitante_nome,pagadora,status,emergencial,mise_managed,mise_requested_by,mise_version,mise_stage_at)
  VALUES(p_request,unit,day,s.periodo,sector,job,qty,rate,s.motivo,trim(p_data->>'motivo_detalhe'),declared_requester,s.pagadora,new_status::public.op_extra_status,s.emergencial,true,p_actor,1,now()) RETURNING * INTO s;
 ELSE
  SELECT * INTO s FROM public.op_extra_solicitacao WHERE id=p_request AND mise_managed FOR UPDATE;
  IF NOT FOUND OR p_version IS NULL OR s.mise_version<>p_version THEN RAISE EXCEPTION 'Solicitação atualizada. Recarregue antes de agir'; END IF;
  old_status:=s.status::text;new_status:=old_status;
  IF old_status IN ('cancelado','recusado') THEN RAISE EXCEPTION 'Solicitação encerrada'; END IF;
  IF p_action='nomear_rh' THEN
   IF p_role<>'rh' OR old_status NOT IN ('solicitado','aprovado_rh') THEN RAISE EXCEPTION 'Nomeação indisponível nesta etapa'; END IF;
   IF jsonb_typeof(p_data->'pessoas') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Informe as pessoas'; END IF;
   IF jsonb_array_length(p_data->'pessoas')<1 OR jsonb_array_length(p_data->'pessoas')>s.quantidade THEN RAISE EXCEPTION 'Quantidade de pessoas inválida'; END IF;
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
    IF nullif(trim(row_data->>'nome'),'') IS NULL OR NOT mise.extra_valid_cpf(row_data->>'cpf') THEN RAISE EXCEPTION 'Preencha nome e CPF válido de cada pessoa'; END IF;
    IF EXISTS(SELECT 1 FROM public.op_extra WHERE solicitacao_id=p_request AND cpf=row_data->>'cpf') THEN RAISE EXCEPTION 'Esta pessoa já foi nomeada nesta solicitação'; END IF;
    person_id:=gen_random_uuid();
    INSERT INTO public.op_extra(id,solicitacao_id,mise_position,unit_id,data_trabalho,data_solicitacao,periodo,setor,funcao,motivo,motivo_detalhe,solicitante_nome,nome,cpf,valor,pagadora,status,emergencial,solicitante_id,aprovador_rh_id,mise_managed,mise_requested_by,mise_rh_complete,mise_version,mise_stage_at,mise_emergency_decision)
    SELECT person_id,s.id,position,s.unit_id,s.data_trabalho,s.data_solicitacao,s.periodo,s.setor,s.funcao,s.motivo,s.motivo_detalhe,s.solicitante_nome,trim(row_data->>'nome'),row_data->>'cpf',rate,s.pagadora,'aprovado_rh',s.emergencial,e.user_id,employee_user,true,s.mise_requested_by,true,1,now(),s.mise_emergency_decision FROM public.employees e WHERE e.id=s.mise_requested_by;
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
 SELECT e.id,p_actor,p_role,'nomear_rh',NULL,e.status::text,'Pessoa nomeada na solicitação',gen_random_uuid(),jsonb_build_object('request_event_id',event_id)
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
$$;
REVOKE ALL ON FUNCTION mise.extra_request_command(uuid,text,uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mise.extra_request_command(uuid,text,uuid,text,uuid,integer,jsonb) TO service_role;

-- Existing individual payments remain unchanged; linked people cannot bypass request approval.
CREATE OR REPLACE FUNCTION mise.extra_command(p_actor uuid,p_role text,p_command uuid,p_action text,p_extra uuid,p_version integer,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,mise AS $$
DECLARE e public.op_extra%ROWTYPE; prior mise.extra_events%ROWTYPE; unit uuid; day date; mon date;
 budget jsonb; amount numeric; new_status text; old_status text; note text:=nullif(trim(p_data->>'note'),'');
 urgent boolean; command_payload jsonb; receipt mise.extra_receipts%ROWTYPE; employee_user uuid; declared_requester text;
BEGIN
 IF p_actor IS NULL OR p_command IS NULL OR p_extra IS NULL THEN RAISE EXCEPTION 'Identificadores obrigatórios'; END IF;
 command_payload:=jsonb_build_object('action',p_action,'extra_id',p_extra,'version',p_version,'role',p_role,'data_sha256',encode(sha256(convert_to(p_data::text,'UTF8')),'hex'));
 -- Serialize the command key before checking retries.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_command::text,0));
 SELECT * INTO prior FROM mise.extra_events WHERE command_id=p_command;
 IF FOUND THEN
  IF prior.actor_id<>p_actor OR prior.command_payload<>command_payload THEN RAISE EXCEPTION 'Chave de reenvio já usada para outro comando'; END IF;
  IF NOT mise.extra_has_role(p_actor,(SELECT unit_id FROM public.op_extra WHERE id=prior.extra_id),p_role) THEN RAISE EXCEPTION 'Permissão revogada'; END IF;
  RETURN jsonb_build_object('id',prior.extra_id,'replayed',true,'status',prior.to_status);
 END IF;
 IF p_action='solicitar' THEN
  unit:=(p_data->>'unit_id')::uuid;day:=(p_data->>'data_trabalho')::date;
 ELSE
  SELECT unit_id,data_trabalho INTO unit,day FROM public.op_extra WHERE id=p_extra AND mise_managed;
 END IF;
 IF unit IS NULL OR day IS NULL OR NOT mise.extra_has_role(p_actor,unit,p_role) THEN RAISE EXCEPTION 'Sem permissão para este papel/unidade'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.units WHERE id=unit AND active) THEN RAISE EXCEPTION 'Unidade indisponível'; END IF;
 mon:=date_trunc('week',day::timestamp)::date;
 PERFORM pg_advisory_xact_lock(hashtextextended(unit::text||':'||mon::text,0));
 PERFORM set_config('mise.extra_command','on',true);
 IF p_action='solicitar' THEN
  IF p_role NOT IN ('lider','caixa') THEN RAISE EXCEPTION 'Papel não pode solicitar'; END IF;
  IF nullif(p_data->>'solicitante_cadastro_id','') IS NULL THEN RAISE EXCEPTION 'Selecione o solicitante'; END IF;
  SELECT nome INTO declared_requester FROM public.op_extra_solicitante
   WHERE id=(p_data->>'solicitante_cadastro_id')::uuid AND unit_id=unit AND ativo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitante indisponível nesta casa. Recarregue a lista'; END IF;
  urgent:=coalesce((p_data->>'emergencial')::boolean,false);
  IF p_role='caixa' AND NOT urgent THEN RAISE EXCEPTION 'Caixa registra somente emergências'; END IF;
  amount:=(p_data->>'valor')::numeric;
  IF (urgent AND amount IS NULL) OR (amount IS NOT NULL AND (amount<=0 OR amount::text IN ('NaN','Infinity','-Infinity') OR amount<>round(amount,2))) THEN RAISE EXCEPTION 'Valores inválidos'; END IF;
  IF nullif(trim(p_data->>'setor'),'') IS NULL OR nullif(trim(p_data->>'funcao'),'') IS NULL OR nullif(trim(p_data->>'motivo_detalhe'),'') IS NULL THEN RAISE EXCEPTION 'Informe setor, função e contexto'; END IF;
  IF urgent AND nullif(trim(p_data->>'nome'),'') IS NULL THEN RAISE EXCEPTION 'Identifique o recebedor da emergência'; END IF;
  IF nullif(p_data->>'periodo','') IS NULL THEN RAISE EXCEPTION 'Informe o período'; END IF;
  budget:=mise.extra_week_budget(unit,day);
  new_status:=CASE WHEN NOT urgent AND amount>(budget->>'saldo')::numeric THEN 'aguardando_diretoria' ELSE 'solicitado' END;
  SELECT user_id INTO employee_user FROM public.employees WHERE id=p_actor;
  e:=jsonb_populate_record(NULL::public.op_extra,jsonb_build_object('id',p_extra,'unit_id',unit,'data_solicitacao',(now() AT TIME ZONE 'America/Sao_Paulo')::date,'data_trabalho',day,'setor',trim(p_data->>'setor'),'funcao',trim(p_data->>'funcao'),'motivo',p_data->>'motivo','motivo_detalhe',trim(p_data->>'motivo_detalhe'),'nome',nullif(trim(p_data->>'nome'),''),'valor',amount,'status',new_status,'emergencial',urgent,'pagadora','casa','periodo',p_data->>'periodo'));
  INSERT INTO public.op_extra(id,unit_id,data_solicitacao,data_trabalho,setor,funcao,motivo,motivo_detalhe,nome,valor,status,emergencial,pagadora,periodo,solicitante_nome,solicitante_id,mise_managed,mise_requested_by,mise_stage_at,mise_version,mise_allowance_snapshot)
   VALUES(e.id,e.unit_id,e.data_solicitacao,e.data_trabalho,e.setor,e.funcao,e.motivo,e.motivo_detalhe,e.nome,e.valor,e.status,e.emergencial,e.pagadora,e.periodo,declared_requester,employee_user,true,p_actor,now(),1,budget);
 ELSE
  SELECT * INTO e FROM public.op_extra WHERE id=p_extra AND mise_managed FOR UPDATE;
  IF NOT FOUND OR (p_version IS NULL OR e.mise_version<>p_version) THEN RAISE EXCEPTION 'Solicitação atualizada. Recarregue antes de agir'; END IF;
  old_status:=e.status::text;new_status:=old_status;
  IF e.solicitacao_id IS NOT NULL AND p_action NOT IN ('reservar','informar_pagamento','conferir') THEN RAISE EXCEPTION 'Faça esta ação na solicitação de posições'; END IF;
  IF old_status IN ('cancelado','recusado') OR (old_status='pago' AND p_action NOT IN ('ratificar_emergencia','nao_ratificar_emergencia')) THEN RAISE EXCEPTION 'Registro encerrado'; END IF;
  IF p_action IN ('ratificar_emergencia','nao_ratificar_emergencia') THEN
   IF p_role<>'diretor' OR NOT e.emergencial OR e.mise_emergency_decision IS NOT NULL OR note IS NULL THEN RAISE EXCEPTION 'Revisão emergencial indisponível ou sem justificativa'; END IF;
   e.mise_emergency_decision:=CASE WHEN p_action='ratificar_emergencia' THEN 'aprovado' ELSE 'nao_ratificado' END;
  ELSIF p_action='aprovar' THEN
   IF p_role<>'diretor' OR old_status<>'aguardando_diretoria' OR note IS NULL THEN RAISE EXCEPTION 'Aprovação indisponível ou sem justificativa'; END IF;
   e.mise_approved_total:=e.total;
   new_status:=CASE WHEN e.mise_rh_complete THEN 'aprovado_rh' ELSE 'solicitado' END;
  ELSIF p_action IN ('recusar','cancelar') THEN
   IF note IS NULL OR NOT ((p_action='recusar' AND p_role='diretor' AND old_status='aguardando_diretoria') OR (p_action='cancelar' AND p_role='lider' AND e.mise_requested_by=p_actor AND old_status IN ('solicitado','aguardando_diretoria'))) THEN RAISE EXCEPTION 'Encerramento indisponível ou sem motivo'; END IF;
   new_status:=CASE WHEN p_action='recusar' THEN 'recusado' ELSE 'cancelado' END;
  ELSIF p_action='preparar_rh' THEN
   IF p_role<>'rh' OR old_status NOT IN ('solicitado','pagamento_informado') THEN RAISE EXCEPTION 'Etapa do RH indisponível'; END IF;
   IF nullif(trim(p_data->>'nome'),'') IS NULL OR NOT mise.extra_valid_cpf(p_data->>'cpf') THEN RAISE EXCEPTION 'Informe nome e CPF válido'; END IF;
   amount:=(p_data->>'valor')::numeric;
   IF amount IS NULL OR amount<=0 OR amount::text IN ('NaN','Infinity','-Infinity') OR amount<>round(amount,2) THEN RAISE EXCEPTION 'Valores inválidos'; END IF;
   IF p_data->>'pagadora' NOT IN ('casa','terceirizada') OR p_data->>'pagadora' IS NULL THEN RAISE EXCEPTION 'Pagadora inválida'; END IF;
   IF old_status='pagamento_informado' AND (amount<>e.valor OR p_data->>'pagadora'<>e.pagadora::text) THEN RAISE EXCEPTION 'Pagamento informado: preserve valores e pagadora'; END IF;
   e.nome:=trim(p_data->>'nome');e.cpf:=p_data->>'cpf';e.valor:=amount;
   e.pagadora:=(jsonb_populate_record(NULL::public.op_extra,jsonb_build_object('pagadora',p_data->>'pagadora'))).pagadora;
   e.mise_rh_complete:=true;
   SELECT user_id INTO e.aprovador_rh_id FROM public.employees WHERE id=p_actor;
   budget:=mise.extra_week_budget(unit,day,p_extra);
   IF old_status='pagamento_informado' THEN new_status:='pago'; ELSE
    new_status:=CASE WHEN NOT e.emergencial AND amount>(budget->>'saldo')::numeric AND amount>coalesce(e.mise_approved_total,0) THEN 'aguardando_diretoria' ELSE 'aprovado_rh' END;
   END IF;
  ELSIF p_action='reservar' THEN
   IF p_role<>'financeiro' OR old_status<>'aprovado_rh' THEN RAISE EXCEPTION 'Reserva indisponível'; END IF;
   new_status:='reservado_financeiro';
  ELSIF p_action='informar_pagamento' THEN
   IF p_role<>(CASE WHEN e.pagadora::text='terceirizada' THEN 'financeiro' ELSE 'caixa' END) OR NOT (old_status='reservado_financeiro' OR (e.emergencial AND old_status IN ('solicitado','aprovado_rh'))) THEN RAISE EXCEPTION 'Pagamento indisponível'; END IF;
   SELECT * INTO receipt FROM mise.extra_receipts WHERE id=(p_data->>'receipt_id')::uuid AND extra_id=p_extra;
   IF NOT FOUND OR nullif(trim(e.nome),'') IS NULL THEN RAISE EXCEPTION 'Recibo e recebedor obrigatórios'; END IF;
   IF (p_data->>'pago_em')::date IS NULL OR (p_data->>'pago_em')::date>(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Data de pagamento inválida'; END IF;
   e.pago_em:=(p_data->>'pago_em')::date;e.mise_payment_at:=now();e.mise_receipt_id:=receipt.id;
   new_status:=CASE WHEN e.mise_rh_complete THEN 'pago' ELSE 'pagamento_informado' END;
  ELSIF p_action='conferir' THEN
   IF p_role<>'financeiro' OR old_status<>'pagamento_informado' OR NOT e.mise_rh_complete OR e.mise_receipt_id IS NULL THEN RAISE EXCEPTION 'Conferência indisponível'; END IF;
   new_status:='pago';
  ELSE RAISE EXCEPTION 'Ação desconhecida';
  END IF;
  UPDATE public.op_extra SET nome=e.nome,cpf=e.cpf,valor=e.valor,pagadora=e.pagadora,
   aprovador_rh_id=e.aprovador_rh_id,status=(jsonb_populate_record(NULL::public.op_extra,jsonb_build_object('status',new_status))).status,
   mise_emergency_decision=e.mise_emergency_decision,mise_approved_total=e.mise_approved_total,mise_rh_complete=e.mise_rh_complete,mise_payment_at=e.mise_payment_at,
   mise_receipt_id=e.mise_receipt_id,pago_em=e.pago_em,mise_version=mise_version+1,
   mise_stage_at=CASE WHEN old_status<>new_status THEN now() ELSE mise_stage_at END,
   mise_allowance_snapshot=coalesce(budget,mise_allowance_snapshot) WHERE id=p_extra;
 END IF;
 INSERT INTO mise.extra_events(extra_id,actor_id,actor_role,action,from_status,to_status,note,allowance,command_id,command_payload)
 VALUES(p_extra,p_actor,p_role,p_action,old_status,new_status,note,budget,p_command,command_payload);
 -- Notify assigned directors in-app atomically; no dependency on WhatsApp/email delivery.
 IF (p_action='solicitar' AND urgent) OR (new_status='aguardando_diretoria' AND coalesce(old_status,'')<>new_status) THEN
  INSERT INTO public.notifications(user_id,tipo,titulo,mensagem,link)
  SELECT DISTINCT emp.user_id,'extras',CASE WHEN urgent THEN 'Extra emergencial registrado' ELSE 'Extra aguardando aprovação' END,
   'Há uma solicitação de extra que precisa de acompanhamento da diretoria.', '/extras?unit_id='||unit::text||'&extra_id='||p_extra::text||'&data='||day::text
  FROM mise.extra_access a JOIN public.employees emp ON emp.id=a.employee_id WHERE a.unit_id=unit AND a.role='diretor' AND emp.ativo=true AND emp.user_id IS NOT NULL;
 END IF;
 PERFORM set_config('mise.extra_command','off',true);
 RETURN jsonb_build_object('id',p_extra,'status',new_status,'replayed',false);
END;
$$;

CREATE OR REPLACE FUNCTION mise.extra_enqueue_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,mise AS $$
DECLARE e public.op_extra%ROWTYPE;
BEGIN
 SELECT * INTO e FROM public.op_extra WHERE id=NEW.extra_id;
 IF e.solicitacao_id IS NOT NULL THEN RETURN NEW; END IF;
 IF (NEW.action='solicitar' AND e.emergencial) OR (NEW.to_status='aguardando_diretoria' AND coalesce(NEW.from_status,'')<>NEW.to_status) THEN
 INSERT INTO mise.extra_notification_outbox(event_id,extra_id,payload)
 VALUES(NEW.id,e.id,jsonb_build_object('event_id',NEW.id,'tipo',CASE WHEN e.emergencial THEN 'extra_emergencial' ELSE 'aguardando_diretoria' END,'unit_id',e.unit_id,'data_trabalho',e.data_trabalho,'total',e.total,'link','/extras?unit_id='||e.unit_id::text||'&extra_id='||e.id::text||'&data='||e.data_trabalho::text));
 END IF;
 RETURN NEW;
END;
$$;

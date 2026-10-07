-- Weekly reconciliation stays in MISE; no uniqueness constraint on the shared
-- request table, since avulso can legitimately contain multiple shifts per day. Grid identity includes the period (user correction).
CREATE TABLE mise.extra_grid_commands (
 command_id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES public.employees,
 signature jsonb NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE mise.extra_grid_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mise.extra_grid_commands FROM PUBLIC,anon,authenticated;
GRANT ALL ON mise.extra_grid_commands TO service_role;

CREATE FUNCTION mise.extra_grid_revision(p_unit uuid,p_week date) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,mise AS $$
 SELECT md5(coalesce(string_agg(id::text||':'||mise_version||':'||updated_at||':'||status||':'||quantidade||':'||valor_unitario,',' ORDER BY id),''))
 FROM public.op_extra_solicitacao WHERE unit_id=p_unit AND data_trabalho BETWEEN date_trunc('week',p_week::timestamp)::date AND date_trunc('week',p_week::timestamp)::date+6;
$$;
CREATE FUNCTION mise.extra_grid_read(p_actor uuid,p_unit uuid,p_week date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,mise AS $$
DECLARE mon date:=date_trunc('week',p_week::timestamp)::date; items jsonb; schedule jsonb;
BEGIN
 IF p_week IS NULL OR NOT mise.extra_has_role(p_actor,p_unit,'lider') THEN RAISE EXCEPTION 'Sem permissão para planejar nesta casa'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_unit::text||':'||mon::text,0));
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'data_trabalho',s.data_trabalho,'funcao',s.funcao,'setor',s.setor,'quantidade',s.quantidade,'valor_unitario',s.valor_unitario,'valor_consumido',s.valor_consumido,'motivo',s.motivo,'periodo',s.periodo,'status',s.status,'solicitante_nome',s.solicitante_nome,
 'editable',s.mise_managed AND s.mise_requested_by=p_actor AND NOT s.emergencial AND s.status::text IN ('solicitado','aguardando_diretoria') AND s.mise_named_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.op_extra e WHERE e.solicitacao_id=s.id)) ORDER BY s.data_trabalho,s.funcao,s.id),'[]') INTO items
 FROM mise.extra_request_summary s WHERE s.unit_id=p_unit AND s.data_trabalho BETWEEN mon AND mon+6 AND s.status::text NOT IN ('cancelado','recusado');
 SELECT coalesce(jsonb_agg(jsonb_build_object('dia_semana',dia_semana,'periodo',periodo) ORDER BY dia_semana,periodo),'[]') INTO schedule FROM public.op_horario_padrao WHERE unit_id=p_unit;
 RETURN jsonb_build_object('items',items,'schedule',schedule,'revision',mise.extra_grid_revision(p_unit,p_week),'budget',mise.extra_week_budget(p_unit,p_week));
END;
$$;
CREATE FUNCTION mise.extra_grid_command(p_actor uuid,p_command uuid,p_unit uuid,p_week date,p_revision text,p_requester uuid,p_items jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,mise AS $$
DECLARE mon date:=date_trunc('week',p_week::timestamp)::date; prior mise.extra_grid_commands%ROWTYPE; signature jsonb;
 item jsonb; job public.op_extra_cargo%ROWTYPE; s public.op_extra_solicitacao%ROWTYPE; typed public.op_extra_solicitacao%ROWTYPE;
 qty integer; rate numeric; day date; declared_name text; duplicates integer; budget jsonb; projected numeric;
 next_status text; event_id uuid; request_id uuid; old_status text; results jsonb:='[]'; result jsonb; changed boolean;
BEGIN
 IF p_actor IS NULL OR p_command IS NULL OR p_week IS NULL OR p_revision IS NULL OR NOT mise.extra_has_role(p_actor,p_unit,'lider') OR NOT EXISTS(SELECT 1 FROM public.units WHERE id=p_unit AND active) THEN RAISE EXCEPTION 'Sem permissão para planejar nesta casa'; END IF;
 signature:=jsonb_build_object('unit',p_unit,'week',p_week,'revision',p_revision,'requester',p_requester,'items',p_items);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_command::text,0));
 SELECT * INTO prior FROM mise.extra_grid_commands WHERE command_id=p_command;
 IF FOUND THEN
  IF prior.actor_id<>p_actor OR prior.signature<>signature THEN RAISE EXCEPTION 'Chave de reenvio já usada para outro plano'; END IF;
  RETURN prior.result||jsonb_build_object('replayed',true);
 END IF;
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)>700 THEN RAISE EXCEPTION 'Grade inválida'; END IF;
 IF (SELECT count(DISTINCT (value->>'cargo_id',value->>'data_trabalho',value->>'periodo')) FROM jsonb_array_elements(p_items))<>jsonb_array_length(p_items) THEN RAISE EXCEPTION 'Função repetida no mesmo dia e período'; END IF;
 SELECT nome INTO declared_name FROM public.op_extra_solicitante WHERE id=p_requester AND unit_id=p_unit AND ativo FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Selecione um responsável ativo desta casa'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_unit::text||':'||mon::text,0));
 IF mise.extra_grid_revision(p_unit,p_week)<>p_revision THEN RAISE EXCEPTION 'A semana foi atualizada. Recarregue a grade antes de enviar'; END IF;
 budget:=mise.extra_week_budget(p_unit,p_week); projected:=(budget->>'usado')::numeric;
 -- Validate the entire batch before writing; derive sector and identities server-side.
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  SELECT * INTO job FROM public.op_extra_cargo WHERE id=(item->>'cargo_id')::uuid AND ativo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Função indisponível. Recarregue o catálogo'; END IF;
  day:=(item->>'data_trabalho')::date;
  IF day IS NULL OR day NOT BETWEEN mon AND mon+6 OR coalesce(item->>'quantidade','') !~ '^(0|[1-9][0-9]*)$' THEN RAISE EXCEPTION 'Confira datas e quantidades da semana'; END IF;
  qty:=(item->>'quantidade')::integer;
  SELECT count(*) INTO duplicates FROM public.op_extra_solicitacao WHERE unit_id=p_unit AND data_trabalho=day AND funcao=job.nome AND periodo::text IS NOT DISTINCT FROM item->>'periodo' AND status::text NOT IN ('cancelado','recusado');
  IF duplicates>1 THEN RAISE EXCEPTION 'Há pedidos de turnos distintos nesta célula. Ajuste pela fila de pedidos'; END IF;
  SELECT * INTO s FROM public.op_extra_solicitacao WHERE unit_id=p_unit AND data_trabalho=day AND funcao=job.nome AND periodo::text IS NOT DISTINCT FROM item->>'periodo' AND status::text NOT IN ('cancelado','recusado') FOR UPDATE;
  IF s.id IS NOT NULL AND (NOT s.mise_managed OR s.mise_requested_by IS DISTINCT FROM p_actor OR s.emergencial OR s.status::text NOT IN ('solicitado','aguardando_diretoria') OR s.mise_named_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.op_extra WHERE solicitacao_id=s.id)) THEN RAISE EXCEPTION 'Esta célula está em atendimento ou pertence a outro fluxo. Ajuste com o RH'; END IF;
  IF qty>0 THEN
   IF nullif(item->>'periodo','') IS NULL THEN RAISE EXCEPTION 'Informe o período'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.op_horario_padrao WHERE unit_id=p_unit AND dia_semana=extract(dow FROM day)::integer) THEN RAISE EXCEPTION 'A casa não opera neste dia ou está sem horário cadastrado'; END IF;
   rate:=(item->>'valor_unitario')::numeric;
   IF rate IS NULL OR rate<=0 OR rate::text IN ('NaN','Infinity','-Infinity') OR rate<>round(rate,2) THEN RAISE EXCEPTION 'Informe a diária positiva de cada função'; END IF;
   typed:=jsonb_populate_record(NULL::public.op_extra_solicitacao,jsonb_build_object('motivo',item->>'motivo','periodo',item->>'periodo'));
   IF typed.motivo IS NULL OR (s.id IS NULL AND typed.periodo IS NULL) THEN RAISE EXCEPTION 'Informe motivo e período'; END IF;
   projected:=projected+qty*rate;
  END IF;
  projected:=projected-coalesce(s.valor_total,0);
 END LOOP;
 PERFORM set_config('mise.extra_command','on',true);
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'data_trabalho',value->>'cargo_id' LOOP
  SELECT * INTO job FROM public.op_extra_cargo WHERE id=(item->>'cargo_id')::uuid;
  day:=(item->>'data_trabalho')::date;qty:=(item->>'quantidade')::integer;rate:=(item->>'valor_unitario')::numeric;
  SELECT * INTO s FROM public.op_extra_solicitacao WHERE unit_id=p_unit AND data_trabalho=day AND funcao=job.nome AND periodo::text IS NOT DISTINCT FROM item->>'periodo' AND status::text NOT IN ('cancelado','recusado');
  IF s.id IS NULL AND qty=0 THEN CONTINUE; END IF;
  old_status:=s.status::text;
  -- Re-sending unchanged cells must not rewrite the original requester/date or invalidate approval.
  changed:=s.id IS NULL OR qty=0 OR s.quantidade<>qty OR s.valor_unitario IS DISTINCT FROM rate OR s.motivo::text IS DISTINCT FROM item->>'motivo';
  IF NOT changed THEN CONTINUE; END IF;
  next_status:=CASE WHEN qty=0 THEN 'cancelado' WHEN projected>(budget->>'teto')::numeric THEN 'aguardando_diretoria' ELSE 'solicitado' END;
  IF s.id IS NULL THEN
   request_id:=gen_random_uuid();
   typed:=jsonb_populate_record(NULL::public.op_extra_solicitacao,jsonb_build_object('motivo',item->>'motivo','periodo',item->>'periodo'));
   INSERT INTO public.op_extra_solicitacao(id,unit_id,data_solicitacao,data_trabalho,periodo,setor,funcao,quantidade,valor_unitario,motivo,solicitante_nome,pagadora,status,emergencial,mise_managed,mise_requested_by,mise_version,mise_stage_at)
   VALUES(request_id,p_unit,(now() AT TIME ZONE 'America/Sao_Paulo')::date,day,typed.periodo,job.setor_padrao,job.nome,qty,rate,typed.motivo,declared_name,'casa',next_status::public.op_extra_status,false,true,p_actor,1,now());
  ELSE
   request_id:=s.id;
   -- Cancellation preserves original quantity/rate for historical reports.
   UPDATE public.op_extra_solicitacao SET quantidade=CASE WHEN qty>0 THEN qty ELSE quantidade END,valor_unitario=CASE WHEN qty>0 THEN rate ELSE valor_unitario END,
    motivo=CASE WHEN qty>0 THEN (jsonb_populate_record(NULL::public.op_extra_solicitacao,jsonb_build_object('motivo',item->>'motivo'))).motivo ELSE motivo END,
    status=next_status::public.op_extra_status,mise_version=mise_version+1,mise_stage_at=CASE WHEN old_status<>next_status THEN now() ELSE mise_stage_at END,mise_approved_total=NULL,updated_at=now() WHERE id=request_id;
  END IF;
  event_id:=gen_random_uuid();
  INSERT INTO mise.extra_request_events(id,request_id,actor_id,actor_role,action,from_status,to_status,note,allowance,command_id,command_payload)
  VALUES(event_id,request_id,p_actor,'lider',CASE WHEN qty=0 THEN 'cancelar' WHEN s.id IS NULL THEN 'solicitar' ELSE 'editar_planejamento' END,old_status,next_status,
   CASE WHEN qty=0 THEN 'Posição zerada na grade semanal' ELSE 'Grade semanal · responsável declarado: '||declared_name END,budget,gen_random_uuid(),jsonb_build_object('grid_command',p_command,'before',jsonb_build_object('quantidade',s.quantidade,'valor_unitario',s.valor_unitario,'motivo',s.motivo),'after',item));
  IF next_status='aguardando_diretoria' AND coalesce(old_status,'')<>next_status THEN
   INSERT INTO public.notifications(user_id,tipo,titulo,mensagem,link)
   SELECT DISTINCT e.user_id,'extras','Planejamento aguardando aprovação','A grade semanal excede a alçada da casa.','/extras?unit_id='||p_unit||'&solicitacao_id='||request_id FROM mise.extra_access a JOIN public.employees e ON e.id=a.employee_id WHERE a.unit_id=p_unit AND a.role='diretor' AND e.ativo AND e.user_id IS NOT NULL;
   INSERT INTO mise.extra_notification_outbox(request_event_id,request_id,payload) VALUES(event_id,request_id,jsonb_build_object('event_id',event_id,'tipo','aguardando_diretoria','unit_id',p_unit,'data_trabalho',day,'total',qty*rate,'link','/extras?unit_id='||p_unit||'&solicitacao_id='||request_id));
  END IF;
  results:=results||jsonb_build_array(jsonb_build_object('id',request_id,'status',next_status));
 END LOOP;
 PERFORM set_config('mise.extra_command','off',true);
 result:=jsonb_build_object('items',results,'revision',mise.extra_grid_revision(p_unit,p_week),'replayed',false);
 INSERT INTO mise.extra_grid_commands(command_id,actor_id,signature,result) VALUES(p_command,p_actor,signature,result);
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION mise.extra_grid_revision(uuid,date),mise.extra_grid_read(uuid,uuid,date),mise.extra_grid_command(uuid,uuid,uuid,date,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mise.extra_grid_read(uuid,uuid,date),mise.extra_grid_command(uuid,uuid,uuid,date,text,uuid,jsonb) TO service_role;

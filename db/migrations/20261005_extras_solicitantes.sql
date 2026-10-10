-- Existing live schema, made reproducible. No seed or historical backfill.
CREATE TABLE IF NOT EXISTS public.op_extra_solicitante (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),unit_id uuid NOT NULL REFERENCES public.units(id),
 nome text NOT NULL,employee_id uuid,ativo boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(unit_id,nome)
);
ALTER TABLE public.op_extra ADD COLUMN IF NOT EXISTS solicitante_nome text;
COMMENT ON COLUMN public.op_extra.solicitante_nome IS 'Nome autodeclarado, copiado do cadastro no momento do pedido. Não autentica identidade; não substituir mise_requested_by ou solicitante_id.';
-- Clients use role-checked server routes; the public API key cannot manage this directory.
ALTER TABLE public.op_extra_solicitante ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.op_extra_solicitante FROM anon,authenticated;
GRANT ALL ON public.op_extra_solicitante TO service_role;

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

CREATE OR REPLACE FUNCTION mise.extra_monthly_report(p_unit uuid,p_year integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('custos',coalesce((SELECT jsonb_agg(c) FROM (
 SELECT extract(month from data_trabalho)::int mes,setor,sum(total) custo,count(*) quantidade,count(*) FILTER(WHERE total IS NULL) sem_valor
 FROM public.op_extra WHERE unit_id=p_unit AND data_trabalho>=make_date(p_year,1,1) AND data_trabalho<make_date(p_year+1,1,1)
 AND status::text NOT IN ('recusado','cancelado') GROUP BY 1,2) c),'[]'::jsonb),
 'receitas',coalesce((SELECT jsonb_agg(r) FROM (
 SELECT mes_num::int mes,CASE p_year WHEN 2022 THEN sum(rec_2022) WHEN 2023 THEN sum(rec_2023) WHEN 2024 THEN sum(rec_2024) WHEN 2025 THEN sum(rec_2025) END faturamento,'DRE histórico · restaurante' fonte
 FROM public.dre_faturamento_historico WHERE unit_id=p_unit AND categoria='restaurante' AND p_year BETWEEN 2022 AND 2025 GROUP BY mes_num
 UNION ALL
 SELECT split_part(mes_ano,'-',2)::int mes,sum(valor) faturamento,'DRE · faturamento realizado' fonte
 FROM public.dre_receita_detalhada WHERE unit_id=p_unit AND grupo='FATURAMENTO' AND mes_ano ~ ('^'||p_year::text||'-(0?[1-9]|1[0-2])$') AND p_year>=2026 GROUP BY 1
 ) r),'[]'::jsonb),
 'solicitantes',coalesce((SELECT jsonb_agg(s ORDER BY s.mes,s.solicitante_nome) FROM (
 SELECT extract(month from data_trabalho)::int mes,solicitante_nome,count(*) quantidade,sum(total) custo,
 count(*) FILTER(WHERE total IS NULL) sem_valor
 FROM public.op_extra WHERE unit_id=p_unit AND data_trabalho>=make_date(p_year,1,1) AND data_trabalho<make_date(p_year+1,1,1)
 AND status::text NOT IN ('recusado','cancelado') GROUP BY 1,2
 ) s),'[]'::jsonb));
$$;

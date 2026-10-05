-- Additive contract: old/KPH-OS rows retain mise_managed=false.
-- No access assignments, historical imports or payments are performed here.
ALTER TYPE public.op_extra_status ADD VALUE IF NOT EXISTS 'pagamento_informado';
ALTER TABLE public.op_extra ALTER COLUMN nome DROP NOT NULL;
ALTER TABLE public.op_extra ADD COLUMN IF NOT EXISTS mise_managed boolean NOT NULL DEFAULT false;
ALTER TABLE public.op_extra ADD COLUMN IF NOT EXISTS mise_requested_by uuid REFERENCES public.employees(id);
ALTER TABLE public.op_extra ADD COLUMN IF NOT EXISTS mise_stage_at timestamptz;
ALTER TABLE public.op_extra ADD COLUMN IF NOT EXISTS mise_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.op_extra ADD COLUMN IF NOT EXISTS mise_rh_complete boolean NOT NULL DEFAULT false;
ALTER TABLE public.op_extra ADD COLUMN IF NOT EXISTS mise_approved_total numeric;
ALTER TABLE public.op_extra ADD COLUMN IF NOT EXISTS mise_payment_at timestamptz;
ALTER TABLE public.op_extra ADD COLUMN IF NOT EXISTS mise_receipt_id uuid;
ALTER TABLE public.op_extra ADD COLUMN IF NOT EXISTS mise_allowance_snapshot jsonb;

CREATE TABLE IF NOT EXISTS mise.extra_access (
 employee_id uuid NOT NULL REFERENCES public.employees(id),
 unit_id uuid NOT NULL REFERENCES public.units(id),
 role text NOT NULL CHECK(role IN ('lider','rh','diretor','financeiro','caixa')),
 granted_by uuid NOT NULL REFERENCES public.employees(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(employee_id,unit_id,role)
);
CREATE TABLE IF NOT EXISTS mise.extra_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 extra_id uuid NOT NULL REFERENCES public.op_extra(id),
 actor_id uuid NOT NULL REFERENCES public.employees(id),
 actor_role text NOT NULL,
 action text NOT NULL,
 from_status text,
 to_status text NOT NULL,
 note text,
 allowance jsonb,
 command_id uuid NOT NULL UNIQUE,
 command_payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS extra_events_extra_date ON mise.extra_events(extra_id,created_at);
CREATE INDEX IF NOT EXISTS op_extra_unit_workday ON public.op_extra(unit_id,data_trabalho);
CREATE TABLE IF NOT EXISTS mise.extra_receipts (
 id uuid PRIMARY KEY,
 extra_id uuid NOT NULL REFERENCES public.op_extra(id),
 uploaded_by uuid NOT NULL REFERENCES public.employees(id),
 object_path text NOT NULL UNIQUE,
 content_type text NOT NULL CHECK(content_type IN ('application/pdf','image/jpeg','image/png')),
 size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 8388608),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mise.extra_access_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES public.employees(id),
 employee_id uuid NOT NULL REFERENCES public.employees(id),unit_id uuid NOT NULL REFERENCES public.units(id),
 role text NOT NULL, action text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE mise.extra_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE mise.extra_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mise.extra_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mise.extra_access_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mise.extra_access,mise.extra_events,mise.extra_receipts,mise.extra_access_events FROM anon,authenticated;
GRANT ALL ON mise.extra_access,mise.extra_events,mise.extra_receipts,mise.extra_access_events TO service_role;

CREATE OR REPLACE FUNCTION mise.extra_has_role(actor uuid, unit uuid, required_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,mise AS $$
 SELECT EXISTS (SELECT 1 FROM mise.extra_access a JOIN public.employees e ON e.id=a.employee_id
 WHERE a.employee_id=actor AND a.unit_id=unit AND a.role=required_role AND e.ativo=true AND (required_role<>'lider' OR e.unit_id=unit));
$$;
REVOKE ALL ON FUNCTION mise.extra_has_role(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mise.extra_has_role(uuid,uuid,text) TO service_role;

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
 SELECT coalesce(sum(total),0) INTO spent FROM public.op_extra
 WHERE unit_id=p_unit AND data_trabalho BETWEEN mon AND sun AND status::text NOT IN ('recusado','cancelado') AND (p_exclude IS NULL OR id<>p_exclude);
 ceiling:=round(goal*coalesce(pct,0)/100,2);
 RETURN jsonb_build_object('segunda',mon,'domingo',sun,'meta',goal,'percentual',pct,'vigente_desde',effective,'teto',ceiling,'usado',spent,'saldo',ceiling-spent,'dias_sem_meta',missing);
END;
$$;
REVOKE ALL ON FUNCTION mise.extra_week_budget(uuid,date,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mise.extra_week_budget(uuid,date,uuid) TO service_role;

-- Managed rows may only be changed by the transactional command below.
CREATE OR REPLACE FUNCTION mise.extra_write_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,mise AS $$
BEGIN
 IF (CASE WHEN TG_OP='INSERT' THEN NEW.mise_managed ELSE OLD.mise_managed OR CASE WHEN TG_OP='DELETE' THEN false ELSE NEW.mise_managed END END)
    AND coalesce(current_setting('mise.extra_command',true),'') <> 'on' THEN
  RAISE EXCEPTION 'Use o fluxo transacional do MISE para alterar este extra';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS mise_extra_write_guard ON public.op_extra;
CREATE TRIGGER mise_extra_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.op_extra FOR EACH ROW EXECUTE FUNCTION mise.extra_write_guard();

CREATE OR REPLACE FUNCTION mise.extra_valid_cpf(cpf text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE n integer; i integer; total integer; digit integer;
BEGIN
 IF cpf IS NULL OR cpf !~ '^\d{11}$' OR cpf ~ '^(.)\1{10}$' THEN RETURN false; END IF;
 FOR n IN 9..10 LOOP
  total:=0;
  FOR i IN 1..n LOOP total:=total+substring(cpf,i,1)::integer*(n+2-i); END LOOP;
  digit:=(total*10)%11; IF digit=10 THEN digit:=0; END IF;
  IF digit<>substring(cpf,n+1,1)::integer THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION mise.extra_valid_cpf(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mise.extra_valid_cpf(text) TO service_role;

CREATE OR REPLACE FUNCTION mise.extra_command(p_actor uuid,p_role text,p_command uuid,p_action text,p_extra uuid,p_version integer,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,mise AS $$
DECLARE e public.op_extra%ROWTYPE; prior mise.extra_events%ROWTYPE; unit uuid; day date; mon date;
 budget jsonb; amount numeric; commission numeric; new_status text; old_status text; note text:=nullif(trim(p_data->>'note'),'');
 urgent boolean; command_payload jsonb; receipt mise.extra_receipts%ROWTYPE; employee_user uuid;
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
  urgent:=coalesce((p_data->>'emergencial')::boolean,false);
  IF p_role='caixa' AND NOT urgent THEN RAISE EXCEPTION 'Caixa registra somente emergências'; END IF;
  amount:=(p_data->>'valor')::numeric;commission:=coalesce((p_data->>'comissao')::numeric,0);
  IF amount IS NULL OR amount<=0 OR amount::text IN ('NaN','Infinity','-Infinity') OR commission::text IN ('NaN','Infinity','-Infinity') OR commission<0 OR amount<>round(amount,2) OR commission<>round(commission,2) THEN RAISE EXCEPTION 'Valores inválidos'; END IF;
  IF nullif(trim(p_data->>'setor'),'') IS NULL OR nullif(trim(p_data->>'funcao'),'') IS NULL OR nullif(trim(p_data->>'motivo_detalhe'),'') IS NULL THEN RAISE EXCEPTION 'Informe setor, função e contexto'; END IF;
  IF urgent AND nullif(trim(p_data->>'nome'),'') IS NULL THEN RAISE EXCEPTION 'Identifique o recebedor da emergência'; END IF;
  IF nullif(p_data->>'periodo','') IS NULL THEN RAISE EXCEPTION 'Informe o período'; END IF;
  IF coalesce((p_data->>'sequencia')::integer,0) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Sequência inválida'; END IF;
  budget:=mise.extra_week_budget(unit,day);
  new_status:=CASE WHEN NOT urgent AND amount+commission>(budget->>'saldo')::numeric THEN 'aguardando_diretoria' ELSE 'solicitado' END;
  SELECT user_id INTO employee_user FROM public.employees WHERE id=p_actor;
  e:=jsonb_populate_record(NULL::public.op_extra,jsonb_build_object('id',p_extra,'unit_id',unit,'data_solicitacao',(now() AT TIME ZONE 'America/Sao_Paulo')::date,'data_trabalho',day,'setor',trim(p_data->>'setor'),'funcao',trim(p_data->>'funcao'),'motivo',p_data->>'motivo','motivo_detalhe',trim(p_data->>'motivo_detalhe'),'nome',nullif(trim(p_data->>'nome'),''),'valor',amount,'comissao',commission,'status',new_status,'emergencial',urgent,'pagadora','casa','periodo',p_data->>'periodo','sequencia',(p_data->>'sequencia')::integer));
  INSERT INTO public.op_extra(id,unit_id,data_solicitacao,data_trabalho,setor,funcao,motivo,motivo_detalhe,nome,valor,comissao,status,emergencial,pagadora,periodo,sequencia,solicitante_id,mise_managed,mise_requested_by,mise_stage_at,mise_version,mise_allowance_snapshot)
   VALUES(e.id,e.unit_id,e.data_solicitacao,e.data_trabalho,e.setor,e.funcao,e.motivo,e.motivo_detalhe,e.nome,e.valor,e.comissao,e.status,e.emergencial,e.pagadora,e.periodo,e.sequencia,employee_user,true,p_actor,now(),1,budget);
 ELSE
  SELECT * INTO e FROM public.op_extra WHERE id=p_extra AND mise_managed FOR UPDATE;
  IF NOT FOUND OR (p_version IS NULL OR e.mise_version<>p_version) THEN RAISE EXCEPTION 'Solicitação atualizada. Recarregue antes de agir'; END IF;
  old_status:=e.status::text;new_status:=old_status;
  IF old_status IN ('pago','cancelado','recusado') THEN RAISE EXCEPTION 'Registro encerrado'; END IF;
  IF p_action='aprovar' THEN
   IF p_role<>'diretor' OR old_status<>'aguardando_diretoria' OR note IS NULL THEN RAISE EXCEPTION 'Aprovação indisponível ou sem justificativa'; END IF;
   e.mise_approved_total:=e.total;
   new_status:=CASE WHEN e.mise_rh_complete THEN 'aprovado_rh' ELSE 'solicitado' END;
  ELSIF p_action IN ('recusar','cancelar') THEN
   IF note IS NULL OR NOT ((p_action='recusar' AND p_role='diretor' AND old_status='aguardando_diretoria') OR (p_action='cancelar' AND p_role='lider' AND e.mise_requested_by=p_actor AND old_status IN ('solicitado','aguardando_diretoria'))) THEN RAISE EXCEPTION 'Encerramento indisponível ou sem motivo'; END IF;
   new_status:=CASE WHEN p_action='recusar' THEN 'recusado' ELSE 'cancelado' END;
  ELSIF p_action='preparar_rh' THEN
   IF p_role<>'rh' OR old_status NOT IN ('solicitado','pagamento_informado') THEN RAISE EXCEPTION 'Etapa do RH indisponível'; END IF;
   IF nullif(trim(p_data->>'nome'),'') IS NULL OR NOT mise.extra_valid_cpf(p_data->>'cpf') THEN RAISE EXCEPTION 'Informe nome e CPF válido'; END IF;
   amount:=(p_data->>'valor')::numeric;commission:=coalesce((p_data->>'comissao')::numeric,0);
   IF amount IS NULL OR amount<=0 OR amount::text IN ('NaN','Infinity','-Infinity') OR commission::text IN ('NaN','Infinity','-Infinity') OR commission<0 OR amount<>round(amount,2) OR commission<>round(commission,2) THEN RAISE EXCEPTION 'Valores inválidos'; END IF;
   IF p_data->>'pagadora' NOT IN ('casa','terceirizada') OR p_data->>'pagadora' IS NULL THEN RAISE EXCEPTION 'Pagadora inválida'; END IF;
   IF old_status='pagamento_informado' AND (amount<>e.valor OR commission<>e.comissao OR p_data->>'pagadora'<>e.pagadora::text) THEN RAISE EXCEPTION 'Pagamento informado: preserve valores e pagadora'; END IF;
   e.nome:=trim(p_data->>'nome');e.cpf:=p_data->>'cpf';e.valor:=amount;e.comissao:=commission;
   e.pagadora:=(jsonb_populate_record(NULL::public.op_extra,jsonb_build_object('pagadora',p_data->>'pagadora'))).pagadora;
   e.mise_rh_complete:=true;
   SELECT user_id INTO e.aprovador_rh_id FROM public.employees WHERE id=p_actor;
   budget:=mise.extra_week_budget(unit,day,p_extra);
   IF old_status<>'pagamento_informado' THEN
    new_status:=CASE WHEN NOT e.emergencial AND amount+commission>(budget->>'saldo')::numeric AND amount+commission>coalesce(e.mise_approved_total,0) THEN 'aguardando_diretoria' ELSE 'aprovado_rh' END;
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
   new_status:='pagamento_informado';
  ELSIF p_action='conferir' THEN
   IF p_role<>'financeiro' OR old_status<>'pagamento_informado' OR NOT e.mise_rh_complete OR e.mise_receipt_id IS NULL THEN RAISE EXCEPTION 'Conferência indisponível'; END IF;
   new_status:='pago';
  ELSE RAISE EXCEPTION 'Ação desconhecida';
  END IF;
  UPDATE public.op_extra SET nome=e.nome,cpf=e.cpf,valor=e.valor,comissao=e.comissao,pagadora=e.pagadora,
   aprovador_rh_id=e.aprovador_rh_id,status=(jsonb_populate_record(NULL::public.op_extra,jsonb_build_object('status',new_status))).status,
   mise_approved_total=e.mise_approved_total,mise_rh_complete=e.mise_rh_complete,mise_payment_at=e.mise_payment_at,
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
REVOKE ALL ON FUNCTION mise.extra_command(uuid,text,uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mise.extra_command(uuid,text,uuid,text,uuid,integer,jsonb) TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('mise-extra-receipts','mise-extra-receipts',false,8388608,ARRAY['application/pdf','image/jpeg','image/png']) ON CONFLICT(id) DO NOTHING;

CREATE OR REPLACE FUNCTION mise.extra_access_set(p_admin uuid,p_employee uuid,p_unit uuid,p_role text,p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,mise AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.employees e JOIN public.roles r ON r.id=e.role_id WHERE e.id=p_admin AND e.ativo AND (lower(r.name)='founder' OR r.permissions @> '["*"]'::jsonb)) THEN RAISE EXCEPTION 'Somente administrador pode configurar acessos'; END IF;
 IF p_role NOT IN ('lider','rh','diretor','financeiro','caixa') OR p_enabled IS NULL THEN RAISE EXCEPTION 'Papel inválido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.employees WHERE id=p_employee AND ativo AND (p_role<>'lider' OR unit_id=p_unit)) THEN RAISE EXCEPTION 'Colaborador indisponível ou líder fora da própria unidade'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.units WHERE id=p_unit AND active) THEN RAISE EXCEPTION 'Unidade indisponível'; END IF;
 IF p_enabled THEN
  INSERT INTO mise.extra_access(employee_id,unit_id,role,granted_by) VALUES(p_employee,p_unit,p_role,p_admin) ON CONFLICT(employee_id,unit_id,role) DO NOTHING;
 ELSE DELETE FROM mise.extra_access WHERE employee_id=p_employee AND unit_id=p_unit AND role=p_role;
 END IF;
 INSERT INTO mise.extra_access_events(actor_id,employee_id,unit_id,role,action) VALUES(p_admin,p_employee,p_unit,p_role,CASE WHEN p_enabled THEN 'grant' ELSE 'revoke' END);
END;
$$;
REVOKE ALL ON FUNCTION mise.extra_access_set(uuid,uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mise.extra_access_set(uuid,uuid,uuid,text,boolean) TO service_role;
-- New managed rows are read/written through the role-aware API only.
-- Existing KPH-OS policies still govern all legacy rows.
DROP POLICY IF EXISTS mise_managed_extras_server_only ON public.op_extra;
CREATE POLICY mise_managed_extras_server_only ON public.op_extra AS RESTRICTIVE FOR ALL TO authenticated USING(NOT mise_managed) WITH CHECK(NOT mise_managed);

ALTER TABLE mise.checklist_templates ADD COLUMN IF NOT EXISTS scoring_model text NOT NULL DEFAULT 'ff_ponderado' CHECK(scoring_model IN ('ff_ponderado','headchef_conformidade','headchef_narrativo'));
ALTER TABLE mise.checklist_executions ADD COLUMN IF NOT EXISTS crivo_snapshot jsonb;
ALTER TABLE mise.checklist_executions ADD COLUMN IF NOT EXISTS crivo_result jsonb;
ALTER TABLE mise.checklist_executions ADD COLUMN IF NOT EXISTS report_version integer NOT NULL DEFAULT 0;
ALTER TABLE mise.crivo_plano_acao ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS mise.crivo_action_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),action_id uuid NOT NULL REFERENCES mise.crivo_plano_acao(id),actor_id uuid NOT NULL REFERENCES public.employees(id),from_status text,to_status text NOT NULL,note text,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE mise.crivo_action_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mise.crivo_action_events FROM anon,authenticated;
GRANT ALL ON mise.crivo_action_events TO service_role;
CREATE OR REPLACE FUNCTION mise.crivo_freeze_template() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,mise AS $$
DECLARE template mise.checklist_templates%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND OLD.status='concluido' AND OLD.crivo_snapshot IS NULL THEN NEW.crivo_snapshot:=NULL;RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND OLD.crivo_snapshot IS NOT NULL THEN NEW.crivo_snapshot:=OLD.crivo_snapshot;RETURN NEW;END IF;
 SELECT * INTO template FROM mise.checklist_templates WHERE id=NEW.template_id;
 IF template.modulo='CRIVO' THEN
 NEW.crivo_snapshot:=jsonb_build_object('nome',template.nome,'model',template.scoring_model,'captured_at',now(),'items',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.ordem) FROM mise.checklist_template_items i WHERE i.template_id=template.id),'[]'::jsonb),'weights',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM mise.checklist_template_topicos t WHERE t.template_id=template.id),'[]'::jsonb));
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS crivo_freeze_template ON mise.checklist_executions;
CREATE TRIGGER crivo_freeze_template BEFORE INSERT OR UPDATE ON mise.checklist_executions FOR EACH ROW EXECUTE FUNCTION mise.crivo_freeze_template();
-- Only unfinished visits receive current template snapshots. Historical scores remain untouched.
UPDATE mise.checklist_executions e SET crivo_snapshot=NULL FROM mise.checklist_templates t WHERE e.template_id=t.id AND t.modulo='CRIVO' AND e.status<>'concluido' AND e.crivo_snapshot IS NULL;
CREATE OR REPLACE FUNCTION mise.crivo_response_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,mise AS $$
DECLARE execution mise.checklist_executions%ROWTYPE; response_item uuid;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.execution_id<>OLD.execution_id OR NEW.item_id<>OLD.item_id) THEN RAISE EXCEPTION 'Não é possível mover uma resposta entre visitas/itens';END IF;
 SELECT * INTO execution FROM mise.checklist_executions WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.execution_id ELSE NEW.execution_id END FOR UPDATE;
 IF execution.crivo_snapshot IS NOT NULL THEN
  IF execution.status='concluido' THEN RAISE EXCEPTION 'Visita concluída: respostas preservadas'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(execution.crivo_snapshot->'items') i WHERE i->>'id'=NEW.item_id::text) THEN RAISE EXCEPTION 'Item não pertence a esta visita'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS crivo_response_guard ON mise.checklist_responses;
CREATE TRIGGER crivo_response_guard BEFORE INSERT OR UPDATE OR DELETE ON mise.checklist_responses FOR EACH ROW EXECUTE FUNCTION mise.crivo_response_guard();
CREATE OR REPLACE FUNCTION mise.crivo_finish(p_execution uuid,p_actor uuid,p_result jsonb,p_response_hash text,p_geo jsonb DEFAULT '{}') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,mise,public AS $$
DECLARE e mise.checklist_executions%ROWTYPE; current_hash text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM employees emp JOIN roles r ON r.id=emp.role_id WHERE emp.id=p_actor AND emp.ativo AND (lower(r.name)='founder' OR r.permissions @> '["*"]'::jsonb)) THEN RAISE EXCEPTION 'Acesso restrito';END IF;
 SELECT * INTO e FROM mise.checklist_executions WHERE id=p_execution FOR UPDATE;
 IF NOT FOUND OR e.status='concluido' OR e.crivo_snapshot IS NULL THEN RAISE EXCEPTION 'Visita indisponível';END IF;
 SELECT md5(coalesce(string_agg(id::text||respondido_em::text||coalesce(resposta::text,'')||coalesce(comentario,'')||coalesce(foto_url,'')||nao_aplicavel::text,'|' ORDER BY id),'')) INTO current_hash FROM mise.checklist_responses WHERE execution_id=p_execution;
 IF current_hash<>p_response_hash THEN RAISE EXCEPTION 'Respostas alteradas. Atualize antes de concluir'; END IF;
 IF p_result->>'model'<>e.crivo_snapshot->>'model' THEN RAISE EXCEPTION 'Metodologia divergente';END IF;
 UPDATE mise.checklist_executions SET status='concluido',pontuacao_total=(p_result->>'pontuacao_total')::numeric,pontuacao_obtida=(p_result->>'pontuacao_obtida')::numeric,percentual=(p_result->>'percentual')::numeric,crivo_result=p_result,concluido_em=now(),geo_fim_lat=(p_geo->>'lat')::numeric,geo_fim_lng=(p_geo->>'lng')::numeric WHERE id=p_execution;
 DELETE FROM mise.checklist_execution_topicos WHERE execution_id=p_execution;
 INSERT INTO mise.checklist_execution_topicos(execution_id,topico_ordem,topico_nome,percentual,zerado_por_critico,peso)
 SELECT p_execution,(t->>'topico_ordem')::int,t->>'topico_nome',(t->>'percentual')::numeric,(t->>'zerado_por_critico')::boolean,(t->>'peso')::numeric FROM jsonb_array_elements(p_result->'topicos')t;
END;
$$;
CREATE OR REPLACE FUNCTION mise.crivo_response_hash(p_execution uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,mise AS $$
 SELECT md5(coalesce(string_agg(id::text||respondido_em::text||coalesce(resposta::text,'')||coalesce(comentario,'')||coalesce(foto_url,'')||nao_aplicavel::text,'|' ORDER BY id),'')) FROM mise.checklist_responses WHERE execution_id=p_execution;
$$;
REVOKE ALL ON FUNCTION mise.crivo_finish(uuid,uuid,jsonb,text,jsonb),mise.crivo_response_hash(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mise.crivo_finish(uuid,uuid,jsonb,text,jsonb),mise.crivo_response_hash(uuid) TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('mise-crivo-evidence','mise-crivo-evidence',false,8388608,ARRAY['application/pdf','image/jpeg','image/png']) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS mise.crivo_assets(id uuid PRIMARY KEY,execution_id uuid NOT NULL REFERENCES mise.checklist_executions(id),uploaded_by uuid NOT NULL REFERENCES public.employees(id),kind text NOT NULL CHECK(kind IN ('foto','assinatura','evidencia')),object_path text NOT NULL UNIQUE,content_type text NOT NULL,size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 8388608),created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE mise.crivo_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mise.crivo_assets FROM anon,authenticated;
GRANT ALL ON mise.crivo_assets TO service_role;
CREATE OR REPLACE FUNCTION mise.crivo_action_save(p_actor uuid,p_id uuid,p_execution uuid,p_version integer,p_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,mise,public AS $$
DECLARE e mise.checklist_executions%ROWTYPE;a mise.crivo_plano_acao%ROWTYPE; actor_unit uuid;is_admin boolean;is_manager boolean;owner_name text;next_status text;asset mise.crivo_assets%ROWTYPE;
BEGIN
 SELECT emp.unit_id,(lower(r.name)='founder' OR r.permissions @> '["*"]'::jsonb),emp.user_id IS NOT NULL INTO actor_unit,is_admin,is_manager FROM employees emp LEFT JOIN roles r ON r.id=emp.role_id WHERE emp.id=p_actor AND emp.ativo;
 IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador indisponível';END IF;
 SELECT * INTO e FROM mise.checklist_executions WHERE id=p_execution;
 IF NOT FOUND OR e.crivo_snapshot IS NULL OR NOT coalesce((is_admin OR is_manager AND actor_unit=e.unit_id),false) THEN RAISE EXCEPTION 'Sem acesso à visita';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 SELECT * INTO a FROM mise.crivo_plano_acao WHERE id=p_id FOR UPDATE;
 IF FOUND AND (a.execution_id<>p_execution OR p_version IS NULL OR a.version<>p_version) THEN RAISE EXCEPTION 'Ação atualizada. Recarregue';END IF;
 IF a.id IS NULL AND NOT coalesce(is_admin,false) THEN RAISE EXCEPTION 'Somente auditor configura ações'; END IF;
 IF NOT coalesce(is_admin,false) AND a.responsavel_employee_id<>p_actor AND NOT is_manager THEN RAISE EXCEPTION 'Sem permissão para esta ação';END IF;
 IF a.id IS NULL OR coalesce(is_admin,false) THEN
  SELECT nome INTO owner_name FROM employees WHERE id=(p_data->>'responsavel_employee_id')::uuid AND ativo AND unit_id=e.unit_id;
  IF owner_name IS NULL OR nullif(trim(p_data->>'descricao'),'') IS NULL OR nullif(trim(p_data->>'orientacao'),'') IS NULL OR (p_data->>'prazo')::date IS NULL THEN RAISE EXCEPTION 'Informe ação, orientação, responsável da unidade e prazo'; END IF;
  IF p_data->>'response_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM mise.checklist_responses WHERE id=(p_data->>'response_id')::uuid AND execution_id=p_execution) THEN RAISE EXCEPTION 'Resposta de outra visita'; END IF;
 END IF;
 next_status:=coalesce(p_data->>'status','aberto');
 IF next_status NOT IN ('aberto','em_andamento','resolvido','cancelado') THEN RAISE EXCEPTION 'Status inválido'; END IF;
 IF a.status IN ('resolvido','cancelado') AND NOT coalesce(is_admin,false) THEN RAISE EXCEPTION 'Ação encerrada'; END IF;
 IF next_status='cancelado' AND (NOT coalesce(is_admin,false) OR nullif(trim(p_data->>'note'),'') IS NULL) THEN RAISE EXCEPTION 'Cancelamento exige auditor e justificativa'; END IF;
 IF next_status='resolvido' THEN
  SELECT * INTO asset FROM mise.crivo_assets WHERE id=(p_data->>'asset_id')::uuid AND execution_id=p_execution AND kind='evidencia';
  IF NOT FOUND THEN RAISE EXCEPTION 'Anexe evidência para concluir';END IF;
 END IF;
 IF a.id IS NULL THEN
  INSERT INTO mise.crivo_plano_acao(id,execution_id,response_id,descricao,orientacao,responsavel_nome,responsavel_employee_id,prazo,status,evidencia_url,resolvido_em,resolvido_por,version)
  VALUES(p_id,p_execution,(p_data->>'response_id')::uuid,trim(p_data->>'descricao'),trim(p_data->>'orientacao'),owner_name,(p_data->>'responsavel_employee_id')::uuid,(p_data->>'prazo')::date,next_status,asset.object_path,CASE WHEN next_status='resolvido' THEN now() END,CASE WHEN next_status='resolvido' THEN p_actor END,1);
 ELSE
  UPDATE mise.crivo_plano_acao SET descricao=CASE WHEN is_admin THEN trim(p_data->>'descricao') ELSE descricao END,orientacao=CASE WHEN is_admin THEN trim(p_data->>'orientacao') ELSE orientacao END,responsavel_nome=coalesce(owner_name,responsavel_nome),responsavel_employee_id=CASE WHEN is_admin THEN (p_data->>'responsavel_employee_id')::uuid ELSE responsavel_employee_id END,prazo=CASE WHEN is_admin THEN (p_data->>'prazo')::date ELSE prazo END,status=next_status,evidencia_url=CASE WHEN next_status='resolvido' THEN asset.object_path ELSE evidencia_url END,resolvido_em=CASE WHEN next_status='resolvido' THEN now() END,resolvido_por=CASE WHEN next_status='resolvido' THEN p_actor END,version=version+1 WHERE id=p_id;
 END IF;
 INSERT INTO mise.crivo_action_events(action_id,actor_id,from_status,to_status,note) VALUES(p_id,p_actor,a.status,next_status,p_data->>'note');
END;
$$;
REVOKE ALL ON FUNCTION mise.crivo_action_save(uuid,uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mise.crivo_action_save(uuid,uuid,uuid,integer,jsonb) TO service_role;
-- The plan must not bypass owner, deadline, evidence and event validation.
REVOKE INSERT,UPDATE,DELETE ON mise.crivo_plano_acao FROM anon,authenticated;
GRANT ALL ON mise.crivo_plano_acao TO service_role;

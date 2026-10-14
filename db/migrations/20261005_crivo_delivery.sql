ALTER TABLE mise.crivo_plano_acao ADD COLUMN IF NOT EXISTS revisao_pendente boolean NOT NULL DEFAULT false;
ALTER TABLE mise.crivo_plano_acao ADD COLUMN IF NOT EXISTS gerado_automaticamente boolean NOT NULL DEFAULT false;
ALTER TABLE mise.checklist_executions ADD COLUMN IF NOT EXISTS plano_revisado_em timestamptz;
ALTER TABLE mise.checklist_executions ADD COLUMN IF NOT EXISTS plano_revisado_por uuid REFERENCES public.employees(id);
ALTER TABLE mise.checklist_executions ADD COLUMN IF NOT EXISTS avaliador_cargo text;
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
 INSERT INTO mise.checklist_execution_topicos(execution_id,topico_ordem,topico_nome,percentual,zerado_por_critico,peso)
 SELECT p_execution,(t->>'topico_ordem')::int,t->>'topico_nome',(t->>'percentual')::numeric,(t->>'zerado_por_critico')::boolean,(t->>'peso')::numeric FROM jsonb_array_elements(p_result->'topicos')t ON CONFLICT(execution_id,topico_ordem) DO UPDATE SET percentual=excluded.percentual,zerado_por_critico=excluded.zerado_por_critico,peso=excluded.peso;
 -- Draft actions are created in the same transaction as completion; never invent an owner/date.
 WITH inserted AS (
 INSERT INTO mise.crivo_plano_acao(execution_id,response_id,descricao,orientacao,status,revisao_pendente,gerado_automaticamente)
 SELECT p_execution,r.id,coalesce(i->>'titulo','Não conformidade'),nullif(trim(r.orientacao_corretiva),''),'aberto',true,true
 FROM mise.checklist_responses r JOIN jsonb_array_elements(e.crivo_snapshot->'items') i ON i->>'id'=r.item_id::text
 WHERE r.execution_id=p_execution AND NOT r.nao_aplicavel AND r.resposta->>'valor'='nao'
 AND NOT EXISTS(SELECT 1 FROM mise.crivo_plano_acao a WHERE a.execution_id=p_execution AND a.response_id=r.id)
 RETURNING id)
 INSERT INTO mise.crivo_action_events(action_id,actor_id,to_status,note) SELECT id,p_actor,'aberto','Gerada na conclusão da auditoria; revisão de orientação, responsável e prazo pendente.' FROM inserted;
END;
$$;
-- Allow action plans for historical CRIVO visits without changing their score.
CREATE OR REPLACE FUNCTION mise.crivo_action_save(p_actor uuid,p_id uuid,p_execution uuid,p_version integer,p_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,mise,public AS $$
DECLARE e mise.checklist_executions%ROWTYPE;a mise.crivo_plano_acao%ROWTYPE; actor_unit uuid;is_admin boolean;is_manager boolean;owner_name text;next_status text;asset mise.crivo_assets%ROWTYPE;
BEGIN
 SELECT emp.unit_id,(lower(r.name)='founder' OR r.permissions @> '["*"]'::jsonb),(emp.user_id IS NOT NULL OR EXISTS(SELECT 1 FROM mise.sessions s WHERE s.employee_id=emp.id AND s.role='gerente' AND s.expires_at>now())) INTO actor_unit,is_admin,is_manager FROM employees emp LEFT JOIN roles r ON r.id=emp.role_id WHERE emp.id=p_actor AND emp.ativo;
 IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador indisponível';END IF;
 SELECT * INTO e FROM mise.checklist_executions WHERE id=p_execution FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM mise.checklist_templates WHERE id=e.template_id AND modulo='CRIVO') OR NOT coalesce((is_admin OR is_manager AND actor_unit=e.unit_id),false) THEN RAISE EXCEPTION 'Sem acesso à visita';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 SELECT * INTO a FROM mise.crivo_plano_acao WHERE id=p_id FOR UPDATE;
 IF FOUND AND (a.execution_id<>p_execution OR p_version IS NULL OR a.version<>p_version) THEN RAISE EXCEPTION 'Ação atualizada. Recarregue';END IF;
 IF NOT coalesce(is_admin,false) AND (a.revisao_pendente OR e.plano_revisado_em IS NULL) THEN RAISE EXCEPTION 'Plano aguardando revisão do auditor';END IF;
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
  SELECT * INTO asset FROM mise.crivo_assets WHERE id=(p_data->>'asset_id')::uuid AND execution_id=p_execution AND kind='evidencia' AND content_type IN ('image/jpeg','image/png');
  IF NOT FOUND THEN RAISE EXCEPTION 'Anexe evidência para concluir';END IF;
 END IF;
 IF a.id IS NULL THEN
  INSERT INTO mise.crivo_plano_acao(id,execution_id,response_id,descricao,orientacao,responsavel_nome,responsavel_employee_id,prazo,status,evidencia_url,resolvido_em,resolvido_por,version)
  VALUES(p_id,p_execution,(p_data->>'response_id')::uuid,trim(p_data->>'descricao'),trim(p_data->>'orientacao'),owner_name,(p_data->>'responsavel_employee_id')::uuid,(p_data->>'prazo')::date,next_status,asset.object_path,CASE WHEN next_status='resolvido' THEN now() END,CASE WHEN next_status='resolvido' THEN p_actor END,1);
 ELSE
  UPDATE mise.crivo_plano_acao SET descricao=CASE WHEN is_admin THEN trim(p_data->>'descricao') ELSE descricao END,orientacao=CASE WHEN is_admin THEN trim(p_data->>'orientacao') ELSE orientacao END,responsavel_nome=coalesce(owner_name,responsavel_nome),responsavel_employee_id=CASE WHEN is_admin THEN (p_data->>'responsavel_employee_id')::uuid ELSE responsavel_employee_id END,prazo=CASE WHEN is_admin THEN (p_data->>'prazo')::date ELSE prazo END,status=next_status,evidencia_url=CASE WHEN next_status='resolvido' THEN asset.object_path ELSE evidencia_url END,resolvido_em=CASE WHEN next_status='resolvido' THEN now() END,resolvido_por=CASE WHEN next_status='resolvido' THEN p_actor END,version=version+1 WHERE id=p_id;
 END IF;
 IF coalesce(is_admin,false) THEN
  UPDATE mise.crivo_plano_acao SET revisao_pendente=false WHERE id=p_id;
  UPDATE mise.checklist_executions SET plano_revisado_em=NULL,plano_revisado_por=NULL WHERE id=p_execution;
 END IF;
 INSERT INTO mise.crivo_action_events(action_id,actor_id,from_status,to_status,note) VALUES(p_id,p_actor,a.status,next_status,p_data->>'note');
END;
$$;

CREATE OR REPLACE FUNCTION mise.crivo_review_plan(p_actor uuid,p_execution uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,mise,public AS $$
DECLARE e mise.checklist_executions%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM employees emp JOIN roles r ON r.id=emp.role_id WHERE emp.id=p_actor AND emp.ativo AND (r.name='founder' OR r.permissions @> '["*"]'::jsonb)) THEN RAISE EXCEPTION 'Somente o auditor pode liberar o plano';END IF;
 SELECT * INTO e FROM mise.checklist_executions WHERE id=p_execution FOR UPDATE;
 IF NOT FOUND OR e.status<>'concluido' OR NOT EXISTS(SELECT 1 FROM mise.checklist_templates WHERE id=e.template_id AND modulo='CRIVO') THEN RAISE EXCEPTION 'Conclua a visita antes de liberar o plano';END IF;
 IF EXISTS(SELECT 1 FROM mise.crivo_plano_acao WHERE execution_id=p_execution AND status NOT IN ('cancelado','resolvido') AND (revisao_pendente OR responsavel_employee_id IS NULL OR prazo IS NULL OR nullif(trim(orientacao),'') IS NULL)) THEN RAISE EXCEPTION 'Revise orientação, responsável e prazo de todas as ações';END IF;
 UPDATE mise.checklist_executions SET plano_revisado_em=now(),plano_revisado_por=p_actor,report_version=report_version+1 WHERE id=p_execution;
END;
$$;
REVOKE ALL ON FUNCTION mise.crivo_review_plan(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mise.crivo_review_plan(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION mise.crivo_response_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,mise AS $$
DECLARE execution mise.checklist_executions%ROWTYPE; response_item uuid;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.execution_id<>OLD.execution_id OR NEW.item_id<>OLD.item_id) THEN RAISE EXCEPTION 'Não é possível mover uma resposta entre visitas/itens';END IF;
 SELECT * INTO execution FROM mise.checklist_executions WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.execution_id ELSE NEW.execution_id END FOR UPDATE;
 IF execution.crivo_snapshot IS NOT NULL THEN
  IF execution.status='concluido' THEN
   IF TG_OP='UPDATE' AND coalesce(current_setting('mise.crivo_media',true),'')='on' AND (to_jsonb(NEW)-ARRAY['foto_url','orientacao_corretiva','responsavel_orientado'])=(to_jsonb(OLD)-ARRAY['foto_url','orientacao_corretiva','responsavel_orientado']) THEN RETURN NEW;END IF;
   RAISE EXCEPTION 'Visita concluída: respostas preservadas';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(execution.crivo_snapshot->'items') i WHERE i->>'id'=NEW.item_id::text) THEN RAISE EXCEPTION 'Item não pertence a esta visita'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mise.crivo_response_media(p_actor uuid,p_execution uuid,p_response uuid,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,mise,public AS $$
DECLARE a mise.crivo_assets%ROWTYPE;r mise.checklist_responses%ROWTYPE;first_url text;new_order int;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM employees emp JOIN roles role ON role.id=emp.role_id WHERE emp.id=p_actor AND emp.ativo AND (role.name='founder' OR role.permissions @> '["*"]'::jsonb)) THEN RAISE EXCEPTION 'Somente o auditor pode registrar fotos e orientações';END IF;
 PERFORM 1 FROM mise.checklist_executions WHERE id=p_execution FOR UPDATE;
 SELECT * INTO r FROM mise.checklist_responses WHERE id=p_response AND execution_id=p_execution FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Resposta inválida';END IF;
 IF p_data->>'asset_id' IS NOT NULL THEN
  SELECT * INTO a FROM mise.crivo_assets WHERE id=(p_data->>'asset_id')::uuid AND execution_id=p_execution AND kind='foto';
  IF NOT FOUND THEN RAISE EXCEPTION 'Foto inválida';END IF;
  -- Preserve the original single photo before appending the next one.
  IF r.foto_url IS NOT NULL AND NOT EXISTS(SELECT 1 FROM mise.crivo_response_fotos WHERE response_id=p_response AND url=r.foto_url) THEN
   INSERT INTO mise.crivo_response_fotos(response_id,url,ordem) VALUES(p_response,r.foto_url,0);
  END IF;
  SELECT coalesce(max(ordem),-1)+1 INTO new_order FROM mise.crivo_response_fotos WHERE response_id=p_response;
  IF NOT EXISTS(SELECT 1 FROM mise.crivo_response_fotos WHERE response_id=p_response AND url=a.object_path) THEN
   INSERT INTO mise.crivo_response_fotos(response_id,url,legenda,ordem) VALUES(p_response,a.object_path,left(p_data->>'legenda',1000),new_order);
  END IF;
 END IF;
 IF p_data->>'photo_id' IS NOT NULL THEN
  UPDATE mise.crivo_response_fotos SET legenda=left(p_data->>'legenda',1000),ordem=coalesce((p_data->>'ordem')::int,ordem) WHERE id=(p_data->>'photo_id')::uuid AND response_id=p_response;
 END IF;
 SELECT url INTO first_url FROM mise.crivo_response_fotos WHERE response_id=p_response ORDER BY ordem,created_at,id LIMIT 1;
 PERFORM set_config('mise.crivo_media','on',true);
 UPDATE mise.checklist_responses SET foto_url=coalesce(first_url,foto_url),orientacao_corretiva=CASE WHEN p_data?'orientacao_corretiva' THEN left(p_data->>'orientacao_corretiva',10000) ELSE orientacao_corretiva END,responsavel_orientado=CASE WHEN p_data?'responsavel_orientado' THEN left(p_data->>'responsavel_orientado',200) ELSE responsavel_orientado END WHERE id=p_response;
 PERFORM set_config('mise.crivo_media','off',true);
 RETURN jsonb_build_object('foto_url',coalesce(first_url,r.foto_url),'photos',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY ordem,created_at,id) FROM mise.crivo_response_fotos f WHERE response_id=p_response),'[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION mise.crivo_response_media(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mise.crivo_response_media(uuid,uuid,uuid,jsonb) TO service_role;

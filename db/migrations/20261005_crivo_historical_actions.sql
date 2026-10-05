-- Allow action plans for historical CRIVO visits without changing their score.
CREATE OR REPLACE FUNCTION mise.crivo_action_save(p_actor uuid,p_id uuid,p_execution uuid,p_version integer,p_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,mise,public AS $$
DECLARE e mise.checklist_executions%ROWTYPE;a mise.crivo_plano_acao%ROWTYPE; actor_unit uuid;is_admin boolean;is_manager boolean;owner_name text;next_status text;asset mise.crivo_assets%ROWTYPE;
BEGIN
 SELECT emp.unit_id,(lower(r.name)='founder' OR r.permissions @> '["*"]'::jsonb),emp.user_id IS NOT NULL INTO actor_unit,is_admin,is_manager FROM employees emp LEFT JOIN roles r ON r.id=emp.role_id WHERE emp.id=p_actor AND emp.ativo;
 IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador indisponível';END IF;
 SELECT * INTO e FROM mise.checklist_executions WHERE id=p_execution;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM mise.checklist_templates WHERE id=e.template_id AND modulo='CRIVO') OR NOT coalesce((is_admin OR is_manager AND actor_unit=e.unit_id),false) THEN RAISE EXCEPTION 'Sem acesso à visita';END IF;
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

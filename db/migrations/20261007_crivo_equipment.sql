
-- Preserve source items and completed snapshots. Expansion belongs to each new visit.
CREATE OR REPLACE FUNCTION mise.crivo_expanded_items(p_template uuid,p_local uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,mise AS $$
 WITH plain AS (
  SELECT to_jsonb(i) as item,i.ordem,''::text AS codigo
  FROM mise.checklist_template_items i WHERE i.template_id=p_template AND i.ativo AND NOT i.por_equipamento
 ), expanded AS (
  SELECT i.*,e.id AS equipment,e.codigo,e.nome AS equipment_name,count(*) OVER(PARTITION BY i.id) AS equipment_count
  FROM mise.checklist_template_items i JOIN mise.crivo_equipamentos e ON e.local_id=p_local AND e.ativo AND e.tipo=i.equipamento_tipo
  WHERE i.template_id=p_template AND i.ativo AND i.por_equipamento
 ), combined AS (
  SELECT * FROM plain UNION ALL
  SELECT (to_jsonb(x)-ARRAY['equipment','codigo','equipment_name','equipment_count']) ||
    jsonb_build_object('id',gen_random_uuid(),'base_item_id',x.id,'equipamento_id',equipment,'expansion_count',equipment_count,
      'peso',x.peso/equipment_count,'titulo',x.titulo||' — '||codigo||coalesce(' '||nullif(equipment_name,''),'')),ordem,codigo FROM expanded x
 )
 SELECT coalesce(jsonb_agg(item ORDER BY ordem,codigo),'[]'::jsonb) FROM combined;
$$;
REVOKE ALL ON FUNCTION mise.crivo_expanded_items(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mise.crivo_expanded_items(uuid,uuid) TO service_role;
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='mise.checklist_responses'::regclass AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE (execution_id, item_id)' LOOP
  EXECUTE format('ALTER TABLE mise.checklist_responses DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS crivo_response_plain_unique ON mise.checklist_responses(execution_id,item_id) WHERE equipamento_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crivo_response_equipment_unique ON mise.checklist_responses(execution_id,item_id,equipamento_id) WHERE equipamento_id IS NOT NULL;
ALTER TABLE mise.crivo_equipamentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mise.crivo_equipamentos FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON mise.crivo_equipamentos TO service_role;

CREATE OR REPLACE FUNCTION mise.crivo_freeze_template()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'mise'
AS $function$
DECLARE template mise.checklist_templates%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND OLD.status='concluido' AND OLD.crivo_snapshot IS NULL THEN NEW.crivo_snapshot:=NULL;RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND OLD.crivo_snapshot IS NOT NULL THEN NEW.crivo_snapshot:=OLD.crivo_snapshot;RETURN NEW;END IF;
 SELECT * INTO template FROM mise.checklist_templates WHERE id=NEW.template_id;
 IF template.modulo='CRIVO' THEN
 NEW.crivo_snapshot:=jsonb_build_object('nome',template.nome,'model',template.scoring_model,'captured_at',now(),'items',mise.crivo_expanded_items(template.id,NEW.local_id),'weights',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM mise.checklist_template_topicos t WHERE t.template_id=template.id AND t.ativo),'[]'::jsonb));
 END IF;
 RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION mise.crivo_response_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'mise'
AS $function$
DECLARE execution mise.checklist_executions%ROWTYPE; response_item uuid;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.execution_id<>OLD.execution_id OR NEW.item_id<>OLD.item_id OR NEW.equipamento_id IS DISTINCT FROM OLD.equipamento_id) THEN RAISE EXCEPTION 'Não é possível mover uma resposta entre visitas/itens';END IF;
 SELECT * INTO execution FROM mise.checklist_executions WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.execution_id ELSE NEW.execution_id END FOR UPDATE;
 IF execution.crivo_snapshot IS NOT NULL THEN
  IF execution.status='concluido' THEN
   IF TG_OP='UPDATE' AND coalesce(current_setting('mise.crivo_media',true),'')='on' AND (to_jsonb(NEW)-ARRAY['foto_url','orientacao_corretiva','responsavel_orientado'])=(to_jsonb(OLD)-ARRAY['foto_url','orientacao_corretiva','responsavel_orientado']) THEN RETURN NEW;END IF;
   RAISE EXCEPTION 'Visita concluída: respostas preservadas';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(execution.crivo_snapshot->'items') i WHERE coalesce(i->>'base_item_id',i->>'id')=NEW.item_id::text AND nullif(i->>'equipamento_id','')::uuid IS NOT DISTINCT FROM NEW.equipamento_id) THEN RAISE EXCEPTION 'Item não pertence a esta visita'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION mise.crivo_finish(p_execution uuid, p_actor uuid, p_result jsonb, p_response_hash text, p_geo jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'mise', 'public'
AS $function$
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
 FROM mise.checklist_responses r JOIN jsonb_array_elements(e.crivo_snapshot->'items') i ON coalesce(i->>'base_item_id',i->>'id')=r.item_id::text AND nullif(i->>'equipamento_id','')::uuid IS NOT DISTINCT FROM r.equipamento_id
 WHERE r.execution_id=p_execution AND NOT r.nao_aplicavel AND r.resposta->>'valor'='nao'
 AND NOT EXISTS(SELECT 1 FROM mise.crivo_plano_acao a WHERE a.execution_id=p_execution AND a.response_id=r.id)
 RETURNING id)
 INSERT INTO mise.crivo_action_events(action_id,actor_id,to_status,note) SELECT id,p_actor,'aberto','Gerada na conclusão da auditoria; revisão de orientação, responsável e prazo pendente.' FROM inserted;
END;
$function$
;


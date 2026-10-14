-- Preserve retired definitions. Frozen CRIVO snapshots and historical responses are unchanged.
ALTER TABLE mise.checklist_template_items ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE mise.checklist_template_topicos ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE mise.checklist_templates ADD COLUMN IF NOT EXISTS source_status text NOT NULL DEFAULT 'manual' CHECK(source_status IN ('manual','awaiting_questionnaire','verified_source'));
UPDATE mise.checklist_templates SET source_status='awaiting_questionnaire',ativo=false
WHERE id IN ('a6dc5fa0-52ac-4940-a001-000000000001','a6dc5fa0-52ac-4940-a002-000000000002') AND ativo=false;
CREATE OR REPLACE FUNCTION mise.template_source_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.ativo AND NEW.source_status='awaiting_questionnaire' THEN RAISE EXCEPTION 'Questionário completo da consultoria ainda não recebido e conferido';END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS template_source_guard ON mise.checklist_templates;
CREATE TRIGGER template_source_guard BEFORE INSERT OR UPDATE ON mise.checklist_templates FOR EACH ROW EXECUTE FUNCTION mise.template_source_guard();
CREATE OR REPLACE FUNCTION mise.checklist_reorder(p_actor uuid,p_template uuid,p_topics jsonb,p_items jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,mise,public AS $$
DECLARE t jsonb;i jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM employees e JOIN roles r ON r.id=e.role_id WHERE e.id=p_actor AND e.ativo AND (r.name='founder' OR r.permissions @> '["*"]'::jsonb)) THEN RAISE EXCEPTION 'Acesso restrito';END IF;
 PERFORM 1 FROM mise.checklist_templates WHERE id=p_template FOR UPDATE;
 IF NOT FOUND OR jsonb_typeof(p_topics)<>'array' OR jsonb_typeof(p_items)<>'array' THEN RAISE EXCEPTION 'Template ou ordenação inválida';END IF;
 IF (SELECT count(*)<>count(DISTINCT x->>'topico_ordem') FROM jsonb_array_elements(p_topics)x) OR (SELECT count(*)<>count(DISTINCT x->>'id') FROM jsonb_array_elements(p_items)x) THEN RAISE EXCEPTION 'Ordenação duplicada';END IF;
 FOR t IN SELECT value FROM jsonb_array_elements(p_topics) LOOP
  IF (t->>'topico_ordem')::int IS NULL OR (t->>'peso')::numeric IS NULL OR (t->>'peso')::numeric<0 OR (t->>'peso') IN ('NaN','Infinity','-Infinity') OR nullif(trim(t->>'topico_nome'),'') IS NULL THEN RAISE EXCEPTION 'Tópico inválido';END IF;
  INSERT INTO mise.checklist_template_topicos(template_id,topico_ordem,topico_nome,peso,ativo) VALUES(p_template,(t->>'topico_ordem')::int,t->>'topico_nome',(t->>'peso')::numeric,true)
  ON CONFLICT(template_id,topico_ordem) DO UPDATE SET topico_nome=excluded.topico_nome,peso=excluded.peso,ativo=true;
 END LOOP;
 UPDATE mise.checklist_template_topicos SET ativo=false WHERE template_id=p_template AND topico_ordem NOT IN (SELECT (value->>'topico_ordem')::int FROM jsonb_array_elements(p_topics));
 FOR i IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  UPDATE mise.checklist_template_items SET ordem=(i->>'ordem')::int,topico_ordem=(i->>'topico_ordem')::int,topico_nome=i->>'topico_nome' WHERE id=(i->>'id')::uuid AND template_id=p_template AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item de outro template ou desativado';END IF;
 END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION mise.checklist_reorder(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mise.checklist_reorder(uuid,uuid,jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION mise.crivo_freeze_template() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,mise AS $$
DECLARE template mise.checklist_templates%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND OLD.status='concluido' AND OLD.crivo_snapshot IS NULL THEN NEW.crivo_snapshot:=NULL;RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND OLD.crivo_snapshot IS NOT NULL THEN NEW.crivo_snapshot:=OLD.crivo_snapshot;RETURN NEW;END IF;
 SELECT * INTO template FROM mise.checklist_templates WHERE id=NEW.template_id;
 IF template.modulo='CRIVO' THEN
 NEW.crivo_snapshot:=jsonb_build_object('nome',template.nome,'model',template.scoring_model,'captured_at',now(),'items',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.ordem) FROM mise.checklist_template_items i WHERE i.template_id=template.id AND i.ativo),'[]'::jsonb),'weights',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM mise.checklist_template_topicos t WHERE t.template_id=template.id AND t.ativo),'[]'::jsonb));
 END IF;
 RETURN NEW;
END;
$$;

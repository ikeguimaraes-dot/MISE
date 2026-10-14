DO $$ BEGIN IF (SELECT count(*) FROM public.units WHERE name IN ('Madonna SP Itaim','Frêneze') AND active)<>2 THEN RAISE EXCEPTION 'Confira as unidades dos templates HeadChef';END IF;END $$;
-- Explicit drafts: source reports are not a complete validated question bank.
INSERT INTO mise.checklist_templates(id,nome,descricao,tipo,unit_id,ativo,modulo,categoria,scoring_model)
VALUES
('a6dc5fa0-52ac-4940-a001-000000000001','HeadChef · Madonna · validação do checklist','Modelo de conformidade simples. O relatório recebido não contém o checklist completo. Cadastrar o checklist completo e validar antes de ativar.','abertura',(SELECT id FROM public.units WHERE name='Madonna SP Itaim' AND active),false,'CRIVO','inspecao_higiene','headchef_conformidade'),
('a6dc5fa0-52ac-4940-a002-000000000002','HeadChef · Frêneze · visita descritiva','Estrutura descritiva baseada no relatório inicial: observações por área, fotos com legenda e orientação corretiva no plano de ação. Sem nota. Validar o roteiro com a consultoria antes de ativar.','abertura',(SELECT id FROM public.units WHERE name='Frêneze' AND active),false,'CRIVO','inspecao_higiene','headchef_narrativo')
ON CONFLICT(id) DO NOTHING;
INSERT INTO mise.checklist_template_items(id,template_id,ordem,titulo,tipo_resposta,peso,critico,topico_ordem,topico_nome,requer_comentario,requer_foto)
VALUES
('a6dc5fa0-52ac-4940-b001-000000000001','a6dc5fa0-52ac-4940-a002-000000000002',1,'Observações da visita · Bar','texto',0,false,1,'Bar','nao','nao'),
('a6dc5fa0-52ac-4940-b002-000000000002','a6dc5fa0-52ac-4940-a002-000000000002',2,'Observações da visita · Cozinha','texto',0,false,2,'Cozinha','nao','nao')
ON CONFLICT(id) DO NOTHING;

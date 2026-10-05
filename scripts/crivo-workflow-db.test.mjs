import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
const q=x=>`'${String(x).replaceAll("'","''")}'`
const sql=s=>execFileSync('psql',['-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-h',process.env.EXTRAS_TEST_SOCKET||'/tmp/mise-postgres-extras-crivo-20261005','-p',process.env.EXTRAS_TEST_PORT||'55447','-d','postgres','-c',s],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const unit=randomUUID(),admin=randomUUID(),owner=randomUUID(),role=randomUUID(),template=randomUUID(),item=randomUUID(),execution=randomUUID(),answer=randomUUID(),action=randomUUID()
sql(`insert into units(id,name) values(${q(unit)},'Synthetic CRIVO');insert into roles values(${q(role)},'Founder','["*"]');insert into employees(id,unit_id,role_id,nome) values(${q(admin)},${q(unit)},${q(role)},'Synthetic Auditor'),(${q(owner)},${q(unit)},null,'Synthetic Owner');insert into mise.checklist_templates(id,nome,modulo,scoring_model) values(${q(template)},'Synthetic template','CRIVO','headchef_narrativo');insert into mise.checklist_template_items(id,template_id,ordem,titulo,tipo_resposta) values(${q(item)},${q(template)},1,'Synthetic item','texto');insert into mise.checklist_executions(id,template_id,unit_id) values(${q(execution)},${q(template)},${q(unit)});`)
assert.equal(sql(`select crivo_snapshot->>'model' from mise.checklist_executions where id=${q(execution)}`),'headchef_narrativo')
sql(`update mise.checklist_templates set scoring_model='ff_ponderado' where id=${q(template)};update mise.checklist_executions set status='em_andamento' where id=${q(execution)}`)
assert.equal(sql(`select crivo_snapshot->>'model' from mise.checklist_executions where id=${q(execution)}`),'headchef_narrativo')
sql(`insert into mise.checklist_responses(id,execution_id,item_id,resposta) values(${q(answer)},${q(execution)},${q(item)},'{"texto":"Synthetic finding"}')`)
const hash=sql(`select mise.crivo_response_hash(${q(execution)})`)
const result={model:'headchef_narrativo',percentual:null,pontuacao_total:null,pontuacao_obtida:null,topicos:[{topico_ordem:1,topico_nome:'Narrative',percentual:null,zerado_por_critico:false,peso:0}]}
assert.throws(()=>sql(`select mise.crivo_finish(${q(execution)},${q(admin)},${q(JSON.stringify(result))},'wrong','{}')`))
sql(`select mise.crivo_finish(${q(execution)},${q(admin)},${q(JSON.stringify(result))},${q(hash)},'{}')`)
assert.equal(sql(`select status from mise.checklist_executions where id=${q(execution)}`),'concluido')
assert.throws(()=>sql(`update mise.checklist_responses set resposta='{"texto":"rewrite"}' where id=${q(answer)}`))
const data={response_id:answer,descricao:'Synthetic action',orientacao:'Synthetic correction',responsavel_employee_id:owner,prazo:'2026-10-10',status:'aberto'}
const save=(version,d)=>sql(`select mise.crivo_action_save(${q(admin)},${q(action)},${q(execution)},${version},${q(JSON.stringify(d))})`)
save(0,data);assert.throws(()=>save(0,data));assert.throws(()=>save(1,{...data,status:'resolvido'}))
const asset=randomUUID();sql(`insert into mise.crivo_assets(id,execution_id,uploaded_by,kind,object_path,content_type,size_bytes) values(${q(asset)},${q(execution)},${q(admin)},'evidencia',${q(asset)},'image/png',100)`)
save(1,{...data,status:'resolvido',asset_id:asset});assert.equal(sql(`select status from mise.crivo_plano_acao where id=${q(action)}`),'resolvido');assert.equal(sql(`select count(*) from mise.crivo_action_events where action_id=${q(action)}`),'2')
console.log('PASS frozen methodology, atomic completion, stale-response protection, immutable completed responses, action owner/deadline/evidence and audit')
const t2=randomUUID(),i2=randomUUID(),x2=randomUUID(),r2=randomUUID();
sql(`insert into mise.checklist_templates(id,nome,modulo,scoring_model) values(${q(t2)},'Automatic actions','CRIVO','headchef_conformidade');insert into mise.checklist_template_items(id,template_id,ordem,titulo,tipo_resposta) values(${q(i2)},${q(t2)},1,'Synthetic nonconformity','sim_nao');insert into mise.checklist_executions(id,template_id,unit_id) values(${q(x2)},${q(t2)},${q(unit)});insert into mise.checklist_responses(id,execution_id,item_id,resposta) values(${q(r2)},${q(x2)},${q(i2)},'{"valor":"nao"}');`)
const hash2=sql(`select mise.crivo_response_hash(${q(x2)})`);
sql(`select mise.crivo_finish(${q(x2)},${q(admin)},${q(JSON.stringify({...result,model:'headchef_conformidade',percentual:0,pontuacao_total:1,pontuacao_obtida:0}))},${q(hash2)},'{}')`);
assert.equal(sql(`select count(*) from mise.crivo_plano_acao where execution_id=${q(x2)} and revisao_pendente and responsavel_employee_id is null and prazo is null`),'1');
const generated=sql(`select id from mise.crivo_plano_acao where execution_id=${q(x2)}`);
assert.throws(()=>sql(`select mise.crivo_review_plan(${q(admin)},${q(x2)})`));
sql(`insert into mise.sessions(id,employee_id,role,expires_at) values(gen_random_uuid(),${q(owner)},'gerente',now()+interval '1 hour')`);
assert.throws(()=>sql(`select mise.crivo_action_save(${q(owner)},${q(generated)},${q(x2)},0,'{"status":"em_andamento"}')`));
sql(`select mise.crivo_action_save(${q(admin)},${q(generated)},${q(x2)},0,${q(JSON.stringify({...data,response_id:r2}))})`);
sql(`select mise.crivo_review_plan(${q(admin)},${q(x2)})`);
sql(`select mise.crivo_action_save(${q(owner)},${q(generated)},${q(x2)},1,'{"status":"em_andamento"}')`);
const pdfAsset=randomUUID(),photoAsset=randomUUID(),photo2=randomUUID();
for(const [id,type,kind] of [[pdfAsset,'application/pdf','evidencia'],[photoAsset,'image/png','evidencia'],[photo2,'image/jpeg','foto']])sql(`insert into mise.crivo_assets(id,execution_id,uploaded_by,kind,object_path,content_type,size_bytes) values(${q(id)},${q(x2)},${q(owner)},${q(kind)},${q(id)},${q(type)},100)`);
assert.throws(()=>sql(`select mise.crivo_action_save(${q(owner)},${q(generated)},${q(x2)},2,${q(JSON.stringify({status:'resolvido',asset_id:pdfAsset}))})`));
sql(`select mise.crivo_action_save(${q(owner)},${q(generated)},${q(x2)},2,${q(JSON.stringify({status:'resolvido',asset_id:photoAsset}))})`);
const mediaData={asset_id:photo2,legenda:'Evidence caption',orientacao_corretiva:'Corrective instruction',responsavel_orientado:'Synthetic leader'};
const media=()=>JSON.parse(sql(`select mise.crivo_response_media(${q(admin)},${q(x2)},${q(r2)},${q(JSON.stringify(mediaData))})`));
assert.equal(media().foto_url,photo2);assert.equal(media().photos.length,1);
assert.equal(sql(`select resposta->>'valor' from mise.checklist_responses where id=${q(r2)}`),'nao');
assert.throws(()=>sql(`update mise.checklist_responses set resposta='{"valor":"sim"}' where id=${q(r2)}`));
assert.equal(sql(`select count(*) from mise.crivo_plano_acao where execution_id=${q(x2)}`),'1');
console.log('PASS auto-generated action, review gate, PIN manager, photographic evidence, first-photo compatibility, duplicate-media retry and immutable result')
const pendingTemplate=randomUUID();
sql(`insert into mise.checklist_templates(id,nome,modulo,ativo,source_status) values(${q(pendingTemplate)},'Incomplete source','CRIVO',false,'awaiting_questionnaire')`);
assert.throws(()=>sql(`update mise.checklist_templates set ativo=true where id=${q(pendingTemplate)}`));
const topics=[{topico_ordem:1,topico_nome:'Original',peso:1}];
sql(`select mise.checklist_reorder(${q(admin)},${q(t2)},${q(JSON.stringify(topics))},${q(JSON.stringify([{id:i2,ordem:1,topico_ordem:1,topico_nome:'Original'}]))})`);
assert.throws(()=>sql(`select mise.checklist_reorder(${q(admin)},${q(t2)},'[]',${q(JSON.stringify([{id:item,ordem:1,topico_ordem:1,topico_nome:'Wrong'}]))})`));
assert.equal(sql(`select ativo from mise.checklist_template_topicos where template_id=${q(t2)} and topico_ordem=1`),'t');
sql(`select mise.checklist_reorder(${q(admin)},${q(t2)},'[]','[]')`);
assert.equal(sql(`select count(*) from mise.checklist_template_topicos where template_id=${q(t2)} and not ativo`),'1');
assert.equal(sql(`select count(*) from mise.checklist_responses where execution_id=${q(x2)}`),'1');
console.log('PASS incomplete questionnaire cannot activate, atomic scoped reorder, soft retirement preserves responses')

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

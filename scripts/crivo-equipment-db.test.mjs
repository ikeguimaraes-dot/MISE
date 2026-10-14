import {execFileSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
import ts from 'typescript'
import fs from 'node:fs'
import Module from 'node:module'
const m=new Module('scoring');m._compile(ts.transpile(fs.readFileSync('src/lib/crivo/scoring.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}),'scoring');const {scoreCrivo}=m.exports
const q=s=>`'${String(s).replaceAll("'","''")}'`,sql=s=>execFileSync('psql',['-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-h','/tmp/mise-postgres-extras-crivo-20261005','-p','55447','-d','postgres','-c',s],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const unit=randomUUID(),template=randomUUID(),fridge=randomUUID(),plain=randomUUID(),role=randomUUID(),admin=randomUUID()
sql(`insert into units(id,name) values(${q(unit)},'Synthetic equipment');insert into roles values(${q(role)},'Founder','["*"]');insert into employees(id,unit_id,role_id)values(${q(admin)},${q(unit)},${q(role)});insert into mise.checklist_templates(id,nome,modulo,scoring_model) values(${q(template)},'Equipment test','CRIVO','ff_ponderado');insert into mise.checklist_template_items(id,template_id,titulo,ordem,topico_ordem,peso,por_equipamento,equipamento_tipo,tipo_resposta) values(${q(fridge)},${q(template)},'Refrigeração',1,1,1,true,'geladeira','sim_nao'),(${q(plain)},${q(template)},'Bancada',2,1,1,false,null,'sim_nao');insert into mise.checklist_template_topicos(template_id,topico_ordem,peso)values(${q(template)},1,100)`)
const snapshots=[]
for(const n of [12,3,0]){
 const local=randomUUID(),execution=randomUUID();sql(`insert into mise.crivo_locais(id,unit_id,nome)values(${q(local)},${q(unit)},'Synthetic local');insert into mise.crivo_equipamentos(local_id,codigo,nome,tipo)select ${q(local)},'G'||i,'Geladeira','geladeira' from generate_series(1,${n})i;insert into mise.crivo_equipamentos(local_id,codigo,tipo,ativo)values(${q(local)},'INATIVA','geladeira',false);insert into mise.checklist_executions(id,template_id,unit_id,local_id)values(${q(execution)},${q(template)},${q(unit)},${q(local)})`)
 const snap=JSON.parse(sql(`select crivo_snapshot from mise.checklist_executions where id=${q(execution)}`));assert.equal(snap.items.length,n+1);assert.equal(new Set(snap.items.map(i=>i.id)).size,n+1)
 const responses=snap.items.map(i=>({item_id:i.id,resposta:{valor:i.base_item_id?'nao':'sim'},nao_aplicavel:false}));const result=scoreCrivo('ff_ponderado',snap.items,responses,snap.weights);assert.equal(result.percentual,n?50:100);assert.equal(scoreCrivo('headchef_conformidade',snap.items,responses).percentual,n?50:100)
 for(const i of snap.items)sql(`insert into mise.checklist_responses(execution_id,item_id,equipamento_id,resposta)values(${q(execution)},${q(i.base_item_id??i.id)},${i.equipamento_id?q(i.equipamento_id):'NULL'},${q(JSON.stringify({valor:i.base_item_id?'nao':'sim'}))})`)
 if(n){const i=snap.items[0];assert.throws(()=>sql(`insert into mise.checklist_responses(execution_id,item_id,equipamento_id)values(${q(execution)},${q(fridge)},${q(i.equipamento_id)})`));assert.throws(()=>sql(`insert into mise.checklist_responses(execution_id,item_id)values(${q(execution)},${q(fridge)})`));assert.throws(()=>sql(`update mise.checklist_responses set equipamento_id=null where execution_id=${q(execution)} and equipamento_id=${q(i.equipamento_id)}`))}
 sql(`update mise.crivo_equipamentos set nome='Renamed',ativo=false where local_id=${q(local)};update mise.checklist_executions set status='em_andamento' where id=${q(execution)}`);assert.deepEqual(JSON.parse(sql(`select crivo_snapshot from mise.checklist_executions where id=${q(execution)}`)),snap)
 const hash=sql(`select mise.crivo_response_hash(${q(execution)})`);sql(`select mise.crivo_finish(${q(execution)},${q(admin)},${q(JSON.stringify(result))},${q(hash)},'{}')`);assert.equal(Number(sql(`select count(*) from mise.crivo_plano_acao where execution_id=${q(execution)}`)),n)
 snapshots.push(snap)
}
assert.ok(Math.abs(snapshots[0].items.filter(i=>i.base_item_id).reduce((s,i)=>s+i.peso,0)-1)<1e-10)
console.log('PASS 12 vs 3 refrigerators equal weight, zero/inactive omitted, independent responses, duplicate/forged identity rejection, frozen labels and per-equipment actions')

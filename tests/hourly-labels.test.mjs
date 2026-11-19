import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTs } from './helpers/load-ts.mjs'
const rules=loadTs('src/lib/shelf-life.ts')
const expiry=loadTs('src/lib/label-expiry.ts',{'@/lib/shelf-life':rules})
const business=loadTs('src/lib/business-registration.ts')
const products=loadTs('src/lib/product-registration.ts',{'@/lib/shelf-life':rules,'@/lib/business-registration':business})
const id='11111111-1111-4111-8111-111111111111'
const actorId='22222222-2222-4222-8222-222222222222'
const json={NextResponse:{json:(body,init)=>({body,status:init?.status??200})}}

test('8 horas conservam o horário e atravessam meia-noite, mês e ano sem arredondar para dias',()=>{
 for(const [start,end] of [['2026-11-17T10:15','2026-11-17T21:15:00.000Z'],['2026-11-17T20:15','2026-11-18T07:15:00.000Z'],['2026-12-31T20:15','2027-01-01T07:15:00.000Z']]){
  assert.equal(expiry.requestedLabelExpiry({manipulation:start,baseHours:72,hours:8,admin:false}),end)
 }
 assert.equal(expiry.saoPauloIso('2026-11-17T10:15'),'2026-11-17T13:15:00.000Z')
 assert.equal(expiry.saoPauloIso('2026-11-17T08:15-05:00'),'2026-11-17T13:15:00.000Z')
})

test('datas manuais e ampliação só para admin; fornecedor limita; prazos inválidos são rejeitados',()=>{
 const base={manipulation:'2026-11-17T10:00',baseHours:24,admin:false}
 assert.throws(()=>expiry.requestedLabelExpiry({...base,hours:48}),/administradores/)
 assert.throws(()=>expiry.requestedLabelExpiry({...base,manualExpiry:'2026-11-18T10:00'}),/administradores/)
 assert.equal(expiry.requestedLabelExpiry({...base,admin:true,hours:48}),'2026-11-19T13:00:00.000Z')
 assert.equal(expiry.requestedLabelExpiry({...base,admin:true,manualExpiry:'2026-11-17T18:00'}),'2026-11-17T21:00:00.000Z')
 assert.throws(()=>expiry.requestedLabelExpiry({...base,admin:true,manualExpiry:'2026-11-18T18:00',supplierExpiry:'2026-11-17'}),/fornecedor/)
 for(const hours of [0,-1,NaN,Infinity,'8'])assert.throws(()=>expiry.requestedLabelExpiry({...base,hours}))
 assert.throws(()=>expiry.requestedLabelExpiry({...base,admin:true,manualExpiry:'2026-11-16T10:00'}))
})

function creation(role='admin'){
 let saved
 const db={schema(){return this},from(table){return table==='ingredients'?{select(){return this},eq(){return this},maybeSingle:async()=>({data:{sif:'1234'}})}:{insert(body){saved=body;return this},select(){return this},single:async()=>({data:{id}})}}}
 const api=loadTs('src/app/api/labels/route.ts',{'next/server':json,'@/lib/supabase/server':{createServiceClient:()=>db},'@/lib/session':{getMiseSession:async()=>role?{role,employeeId:actorId}:null},'@/lib/label-expiry':expiry,'@/lib/shelf-life-server':{resolveShelfLifeRule:async()=>({prazo_horas:72})}})
 return{post:body=>api.POST({json:async()=>body}),saved:()=>saved}
}
const payload={nome:'Produto',data_manipulacao:'2026-11-17T10:15',metodo_conservacao:'Refrigerado até 4°C',ingredient_id:id,prazo_horas:8,sif:'INJETADO',selo:null,validade:'2030-01-01',validade_alterada_por:'injected'}

test('criação persiste 8h e SIF do cadastro; o cliente não injeta SIF, auditoria ou data final',async()=>{
 const app=creation();const result=await app.post(payload)
 assert.equal(result.status,200)
 assert.equal(app.saved().validade,'2026-11-17T21:15:00.000Z')
 assert.equal(app.saved().sif,'1234');assert.equal(app.saved().selo,'SIF')
 assert.equal(app.saved().validade_alterada_por,actorId)
 assert.equal(result.body.sif,'1234')
})

test('criação exige sessão e bloqueia data manual sem admin; admin tem autoria confiável',async()=>{
 assert.equal((await creation(null).post(payload)).status,401)
 assert.equal((await creation('cozinheiro').post({...payload,validade_manual:'2026-11-17T19:00'})).status,403)
 const app=creation('admin');const result=await app.post({...payload,validade_manual:'2026-11-18T19:00'})
 assert.equal(result.status,200)
 assert.equal(app.saved().validade,'2026-11-18T22:00:00.000Z')
 assert.equal(app.saved().validade_alterada_por,actorId)
 assert.equal(app.saved().validade_original,'2026-11-20T13:15:00.000Z')
})

function edit({role='admin',status='ativa',conflict=false,supplier=null}={}){
 const row={id,status,data_manipulacao:'2026-11-17T13:00:00Z',validade:'2026-11-20T13:00:00Z',validade_fornecedor:supplier,validade_original:null}
 let saved,dbCalls=0
 const db={schema(){return this},from(){let changes;return{select(){return this},eq(){return this},in(){return this},update(body){changes=body;return this},maybeSingle:async()=>{if(changes){saved=changes;return{data:conflict?null:{...row,...changes}}}return{data:row}}}}}
 const api=loadTs('src/app/api/labels/[id]/route.ts',{'next/server':json,'@/lib/session':{getMiseSession:async()=>({role,employeeId:actorId})},'@/lib/supabase/server':{createServiceClient:()=>{dbCalls++;return db}},'@/lib/label-expiry':expiry,'@/lib/business-registration':business})
 return{patch:body=>api.PATCH({json:async()=>body},{params:Promise.resolve({id})}),saved:()=>saved,calls:()=>dbCalls,row}
}

test('somente admin edita etiqueta emitida; operação conta horas desde a manipulação e registra a data anterior',async()=>{
 for(const role of ['cozinheiro','gerente']){const app=edit({role});assert.equal((await app.patch({prazo_horas:8})).status,403);assert.equal(app.calls(),0)}
 const app=edit();assert.equal((await app.patch({prazo_horas:8})).status,200)
 assert.equal(app.saved().validade,'2026-11-17T21:00:00.000Z')
 assert.equal(app.saved().validade_original,app.row.validade)
 assert.equal(app.saved().validade_alterada_por,actorId)
})

test('edição não reabre etiquetas finalizadas; preserva fornecedor e detecta concorrência',async()=>{
 for(const status of ['consumida','descartada']){const app=edit({status});assert.equal((await app.patch({prazo_horas:8})).status,409);assert.equal(app.saved(),undefined)}
 assert.equal((await edit({supplier:'2026-11-17'}).patch({validade_manual:'2026-11-18T10:00'})).status,400)
 assert.equal((await edit({conflict:true}).patch({prazo_horas:8})).status,409)
 assert.equal((await edit().patch({prazo_horas:8,status:'ativa'})).status,400)
})

test('painel agrupa pelas próximas 24, 48 e 72 horas, inclusive ao cruzar meia-noite',()=>{
 const model=loadTs('src/lib/label-validities.ts'),now=new Date('2026-11-17T23:30:00-03:00')
 const bucket=h=>model.getValidityBucket({status:'ativa',validade:new Date(now.getTime()+h*3600000).toISOString()},now)
 assert.equal(bucket(8),'hoje');assert.equal(bucket(23.99),'hoje');assert.equal(bucket(24),'amanha');assert.equal(bucket(48),'tres_dias');assert.equal(bucket(72),'ok')
 assert.equal(model.VALIDITY_CARDS[1].label,'Até 24 horas')
})

test('SIF/marca são validados e carregados na edição, com limpeza explícita',()=>{
 const body={nome:'Produto',group_id:id,categoria:'outro',unidade_padrao:'kg',ativo:true,sif:' 1234 ',marca:' Marca teste '}
 assert.equal(products.validateProduct(body).sif,'1234');assert.equal(products.validateProduct(body).marca,'Marca teste')
 assert.equal(products.validateProduct({...body,sif:'',marca:''}).sif,null)
 assert.throws(()=>products.validateProduct({...body,sif:'123\nPRINT 100'}))
 assert.throws(()=>products.validateProduct({...body,marca:'x'.repeat(121)}))
 const {ProdutoForm}=loadTs('src/app/(dashboard)/cadastros/produtos/_components/produto-form.tsx',{'react/jsx-runtime':jsx,react:React,'next/navigation':{useRouter:()=>({})},'@/lib/shelf-life':rules,'@/lib/product-registration':products})
 const html=renderToStaticMarkup(React.createElement(ProdutoForm,{groups:[],suppliers:[],initial:{...body,id,sif:'1234',marca:'Marca teste'}}))
 assert.match(html,/value="1234"/);assert.match(html,/value="Marca teste"/)
})

test('impressão Bluetooth inclui SIF, manipulação com hora e vencimento com hora sem ultrapassar 60mm',()=>{
 const {buildTSPL}=loadTs('src/lib/etiqueta-tspl.ts',{'@/lib/label-expiry':expiry})
 const data={nome:'Produto com um nome longo que ocupa todas as cinco linhas do topo',metodo:'Refrigerado até 4°C',dataManipulacao:'2026-11-17T13:00:00Z',validade:'2026-11-17T21:00:00Z',respNome:'Ana',id,sif:'1234'}
 const printed=buildTSPL(data)
 assert.match(printed,/SIF 1234/);assert.match(printed,/MANIPULACAO: 17\/11\/26 10:00/);assert.match(printed,/ATE 18:00/)
 for(const [,y]of printed.matchAll(/TEXT \d+,(\d+),/g))assert.ok(Number(y)+20<480)
 assert.doesNotMatch(buildTSPL({...data,sif:null}),/SIF 1234/)
 assert.ok(!expiry.escapeLabelHtml('<script>').includes('<script>'))
})

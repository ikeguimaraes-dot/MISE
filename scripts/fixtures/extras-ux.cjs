const unit='10000000-0000-4000-8000-000000000001'
const requests=Array.from({length:7},(_,i)=>({id:`request-${i+1}`,unit_id:unit,data_trabalho:'2026-10-05',periodo:'almoco',setor:'Cozinha de Produção',funcao:i?'Auxiliar de cozinha':'Atendimento e apoio ao salão',quantidade:3,valor_unitario:150,valor_total:450,valor_consumido:450,valor_nomeado:0,preenchidos:0,pagamentos_pendentes:0,motivo:'evento',motivo_detalhe:'Reforço para o almoço de um evento com atendimento simultâneo.',solicitante_nome:'Gerente de demonstração',pagadora:'casa',status:'solicitado',emergencial:false,mise_managed:true,mise_requested_by:'demo',mise_version:1,mise_named_at:null,mise_emergency_decision:null}))
const person={id:'person-1',solicitacao_id:'request-1',mise_position:1,unit_id:unit,data_trabalho:'2026-10-05',data_solicitacao:'2026-10-05',setor:'Cozinha de Produção',funcao:'Auxiliar de cozinha',motivo:'evento',motivo_detalhe:'Cobertura do turno de almoço.',nome:'Pessoa de demonstração',solicitante_nome:'Gerente de demonstração',valor:150,total:150,pagadora:'casa',status:'reservado_financeiro',emergencial:false,periodo:'almoco',mise_requested_by:'demo',mise_version:1,mise_rh_complete:true,mise_receipt_id:null,mise_managed:true,mise_emergency_decision:null}
module.exports=async function mockExtras(page){
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;let body
  if(route.request().method()!=='GET')return route.fulfill({status:409,json:{error:'Teste visual: nenhuma gravação é realizada.'}})
  if(path.endsWith('/alcada'))body={segunda:'2026-10-05',domingo:'2026-10-11',metaSemana:50000000,teto:500000,gasto:324000,saldo:176000,percentual:1,avisos:[]}
  else if(path.endsWith('/catalogo'))body={items:[{id:'job-1',nome:'Auxiliar de cozinha',valor_referencia:150,setor_padrao:'Cozinha de Produção',ordem:1},{id:'job-2',nome:'Hosts',valor_referencia:null,setor_padrao:'Portaria',ordem:2}]}
  else if(path.endsWith('/solicitantes'))body={items:[{id:'manager-1',nome:'Gerente de demonstração'}]}
  else if(path.endsWith('/solicitacoes'))body={items:requests,hasMore:false}
  else if(path.includes('/solicitacoes/'))body={item:requests.find(r=>path.endsWith(r.id))||requests[0],people:[],events:[{id:'event-1',actor_role:'lider',action:'solicitar',note:null,created_at:'2026-10-05T12:00:00Z'}]}
  else if(path.endsWith('/requests'))body={items:[person],hasMore:false}
  else if(path.includes('/requests/'))body={item:person,cpf:null,events:[]}
  else return route.fulfill({status:404,json:{error:'No fixture'}})
  return route.fulfill({json:body})
 })
}

import {execFileSync,spawn} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
const args=['-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-h','/tmp/mise-postgres-extras-crivo-20261005','-p','55447','-d','postgres']
const quote=x=>`'${String(x).replaceAll("'","''")}'`
const sql=q=>execFileSync('psql',[...args,'-c',q],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const fails=(f,label)=>{assert.throws(f);console.log('PASS',label)}
const roleId=randomUUID(),actors=Object.fromEntries(['lider','rh','financeiro','caixa','diretor'].map(r=>[r,randomUUID()]))
const job=randomUUID();sql(`INSERT INTO roles VALUES(${quote(roleId)},'Founder','["*"]');INSERT INTO op_extra_cargo(id,nome,setor_padrao,valor_referencia) VALUES(${quote(job)},${quote('Synthetic '+job)},'Synthetic sector',150);INSERT INTO op_extra_cargo_setor(cargo_id,setor) VALUES(${quote(job)},'Synthetic sector')`)
function context(){const unit=randomUUID(),requester=randomUUID();sql(`INSERT INTO units(id,name) VALUES(${quote(unit)},'Synthetic Positions');INSERT INTO op_extra_alcada(unit_id,percentual,vigente_desde) VALUES(${quote(unit)},1,'2026-01-01');INSERT INTO metas_dia_semana(unit_id,dia_semana,meta,competencia) SELECT ${quote(unit)},d,10000,'2026-10' FROM generate_series(0,6)d;INSERT INTO op_extra_solicitante(id,unit_id,nome) VALUES(${quote(requester)},${quote(unit)},'Declared Manager')`);for(const [r,id] of Object.entries(actors)){sql(`INSERT INTO auth.users VALUES(${quote(id)}) ON CONFLICT DO NOTHING;INSERT INTO employees(id,unit_id,user_id,role_id) VALUES(${quote(id)},${quote(unit)},${quote(id)},${quote(roleId)}) ON CONFLICT(id) DO UPDATE SET unit_id=EXCLUDED.unit_id;INSERT INTO mise.extra_access(employee_id,unit_id,role,granted_by) VALUES(${quote(id)},${quote(unit)},${quote(r)},${quote(actors.lider)})`)}return{unit,requester}}
let c=context()
const create=(quantity=3,rate=150,extra={})=>({unit_id:c.unit,solicitante_cadastro_id:c.requester,cargo_id:job,setor:'Synthetic sector',data_trabalho:'2026-10-05',periodo:'almoco',motivo:'evento',motivo_detalhe:'Synthetic',quantidade:quantity,valor_unitario:rate,...extra})
const cmd=(r,a,id,v,data={},key=randomUUID())=>`select mise.extra_request_command(${quote(actors[r])},${quote(r)},${quote(key)},${quote(a)},${quote(id)},${v===null?'NULL':v},${quote(JSON.stringify(data))}::jsonb)`
const call=(...a)=>JSON.parse(sql(cmd(...a)))
const individual=(r,a,id,v,data={})=>JSON.parse(sql(`select mise.extra_command(${quote(actors[r])},${quote(r)},${quote(randomUUID())},${quote(a)},${quote(id)},${v},${quote(JSON.stringify(data))}::jsonb)`))
const row=id=>JSON.parse(sql(`select row_to_json(s) from mise.extra_request_summary s where id=${quote(id)}`))
const people=id=>JSON.parse(sql(`select coalesce(json_agg(e order by mise_position),'[]') from op_extra e where solicitacao_id=${quote(id)}`))
const budget=()=>JSON.parse(sql(`select mise.extra_week_budget(${quote(c.unit)},'2026-10-05')`))
function cpf(n){let d=String(100000000+n);for(let len=9;len<11;len++){let sum=0;for(let i=0;i<len;i++)sum+=Number(d[i])*(len+1-i);let check=sum*10%11;d+=check===10?0:check}return d}
const person=(pos,value=150)=>({posicao:pos,nome:`Synthetic Person ${pos}`,cpf:cpf(pos),valor:value})
const nominate=(id,ps,more={})=>call('rh','nomear_rh',id,row(id).mise_version,{pagadora:'casa',pessoas:ps,...more})
const id=randomUUID(),key=randomUUID(),data=create(3,150,{valor_total:1,comissao:999})
fails(()=>call('lider','solicitar',randomUUID(),0,create(0)),'zero quantity denied')
fails(()=>call('lider','solicitar',randomUUID(),0,create(1.5)),'fractional quantity denied')
fails(()=>call('lider','solicitar',randomUUID(),0,create(3,0)),'invalid rate denied')
const forgedSector=randomUUID();call('lider','solicitar',forgedSector,0,create(1,1,{setor:'Wrong'}));assert.equal(sql(`select setor from op_extra_solicitacao where id=${quote(forgedSector)}`),'Synthetic sector');call('lider','cancelar',forgedSector,1,{note:'Synthetic cleanup'});console.log('PASS sector resolved from catalog; client cannot forge it')
fails(()=>call('lider','solicitar',randomUUID(),0,create(3,150,{solicitante_cadastro_id:randomUUID()})),'requester must belong to unit')
assert.equal(call('lider','solicitar',id,0,data,key).status,'solicitado');assert.equal(call('lider','solicitar',id,0,data,key).replayed,true)
assert.equal(people(id).length,0);assert.equal(row(id).valor_total,450);assert.equal(budget().usado,450)
fails(()=>call('lider','solicitar',id,0,create(4),key),'changed retry denied')
fails(()=>call('lider','nomear_rh',id,1,{pagadora:'casa',pessoas:[person(1)]}),'leader cannot name people')
fails(()=>nominate(id,[person(1),{...person(2),cpf:'11111111111'}]),'invalid second CPF rolls entire batch back')
assert.equal(people(id).length,0);assert.equal(budget().usado,450)
fails(()=>nominate(id,[person(1),person(1)]),'duplicate slot rolls back')
fails(()=>nominate(id,[person(1),{...person(2),cpf:cpf(1)}]),'same CPF in two slots denied')
const namingKey=randomUUID(),namingData={pagadora:'casa',pessoas:[person(1,100),person(2)]};assert.equal(call('rh','nomear_rh',id,1,namingData,namingKey).status,'aprovado_rh');assert.equal(call('rh','nomear_rh',id,1,namingData,namingKey).replayed,true);assert.equal(people(id).length,2);assert.equal(row(id).preenchidos,2);assert.equal(row(id).quantidade,3);assert.equal(row(id).valor_total,450);assert.equal(budget().usado,250)
for(const p of people(id)){assert.equal(p.solicitacao_id,id);assert.equal(p.setor,'Synthetic sector');assert.equal(p.solicitante_nome,'Declared Manager');assert.equal(p.comissao,0);assert.equal(p.total,p.valor)}
console.log('PASS estimate immediately consumes allowance; partial nomination consumes actual person rates without double count')
let first=people(id)[0];individual('financeiro','reservar',first.id,first.mise_version);first=people(id)[0]
const receipt=randomUUID();sql(`INSERT INTO mise.extra_receipts(id,extra_id,uploaded_by,object_path,content_type,size_bytes) VALUES(${quote(receipt)},${quote(first.id)},${quote(actors.caixa)},${quote(receipt)},'application/pdf',100)`)
assert.equal(individual('caixa','informar_pagamento',first.id,first.mise_version,{receipt_id:receipt,pago_em:'2026-10-05'}).status,'pago');assert.equal(budget().usado,250)
const secondRequest=randomUUID();assert.equal(call('lider','solicitar',secondRequest,0,create(3)).status,'solicitado');assert.equal(budget().usado,700)
assert.equal(nominate(id,[person(3,200)]).status,'aguardando_diretoria');assert.equal(budget().usado,900);assert.equal(people(id)[0].status,'pago')
fails(()=>call('diretor','recusar',id,row(id).mise_version,{note:'Cannot erase payment'}),'cannot refuse paid request and erase its allowance')
let second=people(id)[1]
fails(()=>individual('diretor','aprovar',second.id,second.mise_version,{note:'Bypass'}),'individual cannot bypass parent approval')
fails(()=>individual('financeiro','reservar',second.id,second.mise_version),'finance waits for increased request approval')
assert.equal(call('diretor','aprovar',id,row(id).mise_version,{note:'Additional budget approved'}).status,'aprovado_rh')
assert.equal(row(id).preenchidos,3);second=people(id)[1];assert.equal(second.status,'aprovado_rh')
assert.equal(individual('financeiro','reservar',second.id,second.mise_version).status,'reservado_financeiro');second=people(id)[1]
fails(()=>individual('caixa','informar_pagamento',second.id,second.mise_version,{receipt_id:receipt,pago_em:'2026-10-05'}),'receipt belongs to one person only')
fails(()=>nominate(id,[person(4)]),'cannot exceed requested positions')
fails(()=>call('rh','nomear_rh',id,1,{pessoas:[person(3)],pagadora:'casa'}),'stale version denied')
assert.equal(call('lider','cancelar',secondRequest,row(secondRequest).mise_version,{note:'No longer needed'}).status,'cancelado');assert.equal(budget().usado,450)
console.log('PASS additional nomination rechecks allowance; director approval and individual payments preserve paid people')
c=context();const emergency=randomUUID();assert.equal(call('caixa','solicitar',emergency,0,create(2,800,{emergencial:true})).status,'solicitado')
assert.equal(sql(`select count(*) from mise.extra_notification_outbox where request_id=${quote(emergency)}`),'1')
assert.equal(nominate(emergency,[person(1,800)]).status,'aprovado_rh');assert.equal(budget().usado,800)
assert.equal(call('diretor','ratificar_emergencia',emergency,row(emergency).mise_version,{note:'Reviewed'}).status,'aprovado_rh');assert.equal(people(emergency)[0].mise_emergency_decision,'aprovado')
console.log('PASS emergency reserves amount, alerts before any person exists and keeps individual payment exception')
c=context();const a=randomUUID(),b=randomUUID();const concurrent=q=>new Promise((resolve,reject)=>{const p=spawn('psql',[...args,'-c',q]);let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('exit',code=>code?reject(new Error(err)):resolve(JSON.parse(out.trim())))})
const res=await Promise.all([concurrent(cmd('lider','solicitar',a,0,create(10,50))),concurrent(cmd('lider','solicitar',b,0,create(10,50)))])
assert.deepEqual(res.map(r=>r.status).sort(),['aguardando_diretoria','solicitado']);assert.equal(budget().usado,1000)
fails(()=>sql(`UPDATE public.op_extra_solicitacao SET quantidade=20 WHERE id=${quote(a)}`),'direct managed request mutation denied')
fails(()=>sql(`SET ROLE authenticated; SELECT * FROM mise.extra_request_summary`),'public client cannot read cross-unit request view')
fails(()=>sql(`SET ROLE authenticated; SELECT mise.extra_request_command(${quote(actors.lider)},'lider',${quote(randomUUID())},'solicitar',${quote(randomUUID())},0,'{}')`),'public client cannot invoke privileged request command')
console.log('PASS concurrent requests reserve allowance atomically, no double count, service-only scoped API')
// V2: one transaction for the entire weekly plan, including retries.
c=context();const planRows=[300,500].map((value,i)=>({id:randomUUID(),command_id:randomUUID(),data:create(1,value,{data_trabalho:`2026-10-0${5+i}`})}));
const plan=(rows,r='lider')=>JSON.parse(sql(`select mise.extra_plan_command(${quote(actors[r])},${quote(r)},${quote(c.unit)},'2026-10-05',${quote(JSON.stringify(rows))})`));
const badRows=[{...planRows[0]},{...planRows[1],data:{...planRows[1].data,quantidade:0}}];
fails(()=>plan(badRows),'invalid last demand rolls back the entire weekly plan');assert.equal(budget().usado,0);
fails(()=>plan(planRows,'rh'),'RH cannot submit a manager weekly plan');
const planned=plan(planRows);assert.deepEqual(planned.items.map(r=>r.status),['solicitado','aguardando_diretoria']);assert.equal(budget().usado,800);
assert.ok(plan(planRows).items.every(r=>r.replayed));assert.equal(budget().usado,800);
fails(()=>plan([{id:randomUUID(),command_id:randomUUID(),data:create(1,100,{data_trabalho:'2026-10-12'})}]),'cross-week demand denied');
console.log('PASS weekly plan atomic creation, allowance routing, idempotency and week scope');
c=context();const emergency2=randomUUID();call('caixa','solicitar',emergency2,0,create(1,900,{emergencial:true}));
fails(()=>call('lider','nomear_emergencia',emergency2,1,{pagadora:'casa',pessoas:[person(1)]}),'only cashier names emergency recipients');
call('caixa','nomear_emergencia',emergency2,1,{pagadora:'casa',pessoas:[{posicao:1,nome:'Synthetic emergency recipient',cpf:'',valor:900}]});
let ep=people(emergency2)[0];assert.equal(ep.cpf,null);assert.equal(ep.mise_rh_complete,false);
fails(()=>individual('caixa','informar_pagamento',ep.id,ep.mise_version,{pago_em:'2026-10-05'}),'emergency cannot pay without receipt');
const er=randomUUID();sql(`INSERT INTO mise.extra_receipts(id,extra_id,uploaded_by,object_path,content_type,size_bytes) VALUES(${quote(er)},${quote(ep.id)},${quote(actors.caixa)},${quote(er)},'application/pdf',100)`);
assert.equal(individual('caixa','informar_pagamento',ep.id,ep.mise_version,{receipt_id:er,pago_em:'2026-10-05'}).status,'pagamento_informado');
ep=people(emergency2)[0];assert.equal(individual('rh','preparar_rh',ep.id,ep.mise_version,{nome:ep.nome,cpf:cpf(9),valor:900,pagadora:'casa'}).status,'pago');assert.equal(budget().usado,900);
console.log('PASS cashier emergency payment, unknown CPF stays null, mandatory receipt and RH regularization');
// Optional context must work in both normal and emergency requests, including naming.
c=context();
for(const emergency of [false,true]){
 const request=randomUUID(),body=create(1,150,{emergencial:emergency});delete body.motivo_detalhe;
 call(emergency?'caixa':'lider','solicitar',request,0,body);
 assert.equal(row(request).motivo_detalhe,null);
 nominate(request,[person(1)]);assert.equal(people(request)[0].motivo_detalhe,null);
}
const blank=randomUUID();call('caixa','solicitar',blank,0,create(1,150,{emergencial:true,motivo_detalhe:'   '}));assert.equal(row(blank).motivo_detalhe,null);
const explained=randomUUID();call('caixa','solicitar',explained,0,create(1,150,{emergencial:true,motivo_detalhe:'  Falta no turno  '}));assert.equal(row(explained).motivo_detalhe,'Falta no turno');
console.log('PASS optional context: normal/emergency requests, blank normalized to null, RH inherits null, supplied explanation retained');

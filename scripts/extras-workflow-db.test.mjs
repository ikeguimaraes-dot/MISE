import {execFileSync,spawn} from 'node:child_process'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
const args=['-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-h',process.env.EXTRAS_TEST_SOCKET||'/tmp/mise-postgres-extras-crivo-20261005','-p',process.env.EXTRAS_TEST_PORT||'55447','-d',process.env.EXTRAS_TEST_DB||'postgres']
const quote=x=>`'${String(x).replaceAll("'","''")}'`
const sql=q=>execFileSync('psql',[...args,'-c',q],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const fail=(f,msg)=>{assert.throws(f);console.log('PASS',msg)}
const unit=randomUUID(),other=randomUUID(),roleId=randomUUID(),actors=Object.fromEntries(['lider','rh','diretor','financeiro','caixa'].map(r=>[r,randomUUID()]))
sql(`INSERT INTO units(id,name) VALUES(${quote(unit)},'Synthetic A'),(${quote(other)},'Synthetic B'); INSERT INTO roles VALUES(${quote(roleId)},'Founder','["*"]');`)
for(const [role,id] of Object.entries(actors))sql(`INSERT INTO auth.users VALUES(${quote(id)});INSERT INTO employees(id,unit_id,user_id,role_id) VALUES(${quote(id)},${quote(unit)},${quote(id)},${quote(roleId)});INSERT INTO mise.extra_access(employee_id,unit_id,role,granted_by) VALUES(${quote(id)},${quote(unit)},${quote(role)},${quote(actors.lider)});`)
sql(`INSERT INTO op_extra_alcada VALUES(${quote(unit)},1,'2026-01-01');INSERT INTO metas_dia_semana(unit_id,dia_semana,meta,competencia) SELECT ${quote(unit)},d,10000,'2026-10' FROM generate_series(0,6)d;`)
const createData=(value=100,extra={})=>({unit_id:unit,data_trabalho:'2026-10-05',setor:'Teste',funcao:'Teste',motivo:'evento',motivo_detalhe:'Synthetic',valor:value,comissao:0,periodo:'almoco',sequencia:1,...extra})
const commandSql=(role,action,id,version,data={},key=randomUUID())=>`select mise.extra_command(${quote(actors[role])},${quote(role)},${quote(key)},${quote(action)},${quote(id)},${version===null?'NULL':version},${quote(JSON.stringify(data))}::jsonb)`
const call=(...a)=>JSON.parse(sql(commandSql(...a)))
const id=randomUUID(),key=randomUUID(),data=createData()
assert.equal(call('lider','solicitar',id,0,data,key).status,'solicitado');assert.equal(call('lider','solicitar',id,0,data,key).replayed,true)
assert.equal(sql(`select count(*) from mise.extra_events where extra_id=${quote(id)}`),'1')
fail(()=>call('lider','solicitar',id,0,createData(120),key),'idempotency rejects changed payload')
fail(()=>call('lider','solicitar',randomUUID(),0,createData(10,{unit_id:other})),'cross-unit denied')
fail(()=>call('financeiro','reservar',id,1),'finance cannot skip RH')
const rh={nome:'Synthetic Person',cpf:'52998224725',valor:100,comissao:0,pagadora:'casa'}
fail(()=>call('rh','preparar_rh',id,null,rh),'null version denied')
fail(()=>call('rh','preparar_rh',id,1,{...rh,cpf:'11111111111'}),'invalid CPF denied')
assert.equal(call('rh','preparar_rh',id,1,rh).status,'aprovado_rh')
assert.equal(call('financeiro','reservar',id,2).status,'reservado_financeiro')
fail(()=>call('caixa','informar_pagamento',id,3,{receipt_id:randomUUID(),pago_em:'2026-10-05'}),'foreign or absent receipt denied')
function receipt(extra){const r=randomUUID();sql(`INSERT INTO mise.extra_receipts(id,extra_id,uploaded_by,object_path,content_type,size_bytes) VALUES(${quote(r)},${quote(extra)},${quote(actors.caixa)},${quote(r)},'application/pdf',100)`);return r}
const r=receipt(id),paid={receipt_id:r,pago_em:'2026-10-05'},paymentKey=randomUUID()
assert.equal(call('caixa','informar_pagamento',id,3,paid,paymentKey).status,'pago')
assert.equal(call('caixa','informar_pagamento',id,3,paid,paymentKey).replayed,true)
fail(()=>call('financeiro','conferir',id,4),'cannot pay twice after cashier closes')
fail(()=>call('caixa','informar_pagamento',id,5,paid),'closed payment immutable')
fail(()=>sql(`UPDATE op_extra SET valor=1 WHERE id=${quote(id)}`),'managed direct mutation denied')
const over=randomUUID();assert.equal(call('lider','solicitar',over,0,createData(650)).status,'aguardando_diretoria')
fail(()=>call('rh','preparar_rh',over,1,{...rh,valor:650}),'RH cannot skip director')
assert.equal(call('diretor','aprovar',over,1,{note:'Synthetic approval'}).status,'solicitado')
assert.equal(call('rh','preparar_rh',over,2,{...rh,valor:651}).status,'aguardando_diretoria')
assert.equal(call('diretor','recusar',over,3,{note:'Synthetic refusal'}).status,'recusado')
const emergency=randomUUID();assert.equal(call('caixa','solicitar',emergency,0,createData(900,{emergencial:true,nome:'Synthetic'})).status,'solicitado')
assert.equal(call('caixa','informar_pagamento',emergency,1,{receipt_id:receipt(emergency),pago_em:'2026-10-05'}).status,'pagamento_informado')
fail(()=>call('financeiro','conferir',emergency,2),'emergency needs RH before closure')
fail(()=>call('rh','preparar_rh',emergency,2,{...rh,valor:901}),'RH cannot change paid amount')
assert.equal(call('rh','preparar_rh',emergency,2,{...rh,valor:900}).status,'pago')
assert.equal(call('diretor','nao_ratificar_emergencia',emergency,3,{note:'Exceptional process not approved'}).status,'pago')
assert.equal(sql(`select mise_emergency_decision from op_extra where id=${quote(emergency)}`),'nao_ratificado')
fail(()=>call('diretor','ratificar_emergencia',emergency,4,{note:'Second decision'}),'emergency decision cannot be overwritten')
assert.equal(sql(`select count(*) from mise.extra_notification_outbox where extra_id=${quote(emergency)}`),'1')
const unknown=randomUUID();assert.equal(call('lider','solicitar',unknown,0,createData(null)).status,'solicitado')
assert.equal(sql(`select total is null from op_extra where id=${quote(unknown)}`),'t')
assert.equal(call('rh','preparar_rh',unknown,1,{...rh,valor:30}).status,'aguardando_diretoria')
assert.equal(call('diretor','recusar',unknown,2,{note:'Test'}).status,'recusado')
assert.equal(sql(`select count(*) from notifications where user_id=${quote(actors.diretor)}`),'4')
const budget=JSON.parse(sql(`select mise.extra_week_budget(${quote(unit)},'2026-10-05')`));assert.equal(budget.usado,1000);assert.equal(budget.teto,700)
// Two concurrent requests in a fresh week: only one fits the remaining allowance.
function asyncSql(q){return new Promise((resolve,reject)=>{const p=spawn('psql',[...args,'-c',q]);let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('close',code=>code?reject(new Error(err)):resolve(JSON.parse(out.trim())))})}
const concurrent=await Promise.all([1,2].map(()=>asyncSql(commandSql('lider','solicitar',randomUUID(),0,createData(400,{data_trabalho:'2026-10-12'})))))
assert.deepEqual(concurrent.map(x=>x.status).sort(),['aguardando_diretoria','solicitado'])
console.log('PASS concurrent allowance reservation, complete payment, emergency regularization, generated total, audit and notifications')

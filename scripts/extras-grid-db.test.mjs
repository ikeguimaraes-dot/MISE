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
// All fixtures and writes below target the isolated PostgreSQL socket only.
sql(`CREATE TABLE IF NOT EXISTS public.op_horario_padrao(id uuid default gen_random_uuid(),unit_id uuid,dia_semana integer,periodo text,hora_abertura time,hora_fechamento time)`)
const jobs=[job,randomUUID(),randomUUID()];for(let i=1;i<3;i++)sql(`INSERT INTO op_extra_cargo(id,nome,setor_padrao,valor_referencia) VALUES(${quote(jobs[i])},${quote('Grid '+jobs[i])},'Synthetic sector',${i===2?'null':100})`)
sql(`INSERT INTO op_horario_padrao(unit_id,dia_semana,periodo,hora_abertura,hora_fechamento) SELECT ${quote(c.unit)},d,'jantar','18:00','23:00' FROM generate_series(1,6)d`)
const read=()=>JSON.parse(sql(`select mise.extra_grid_read(${quote(actors.lider)},${quote(c.unit)},'2026-10-05')`));
const send=(items,revision=read().revision,key=randomUUID(),actor=actors.lider)=>JSON.parse(sql(`select mise.extra_grid_command(${quote(actor)},${quote(key)},${quote(c.unit)},'2026-10-05',${quote(revision)},${quote(c.requester)},${quote(JSON.stringify(items))})`));
const draft=(cargo,day,qty=1,rate=50,period='jantar')=>({cargo_id:cargo,data_trabalho:day,quantidade:qty,valor_unitario:rate,periodo:period,motivo:'evento'});
const six=jobs.flatMap(j=>['2026-10-05','2026-10-06'].map(d=>draft(j,d))),initial=read().revision,command=randomUUID();
assert.equal(send(six,initial,command).items.length,6);assert.equal(read().items.length,6);assert.equal(budget().usado,300);
assert.equal(send(six,initial,command).replayed,true);assert.equal(read().items.length,6);
assert.equal(send(six).items.length,0);assert.equal(read().items.length,6);
assert.ok(read().items.every(x=>x.quantidade===1&&x.editable));
console.log('PASS 3 functions × 2 dates creates six; persisted reload and both retry forms never duplicate');
const first=read().items.find(x=>x.funcao.startsWith('Synthetic')&&x.data_trabalho==='2026-10-05'),zero=[draft(job,'2026-10-05',0)];send(zero);assert.equal(row(first.id).status,'cancelado');assert.equal(read().items.length,5);assert.equal(budget().usado,250);
send([draft(job,'2026-10-05',2)]);assert.equal(read().items.length,6);assert.equal(row(first.id).status,'cancelado');assert.equal(budget().usado,350);
console.log('PASS zero cancels without deletion; reopening creates one active cell and keeps canceled history');
const before=read();fails(()=>send([draft(job,'2026-10-07'),draft(job,'2026-10-11')]),'closed Sunday rolls back the whole batch');assert.equal(read().revision,before.revision);
fails(()=>send([draft(jobs[2],'2026-10-07',1,null)]),'missing reference requires explicit rate');
fails(()=>send([draft(job,'2026-10-05'),draft(job,'2026-10-05')]),'same function/date/period duplicate denied');
fails(()=>send([draft(job,'2026-10-05')],initial),'stale week rejected');
fails(()=>send([draft(job,'2026-10-05')],read().revision,randomUUID(),actors.rh),'RH cannot reconcile manager plan');
send([draft(job,'2026-10-05',2,50,'almoco')]);assert.equal(read().items.filter(x=>x.funcao.startsWith('Synthetic')&&x.data_trabalho==='2026-10-05').length,2);
assert.equal(send([draft(job,'2026-10-05',2,50,'almoco')]).items.length,0);assert.equal(budget().usado,450);
console.log('PASS daily periods are independent keys and all periods consume the same allowance');
const over=send([draft(job,'2026-10-07',10,100),draft(jobs[1],'2026-10-07',1,100)]);assert.ok(over.items.every(x=>x.status==='aguardando_diretoria'));assert.equal(budget().usado,1550);
const nom=read().items.find(x=>x.id!==first.id&&x.funcao.startsWith('Synthetic')&&x.data_trabalho==='2026-10-05'&&x.periodo==='jantar');
// A request can return to waiting for the director after partial naming; it must still be locked.
nominate(nom.id,[person(1)]);assert.equal(read().items.find(x=>x.id===nom.id).editable,false);
fails(()=>send([draft(job,'2026-10-05',0)]),'RH-named cell cannot be canceled from grid, even when waiting for director');
assert.equal(people(nom.id).length,1);
console.log('PASS overage routes changed requests to director, named cells locked server-side');
const newDay='2026-10-08',rev=read().revision;
const concurrencyCommand=(n)=>`select mise.extra_grid_command(${quote(actors.lider)},${quote(randomUUID())},${quote(c.unit)},'2026-10-05',${quote(rev)},${quote(c.requester)},${quote(JSON.stringify([draft(job,newDay,n)]))})`;
const concurrent=q=>new Promise(resolve=>{const p=spawn('psql',[...args,'-c',q]);let out='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',()=>{});p.on('exit',code=>resolve(code))});
const codes=await Promise.all([concurrent(concurrencyCommand(2)),concurrent(concurrencyCommand(3))]);assert.deepEqual(codes.sort(),[0,1]);assert.equal(read().items.filter(x=>x.funcao.startsWith('Synthetic')&&x.data_trabalho===newDay).length,1);
fails(()=>sql(`SET ROLE authenticated; SELECT mise.extra_grid_read(${quote(actors.lider)},${quote(c.unit)},'2026-10-05')`),'public clients cannot bypass scoped API');
console.log('PASS concurrent edits serialize, stale writer rejected, no duplicated key, service-only RPC');

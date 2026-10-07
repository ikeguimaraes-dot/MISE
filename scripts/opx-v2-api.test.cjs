const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
function load(file,mocks={}){const m=new Module(file,module);m.filename=file;m.paths=module.paths;m.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);return m.exports}
const unit='10000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000001',employee='30000000-0000-4000-8000-000000000001',id='40000000-0000-4000-8000-000000000001';
let role='lider',rpc=[],writes=[],filters=[],active=true;
const q=()=>{const b={};for(const k of ['select','eq','order'])b[k]=(...a)=>{filters.push([k,...a]);return b};b.insert=d=>{writes.push(d);return b};b.update=b.insert;b.single=b.maybeSingle=async()=>({data:{id,ativo:active,unit_id:unit},error:null});b.then=(a,b)=>Promise.resolve({data:[],error:null}).then(a,b);return b};
const db={schema:()=>db,from:q,rpc:async(name,args)=>{rpc.push({name,args});return {data:{items:[]},error:null}}};
const access=load('src/lib/extras/access.ts',{'server-only':{},'@/lib/session':{},'@/lib/supabase/server':{}});access.extrasContext=async()=>({db,session:{employeeId:employee},grants:[{unit_id:unit,role}]});
const alcada=load('src/lib/extras/alcada.ts');
const planning=load('src/app/api/extras/planejamento/route.ts',{'@/lib/extras/access':access,'@/lib/extras/alcada':alcada,'next/server':{after:()=>{}},'@/lib/extras/notifications':{}});
const crivo=load('src/lib/crivo/access.ts',{'server-only':{},'@/lib/session':{},'@/lib/supabase/server':{}});crivo.crivoContext=async()=>({db,session:{role,employeeId:employee},unitId:unit});
const equipment=load('src/app/api/crivo/locais/[localId]/equipamentos/route.ts',{'@/lib/crivo/access':crivo});
const turno=load('src/app/api/relatorio-diario/_auth.ts',{'@/lib/session':{getMiseSession:async()=>({role,employeeId:employee})},'@/lib/supabase/server':{createServiceClient:()=>db}});
const post=data=>new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
(async()=>{
 const plan={unit_id:unit,week:'2026-10-05',items:[{id,command_id:id,data:{unit_id:unit,data_trabalho:'2026-10-08',cargo_id:id,solicitante_cadastro_id:id}}]};
 assert.equal((await planning.POST(post(plan))).status,201);assert.equal(rpc.at(-1).args.p_actor,employee);
 assert.equal((await planning.POST(post({...plan,unit_id:other}))).status,403);
 assert.equal((await planning.POST(post({...plan,items:[{...plan.items[0],data:{...plan.items[0].data,data_trabalho:'2026-10-12'}}]}))).status,400);
 role='financeiro';assert.equal((await planning.POST(post(plan))).status,403);
 const params={params:Promise.resolve({localId:id})};assert.equal((await equipment.POST(post({codigo:'G1',tipo:'geladeira'}),params)).status,403);
 role='admin';assert.equal((await equipment.POST(post({codigo:'G1',tipo:'geladeira',local_id:other}),params)).status,201);assert.equal(writes.at(-1).local_id,id);
 assert.equal((await equipment.PATCH(post({id,ativo:false,local_id:other}),params)).status,200);assert.deepEqual(writes.at(-1),{ativo:false});assert.ok(filters.some(f=>f[0]==='eq'&&f[1]==='local_id'&&f[2]===id));
 assert.equal((await equipment.POST(post({codigo:'',tipo:'geladeira'}),params)).status,400);
 assert.equal((await turno.canAccessUnit(other)).ok,true);active=false;assert.equal((await turno.canAccessUnit(unit)).ok,false);active=true;role='gerente';assert.equal((await turno.canAccessUnit(other)).ok,false);assert.equal((await turno.canAccessUnit(unit)).ok,true);

 const submissions=[];
 const submissionDb={from:table=>{let update=null;const b={};for(const k of ['select','eq'])b[k]=()=>b;b.update=d=>{update=d;submissions.push({table,data:d});return b};const result=()=>({error:null,data:table==='op_unit_config'?{periodos:['almoco']}:table==='employees'?{user_id:null}:table==='op_relatorio_diario'?{id,status:'rascunho'}:{id,enviado_em:null}});b.single=async()=>result();b.then=(a,c)=>Promise.resolve(update?{error:null}: {data:[{periodo:'almoco',enviado_em:'2026-10-07T10:00:00Z',status:'enviado'}],error:null}).then(a,c);return b}};
 const send=load('src/app/api/relatorio-diario/[data]/periodos/[periodo]/enviar/route.ts',{'@/lib/supabase/server':{createServiceClient:()=>submissionDb},'@/app/api/relatorio-diario/_auth':{canAccessUnit:async()=>({ok:true,employeeId:employee})},'@/app/api/relatorio-diario/_ledger':{emitTurnoEvent:async()=>{}}});
 assert.equal((await send.POST(post({unit_id:unit}),{params:Promise.resolve({data:'2026-10-07',periodo:'almoco'})})).status,200);
 assert.equal(submissions.length,2);for(const entry of submissions){assert.equal(entry.data.enviado_employee_id,employee);assert.equal(entry.data.enviado_por,null)}
 console.log('PASS weekly-plan auth/unit/date boundaries, equipment admin-only and scoped deactivation, active submission author, employee identity persisted without fabricated auth mapping');
})().catch(e=>{console.error(e);process.exitCode=1});

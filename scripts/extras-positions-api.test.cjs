const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
function load(file,mocks={}){const m=new Module(file,module);m.filename=file;m.paths=module.paths;m.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);return m.exports}
const access=load('src/lib/extras/access.ts',{'server-only':{},'@/lib/session':{},'@/lib/supabase/server':{}});
const positions=load('src/lib/extras/positions.ts');
const unit='10000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000001',employee='30000000-0000-4000-8000-000000000001',id='40000000-0000-4000-8000-000000000001';
let role='lider',owner=employee,requestUnit=unit,log=[],rpc=[];
function query(table){const q={};for(const method of ['select','eq','order','range','or','not','gte','lte','in'])q[method]=(...args)=>{log.push({table,method,args});return q};const execute=single=>{let data=table==='extra_request_summary'?[{id,unit_id:requestUnit,mise_requested_by:owner}]:table==='op_extra_solicitacao'?[{unit_id:requestUnit}]:[];return {data:single?data[0]:data,error:null}};q.single=async()=>execute(true);q.then=(a,b)=>Promise.resolve(execute(false)).then(a,b);return q}
const db={schema:()=>db,from:table=>query(table),rpc:async(name,args)=>{rpc.push({name,args});return {data:{id,status:'solicitado'},error:null}}};
access.extrasContext=async()=>({db,session:{employeeId:employee},grants:[{unit_id:unit,role}]});
const mocks={'@/lib/extras/access':access,'@/lib/extras/positions':positions,'@/lib/extras/alcada':{validDate:s=>/^\d{4}-\d{2}-\d{2}$/.test(s)},'next/server':{after:()=>{}},'@/lib/extras/notifications':{dispatchExtraNotifications:async()=>{}}};
const list=load('src/app/api/extras/solicitacoes/route.ts',mocks),detail=load('src/app/api/extras/solicitacoes/[id]/route.ts',mocks),actions=load('src/app/api/extras/solicitacoes/[id]/actions/route.ts',mocks);
const params={params:Promise.resolve({id})},post=data=>new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
(async()=>{
 assert.equal((await detail.GET(new Request('https://example.invalid'),params)).status,200);
 assert.ok(!log.find(l=>l.table==='op_extra'&&l.method==='select').args[0].split(',').includes('cpf'));
 owner=other;assert.equal((await detail.GET(new Request('https://example.invalid'),params)).status,403);owner=employee;
 requestUnit=other;assert.equal((await detail.GET(new Request('https://example.invalid'),params)).status,403);requestUnit=unit;
 role='rh';log=[];assert.equal((await detail.GET(new Request('https://example.invalid'),params)).status,200);assert.ok(log.find(l=>l.table==='op_extra'&&l.method==='select').args[0].split(',').includes('cpf'));
 log=[];assert.equal((await list.GET(new Request(`https://example.invalid?unit_id=${unit}&role=rh&from=2026-10-05&to=2026-10-11&queue=1`))).status,200);assert.ok(log.some(l=>l.method==='eq'&&l.args[0]==='rh_pendente'&&l.args[1]===true));
 assert.equal((await list.GET(new Request(`https://example.invalid?unit_id=${other}&role=rh&from=2026-10-05&to=2026-10-11`))).status,403);
 role='lider';log=[];await list.GET(new Request(`https://example.invalid?unit_id=${unit}&role=lider&from=2026-10-05&to=2026-10-11`));assert.ok(log.some(l=>l.method==='eq'&&l.args[0]==='mise_requested_by'&&l.args[1]===employee));
 const body={id,command_id:id,role,data:{unit_id:unit,data_trabalho:'2026-10-05',solicitante_cadastro_id:id,cargo_id:id,quantidade:3,valor_unitario:150}};
 assert.equal((await list.POST(post(body))).status,201);assert.equal(rpc.at(-1).name,'extra_request_command');assert.equal(rpc.at(-1).args.p_actor,employee);
 assert.equal((await list.POST(post({...body,role:'financeiro'}))).status,403);
 requestUnit=other;assert.equal((await actions.POST(post({role:'lider',action:'cancelar',version:1,command_id:id,data:{note:'test'}}),params)).status,403);
 console.log('PASS positions APIs: scoped ownership and units, CPF restricted to authorized roles, pending RH query, transactional parent creation, action scope');
})().catch(e=>{console.error(e);process.exitCode=1});

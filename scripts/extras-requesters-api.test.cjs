const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
const unit='10000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000001';
let role='lider', nextId=4, writes=0;
let rows=[{id:'1',unit_id:unit,nome:'Bruno',ativo:true,employee_id:'preserved'},{id:'2',unit_id:unit,nome:'Ana',ativo:true},{id:'3',unit_id:unit,nome:'Inativo',ativo:false},{id:'9',unit_id:other,nome:'Outra casa',ativo:true}];
class ExtraError extends Error{constructor(message,status=400){super(message);this.status=status}}
function query(){let filters=[],patch=null,insert=null,sorted=false;const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q},order:()=>{sorted=true;return q},update:p=>{patch=p;return q},insert:p=>{insert=p;return q},then:(resolve,reject)=>Promise.resolve(execute(false)).then(resolve,reject),maybeSingle:async()=>execute(true)};
 function execute(single){let found=rows.filter(r=>filters.every(([k,v])=>r[k]===v));if(patch){found.forEach(r=>Object.assign(r,patch));writes++}if(insert){const r={id:String(nextId++),...insert};rows.push(r);found=[r];writes++}if(sorted)found.sort((a,b)=>a.nome.localeCompare(b.nome));return {data:single?(found[0]||null):found.map(r=>({...r})),error:null}}return q}
const access={ExtraError,requireUuid:v=>{if(typeof v!=='string'||!v)throw new ExtraError('ID');return v},requireExtraAccess:(g,u)=>{if(u!==unit)throw new ExtraError('Forbidden',403)},extrasContext:async()=>({db:{from:()=>query()},session:{role},grants:[]}),extraResponseError:e=>Response.json({error:e.message},{status:e.status||500})};
const file='src/app/api/extras/solicitantes/route.ts',m=new Module(file,module);m.filename=file;m.paths=module.paths;m.require=id=>id==='@/lib/extras/access'?access:require(id);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const api=m.exports,request=(method,data)=>new Request('https://example.invalid/api/extras/solicitantes',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
(async()=>{
 let response=await api.GET(new Request(`https://example.invalid?unit_id=${unit}`));assert.deepEqual((await response.json()).items.map(r=>r.nome),['Ana','Bruno']);
 assert.equal((await api.GET(new Request(`https://example.invalid?unit_id=${other}`))).status,403);
 assert.equal((await api.GET(new Request(`https://example.invalid?unit_id=${unit}&all=1`))).status,403);
 assert.equal((await api.POST(request('POST',{unit_id:unit,nome:'Novo'}))).status,403);
 assert.equal((await api.PATCH(request('PATCH',{unit_id:unit,id:'1',ativo:false}))).status,403);assert.equal(writes,0);
 role='admin';response=await api.GET(new Request(`https://example.invalid?unit_id=${unit}&all=1`));assert.equal((await response.json()).items.length,3);
 assert.equal((await api.POST(request('POST',{unit_id:unit,nome:' '}))).status,400);
 assert.equal((await api.POST(request('POST',{unit_id:unit,nome:'  Carlos  '}))).status,201);assert.ok(rows.some(r=>r.nome==='Carlos'));
 assert.equal((await api.PATCH(request('PATCH',{unit_id:unit,id:'9',nome:'Forged'}))).status,404);assert.equal(rows.find(r=>r.id==='9').nome,'Outra casa');
 assert.equal((await api.PATCH(request('PATCH',{unit_id:unit,id:'1',nome:'Renomeado',employee_id:'forged'}))).status,200);assert.equal(rows.find(r=>r.id==='1').employee_id,'preserved');
 assert.equal((await api.PATCH(request('PATCH',{unit_id:unit,id:'1',ativo:false}))).status,200);assert.equal(rows.find(r=>r.id==='1').ativo,false);assert.equal(api.DELETE,undefined);
 console.log('PASS requester API: active/sorted/unit-scoped directory, admin-only CRUD, soft deactivation, input validation and field allowlist');
})().catch(e=>{console.error(e);process.exitCode=1});

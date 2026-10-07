const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
function load(file,mocks={}){const m=new Module(file,module);m.filename=file;m.paths=module.paths;m.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);return m.exports}
const scoring=load('src/lib/crivo/scoring.ts'),equipment=load('src/lib/crivo/equipment.ts');
class CrivoError extends Error{constructor(message,status=400){super(message);this.status=status}}
const items=[{id:'one',topico_ordem:1,topico_nome:'Cozinha',tipo_resposta:'sim_nao',peso:1,requer_foto:'sim',requer_comentario:'se_nao'},{id:'two',topico_ordem:1,topico_nome:'Cozinha',tipo_resposta:'sim_nao',peso:1}];
let responses=[{item_id:'one',resposta:{valor:'nao'},nao_aplicavel:false,comentario:'Achado sintético para teste',foto_url:null},{item_id:'two',resposta:{valor:'sim'},nao_aplicavel:false,foto_url:null}],calls=[];
const db={schema:()=>db,from:()=>({select:()=>({eq:async()=>({data:responses,error:null})})}),rpc:async(name,args)=>{calls.push({name,args});return {data:name==='crivo_response_hash'?'hash':null,error:null}}};
const route=load('src/app/api/checklists/execucoes/[id]/concluir/route.ts',{'@/lib/crivo/scoring':scoring,'@/lib/crivo/equipment':equipment,'@/lib/supabase/server':{},'@/lib/crivo/access':{CrivoError,crivoError:e=>Response.json({error:e.message},{status:e.status||500}),crivoExecution:async()=>({db,session:{employeeId:'synthetic-auditor'},execution:{status:'em_andamento',crivo_snapshot:{model:'ff_ponderado',items,weights:[{topico_ordem:1,peso:100}]}}})}});
const request=()=>new Request('https://example.invalid',{method:'POST',body:'{}'}),params={params:Promise.resolve({id:'synthetic-execution'})};
(async()=>{
 const result=await route.POST(request(),params);assert.equal(result.status,200);assert.equal((await result.json()).percentual,50);assert.equal(calls.at(-1).name,'crivo_finish');assert.equal(calls.at(-1).args.p_actor,'synthetic-auditor');
 calls=[];responses[0].comentario='';assert.equal((await route.POST(request(),params)).status,422);assert.ok(!calls.some(c=>c.name==='crivo_finish'));
 calls=[];responses=responses.slice(0,1);assert.equal((await route.POST(request(),params)).status,422);assert.ok(!calls.some(c=>c.name==='crivo_finish'));
 console.log('PASS completion API: NC requiring photo finishes without photo at expected score; missing required comment/answer still rejected');
})().catch(e=>{console.error(e);process.exitCode=1});

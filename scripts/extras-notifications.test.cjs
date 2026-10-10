const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
let claimed=0,updates=[],calls=[];
const db={schema:()=>db,rpc:async()=>{claimed++;return {data:[{id:'job1',event_id:'event1',payload:{tipo:'extra_emergencial',link:'/extras?extra_id=example'},lease_token:'lease1',attempts:1},{id:'job2',event_id:'event2',payload:{tipo:'aguardando_diretoria',link:'/extras?extra_id=example'},lease_token:'lease2',attempts:2}],error:null}},from:()=>({update:patch=>({eq:(key,id)=>({eq:async(lock,token)=>{updates.push({patch,key,id,lock,token});return {error:null}}})})})};
const file='src/lib/extras/notifications.ts',m=new Module(file,module);m.filename=file;m.paths=module.paths;m.require=id=>id==='server-only'?{}:id==='@/lib/supabase/server'?{createServiceClient:()=>db}:require(id);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
(async()=>{
 delete process.env.EXTRAS_NOTIFICATION_WEBHOOK;assert.deepEqual(await m.exports.dispatchExtraNotifications(),{configured:false,delivered:0});assert.equal(claimed,0);
 process.env.EXTRAS_NOTIFICATION_WEBHOOK='https://example.invalid/webhook';process.env.APP_URL='https://mise.example.invalid';
 global.fetch=async(url,init)=>{calls.push(JSON.parse(init.body));return {ok:init.headers['Idempotency-Key']==='event1',status:503}};
 const r=await m.exports.dispatchExtraNotifications();assert.equal(r.delivered,1);assert.equal(updates.length,2);assert.equal(updates[0].lock,'lease_token');assert.ok(updates.find(x=>x.id==='job1').patch.delivered_at);assert.equal(updates.find(x=>x.id==='job2').patch.last_error,'HTTP 503');assert.ok(Date.parse(updates[1].patch.next_attempt_at)>Date.now());assert.match(calls[0].link,/^https:\/\/mise.example.invalid\/extras/);assert.ok(!calls[0].cpf);
 process.env.EXTRAS_NOTIFICATION_WEBHOOK='http://example.invalid';await assert.rejects(()=>m.exports.dispatchExtraNotifications(),/HTTPS/);
 console.log('PASS durable notifications: missing configuration, external payload, delivery status, retry backoff and lease ownership');
})().catch(e=>{console.error(e);process.exitCode=1});

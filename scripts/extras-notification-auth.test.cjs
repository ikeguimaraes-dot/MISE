const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
function load(file,mocks){const m=new Module(file,module);m.filename=file;m.paths=module.paths;m.require=id=>id in mocks?mocks[id]:require(id);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);return m.exports;}
(async()=>{
 process.env.NODE_ENV='production';let sessions=0,deliveries=0;
 const {middleware}=load('src/middleware.ts',{'next/server':{NextResponse:{next:()=>({next:true})}},'@supabase/supabase-js':{createClient:()=>{throw Error('Unexpected database call')}},'@/lib/supabase/middleware':{updateSession:async()=>{sessions++;return {login:true}}}});
 const request=(method,path)=>({method,nextUrl:{pathname:path},cookies:{get:()=>undefined}});
 assert.deepEqual(await middleware(request('GET','/api/extras/notifications')),{next:true});assert.equal(sessions,0);
 assert.deepEqual(await middleware(request('POST','/api/extras/notifications')),{login:true});
 assert.deepEqual(await middleware(request('GET','/api/extras/requests')),{login:true});assert.equal(sessions,2);
 const {GET}=load('src/app/api/extras/notifications/route.ts',{'@/lib/extras/access':{},'@/lib/extras/notifications':{dispatchExtraNotifications:async()=>{deliveries++;return {configured:true,delivered:0}}}});
 delete process.env.EXTRAS_NOTIFICATION_CRON_SECRET;
 assert.equal((await GET(new Request('https://example.invalid'))).status,401);
 process.env.EXTRAS_NOTIFICATION_CRON_SECRET='synthetic-test-secret';
 assert.equal((await GET(new Request('https://example.invalid',{headers:{authorization:'Bearer wrong'}}))).status,401);assert.equal(deliveries,0);
 assert.equal((await GET(new Request('https://example.invalid',{headers:{authorization:'Bearer synthetic-test-secret'}}))).status,200);assert.equal(deliveries,1);
 console.log('PASS scheduler reaches token validation; missing/wrong tokens denied; user actions still require login');
})().catch(e=>{console.error(e);process.exitCode=1});

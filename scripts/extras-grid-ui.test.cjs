// Browser regressions use only synthetic in-memory requests. Never production APIs.
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),mock=require('./fixtures/extras-ux.cjs');
const base='http://127.0.0.1:3127',output='/tmp/mise-week-grid';fs.mkdirSync(output,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME});try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}});page.setDefaultTimeout(20000);await page.clock.install({time:new Date('2026-10-07T15:00:00Z')});await mock(page);
 const jobs=[{id:'job-1',nome:'Cumim',setor_padrao:'Salão',valor_referencia:150,ordem:1},{id:'job-2',nome:'Segurança',setor_padrao:'Portaria',valor_referencia:200,ordem:2},{id:'job-3',nome:'Estoquista',setor_padrao:'Estoque',valor_referencia:null,ordem:3}];
 let saved=[],calls=[],version=0;
 await page.route('**/api/extras/catalogo?*',r=>r.fulfill({json:{items:jobs}}));
 await page.route('**/api/extras/planejamento**',async r=>{
  if(r.request().method()==='GET'){
   const previous=new URL(r.request().url()).searchParams.get('week')==='2026-09-28';
   return r.fulfill({json:{revision:String(version).padStart(32,'0'),items:previous?[{id:'old',data_trabalho:'2026-09-28',funcao:'Cumim',setor:'Salão',quantidade:4,valor_unitario:150,valor_consumido:600,motivo:'evento',periodo:'almoco',status:'pago',editable:false}]:saved,schedule:Array.from({length:6},(_,i)=>({dia_semana:i+1,periodo:'jantar'})),budget:{teto:4250,usado:saved.reduce((s,x)=>s+x.valor_consumido,0),percentual:.85,dias_sem_meta:0}}});
  }
  assert.equal(r.request().method(),'PUT');const body=r.request().postDataJSON();calls.push(body);const changed=[];
  for(const x of body.items){const job=jobs.find(j=>j.id===x.cargo_id),key=job.nome+x.periodo+x.data_trabalho,old=saved.find(s=>s.id===key);if(!x.quantidade){saved=saved.filter(s=>s.id!==key);changed.push({id:key,status:'cancelado'});continue}const item={...x,id:key,funcao:job.nome,setor:job.setor_padrao,valor_consumido:x.quantidade*x.valor_unitario,status:'solicitado',solicitante_nome:'Gerente de demonstração',editable:true};if(old)Object.assign(old,item);else saved.push(item);changed.push({id:key,status:'solicitado'})}
  version++;return r.fulfill({json:{items:changed}})
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/preview/extras-ux',{waitUntil:'domcontentloaded',timeout:90000});await page.locator('.er-plan-table').waitFor();
 if(width<800)await page.locator('.er-filter-summary').click();await page.getByLabel('Responsável',{exact:true}).selectOption('manager:manager-1');if(width<800)await page.locator('.er-filter-summary').click();
 await page.getByLabel('Período da grade').selectOption('almoco');
 const add=async id=>{await page.getByRole('button',{name:'Adicionar função',exact:true}).click();await page.getByLabel('Adicionar função',{exact:true}).selectOption(id)};
 for(const job of jobs){await add(job.id);for(const day of ['05/10','06/10'])await page.getByLabel(`${job.nome} ${day}`,{exact:true}).fill('1')}
 assert.equal(await page.getByRole('button',{name:'Enviar semana',exact:true}).isDisabled(),true);await page.getByLabel('Diária de Estoquista',{exact:true}).fill('10000');assert.match(await page.locator('.er-plan-budget').textContent(),/900,00/);
 assert.equal(await page.getByLabel('Cumim 11/10',{exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Enviar semana',exact:true}).click();await page.getByRole('status').filter({hasText:'Semana enviada'}).waitFor();assert.equal(calls[0].items.length,6);assert.equal(saved.length,6);
 await page.reload();await page.getByLabel('Cumim 05/10',{exact:true}).waitFor();assert.equal(await page.getByLabel('Cumim 05/10',{exact:true}).inputValue(),'1');
 if(width<800)await page.locator('.er-filter-summary').click();await page.getByLabel('Responsável',{exact:true}).selectOption('manager:manager-1');if(width<800)await page.locator('.er-filter-summary').click();
 await page.getByLabel('Cumim 05/10',{exact:true}).fill('');await page.getByRole('button',{name:'Enviar semana',exact:true}).click();await page.getByRole('status').filter({hasText:'Semana enviada'}).waitFor();assert.equal(calls.at(-1).items.find(x=>x.cargo_id==='job-1'&&x.data_trabalho==='2026-10-05').quantidade,0);assert.equal(saved.length,5);
 await page.getByLabel('Período da grade').selectOption('jantar');await add('job-1');await page.getByLabel('Cumim 05/10',{exact:true}).fill('2');assert.match(await page.locator('.er-plan-budget').textContent(),/1\.050,00/);await page.getByLabel('Período da grade').selectOption('almoco');assert.equal(await page.getByLabel('Cumim 05/10',{exact:true}).inputValue(),'');
 await page.getByLabel('Cumim 06/10',{exact:true}).fill('30');assert.equal(await page.locator('.er-plan-budget.is-danger').count(),1);assert.match(await page.locator('.er-plan-budget').textContent(),/Estoura a alçada em R\$\s*1\.150,00/);
 await page.getByRole('button',{name:'Copiar semana anterior',exact:true}).click();await page.getByRole('status').filter({hasText:'Quantidades copiadas'}).waitFor();assert.equal(calls.length,2);assert.equal(await page.getByLabel('Cumim 05/10',{exact:true}).inputValue(),'4');
 // Server fixture transitions to RH; reopening must expose a locked, non-submittable cell.
 saved[0].editable=false;saved[0].status='aprovado_rh';await page.reload();await page.getByLabel('Cumim 06/10',{exact:true}).waitFor();const locked=saved[0];assert.equal(await page.getByLabel(`${locked.funcao} ${locked.data_trabalho.slice(8)}/10`,{exact:true}).getAttribute('readonly'),'');
 const dimensions=await page.evaluate(()=>({w:innerWidth,actual:document.documentElement.scrollWidth}));assert.ok(dimensions.actual<=dimensions.w+1);await page.locator('.er-plan-heading').scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/grade-${width}.png`,fullPage:true});assert.deepEqual(errors,[]);
 console.log(`PASS ${width}px: six cells, reload, cancel, periods share allowance, closed Sunday, required rate, overage, copy draft only, RH lock, no page overflow`);await page.close()
}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

// Run against a local dev server only; every API is intercepted with synthetic data.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const mock=require('./fixtures/extras-ux.cjs');
const base=process.env.MISE_UX_URL||'http://127.0.0.1:3127';
if(!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base))throw new Error('Local dev URL required');
const output=process.env.MISE_UX_OUTPUT||'/tmp/mise-ux-review';fs.mkdirSync(output,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME?{executablePath:process.env.PLAYWRIGHT_CHROME}:{})});try{
 for(const width of (process.env.MISE_UX_WIDTHS||'320,390,768,1024,1440').split(',').map(Number)){
  const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(20000);await mock(page);
  console.log('START',width);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/preview/extras-ux`,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('.er-request').first().waitFor();
  const compact=await page.locator('.er').evaluate(el=>el.clientWidth-parseFloat(getComputedStyle(el).paddingLeft)-parseFloat(getComputedStyle(el).paddingRight)<=800);
  async function noOverflow(label){const m=await page.evaluate(()=>({width:innerWidth,actual:document.documentElement.scrollWidth}));assert.ok(m.actual<=m.width+1,`${width} ${label}: overflow ${m.actual}`)}
  async function setRole(role){if(compact&&!await page.getByLabel('Seu papel',{exact:true}).isVisible())await page.locator('.er-filter-summary').click();await page.getByLabel('Seu papel',{exact:true}).selectOption(role);if(compact)await page.locator('.er-filter-summary').click()}
  await noOverflow('list');
  const rects=await page.locator('.er-request').first().locator(':scope > span').evaluateAll(nodes=>nodes.map(n=>({top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom})));
  for(let i=1;i<rects.length;i++)assert.ok(rects[i].top>=rects[i-1].bottom-1,'card metadata overlaps');
  if([390,1440].includes(width))await page.screenshot({path:`${output}/extras-lista-${width}.png`,fullPage:false});
  await page.locator('.er-request').first().click();await page.locator('.er-detail h2').waitFor();await noOverflow('detail');
  if(compact){assert.equal(await page.locator('.er-list').isVisible(),false);await page.waitForFunction(()=>document.activeElement?.classList.contains('er-detail'));const rect=await page.locator('.er-detail').boundingBox();assert.ok(rect.y<180,'detail not brought into view');await page.getByRole('button',{name:'Voltar aos pedidos',exact:false}).click();assert.equal(await page.locator('.er-list').isVisible(),true)}
  await page.getByRole('searchbox').fill('nao existe');await page.getByText('Nenhum pedido encontrado nesta lista.').waitFor();await page.getByRole('searchbox').fill('');
  console.log('DETAIL PASS',width);
  await setRole('rh');await page.locator('.er-request').first().click();await page.getByRole('button',{name:'Nomear pessoas',exact:true}).click();assert.equal(await page.locator('.er-position-block').count(),3);await noOverflow('RH form');
  if([390,768].includes(width))await page.screenshot({path:`${output}/extras-rh-${width}.png`,fullPage:false});
  console.log('RH PASS',width);
  await setRole('lider');await page.getByRole('button',{name:'Solicitar posições',exact:true}).click();await page.waitForFunction(()=>document.activeElement?.classList.contains('er-create'));
  await page.getByLabel('Setor',{exact:true}).selectOption('Cozinha de Produção');await page.getByLabel('Função',{exact:true}).selectOption('job-1');await page.getByLabel('Quantidade',{exact:true}).fill('3');
  assert.match(await page.locator('.er-estimate').textContent(),/450,00/);await noOverflow('manager form');
  assert.ok(await page.getByLabel('Valor da diária (R$)',{exact:true}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16));
  if(width===390)await page.screenshot({path:`${output}/extras-formulario-${width}.png`,fullPage:false});
  await page.getByRole('button',{name:'Voltar',exact:true}).click();await setRole('caixa');
  await page.locator('.er-request').first().click();await page.getByRole('button',{name:'Informar pagamento',exact:true}).click();await page.getByLabel('Recibo assinado (até 4 MB)').waitFor();await noOverflow('payment form');
  if(width<1024){await page.getByRole('button',{name:'Abrir menu',exact:true}).click();assert.equal(await page.getByRole('dialog',{name:'Menu de navegação'}).isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog',{name:'Menu de navegação'}).isVisible(),false)}
  await page.getByRole('button',{name:'Buscar módulo',exact:true}).click();await page.getByPlaceholder('O que você precisa fazer?').fill('extras');assert.ok(await page.locator('.workspace-search-dialog a').count()>0);await page.keyboard.press('Escape');
  if([390,1440].includes(width)){for(const view of ['access','cash']){await page.goto(`${base}/preview/extras-ux?view=${view}`,{waitUntil:'domcontentloaded'});await page.locator(view==='cash'?'.opx-cash-table':'.er-access').waitFor();await noOverflow(view);if(width===390)await page.screenshot({path:`${output}/extras-${view}-${width}.png`,fullPage:false});if(view==='cash'){await page.emulateMedia({media:'print'});assert.equal(await page.locator('.opx-print header').isVisible(),true);assert.equal(await page.locator('.opx-cash-table').evaluate(el=>getComputedStyle(el).display),'table');await page.emulateMedia({media:'screen'})}}await page.goto(`${base}/preview`,{waitUntil:'domcontentloaded'});await page.locator('.home-modules-grid').waitFor();await noOverflow('home');await page.screenshot({path:`${output}/inicio-${width}.png`,fullPage:false})}
  assert.deepEqual(errors,[]);console.log(`PASS ${width}px: no overflow/overlap, navigation, search, role forms, live estimate, payment form`);await page.close()
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

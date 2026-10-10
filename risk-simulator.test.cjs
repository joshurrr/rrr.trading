const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const key='rrr.trading.visitor.risk.v1';
const server=http.createServer((req,res)=>fs.readFile(path.join(__dirname,new URL(req.url,'http://local').pathname.replace(/\/$/,'/index.html')),(err,body)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',req.url.includes('.js')?'application/javascript':req.url.includes('.css')?'text/css':'text/html');res.end(body);}));
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const origin=process.env.RISK_TEST_ORIGIN||'http://127.0.0.1:'+server.address().port;
 const errors=[];
 try{
  const context=await browser.newContext();
  if(!process.env.RISK_TEST_ORIGIN){await context.route('https://api.rrr.trading/**',r=>r.fulfill({status:503}));await context.route('**/radio-navigation.js*',r=>r.fulfill({body:''}));}
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
  assert.equal(await page.locator('#risk-dialog').isVisible(),false);
  const before=await page.locator('#activity-performance').innerText();
  await page.locator('#risk-open').click();assert.equal(await page.locator('#risk-close').evaluate(e=>e===document.activeElement),true);
  assert.match(await page.locator('.risk-results').innerText(),/750.00 USDT/);assert.match(await page.locator('.risk-results').innerText(),/3,000.00 USDT/);
  assert.match(await page.locator('.risk-scenarios').innerText(),/-37.50 USDT/);assert.match(await page.locator('.risk-scenarios').innerText(),/\+7.50% on margin/);
  async function change(id,value){await page.locator('#risk-'+id).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);}
  await change('leverage',1.7);assert.match(await page.locator('#risk-profile').innerText(),/Custom/);assert.equal(await page.locator('[data-risk-preset][aria-pressed=true]').count(),0);
  for(const [id,v] of [['leverage',2],['margin',1000],['positions',4],['lossLimit',500]])await change(id,v);
  assert.match(await page.locator('.risk-results').innerText(),/8,000.00 USDT/);assert.match(await page.locator('.risk-scenarios').innerText(),/-100.00 USDT/);
  await change('leverage',10);assert.equal(await page.locator('#risk-leverage').inputValue(),'2');
  await page.locator('#risk-save').click();await page.reload();await page.locator('#risk-open').click();assert.equal(await page.locator('#risk-margin').inputValue(),'1000');
  await page.locator('#risk-reset').click();await page.reload();await page.locator('#risk-open').click();assert.equal(await page.locator('#risk-leverage').inputValue(),'1.5');
  for(const value of [1,1.5,2]){await page.locator('[data-risk-preset="'+value+'"]').click();assert.equal(await page.locator('#risk-leverage').inputValue(),String(value));}
  await page.locator('#risk-reset').click();await page.locator('#risk-close').focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#risk-reset').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Tab');assert.equal(await page.locator('#risk-close').evaluate(e=>e===document.activeElement),true);
  for(const width of [320,375,768,1440]){
   await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert(await page.locator('#risk-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth));
   await page.locator('#risk-dialog').screenshot({path:'.runtime/risk-'+width+'.png'});
   await page.keyboard.press('Escape');assert(await page.locator('#risk-open').evaluate(e=>e===document.activeElement));
   await page.locator('#live-candidate-progress>.candidate-heading').screenshot({path:'.runtime/risk-heading-'+width+'.png'});await page.locator('#risk-open').click();
  }
  await page.mouse.click(2,2);assert.equal(await page.locator('#risk-dialog').isVisible(),false);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  if(!process.env.RISK_TEST_ORIGIN)assert.equal(await page.locator('#activity-performance').innerText(),before);
  await context.close();
  for(const mode of ['corrupt','out-of-range','wrong-type','disabled']){
   const c=await browser.newContext();await c.route('https://api.rrr.trading/**',r=>r.fulfill({status:503}));await c.route('**/radio-navigation.js*',r=>r.fulfill({body:''}));
   await c.addInitScript(({key,mode})=>{if(mode==='disabled')Object.defineProperty(window,'localStorage',{get(){throw Error('disabled');}});else localStorage.setItem(key,mode==='corrupt'?'{bad':JSON.stringify({version:1,settings:{leverage:mode==='wrong-type'?'1.5':3,margin:500,positions:4,lossLimit:100}}));},{key,mode});
   const p=await c.newPage();await p.goto(origin);await p.locator('#risk-open').click();assert.equal(await p.locator('#risk-leverage').inputValue(),'1.5');await p.locator('#risk-save').click();if(mode==='disabled')assert.match(await p.locator('#risk-message').innerText(),/visit only/);await c.close();
  }
  const source=fs.readFileSync('risk-simulator.js','utf8');assert(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon/.test(source));assert.deepEqual(errors,[]);
  console.log('PASS risk simulator: arithmetic, bounds, presets/custom, persistence/reset, invalid/disabled storage, focus/Escape/backdrop, four widths and no network integration.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

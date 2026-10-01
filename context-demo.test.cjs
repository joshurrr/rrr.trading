const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const os=require('node:os');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const symbols=['BTC','ETH','SOL','XRP','LINK','ONDO','AAVE','UNI','HYPE','INJ'];
 let mode='fresh';
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane'}).format(new Date());
 const fixture=()=>{
  const layer={available:true,fresh:true,bias_score:28,regime:'bullish',confidence:80,coverage:.9,updated_at:new Date().toISOString(),valid_until:new Date(Date.now()+(mode==='expired'?-1000:600000)).toISOString()};
  const stale=mode==='stale';
  return {ok:true,mode:'observation_only',fresh:true,generated_at:new Date(Date.now()-(stale?900000:0)).toISOString(),universe:symbols,
   macro:{...layer,report_date:today()},crypto:layer,themes:Object.fromEntries(['rwa_tokenisation','defi','ethereum_ecosystem','core_majors'].map(t=>[t,layer])),
   assets:Object.fromEntries(symbols.map(s=>[s,mode==='partial'&&s==='ONDO'?{available:false,fresh:false,bias_score:null,reason:'source_unavailable'}:layer]))};
 };
 await page.route('https://stream.radiorrr.com/**',r=>r.abort());
 await page.route('https://api.rrr.trading/**',r=>{
  if(new URL(r.request().url()).pathname==='/api/trading-context') return mode==='unavailable'?r.fulfill({status:503}):r.fulfill({json:fixture()});
  return r.fulfill({status:503});
 });
 for(const url of ['/demo/','/demo/short/']){
  mode='fresh';await page.goto('http://127.0.0.1:8765'+url);
  const panel=page.locator('#trading-context');
  await page.waitForFunction(()=>document.querySelector('[data-context-status]').textContent.includes('Snapshot'));
  assert.equal(await panel.evaluate(e=>e.open),false);
  await panel.locator('summary').click();
  assert.match(await panel.innerText(),/Observation only — not currently affecting trades/);
  assert.equal(await panel.locator('.context-row').count(),16);
  assert.match(await panel.innerText(),/\+28.0 · bullish/);
  for(const width of [320,768,1440]){
   await page.setViewportSize({width,height:1000});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+url+' '+width);
   await page.screenshot({path:path.join(os.tmpdir(),`phase2-context-${url.includes('short')?'short':'medium'}-${width}.png`),fullPage:true});
  }
  for(const state of ['partial','stale','expired','unavailable']){
   mode=state;await page.reload();await page.locator('#trading-context summary').click();
   if(state==='unavailable') await page.waitForFunction(()=>document.querySelector('[data-context-status]').textContent==='Context endpoint unavailable');
   else await page.waitForFunction(()=>document.querySelector('[data-context-status]').textContent!== 'Context endpoint unavailable');
   const rows=page.locator('#trading-context .context-row');
   if(state==='partial'){
    assert.match(await rows.nth(11).innerText(),/ONDO.*Unavailable/s);
    assert.match(await rows.nth(6).innerText(),/BTC.*\+28.0/s);
   } else {
    assert.equal(await rows.nth(6).innerText(),(state==='stale'||state==='expired')?'BTC\nStale / unavailable':'BTC\nUnavailable');
    assert(! (await rows.nth(6).innerText()).includes('+28.0'));
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  mode='fresh';await page.reload();await page.waitForFunction(()=>document.querySelector('[data-context-status]').textContent.includes('Snapshot'));
 }
 assert.deepEqual(errors,[]);
 await browser.close();console.log('PASS: both demos, 320/768/1440px, fresh, partial, stale, outage, recovery, no page errors');
})().catch(e=>{console.error(e);process.exit(1)});

const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname;const file=path.join(__dirname,name==='/'?'index.html':name);try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
  let reportDay='2026-10-02',missing=false,future=false;
  const fixture=()=>({report_type:'macro_base',timezone:'Australia/Brisbane',report_date:reportDay,generated_at:reportDay+(future?'T08:00:00+10:00':'T07:00:00+10:00'),macro_score:49.3,macro_regime:'neutral / mixed',confidence:72,scoring:{coverage:.9},components:Object.fromEntries(['rates','usd','equities','liquidity','volatility','macro_events'].map(k=>[k,{score:k==='macro_events'?null:50,status:'Mixed',provenance:{observations:[]}}]))});
  await page.clock.setFixedTime(new Date('2026-10-03T00:30:00+10:00'));
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',r=>{const endpoint=new URL(r.request().url()).pathname;if(endpoint.startsWith('/api/reports/macro/')){requests.push(endpoint);return missing?r.fulfill({status:404}):r.fulfill({json:fixture()});}return r.fulfill({json:{}});});
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>document.querySelector('#macro-score').textContent==='49.3');
  assert.equal(requests.at(-1),'/api/reports/macro/2026-10-02');
  assert.match(await page.locator('#macro-state').innerText(),/Previous day/);
  assert.match(await page.locator('#macro-updated').innerText(),/2026-10-02/);
  await page.clock.setFixedTime(new Date('2026-10-03T06:59:59+10:00'));await page.evaluate(()=>refreshMacro());
  assert.equal(await page.locator('#macro-score').innerText(),'49.3');
  await page.clock.setFixedTime(new Date('2026-10-03T07:00:00+10:00'));missing=true;await page.evaluate(()=>refreshMacro());
  assert.equal(requests.at(-1),'/api/reports/macro/today');assert.equal(await page.locator('#macro-score').innerText(),'—');
  missing=false;await page.evaluate(()=>refreshMacro());assert.match(await page.locator('#macro-summary').innerText(),/current 7 am/);assert.equal(await page.locator('#macro-score').innerText(),'—');
  reportDay='2026-10-03';await page.evaluate(()=>refreshMacro());assert.equal(await page.locator('#macro-score').innerText(),'49.3');
  assert.equal(await page.locator('#macro-state').innerText(),'Saved daily snapshot');
  future=true;await page.evaluate(()=>refreshMacro());assert.equal(await page.locator('#macro-score').innerText(),'—');future=false;
  for(const [time,expected] of [['2026-11-01T00:05:00+10:00','2026-10-31'],['2027-01-01T00:05:00+10:00','2026-12-31'],['2026-10-03T12:00:00+10:00','2026-10-03']]){
   await page.clock.setFixedTime(new Date(time));assert.equal(await page.evaluate(()=>expectedMacroDate()),expected);
  }
  await page.clock.setFixedTime(new Date('2026-10-03T00:30:00+10:00'));reportDay='2026-10-02';await page.evaluate(()=>refreshMacro());
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow '+width);}
  assert.deepEqual(errors,[]);console.log('PASS macro rollover: midnight/06:59/07:00, missing and stale reports after cutoff, recovery, future timestamp rejection, month/year boundaries, desktop/mobile.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

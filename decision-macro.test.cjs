const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
async function run(){
 const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://localhost').pathname);if(file.endsWith(path.sep))file+='index.html';fs.readFile(file,(e,d)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(d);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage();await page.clock.setFixedTime(new Date('2026-10-05T00:30:00+10:00'));
 let reportState='available',candidate=false,signal=false;const reportPaths=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://stream.radiorrr.com/**',r=>r.abort());
 await page.route('https://api.rrr.trading/**',async r=>{
  const endpoint=new URL(r.request().url()).pathname;
  if(endpoint.startsWith('/api/reports/macro/')){
   reportPaths.push(endpoint);if(reportState==='outage')return r.fulfill({status:503});
   const day=reportState==='stale'?'2026-10-03':reportState==='today'?'2026-10-05':'2026-10-04';
   return r.fulfill({json:{report_type:'macro_base',timezone:'Australia/Brisbane',report_date:day,generated_at:day+'T07:00:00+10:00',macro_score:reportState==='empty'?null:53.2,macro_regime:'neutral / mixed',confidence:72,scoring:{coverage:.9}}});
  }
  if(endpoint.endsWith('decision-flow'))return r.fulfill({json:{ok:true,bot:'short',timeframe:'15m',generated_at:await page.evaluate(()=>Date.now()/1000),market_scan:[],traderouter:candidate?{state:'FAIL',macro:{available:true,fresh:true,source_score_0_100:20,report_date:'2026-10-03'},macro_direction:'REJECT',entry_veto:'ACTIVE'}:{state:'UNAVAILABLE'},final_decision:{state:candidate?'BLOCKED BY MACRO':signal?'UNKNOWN':'NO SIGNAL'}}});
  return r.fulfill({status:503});
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/demo/15minbot/');
 await page.waitForFunction(()=>document.querySelector('#intelligence .node-main').textContent==='NOT REQUIRED');
 const panel=page.locator('#intelligence');
 assert.match(await panel.innerText(),/Macro data\s+AVAILABLE/);assert.match(await panel.innerText(),/53.2 \/ 100/);assert.match(await panel.innerText(),/2026-10-04/);assert.match(await panel.innerText(),/does not verify a bot entry check/);
 assert.equal(reportPaths[0],'/api/reports/macro/2026-10-04','Before 7 am use the previous reporting cycle');
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await panel.screenshot({path:path.join(os.tmpdir(),'rrr-macro-panel-'+width+'.png')});}
 reportState='stale';await page.evaluate(()=>loadDecisionFlow());assert.match(await panel.innerText(),/Macro data\s+STALE/);assert(!/53.2/.test(await panel.innerText()));
 reportState='outage';await page.evaluate(()=>loadDecisionFlow());assert.match(await panel.innerText(),/Macro data\s+UNAVAILABLE/);assert(!/53.2/.test(await panel.innerText()));
 reportState='empty';await page.evaluate(()=>loadDecisionFlow());assert.match(await panel.innerText(),/Macro data\s+UNAVAILABLE/);
 reportState='available';candidate=true;await page.evaluate(()=>loadDecisionFlow());assert.equal(await panel.locator('.node-main').innerText(),'FAIL');assert.match(await panel.innerText(),/20 \/ 100/);assert(!/53.2/.test(await panel.innerText()));assert.match(await panel.innerText(),/Recorded candidate context only/);
 candidate=false;signal=true;await page.evaluate(()=>loadDecisionFlow());assert.equal(await panel.locator('.node-main').innerText(),'UNKNOWN');assert.match(await panel.innerText(),/53.2 \/ 100/);
 signal=false;await page.clock.setFixedTime(new Date('2026-10-05T07:01:00+10:00'));await page.evaluate(()=>loadDecisionFlow());assert.match(await panel.innerText(),/Macro data\s+STALE/);assert.equal(reportPaths.at(-1),'/api/reports/macro/today');
 reportState='today';await page.evaluate(()=>loadDecisionFlow());assert.match(await panel.innerText(),/Macro data\s+AVAILABLE/);assert.deepEqual(errors,[]);
 console.log('PASS macro panel: no signal, saved report, before/after 7 am rollover, stale/null/outage/recovery, preserved candidate context, unknown admission and desktop/mobile layouts.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});

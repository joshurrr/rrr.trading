const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
async function run(){
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let file=path.join(__dirname,url.pathname);if(url.pathname.endsWith('/'))file=path.join(file,'index.html');fs.readFile(file,(e,d)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(d);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage(),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));let stale=false,failed=false,wrong=false;
 await page.route('https://stream.radiorrr.com/**',r=>r.abort());
 await page.route('https://api.rrr.trading/**',r=>{
  const endpoint=new URL(r.request().url()).pathname;calls.push(endpoint);
  if(endpoint==='/score')return r.fulfill({json:{assets:[]}});
  if(endpoint==='/api/market-summary')return r.fulfill({json:{currency:'USD',markets:[]}});
  if(endpoint==='/api/demos/short/decision-flow')return r.fulfill({status:404,json:{detail:'Not found'}});
  if(endpoint!=='/api/demos/short/status'||failed)return r.fulfill({status:503});
  const trade={pair:'ETH/USDT:USDT',direction:'SHORT',open_rate:100,current_rate:101,close_rate:98,stake_amount:1000,profit_abs:20,profit_pct:2,open_date:'2026-10-04 02:00:00',close_date:'2026-10-04 03:00:00',exit_reason:'roi',entry_tag:'private-strategy-debug'};
  return r.fulfill({json:{ok:true,demo:wrong?'long':'short',generated_at:Date.now()/1000-(stale?90:0),bot:{timeframe:wrong?'4h':'15m',strategy:wrong?'Long Term 4hr':'Short Term 15m',mode:'PAPER',state:'RUNNING',exchange:'bybit',stake_currency:'USDT',trading_mode:'futures',margin_mode:'isolated',short_allowed:true,stake_amount:'1000',max_open_trades:4,started_at:Date.now()/1000-3600,pairs:['ETH/USDT:USDT']},portfolio:{starting_balance:10000,profit_all_abs:20,profit_all_pct:.2,max_drawdown:0,winning_trades:6,losing_trades:19,closed_trades:2},open_trades:[trade],history:[trade]}});
 });
 const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/demo/short/?source=bookmark#settings');
 assert.equal(new URL(page.url()).pathname,'/demo/15minbot/');assert.equal(new URL(page.url()).search,'?source=bookmark');assert.equal(new URL(page.url()).hash,'#settings');
 await page.waitForFunction(()=>document.querySelector('#bot-state').textContent==='RUNNING'&&document.querySelector('#flow-status').textContent.includes('UNAVAILABLE'));
 assert.equal(await page.title(),'RRR.Trading · 15min bot - Live demo');assert.equal(await page.locator('h1').innerText(),'15min bot - Live demo');
 assert.equal(await page.locator('#demo-options [data-selected]').getAttribute('data-demo'),'short');assert.equal(await page.locator('.tabs [aria-current]').getAttribute('href'),'/demo/15minbot/');
 assert.match(await page.locator('#strategy-flow-title').innerText(),/15-minute pullbacks/);assert.match(await page.locator('#daily .node-title').innerText(),/1-hour Trend Confirmation/);
 assert.match(await page.locator('#flow').innerText(),/trend confirmed by closed 1-hour candles/);
 assert.equal(await page.locator('#final .big').innerText(),'UNKNOWN');assert.equal(await page.locator('#completed').innerText(),'2','Short feed completed count');
 assert.match(await page.locator('#completed-trades').innerText(),/Profit target/);assert.match(await page.locator('#asset-cards').innerText(),/ETH/);assert(!/private-strategy-debug/.test(await page.locator('main').innerText()));
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow '+width);await page.screenshot({path:path.join(os.tmpdir(),'rrr-15minbot-'+width+'.png'),fullPage:true});}
 stale=true;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('#bot-state').innerText(),'STALE');assert.equal(await page.locator('#settings.stale').count(),1);assert.equal(await page.locator('#completed-trades tr').count(),0);
 stale=false;wrong=true;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('#bot-state').innerText(),'UNAVAILABLE');
 wrong=false;failed=true;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('#bot-state').innerText(),'UNAVAILABLE');
 failed=false;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('#bot-state').innerText(),'RUNNING');assert.equal(await page.locator('#completed-trades tr').count(),1);
 assert(calls.includes('/api/demos/short/status'));assert(!calls.some(p=>p.includes('/long/')||p.includes('/medium/')||p==='/status'),'15 min page must not load another bot feed');assert.deepEqual(errors,[]);
 console.log('PASS 15MINBOT: migration redirect, 15 min-only status feed, unavailable diagnostics, strategy descriptions, completed count, history/assets, stale/outage/wrong-feed/recovery and four responsive widths.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
module.exports=run;if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});

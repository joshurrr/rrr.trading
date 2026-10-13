'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
  const server=http.createServer((req,res)=>{
    let file=path.join(__dirname,new URL(req.url,'http://local').pathname);if(file.endsWith(path.sep))file+='index.html';
    fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/radio-navigation.js*',r=>r.fulfill({contentType:'application/javascript',body:''}));
    await page.route('https://stream.radiorrr.com/**',r=>r.abort());
    const started=new Date(Date.now()-60000).toISOString(),run_id='v2-paper-clean-fixture';
    await page.route('https://api.rrr.trading/**',r=>{
      const p=new URL(r.request().url()).pathname;
      if(p.endsWith('/execution/health'))return r.fulfill({json:{run_id,started_at:started,mode:'PAPER',stale:false,status:'available',enabled:true,last_run:new Date().toISOString()}});
      if(p.endsWith('/reporting'))return r.fulfill({json:{available:true,run_id,started_at:started,observed_at:new Date().toISOString(),portfolio:{closed_trades:0,profit_closed_abs:0,winning_trades:0,losing_trades:0,win_rate:null,profit_open_abs:0,max_drawdown:0},history:[],open_trades:[]}});
      if(p.endsWith('/status'))return r.fulfill({json:{ok:true,generated_at:Date.now()/1000,bot:{mode:'PAPER',state:'RUNNING',stake_currency:'USDT',timeframe:p.includes('/short/')?'15m':p.includes('/long/')?'4h':'1h',pairs:[]},open_trades:[{id:99,pair:'OLDCOIN/USDT:USDT',open_date:'2025-01-01T00:00:00Z',profit_abs:999}],history:[{id:99,pair:'OLDCOIN/USDT:USDT',open_date:'2025-01-01T00:00:00Z',close_date:new Date().toISOString(),profit_abs:999}],portfolio:{closed_trades:99}}});
      return r.fulfill({status:503,json:{}});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(()=>document.querySelector('[data-performance="realized"]')?.textContent==='0.00 USDT');
    assert.equal(await page.locator('[data-performance="open"]').innerText(),'0');
    assert.equal(await page.locator('[data-performance="closed"]').innerText(),'0');
    assert.equal(await page.locator('[data-performance="wins"]').innerText(),'N/A');
    assert((await page.locator('[data-paper-run-start]').innerText()).includes(run_id));
    assert(!(await page.locator('#homepage-activity-summary').innerText()).includes('OLDCOIN'));
    for(const width of [320,375,768,1440]){
      await page.setViewportSize({width,height:900});
      assert(await page.locator('#activity-performance').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
      await page.locator('#live-candidate-progress').screenshot({path:`.runtime/clean-paper-run-${width}.png`});
    }
    assert.deepEqual(errors,[]);
    console.log('PASS homepage clean-run zero, old native data exclusion, run start and four widths');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});

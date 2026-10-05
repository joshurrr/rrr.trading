const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
async function run(){
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.join(__dirname,pathname.endsWith('/')?pathname+'index.html':pathname);
  if(!file.startsWith(__dirname+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [key,folder,timeframe,strategy] of [['short','15minbot','15m','Short Term 15m'],['medium','1hrbot','1h','Medium 1hr'],['long','4hrbot','4h','Long Term 4hr']]){
   const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   let mode='fresh';
   const history=[10,-5,0,null].map((profit_abs,i)=>({pair:['BTC','ETH','SOL','LINK'][i]+'/USDT:USDT',direction:i%2?'SHORT':'LONG',open_rate:123456.78,close_rate:123457.89,profit_abs,profit_pct:profit_abs===null?null:profit_abs/10,exit_reason:['roi','stop_loss','force_exit','exit_signal'][i],close_date:'2026-10-04 02:00:43'}));
   await page.route('https://stream.radiorrr.com/**',r=>r.abort());
   await page.route('https://api.rrr.trading/**',r=>{
    const endpoint=new URL(r.request().url()).pathname;
    if(!endpoint.endsWith('/status')||mode==='failed')return r.fulfill({status:503,json:{ok:false}});
    return r.fulfill({json:{ok:true,demo:key,generated_at:Date.now()/1000-(mode==='stale'?90:0),bot:{strategy,timeframe,mode:'PAPER',state:'RUNNING',exchange:'bybit',stake_currency:'USDT',trading_mode:'futures',margin_mode:'isolated',short_allowed:true},portfolio:{},open_trades:[{...history[0],current_rate:123458,open_date:'2026-10-04 01:00:43',stake_amount:1000}],...(mode==='missing'?{}:{history:mode==='empty'?[]:history})}});
   });
   await page.goto('http://127.0.0.1:'+server.address().port+'/demo/'+folder+'/');
   await page.waitForFunction(()=>document.getElementById('bot-state').textContent==='RUNNING');
   assert.equal(await page.locator('#completed-trades').count(),1);
   assert.equal(await page.getByRole('heading',{name:'Recent completed trades',exact:true}).count(),1);
   assert.equal(await page.locator('#open-trades tr').count(),1);
   assert.equal(await page.locator('#completed-trades tr').count(),4);
   assert.deepEqual(await page.locator('#completed-trades tr td:first-child').allTextContents(),['BTC/USDT','ETH/USDT','SOL/USDT','LINK/USDT']);
   assert.deepEqual(await page.locator('#completed-trades .trade-pnl').allTextContents(),['10.00 USDT (+1.00%)','-5.00 USDT (-0.50%)','0.00 USDT (0.00%)','— ']);
   assert.deepEqual(await page.locator('#completed-trades tr td:nth-child(6)').allTextContents(),['Profit target','Stop loss','Manual close','Strategy exit']);
   const closed=await page.evaluate(()=>new Date('2026-10-04T02:00:43Z').toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' Brisbane');
   assert((await page.locator('#completed-trades tr td:nth-child(7)').allTextContents()).every(t=>t===closed));
   const colors=await page.locator('#completed-trades tr').evaluateAll(rows=>rows.map(row=>({color:getComputedStyle(row.querySelector('.trade-pnl')).color,bg:getComputedStyle(row).backgroundColor})));
   assert.equal(colors[0].color,'rgb(46, 232, 155)');assert.equal(colors[1].color,'rgb(255, 107, 107)');assert.equal(colors[2].color,colors[3].color);assert.equal(colors[2].bg,'rgba(0, 0, 0, 0)');
   for(const width of [320,390,768,1280,1440]){
    await page.setViewportSize({width,height:1000});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),key+' page overflow at '+width);
    assert(await page.evaluate(()=>{
     const open=document.querySelector('.open-trades-section'),closed=document.querySelector('.completed-trades-section');
     const a=open.getBoundingClientRect(),b=closed.getBoundingClientRect(),panel=closed.querySelector('.panel').getBoundingClientRect();
     return open.nextElementSibling===closed&&a.bottom<=b.top&&Math.abs(a.x-b.x)<1&&Math.abs(a.width-b.width)<1&&Math.abs(panel.width-b.width)<1&&!!(closed.compareDocumentPosition(document.getElementById('flow'))&Node.DOCUMENT_POSITION_FOLLOWING);
    }),key+' placement and full card width');
    if(width>=1280)assert(await page.locator('.completed-trades-section .tablewrap').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'No desktop table scrollbar');
    if(width===390||width===1440)await page.locator('.completed-trades-section').screenshot({path:path.join(os.tmpdir(),'rrr-completed-'+key+'-'+width+'.png')});
   }
   for(mode of ['stale','failed','missing','empty','fresh']){
    await page.evaluate(()=>loadDecisionFlow());
    assert.equal(await page.locator('#completed-trades tr').count(),mode==='fresh'?4:0);
    if(['stale','failed','missing'].includes(mode))assert.match(await page.locator('#completed-status').innerText(),mode==='stale'?/STALE/:/UNAVAILABLE/);
   }
   assert.deepEqual(errors,[]);await page.close();
   console.log('PASS '+key+': completed trade placement, width, preserved data, profit/loss/zero/missing styles, five widths, stale/outage/empty/recovery.');
  }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports=run;

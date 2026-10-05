const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
async function run(base){
 let server;
 if(!base){
  server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://localhost').pathname);if(file.endsWith(path.sep))file=path.join(file,'index.html');fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 }
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const bot of ['15minbot','1hrbot','4hrbot']){
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://api.rrr.trading/**',r=>r.fulfill({status:503}));
   await page.route('https://stream.radiorrr.com/**',r=>r.abort());
   await page.goto(base+'/demo/'+bot+'/');
   await page.waitForFunction(()=>window.renderAssetBranches&&window.intelligenceWording&&document.querySelector('#flow-status').textContent.includes('UNAVAILABLE'));
   const evidence=await page.evaluate(()=>{
    const timestamp=new Date(Date.now()-60000).toISOString();
    const tr=Object.freeze({state:'FAIL-OPEN',entry_veto:'UNKNOWN',macro:Object.freeze({source_score_0_100:53.2})});
    const d=Object.freeze({technical:Object.freeze({pair:'XRP/USDT:USDT',timestamp}),traderouter:tr,market_scan:Object.freeze([Object.freeze({pair:'XRP/USDT:USDT',timestamp,state:'OPEN'}),Object.freeze({pair:'ETH/USDT:USDT',timestamp,state:'SIGNAL'})])});
    window.wordingFixture=d;const before=JSON.stringify(d);window.renderAssetBranches(d);return [before,JSON.stringify(d)];
   });
   assert.equal(evidence[0],evidence[1],'Frozen raw evidence is unchanged');
   const card=page.locator('[data-stage=intelligence] [data-pair="XRP/USDT:USDT"]');
   assert.match(await card.innerText(),/TradeRouter decision\s+Allowed/);
   assert.match(await card.innerText(),/Block decision\s+Not confirmed/);
   assert.match(await card.innerText(),/Recorded macro score\s+53.2/);
   assert.match(await card.innerText(),/Trade was allowed because no confirmed intelligence rule blocked it\. Some supporting intelligence data was incomplete or unavailable\./);
   if(bot==='15minbot')assert.equal(await card.locator('.node-main').innerText(),'Allowed — intelligence data incomplete');
   else assert.equal(await card.locator('.node-main').innerText(),'Not confirmed','Separate guard outcome remains unconfirmed');
   assert.doesNotMatch(await page.locator('body').innerText(),/FAIL-OPEN|Recorded entry filter|Entry veto|Block decision\s+UNKNOWN/);
   assert.match(await page.locator('[data-stage=intelligence] [data-pair="ETH/USDT:USDT"]').innerText(),/TradeRouter decision\s+Not confirmed/,'No reuse of another asset evidence');
   assert.equal(await card.evaluate(n=>n.matches('.block,.bad')||!!n.querySelector('.bad')),false);
   for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:1000});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page fits '+bot+' '+width);
    assert(await card.evaluate(n=>[n,...n.querySelectorAll('.mini,.node-main,.why')].every(el=>el.scrollWidth<=el.clientWidth+1)),'Card content fits '+bot+' '+width);
    if(width===390||width===1440)await page.locator('[data-stage=intelligence]').screenshot({path:path.join(os.tmpdir(),'rrr-wording-'+bot+'-'+width+'.png')});
   }
   for(const raw of ['PASS','BLOCKED','UNKNOWN']){
    await page.evaluate(raw=>window.renderAssetBranches({...window.wordingFixture,traderouter:{state:raw,entry_veto:raw==='BLOCKED'?'ACTIVE':'UNKNOWN'}}),raw);
    assert.match(await card.innerText(),new RegExp('TradeRouter decision\\s+'+(raw==='UNKNOWN'?'Not confirmed':raw)));
    assert.doesNotMatch(await card.innerText(),/Trade was allowed because/);
   }
   await page.evaluate(()=>{window.renderAssetBranches(window.wordingFixture);window.assetFlowUnavailable('STALE');});
   assert.equal(await card.locator('.node-main').innerText(),'STALE');
   assert.match(await card.innerText(),/Previous observation retained · not current/);
   await page.evaluate(()=>window.assetFlowUnavailable('UNAVAILABLE'));
   assert.equal(await card.locator('.node-main').innerText(),'UNAVAILABLE');
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS Stage 4 wording: all three pages, immutable evidence, exact mappings and explanation, separate guard uncertainty, pass/block/missing states, stale/unavailable states and four responsive widths.');
 }finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
}
module.exports=run;if(require.main===module)run(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1;});

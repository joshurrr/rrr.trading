// Homepage-only layout and saved research fixtures; no live trading calls.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
function fixture(size=9){
  const at=new Date(Date.now()-1000).toISOString(),end=new Date(Date.now()+600000).toISOString();
  const section={state:'CURRENT',source_at:at,observed_at:at,expires_at:end};
  const list=side=>({...section,items:Array.from({length:size},(_,i)=>({...section,side,symbol:['BTC','ETH','SOL','XRP','ADA','DOGE','AVAX','LINK','DOT'][i]+'USDT',exchange:'bybit',rank:i+1,timeframe:'1h',momentum_support:'FAVOURS',return_pct:side==='LONG'?9-i:i-9,decision:{outcome:'WAIT'}}))});
  return {version:'paper-read-api-v1',mode:'paper',served_at:at,overview:{version:'paper-overview-v1',purpose:'PUBLIC_SAVED_OBSERVATIONS_ONLY',research:{...section,status:'OK',counts:{assets_evaluated_for_ranking:20}},shortlists:{LONG:list('LONG'),SHORT:list('SHORT')}}};
}
(async()=>{
  const server=http.createServer((req,res)=>{const f=path.resolve(__dirname,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!f.startsWith(__dirname+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(b);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage(),errors=[],requests=[];let data=fixture(),fail=false;
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/radio-navigation.js*',r=>r.fulfill({body:''}));await page.route('https://stream.radiorrr.com/**',r=>r.abort());await page.route('https://api.rrr.trading/**',r=>r.fulfill({status:503}));
    await page.route('https://assets.coincap.io/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="48" fill="#67dcf2"/></svg>'}));
    await page.route('https://v4.rrr.trading/**',r=>{requests.push(r.request().url());assert.equal(r.request().method(),'GET');assert.equal(new URL(r.request().url()).pathname,'/v4/paper');return fail?r.fulfill({status:503}):r.fulfill({json:data});});
    await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#v4-overview').getAttribute('aria-busy')==='false');assert.equal(requests.length,1);
    const area=page.locator('.v4-opportunities'),activity=page.locator('#market-research-activity');
    assert.equal(await area.locator('h3').innerText(),'Market Opportunities');assert.match(await area.innerText(),/Continuous market research identifying potential trading opportunities/);
    assert.match(await activity.innerText(),/AVAILABLE · 20 assets assessed · Updated .* AEST · CURRENT/);assert.doesNotMatch(await activity.innerText(),/ACTIVE/);
    for(const side of ['LONG','SHORT']){const cards=page.locator('#v4-'+side.toLowerCase()+'-opportunities > article');assert.equal(await cards.count(),9);assert.deepEqual(await cards.locator('.universe-rank').allTextContents(),Array.from({length:9},(_,i)=>'#'+(i+1)));}
    const track=page.locator('#v4-long-opportunities'),cards=track.locator('.candidate-portrait');
    for(const width of [1440,1280,768,390,320]){
      await page.setViewportSize({width,height:1000});await track.evaluate(n=>n.scrollLeft=0);await page.waitForTimeout(250);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+width);
      if(width>=1280){const bounds=await track.evaluate(n=>{const r=n.getBoundingClientRect();return [...n.children].filter(c=>c.getBoundingClientRect().right<=r.right+1).length;});assert.equal(bounds,5,'five complete desktop cards');}
      const next=page.locator('.v4-shortlist-side').first().getByRole('button',{name:'Next assets'});await next.click();await page.waitForFunction(()=>document.querySelector('#v4-long-opportunities').scrollLeft>0);
      await track.focus();await page.keyboard.press('End');await track.evaluate(n=>n.scrollTo({left:n.scrollWidth,behavior:'instant'}));assert(await cards.last().evaluate(n=>{const r=n.getBoundingClientRect(),p=n.parentElement.getBoundingClientRect();return r.right<=p.right+1;}));
      await track.evaluate(n=>n.scrollLeft=0);await page.waitForTimeout(300);
      const label=await cards.first().locator('.candidate-score-label').boundingBox(),trend=await cards.first().locator('.universe-trend').boundingBox();assert(label.y+label.height<=trend.y+1,'no label overlap');
      fs.mkdirSync('.runtime/homepage-opportunities',{recursive:true});await area.screenshot({path:'.runtime/homepage-opportunities/'+width+'.png'});
    }
    await cards.first().locator('button').focus();await page.keyboard.press('Enter');await page.locator('#asset-intelligence-dialog').waitFor({state:'visible'});assert.match(await page.locator('#asset-intelligence-dialog').innerText(),/BTCUSDT/);await page.keyboard.press('Escape');
    const evidence=cards.first().locator('.candidate-evidence');await evidence.locator('summary').click();assert(await evidence.evaluate(n=>n.open));assert.match(await evidence.innerText(),/Source:.*AEST.*Expires:/);assert.match(await evidence.innerText(),/research only, not trade approval/);
    const artwork=()=>cards.first().locator('.candidate-art').evaluate(n=>({background:getComputedStyle(n).backgroundImage,overlay:getComputedStyle(n,'::before').backgroundImage,logoFilter:getComputedStyle(n.querySelector('img')).filter,candles:n.querySelectorAll('.candidate-chart > span').length}));
    const before=await artwork();assert.match(before.background,/radial-gradient/);assert.equal(before.candles,12);assert.match(before.logoFilter,/drop-shadow/);
    await page.evaluate(()=>{const link=document.querySelector('link[href*="homepage-layout.css"]');for(const sheet of document.styleSheets)if(sheet.ownerNode===link){const css=[...sheet.cssRules].map(r=>r.cssText);const start=css.findIndex(t=>t.includes('.v4-opportunities .v4-card-heading'));while(sheet.cssRules.length>start && start>=0)sheet.deleteRule(start);}});
    assert.deepEqual(await artwork(),before,'artwork unchanged by Task 4 rules');
    const refresh=()=>page.evaluate(()=>refreshV4Overview());
    data=fixture(2);await refresh();assert.equal(await cards.count(),2,'no fillers');
    data.overview.research.state='STALE';data.overview.shortlists.LONG.state='STALE';await refresh();assert.match(await activity.innerText(),/RESEARCH STALE/);assert.match(await page.locator('.v4-shortlist-side > h4').first().innerText(),/STALE/);
    data=fixture(0);data.overview.research.counts.assets_evaluated_for_ranking=0;await refresh();assert.match(await activity.innerText(),/0 assets assessed/);assert.equal(await cards.count(),0);
    data=fixture(2);data.overview.research.status='ATTENTION';await refresh();assert.match(await activity.innerText(),/RESEARCH ATTENTION/);
    data.overview.research.expires_at=new Date(Date.now()+1100).toISOString();await refresh();await page.waitForFunction(()=>document.querySelector('#market-research-activity').dataset.state==='STALE');
    fail=true;await refresh();assert.match(await activity.innerText(),/RESEARCH UNAVAILABLE/);assert.equal(await cards.count(),0);assert.deepEqual(errors,[]);
    console.log('PASS: five desktop cards, nine genuine ranked fixtures per side with scrolling, modal/evidence, preserved artwork, no fillers, current/attention/stale/zero/unavailable states and five widths.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

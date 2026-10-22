// Focused local fixtures: no live accounts or trading actions.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const fixture=()=>{
  const at=new Date().toISOString(),end=new Date(Date.now()+600000).toISOString();
  const position=(symbol,side,pnl)=>({symbol,side,exchange:'bybit',availability:'AVAILABLE',entry_price:'100',current_mark:'102',leverage:'2',unrealized_pnl:pnl,entered_at:new Date(Date.now()-3600000).toISOString(),mark_observed_at:at,mark_expires_at:end,last_known_mark:'101',last_known_unrealized_pnl:'1'});
  return {version:'paper-read-api-v1',mode:'paper',served_at:at,
    overview:{version:'paper-overview-v1',purpose:'PUBLIC_SAVED_OBSERVATIONS_ONLY'},
    open_positions:{availability:'AVAILABLE',items:[position('BTCUSDT','SHORT','2.50'),position('ETHUSDT','LONG','-1.25')]},
    wallet:{availability:'AVAILABLE',as_of:at,wallet_balance:'10102.01',equity:'10123.87',realized_pnl:'107.62',unrealized_pnl:'1.25',
      field_availability:{wallet_balance:'AVAILABLE',equity:'AVAILABLE',realized_pnl:'AVAILABLE',unrealized_pnl:'AVAILABLE'},
      valuation_expires_at:end,last_known:{equity:'10120.00',unrealized_pnl:'1.00'}}};
};
(async()=>{
  const server=http.createServer((req,res)=>{const f=path.resolve(__dirname,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!f.startsWith(__dirname+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(b);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage(),errors=[],requests=[];let data=fixture(),fail=false;
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/radio-navigation.js*',r=>r.fulfill({body:''}));
    await page.route('https://stream.radiorrr.com/**',r=>r.abort());
    await page.route('https://api.rrr.trading/**',r=>r.fulfill({status:503}));
    await page.route('https://assets.coincap.io/**',r=>r.abort());
    await page.route('https://v4.rrr.trading/**',r=>{requests.push(r.request().url());assert.equal(r.request().method(),'GET');assert.equal(new URL(r.request().url()).pathname,'/v4/paper');return fail?r.fulfill({status:503}):r.fulfill({json:data});});
    await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#v4-overview').getAttribute('aria-busy')==='false');
    assert.equal(requests.length,1,'positions reuse the overview fetch');
    const cards=page.locator('.home-position');
    assert.equal(await cards.count(),2);
    assert.equal(await page.locator('#home-position-count').innerText(),'2');
    assert.equal(await page.locator('#home-position-pnl').innerText(),'1.25 USDT');
    assert.equal(await page.locator('#home-equity').innerText(),'10,123.87 USDT');
    assert.match(await page.locator('#home-equity-note').innerText(),/Valuation saved .*AEST/);
    assert.equal(await page.locator('#home-wallet-balance').innerText(),'10,102.01 USDT');
    assert.equal(await page.locator('#home-wallet-realized').innerText(),'107.62 USDT');
    assert.equal(await cards.first().locator('.home-position-profit').getAttribute('data-pnl'),'profit','profitable SHORT is green');
    assert.equal(await cards.nth(1).locator('.home-position-profit').getAttribute('data-pnl'),'loss','losing LONG is red');
    assert.match(await cards.first().innerText(),/UNKNOWN/);
    assert.match(await cards.first().innerText(),/2×/);assert.match(await cards.first().innerText(),/1h 0m/);
    assert.match(await page.locator('#home-position-time').innerText(),/AEST/);
    data.open_positions.items[0].protection={status:'PROTECTED',original_stop:'110',active_stop:'95',estimated_stop_pnl_usdt:'10',
      latest_decision:'PROTECT',review_result:'STOP_ADJUSTED',last_successful_review_at:data.served_at};
    data.open_positions.items[1].protection={status:'ORIGINAL STOP',original_stop:'95',active_stop:'95',estimated_stop_pnl_usdt:'-10',
      latest_decision:'PROTECT',review_result:'BLOCKED',last_successful_review_at:data.served_at};
    await page.evaluate(()=>refreshV4Overview());
    assert.match(await cards.first().innerText(),/PROTECTED/);
    assert.match(await cards.first().innerText(),/Luna PROTECT.*applied/);
    assert.match(await cards.nth(1).innerText(),/proposal rejected/);
    await page.addStyleTag({content:'#home #home-demo-positions .home-protection-details{display:block!important}'});
    await cards.first().locator('.home-protection-details summary').click();
    assert.match(await cards.first().innerText(),/10.00 USDT/);
    assert.match(await cards.first().innerText(),/before fees and slippage/);
    assert.match(await cards.first().innerText(),/110/);
    for(const width of [1440,768,390,320]){
      await page.setViewportSize({width,height:1000});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+width);
      assert(await cards.first().locator('.home-position-monogram').isVisible(),'logo failure fallback');
      fs.mkdirSync('.runtime/homepage-positions',{recursive:true});
      await page.locator('#home-demo-positions').screenshot({path:'.runtime/homepage-positions/'+width+'.png'});
    }
    const refresh=async()=>page.evaluate(()=>refreshV4Overview());
    data=fixture();data.open_positions.items[0].protection={status:'ORIGINAL STOP',latest_decision:'PROTECT',review_result:'RECOMMENDATION_ONLY'};
    await refresh();assert.match(await cards.first().innerText(),/recommendation only/);assert.doesNotMatch(await cards.first().innerText(),/PROTECTED/);
    await cards.first().locator('.home-protection-details summary').click();assert.match(await cards.first().innerText(),/UNKNOWN/);
    data=fixture();data.open_positions.items=[];data.wallet.unrealized_pnl='0';await refresh();
    assert.equal(await page.locator('#home-position-count').innerText(),'0');assert.match(await page.locator('#home-position-list').innerText(),/^No Open Demo Positions$/);assert.equal(await page.locator('#home-position-pnl').innerText(),'0.00 USDT');
    data.open_positions.availability='STALE';await refresh();assert.doesNotMatch(await page.locator('#home-position-list').innerText(),/No Open Demo Positions/);assert.match(await page.locator('#home-position-list').innerText(),/Current positions unknown/);
    data=fixture();data.open_positions={availability:'UNAVAILABLE'};await refresh();assert.equal(await page.locator('#home-position-list').innerText(),'Positions Unavailable');
    data=fixture();data.open_positions.items={};await refresh();assert.equal(await cards.count(),0);assert.equal(await page.locator('#home-position-count').innerText(),'Unavailable');
    data=fixture();data.wallet.valuation_expires_at=new Date(Date.now()-1).toISOString();await refresh();
    assert.equal(await page.locator('#home-equity').innerText(),'Unavailable');assert.match(await page.locator('#home-equity-note').innerText(),/STALE · Last known: 10,120.00 USDT/);
    assert.equal(await page.locator('#home-wallet-balance').innerText(),'10,102.01 USDT','ledger balance remains separately available');
    data=fixture();data.open_positions.items[0].mark_expires_at=new Date(Date.now()-1).toISOString();await refresh();
    assert.equal(await page.locator('#home-positions-state').innerText(),'STALE');assert.equal(await page.locator('#home-position-pnl').innerText(),'Unavailable');assert.match(await cards.first().innerText(),/Last known: 101/);
    data=fixture();data.wallet.field_availability.unrealized_pnl='STALE';await refresh();assert.equal(await page.locator('#home-position-pnl').innerText(),'Unavailable');assert.match(await page.locator('#home-position-valuation').innerText(),/STALE/);
    data=fixture();data.wallet.unrealized_pnl=false;data.open_positions.items[0].unrealized_pnl='';data.open_positions.items[0].entered_at=null;await refresh();assert.equal(await page.locator('#home-position-pnl').innerText(),'Unavailable');assert.equal(await cards.first().locator('.home-position-profit dd').innerText(),'Unavailable');
    data=fixture();data.open_positions.items[0].symbol='<img src=x onerror="window.BAD=1">';await refresh();assert.equal(await page.evaluate(()=>window.BAD),undefined);assert.match(await cards.first().locator('h3').innerText(),/<img/);
    for(const scope of ['root','nested']){data=fixture();if(scope==='root')data.mode='live';else data.open_positions.items[0].mode='live';await refresh();assert.equal(await page.locator('#home-position-list').innerText(),'Positions Unavailable');}
    data=fixture();data.open_positions.items[0].mark_expires_at=new Date(Date.now()+1100).toISOString();await refresh();await page.waitForFunction(()=>document.querySelector('#home-positions-state').textContent==='STALE');
    fail=true;await refresh();assert.equal(await page.locator('#home-position-list').innerText(),'Positions Unavailable');assert.equal(await cards.count(),0);
    assert.equal(await page.locator('#home-equity').innerText(),'Unavailable');assert.equal(await page.locator('#home-wallet-balance').innerText(),'Unavailable');
    assert.deepEqual(errors,[]);console.log('PASS: shared GET feed, source P/L and sign colours, zero/missing/stale/expiry/live rejection, safe text, logo fallback, four responsive widths.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

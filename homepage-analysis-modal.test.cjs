// Fixture-only browser regression for the shared detail renderer and homepage modal.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const keptScripts=['asset-logo.js','candidate-cards.js','homepage-positions.js','homepage-redesign.js','asset-analysis/asset-analysis.js','homepage-analysis-modal.js'];
(async()=>{
  const server=http.createServer((req,res)=>{
    let file=path.resolve(__dirname,'.'+new URL(req.url,'http://localhost').pathname);
    if(file!==__dirname&&!file.startsWith(__dirname+path.sep))return res.writeHead(403).end();
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    fs.readFile(file,(err,content)=>{
      if(err)return res.writeHead(404).end();
      // Keep the real homepage markup/styles and components; isolate unrelated feed owners.
      if(file===path.join(__dirname,'index.html'))content=content.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,tag=>keptScripts.some(src=>tag.includes('src="/'+src+'?'))?tag:'');
      res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(content);
    });
  });
  let browser;
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    browser=await chromium.launch({headless:true,channel:'msedge'});
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const now=new Date().toISOString(),expiry=new Date(Date.now()+3600000).toISOString();
    const row=(symbol,side,rank)=>({exchange:'bybit',symbol:symbol+'USDT',instrument_type:'linear_perpetual',side,rank,timeframe:'1h',observed_at:now,expires_at:expiry,state:'CURRENT',provenance:{cycle_started_at:now}});
    const rows=[row('BTC','LONG',1),row('SOL','SHORT',1)];
    const shortlists=Object.fromEntries(['LONG','SHORT'].map(side=>[side,{state:'CURRENT',observed_at:now,expires_at:expiry,items:rows.filter(r=>r.side===side),provenance:{cycle_started_at:now}}]));
    const asset=(selection,rsi)=>({identity:{exchange:'bybit',instrument_id:selection.symbol,instrument_type:'linear_perpetual'},selection,
      technical:Object.fromEntries(['15m','1h','4h'].map(tf=>[tf,{status:'ASSESSED',state:'CURRENT',timeframe:tf,expires_at:expiry,indicators:{rsi}}])),
      luna:{status:'AVAILABLE',assessment:{summary:selection.symbol+' saved intelligence'},timestamps:{timestamp:now,expires_at:expiry}},
      sol:{status:'AVAILABLE',records:[{decision:'NO_TRADE',timestamp:now,reasoning:selection.symbol+' saved SOL reasoning'}]},positions_status:'AVAILABLE',trades_status:'AVAILABLE',positions:[],trades:[]});
    const sui=asset(row('SUI','HISTORICAL',null),37);sui.historical_only=true;
    const payload={version:'asset-analysis-read-v1',mode:'paper',read_only:true,availability:'AVAILABLE',shortlists,assets:[sui,asset(rows[0],61),asset(rows[1],49)]};
    let apiCalls=0,hold=false,release=null,failed=false;
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='127.0.0.1')return route.continue();
      if(url.pathname==='/v4/asset-analysis'){
        apiCalls++;if(hold)await new Promise(resolve=>release=resolve);
        return failed?route.fulfill({status:503,body:'Unavailable'}):route.fulfill({json:payload});
      }
      if(url.pathname==='/v4/paper')return failed?route.fulfill({status:503,body:'Unavailable'}):route.fulfill({json:{version:'paper-read-api-v1',mode:'paper',overview:{shortlists}}});
      return route.abort();
    });
    const url='http://127.0.0.1:'+server.address().port+'/';
    async function loadHome(){
      await page.goto(url);
      await page.evaluate(({now,expiry})=>{
        HomeDemoPositions.render({version:'paper-read-api-v1',mode:'paper',served_at:now,open_positions:{availability:'AVAILABLE',items:['SUI','BTC','SOL'].map(symbol=>({symbol:symbol+'USDT',side:'LONG',exchange:'bybit',availability:'AVAILABLE',entered_at:now,mark_expires_at:expiry}))}});
        for(const [side,symbol] of [['LONG','BTC'],['SHORT','SOL']]){
          const section=document.createElement('section');section.dataset.side=side;
          const grid=document.createElement('div');grid.id='test-'+side;section.append(grid);document.getElementById('v4-overview').append(section);
          CandidateCards.reconcile(grid,[{symbol,asset:{direction:side},options:{}}]);
        }
      },{now,expiry});
    }
    const modal=page.locator('#homepage-analysis-modal'),close=page.getByRole('button',{name:'Close Asset Analysis',exact:true});
    const positions=page.locator('#home-position-list .home-position');
    const ready=()=>page.waitForFunction(()=>document.getElementById('asset-analysis-panel').getAttribute('aria-busy')==='false'&&!!document.getElementById('aa-detail-panel'));
    await loadHome();
    await positions.first().locator('summary').click();assert(await positions.first().locator('details').evaluate(el=>el.open));assert(await modal.isHidden());
    await positions.first().click({position:{x:15,y:15}});await ready();
    assert.equal(await page.locator('#homepage-analysis-title').innerText(),'SUI — Asset Analysis');
    assert.equal(await modal.locator('[role="tab"]').count(),5);
    assert.equal(await modal.locator('iframe,[data-site-header],nav,footer,.aa-card,#asset-analysis-summary,#asset-analysis-evidence').count(),0);
    assert.equal(page.url(),url);assert.equal(await modal.evaluate(el=>el.classList.contains('is-open')),true);
    for(const [tab,expected] of [['Overview','Market price'],['Technical Analysis','37'],['News & Intelligence','SUIUSDT saved intelligence'],['AI Decisions','SUIUSDT saved SOL reasoning'],['Trade History','AI recommendation']]){
      await modal.getByRole('tab',{name:tab,exact:true}).click();assert.match(await modal.locator('#asset-analysis-detail').innerText(),new RegExp(expected));
    }
    await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});assert(await positions.first().evaluate(el=>document.activeElement===el));
    await page.locator('#test-LONG button').click();await ready();assert.match(await modal.locator('#asset-analysis-panel-title').textContent(),/BTC/);
    await modal.getByRole('tab',{name:'AI Decisions',exact:true}).click();assert.match(await modal.locator('#asset-analysis-detail').innerText(),/BTCUSDT saved SOL reasoning/);assert.doesNotMatch(await modal.locator('#asset-analysis-detail').innerText(),/SUIUSDT saved SOL reasoning/);
    // Focus stays in the modal in both directions.
    await close.focus();await page.keyboard.press('Shift+Tab');assert(await modal.evaluate(el=>el.contains(document.activeElement)));
    await close.click();await modal.waitFor({state:'hidden'});
    await page.locator('#test-SHORT button').click();await ready();assert.match(await modal.locator('#asset-analysis-panel-title').textContent(),/SOL/);
    assert.equal(apiCalls,1,'Reopening assets should reuse the verified snapshot');
    await modal.locator('[data-analysis-dismiss]').click({position:{x:2,y:2}});await modal.waitFor({state:'hidden'});
    await positions.nth(1).focus();await page.keyboard.press('Enter');await ready();assert.match(await modal.locator('#asset-analysis-panel-title').textContent(),/BTC/);
    await modal.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished)));
    for(const width of [1440,768,390,320]){
      await page.setViewportSize({width,height:900});
      assert(await modal.evaluate(el=>{const d=el.querySelector('.homepage-analysis-dialog'),b=el.querySelector('.homepage-analysis-body'),r=d.getBoundingClientRect();return r.width<=innerWidth&&b.scrollWidth<=b.clientWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}),'Modal bounds at '+width);
    }
    await close.click();await modal.waitFor({state:'hidden'});
    await page.emulateMedia({reducedMotion:'reduce'});await positions.first().click({position:{x:15,y:15}});await ready();assert.equal(await modal.evaluate(el=>getComputedStyle(el).transitionDuration),'0s');await close.click();await modal.waitFor({state:'hidden'});
    // Resolve an outstanding shared response after switching to BTC: SUI must never replace it.
    hold=true;await loadHome();await positions.first().click({position:{x:15,y:15}});
    assert.match(await modal.locator('#asset-analysis-detail').innerText(),/Loading/);
    await page.evaluate(()=>{document.querySelector('.homepage-analysis-close').click();document.querySelectorAll('#home-position-list .home-position')[1].click();});
    while(!release)await new Promise(resolve=>setTimeout(resolve,10));release();hold=false;await ready();
    assert.equal(await page.locator('#homepage-analysis-title').innerText(),'BTC — Asset Analysis');assert.match(await modal.locator('#asset-analysis-panel-title').textContent(),/BTC/);
    await close.click();await modal.waitFor({state:'hidden'});
    failed=true;await loadHome();await positions.first().click({position:{x:15,y:15}});
    await page.waitForFunction(()=>document.getElementById('asset-analysis-panel').getAttribute('aria-busy')==='false');assert.match(await modal.locator('#asset-analysis-detail').innerText(),/UNAVAILABLE/);assert.equal(await modal.locator('[role="tab"]').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: SUI/BTC/SOL detail only, five shared tabs, LONG/SHORT and position cards, protection expander, cached evidence, stale response prevention, keyboard/focus, X/backdrop/Escape, reduced motion, four viewport widths, unavailable state.');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(err=>{console.error(err);process.exitCode=1;});

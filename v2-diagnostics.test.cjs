const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const server = http.createServer((req,res) => {
  const name = new URL(req.url, 'http://local').pathname;
  const file = path.join(__dirname, name.endsWith('/') ? name + 'index.html' : name);
  if (!file.startsWith(__dirname + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err,data) => { if(err) return res.writeHead(404).end(); res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(data); });
});
(async () => {
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page = await browser.newPage(), errors = [], methods = [];
    page.on('pageerror',e => errors.push(e.message));
    // Observe from parsing onward, including the period before candidate APIs resolve.
    await page.addInitScript(() => {
      window.diagnosticMoves = [];
      const tracked = ['v2-paper','v2-paper-diagnostics','bot-operational-details'];
      new MutationObserver(changes => {
        for (const change of changes) for (const node of change.removedNodes) {
          if (node.nodeType === 1 && (tracked.includes(node.id) || tracked.some(id => node.querySelector('#'+id)))) window.diagnosticMoves.push(node.id || node.tagName);
        }
        const box = document.getElementById('v2-paper');
        if (box && box.parentElement.id !== 'v2-paper-diagnostics') window.diagnosticMoves.push('wrong-host');
      }).observe(document, {childList:true,subtree:true});
    });
    let release, gate, bot, tf, scenario;
    const run = 'test-run<script>';
    await page.route('https://api.rrr.trading/**', async route => {
      methods.push(route.request().method());
      await gate;
      const url = route.request().url(), at = new Date().toISOString(), start = new Date(Date.now()-3600000).toISOString();
      if(url.endsWith('/reporting')) return route.fulfill({json:{available:true,run_id:run,started_at:start,observed_at:at,portfolio:{starting_balance:10000,profit_all_abs:0,profit_all_pct:0,winning_trades:0,losing_trades:0,closed_trades:0,max_drawdown:0},history:[],open_trades:[]}});
      if(url.includes('/execution/health')) {
        if(scenario==='outage') return route.fulfill({status:503,json:{}});
        return route.fulfill({json:{mode:'PAPER',status:'available',enabled:scenario!=='paused',stale:scenario==='stale',run_id:run,started_at:start,versions:{learning_version:'learning<script>',decision_version:'decision-v1',sizing_version:'sizing-v1',execution_version:'execution-v1'}}});
      }
      if(url.includes('/execution/records')) {
        if(scenario==='records-unavailable') return route.fulfill({status:503,json:{}});
        return route.fulfill({json:{run_id:run,records:scenario==='empty'?[]:[{symbol:'BTC',timeframe:tf,direction:'LONG',status:'CLAIMED',opportunity_id:42,why_go:'<img src=x onerror=alert(1)>'+ 'LongEvidence'.repeat(60)}]}});
      }
      if(url.endsWith('/status') || url.endsWith('/api/status')) return route.fulfill({json:{ok:true,demo:bot,generated_at:Date.now()/1000,bot:{state:'RUNNING',mode:'PAPER',entry_owner:'paper-execution-v1',timeframe:tf,strategy:'Test '+tf,exchange:'bybit',stake_currency:'USDT',max_open_trades:5,stake_amount:1000,pairs:[]},open_trades:[],history:[]}});
      return route.fulfill({status:503,json:{}});
    });
    const structure = () => page.evaluate(() => Array.from(document.querySelector('main').children).map(n=>n.id || n.className));
    for(const [folder,key,timeframe] of [['15minbot','short','15m'],['1hrbot','medium','1h'],['4hrbot','long','4h']]) {
      bot=key;tf=timeframe;
      for(const width of [320,375,768,1440]) {
        scenario='active'; gate=new Promise(r=>release=r);
        await page.setViewportSize({width,height:1000});
        // Playwright routing disables the HTTP cache; every navigation is a cold page load.
        await page.goto(`http://127.0.0.1:${server.address().port}/demo/${folder}/`);
        await page.waitForSelector('#what-happening-now');
        const original = await structure();
        assert.equal(await page.locator('#v2-paper').count(),1);
        assert.equal(await page.locator('#v2-paper').isVisible(),false);
        assert.equal(await page.locator('#bot-operational-details').getAttribute('open'),null);
        assert.equal(await page.locator('#v2-paper').evaluate(e=>e.parentElement.id),'v2-paper-diagnostics');
        assert.equal(await page.locator('#bot-operational-details').evaluate(e=>e.parentElement.tagName),'MAIN');
        const summaryTop = await page.locator('#bot-summary').evaluate(e=>e.getBoundingClientRect().top);
        assert.equal(original[0],'bot-summary');assert.equal(original[1],'what-happening-now');
        assert(original.findIndex(x=>x.includes('completed-trades-section')) < original.indexOf('bot-operational-details'));
        assert.equal(await page.locator('.bot-summary-status').innerText(),'Loading bot state…');
        release();
        await page.waitForFunction(()=>document.querySelector('#v2-paper [role=status]').textContent.includes('ACTIVE PAPER'));
        await page.waitForFunction(()=>!document.querySelector('#performance-status').textContent.includes('Loading'));
        await page.waitForFunction(()=>document.querySelector('[data-candidate-assigned]').textContent.includes('unavailable'));
        assert.deepEqual(await structure(),original);
        assert.equal(await page.locator('#bot-summary').evaluate(e=>e.getBoundingClientRect().top),summaryTop);
        assert.deepEqual(await page.evaluate(()=>window.diagnosticMoves),[]);
        assert.equal(await page.locator('#v2-paper').isVisible(),false);
        await page.locator('#bot-operational-details > summary').focus();
        await page.locator('#bot-operational-details > summary').press('Enter');
        assert(await page.locator('#v2-paper').isVisible());
        const text = await page.locator('#v2-paper').textContent();
        assert(text.includes(run));assert(text.includes('Brisbane'));assert(text.includes('learning<script>'));
        assert.doesNotMatch(text,/Starting balance:|Total P\/L:|Wins\/losses:|Closed trades:|Runtime:|Max open positions:/);
        assert.equal(await page.locator('#v2-paper script, #v2-paper img').count(),0);
        assert.equal(await page.locator('.v2-execution-records').getAttribute('open'),null);
        await page.locator('.v2-execution-records > summary').click();
        assert((await page.locator('.v2-execution-records').innerText()).includes('Opportunity 42'));
        for(const selector of ['#v2-paper','.v2-execution-records']) assert(await page.locator(selector).evaluate(e=>e.scrollWidth<=e.clientWidth+1),folder+' '+width+' '+selector);
        await page.locator('.v2-run-details > summary').click();
        assert(await page.locator('.v2-run-details p').isVisible());
        if(width===375||width===1440){fs.mkdirSync('.runtime/v2-diagnostics',{recursive:true});await page.locator('#bot-operational-details').screenshot({path:`.runtime/v2-diagnostics/${folder}-${width}.png`});}
      }
      for(scenario of ['paused','stale','outage','empty','records-unavailable']) {
        gate=Promise.resolve();
        await page.goto(`http://127.0.0.1:${server.address().port}/demo/${folder}/`);
        await page.waitForFunction(()=>!V2Paper.summary().loading);
        const text=await page.locator('#v2-paper').textContent();
        if(scenario==='paused') assert(text.includes('PAUSED PAPER'));
        if(scenario==='stale'||scenario==='outage') assert(text.includes('unavailable or stale'));
        if(scenario==='empty') assert(text.includes('No v2 executions recorded'));
        if(scenario==='records-unavailable'||scenario==='outage') assert(text.includes('execution records unavailable'));
        assert.deepEqual(await page.evaluate(()=>window.diagnosticMoves),[]);
      }
    }
    assert.deepEqual(errors,[]);assert(methods.every(m=>m==='GET'));
    console.log('PASS cold loads before/after delayed APIs, permanent diagnostics ownership, stable summary/order, all bots x 320/375/768/1440, collapsed/wrapping/safe records, versions, paused/stale/outage/empty/partial, GET-only');
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
})().catch(e=>{console.error(e);process.exitCode=1});


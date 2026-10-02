const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
(async () => {
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  const page = await browser.newPage();
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  let failure=false, invalidJSON=false;
  const marketRequests=[];
  const stamp=()=>new Date().toISOString();
  const summary=()=>({ok:true,source:'kraken',currency:'USD',updated_at:stamp(),markets:[
    {symbol:'BTC',price:83675.57,change:132.64,change_24h:0.16,updated_at:stamp()},
    {symbol:'ETH',price:2688.78,change:-3.42,change_24h:-0.13,updated_at:stamp()},
    {symbol:'SOL',price:150,change:0,change_24h:0,updated_at:stamp()},
    {symbol:'XRP',price:0.5234,change:null,change_24h:null,updated_at:stamp()},
    {symbol:'TOTAL',price:null,change:null,change_24h:null,updated_at:null}
  ]});
  await page.route('https://stream.radiorrr.com/**', r=>r.abort());
  await page.route('https://api.rrr.trading/**', r=>{
    if(failure) return r.fulfill({status:503});
    const endpoint=new URL(r.request().url()).pathname;
    if(endpoint==='/api/market-summary') {
      marketRequests.push(r.request().url());
      if(invalidJSON) return r.fulfill({status:200,contentType:'application/json',body:'{invalid'});
    }
    const data=endpoint==='/api/market-summary'?summary():endpoint==='/score'?{assets:[{pair:'BTC-USDT',trend_score:88,confidence:78}]}:endpoint==='/market-regime'?{market_regime:'neutral',average_confidence:67}:endpoint==='/status'?{bot:{state:'RUNNING'},portfolio:{}}:{report_type:'macro_base',timezone:'Australia/Brisbane',report_date:new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane'}).format(new Date()),generated_at:stamp(),macro_score:55,macro_regime:'Mixed',confidence:80,components:Object.fromEntries(['rates','usd','equities','liquidity','volatility','macro_events'].map(k=>[k,{score:null,summary:'Unavailable'}]))};
    return r.fulfill({json:data});
  });
  await page.goto('http://localhost:8765');
  await page.waitForFunction(()=>document.querySelector('.market-price').textContent==='$83,675.57');
  assert.equal(await page.locator('[data-report]').count(),7);
  assert.equal(await page.locator('#inputs-title').innerText(),'Crypto Market Signals');
  assert.equal(await page.locator('#macro-score').innerText(),'55');
  assert.equal(await page.locator('#assessment-regime').innerText(),'NEUTRAL');
  assert.equal(await page.locator('#bot-status,#bot-metrics').count(),0);
  assert.equal(await page.locator('[data-asset]').count(),0);
  assert.equal(await page.locator('.market-tile').nth(0).getAttribute('data-tone'),'up');
  assert.equal(await page.locator('.market-tile').nth(1).getAttribute('data-tone'),'down');
  assert.match(await page.locator('.market-tile').nth(0).innerText(),/▲ \+\$132.64 \+0.16%/);
  assert.match(await page.locator('.market-tile').nth(1).innerText(),/▼ −\$3.42 −0.13%/);
  assert.match(await page.locator('.market-tile').nth(3).innerText(),/\$0.5234/);
  assert(await page.locator('.market-tile').nth(4).isHidden());
  for(const width of [1920,1440,1101,1024,768,390,320]) {
    await page.setViewportSize({width,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);
    assert(await page.locator('.market-strip-track').evaluate(el=>el.scrollWidth<=el.clientWidth));
  }
  await page.setViewportSize({width:390,height:850});
  await page.locator('.market-strip-track').evaluate(el=>{el.scrollLeft=0;});
  await page.screenshot({path:path.join(os.tmpdir(),'rrr-crypto-mobile.png')});
  await page.setViewportSize({width:1440,height:950});
  await page.screenshot({path:path.join(os.tmpdir(),'rrr-crypto-desktop.png')});
  await page.evaluate(()=>renderMarketSummary({currency:'USD',updated_at:new Date(Date.now()-180000).toISOString(),markets:[]}));
  assert.match(await page.locator('#market-strip-updated').innerText(),/stale/);
  assert.equal(await page.locator('.market-price').first().innerText(),'—');
  await page.evaluate(()=>renderMarketSummary({currency:'USD',updated_at:new Date().toISOString(),markets:[{symbol:'BTC',price:100,updated_at:new Date(Date.now()-180000).toISOString()}]}));
  assert.equal(await page.locator('.market-price').first().innerText(),'—');
  const render = async data => page.evaluate(data=>renderMarketSummary(data),data);
  const partial=summary(); partial.updated_at='invalid';
  partial.markets[1].price='bad'; partial.markets.unshift(null,{},'bad');
  await render(partial);
  assert.equal(await page.locator('.market-price').nth(0).innerText(),'$83,675.57');
  assert.equal(await page.locator('.market-price').nth(1).innerText(),'—');
  assert.equal(await page.locator('.market-price').nth(2).innerText(),'$150.00');
  assert.match(await page.locator('#market-strip-updated').innerText(),/partial data/);
  assert.doesNotMatch(await page.locator('#market-strip-updated').innerText(),/feed unavailable/i);
  const mixed=summary(); mixed.markets[0].updated_at=new Date(Date.now()-180000).toISOString();
  await render(mixed);
  assert.equal(await page.locator('.market-price').nth(0).innerText(),'—');
  assert.equal(await page.locator('.market-price').nth(1).innerText(),'$2,688.78');
  // Force one asset's formatter to throw; later assets must still render.
  await page.evaluate(data=>{
    const original=Intl.NumberFormat;
    Intl.NumberFormat=function(...args) { const formatter=new original(...args); return {format(value){if(value===83675.57)throw new Error('Bad asset formatter');return formatter.format(value);}}; };
    try { renderMarketSummary(data); } finally { Intl.NumberFormat=original; }
  },summary());
  assert.equal(await page.locator('.market-price').nth(0).innerText(),'—');
  assert.equal(await page.locator('.market-price').nth(1).innerText(),'$2,688.78');
  await render({currency:'USD',updated_at:stamp(),markets:[null,{symbol:'TOTAL',price:null}]});
  assert.match(await page.locator('#market-strip-updated').innerText(),/feed unavailable/i);
  invalidJSON=true; await page.evaluate(()=>refreshMarketSummary());
  assert.match(await page.locator('#market-strip-updated').innerText(),/feed unavailable/i);
  invalidJSON=false; await page.evaluate(()=>refreshMarketSummary());
  assert.equal(await page.locator('.market-price').nth(0).innerText(),'$83,675.57');
  assert(marketRequests.every(url=>url==='https://api.rrr.trading/api/market-summary'));
  failure=true; await page.evaluate(()=>refreshMarketSummary());
  assert.match(await page.locator('#market-strip-updated').innerText(),/unavailable/i);
  assert.equal(await page.locator('.market-tile').count(),5);
  assert.equal(await page.locator('#macro-score').innerText(),'55');
  assert.equal(await page.locator('#radio-audio').evaluate(a=>a.paused&&!a.autoplay),true);
  assert.deepEqual(errors,[]);
  await browser.close();
  console.log('PASS: partial/malformed/null assets, independent stale timestamps, formatter failure, invalid JSON/HTTP failure, exact URL, signs, seven widths/responsive wrapping and no JS errors.');
})().catch(e=>{console.error(e);process.exitCode=1;});

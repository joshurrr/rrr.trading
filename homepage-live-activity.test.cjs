const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const snapshot = require('./public-financial-snapshot.js');
const {model} = require('./homepage-performance.js');

const now = Date.now();
const at = offset => new Date(now + offset).toISOString();
const marketTiming = {state:'CURRENT', source_at:at(-3000), observed_at:at(-2000), expires_at:at(60000)};
const completedCandle = Math.floor(now / 900000) * 900;
const data = {
  version: 'live-read-api-v1', mode: 'bybit_live', served_at: at(0),
  market_prices:Object.fromEntries([['BTCUSDT',68000],['ETHUSDT',3500]].map(([symbol,price])=>
    [symbol,{...marketTiming,symbol,source:'bybit',availability:'AVAILABLE',price,change_24h_pct:2}])),
  market_price_history:{ETHUSDT:{symbol:'ETHUSDT',source:'bybit',state:'CURRENT',interval_seconds:900,
    source_at:new Date(completedCandle*1000).toISOString(),expires_at:at(60000),
    points:Array.from({length:96},(_,i)=>[completedCandle-(95-i)*900,3400+i])}},
  overview:{
    breadth:{...marketTiming,health:'AVAILABLE',values:{rising_24h_pct:60,falling_24h_pct:40,assets_included:50}},
    crypto_breadth:{...marketTiming,tracked:50,frames:{'5m':{up_pct:60,down_pct:40,covered:50}},
      momentum:{'5m':{median_pct:1.2,paired:50,delta_pp:0.2,improving_pct:60,deteriorating_pct:40}}},
    fear_greed:{...marketTiming,values:{value:0,classification:'Extreme Fear'}},
    nasdaq:{...marketTiming,source:'BYBIT',instrument:'QQQUSDT',quote_currency:'USDT',value:505,
      momentum:'STRENGTHENING',frames:{'15m':{state:'AVAILABLE',return_pct:2,direction:'RISING'}}}
  },
  wallet: {availability:'UNAVAILABLE', as_of:at(0), revision:1},
  open_positions: {availability:'AVAILABLE', inventory_availability:'AVAILABLE', verified_inventory:true, expires_at:at(60000), items:[
    {id:'public-id', symbol:'BTCUSDT', side:'SHORT', exchange:'bybit', position_type:'BYBIT_LIVE',
      entry_authority:'SOL', entry_price:'100', current_mark:'99', entered_at:at(-3600000),
      mark_observed_at:at(-3000), mark_expires_at:at(60000), availability:'AVAILABLE',
      quantity:'2', leverage:'1', unrealized_pnl:'2', protection:{status:'PROTECTED',active_stop:'102'},
      financials:{estimated_net_pnl_usdt:'1.80',margin_used_usdt:'200'}}
  ]},
  completed_trades: {availability:'AVAILABLE', expires_at:at(60000), as_of:at(0), count_24h:1, wins_24h:1,
    net_pnl_24h:'4.8',execution_fees_24h:'0.2',items:[
    {id:'closed-id', symbol:'ETHUSDT', side:'LONG', entry_price:'100', exit_price:'105',
      entered_at:at(-7200000), closed_at:at(-3600000), net_pnl:'4.8'}
  ]}
};
const view = snapshot.validate(data);
assert.equal(view.data.open_positions.items.length, 1);
assert.equal(view.data.completed_trades.items.length, 1);
assert.equal(view.data.open_positions.items[0].quantity, '2');
assert.equal(view.data.completed_trades.items[0].net_pnl, '4.8');
const metrics = model(view.data, {}, now);
assert.deepEqual([metrics.positions, metrics.count, metrics.wins, metrics.net, metrics.open, metrics.fees], [1,1,1,4.8,1.8,0.2]);
const stale = model({...data, open_positions:{...data.open_positions, availability:'STALE', inventory_availability:'STALE'}}, {}, now);
assert.equal(stale.positions, 1);
assert.equal(stale.stale, true);
assert.equal(model({...data, open_positions:{availability:'STALE', inventory_availability:'STALE',items:[]}}, {}, now).positions, null);

(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage();
    const fs = require('node:fs');
    const path = require('node:path');
    const html = fs.readFileSync(path.join(__dirname,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    await page.route('**/*',route=>route.abort());
    await page.setContent(html);
    for (const script of ['homepage-redesign-dashboard.js','homepage-positions.js','homepage-performance.js','homepage-trade-history.js']) {
      await page.addScriptTag({path:path.join(__dirname,script)});
    }
    await page.evaluate(() => {
      window.fetch = async url => {
        window.fixtureChartURL = url;
        const close=Math.floor(Date.now()/900000)*900000;
        return new Response(JSON.stringify({version:'live-position-charts-v1',mode:'bybit_live',items:[{
          position_id:'public-id',symbol:'BTCUSDT',health:'AVAILABLE',interval_seconds:900,
          source_at:new Date(close).toISOString(),expires_at:new Date(Date.now()+60000).toISOString(),
          points:Array.from({length:4},(_,i)=>({at:new Date(close-(3-i)*900000).toISOString(),price:100+i})),partial:false
        }]}));
      };
    });
    view.data.open_positions.items[0].entered_at=at(-300000);
    await page.evaluate(value => window.HomeDemoPositions.render(value), view.data);
    assert.equal(await page.locator('.home-position-type').innerText(), 'BYBIT LIVE');
    assert.equal(await page.locator('.home-ai-decision').innerText(), 'SOL ENTRY');
    assert.match(await page.locator('.home-position-allocation').innerText(), /200\.00/);
    assert.equal(await page.locator('.home-protection-status').innerText(), 'STOP ACTIVE');
    assert.deepEqual(await page.locator('#home-market-cards article > strong').allTextContents(),
      ['$68,000','$3,500','505.00 USDT','0 / 100']);
    assert.equal(await page.locator('[data-symbol="ETH"] .home-coin-sparkline svg').count(),1);
    assert.match(await page.locator('#home-market-pulse').innerText(), /Median.*1\.2/);
    assert.match(await page.locator('#home-closed-trades-body').innerText(), /ETHUSDT[\s\S]*\+4\.80 USDT/);
    assert.equal(await page.locator('#performance-net').innerText(), '+4.80 USDT');
    assert.equal(await page.evaluate(() => window.fixtureChartURL), 'https://v4.rrr.trading/v4/live/charts');
    assert.equal(await page.locator('.home-chart-label.stop dt').innerText(), 'Stop');
    await page.waitForFunction(() => document.querySelector('.home-mini-plot svg .chart-price'));
    assert.equal(await page.locator('.home-mini-plot svg .chart-price').count(),1,
      'Bybit candle context renders before two post-entry 15m closes exist');
    await page.evaluate(value => {
      const positions = value.open_positions;
      positions.availability = positions.inventory_availability = 'STALE';
      Object.assign(positions.items[0], {availability:'STALE', current_mark:null, last_known_mark:'99',
        protection:{status:'UNVERIFIED', active_stop:null, last_verified_stop:'102'}});
      window.HomeDemoPositions.render(value);
    }, view.data);
    assert.equal(await page.locator('.home-chart-label.stop dt').innerText(), 'Last verified stop');
    assert.equal(await page.locator('.home-protection-status').innerText(), 'STOP UNVERIFIED');
    console.log('PASS: actual Bybit card, source label, live chart route, public statistics and privacy fields.');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error);process.exitCode=1;});

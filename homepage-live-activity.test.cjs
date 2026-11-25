const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const snapshot = require('./public-financial-snapshot.js');
const {model} = require('./homepage-performance.js');

const now = Date.now();
const at = offset => new Date(now + offset).toISOString();
const data = {
  version: 'live-read-api-v1', mode: 'bybit_live', served_at: at(0),
  wallet: {availability:'UNAVAILABLE', as_of:at(0), revision:1},
  open_positions: {availability:'AVAILABLE', inventory_availability:'AVAILABLE', expires_at:at(60000), items:[
    {id:'public-id', symbol:'BTCUSDT', side:'SHORT', exchange:'bybit', position_type:'BYBIT_LIVE',
      entry_authority:'SOL', entry_price:'100', current_mark:'99', entered_at:at(-3600000),
      mark_observed_at:at(-3000), mark_expires_at:at(60000), availability:'AVAILABLE'}
  ]},
  completed_trades: {availability:'AVAILABLE', expires_at:at(60000), as_of:at(0), count_24h:1, wins_24h:1, items:[
    {id:'closed-id', symbol:'ETHUSDT', side:'LONG', entry_price:'100', exit_price:'105',
      entered_at:at(-7200000), closed_at:at(-3600000)}
  ]}
};
const view = snapshot.validate(data);
assert.equal(view.data.open_positions.items.length, 1);
assert.equal(view.data.completed_trades.items.length, 1);
assert.equal(view.data.open_positions.items[0].quantity, undefined);
assert.equal(view.data.completed_trades.items[0].net_pnl, undefined);
const metrics = model(view.data, {}, now);
assert.deepEqual([metrics.positions, metrics.count, metrics.wins, metrics.net, metrics.fees], [1,1,1,null,null]);
assert.equal(model({...data, open_positions:{availability:'STALE', inventory_availability:'STALE',items:[]}}, {}, now).positions, null);

(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage();
    await page.setContent('<section id="home-demo-positions"><div class="home-positions-heading"><h2 id="home-positions-title"></h2><span id="home-positions-state"></span></div><p id="home-position-time"></p><div id="home-position-list"></div></section>');
    await page.addScriptTag({path:require('node:path').join(__dirname,'homepage-positions.js')});
    await page.evaluate(() => {
      window.fetch = async url => {
        window.fixtureChartURL = url;
        return new Response(JSON.stringify({version:'live-position-charts-v1',mode:'bybit_live',items:[]}));
      };
    });
    await page.evaluate(value => window.HomeDemoPositions.render(value), view.data);
    assert.equal(await page.locator('.home-position-type').innerText(), 'BYBIT LIVE');
    assert.equal(await page.locator('.home-ai-decision').innerText(), 'SOL ENTRY');
    assert.equal(await page.evaluate(() => window.fixtureChartURL), 'https://v4.rrr.trading/v4/live/charts');
    console.log('PASS: actual Bybit card, source label, live chart route, public statistics and privacy fields.');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error);process.exitCode=1;});

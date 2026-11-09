'use strict';
const { test, expect } = require('@playwright/test');

test('all asset modals use the full browser viewport across homepage and Explorer', async ({ page }) => {
  test.setTimeout(60_000);
  const now = new Date().toISOString(), expires = new Date(Date.now() + 3600000).toISOString();
  const symbols = ['BTC', 'ETH', 'JCT', '1000PEPE'];
  const rows = symbols.map((symbol, i) => ({ symbol: symbol + 'USDT', exchange: 'bybit', instrument_type: 'linear_perpetual', side: 'LONG', rank: i + 1, timeframe: '1h', momentum_support: 'FAVOURS', return_pct: 1, observed_at: now, expires_at: expires, state: 'CURRENT', provenance: { cycle_started_at: now } }));
  const shortlists = Object.fromEntries(['LONG', 'SHORT'].map(side => [side, { state: 'CURRENT', source_at: now, observed_at: now, expires_at: expires, purpose: 'RESEARCH_RANKING_ONLY', items: side === 'LONG' ? rows : [], provenance: { cycle_started_at: now } }]));
  const positions = rows.filter(row => row.symbol !== 'JCTUSDT').map(row => ({ id: row.symbol, symbol: row.symbol, exchange: 'bybit', side: 'SHORT', availability: 'AVAILABLE', quantity: '1', entry_price: row.symbol==='BTCUSDT'?'65100':'0.0101', current_mark: row.symbol==='BTCUSDT'?'65000':'0.01', unrealized_pnl: '2', leverage: '1', entered_at: now, mark_observed_at: now, mark_expires_at: expires }));
  const paper = { version: 'paper-read-api-v1', mode: 'paper', served_at: now, open_positions: { availability: 'AVAILABLE', items: positions }, completed_trades: { availability: 'AVAILABLE', items: [] }, overview: { shortlists, research: { catalogue: { state: 'CURRENT', observed_at: now, pool_asset_count: symbols.length, assessed_count: symbols.length, eligible_count: symbols.length, assets: rows.map(row => ({ symbol: row.symbol, pair: row.symbol + '/USDT:USDT', technically_assessed: true, rankings: { LONG: { rank: row.rank } } })) } } } };
  paper.overview.rankings = shortlists;
  const evidence = { version: 'asset-analysis-read-v1', mode: 'paper', read_only: true, availability: 'AVAILABLE', shortlists, assets: rows.map(row => ({ identity: { exchange: row.exchange, instrument_id: row.symbol, instrument_type: row.instrument_type }, selection: row, technical: {}, luna: { status: 'NOT_ASSESSED' }, sol: { records: [] }, positions_status: 'AVAILABLE', trades_status: 'AVAILABLE', positions: [], trades: [{ id: row.symbol + '-closed', side: 'LONG', entered_at: now, closed_at: now, exit_reason: row.symbol + ' fixture exit', net_pnl: 0 }] })) };
  evidence.history = { status: 'AVAILABLE', items: [{ timestamp: now, symbol: 'ETHUSDT', side: 'LONG', rank: 1, event: 'SHORTLIST_RECORDED' }] };
  const requests = [], errors = [];
  const quotes = {
    BTCUSDT: { price: 65000, change_24h_pct: 2.5, ticker_expires_at: expires },
    JCTUSDT: { price: 0.00309973, change_24h_pct: 0, ticker_expires_at: expires },
    ETHUSDT: { price: 3500, change_24h_pct: -1.25, ticker_expires_at: new Date(Date.now()-60000).toISOString() }
  };
  for (const quote of Object.values(quotes)) Object.assign(quote, {
    ticker_health: 'AVAILABLE', ticker_observed_at: now, evidence: { ticker: { source: 'fixture', observed_at: now } }
  });
  evidence.market_prices = Object.fromEntries(Object.entries(quotes).map(([symbol, quote]) => [symbol, {
    availability: 'AVAILABLE', price: quote.price, change_24h_pct: quote.change_24h_pct,
    source: 'fixture', source_at: now, observed_at: now, expires_at: quote.ticker_expires_at
  }]));
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://v4.rrr.trading/**', route => {
    const url=route.request().url();
    requests.push(url);
    if(url.endsWith('/asset-quotes/ETHUSDT'))return route.fulfill({status:503,json:{error:'quote_refresh_failed'}});
    if(url.endsWith('/asset-quotes/1000PEPEUSDT'))return route.fulfill({json:{
      symbol:'1000PEPEUSDT',source:'bybit',availability:'AVAILABLE',price:0.01,
      source_at:now,observed_at:now,expires_at:expires
    }});
    return route.fulfill({ json: route.request().url().endsWith('/v4/asset-analysis') ? evidence : paper });
  });
  await page.route('https://api.rrr.trading/**', route => { requests.push(route.request().url()); return route.fulfill({ json: {} }); });
  await page.route('https://api.bybit.com/**', route => {
    const url = new URL(route.request().url()); requests.push(url.href);
    const price = url.searchParams.get('symbol') === 'BTCUSDT' ? '65000' : '0.01';
    return route.fulfill({ json: { retCode: 0, result: { list: url.pathname.endsWith('/tickers') ? [{ lastPrice: price, price24hPcnt: '0.02', highPrice24h: price, lowPrice24h: price, turnover24h: '1000' }] : Array.from({ length: 20 }, (_, i) => [String(Date.now() - i * 900000), price, Number(price)*1.004, Number(price)*.996, Number(price)*(i%2?1.002:.998), '10']) } } });
  });
  await page.route('https://stream.radiorrr.com/**', route => route.fulfill({ body: '' }));
  const structures = [];
  for (const path of ['/', '/asset-explorer/']) {
    const initialReads = requests.filter(url => url.endsWith('/v4/asset-analysis')).length;
    await page.goto(path);
    const frame = page.frameLocator('#page-content'), modal = page.locator('#homepage-analysis-modal');
    await expect(modal).toHaveCount(1);
    for (const symbol of path === '/' ? symbols.filter(value => value !== 'JCT') : symbols) {
      const trigger = path === '/' ? frame.locator('#home-position-list .home-position').filter({ has: frame.getByRole('heading', { name: symbol + 'USDT', exact: true }) }) : frame.locator(`.candidate-portrait[data-symbol="${symbol}"] button`).first();
      await expect(trigger).toBeVisible();
      const opener = await trigger.elementHandle();
      const before = requests.length;
      await (path === '/' ? trigger.locator('.home-position-name h3') : trigger).click();
      await expect(modal).toBeVisible();
      await expect(modal.locator('.aa-identity-ticker')).toHaveText(symbol);
      const tabs = ['Overview', 'Technical Analysis', 'New Themes', 'AI Decisions', 'Trade History'];
      await expect(modal.getByRole('tab')).toHaveText(tabs);
      await expect(modal.locator('.aa-chart svg')).toBeVisible();
      const header = modal.locator('.aa-identity-banner');
      const quote = quotes[symbol + 'USDT'];
      const logo = { BTC:'bitcoin', ETH:'ethereum', JCT:'janction' }[symbol];
      if (logo) {
        await expect(header.locator('img')).toHaveAttribute('src', '/assets/analysis-logos/' + logo + '.png');
        await expect(header.locator('img')).toBeVisible();
      }
      if (symbol === 'ETH') {
        await expect(header.locator('.aa-quote-price')).toHaveCount(0);
        await expect(header.locator('.aa-header-quote')).toContainText('Quote refresh failed');
      } else if (quote) {
        await expect(header.locator('.aa-quote-price')).toContainText(({BTC:'65,000',ETH:'3,500',JCT:'0.00309973'})[symbol]);
        if (symbol !== 'JCT') await expect(header.locator('.aa-quote-change')).toHaveClass(symbol === 'BTC' ? /aa-positive/ : /aa-negative/);
        if (symbol === 'BTC') await expect(header.locator('.aa-quote-change')).toHaveText('+2.50% / 24h');
        await expect(header.locator('.aa-quote-state')).toHaveCount(0);
        const metadata=modal.locator('.aa-market');
        await expect(metadata).not.toHaveAttribute('open','');
        await metadata.locator('summary').click();
        await expect(metadata).toContainText('fixture');
        await expect(metadata).toContainText('Expiry');
        await metadata.locator('summary').click();
      } else await expect(header.locator('.aa-quote-price')).toContainText('0.01');
      expect(requests.slice(before).filter(url=>url.includes('/asset-quotes/'))).toHaveLength(
        ['ETH','1000PEPE'].includes(symbol)?1:0
      );
      if (logo && symbol !== 'ETH') {
        const originalViewport = page.viewportSize();
        for (const width of [1440,390]) {
          await page.setViewportSize({width,height:900});
          await expect(header.locator('.aa-identity-subtitle')).toHaveCount(0);
          await expect(header.locator('.aa-quote-price')).toHaveCSS('font-size',width===390?'21.92px':'25.12px');
          await expect.poll(()=>header.evaluate(el=>{
            const name=el.querySelector('.aa-identity-name').getBoundingClientRect();
            const price=el.querySelector('.aa-quote-price').getBoundingClientRect();
            return el.scrollWidth<=el.clientWidth+1 && (name.right<=price.left+1 || name.bottom<=price.top+1);
          })).toBe(true);
        }
        await page.setViewportSize(originalViewport);
      }
      if (symbol === 'JCT') {
        await expect(modal.locator('.aa-position-summary')).toBeHidden();
        await expect(header.locator('.aa-quote-change')).toHaveText('0.00% / 24h');
      }
      else {
        await expect(modal.locator('.aa-position-summary')).toContainText('SHORT');
        await expect(modal.locator('.aa-position-summary .aa-positive')).toContainText('Unrealised P/L');
        await expect(modal.locator('.aa-position-card')).toContainText('OPEN SHORT');
      }
      if(symbol==='BTC'){
        for(const viewport of [{width:1920,height:1080},{width:2560,height:1440},{width:1366,height:768},{width:768,height:1024},{width:390,height:844}]){
          await page.setViewportSize(viewport);
          await expect.poll(()=>modal.locator('.homepage-analysis-dialog').evaluate(d=>{
            const r=d.getBoundingClientRect(),b=d.querySelector('.homepage-analysis-body'),ratio=innerWidth>800?.95:.9;
            return Math.abs(r.height-innerHeight*ratio)<1&&Math.abs(r.top-(innerHeight-r.height)/2)<1&&Math.abs(r.width-Math.min(800,innerWidth-32))<1&&Math.abs(r.left-(innerWidth-r.width)/2)<1&&b.scrollWidth<=b.clientWidth+1;
          })).toBe(true);
          await expect.poll(()=>modal.locator('.aa-chart svg').evaluate(svg=>
            Math.abs(svg.viewBox.baseVal.width-svg.parentElement.clientWidth)<=1
          )).toBe(true);
          const headerTop=await modal.locator('header').evaluate(n=>n.getBoundingClientRect().top);
          await modal.locator('.homepage-analysis-body').evaluate(n=>n.scrollTop=n.scrollHeight);
          expect(await modal.locator('header').evaluate(n=>n.getBoundingClientRect().top)).toBe(headerTop);
          await expect(modal.getByRole('button',{name:'Close Asset Analysis',exact:true})).toBeInViewport();
          await modal.locator('.homepage-analysis-body').evaluate(n=>n.scrollTop=0);
          if(viewport.width===1920||viewport.width===390)await page.screenshot({path:`.runtime/asset-modal-${path==='/'?'home':'explorer'}-${viewport.width}.png`});
        }
        await page.setViewportSize({width:1440,height:1000});
      }
      const marketCalls = requests.slice(before).filter(url => url.includes('api.bybit.com'));
      expect(marketCalls.filter(url => url.includes('/tickers?'))).toHaveLength(0);
      expect(marketCalls.filter(url => url.includes('/kline?'))).toHaveLength(1);
      if (symbol === 'BTC') {
        for (const [label, interval] of [['1h','60'],['4h','240'],['15m','15']]) {
          const button=modal.getByRole('button',{name:label,exact:true});
          const response=page.waitForResponse(r=>new URL(r.url()).searchParams.get('interval')===interval);
          await button.click();
          await response;
          await expect(button).toHaveAttribute('aria-pressed','true');
          await expect(modal.locator('.aa-chart svg')).toHaveAttribute('aria-label',new RegExp(label));
        }
      }
      for (const name of tabs.slice(1)) {
        const tab = modal.getByRole('tab', { name, exact: true });
        await tab.click(); await expect(tab).toHaveAttribute('aria-selected', 'true');
      }
      await expect(modal.locator('#asset-analysis-detail')).toContainText(symbol + 'USDT fixture exit');
      if (symbol === '1000PEPE') structures.push(await modal.locator('.homepage-analysis-dialog > header').evaluate(el => el.outerHTML));
      await modal.getByRole('button', { name: 'Close Asset Analysis', exact: true }).click();
      await expect(modal).toBeHidden();
      // The homepage can replace position cards during its existing refresh.
      if (await opener.evaluate(el => el.isConnected)) await expect(path === '/' ? trigger.locator('.asset-analysis-symbol') : trigger).toBeFocused();
      await opener.dispose();
      await expect(page.locator('#asset-intelligence-dialog')).toBeHidden();
    }
    expect(requests.filter(url => url.endsWith('/v4/asset-analysis')).length - initialReads).toBe(1);
    if (path === '/') {
      await frame.locator('#home-closed-trades-body').evaluate(body => {
        const now = new Date().toISOString();
        const trades = ['ETHUSDT', 'BTCUSDT', '1000PEPE/USDT:USDT', 'QQQUSDT', 'UNKNOWNUSDT'].map(symbol => ({
          symbol, side: 'LONG', entry_price: 1, exit_price: 2, entered_at: now, closed_at: now, net_pnl: 1
        }));
        body.ownerDocument.defaultView.dispatchEvent(new CustomEvent('rrr-v4-completed-trade-activity', {
          detail: { availability: 'AVAILABLE', complete: true, count: trades.length, net: trades.length, trades }
        }));
      });
      const table = frame.locator('#home-closed-trades-body');
      await expect(table.getByRole('button')).toHaveCount(3);
      for (const unsupported of ['QQQUSDT', 'UNKNOWNUSDT']) {
        await expect(table.getByText(unsupported, { exact: true })).toBeVisible();
        await expect(table.getByRole('button', { name: new RegExp(unsupported) })).toHaveCount(0);
      }
      for (const [label, symbol, width] of [['ETHUSDT','ETH',1440], ['BTCUSDT','BTC',390], ['1000PEPE/USDT:USDT','1000PEPE',390]]) {
        await page.setViewportSize({width,height:900});
        const button = table.getByRole('button', { name: label, exact: true });
        if (symbol === 'ETH') await button.press('Enter');
        else await button.click();
        await expect(modal.locator('.aa-identity-ticker')).toHaveText(symbol);
        await expect(modal.locator('.homepage-analysis-dialog')).toHaveClass(/has-arrived/);
        await modal.getByRole('button', { name: 'Close Asset Analysis' }).click();
        await expect(modal).toBeHidden();
        await expect(button).toBeFocused();
      }
      await page.setViewportSize({width:1440,height:1000});
    }

    await expect(frame.locator('#asset-intelligence-dialog')).toHaveCount(path === '/' ? 1 : 0);
  }
  expect(structures[0]).toBe(structures[1]);
  await page.frameLocator('#page-content').locator('.candidate-portrait[data-symbol="BTC"] button').first().click();
  await expect(page.locator('#homepage-analysis-modal')).toBeVisible();
  await page.evaluate(()=>window.SiteNavigation.load('/'));
  await expect(page.locator('#homepage-analysis-modal')).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/analysis-modal-open/);
  await expect(page.locator('#page-content')).not.toHaveAttribute('inert','');
  await page.setViewportSize({width:390,height:900});
  await page.goto('/asset-analysis/');
  const historySymbol = page.locator('.aa-history-table').getByRole('button', { name: 'ETHUSDT', exact: true });
  await historySymbol.click();
  const mobileModal = page.locator('#homepage-analysis-modal');
  await expect(mobileModal.locator('.aa-identity-ticker')).toHaveText('ETH');
  await expect(mobileModal.getByRole('tabpanel')).toHaveAttribute('id','popup-aa-detail-panel');
  await expect(page.locator('#asset-analysis-panel')).toHaveCount(1);
  await mobileModal.getByRole('button', {name:'Close Asset Analysis'}).click();
  await expect(historySymbol).toBeFocused();
  expect(requests.some(url => url.includes('/intelligence/assets/'))).toBe(false);
  expect(errors).toEqual([]);
});

for (const width of [1440,390]) {
  test(`open UAI quotes renew through expiry, visibility and reopening at ${width}px`, async ({ page }) => {
    await page.setViewportSize({width,height:900});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.clock.install();
    const now = new Date().toISOString();
    const selection = { symbol:'UAIUSDT', exchange:'bybit', instrument_type:'linear_perpetual', side:'LONG', rank:1, timeframe:'1h', state:'CURRENT', observed_at:now };
    const evidence = { version:'asset-analysis-read-v1', mode:'paper', read_only:true, assets:[{
      identity:{exchange:'bybit',instrument_id:'UAIUSDT',instrument_type:'linear_perpetual'}, selection, technical:{}, sol:{records:[]}, positions:[], trades:[]
    }], history:{status:'AVAILABLE',items:[{timestamp:now,symbol:'UAIUSDT',side:'LONG',rank:1,event:'SHORTLIST_RECORDED'}]},
    market_prices:{UAIUSDT:{availability:'AVAILABLE',source:'bybit',source_at:now,observed_at:now,expires_at:new Date(Date.parse(now)+60000).toISOString(),price:0.0465,change_24h_pct:-41.58}} };
    let quoteReads=0;
    await page.route('https://v4.rrr.trading/**', async route => {
      const url=route.request().url();
      if(url.endsWith('/asset-analysis'))return route.fulfill({json:evidence});
      if(url.endsWith('/asset-quotes/UAIUSDT')){
        const count=++quoteReads;
        const time=await page.evaluate(()=>Date.now());
        const timestamp=new Date(time).toISOString();
        return route.fulfill({json:{symbol:'UAIUSDT',source:'bybit',availability:count===2?'STALE':'AVAILABLE',source_at:timestamp,observed_at:timestamp,
          expires_at:new Date(time+(count===2?-1:60000)).toISOString(),price:0.05+count/100,change_24h_pct:count===3?'invalid':count}});
      }
      return route.fulfill({json:{}});
    });
    await page.route('https://api.bybit.com/**',r=>r.fulfill({json:{retCode:0,result:{list:[]}}}));
    await page.route('https://api.rrr.trading/**',r=>r.fulfill({json:{}}));
    await page.route('https://stream.radiorrr.com/**',r=>r.fulfill({body:''}));
    await page.goto('/asset-analysis/');
    const content=width>700?page.frameLocator('#page-content'):page;
    const opener=content.locator('.aa-history-table').getByRole('button',{name:'UAIUSDT'});
    const modal=page.locator('#homepage-analysis-modal');
    const price=modal.locator('.aa-quote-price'),change=modal.locator('.aa-quote-change');
    const close=modal.getByRole('button',{name:'Close Asset Analysis'});
    await opener.click();
    await expect(price).toContainText('0.0465');
    await expect(change).toHaveText('-41.58% / 24h');
    await expect(change).toContainText('-41.58%');
    const logo=modal.locator('.aa-logo img');
    await expect(logo).toBeVisible();
    expect(await logo.evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
    await expect(modal.locator('.aa-identity-name')).toHaveText('UnifAI Network');
    expect(quoteReads).toBe(0);
    await modal.getByRole('tab',{name:'Technical Analysis'}).click();
    await page.clock.fastForward(61000);
    await expect(price).toContainText('0.06');
    await expect(change).toHaveText('+1.00% / 24h');
    await page.clock.fastForward(61000);
    await expect(modal.locator('.aa-quote-state')).toHaveAttribute('data-quote-state','STALE');
    await expect(price).toHaveCount(0);
    await expect(change).toHaveCount(0);
    await page.clock.fastForward(31000);
    await expect(price).toContainText('0.08');
    await expect(change).toHaveCount(0);
    await close.click();
    await expect(modal).toBeHidden();
    await opener.click();
    await expect(price).toContainText('0.08');
    expect(quoteReads).toBe(3);
    await content.locator('html').evaluate(el=>{
      const doc=el.ownerDocument;
      Object.defineProperty(doc,'hidden',{configurable:true,value:true});
      doc.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.fastForward(61000);
    expect(quoteReads).toBe(3);
    await content.locator('html').evaluate(el=>{
      const doc=el.ownerDocument;
      delete doc.hidden;
      doc.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(price).toContainText('0.09');
    await expect(change).toHaveText('+4.00% / 24h');
    await close.click();
    await expect(modal).toBeHidden();
    await page.clock.fastForward(121000);
    expect(quoteReads).toBe(4);
  });
}

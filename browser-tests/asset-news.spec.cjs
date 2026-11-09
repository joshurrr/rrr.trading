'use strict';
const { test, expect } = require('@playwright/test');

test('asset News uses ranked, current and explicitly scoped LUNA themes', async ({ page }) => {
  const hoursAgo = hours => new Date(Date.now() - hours * 3600000).toISOString();
  const now = hoursAgo(0), expires = hoursAgo(-1);
  const selections = ['ETHUSDT', 'BTCUSDT'].map((symbol, i) => ({
    symbol, exchange:'bybit', instrument_type:'linear_perpetual', side:'LONG', rank:i+1,
    timeframe:'1h', observed_at:now, expires_at:expires, state:'CURRENT'
  }));
  const shortlists = {LONG:{state:'CURRENT',source_at:now,items:selections},SHORT:{state:'CURRENT',items:[]}};
  const evidence = {
    version:'asset-analysis-read-v1',mode:'paper',read_only:true,availability:'AVAILABLE',shortlists,
    assets:selections.map(selection => ({
      identity:{exchange:'bybit',instrument_id:selection.symbol,instrument_type:'linear_perpetual'},
      selection,technical:{},luna:{news:[{headline:'Raw report'}]},sol:{records:[]},positions:[],trades:[]
    }))
  };
  const reference = 'https://blog.ethereum.org/en/2026/10/05/transaction-assertions';
  const base = {
    scope:'ASSET',affected_assets:['ETH'],status:'ACTIVE',freshness:'CURRENT',verified_until:expires,
    latest_development_at:hoursAgo(3),last_verified_at:hoursAgo(1),
    latest_development:'Saved material development.',understanding:'Saved consolidated LUNA interpretation.',
    sources:[{source:'Ethereum Foundation',headline:'Foundation announcement',reference},
      {source:'Publisher',headline:'Second report on the same event',reference:'https://example.test/report'}]
  };
  const theme = (id,name,significance,fields={}) => ({...base,id,name,significance,...fields});
  const high = theme('high','Ethereum upgrade','HIGH');
  const btc = theme('btc','Bitcoin release','HIGH',{affected_assets:['BTC']});
  const firstPage = [
    theme('medium','Ethereum priority theme','MEDIUM',{latest_development_at:hoursAgo(4)}),high,
    theme('expired','Expired Ethereum theme','HIGH',{verified_until:hoursAgo(1)}),
    theme('stale','Stale Ethereum theme','HIGH',{freshness:'STALE'}),
    theme('archived','Archived Ethereum theme','HIGH',{archived:true}),
    theme('resolved','Resolved Ethereum theme','HIGH',{status:'RESOLVED'}),
    theme('macro','Shared Macro theme','HIGH',{scope:'MACRO'}),
    theme('crypto','Broad crypto theme','HIGH',{scope:'CRYPTO'}),
    theme('multi','Multi-asset theme','HIGH',{affected_assets:['ETH','BTC']}),
    theme('unsupported','Unsupported theme','HIGH',{sources:[]}),btc
  ];
  const lastPage = [high,theme('new','Newer Ethereum theme','MEDIUM',{latest_development_at:hoursAgo(2),last_verified_at:now}),
    theme('low','Ethereum minor theme','LOW')];
  const requests = [], errors = [];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://v4.rrr.trading/**',route=>{
    const url = new URL(route.request().url());
    if(url.pathname==='/v4/intelligence'){
      const asset=url.searchParams.get('asset'), offset=url.searchParams.get('offset');
      if(url.searchParams.has('theme_id'))return route.fulfill({json:{
        version:'theme-intelligence-read-v1',mode:'paper',read_only:true,availability:'AVAILABLE',
        scope:'ASSET:ETH',history:[{...base,status:'EMERGING',latest_development:'Initial saved development.'}]
      }});
      requests.push([asset,offset]);
      return route.fulfill({json:{
        version:'theme-intelligence-read-v1',mode:'paper',read_only:true,availability:'AVAILABLE',
        scope:'ASSET:'+asset.replace(/USDT$/,''),
        themes:asset==='BTCUSDT'?[btc,high]:offset?lastPage:firstPage,
        next_offset:asset==='ETHUSDT'&&!offset?20:null
      }});
    }
    return route.fulfill({json:url.pathname==='/v4/asset-analysis'?evidence:{
      version:'paper-read-api-v1',mode:'paper',overview:{shortlists},open_positions:{items:[]},completed_trades:{items:[]}
    }});
  });
  await page.route('https://api.bybit.com/**',route=>route.fulfill({json:{retCode:0,result:{list:[]}}}));
  await page.goto('/asset-analysis/');
  const frame = page.frameLocator('#page-content');
  const cards = frame.locator('#asset-analysis-cards .aa-card');
  await cards.filter({hasText:'ETH'}).click();
  await frame.getByRole('tab',{name:'News',exact:true}).click();
  const panel = frame.locator('.ei-asset');
  const themes = panel.locator('.evolving-theme');
  await expect(themes.locator('summary > strong')).toHaveText([
    'Ethereum upgrade','Ethereum priority theme','Newer Ethereum theme','Ethereum minor theme'
  ]);
  await expect(themes.locator('.ei-impact')).toHaveText(['HIGH','MEDIUM','MEDIUM','LOW']);
  await expect(panel.locator('.ei-stats dd')).toHaveText(['4','1',/Newer Ethereum theme/]);
  await expect(panel).not.toContainText(/Raw report|Discovery coverage|Expired Ethereum|Bitcoin release/);
  await expect(themes.first().locator(':scope > summary')).toContainText(/Updated 3h ago/);
  await expect(themes.first().locator(':scope > summary')).toContainText('Saved material development.');
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:1000});
    await themes.first().locator(':scope > summary').click();
    await expect(themes.first().getByText('Saved consolidated LUNA interpretation.')).toBeVisible();
    await themes.first().getByText('Supporting sources', {exact:false}).click();
    await expect(themes.first().getByRole('link',{name:'Foundation announcement'})).toHaveAttribute('href',reference);
    expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await themes.first().getByText('Supporting sources', {exact:false}).click();
    if(width===1440){
      await themes.first().getByText('Development timeline',{exact:true}).click();
      await expect(themes.first().getByText('Initial saved development.')).toBeVisible();
      await themes.first().getByText('Development timeline',{exact:true}).click();
    }
    await themes.first().locator(':scope > summary').click();
  }
  await page.keyboard.press('Escape');
  await cards.filter({hasText:'BTC'}).click();
  await frame.getByRole('tab',{name:'News',exact:true}).click();
  await expect(themes.locator('summary > strong')).toHaveText(['Bitcoin release']);
  expect(requests).toEqual([['ETHUSDT',null],['ETHUSDT','20'],['BTCUSDT',null]]);
  expect(errors).toEqual([]);
});

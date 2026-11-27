const {test,expect}=require('@playwright/test');
test('universe controls cards independently of selection, AI and technical records',async({page})=>{
 const now=new Date().toISOString(),expires=new Date(Date.now()+3600000).toISOString();
 const universe={state:'CURRENT',observed_at:now,expires_at:expires,pool_asset_count:21,assets:Array.from({length:21},(_,i)=>({exchange:'bybit',symbol:`ASSET${i}USDT`,pair:`ASSET${i}USDT/USDT:USDT`}))};
 const historical={identity:{exchange:'bybit',instrument_id:'SOLUSDT',instrument_type:'linear_perpetual'},selection:{exchange:'bybit',instrument_type:'linear_perpetual',symbol:'SOLUSDT',side:'HISTORICAL'},historical_only:true,technical:{},sol:{records:[{timestamp:now,decision:'HOLD'}]},luna:{status:'STALE'},trades:[{id:'sol-closed',symbol:'SOLUSDT',side:'LONG',closed_at:now}]};
 const evidence={version:'asset-analysis-read-v1',mode:'bybit_live',read_only:true,availability:'UNAVAILABLE',served_at:now,assets:[historical],trading_universe:universe,history:{status:'UNAVAILABLE',items:[]}};
 evidence.asset_intelligence=[{identity:{exchange:'bybit',instrument_id:'ASSET0USDT',instrument_type:'linear_perpetual'},luna:{status:'STALE',assessment:{summary:'Retained asset-specific assessment'}}}];
 evidence.technical_assessments=[{identity:{exchange:'bybit',instrument_id:'ASSET0USDT',instrument_type:'linear_perpetual'},technical:{'1h':{status:'ASSESSED',state:'STALE',direction:'DOWN',indicators:{rsi:42}}}}];
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const url=route.request().url();requests.push(url);if(new URL(url).pathname==='/radio-navigation.js')return route.fulfill({body:''});if(url.startsWith('http://127.0.0.1:'))return route.continue();if(url.endsWith('/v4/asset-analysis'))return route.fulfill({json:evidence});if(url.endsWith('/v4/live'))return route.fulfill({json:{version:'live-read-api-v1',mode:'bybit_live',overview:{}}});return route.abort();});
 await page.goto('/asset-analysis/');
 const cards=page.locator('.aa-card'),summary=page.locator('#asset-analysis-summary');
 await expect(cards).toHaveCount(22);await expect(summary).toContainText('Bybit Live assets22');await expect(summary).toContainText('Market cards21');await expect(summary).toContainText('Historical live trades1');
 await expect(cards.first()).toContainText('TRADING ASSET');await expect(cards.last()).toContainText('HISTORICAL');
 expect(requests.filter(u=>u.includes('api.bybit.com'))).toEqual([]);
 await cards.first().click();await page.getByRole('tab',{name:'Technical Analysis',exact:true}).click();await expect(page.locator('.aa-technical-frame')).toHaveCount(3);await expect(page.locator('.aa-technical-frame').first()).toContainText('UNAVAILABLE');await expect(page.locator('.aa-technical-frame').nth(1)).toContainText('saved technical assessment');await page.getByRole('tab',{name:'New Themes',exact:true}).click();await expect(page.locator('#asset-analysis-detail')).toContainText('Saved news themes are unavailable.');await page.getByRole('tab',{name:'Technical Analysis',exact:true}).click();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`.runtime/asset-universe-${width}.png`,fullPage:false});}
 const refresh=async()=>{await page.locator('#asset-analysis-refresh').click();await expect(page.locator('#asset-analysis-cards')).toHaveAttribute('aria-busy','false');};
 // A retained SOL record is supplementary once SOL joins the saved universe.
 universe.assets[0]={exchange:'bybit',symbol:'SOLUSDT',pair:'SOLUSDT/USDT:USDT'};universe.state='STALE';await refresh();await expect(cards).toHaveCount(21);await expect(cards.first()).toContainText('TRADING ASSET');await expect(cards.first()).toContainText('STALE');await expect(summary).toContainText('Market freshnessSTALE');
 // Legitimate removals and recorded zero selections are independent.
 universe.assets.pop();universe.pool_asset_count=20;evidence.shortlists=Object.fromEntries(['LONG','SHORT'].map(side=>[side,{state:'CURRENT',items:[],observed_at:now,expires_at:expires}]));await refresh();await expect(cards).toHaveCount(20);await expect(summary).toContainText('Market cards20');
 // Invalid/missing universe must not turn historical membership into eligibility.
 delete evidence.trading_universe;await refresh();await expect(cards).toHaveCount(1);await expect(summary).toContainText('Market cardsUNAVAILABLE');await expect(cards.first()).toContainText('HISTORICAL');
 // The Bybit Live fallback preserves market cards and activity if the detailed endpoint is unavailable.
  await page.route('**/v4/asset-analysis',route=>route.fulfill({status:503,body:'unavailable'}));
 await page.route('**/v4/live',route=>route.fulfill({json:{version:'live-read-api-v1',mode:'bybit_live',served_at:now,
  open_positions:{availability:'AVAILABLE',items:[{id:'xrp-live',exchange:'bybit',symbol:'XRPUSDT',instrument_type:'linear_perpetual',side:'SHORT'}]},
  completed_trades:{availability:'AVAILABLE',items:[{id:'doge-live',exchange:'bybit',symbol:'DOGEUSDT',instrument_type:'linear_perpetual',side:'SHORT',closed_at:now}]},
  market_prices:{BTCUSDT:{symbol:'BTCUSDT',source:'bybit',availability:'AVAILABLE',price:68000,change_24h_pct:1,observed_at:now,expires_at:expires},ETHUSDT:{symbol:'ETHUSDT',source:'bybit',availability:'AVAILABLE',price:3500,change_24h_pct:-1,observed_at:now,expires_at:expires}},overview:{crypto:{BTCUSDT:{frames:{}},ETHUSDT:{frames:{}}}}}}));
 await refresh();await expect(cards).toHaveCount(4);await expect(page.locator('.aa-card-symbol')).toHaveText(['BTC','ETH','XRP','DOGE']);
 expect(errors).toEqual([]);
});

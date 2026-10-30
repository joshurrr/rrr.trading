const {test,expect}=require('@playwright/test');
test('universe controls cards independently of selection, AI and technical records',async({page})=>{
 const now=new Date().toISOString(),expires=new Date(Date.now()+3600000).toISOString();
 const universe={state:'CURRENT',observed_at:now,expires_at:expires,pool_asset_count:21,assets:Array.from({length:21},(_,i)=>({exchange:'bybit',symbol:`ASSET${i}USDT`,pair:`ASSET${i}USDT/USDT:USDT`}))};
 const historical={identity:{exchange:'bybit',instrument_id:'SOLUSDT',instrument_type:'linear_perpetual'},selection:{symbol:'SOLUSDT',side:'HISTORICAL'},historical_only:true,technical:{},sol:{records:[{timestamp:now,decision:'HOLD'}]},luna:{status:'STALE'}};
 const evidence={version:'asset-analysis-read-v1',mode:'paper',read_only:true,availability:'UNAVAILABLE',served_at:now,assets:[historical],trading_universe:universe,history:{status:'UNAVAILABLE',items:[]}};
 evidence.asset_intelligence=[{identity:{exchange:'bybit',instrument_id:'ASSET0USDT',instrument_type:'linear_perpetual'},luna:{status:'STALE',assessment:{summary:'Retained asset-specific assessment'}}}];
 evidence.technical_assessments=[{identity:{exchange:'bybit',instrument_id:'ASSET0USDT',instrument_type:'linear_perpetual'},technical:{'1h':{status:'ASSESSED',state:'STALE',direction:'DOWN',indicators:{rsi:42}}}}];
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const url=route.request().url();requests.push(url);if(new URL(url).pathname==='/radio-navigation.js')return route.fulfill({body:''});if(url.startsWith('http://127.0.0.1:'))return route.continue();if(url.endsWith('/v4/asset-analysis'))return route.fulfill({json:evidence});if(url.endsWith('/v4/paper'))return route.fulfill({json:{version:'paper-read-api-v1',mode:'paper',overview:{}}});return route.abort();});
 await page.goto('/asset-analysis/');
 const cards=page.locator('.aa-card'),summary=page.locator('#asset-analysis-summary');
 await expect(cards).toHaveCount(22);await expect(summary).toContainText('Trading Assets21');await expect(summary).toContainText('Selected assetsUNAVAILABLE');await expect(summary).toContainText('LONG reviewUNAVAILABLE');
 await expect(cards.first()).toContainText('TRADING ASSET');await expect(cards.last()).toContainText('HISTORICAL');
 expect(requests.filter(u=>u.includes('api.bybit.com'))).toEqual([]);
 await cards.first().click();await page.getByRole('tab',{name:'Technical Analysis',exact:true}).click();await expect(page.locator('.aa-technical-frame')).toHaveCount(3);await expect(page.locator('.aa-technical-frame').first()).toContainText('UNAVAILABLE');await expect(page.locator('.aa-technical-frame').nth(1)).toContainText('42');await page.getByRole('tab',{name:'News & Intelligence',exact:true}).click();await expect(page.locator('#asset-analysis-detail')).toContainText('Retained asset-specific assessment');await page.getByRole('tab',{name:'Technical Analysis',exact:true}).click();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`.runtime/asset-universe-${width}.png`,fullPage:false});}
 const refresh=async()=>{await page.locator('#asset-analysis-refresh').click();await expect(page.locator('#asset-analysis-cards')).toHaveAttribute('aria-busy','false');};
 // A retained SOL record is supplementary once SOL joins the saved universe.
 universe.assets[0]={exchange:'bybit',symbol:'SOLUSDT',pair:'SOLUSDT/USDT:USDT'};universe.state='STALE';await refresh();await expect(cards).toHaveCount(21);await expect(cards.first()).toContainText('TRADING ASSET');await expect(cards.first()).toContainText('STALE');await expect(summary).toContainText('Data freshnessSTALE');
 // Legitimate removals and recorded zero selections are independent.
 universe.assets.pop();universe.pool_asset_count=20;evidence.shortlists=Object.fromEntries(['LONG','SHORT'].map(side=>[side,{state:'CURRENT',items:[],observed_at:now,expires_at:expires}]));await refresh();await expect(cards).toHaveCount(20);await expect(summary).toContainText('Selected assets0');
 // Invalid/missing universe must not turn historical membership into eligibility.
 delete evidence.trading_universe;await refresh();await expect(cards).toHaveCount(1);await expect(summary).toContainText('Trading AssetsUNAVAILABLE');await expect(cards.first()).toContainText('HISTORICAL');
 // The existing paper universe also works if the detailed endpoint is unavailable.
 await page.route('**/v4/asset-analysis',route=>route.fulfill({status:503,body:'unavailable'}));
 await page.route('**/v4/paper',route=>route.fulfill({json:{version:'paper-read-api-v1',mode:'paper',overview:{trading_universe:universe}}}));
 await refresh();await expect(cards).toHaveCount(20);await expect(summary).toContainText('Trading Assets20');
 expect(errors).toEqual([]);
});

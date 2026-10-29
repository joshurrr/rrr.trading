const {test,expect}=require('@playwright/test');

test('macro refresh uses saved themes, observations and the shared asset overlay',async({page})=>{
 const now=new Date().toISOString(),expires=new Date(Date.now()+3600000).toISOString();
 const interpretation={state:'CURRENT',historical:false,health:'AVAILABLE',validation:'SAVED_SCHEMA_AND_ORIGINAL_EVIDENCE_VALIDATED',source_at:now,observed_at:now,expires_at:expires,assessment:{text:'Saved Luna interpretation: markets remain mixed with rates as a key influence.'},market_mood:{text:'Mixed crypto outlook'},directional_pressure:{text:'Neutral pressure'},drivers:[{text:'Rates remain a saved driver.'}],contradictions:[],uncertainty:['Policy path remains uncertain.'],provenance:{evidence:[{id:'E1',source:'FRED',reference:'https://fred.stlouisfed.org/',published_at:now,observed_at:now,expires_at:expires,state:'CURRENT'}]},news_and_themes:{state:'CURRENT',validation:'SAVED_SCHEMA_AND_ORIGINAL_EVIDENCE_VALIDATED',source_at:now,observed_at:now,expires_at:expires,provenance:{evidence:[{id:'E1',source:'FRED',reference:'https://fred.stlouisfed.org/',published_at:now,observed_at:now,expires_at:expires,state:'CURRENT'}]},content:{status:'AVAILABLE',summary:'Saved themes summary.',themes:[{name:'Saved rate uncertainty',description:'Saved description from Luna.',significance_score:2,implication:'MIXED',market_implications:'Saved crypto implication.',evidence_ids:['E1']}]}}};
 const observation=(values,extra={})=>({state:'CURRENT',source_at:now,observed_at:now,expires_at:expires,values,...extra});
 const frames=Object.fromEntries(['15m','1h','4h'].map(tf=>[tf,observation({direction:'UP',return_pct:0.4,momentum:0.2})]));
 const index=(value)=>({state:'CURRENT',source_at:now,observed_at:now,expires_at:expires,value,session_context:'DAILY_CASH_INDEX_CLOSE_NOT_LIVE_OR_FUTURES',observation_date:now.slice(0,10)});
 const feed={version:'paper-read-api-v1',mode:'paper',served_at:now,sentiment:{status:'USABLE',context_state:'CURRENT',availability:'AVAILABLE',assessment_timestamp:now,market_direction:'UP',risk_regime:'RISK_ON',risk_regime_status:'VALIDATED'},overview:{version:'paper-overview-v1',purpose:'PUBLIC_SAVED_OBSERVATIONS_ONLY',interpretation,crypto:{BTCUSDT:{frames},ETHUSDT:{frames}},cash_indexes:{NASDAQ100:index(18000),SP500:index(5500)},breadth:observation({rising_24h_pct:60,falling_24h_pct:30,assets_included:10},{health:'AVAILABLE'}),fear_greed:observation({value:55,classification:'Neutral'}),research:{catalogue:{state:'CURRENT',observed_at:now,pool_asset_count:2,assessed_count:2,eligible_count:2,assets:[{symbol:'BTCUSDT',pair:'BTCUSDT/USDT:USDT',technically_assessed:true,price:68000,change_24h_pct:1.2},{symbol:'ETHUSDT',pair:'ETHUSDT/USDT:USDT',technically_assessed:true,price:3500,change_24h_pct:-0.5}]}}}};
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://v4.rrr.trading/**',route=>route.fulfill({json:{}}));
 await page.route('https://v4.rrr.trading/v4/paper',route=>route.fulfill({json:feed}));
 await page.route('https://api.rrr.trading/**',route=>route.fulfill({json:{version:'paper-read-api-v1',mode:'paper',availability:'UNAVAILABLE'}}));
 await page.route('https://v4.rrr.trading/v4/intelligence',route=>route.fulfill({json:{version:'theme-intelligence-read-v1',read_only:true,mode:'paper',scope:'SHARED',availability:'AVAILABLE',omitted:12,themes:[
  {id:'t1',scope:'MACRO',status:'ACTIVE',name:'Lower ranked current theme',freshness:'CURRENT',verified_until:new Date(Date.now()+3600000).toISOString(),last_assessed_at:now,understanding:'Saved current understanding.',latest_development:'Recent saved development.',market_implications:'Saved market implications.',sources:[{source:'FRED',reference:'https://fred.stlouisfed.org/series/DGS10',published_at:now,observed_at:now}],significance_score:2},
  {id:'t2',scope:'CRYPTO',status:'ACTIVE',name:'Higher ranked current theme',freshness:'CURRENT',verified_until:new Date(Date.now()+3600000).toISOString(),last_assessed_at:now,understanding:'Saved understanding with no optional implication fields.',significance_score:9},
  {id:'t3',scope:'MACRO',status:'ACTIVE',name:'Middle ranked current theme',freshness:'CURRENT',verified_until:new Date(Date.now()+3600000).toISOString(),last_assessed_at:now,significance_score:5},
  {id:'t4',scope:'MACRO',status:'ACTIVE',name:'Historical theme',freshness:'STALE',verified_until:new Date(Date.now()-3600000).toISOString(),last_assessed_at:now,understanding:'Saved historical understanding.'},
  {id:'t5',scope:'MACRO',status:'RESOLVED',name:'Resolved theme',freshness:'STALE',verified_until:new Date(Date.now()-3600000).toISOString(),last_assessed_at:now}
 ]}}));
 await page.route('https://api.bybit.com/**',route=>route.fulfill({json:{retCode:0,result:{list:[]}}}));
 await page.goto('/macro/');
 await expect(page.getByRole('heading',{name:'Luna — Global Market Assessment'})).toBeVisible();
 await expect(page.locator('#luna-commentary')).toContainText('Saved Luna interpretation');
 await expect(page.getByRole('heading',{name:'Current Macro Themes'})).toBeVisible();
 await expect(page.locator('#macro-themes .theme-card')).toHaveCount(4);
 await expect(page.locator('#macro-themes .theme-card').nth(0)).toContainText('Higher ranked current theme');
 await expect(page.locator('#macro-themes .theme-card').nth(1)).toContainText('Middle ranked current theme');
 await expect(page.locator('#macro-themes .theme-card').nth(3)).toContainText('STALE');
 await expect(page.locator('#macro-themes')).toContainText('Saved current understanding.');
 await expect(page.locator('#macro-themes')).toContainText('Saved market implications.');
 await expect(page.getByRole('link',{name:/View All Macro News/})).toHaveAttribute('href','/news/');
 await page.locator('#macro-themes .theme-card').nth(2).locator('details summary').click();
 await expect(page.locator('#macro-themes')).toContainText('FRED');
 await expect(page.locator('#breadth-value')).toContainText('60% rising');
 await expect(page.locator('#conditions-value')).toContainText('Nasdaq-100 18,000');
 await expect(page.locator('#crypto-grid')).toContainText('Bitcoin (BTC)');
 await expect(page.locator('#crypto-grid')).toContainText('$68,000');
 await page.locator('#crypto-grid [data-symbol="BTC"]').click();
 await expect(page.locator('#homepage-analysis-modal')).toBeVisible();
 await expect(page.locator('#homepage-analysis-title')).toHaveText('BTC — Asset Analysis');
 await page.locator('.homepage-analysis-close').click();
 await expect(page.locator('#homepage-analysis-modal')).toBeHidden();
 await expect(page.getByRole('link',{name:/View All Macro News/})).toHaveAttribute('href','/news/');
 for(const width of [1440,390]){await page.setViewportSize({width,height:950});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:`.runtime/macro-refresh-${width}.png`,fullPage:true});}
 expect(errors).toEqual([]);
});

test('persistent themes display independently when Luna assessment is unavailable',async({page})=>{
 const now=new Date().toISOString();
 await page.route('https://v4.rrr.trading/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/v4/intelligence')return route.fulfill({json:{version:'theme-intelligence-read-v1',read_only:true,mode:'paper',scope:'SHARED',availability:'AVAILABLE',themes:[{id:'macro-1',scope:'MACRO',status:'ACTIVE',name:'Saved independent theme',freshness:'CURRENT',verified_until:new Date(Date.now()+3600000).toISOString(),last_assessed_at:now,understanding:'Persistent intelligence works without Luna.'}]}});
  if(url.pathname==='/v4/paper')return route.fulfill({json:{version:'paper-read-api-v1',mode:'paper',served_at:now,overview:{version:'paper-overview-v1',purpose:'PUBLIC_SAVED_OBSERVATIONS_ONLY'}}});
  return route.fulfill({json:{}});
 });
 await page.goto('/macro/');
 await expect(page.locator('#luna-commentary')).toContainText('could not be validated');
 await expect(page.locator('#macro-themes')).toContainText('Saved independent theme');
});

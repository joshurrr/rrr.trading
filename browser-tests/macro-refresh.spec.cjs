const {test,expect}=require('@playwright/test');

test('macro overview follows the introduction and preserves observations and the shared asset overlay',async({page})=>{
 const now=new Date().toISOString(),expires=new Date(Date.now()+3600000).toISOString();
 const interpretation={state:'CURRENT',historical:false,health:'AVAILABLE',validation:'SAVED_SCHEMA_AND_ORIGINAL_EVIDENCE_VALIDATED',source_at:now,observed_at:now,expires_at:expires,assessment:{text:'Saved Luna interpretation: markets remain mixed with rates as a key influence.'},market_mood:{text:'Mixed crypto outlook'},directional_pressure:{text:'Neutral pressure'},drivers:[{text:'Rates remain a saved driver.'}],contradictions:[],uncertainty:['Policy path remains uncertain.'],provenance:{evidence:[{id:'E1',source:'FRED',reference:'https://fred.stlouisfed.org/',published_at:now,observed_at:now,expires_at:expires,state:'CURRENT'}]},news_and_themes:{state:'CURRENT',validation:'SAVED_SCHEMA_AND_ORIGINAL_EVIDENCE_VALIDATED',source_at:now,observed_at:now,expires_at:expires,provenance:{evidence:[{id:'E1',source:'FRED',reference:'https://fred.stlouisfed.org/',published_at:now,observed_at:now,expires_at:expires,state:'CURRENT'}]},content:{status:'AVAILABLE',summary:'Saved themes summary.',themes:[{name:'Saved rate uncertainty',description:'Saved description from Luna.',significance_score:2,implication:'MIXED',market_implications:'Saved crypto implication.',evidence_ids:['E1']}]}}};
 const observation=(values,extra={})=>({state:'CURRENT',source_at:now,observed_at:now,expires_at:expires,values,...extra});
 const frames=Object.fromEntries(['15m','1h','4h'].map(tf=>[tf,observation({direction:'UP',return_pct:0.4,momentum:0.2})]));
 const index=(value)=>({state:'CURRENT',source_at:now,observed_at:now,expires_at:expires,value,session_context:'DAILY_CASH_INDEX_CLOSE_NOT_LIVE_OR_FUTURES',observation_date:now.slice(0,10)});
 const feed={version:'paper-read-api-v1',mode:'paper',served_at:now,sentiment:{status:'USABLE',context_state:'CURRENT',availability:'AVAILABLE',assessment_timestamp:now,market_direction:'UP',risk_regime:'RISK_ON',risk_regime_status:'VALIDATED'},overview:{version:'paper-overview-v1',purpose:'PUBLIC_SAVED_OBSERVATIONS_ONLY',interpretation,crypto:{BTCUSDT:{frames},ETHUSDT:{frames}},cash_indexes:{NASDAQ100:index(18000),SP500:index(5500)},breadth:observation({rising_24h_pct:60,falling_24h_pct:30,assets_included:10},{health:'AVAILABLE'}),fear_greed:observation({value:55,classification:'Neutral'}),research:{catalogue:{state:'CURRENT',observed_at:now,pool_asset_count:2,assessed_count:2,eligible_count:2,assets:[{symbol:'BTCUSDT',pair:'BTCUSDT/USDT:USDT',technically_assessed:true,price:68000,change_24h_pct:1.2},{symbol:'ETHUSDT',pair:'ETHUSDT/USDT:USDT',technically_assessed:true,price:3500,change_24h_pct:-0.5}]}}}};
 const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 page.on('request',request=>{if(request.url().startsWith('https://v4.rrr.trading/'))requests.push(new URL(request.url()).pathname);});
 await page.route('https://v4.rrr.trading/**',route=>route.fulfill({json:{}}));
 await page.route('https://v4.rrr.trading/v4/paper',route=>route.fulfill({json:feed}));
 await page.route('https://api.rrr.trading/**',route=>route.fulfill({json:{version:'paper-read-api-v1',mode:'paper',availability:'UNAVAILABLE'}}));
 await page.route('https://api.bybit.com/**',route=>route.fulfill({json:{retCode:0,result:{list:[]}}}));
 await page.goto('/macro/');
 await expect(page.locator('#luna-title')).toHaveCount(0);
 await expect(page.locator('#direction-card')).toHaveCount(0);
 await expect(page.locator('#themes-title, #macro-themes, .theme-card')).toHaveCount(0);
 await expect(page.getByRole('link',{name:/View All Macro News/})).toHaveCount(0);
 await expect(page.locator('.macro-title + section')).toHaveAttribute('aria-labelledby','macro-overview-title');
 await expect(page.locator('#macro-feed-status')).toHaveText('Saved public V4 observation feed');
 await expect(page.locator('#snapshot-time')).toContainText('API feed snapshot');
 await expect(page.locator('#fear-value')).toHaveText('55 / 100');
 await expect(page.locator('#global-rows')).toContainText('S&P 500 cash index');
 await expect(page.locator('#breadth-value')).toContainText('60% rising');
 await expect(page.locator('#conditions-value')).toContainText('Nasdaq-100 18,000');
 await expect(page.locator('#crypto-grid')).toContainText('Bitcoin (BTC)');
 await expect(page.locator('#crypto-grid')).toContainText('$68,000');
 await page.locator('#crypto-grid [data-symbol="BTC"]').click();
 await expect(page.locator('#homepage-analysis-modal')).toBeVisible();
 await expect(page.locator('#homepage-analysis-title')).toHaveText('BTC — Asset Analysis');
 await page.locator('.homepage-analysis-close').click();
 await expect(page.locator('#homepage-analysis-modal')).toBeHidden();
 for(const width of [1440,390]){await page.setViewportSize({width,height:950});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:`.runtime/macro-refresh-${width}.png`,fullPage:true});}
 expect(requests).toContain('/v4/paper');
 expect(requests).not.toContain('/v4/intelligence');
 expect(errors).toEqual([]);
});

test('macro feed failure keeps the overview visible without requesting themes',async({page})=>{
 const requests=[],errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://v4.rrr.trading/**',route=>{
  requests.push(new URL(route.request().url()).pathname);
  return route.fulfill({json:{}});
 });
 await page.goto('/macro/');
 await expect(page.locator('#macro-feed-status')).toContainText('V4 public feed unavailable');
 await expect(page.locator('#breadth-value')).toHaveText('Unavailable');
 await expect(page.locator('#fear-value')).toHaveText('Unavailable');
 await expect(page.locator('#conditions-value')).toHaveText('Unavailable');
 await expect(page.locator('.macro-title + section')).toHaveAttribute('aria-labelledby','macro-overview-title');
 await expect(page.locator('#macro-themes')).toHaveCount(0);
 expect(requests).toContain('/v4/paper');
 expect(requests).not.toContain('/v4/intelligence');
 expect(errors).toEqual([]);
});

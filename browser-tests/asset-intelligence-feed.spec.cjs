const {test,expect}=require('@playwright/test');
test('asset intelligence compact feed preserves provenance, filtering and narrow layout',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<main style="background:#0e1a26;color:white;max-width:600px;padding:16px"><div id="host"></div></main>');
 await page.addStyleTag({path:'evolving-intelligence.css'});await page.addScriptTag({path:'evolving-intelligence.js'});
 let requests=0;page.on('request',()=>requests++);
 await page.evaluate(()=>window.EvolvingIntelligence.mount(document.getElementById('host'),{asset:'ETHUSDT',discovery:{status:'PARTIAL',warnings:['STALE collection evidence']},canonical:{status:'AVAILABLE',themes:[
 {id:'medium',name:'Medium theme',significance:'MEDIUM',scope:'CRYPTO',status:'ACTIVE',verified_until:new Date(Date.now()+3600000).toISOString()},
 ...Array.from({length:30},(_,i)=>({id:'high'+i,name:'Long asset theme title with a material development and source-linked market context '+i,significance:'HIGH',scope:'ASSET',affected_assets:['ETH'],status:i===1?'ESCALATING':'ACTIVE',verified_until:new Date(Date.now()+3600000).toISOString(),latest_development_at:'2026-01-01T00:00:00Z',last_assessed_at:new Date().toISOString(),last_verified_at:new Date().toISOString(),understanding:'Existing interpretation',market_implications:'Existing implications',sources:[{source:'Publisher one',reference:'https://example.com/one'},{source:'Publisher two',reference:'https://example.com/two'}]})),
 {id:'stale',name:'Stale theme',significance:'HIGH',scope:'MACRO',status:'ACTIVE',verified_until:'2020-01-01T00:00:00Z'}
 ]}}));
 await expect(page.locator('.evolving-theme')).toHaveCount(32);
 await expect(page.locator('#host > .evolving-theme').first()).toHaveAttribute('data-theme-id','high1');
 await expect(page.locator('.ei-warning')).toContainText(['PARTIAL','STALE collection evidence']);
 const selects=page.locator('.ei-filters select');
 await selects.first().selectOption('MEDIUM');await expect(page.getByRole('status')).toHaveText('1 matching themes');
 const medium=page.locator('[data-theme-id=medium]');await expect(medium.locator('> summary')).toContainText('Updated UNKNOWN');
 await selects.nth(1).selectOption('ASSET');await expect(page.getByText('No themes match these filters.',{exact:true})).toBeVisible();
 await selects.first().selectOption('All');await selects.nth(1).selectOption('All');
 const first=page.locator('#host > .evolving-theme').first();await first.locator('> summary').click();
 await expect(first).toContainText('First detected: UNKNOWN');await expect(first).toContainText('1 Jan 2026');
 await first.getByText('Supporting sources · publication evidence',{exact:true}).click();await expect(first.locator('a')).toHaveCount(2);
 expect(requests).toBe(0);
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:'.runtime/asset-feed-'+width+'.png',fullPage:true});}
 await page.evaluate(()=>window.EvolvingIntelligence.mount(document.getElementById('host'),{asset:'BTCUSDT',canonical:{status:'AVAILABLE',themes:[]}}));
 await expect(page.locator('.evolving-theme')).toHaveCount(0);await expect(page.getByRole('status')).toHaveText('0 matching themes');expect(errors).toEqual([]);
});
test('loaded asset feed retains unknown and additional significance without article impact inference',async({page})=>{
 await page.setContent('<div id="host"></div>');await page.addScriptTag({path:'evolving-intelligence.js'});
 await page.route('https://v4.rrr.trading/**',r=>r.fulfill({json:{version:'theme-intelligence-read-v1',read_only:true,mode:'paper',scope:'ASSET:BTC',availability:'AVAILABLE',themes:['LOW',undefined,'CRITICAL','HIGH'].map((significance,i)=>({id:String(i),name:'Theme '+i,scope:'ASSET',affected_assets:['BTC'],significance,status:'ACTIVE',freshness:'CURRENT',verified_until:new Date(Date.now()+3600000).toISOString(),sources:[{impact:'HIGH'}]}))}}));
 await page.evaluate(()=>window.EvolvingIntelligence.mount(document.getElementById('host'),{asset:'BTCUSDT'}));
 await expect(page.locator('.ei-impact')).toHaveText(['HIGH','LOW','UNKNOWN','CRITICAL']);
 await page.getByLabel('Impact').selectOption('LOW');await expect(page.getByRole('status')).toHaveText('1 matching themes');
});

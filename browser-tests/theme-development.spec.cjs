const {test,expect}=require('@playwright/test');

test('legacy prose is not repeated and grouped revisions retain their evidence',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const at='2026-10-28T12:21:58Z',claim='A funding proposal remains under discussion; no adoption is reported.';
 const source={source:'Publisher',reference:'https://example.test/proposal',published_at:at,observed_at:at};
 const theme={id:'th_'+'a'.repeat(24),name:'Funding proposal',scope:'ASSET',affected_assets:['ZEC'],status:'ACTIVE',freshness:'CURRENT',verified_until:'2099-01-01T00:00:00Z',understanding:claim,latest_development:claim,last_assessed_at:at,last_verified_at:at,latest_development_at:at,sources:[source]};
 await page.route('https://v4.rrr.trading/**',route=>route.fulfill({json:{version:'theme-intelligence-read-v1',mode:'paper',read_only:true,availability:'AVAILABLE',scope:'ASSET:ZEC',pending_status:'PENDING_UNASSESSED',themes:[theme],analysis:{scopes:[{scope:'ASSET:ZEC',status:'DEFERRED',last_completed_at:at,failure:{code:'assessment_not_due'}}]},history:[{...theme,related_revisions:[{...theme,seq:2,latest_development:'The proposal remains unresolved.',sources:[{...source,reference:'https://example.test/proposal?source=feed'}]}]}]}}));
 await page.goto('/evolving-intelligence.js');await page.setContent('<main><div id="host"></div></main>');
 await page.addStyleTag({path:'evolving-intelligence.css'});await page.addScriptTag({path:'evolving-intelligence.js'});
 await page.evaluate(()=>window.EvolvingIntelligence.mount(document.getElementById('host'),{asset:'ZEC'}));
 const card=page.locator('.evolving-theme');await card.locator('> summary').click();
 await expect(card.getByText(claim,{exact:true})).toHaveCount(1);
 await expect(card).toContainText('A separate consolidated interpretation was not recorded.');
 await expect(card.locator('> summary')).not.toContainText(claim);
 await expect(page.locator('#host')).toContainText('ASSET:ZEC: DEFERRED');
 await expect(page.locator('#host')).toContainText('assessment_not_due');
 await card.getByText('Development timeline',{exact:true}).click();
 await expect(card.getByText('1 repeated legacy assessments · original records',{exact:true})).toBeVisible();
 await card.getByText('1 repeated legacy assessments · original records',{exact:true}).click();
 await expect(card.getByText('The proposal remains unresolved.',{exact:true})).toBeVisible();
 await expect(card.locator('a[href="https://example.test/proposal?source=feed"]')).toHaveCount(1);
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:`.runtime/theme-development-${width}.png`,fullPage:true});}
 expect(errors).toEqual([]);
});

test('summary, understanding and development show distinct saved content',async({page})=>{
 const theme={id:'th_'+'b'.repeat(24),name:'Updated proposal',scope:'ASSET',affected_assets:['ZEC'],status:'ACTIVE',narrative:'Background: the proposal concerns future funding. A vote remains outstanding.',understanding:'Funding remains subject to an unresolved governance decision.',latest_development:'The committee published an amended proposal.',sources:[]};
 await page.route('https://v4.rrr.trading/**',r=>r.fulfill({json:{version:'theme-intelligence-read-v1',mode:'paper',read_only:true,availability:'AVAILABLE',scope:'ASSET:ZEC',themes:[theme]}}));
 await page.goto('/evolving-intelligence.js');await page.setContent('<div id="host"></div>');await page.addScriptTag({path:'evolving-intelligence.js'});
 await page.evaluate(()=>window.EvolvingIntelligence.mount(document.getElementById('host'),{asset:'ZEC'}));await page.locator('.evolving-theme > summary').click();
 for(const key of ['narrative','understanding','latest_development'])await expect(page.getByText(theme[key],{exact:true})).toHaveCount(1);
});

const {test,expect}=require('@playwright/test');
test('evolving intelligence scopes, timeline, stale history and responsive cards',async({page})=>{
 const now=new Date().toISOString(),expiry=new Date(Date.now()+3600000).toISOString();
 const source={source:'Ethereum Foundation',reference:'https://blog.ethereum.org/en/hoodi',published_at:'2026-10-22T00:00:00Z',observed_at:now};
 const theme={id:'th_'+'a'.repeat(24),name:'Glamsterdam upgrade developments',scope:'ASSET',affected_assets:['ETH'],status:'ACTIVE',freshness:'CURRENT',verified_until:expiry,understanding:'Deposit-rule fix reported; Hoodi activation remains unconfirmed.',latest_development:'Deposit-rule fix reported.',latest_development_at:now,last_assessed_at:now,last_verified_at:now,positive_catalysts:[{text:'Deposit-rule fix reported.'}],negative_catalysts:[{text:'Hoodi activation postponed.'}],unresolved_questions:['Has activation resumed?'],contradictions:['Replacement date unconfirmed.'],uncertainty:['Independent confirmation limited.'],sources:[source]};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://v4.rrr.trading/**',route=>{const u=new URL(route.request().url());if(u.pathname==='/v4/intelligence')return route.fulfill({json:{version:'theme-intelligence-read-v1',mode:'paper',read_only:true,availability:'AVAILABLE',scope:u.searchParams.get('asset')?'ASSET:ETH':'SHARED',pending_status:'PENDING_UNASSESSED',theme_summary:{latest_assessment_at:'2026-10-29T10:00:00Z',latest_verification_at:'2026-10-29T09:00:00Z',active_count:2,current_verification_count:1},themes:[theme,theme,{...theme,id:'th_'+'b'.repeat(24),name:'Resolved earlier issue',status:'RESOLVED',freshness:'STALE'}],history:[{seq:2,status:'ACTIVE',latest_development:'Bug fix reported.',latest_development_at:'2026-10-27T00:00:00Z',sources:[source]},{seq:1,status:'ACTIVE',latest_development:'Hoodi postponed.',latest_development_at:'2026-10-22T00:00:00Z',sources:[source]}]}});return route.fulfill({json:{}});});
 await page.goto('/evolving-intelligence.js');
 await page.setContent('<main style="background:#080d14;color:white;max-width:1200px;margin:auto"><div id="host"></div></main>');
 await page.addStyleTag({path:'evolving-intelligence.css'});
 await page.addScriptTag({path:'evolving-intelligence.js'});
 await page.evaluate(()=>window.EvolvingIntelligence.mount(document.getElementById('host'),{asset:'ETHUSDT'}));
 await expect(page.locator('.evolving-theme')).toHaveCount(2);
 await expect(page.locator('#host')).toContainText('PENDING_UNASSESSED');
 await expect(page.locator('#host')).toContainText('Latest Luna theme assessment');
 await expect(page.locator('#host')).toContainText('2 active themes');
 const active=page.locator('.evolving-theme').first();await active.locator('> summary').click();
 await expect(active).toContainText('Has activation resumed?');await expect(active).toContainText('Hoodi activation postponed.');
 await active.getByText('Development timeline',{exact:true}).click();
 await expect(active.locator('ol li').first()).toContainText('Hoodi postponed.');await expect(active.locator('ol li').last()).toContainText('Bug fix reported.');
 await expect(page.locator('.evolving-history')).not.toHaveAttribute('open','');
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:'.runtime/evolving-'+width+'.png',fullPage:true});}
 await page.evaluate(()=>window.EvolvingIntelligence.mount(document.getElementById('host')));
 await expect(page.locator('.evolving-theme')).toHaveCount(0); // Asset themes never appear in shared scope.
 expect(errors).toEqual([]);
});
test('saved themes render in the actual asset tab and macro page',async({page})=>{
 const now=new Date().toISOString(),expiry=new Date(Date.now()+3600000).toISOString();
 const selection={symbol:'ETHUSDT',exchange:'bybit',instrument_type:'linear_perpetual',side:'LONG',rank:1,timeframe:'1h',observed_at:now,expires_at:expiry,state:'CURRENT'};
 const shortlists={LONG:{state:'CURRENT',items:[selection]},SHORT:{state:'CURRENT',items:[]}};
 const theme={id:'th_'+'c'.repeat(24),name:'Saved evolving theme',scope:'ASSET',affected_assets:['ETH'],status:'ACTIVE',freshness:'STALE',verified_until:'2026-10-22T00:00:00Z',understanding:'Reported fix; broader activation remains unconfirmed.',latest_development:'Fix reported.',latest_development_at:now,last_assessed_at:now,last_verified_at:'2026-10-22T00:00:00Z',unresolved_questions:['Activation date unknown.'],sources:[]};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://v4.rrr.trading/**',r=>{const u=new URL(r.request().url());if(u.pathname==='/v4/intelligence'){const asset=u.searchParams.get('asset');return r.fulfill({json:{version:'theme-intelligence-read-v1',mode:'paper',read_only:true,availability:'AVAILABLE',scope:asset?'ASSET:ETH':'SHARED',pending_status:'NONE',themes:[{...theme,scope:asset?'ASSET':'MACRO'}]}});}if(u.pathname==='/v4/asset-analysis')return r.fulfill({json:{version:'asset-analysis-read-v1',mode:'paper',read_only:true,availability:'AVAILABLE',shortlists,assets:[{identity:{exchange:'bybit',instrument_id:'ETHUSDT',instrument_type:'linear_perpetual'},selection,technical:{},luna:{status:'NOT_ASSESSED',discovery:{status:'PARTIAL'}},sol:{records:[]},positions:[],trades:[]}]}});return r.fulfill({json:{version:'paper-read-api-v1',mode:'paper',served_at:now,overview:{version:'paper-overview-v1',purpose:'PUBLIC_SAVED_OBSERVATIONS_ONLY',shortlists},open_positions:{items:[]},completed_trades:{items:[]}}});});
 await page.route('https://api.bybit.com/**',r=>r.fulfill({json:{retCode:0,result:{list:[]}}}));
 await page.goto('/asset-analysis/');const frame=page.frameLocator('#page-content');await frame.locator('#asset-analysis-cards .aa-card').first().click();await frame.getByRole('tab',{name:'News & Intelligence',exact:true}).click();
 await expect(frame.locator('.evolving-theme')).toHaveCount(1);await expect(frame.locator('.evolving-theme')).toContainText('STALE');
 await expect(frame.getByText('Earlier saved assessments and article evidence',{exact:true})).toBeVisible();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:'.runtime/evolving-asset-page-'+width+'.png',fullPage:true});}
 await page.goto('/news/');await expect(page.locator('#persistent-intelligence .evolving-theme')).toHaveCount(1);await expect(page.locator('#persistent-intelligence')).toContainText('MACRO');await page.screenshot({path:'.runtime/evolving-macro-page.png',fullPage:true});expect(errors).toEqual([]);
});

 test('news preserves API priority without a legacy assessment request',async({page})=>{
  const now=new Date().toISOString(),expiry=new Date(Date.now()+3600000).toISOString();
  const requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://v4.rrr.trading/**',route=>{
   requests.push(new URL(route.request().url()).pathname);
   return route.fulfill({json:{version:'theme-intelligence-read-v1',mode:'paper',read_only:true,availability:'AVAILABLE',scope:'SHARED',pending_status:'NONE',theme_summary:{latest_assessment_at:now,latest_verification_at:now,active_count:2,current_verification_count:2},themes:[
    {id:'th_'+'d'.repeat(24),scope:'MACRO',name:'Older significant ongoing theme',significance:'HIGH',status:'ACTIVE',freshness:'CURRENT',verified_until:expiry,latest_development_at:'2026-10-20T00:00:00Z',understanding:'Supported market mechanism.',sources:[]},
    {id:'th_'+'e'.repeat(24),scope:'MACRO',name:'Newer limited theme',significance:'LOW',status:'EMERGING',freshness:'CURRENT',verified_until:expiry,latest_development_at:now,sources:[]}
   ]}});
  });
  await page.goto('/news/');
  await expect(page.locator('#persistent-intelligence .evolving-theme')).toHaveCount(2);
  await expect(page.locator('.evolving-theme').first()).toContainText('Older significant ongoing theme');
  await expect(page.locator('#luna-title')).toHaveCount(0);
  expect(requests).not.toContain('/v4/paper');expect(requests).not.toContain('/v4/admin');
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:'.runtime/news-themes-'+width+'.png',fullPage:true});}
  expect(errors).toEqual([]);
 });

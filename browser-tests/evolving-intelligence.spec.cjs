const {test,expect}=require('@playwright/test');
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

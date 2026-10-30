const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{await page.route('https://api.rrr.trading/**',r=>r.fulfill({json:{}}));});
const expiry='2099-01-01T00:00:00Z';
const make=(i,extra={})=>({id:'theme-'+i,name:'Saved theme '+i,scope:i%2?'CRYPTO':'MACRO',significance:i<3?'HIGH':i<10?'MEDIUM':'LOW',status:i===1?'ESCALATING':'ACTIVE',freshness:'CURRENT',verified_until:expiry,last_verified_at:'2026-10-30T00:00:00Z',last_assessed_at:'2026-10-30T00:00:00Z',understanding:'Saved Luna summary '+i+'. '+ 'Complete summary remains readable. '.repeat(10),sources:[],...extra});
const data=themes=>({version:'theme-intelligence-read-v1',read_only:true,mode:'paper',scope:'SHARED',availability:'AVAILABLE',pending_status:'PENDING_UNASSESSED',discovery:{status:'PARTIAL',last_successful_check:'2026-10-30T00:00:00Z'},themes});
test('news ranks, filters and reveals every loaded theme without extra requests',async({page})=>{
 const errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const themes=Array.from({length:25},(_,i)=>make(i));themes[0].sources=[{source:'Publisher',headline:'Older original headline',reference:'https://example.org/older',published_at:'2026-10-29T00:00:00Z'},{source:'Publisher',title:'Newer original headline',reference:'https://example.org/newer',published_at:'2026-10-30T00:00:00Z'},{source:'Unsafe reference',reference:'javascript:alert(1)'}];
 themes[2].understanding='<img src=x onerror=alert(1)> Saved as text';
 await page.route('https://v4.rrr.trading/**',r=>{calls.push(r.request().url());return r.fulfill({json:data([...themes].reverse())});});
 await page.goto('/news/');const cards=page.locator('#theme-list > details');
 await expect(cards).toHaveCount(10);await expect(cards.first()).toContainText('Saved theme 1');
 await expect(cards.nth(1)).toContainText('Saved theme 2');await expect(page.locator('#news-overview')).toContainText('AI analysis pending');
 await expect(cards.nth(1).locator('img')).toHaveCount(0);
 await page.getByRole('button',{name:'Show 10 More'}).click();await expect(cards).toHaveCount(20);
 await page.getByRole('button',{name:'Show 10 More'}).click();await expect(cards).toHaveCount(25);await expect(page.locator('#show-more')).toBeHidden();
 const original=page.locator('[data-theme-id="theme-0"]');await original.locator('> summary').click();
 await expect(original.locator('.news-source').first()).toContainText('Newer original headline');
 await expect(original.getByRole('link',{name:'Read original source ↗'})).toHaveCount(2);
 await expect(original.getByRole('link').first()).toHaveAttribute('href','https://example.org/newer');await expect(original.getByRole('link').first()).toHaveAttribute('target','_blank');
 await expect(original).toContainText('Article headline unavailable');await expect(original).not.toContainText('Saved Luna summary 1.');
 await original.locator('> summary').click();await expect(original).not.toHaveAttribute('open','');
 await page.getByRole('button',{name:/^Crypto/}).click();await expect(cards).toHaveCount(10);await expect(page.locator('#theme-count')).toHaveText('Showing 10 of 12 available themes matching this filter');
 await page.getByRole('button',{name:/^Escalating/}).click();await expect(cards).toHaveCount(1);
 await page.getByRole('button',{name:/^Macro/}).click();await expect(cards).toHaveCount(10);
 await page.getByRole('button',{name:/^All Themes/}).click();await expect(cards).toHaveCount(10);expect(calls).toHaveLength(1);
 await cards.first().locator('> summary').click();await expect(cards.first()).toContainText('No supporting article references are exposed');
 for(const width of [1200,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();const a=await cards.nth(0).boundingBox(),b=await cards.nth(1).boundingBox();expect(a.x).toBe(b.x);expect(a.width).toBe(b.width);expect(b.y).toBeGreaterThanOrEqual(a.y+a.height);await page.screenshot({path:'.runtime/news-ranked-'+width+'.png',fullPage:true});}
 await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(cards).toHaveCount(10);expect(calls).toHaveLength(2);expect(errors).toEqual([]);
});
test('news preserves unknown data, resolved history and API omissions',async({page})=>{
 await page.route('https://v4.rrr.trading/**',r=>r.fulfill({json:{...data([make(0,{significance:'LOW',freshness:'STALE',verified_until:'2020-01-01T00:00:00Z',sources_omitted:2}),make(1,{status:'RESOLVED'})]),omitted:7}}));
 await page.goto('/news/');await expect(page.locator('#theme-list > details')).toHaveCount(1);await expect(page.locator('#theme-list')).toContainText('STALE');await expect(page.locator('#theme-limits')).toContainText('7 additional themes');await page.locator('#theme-list > details > summary').click();await expect(page.locator('#theme-list')).toContainText('2 additional sources retained');await page.locator('#theme-history > summary').click();await expect(page.locator('#theme-history')).toContainText('RESOLVED');
});


test('compact public header, actual counts, collection provenance and keyboard expansion',async({page})=>{
 const calls=[];
 await page.route('https://v4.rrr.trading/**',r=>{calls.push(r.request().url());return r.fulfill({json:{...data(Array.from({length:20},(_,i)=>make(i))),omitted:38,theme_summary:{active_count:58,current_verification_count:56,latest_assessment_at:'2026-10-29T08:14:00Z'}}});});
 await page.goto('/news/');
 await expect(page.getByRole('heading',{name:'Macro News & Themes',exact:true})).toBeVisible();
 await expect(page.getByText('AI-identified news themes ranked by their significance to cryptocurrency trading.',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'AI News Themes',exact:true})).toBeVisible();
 await expect(page.locator('#feed-status')).toBeHidden();
 await expect(page.locator('#news-overview')).toHaveText('58 themes tracked56 currentUpdated 10:00 amAI analysis pending');
 await expect(page.locator('#theme-count')).toHaveText('Showing 10 of 20 available themes · 58 tracked');
 const diagnostics=page.locator('.news-diagnostics');await expect(diagnostics).not.toHaveAttribute('open','');
 await diagnostics.locator('summary').click();
 await expect(page.locator('#collection-status')).toContainText('Latest AI analysis: 29 Oct 2026, 6:14 pm Brisbane');
 await expect(page.locator('#collection-status')).toContainText('AI analysis status: PENDING_UNASSESSED');
 const summary=page.locator('#theme-list > details > summary').first();
 await expect(summary.locator('.news-significance')).toHaveText('HIGH');
 await expect(summary.locator('.news-theme-meta')).toHaveText('HIGH · CRYPTO · ESCALATING · CURRENT');
 await expect(summary.locator('.news-theme-time')).toHaveText('Verified 30 Oct, 10:00 am · AI analysis 30 Oct, 10:00 am');
 await expect(summary.locator('.news-theme-time')).toHaveAttribute('title',/2026.*Brisbane/);
 await expect(summary).toHaveAttribute('aria-expanded','false');await summary.focus();await page.keyboard.press('Enter');
 await expect(summary).toHaveAttribute('aria-expanded','true');await expect(summary.locator('.news-expand')).toHaveText('Supporting News (0)');
 await page.keyboard.press('Space');await expect(summary).toHaveAttribute('aria-expanded','false');
 await page.getByRole('button',{name:'Show 10 More'}).click();await expect(page.locator('#theme-count')).toHaveText('Showing 20 of 20 available themes · 58 tracked');
 await expect(page.locator('#show-more')).toBeHidden();
 await page.getByRole('button',{name:/^Crypto/}).click();await expect(page.locator('#theme-count')).toHaveText('Showing 10 of 10 available themes matching this filter · 58 tracked');
 expect(calls).toEqual(['https://v4.rrr.trading/v4/intelligence']);
});

test('missing significance, collection times and failed refresh stay explicit',async({page})=>{
 let failed=false;await page.route('https://v4.rrr.trading/**',r=>failed?r.fulfill({status:503,json:{}}):r.fulfill({json:{...data([make(1,{significance:undefined,last_assessed_at:undefined,last_verified_at:undefined})]),discovery:{},pending_status:undefined}}));
 await page.goto('/news/');
 await expect(page.locator('.news-significance')).toHaveCount(0);
 await expect(page.locator('#news-overview')).toContainText('Updated UNKNOWN');await expect(page.locator('#news-overview')).toContainText('AI analysis status unknown');
 await expect(page.locator('.news-theme-time').first()).toHaveText('Verified UNKNOWN · AI analysis UNKNOWN');
 failed=true;await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await expect(page.locator('#feed-status')).toContainText('UNAVAILABLE');await expect(page.locator('#theme-list > details')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Refresh',exact:true})).toBeEnabled();await expect(page.locator('#theme-count')).not.toContainText('tracked');
});

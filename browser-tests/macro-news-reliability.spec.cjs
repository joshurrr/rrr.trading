const {test,expect}=require('@playwright/test');
const theme=i=>({id:'theme-'+i,name:'Macro topic '+i,scope:i%2?'MACRO':'CRYPTO',significance:'MEDIUM',status:'ACTIVE',freshness:'CURRENT',verified_until:'2099-01-01T00:00:00Z',understanding:'A supported interpretation with unresolved implications.',last_assessed_at:'2026-11-01T06:15:42+10:00',last_checked_at:'2026-11-01T00:38:36+10:00',sources:[]});
const report=themes=>({version:'theme-intelligence-read-v1',mode:'paper',read_only:true,scope:'SHARED',availability:'AVAILABLE',themes,pending_status:'PENDING_UNASSESSED',discovery:{status:'AVAILABLE',checked_at:'2026-11-02T18:30:00+10:00'},analysis:{scopes:[{scope:'MACRO',status:'DEFERRED',last_completed_at:'2026-11-02T18:17:07+10:00',failure:{code:'assessment_not_due'}}]}});
test.beforeEach(async({page})=>{await page.route('https://api.rrr.trading/**',r=>r.fulfill({json:{}}));});

test('canonical evidence and original catalyst generations render without repeated articles',async({page})=>{
 const source={record_id:'a',headline:'Recovered original publisher headline',source:'Publisher',reference:'https://example.test/article?b=2&a=1&a=0',content_key:'one',published_at:'2026-10-30T04:00:00Z',observed_at:'2026-10-31T14:38:36Z'};
 const version={...source,record_id:'b',reference:'https://example.test/article?a=0&b=2&a=1&utm_source=feed',content_key:'two'};
 const row={...theme(1),sources:[source,version],catalyst_support:{positive:[source],negative:[source,version]}};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://v4.rrr.trading/**',r=>r.fulfill({json:report([row])}));
 await page.goto('/news/');const card=page.locator('#theme-list > details');
 await expect(card.locator('> summary')).toContainText('Supporting News (1)');
 await expect(card.locator('.news-theme-time')).toContainText('Last source check 1 Nov, 12:38 am');
 await expect(card.locator('.news-theme-time')).toContainText('Last AI assessment 1 Nov, 6:15 am');
 await expect(page.locator('#news-overview')).toContainText('AI analysis deferred · assessment_not_due');
 await card.locator('> summary').click();
 await expect(card.locator('.news-source')).toHaveCount(1);
 await expect(card.getByRole('link',{name:'Read original source ↗'})).toHaveCount(1);
 await expect(card.locator('.news-source h4')).toHaveText(source.headline);
 await expect(card).toContainText('2 saved source versions · one article');
 const history=card.locator('.news-historical-evidence');await expect(history).not.toHaveAttribute('open','');
 await history.locator('> summary').click();await expect(history).toContainText('article listed above');
 await expect(history.locator('.news-source')).toHaveCount(0);
 await history.getByText('Original assessed source versions',{exact:true}).click();
 await expect(history).toContainText('1 Nov 2026, 12:38 am Brisbane');
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:`.runtime/macro-news-${width}.png`,fullPage:true});}
 expect(errors).toEqual([]);
});

test('all sixty-six themes can be loaded while existing ranking and filters remain usable',async({page})=>{
 const all=Array.from({length:66},(_,i)=>theme(i)),calls=[];
 await page.route('https://v4.rrr.trading/**',route=>{const u=new URL(route.request().url()),offset=Number(u.searchParams.get('offset')||0);calls.push(u.href);return route.fulfill({json:{...report(all.slice(offset,offset+20)),offset,total:66,next_offset:offset+20<66?offset+20:null,omitted:66-Math.min(20,66-offset),theme_summary:{active_count:66,current_verification_count:66}}});});
 await page.goto('/news/');const cards=page.locator('#theme-list > details');await expect(cards).toHaveCount(10);
 for(let turn=0;turn<8&&await cards.count()<66;turn++){await page.locator('#show-more').click();await expect(page.locator('#show-more')).toBeEnabled();}
 await expect(cards).toHaveCount(66);await expect(page.locator('#show-more')).toBeHidden();
 expect(new Set(await cards.evaluateAll(nodes=>nodes.map(n=>n.dataset.themeId))).size).toBe(66);
 expect(calls).toHaveLength(4);expect(calls.every(url=>new URL(url).pathname==='/v4/intelligence')).toBeTruthy();
 await page.getByRole('button',{name:/^Macro/}).click();await expect(cards).toHaveCount(10);
 await expect(page.locator('#theme-count')).toContainText('33 available themes matching this filter');
});

test('failed additional reads retain loaded themes and missing metadata stays explicit',async({page})=>{
 await page.route('https://v4.rrr.trading/**',route=>new URL(route.request().url()).searchParams.has('offset')?route.fulfill({status:503,json:{}}):route.fulfill({json:{...report(Array.from({length:20},(_,i)=>theme(i))),offset:0,total:66,next_offset:20}}));
 await page.goto('/news/');await page.locator('#show-more').click();await expect(page.locator('#theme-list > details')).toHaveCount(20);
 await page.locator('#show-more').click();await expect(page.locator('#feed-status')).toContainText('Additional themes could not be read');
 await expect(page.locator('#theme-list > details')).toHaveCount(20);await expect(page.locator('#show-more')).toBeEnabled();
});

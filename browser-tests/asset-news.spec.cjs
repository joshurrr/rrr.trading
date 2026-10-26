'use strict';
const { test, expect } = require('@playwright/test');

test('news deduplicates canonical article versions and labels evidence generations', async ({ page }) => {
  const assessed = '2026-10-26T04:28:00Z', discovered = '2026-10-26T04:43:00Z';
  const now = new Date().toISOString(), expires = new Date(Date.now()+3600000).toISOString();
  const identity = { exchange:'bybit', instrument_id:'ETHUSDT', instrument_type:'linear_perpetual' };
  const selection = { symbol:'ETHUSDT', exchange:'bybit', instrument_type:'linear_perpetual', side:'LONG', rank:1, timeframe:'1h', observed_at:now, expires_at:expires, state:'CURRENT' };
  const url='https://blog.ethereum.org/en/2026/10/05/transaction-assertions';
  const shared = { headline:'Ethereum transaction assertions', summary:'Verified publisher text.', published_at:'2026-10-05T00:00:00Z',
    provenance:{source:'blog.ethereum.org',reference:url,observed_at:assessed},last_verified_at:assessed,evidence_id:'ETH:N1' };
  const latest = { ...shared, evidence_id:undefined, last_verified_at:discovered, evidence_status:'CURRENT_VERIFIED',
    provenance:{...shared.provenance,reference:url+'?utm_source=feed#top'} };
  const changed = { ...latest, summary:'Publisher updated text.', first_verified_at:discovered };
  const history = { ...shared, headline:'Hoodi postponement', summary:'Prior testnet delay, resolution unknown.',
    evidence_status:'HISTORICAL_CONTEXT',evidence_id:'ETH:H1',
    provenance:{...shared.provenance,reference:'https://blog.ethereum.org/en/2026/10/22/glamsterdam-hoodi-delay'} };
  const luna={status:'PARTIAL',coverage:'LIMITED_COVERAGE',scope:'ASSET_SPECIFIC',timestamps:{timestamp:assessed,expires_at:expires},
    news_availability:'PARTIAL_DISCOVERY',assessment:{summary:'Prior evidence assessed.',uncertainty:[]},
    news:[shared,history,{...shared,evidence_id:'ETH:N2',provenance:{...shared.provenance,reference:url+'?ref=assessment'}}],
    verified_discovered_news:[latest,changed],retained_historical_news:[history],
    discovery:{checked_at:discovered},assessment_discovery:{checked_at:assessed}};
  const shortlists={LONG:{state:'CURRENT',source_at:now,items:[selection]},SHORT:{state:'CURRENT',items:[]}};
  const evidence={version:'asset-analysis-read-v1',mode:'paper',read_only:true,availability:'AVAILABLE',shortlists,
    assets:[{identity,selection,technical:{},luna,sol:{records:[]},positions:[],trades:[]}]};
  const errors=[],badApi=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.url().includes('v4.rrr.trading')&&response.status()>=400)badApi.push(response.status());});
  await page.route('https://v4.rrr.trading/**',route=>route.fulfill({json:route.request().url().endsWith('/v4/asset-analysis')?evidence:{version:'paper-read-api-v1',mode:'paper',overview:{shortlists},open_positions:{items:[]},completed_trades:{items:[]}}}));
  await page.route('https://api.bybit.com/**',route=>route.fulfill({json:{retCode:0,result:{list:[]}}}));
  await page.goto('/asset-analysis/');
  const content=page.frameLocator('#page-content');
  await content.locator('#asset-analysis-cards .aa-card').first().click();
  await content.getByRole('tab',{name:'News & Intelligence',exact:true}).click();
  const articles=content.locator('.aa-news-article');
  await expect(articles).toHaveCount(3); // Identical versions merge; changed publisher text stays separate.
  const original=articles.filter({hasText:'Verified publisher text.'});
  await expect(original).toHaveCount(1);
  await expect(original).not.toContainText('\uFFFD');
  await expect(original).toContainText('Used in Luna assessment');
  await expect(original).toContainText('Current verified discovery');
  await expect(original).toContainText('Verified after the assessment');
  await expect(original).toContainText('ETH:N1, ETH:N2');
  const updated=articles.filter({hasText:'Publisher updated text.'});
  await expect(updated).toContainText('Discovered after the assessment');
  await expect(updated).not.toContainText('Used in Luna assessment');
  await expect(articles.filter({hasText:'Hoodi postponement'})).toContainText('Historical context');
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    expect(await content.locator('html').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();
    await page.screenshot({path:'.runtime/asset-news-'+width+'.png',fullPage:true});
    await original.screenshot({path:'.runtime/asset-news-article-'+width+'.png'});
  }
  expect(errors).toEqual([]);expect(badApi).toEqual([]);
});

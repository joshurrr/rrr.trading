const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const source=n=>fs.readFileSync(n==='homepage-positions.js'&&process.env.POSITION_REVIEW_SOURCE
 ?path.resolve(process.env.POSITION_REVIEW_SOURCE):path.join(__dirname,'..',n),'utf8');
async function setup(page){
 await page.clock.install();
 await page.setContent('<div id="v4-overview"></div><section id="home-demo-positions"><div class="home-positions-heading"></div><span id="home-positions-state"></span><small id="home-position-time"></small><div id="home-position-list"></div></section>');
 await page.evaluate(()=>{
  const now=Date.now(),iso=n=>new Date(n).toISOString();
  const row=(id,decision,execution)=>({id,symbol:id+'USDT',exchange:'bybit',side:'LONG',availability:'AVAILABLE',quantity:'1',entry_price:'100',current_mark:'101',unrealized_pnl:'1',entered_at:iso(now-3600000),mark_observed_at:iso(now-1000),mark_expires_at:iso(now+120000),protection:{status:'ORIGINAL STOP',active_stop:'95',original_stop:'95',latest_decision:decision,review_result:execution,last_successful_review_at:iso(now-60000)}});
  window.fixture={version:'paper-read-api-v1',mode:'paper',served_at:iso(now),wallet:{availability:'AVAILABLE',as_of:iso(now-1000),revision:1,currency:'USDT',wallet_balance:'10000',equity:'10003',realized_pnl:'0',unrealized_pnl:'3',entry_fees_paid:'0',exit_fees_paid:'0',field_availability:Object.fromEntries(['wallet_balance','equity','realized_pnl','unrealized_pnl','entry_fees_paid','exit_fees_paid'].map(k=>[k,'AVAILABLE']))},open_positions:{availability:'AVAILABLE',items:[row('CLANKER','PROTECT','BLOCKED'),row('UNI','EXIT','BLOCKED'),row('BNB','HOLD','NOT_REQUESTED')]},completed_trades:{availability:'AVAILABLE',as_of:iso(now-1000),items:[]}};
  window.reply=structuredClone(window.fixture);window.calls=0;
  window.fetch=async url=>{if(url.includes('/charts'))return {ok:true,json:async()=>({})};window.calls++;return {ok:true,status:200,headers:{get:()=>null},json:async()=>structuredClone(window.reply)};};
 });
 await page.addScriptTag({content:source('public-financial-snapshot.js')});
 await page.addScriptTag({content:source('homepage-positions.js')});
}
test('recorded SOL decisions survive blocked execution and remain distinct from stops',async({page})=>{
 await setup(page);
 await page.evaluate(()=>HomeDemoPositions.render(fixture));
 await expect(page.locator('[data-position-key="CLANKER"] .home-ai-decision')).toHaveText('AI: STOP UNCHANGED');
 await expect(page.locator('[data-position-key="UNI"] .home-ai-decision')).toHaveText('AI: EXIT ADVISED');
 await expect(page.locator('[data-position-key="BNB"] .home-ai-decision')).toHaveText('AI: HOLD');
 await expect(page.locator('.home-protection-status').first()).toHaveText('STOP ACTIVE');
 await expect(page.locator('.home-position-reviewed').first()).toContainText('1m ago');
 const details=page.locator('[data-position-key="CLANKER"] .home-protection-details');
 await expect(details.locator('.home-position-review-outcome')).toBeHidden();
 await expect(details.locator('.home-position-stopline')).toBeHidden();
 await details.locator('summary').click();
 await expect(details.locator('.home-position-review-outcome')).toBeVisible();
 await expect(details.locator('.home-position-stopline')).toBeVisible();
 await details.locator('summary').click();
 await page.evaluate(()=>{
  fixture.open_positions.items[0].protection.review_result='STOP_ADJUSTED';
  fixture.served_at=new Date().toISOString();HomeDemoPositions.render(fixture);
 });
 await expect(page.locator('[data-position-key="CLANKER"] .home-ai-decision')).toHaveText('AI: STOP UPDATED');
 await page.evaluate(()=>{
  fixture.open_positions.items[0].protection.review_result='RECOMMENDATION_ONLY';
  HomeDemoPositions.render(fixture);
 });
 await expect(page.locator('[data-position-key="CLANKER"] .home-ai-decision')).toHaveText('AI: REVIEW RECORDED');
});

test('polling preserves completed reviews through failures, partial and older responses; closures and new IDs stay separate',async({page})=>{
 await setup(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(()=>{
  const iso=n=>new Date(n).toISOString(),now=Date.now();
  for(const [i,p] of fixture.open_positions.items.entries())p.sol_review={decision:i===1?null:p.protection.latest_decision,
   reviewed_at:i===1?null:p.protection.last_successful_review_at,fresh_until:iso(now+(i===2?-1:900000)),
   freshness:i===2?'STALE':'CURRENT',execution:i===0?'BLOCKED':'NOT_REQUESTED',
   latest_attempt:{status:i===1?'FAILED':i===0?'DEFERRED':'COMPLETED',at:iso(now-30000)},evidence_refs:['technical.15m']};
  window.reply=structuredClone(fixture);
 });
 await page.addScriptTag({content:source('v4-overview.js')});
 const card=id=>page.locator(`[data-position-key="${id}"]`);
 await expect(card('CLANKER').locator('.home-ai-decision')).toHaveText('AI: STOP UNCHANGED');
 await expect(card('CLANKER').locator('.home-position-review-outcome')).toContainText('Latest attempt: deferred');
 await expect(card('UNI').locator('.home-ai-decision')).toHaveText('AI: REVIEW FAILED');
 await expect(card('BNB').locator('.home-ai-decision')).toHaveText('AI: HOLD · STALE');
 await page.clock.fastForward(31000);
 expect(await page.evaluate(()=>calls)).toBe(2,'existing 30-second display poll only');
 await page.evaluate(async()=>{
  reply=structuredClone(fixture);reply.served_at=new Date().toISOString();reply.wallet.revision=2;
  reply.open_positions.items[0].sol_review.reviewed_at=new Date(Date.now()-120000).toISOString();
  reply.open_positions.items[0].sol_review.decision='EXIT';
  reply.open_positions.items[0].sol_review.latest_attempt={status:'COMPLETED',at:new Date(Date.now()-120000).toISOString()};
  reply.open_positions.items[1]={...reply.open_positions.items[1],id:'NEW-UNI',sol_review:{decision:null,reviewed_at:null,latest_attempt:{status:'MISSING'}}};
  await refreshV4Overview();
 });
 await expect(card('CLANKER').locator('.home-ai-decision')).toHaveText('AI: STOP UNCHANGED');
 await expect(card('CLANKER').locator('.home-position-review-outcome')).toContainText('Latest attempt: deferred');
 await expect(card('UNI')).toHaveCount(0);
 await expect(card('NEW-UNI').locator('.home-ai-decision')).toHaveText('AI: NOT REVIEWED');
 await page.evaluate(async()=>{reply=structuredClone(fixture);await refreshV4Overview();});
 await expect(card('UNI')).toHaveCount(0);
 await expect(card('NEW-UNI')).toHaveCount(1);
 // A new page/cache can reconstruct the recorded decision entirely from the API.
 await page.evaluate(()=>{const fresh=new PublicFinancialSnapshot.Cache();fresh.accept({...fixture,served_at:new Date().toISOString()});HomeDemoPositions.render(fresh.display().data);});
 await expect(card('CLANKER').locator('.home-ai-decision')).toHaveText('AI: STOP UNCHANGED');
 expect(errors).toEqual([]);
});

test('review details fit the actual homepage cards on desktop and mobile',async({page})=>{
 await setup(page);
 const data=await page.evaluate(()=>fixture);
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='127.0.0.1')return route.continue();
  if(url.pathname==='/v4/paper')return route.fulfill({json:data});
  return route.fulfill({json:{}});
 });
 await page.goto('/');
 const home=page.frameLocator('#page-content');
 await expect(home.locator('[data-position-key="CLANKER"] .home-ai-decision')).toHaveText('AI: STOP UNCHANGED');
 await page.reload();
 await expect(home.locator('[data-position-key="CLANKER"] .home-ai-decision')).toHaveText('AI: STOP UNCHANGED');
 fs.mkdirSync(path.join(__dirname,'../.runtime/position-review'),{recursive:true});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  expect(await home.locator('.home-position').evaluateAll(ns=>ns.every(n=>n.scrollWidth<=n.clientWidth+1))).toBe(true);
  await home.locator('#home-demo-positions').screenshot({path:path.join(__dirname,`../.runtime/position-review/${width}.png`)});
 }
});

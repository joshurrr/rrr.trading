'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function snapshot(){
 const now=Date.now(),iso=n=>new Date(n).toISOString(),at=iso(now-900000),observed=iso(now-1000),end=iso(now+300000);
 const current={state:'CURRENT',source_at:observed,observed_at:observed,expires_at:end};
 return {version:'paper-read-api-v1',mode:'paper',served_at:observed,
  market_prices:Object.fromEntries(['BTCUSDT','ETHUSDT'].map(symbol=>[symbol,{symbol,source:'bybit',availability:'AVAILABLE',price:100,change_24h_pct:2,...{source_at:observed,observed_at:observed,expires_at:end}}])),
  overview:{cash_indexes:{NASDAQ100:{...current,value:28437.17,change_1d_pct:-0.7,session_context:'DAILY_CASH_INDEX_CLOSE_NOT_LIVE_OR_FUTURES'}},
   fear_greed:{...current,values:{value:50,classification:'Neutral'}},breadth:{...current,health:'AVAILABLE',values:{rising_24h_pct:84,falling_24h_pct:16,assets_included:10}},
   nasdaq_futures:{state:'CURRENT',source:'narwhal',instrument:'NQ',value:28485.5,source_at:at,observed_at:observed,expires_at:end,
    session:{cash:'CLOSED',futures:'OPEN'},session_source_at:observed,session_expires_at:end,delayed:true,quote_delay_seconds:900,
    frames:Object.fromEntries([['15m',900,0.24,'RISING'],['1h',3600,-0.51,'FALLING']].map(([tf,seconds,return_pct,direction])=>[tf,{state:'AVAILABLE',return_pct,direction,from_at:iso(now-900000-seconds*1000),to_at:at}])),
    momentum:'WEAKENING',potential_reversal:false,continuity_warning:'Contract continuity unverified'}}};
}
async function setup(page){
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.setContent('<body id="home"><section id="v4-overview"><section class="home-market-strip"><div class="home-market-heading"><h2>Market Overview</h2><small id="home-market-updated"></small></div><div id="home-market-cards" class="home-market-cards" aria-live="polite"></div></section></section></body>');
 await page.addStyleTag({content:'body{margin:0;background:#080d14;color:#e8f1fa;font-family:Arial,sans-serif}#v4-overview{max-width:1200px;margin:auto;--home-panel-divider:#243341}'});
 await page.addStyleTag({content:source('homepage-redesign-dashboard.css')});
 await page.addScriptTag({content:source('homepage-redesign-dashboard.js')});
 return {errors,requests};
}
async function send(page,data,retained=false){await page.evaluate(detail=>window.dispatchEvent(new CustomEvent('rrr-v4-home-position-snapshot',{detail})),{data,diagnostics:{display:retained?'RETAINED':'CURRENT'}});}
const card=page=>page.locator('.home-market-card').nth(3);

test('cash session preserves formatting; futures switches only this card with independent arrows and momentum',async({page})=>{
 const {errors,requests}=await setup(page),data=snapshot();data.overview.nasdaq_futures.session.cash='OPEN';
 await send(page,data);await expect(card(page).locator('h3')).toHaveText('US · Nasdaq-100');
 await expect(card(page).locator('small')).toHaveText('-0.7% · last close');
 const others=await page.locator('.home-market-card').evaluateAll(nodes=>nodes.filter((_,i)=>i!==3).map(n=>n.outerHTML));
 data.overview.nasdaq_futures.session.cash='CLOSED';await send(page,data);
 await expect(card(page).locator('h3')).toHaveText('Nasdaq Futures (NQ)');
 await expect(card(page).locator('strong')).toHaveText('28,485.50');
 await expect(card(page).locator('[data-tone="positive"]')).toHaveText('↗ +0.24% 15m');
 await expect(card(page).locator('[data-tone="negative"]')).toHaveText('↘ -0.51% 1h');
 await expect(card(page).locator('.home-nasdaq-footer')).toContainText('Weakening · Delayed 15m');
 await expect(card(page).getByRole('link',{name:'Data by Narwhal API'})).toHaveAttribute('href','https://narwhalapi.com');
 expect(await page.locator('.home-market-card').evaluateAll(nodes=>nodes.filter((_,i)=>i!==3).map(n=>n.outerHTML))).toEqual(others);
 data.overview.nasdaq_futures.potential_reversal=true;await send(page,data);
 await expect(card(page).locator('.home-nasdaq-footer')).toContainText('Reversing');
 data.overview.nasdaq_futures.session.cash='OPEN';await send(page,data);
 await expect(card(page).locator('.home-nasdaq-footer')).toHaveCount(0);
 expect(requests).toEqual([]);expect(errors).toEqual([]);
});

test('closed, maintenance, missing, stale, expired session and retained snapshots fall back to cash',async({page})=>{
 await setup(page);
 for(const mode of ['closed','maintenance','missing','stale','expired','session-expired','retained']){
  const data=snapshot(),nq=data.overview.nasdaq_futures;
  if(mode==='closed')nq.session.futures='CLOSED';if(mode==='maintenance')nq.session.futures='MAINTENANCE';
  if(mode==='missing')delete data.overview.nasdaq_futures;if(mode==='stale')nq.state='STALE';
  if(mode==='expired')nq.expires_at=new Date(Date.now()-1).toISOString();
  if(mode==='session-expired')nq.session_expires_at=new Date(Date.now()-1).toISOString();
  await send(page,data,mode==='retained');
  await expect(card(page)).toHaveAttribute('data-nasdaq-mode','cash');
  await expect(card(page).locator('strong')).toHaveText('28,437.17');
  if(['closed','maintenance','stale','expired'].includes(mode))await expect(card(page).locator('small')).toContainText('Previous close');
 }
 const data=snapshot();delete data.overview.cash_indexes.NASDAQ100;
 data.overview.cash_indexes.SP500={value:99999};data.overview.nasdaq_futures.state='UNAVAILABLE';await send(page,data);
 await expect(card(page).locator('strong')).toHaveText('Unavailable');
});

test('insufficient calculations are neutral; zero is sideways; negative strengthening stays separate from direction',async({page})=>{
 await setup(page);const data=snapshot(),nq=data.overview.nasdaq_futures;
 nq.frames['15m']={state:'INSUFFICIENT_DATA',return_pct:99,direction:'RISING'};nq.frames['1h']={state:'INSUFFICIENT_DATA',return_pct:null};
 nq.momentum='STRENGTHENING';await send(page,data);
 await expect(card(page).locator('small')).toHaveText('— 15m— 1h');
 await expect(card(page).locator('.home-nasdaq-change[data-tone="neutral"]')).toHaveCount(2);
 await expect(card(page).locator('.home-nasdaq-footer')).toContainText('Momentum unavailable');
 const valid=snapshot();Object.assign(valid.overview.nasdaq_futures.frames['15m'],{return_pct:0,direction:'SIDEWAYS'});await send(page,valid);
 await expect(card(page).locator('small')).toContainText('→ 0.00% 15m');
 Object.assign(valid.overview.nasdaq_futures.frames['15m'],{return_pct:-0.24,direction:'FALLING'});valid.overview.nasdaq_futures.momentum='STRENGTHENING';await send(page,valid);
 await expect(card(page).locator('small')).toContainText('↘ -0.24% 15m');
 await expect(card(page).locator('.home-nasdaq-footer')).toContainText('Strengthening');
});

for(const width of [1440,390])test(`Nasdaq stays inside the existing card footprint at ${width}px`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});const {errors,requests}=await setup(page);
 const data=snapshot();data.overview.nasdaq_futures.session.cash='OPEN';await send(page,data);
 const before=await page.locator('.home-market-card').evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));
 data.overview.nasdaq_futures.session.cash='CLOSED';await send(page,data);
 const after=await page.locator('.home-market-card').evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));
 expect(after).toEqual(before);
 await card(page).scrollIntoViewIfNeeded();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 expect(await card(page).locator('small').evaluate(n=>n.scrollWidth<=n.clientWidth)).toBeTruthy();
 expect(await card(page).locator('h3').evaluate(n=>n.scrollWidth<=n.clientWidth)).toBeTruthy();
 await page.screenshot({path:testInfo.outputPath(`nasdaq-${width}.png`)});
 expect(errors).toEqual([]);expect(requests).toEqual([]);
});

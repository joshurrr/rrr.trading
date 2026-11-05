'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function snapshot(){const n=Date.now(),iso=x=>new Date(x).toISOString();return {version:'paper-read-api-v1',mode:'paper',served_at:iso(n),overview:{nasdaq:{state:'CURRENT',source:'BYBIT',instrument:'QQQUSDT',quote_currency:'USDT',value:620.25,source_at:iso(n-60000),observed_at:iso(n),expires_at:iso(n+540000),momentum:'WEAKENING',frames:{'15m':{state:'AVAILABLE',return_pct:-0.2,direction:'FALLING'},'1h':{state:'AVAILABLE',return_pct:0.3,direction:'RISING'}}}}};}
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

test('QQQ context and missing/stale handling without browser collection',async({page})=>{const {errors,requests}=await setup(page);const d=snapshot();await send(page,d);await expect(card(page).locator('strong')).toHaveText('620.25 USDT');await expect(card(page).locator('h3')).toContainText('QQQUSDT');await expect(card(page).locator('small')).toContainText('-0.20%');await expect(card(page).locator('small')).toContainText('+0.30%');await expect(card(page)).toContainText('Weakening');await expect(card(page)).not.toContainText('Delayed');d.overview.nasdaq.frames['15m']={state:'INSUFFICIENT_DATA',return_pct:null};await send(page,d);await expect(card(page).locator('[data-tone="neutral"]')).toHaveCount(1);d.overview.nasdaq.expires_at=new Date(Date.now()-1).toISOString();await send(page,d);await expect(card(page)).toHaveAttribute('data-state','STALE');delete d.overview.nasdaq;await send(page,d);await expect(card(page).locator('strong')).toHaveText('Unavailable');expect(requests).toEqual([]);expect(errors).toEqual([]);});
for(const width of [1440,390])test(`QQQ layout ${width}`,async({page},testInfo)=>{await page.setViewportSize({width,height:900});await setup(page);await send(page,snapshot());await card(page).scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();expect(await card(page).locator('small').evaluate(n=>n.scrollWidth<=n.clientWidth)).toBeTruthy();await card(page).screenshot({path:testInfo.outputPath('qqq-card.png')});});

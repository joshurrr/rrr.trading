const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const source=name=>fs.readFileSync(require('node:path').join(__dirname,'..',name),'utf8');
test('breadth rows distinguish participation, median return and paired momentum',async({page})=>{
 const pulse=source('index.html').match(/<section id="home-market-pulse"[\s\S]*?<\/section>/)[0];
 await page.setContent(`<body id="home"><main id="v4-overview"><div class="home-market-strip"><div id="home-market-cards"></div>${pulse}</div></main></body>`);
 await page.addStyleTag({content:source('homepage-redesign-dashboard.css')});
 await page.addScriptTag({content:source('homepage-redesign-dashboard.js')});
 await page.evaluate(()=>{
  const close=Date.parse('2026-11-16T02:50:00Z'),iso=t=>new Date(t).toISOString();
  const row=(up_pct,down_pct,covered=20)=>({up_pct,down_pct,covered});
  const crypto_breadth={tracked:20,source_at:iso(close),observed_at:iso(close+20_000),expires_at:iso(close+600_000),
    frames:{'5m':row(10,90),'15m':row(30,65),'1h':row(80,20),'4h':row(15,75,18)},
    momentum:{'5m':{median_pct:0,delta_pp:0,paired:20},'1h':{median_pct:0.9299,delta_pp:-0.403,paired:20},
      '4h':{median_pct:-0.3339,delta_pp:0.2168,paired:17}}};
  window.deliverBreadth=(offset,directions,changes)=> {
   if(directions)Object.keys(crypto_breadth.frames).forEach((key,i)=>{
    crypto_breadth.frames[key]=directions[i]>0?row(75,25):row(25,75);
    crypto_breadth.momentum[key]={median_pct:directions[i]/2,delta_pp:changes[i]/4,paired:20,
      improving_pct:changes[i]>0?75:changes[i]<0?25:50,deteriorating_pct:changes[i]<0?75:changes[i]>0?25:50};
   });
   window.dispatchEvent(new CustomEvent('rrr-v4-home-position-snapshot',{detail:{
    data:{version:'paper-read-api-v1',mode:'paper',served_at:iso(close+60_000),overview:{crypto_breadth}},
    diagnostics:{estimated_server_time_ms:close+offset}}}));
  };
  window.deliverBreadth(60_000);
 });
 const frames=page.locator('.home-pulse-frame');
 await expect(frames).toHaveCount(4);
 await expect(frames.nth(2).locator('.home-pulse-badge')).toHaveAttribute('aria-label','80% advancing, 20% declining');
 await expect(frames.nth(2)).toContainText('Median +0.9299%');
 await expect(frames.nth(2)).toContainText('10m: -0.403 pp · Bullish weakening');
 await expect(frames.nth(3)).toContainText('10m: +0.2168 pp · Bearish weakening');
 await expect(frames.nth(3)).toContainText('18/20 covered · 17/20 paired');
 await expect(frames.nth(0)).toContainText('10m: 0 pp · Steady');
 await expect(frames.nth(1)).toContainText('10m change unavailable');
 await expect(page.locator('#home-pulse-source')).toContainText(/12:50 pm AEST · CURRENT/i);
 await page.setViewportSize({width:320,height:800});
 expect(await frames.evaluateAll(cards=>cards.every(card=>card.scrollWidth<=card.clientWidth))).toBe(true);
 await page.evaluate(()=>window.deliverBreadth(600_000));
 await expect(page.locator('#home-pulse-source')).toContainText('STALE');
 await expect(frames.nth(2)).toContainText('Breadth stale');
 await expect(frames.nth(2)).not.toContainText('Median +0.9299%');
 const title=page.locator('#home-pulse-condition-title');
 const assessment=page.locator('#home-pulse-condition');
 await expect(title).toHaveText('Breadth stale');
 const up=[1,1,1,1],down=[-1,-1,-1,-1],split=[1,1,-1,-1];
 for(const [directions,changes,headline,tone] of [
  [up,up,'Buying pressure building','positive'],
  [down,down,'Selling pressure building','negative'],
  [split,up,'Momentum recovering','mixed'],
  [down,up,'Selling pressure easing','mixed'],
  [up,down,'Rally losing momentum','mixed'],
  [split,[1,1,0,-1],'Recovery attempt','mixed'],
  [down,[-1,1,1,-1],'Decliners lead','negative'],
  [up,[1,-1,-1,1],'Advancers lead','positive'],
  [split,[-1,1,1,-1],'No clear direction','mixed'],
 ]){
  await page.evaluate(([d,c])=>window.deliverBreadth(60_000,d,c),[directions,changes]);
  await expect(title).toHaveText(headline);
  await expect(assessment).toHaveAttribute('data-tone',tone);
 }
});

test('shared homepage refresh retains observations across expiry, timeout, partial and older responses',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();
 await page.setContent(`<body id="home"><div id="v4-overview"></div><div id="home-market-cards"></div><small id="home-market-updated"></small><div id="home-trading-performance"></div>${['net','open','positions','closed','fees'].map(id=>`<strong id="performance-${id}"></strong><small id="performance-${id}-note"></small>`).join('')}<small id="home-performance-time"></small><div id="home-sol-activity"><div id="sol-activity-list"></div><small id="sol-activity-time"></small></div></body>`);
 await page.evaluate(()=>{
  const now=Date.now(),iso=n=>new Date(n).toISOString(),at=iso(now-1000),end=iso(now+5000);
  window.fixture={version:'paper-read-api-v1',mode:'paper',served_at:iso(now),wallet:{availability:'AVAILABLE',as_of:at,revision:1,currency:'USDT',wallet_balance:100,equity:100,realized_pnl:0,unrealized_pnl:0,entry_fees_paid:0,exit_fees_paid:0,field_availability:Object.fromEntries(['wallet_balance','equity','realized_pnl','unrealized_pnl','entry_fees_paid','exit_fees_paid'].map(k=>[k,'AVAILABLE']))},open_positions:{availability:'AVAILABLE',inventory_availability:'AVAILABLE',items:[]},completed_trades:{availability:'AVAILABLE',as_of:at,items:[]},market_prices:Object.fromEntries(['BTCUSDT','ETHUSDT'].map(symbol=>[symbol,{symbol,source:'bybit',availability:'AVAILABLE',price:100,change_24h_pct:2,source_at:at,observed_at:at,expires_at:end}])),sol_activity:{version:'sol-activity-v1',mode:'paper',availability:'AVAILABLE',source_at:at,expires_at:iso(now+600000),entries_enabled:true,active_count:0,items:[]}};
  window.reply=structuredClone(window.fixture);window.calls=0;
  window.fetch=async()=>{window.calls++;if(window.reply==='hang')return new Promise(()=>{});if(window.reply==='fail')throw Error('network');return {ok:true,status:200,headers:{get:()=>null},json:async()=>structuredClone(window.reply)};};
  window.HomeDemoPositions={render(data,loading,diagnostics){window.dispatchEvent(new CustomEvent('rrr-v4-home-position-snapshot',{detail:{data,diagnostics}}));}};
 });
 for(const name of ['public-financial-snapshot.js','homepage-redesign-dashboard.js','homepage-performance.js','sol-activity.js','v4-overview.js'])await page.addScriptTag({content:source(name)});
 const btc=page.locator('.home-market-card').first();
 await expect(btc.locator('strong')).toHaveText('$100');
 await page.clock.fastForward(6000);
 await expect(btc).toHaveAttribute('data-state','STALE');
 await expect(btc.locator('strong')).toHaveText('$100');
 await page.evaluate(()=>{window.reply='hang';window.refreshV4Overview();window.refreshV4Overview();});
 await page.clock.fastForward(10001);
 await expect(page.locator('#home-performance-time')).toContainText('STALE');
 await expect(page.locator('#performance-net')).toContainText('0.00 USDT');
 await expect(page.locator('#sol-activity-time')).toContainText('STALE');
 expect(await page.evaluate(()=>window.calls)).toBe(2);
 await page.evaluate(async()=>{window.reply={...structuredClone(window.fixture),served_at:new Date().toISOString(),market_prices:{},sol_activity:null};await window.refreshV4Overview();});
 await expect(btc.locator('strong')).toHaveText('$100');
 await expect(page.locator('#sol-activity-list')).toContainText('current plans are unknown');
 await page.evaluate(async()=>{const at=new Date(Date.now()-100).toISOString();window.reply={...structuredClone(window.fixture),served_at:new Date(Date.now()+1).toISOString()};for(const item of Object.values(window.reply.market_prices))Object.assign(item,{price:200,source_at:at,observed_at:at,expires_at:new Date(Date.now()+60000).toISOString()});await window.refreshV4Overview();});
 await expect(btc.locator('strong')).toHaveText('$200');
 await expect(btc).toHaveAttribute('data-state','CURRENT');
 await page.evaluate(async()=>{window.reply=structuredClone(window.fixture);await window.refreshV4Overview();});
 await expect(btc.locator('strong')).toHaveText('$200');
 expect(errors).toEqual([]);
});

test('position cards keep timestamped stale prices and independent quantities',async({page})=>{
 await page.clock.install();
 await page.setContent('<div id="v4-overview"><section id="home-demo-positions"><div class="home-positions-heading"></div><span id="home-positions-state"></span><small id="home-position-time"></small><div id="home-position-list"></div></section></div>');
 await page.evaluate(()=>{
  const iso=ms=>new Date(Date.now()+ms).toISOString();
  window.position={id:'position-1',symbol:'BTCUSDT',side:'LONG',quantity:'2',entry_price:'100',entered_at:iso(-3600000),
    availability:'AVAILABLE',current_mark:'102',unrealized_pnl:'4',mark_observed_at:iso(-1000),mark_expires_at:iso(120000)};
  window.snapshot={version:'paper-read-api-v1',mode:'paper',served_at:iso(0),
    open_positions:{availability:'AVAILABLE',inventory_availability:'AVAILABLE',items:[window.position]}};
  window.reply=window.snapshot;window.calls=0;
  window.fetch=async()=>{
   window.calls++;
   if(window.reply==='fail')return {ok:false,status:503,headers:{get:()=>null}};
   if(window.reply==='delay')return new Promise(resolve=>{window.sendLate=()=>resolve({ok:true,status:200,headers:{get:()=>null},json:async()=>window.snapshot});});
   return {ok:true,status:200,headers:{get:()=>null},json:async()=>window.reply};
  };
 });
 for(const name of ['public-financial-snapshot.js','homepage-positions.js','v4-overview.js'])await page.addScriptTag({content:source(name)});
 const card=page.locator('.home-position'),mark=card.locator('[data-kind=current]'),pnl=card.locator('.home-position-profit');
 const size=card.locator('.home-position-allocation > div').filter({hasText:'Position Size'});
 const quantity=card.locator('.home-position-allocation > div').filter({hasText:'Quantity'});
 await expect(mark).toHaveText('Current102');
 await expect(pnl).toContainText('+4.00');
 await expect(quantity).toHaveText('Quantity2');

 await page.evaluate(async()=>{window.reply='fail';await window.refreshV4Overview();});
 await expect(mark).toHaveText('Mark · STALE102');
 await expect(card.locator('.home-position-observed')).toHaveText(/STALE · Last mark observed: .*\d{1,2}:\d{2}:\d{2}.* AEST/);
 await expect(pnl).toContainText('+4.00');
 await expect(size).toHaveText('Position Size204.00 USDT · STALE');

 await page.evaluate(async()=>{
  window.reply={...window.snapshot,served_at:new Date().toISOString(),open_positions:{availability:'UNAVAILABLE'}};
  await window.refreshV4Overview();
 });
 await expect(mark).toHaveText('Mark · STALE102');
 await expect(quantity).toHaveText('Quantity2');

 await page.evaluate(async()=>{
  window.reply={...window.snapshot,served_at:new Date().toISOString(),open_positions:{...window.snapshot.open_positions,
    availability:'STALE',items:[{...window.position,availability:'STALE',current_mark:null,unrealized_pnl:null,last_known_mark:'102',last_known_unrealized_pnl:'4'}]}};
  await window.refreshV4Overview();
 });
 await expect(mark).toHaveText('Mark · STALE102');
 await expect(pnl).toContainText('+4.00');
 await expect(size).toContainText('204.00 USDT · STALE');

 await page.evaluate(async()=>{
  window.reply={...window.snapshot,served_at:new Date().toISOString(),open_positions:{...window.snapshot.open_positions,
    items:[{...window.position,quantity:'1.5',availability:'UNAVAILABLE',current_mark:null,unrealized_pnl:null}]}};
  await window.refreshV4Overview();
 });
 await expect(quantity).toHaveText('Quantity1.5');
 await expect(mark).toHaveText('Current—');
 await expect(pnl).not.toContainText('+4.00');

 await page.evaluate(()=>{window.reply='delay';window.refreshV4Overview();window.refreshV4Overview();});
 await page.clock.fastForward(10001);
 await page.evaluate(async()=>{
  window.reply={...window.snapshot,served_at:new Date().toISOString(),open_positions:{...window.snapshot.open_positions,
    items:[{...window.position,quantity:'1.5',current_mark:'105',unrealized_pnl:'7.5',mark_observed_at:new Date().toISOString(),
      mark_expires_at:new Date(Date.now()+5000).toISOString()}]}};
  await window.refreshV4Overview();
  window.sendLate();
 });
 await expect(mark).toHaveText('Current105');
 await expect(pnl).toContainText('+7.50');
 expect(await page.evaluate(()=>window.calls)).toBe(7);
 await page.clock.fastForward(6000);
 await expect(mark).toHaveText('Mark · STALE105');
 await expect(pnl).toContainText('+7.50');
});

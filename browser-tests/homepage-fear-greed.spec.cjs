'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const snapshot=(value=34)=>{
  const now=Date.now(),at=new Date(now-1000).toISOString(),end=new Date(now+600000).toISOString();
  return {version:'paper-read-api-v1',mode:'paper',served_at:at,overview:{fear_greed:{state:'CURRENT',source_at:at,observed_at:at,expires_at:end,values:{value,classification:'Intentionally ignored'}}}};
};
async function send(page,data,diagnostics){
  await page.evaluate(detail=>window.dispatchEvent(new CustomEvent('rrr-v4-home-position-snapshot',{detail})),{data,diagnostics});
}
async function component(page){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<body id="home"><section id="v4-overview"><section class="home-market-strip"><div class="home-market-heading"><h2>Market Overview</h2><small id="home-market-updated"></small></div><div id="home-market-cards" class="home-market-cards" aria-live="polite"></div></section></section></body>');
  await page.addStyleTag({content:'body{margin:0;background:#080d14;font-family:Arial,sans-serif}#v4-overview{max-width:1200px;margin:auto;--home-panel-divider:#243341}'});
  await page.addStyleTag({content:source('homepage-redesign-dashboard.css')});
  await page.addScriptTag({content:source('homepage-redesign-dashboard.js')});
  return errors;
}

test('all sentiment boundaries update the existing SVG and exact gauge without requests or refresh',async({page})=>{
  const errors=await component(page),requests=[];
  page.on('request',r=>requests.push(r.url()));
  const face=page.locator('.home-fear-visual'),card=page.locator('.home-fear-card');
  const original=await face.elementHandle();
  const ranges=[[0,'extreme-fear','Extreme Fear'],[24,'extreme-fear','Extreme Fear'],[24.9,'extreme-fear','Extreme Fear'],[25,'fear','Fear'],[44,'fear','Fear'],[45,'neutral','Neutral'],[54,'neutral','Neutral'],[55,'greed','Greed'],[74,'greed','Greed'],[75,'extreme-greed','Extreme Greed'],[100,'extreme-greed','Extreme Greed']];
  for(const [value,key,label] of ranges){
    await send(page,snapshot(value));
    await expect(face).toHaveAttribute('data-sentiment',key);
    await expect(card.locator('strong')).toHaveText(Math.round(value)+' / 100');
    await expect(card.locator('small')).toHaveText(label);
    await expect(face.locator('.home-fear-expression[data-active="true"]')).toHaveAttribute('data-expression',key);
    const gauge=await face.locator('.home-fear-fill').evaluateAll(nodes=>nodes.reduce((sum,n)=>sum+1-Number(n.getAttribute('stroke-dashoffset')),0)*5);
    expect(gauge).toBeCloseTo(value,8);
  }
  expect(await face.evaluate((n,old)=>n===old,original)).toBeTruthy();
  expect(requests).toEqual([]);expect(errors).toEqual([]);
  const data=snapshot(34);
  await send(page,data);
  data.overview.fear_greed.values.value=34.25;
  await send(page,data);
  expect(await face.locator('.home-fear-fill').evaluateAll(nodes=>nodes.reduce((sum,n)=>sum+1-Number(n.getAttribute('stroke-dashoffset')),0)*5)).toBeCloseTo(34.25,8);
  await expect(card.locator('small')).toHaveText('Fear');
});

test('missing, invalid, stale, expired and retained evidence uses a grey neutral unavailable face',async({page})=>{
  await component(page);
  const card=page.locator('.home-fear-card'),face=card.locator('svg');
  const cases=[null,{},...[-1,101,null,'',true,'invalid',NaN,Infinity].map(v=>snapshot(v))];
  for(const mode of ['missing-time','future-time','bad-order','expired','stale','missing-values','wrong-mode']){
    const data=snapshot(80),fear=data.overview.fear_greed;
    if(mode==='missing-time')delete fear.source_at;
    if(mode==='future-time')fear.observed_at=new Date(Date.now()+60000).toISOString();
    if(mode==='bad-order')fear.expires_at=fear.source_at;
    if(mode==='expired')fear.expires_at=new Date(Date.now()-100).toISOString();
    if(mode==='stale')fear.state='STALE';
    if(mode==='missing-values')delete fear.values;
    if(mode==='wrong-mode')data.mode='live';
    cases.push(data);
  }
  for(const data of cases){
    await send(page,snapshot(80));
    await send(page,data);
    await expect(face).toHaveAttribute('data-sentiment','unavailable');
    await expect(card.locator('small')).toContainText('Unavailable');
    await expect(face.locator('[data-expression="neutral"]')).toHaveAttribute('data-active','true');
    expect(await face.locator('.home-fear-fill').evaluateAll(nodes=>nodes.every(n=>n.getAttribute('stroke-dashoffset')==='1'))).toBeTruthy();
  }
  await send(page,snapshot(80),{display:'RETAINED'});
  await expect(card).toHaveAttribute('data-state','STALE');
  await expect(card.locator('strong')).toHaveText('80 / 100');
  await expect(face).toHaveAttribute('data-sentiment','unavailable');
  await send(page,snapshot('0'));
  await expect(face).toHaveAttribute('data-sentiment','extreme-fear');
});

test('real homepage preserves desktop/mobile strip height, typography and reduced motion',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let reply=snapshot(100);
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1')return route.continue();
    return route.fulfill({json:url.pathname==='/v4/paper'?reply:{}});
  });
  await page.goto('/');
  const home=page.frameLocator('#page-content'),card=home.locator('.home-fear-card');
  await expect(card.locator('strong')).toHaveText('100 / 100');
  const homePage=await (await page.locator('#page-content').elementHandle()).contentFrame();
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:900});
    await card.scrollIntoViewIfNeeded();
    const metrics=await card.evaluate(n=>{
      const strip=n.closest('.home-market-strip'),face=n.querySelector('svg'),value=n.querySelector('strong'),note=n.querySelector('small');
      const height=strip.getBoundingClientRect().height;
      face.style.display='none';const before=strip.getBoundingClientRect().height;face.style.display='';
      return {height,before,face:face.getBoundingClientRect().toJSON(),card:n.getBoundingClientRect().toJSON(),value:getComputedStyle(value).fontSize,noteFits:note.scrollWidth<=note.clientWidth,docFits:document.documentElement.scrollWidth<=innerWidth};
    });
    expect(metrics.height).toBe(metrics.before);expect(metrics.value).toBe('15px');expect(metrics.noteFits).toBeTruthy();expect(metrics.docFits).toBeTruthy();
    expect(metrics.face.bottom).toBeLessThanOrEqual(metrics.card.bottom+1);
    await page.screenshot({path:'.runtime/fear-greed-home-'+width+'.png',fullPage:true});
  }
  await page.setViewportSize({width:1440,height:900});
  for(const [value,label] of [[10,'Extreme Fear'],[34,'Fear'],[50,'Neutral'],[65,'Greed'],[90,'Extreme Greed']]){
    reply=snapshot(value);
    await homePage.evaluate(()=>window.refreshV4Overview());
    await expect(card.locator('small')).toHaveText(label);
    await page.waitForTimeout(700);
    await card.screenshot({path:'.runtime/fear-greed-'+value+'.png'});
  }
  reply={...snapshot(),overview:{}};
  await homePage.evaluate(()=>window.refreshV4Overview());
  await expect(card.locator('svg')).toHaveAttribute('data-sentiment','unavailable');
  await page.waitForTimeout(700);await card.screenshot({path:'.runtime/fear-greed-unavailable.png'});
  reply=snapshot(65);await homePage.evaluate(()=>window.refreshV4Overview());
  expect(await card.locator('.home-fear-eyes').first().evaluate(n=>getComputedStyle(n).animationName)).toBe('home-fear-blink');
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await card.locator('svg,svg *,small').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).animationName==='none'&&getComputedStyle(n).transitionDuration==='0s'))).toBeTruthy();
  expect(errors).toEqual([]);
});

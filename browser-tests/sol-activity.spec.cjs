const {test,expect}=require('@playwright/test');
const path=require('node:path');
const fs=require('node:fs');
const now=()=>new Date().toISOString(),future=()=>new Date(Date.now()+600000).toISOString();
const view=()=>({version:'paper-read-api-v1',mode:'paper',sol_activity:{version:'sol-activity-v1',mode:'paper',availability:'AVAILABLE',source_at:now(),expires_at:future(),entries_enabled:true,active_count:2,items:[{symbol:'BTCUSDT',side:'SHORT',status:'PENDING',action:'WAIT_FOR_PULLBACK',expires_at:future(),last_candle_at:now()},{symbol:'ETHUSDT',side:'SHORT',status:'ARMED',action:'WAIT_FOR_PULLBACK',expires_at:future(),last_candle_at:now()}]}});
test('saved SOL plans show conditions and preserve stale, expired and unavailable states',async({page})=>{
  await page.setContent('<main style="max-width:1150px;margin:auto;background:#08121b;padding:20px"><section id="home-sol-activity"><h2>SOL Activity</h2><div id="sol-activity-list" role="status"></div><p id="sol-activity-time"></p></section></main>');
  await page.addStyleTag({path:path.join(__dirname,'../sol-activity.css')});
  await page.addScriptTag({path:path.join(__dirname,'../sol-activity.js')});
  const data=view();
  await page.evaluate(d=>window.HomeSolActivity.render(d),data);
  await expect(page.locator('#sol-activity-list')).toContainText('BTC · SHORT');
  await expect(page.locator('#sol-activity-list')).toContainText('Waiting for a pullback');
  await expect(page.locator('#sol-activity-list')).toContainText('Pullback confirmed');
  for(const width of [1200,390]){
    await page.setViewportSize({width,height:600});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await page.screenshot({path:'.runtime/sol-activity-'+width+'.png'});
  }
  data.sol_activity.availability='STALE';
  await page.evaluate(d=>window.HomeSolActivity.render(d),data);
  await expect(page.locator('#sol-activity-time')).toContainText('STALE');
  await expect(page.locator('#sol-activity-list')).toContainText('Last saved plan');
  data.sol_activity.items.forEach(r=>r.expires_at='2020-01-01T00:00:00Z');
  await page.evaluate(d=>window.HomeSolActivity.render(d),data);
  await expect(page.locator('#sol-activity-list')).not.toContainText('BTC');
  await page.evaluate(()=>window.HomeSolActivity.render(null));
  await expect(page.locator('#sol-activity-list')).toHaveText('SOL activity unavailable.');
});
test('homepage displays SOL activity from its shared paper snapshot',async({page})=>{
  const data={...view(),served_at:now(),wallet:{availability:'UNAVAILABLE'},open_positions:{availability:'AVAILABLE',items:[]},completed_trades:{availability:'AVAILABLE',as_of:now(),items:[]},overview:{}};
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='sol-preview.test'){
      const file=path.join(__dirname,'..',url.pathname==='/'?'index.html':decodeURIComponent(url.pathname));
      if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
      return route.fulfill({status:404,body:''});
    }
    return route.fulfill({json:url.pathname==='/v4/paper'?data:{}});
  });
  await page.goto('http://sol-preview.test/');
  const home=page.frameLocator('#page-content');
  await expect(home.locator('#home-sol-activity')).toBeVisible();
  await expect(home.locator('#sol-activity-list')).toContainText('BTC · SHORT');
  for(const width of [1200,390]){
    await page.setViewportSize({width,height:950});
    const panel=home.locator('#home-sol-activity');
    await panel.scrollIntoViewIfNeeded();
    expect(await panel.evaluate(n=>n.scrollWidth<=n.clientWidth)).toBeTruthy();
    await page.screenshot({path:'.runtime/sol-homepage-'+width+'.png',fullPage:true});
  }
});

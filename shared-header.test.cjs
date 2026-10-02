const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true,channel:'msedge'});
 const page = await browser.newPage();
 await page.route('https://api.rrr.trading/**', r=>r.fulfill({status:503,body:'Unavailable'}));
 await page.route('https://stream.radiorrr.com/**', r=>r.abort());
 for (const [url,key] of [['/','home'],['/#today','today'],['/#reports','reports'],['/#about','about'],['/demo','demo'],['/demo/short/','demo'],['/demo/long/','demo'],['/reports/2026-09-29.html','reports']]) {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://localhost:8765'+url);
  await page.waitForTimeout(800);
  assert.equal(await page.locator('.site-header').count(),1);
  assert.equal(await page.locator('#navigation [aria-current]').getAttribute('data-page'),key,url);
  assert(await page.locator('#radio-audio').evaluate(a=>a.paused&&!a.autoplay));
  for(const width of [1440,1024,901,768,390,320]) {
   await page.setViewportSize({width,height:900});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),url+' overflow '+width);
  }
  await page.locator('.menu-toggle').click();
  assert(await page.locator('#navigation').isVisible());
  await page.locator('#navigation a').first().focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');
 }
 // Dropdown works with mouse/touch and keyboard on desktop and narrow screens.
 for(const width of [1440,1024,901,768,390,320]) {
  await page.setViewportSize({width,height:900});
  await page.goto('http://localhost:8765/demo/');
  if(width<=900) await page.locator('.menu-toggle').click();
  await page.locator('#demo-toggle').click();
  assert.equal(await page.locator('#demo-toggle').getAttribute('aria-expanded'),'true');
  assert.deepEqual(await page.locator('#demo-options a').allTextContents(),['Medium 1hr','Short Term 15m','Long Term 4hr']);
  assert.equal(await page.locator('#demo-options [data-selected]').getAttribute('data-demo'),'medium');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Dropdown overflow '+width);
  const bounds=await page.locator('#demo-options').boundingBox();
  assert(bounds.x>=0 && bounds.x+bounds.width<=width,'Dropdown outside screen '+width);
  await page.locator('#demo-options a').first().focus();
  await page.keyboard.press('Escape');
  assert(await page.locator('#demo-options').isHidden());
  assert(await page.locator('#demo-toggle').evaluate(e=>e===document.activeElement));
  await page.keyboard.press('ArrowDown');
  assert(await page.locator('#demo-options a').first().evaluate(e=>e===document.activeElement));
  await page.locator('#demo-options [data-demo=short]').click();
  assert.equal(new URL(page.url()).pathname,'/demo/short/');
  assert.equal(await page.locator('h1').innerText(),'Live bot demo · Short Term 15m');
  await page.waitForFunction(()=>document.querySelector('#stateBadge').textContent==='UNAVAILABLE');
  assert.equal(await page.locator('#openRows tr,#historyRows tr,#settings .setting').count(),0);
  if(width<=900) await page.locator('.menu-toggle').click();
  await page.locator('#demo-toggle').click();
  assert.equal(await page.locator('#demo-options [data-selected]').getAttribute('data-demo'),'short');
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),`rrr-demo-dropdown-${width}.png`),fullPage:true});
  await page.locator('.sub').first().click();
  assert(await page.locator('#demo-options').isHidden());
  await page.locator('#demo-toggle').click();
  await page.locator('#demo-options [data-demo=medium]').click();
  assert.equal(new URL(page.url()).pathname,'/demo/');
 }
 await page.goto('http://localhost:8765/demo');
 await page.locator('#radio-audio').evaluate(a=>{a.play=()=>Promise.reject(new Error('Test stream failure'));});
 await page.locator('#radio-toggle').click();
 await page.waitForFunction(()=>document.querySelector('#radio-status').textContent.includes('unavailable'));
 assert.equal(await page.locator('#radio-toggle').getAttribute('aria-pressed'),'false');
 await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'rrr-shared-header-mobile.png')});
 await page.setViewportSize({width:1440,height:900});
 await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'rrr-shared-header-desktop.png')});
 await browser.close();
 console.log('PASS: shared header, active routes/sections, demo dropdown and both routes, unavailable short dashboard without medium feed, keyboard/Escape/outside-click, six widths, radio opt-in/error.');
})().catch(e=>{console.error(e);process.exit(1)});

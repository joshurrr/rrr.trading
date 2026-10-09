const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true,channel:'msedge'});
 const page = await browser.newPage();
 await page.route('https://api.rrr.trading/**', r=>r.fulfill({status:503,body:'Unavailable'}));
 await page.route('https://stream.radiorrr.com/**', r=>r.abort());
 for (const [url,key] of [['/','home'],['/about.html','about'],['/reports/2026-09-29.html','reports'],['/demo/15minbot/','short'],['/demo/1hrbot/','medium'],['/demo/4hrbot/','long']]) {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://localhost:8765'+url);
  await page.waitForTimeout(800);
  assert.equal(await page.locator('.site-header').count(),1);
  if(key==='reports') assert.equal(await page.locator('.operating-modes [aria-current]').count(),0);
  else if (['home','short','medium','long'].includes(key)) assert.equal(await page.locator('.operating-modes [aria-current="page"]').getAttribute('data-page'),['short','medium','long'].includes(key)?'bots':key,url);
  assert.deepEqual((await page.locator('.operating-modes .mode-button > span:last-child').allTextContents()).map(t=>t.trim()),['LIVE ANALYSIS','SCHEDULE','TRADING BOTS','TOOLS']);
  assert.equal(await page.locator('#navigation,.menu-toggle').count(),0);
  assert.equal(await page.locator('.demo-nav,#demo-toggle,#demo-options').count(),0);
  assert(await page.locator('#radio-audio').evaluate(a=>a.paused&&!a.autoplay));
  for(const width of [1440,1024,901,768,375,320]) {
   await page.setViewportSize({width,height:900});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),url+' overflow '+width);
  }
 }
 // Direct bot links remain available from the desktop and mobile mode buttons.
 for(const width of [1440,1024,901,768,375,320]) {
  await page.setViewportSize({width,height:900});
  await page.goto('http://localhost:8765/demo/15minbot/');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Navigation overflow '+width);
  await page.locator('.bots-menu-toggle').click();
  await page.locator('.operating-modes a[href="/demo/15minbot/"]').click();
  assert.equal(new URL(page.url()).pathname,'/demo/15minbot/');
  assert.equal(await page.locator('h1').innerText(),'15min bot - Live demo');
  await page.waitForFunction(()=>document.querySelector('#bot-state').textContent==='UNAVAILABLE');
  assert.equal(await page.locator('#open-trades tr,#completed-trades tr').count(),0);
  await page.locator('.bots-menu-toggle').click();
  await page.locator('.operating-modes a[href="/demo/1hrbot/"]').click();
  assert.equal(new URL(page.url()).pathname,'/demo/1hrbot/');
  assert.equal(await page.locator('.operating-modes a[aria-current="page"]').getAttribute('data-page'),'bots');
  await page.locator('.bots-menu-toggle').click();
  await page.locator('.operating-modes a[href="/demo/4hrbot/"]').click();
  assert.equal(new URL(page.url()).pathname,'/demo/4hrbot/');
  assert.equal(await page.locator('.operating-modes a[aria-current="page"]').getAttribute('data-page'),'bots');
  assert.equal(await page.locator('#final .big').innerText(),'UNKNOWN');
  assert.equal(await page.locator('.operating-modes a[href="/demo/4hrbot/"]').getAttribute('href'),'/demo/4hrbot/');
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
 console.log('PASS: shared header, direct mode links and active bot routes, unavailable short dashboard without medium feed, six widths, radio opt-in/error.');
})().catch(e=>{console.error(e);process.exit(1)});

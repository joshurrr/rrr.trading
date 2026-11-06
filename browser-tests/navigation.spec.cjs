'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');const path=require('node:path');
for(const mobile of [false,true]) test(`primary navigation ${mobile?'touch mobile':'desktop'}`,async({browser})=>{
 const context=await browser.newContext({viewport:{width:mobile?375:1440,height:900},hasTouch:mobile,isMobile:mobile});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='rrr.trading'){let file=path.join(process.cwd(),u.pathname);if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');return route.fulfill({path:file});}return route.fulfill({json:{}});});
 await page.goto('https://rrr.trading/');
 const nav=page.locator('.operating-modes');
 await expect(nav.locator('.mode-button')).toHaveText(['OVERVIEW','NEWS ▾','ASSETS ▾','ADMIN']);
 for(const [key,labels,paths] of [['intelligence',['News & Themes','Market Conditions','Economic Calendar'],['/news/','/macro/','/schedule/']],['v4-trading',['Asset Explorer','Asset Analysis'],['/asset-explorer/','/asset-analysis/']]]){
  const button=nav.locator(`[data-page="${key}"]`),menu=page.locator(`#${key}-shortcuts`);
  await button.focus();await button.press('ArrowDown');await expect(menu.locator('a')).toHaveText(labels);await expect(menu.locator('a').first()).toBeFocused();await page.keyboard.press('Escape');await expect(menu).toBeHidden();await expect(button).toBeFocused();
  for(let i=0;i<paths.length;i++){
   if(mobile)await button.tap();else await button.click();
   await expect(menu).toBeVisible();await expect(menu.locator('a').nth(i)).toHaveAttribute('href','https://rrr.trading'+paths[i]);
   await menu.locator('a').nth(i).click();await expect(page).toHaveURL('https://rrr.trading'+paths[i]);await expect(button).toHaveAttribute('aria-current','page');await expect(menu.locator('a').nth(i)).toHaveAttribute('aria-current','page');await expect(menu).toBeHidden();
  }
  await button.click();await page.screenshot({path:`.runtime/navigation-${key}-${mobile?'mobile':'desktop'}.png`});await page.locator('.brand').click();await expect(nav.locator('[data-page="home"]')).toHaveAttribute('aria-current','page');
 }
 for(const [url,key] of [['/news/','intelligence'],['/macro/','intelligence'],['/schedule/','intelligence'],['/asset-explorer/','v4-trading'],['/asset-analysis/','v4-trading']]){await page.goto('https://rrr.trading'+url);await expect(nav.locator(`[data-page="${key}"]`)).toHaveAttribute('aria-current','page');}
 await expect(nav.locator('[data-page="tools"]')).toHaveAttribute('href','https://admin.rrr.trading/');
 expect(await nav.evaluate(el=>el.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);await context.close();
});


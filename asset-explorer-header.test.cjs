const {chromium}=require('playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');

(async()=>{
 const server=http.createServer((req,res)=>{
  let file=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(file.endsWith('/'))file+='index.html';
  fs.readFile(path.join(__dirname,file),(error,data)=>{
   res.writeHead(error?404:200,{'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
   res.end(error?'missing':data);
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();
  await page.route('https://api.rrr.trading/**',route=>route.fulfill({status:503,body:'unavailable'}));
  const base='http://127.0.0.1:'+server.address().port;
  const expected=[
   ['Macro Intelligence','/macro/'],['News & Market Themes','/news/'],['Economic Calendar','/schedule/'],
   ['Market Conditions','/market-conditions/'],['Research News','/research-news/'],
   ['Trading Assessment','/trading-assessment/'],['Asset Explorer','/asset-explorer/']
  ];
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   let homepage;
   for(const [name,route] of [['homepage','/'],['asset-explorer','/asset-explorer/']]){
    await page.goto(base+route);
    const toggle=page.locator('[aria-controls="intelligence-shortcuts"]');
    await toggle.waitFor();
    await toggle.click();
    const menu=page.locator('#intelligence-shortcuts');
    assert(await menu.isVisible(),name+' dropdown visible at '+width);
    assert.deepEqual(await menu.locator('a').evaluateAll(nodes=>nodes.map(a=>[a.textContent.trim(),a.pathname])),expected,name+' menu at '+width);
    if(name==='homepage')homepage=await page.evaluate(()=>[...document.querySelectorAll('[data-site-header] .site-header,.operating-modes,#intelligence-shortcuts')].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}));
    else{
     const explorer=await page.evaluate(()=>[...document.querySelectorAll('[data-site-header] .site-header,.operating-modes,#intelligence-shortcuts')].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}));
     assert.deepEqual(explorer,homepage,'header, navigation and dropdown geometry at '+width);
     assert.equal(await page.locator('#intelligence-shortcuts a[aria-current="page"]').getAttribute('href'),'/asset-explorer/');
    }
   }
  }
  console.log('PASS homepage and Asset Explorer share menu entries, order and desktop/mobile header geometry');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});

const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.resolve(__dirname,'.'+new URL(req.url,'http://localhost').pathname);if(file!==__dirname&&!file.startsWith(__dirname+path.sep))return res.writeHead(403).end();if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.pathname==='/radio-navigation.js')return route.fulfill({body:'// Isolate the homepage layout.'});return url.hostname==='127.0.0.1'?route.continue():route.abort();});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForSelector('[data-site-header] .site-header');
  for(const width of [1920,1440,1200,1024,768,390,320]){
   await page.setViewportSize({width,height:1000});
   const sizes=await page.evaluate(()=>{
    const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};};
    return {header:rect('[data-site-header] .site-header'),navigation:rect('[data-site-header] .operating-modes'),panels:[...document.querySelectorAll('#v4-overview > section')].filter(e=>e.getBoundingClientRect().height>0).map(e=>{const r=e.getBoundingClientRect();return {id:e.id||e.className,left:r.left,right:r.right,width:r.width};}),overflow:document.documentElement.scrollWidth>innerWidth};
   });
   console.log(width+'px '+JSON.stringify(sizes));
   assert(sizes.header.width<=1200,'1200px maximum');assert(sizes.panels.length>=2,'visible body panels');
   for(const panel of [sizes.navigation,...sizes.panels]){
    assert(Math.abs(panel.left-sizes.header.left)<1,`${width}px ${panel.id||'navigation'} left edge`);
    assert(Math.abs(panel.right-sizes.header.right)<1,`${width}px ${panel.id||'navigation'} right edge`);
   }
   assert(!sizes.overflow,`${width}px horizontal overflow`);
  }
  console.log('PASS: visible homepage panels and navigation align with header across seven desktop/mobile widths.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});

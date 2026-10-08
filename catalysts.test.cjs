const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://local').pathname);if(req.url.split('?')[0].endsWith('/'))file=path.join(file,'index.html');fs.readFile(file,(e,d)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(d);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const now=new Date().toISOString(),future=new Date(Date.now()+2*86400000).toISOString(),day=future.slice(0,10);
  const market={status:'available',generated_at:now,themes:[{id:'market:breadth',title:'Crypto breadth positive',category:'crypto',affected_assets:['ALL'],impact:'MEDIUM',status:'current',summary:'Existing useful market theme.',last_updated:now,review_at:future,sources:[]}],macro_events:{status:'unavailable'}};
  const event=(i,extra={})=>({event_id:'event:'+i,title:'Official scheduled event '+i,event_date:future,date_precision:'EXACT',category:'NETWORK_UPGRADE',importance:88,confidence:99,status:'CONFIRMED',source_quality:'PRIMARY',assets:['ETH'],days_until:2,primary_source:{name:'Ethereum',url:'https://blog.ethereum.org/en/upgrade'},last_verified_at:now,...extra});
  const events={generated_at:now,status:'PARTIAL',source_health:{ethereum:{status:'healthy'},bls:{status:'failed'}},events:[event(0),event(1,{date_precision:'DATE_RANGE',event_date:day,event_end_date:day}),event(2,{date_precision:'QUARTER',event_date:day.slice(0,4)+'-Q4',status:'TENTATIVE'}),event(3,{date_precision:'TBC',event_date:null,status:'TBC'}),...Array.from({length:6},(_,i)=>event(i+4))]};
  const themes={generated_at:now,status:'PARTIAL',themes:[{theme_id:'ethereum',title:'Ethereum network development',summary:'Official network evidence; mainnet timing remains TBC.',assets:['ETH'],category:'PROTOCOL_UPGRADE',importance:70,confidence:90,status:'ACTIVE',horizon:'1–45 days',last_updated_at:now,supporting_sources:[{name:'Ethereum',url:'https://blog.ethereum.org/en/upgrade'}]}]};
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',r=>{const p=new URL(r.request().url()).pathname;return p==='/api/research'?r.fulfill({json:market}):p==='/api/research/events/upcoming'?r.fulfill({json:events}):p==='/api/research/themes/latest'?r.fulfill({json:themes}):r.fulfill({status:503});});
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>document.querySelectorAll('#research-events .research-item').length===8);
  await page.locator('#daily-research>.dashboard-details>summary').click();
  assert.equal(await page.locator('#daily-research').count(),1);
  assert.match(await page.locator('#research-themes').innerText(),/Existing useful market theme/);
  assert.match(await page.locator('#research-themes').innerText(),/Ethereum network development/);
  assert.match(await page.locator('#research-events').innerText(),/Partial data/);
  assert.match(await page.locator('#research-events').innerText(),/exact date TBC/);
  for(const width of [1440,768,390,320]){
   await page.setViewportSize({width,height:1000});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow '+width);
   await page.locator('#daily-research').screenshot({path:path.join(os.tmpdir(),'rrr-catalysts-'+width+'.png')});
  }
  await page.evaluate(d=>renderCatalysts(d,null),{...events,events:[event(0),event(0),event(1,{title:'<script>unsafe</script>'}),event(2,{date_precision:'DAY',event_date:'2026-99-99'}),event(3,{confidence:50}),event(4,{primary_source:{url:'javascript:alert(1)'}})]});
  assert.equal(await page.locator('#research-events .research-item').count(),2);
  assert.equal(await page.locator('#research-events script').count(),0);
  assert.match(await page.locator('#research-events').innerText(),/<script>unsafe/);
  await page.evaluate(d=>renderCatalysts(d,null),{...events,status:'STALE',generated_at:'2000-01-01T00:00:00Z'});
  assert.match(await page.locator('#research-events').innerText(),/STALE, verify with source/);
  await page.evaluate(()=>renderCatalysts(null,null));
  assert.match(await page.locator('#research-events').innerText(),/Sources temporarily unavailable/);
  assert.doesNotMatch(await page.locator('#research-events').innerText(),/No major upcoming events currently tracked/);
  await page.evaluate(d=>renderCatalysts(d,null),{generated_at:now,status:'NO_EVENTS',events:[]});
  assert.match(await page.locator('#research-events').innerText(),/No major events detected/);
  assert.deepEqual(errors,[]);
  console.log('PASS catalysts: preserved market themes, eight events, honest dates/status/coverage, stale/unavailable/empty, safe text, deduplication, desktop/mobile layouts.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

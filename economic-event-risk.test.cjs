const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const fixed=Date.parse('2026-10-09T12:00:00Z'),iso=t=>new Date(t).toISOString();
const event={id:'test',title:'US CPI <img src=x onerror=window.injected=1>',country:'US',source:'FRED <script>unsafe</script>',source_url:'https://fred.stlouisfed.org/release?rid=10',release_date:'2026-10-09',release_timezone:'America/New_York',scheduled_at:iso(fixed+3600000),time_verified:true,time_status:'VERIFIED',time_source:'https://www.bls.gov/schedule/',source_status:'ok',event_status:'SCHEDULED',impact:'HIGH',impact_verified:true,impact_source:'https://www.bls.gov/cpi/',impact_classification_owner:'RRR.Trading',impact_classification_version:'rrr-economic-impact-v1',impact_classification_rule:'us-cpi',impact_classification_basis:'Reviewed internal assessment',risk:{state:'HIGH_ALERT',version:'economic-event-risk-v1'}};
function fixture(scenario){
 const value={schema_version:1,version:'economic-event-risk-v1',informational_only:true,execution_connected:false,assessed_at:iso(fixed),generated_at:iso(fixed-10000),expires_at:iso(fixed+86400000),status:'partial',risk_state:'HIGH_ALERT',events:[{...event},{...event,id:'date',title:'Date-only policy',scheduled_at:null,time_verified:false,time_status:'DATE CONFIRMED, TIME UNAVAILABLE',risk:{state:'TIME_UNVERIFIED'}}],calendar_health:{stale:false,calendar_status:'PARTIAL COVERAGE',official_sources:{BLS:{status:'unavailable',error:'Provider <img src=x> unavailable'}}},coverage_gaps:['Global coverage incomplete <script>unsafe</script>']};
 if(scenario==='empty')value.events=[];
 if(scenario==='date-only'){value.risk_state='TIME_UNVERIFIED';value.events=value.events.slice(1);}
 if(scenario==='missing-time'){value.events[0].scheduled_at=null;value.events[0].time_verified=false;value.events[0].time_status='DATE CONFIRMED, TIME UNAVAILABLE';}
 if(scenario==='stale')value.generated_at=iso(fixed-90000000);
 if(scenario==='risk-expired')value.assessed_at=iso(fixed-120000);
 if(scenario==='future')value.assessed_at=iso(fixed+31000);
 if(scenario==='expired'){value.risk_state='POST_RELEASE_WINDOW';value.events[0].scheduled_at=iso(fixed-60000);value.events[0].risk.state='POST_RELEASE_WINDOW';}
 if(scenario==='bad-time')value.events[0].scheduled_at='2026-10-09T13:00:00';
 if(scenario==='bad-date')value.events[0].release_date='2026-02-30';
 if(scenario==='unsafe-link'){value.events[0].source_url='javascript:window.injected=1';value.events[1].source_url='https://fred.stlouisfed.org@evil.example';}
 if(scenario==='bad-impact')value.events[0].impact_source='https://www.bls.gov@evil.example';
 if(scenario==='bad-flags')value.execution_connected=true;
 if(scenario==='bad-state')value.risk_state='NORMAL';
 if(scenario==='malformed')value.events=[null];
 if(['SCHEDULED','APPROACHING','RELEASE_WINDOW','UNKNOWN','DATA_STALE','CANCELLED','COMPLETED'].includes(scenario))value.risk_state=scenario;
 return value;
}
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://local').pathname);if(file.endsWith(path.sep))file+='index.html';fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date(fixed)});await page.clock.pauseAt(new Date(fixed));
 let scenario='healthy',hold,release;
 await page.route('https://stream.radiorrr.com/**',r=>r.abort());
 await page.route('https://api.rrr.trading/**',async r=>{
  const pathname=new URL(r.request().url()).pathname;requests.push({pathname,method:r.request().method()});
  if(pathname==='/api/schedule/event-risk'){
   if(scenario==='loading')await hold;
   if(scenario==='timeout')return;
   if(['outage','404'].includes(scenario))return r.fulfill({status:scenario==='404'?404:503,json:{}});
   return r.fulfill({json:fixture(scenario)});
  }
  if(pathname==='/api/schedule/economic')return r.fulfill({json:{schema_version:1,classification_version:'rrr-economic-impact-v1',status:'partial',generated_at:iso(fixed),expires_at:iso(fixed+86400000),events:[{...event},{...event,id:'date',title:'Date-only policy',scheduled_at:null,time_status:'DATE CONFIRMED, TIME UNAVAILABLE'}],window_start:'2026-10-09',window_end:'2026-11-02',health:{},coverage_gaps:['Global coverage incomplete']}});
  return r.fulfill({status:503,json:{}});
 });
 const base=`http://127.0.0.1:${server.address().port}`,panel=page.locator('#economic-event-risk');
 const load=async route=>{await page.goto(base+route);await page.waitForFunction(()=>document.querySelector('#economic-event-risk button')&&!document.querySelector('#economic-event-risk button').disabled);};
 for(const route of ['/demo/15minbot/','/demo/1hrbot/','/demo/4hrbot/','/schedule/']){
  scenario='healthy';const before=requests.filter(r=>r.pathname==='/api/schedule/event-risk').length;await load(route);
  assert.equal(requests.filter(r=>r.pathname==='/api/schedule/event-risk').length-before,1,'one shared request');
  assert.match(await panel.innerText(),/CURRENT ECONOMIC RISK: HIGH_ALERT/);assert.match(await panel.innerText(),/11:00 pm AEST/);assert.match(await panel.innerText(),/Countdown: 0d 1h 0m/);
  assert.equal(await panel.locator('img,script').count(),0);assert(!await page.evaluate(()=>window.injected));assert.equal(await panel.locator('a').last().getAttribute('href'),'/schedule/');
  await panel.locator('details').last().locator('summary').click();assert.match(await panel.locator('details').last().innerText(),/Date-only policy.*2026-10-09.*America\/New_York.*TIME NOT VERIFIED/s);assert.equal(await panel.locator('.economic-date-event .economic-countdown').count(),0);
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:1000});const box=await panel.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1,'panel bounded '+route+width);assert(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+1));if(route==='/schedule/')assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));fs.mkdirSync('.runtime/economic-phase3',{recursive:true});await panel.screenshot({path:`.runtime/economic-phase3/${route.includes('schedule')?'schedule':route.split('/')[2]}-${width}.png`});}
  if(route.includes('demo')){assert.equal(await panel.evaluate(e=>e.parentElement.id),'bot-summary');assert(await page.locator('#performance').count());assert(await page.locator('#open-trades').count());assert(await page.locator('#bot-operational-details').count());}
  else{assert.match(await page.locator('[data-day="2026-10-05"] .announcement-cell').first().innerText(),/Outside calendar coverage/);assert.match(await page.locator('[data-day="2026-10-09"] .row-empty').first().innerText(),/No matching HIGH-impact events in the available calendar data/);assert.match(await page.locator('[data-day="2026-10-09"] .risk-cell').first().innerText(),/Risk unassessed/);assert.equal(await page.locator('#regional-events .event-countdown').count(),0);}
  for(scenario of ['SCHEDULED','APPROACHING','RELEASE_WINDOW','UNKNOWN','DATA_STALE','CANCELLED','COMPLETED','date-only','missing-time','empty','expired','bad-time','bad-date','unsafe-link','bad-impact','stale','risk-expired','future','outage','404','malformed','bad-flags','bad-state']){
   await load(route);const body=await panel.innerText();
   if(['stale','risk-expired','future','outage','404','malformed','bad-flags','bad-state'].includes(scenario)){assert.match(body,/ECONOMIC RISK UNAVAILABLE/,scenario);assert.equal(await panel.locator('.economic-countdown').count(),0);assert(!/CURRENT ECONOMIC RISK:/.test(body));}
   if(['date-only','missing-time'].includes(scenario)){assert.equal(await panel.locator('.economic-countdown').count(),0);assert.match(await panel.locator('details').last().textContent(),/TIME NOT VERIFIED/);}
   if(scenario==='expired'){assert.match(body,/POST_RELEASE_WINDOW/);assert.equal(await panel.locator('.economic-countdown').count(),0);assert(!/COMPLETED/.test(body));}
   if(['bad-time','bad-date','bad-impact'].includes(scenario))assert.equal(await panel.locator('.economic-countdown').count(),0);
   if(scenario==='unsafe-link')assert.equal(await panel.locator('a').count(),1);
   if(scenario==='empty')assert.match(body,/No upcoming verified-time HIGH announcement in available evidence/);
   if(['SCHEDULED','APPROACHING','RELEASE_WINDOW','UNKNOWN','DATA_STALE','CANCELLED','COMPLETED'].includes(scenario))assert(body.includes('CURRENT ECONOMIC RISK: '+scenario));
  }
 }
 // Countdown without polling, stale risk independently of saved calendar expiry,
 // timed event crossing, timeout, recovery and bounded GET requests.
 scenario='healthy';await load('/demo/15minbot/');await page.clock.runFor(30000);assert.match(await panel.innerText(),/0d 0h 59m/);
 scenario='expired';await panel.locator('button').click();await page.waitForFunction(()=>!document.querySelector('#economic-event-risk button').disabled);assert.equal(await panel.locator('.economic-countdown').count(),0);
 scenario='timeout';await panel.locator('button').click();await page.clock.runFor(12001);await page.waitForFunction(()=>!document.querySelector('#economic-event-risk button').disabled);assert.match(await panel.innerText(),/ECONOMIC RISK UNAVAILABLE/);
 await page.clock.setFixedTime(new Date(fixed));scenario='healthy';await load('/demo/1hrbot/');await page.clock.setFixedTime(new Date(fixed+120001));await page.clock.runFor(1000);assert.match(await panel.innerText(),/ECONOMIC RISK UNAVAILABLE/);
 await page.clock.setFixedTime(new Date(fixed));await load('/schedule/');await page.clock.setFixedTime(new Date(fixed+17*3600000));await page.clock.runFor(1000);assert.match(await page.locator('#regional-events').innerText(),/Date-only policy.*2026-10-09.*TIME NOT VERIFIED/s,'date boundary is not completion evidence');
 await page.clock.setFixedTime(new Date(fixed));scenario='loading';hold=new Promise(r=>release=r);await page.goto(base+'/demo/4hrbot/');assert.match(await panel.innerText(),/Loading economic risk/);scenario='healthy';release();await page.waitForFunction(()=>!document.querySelector('#economic-event-risk button').disabled);assert.match(await panel.innerText(),/HIGH_ALERT/);
 assert(requests.every(r=>r.method==='GET'));assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS shared economic risk: all bots/Schedule, backend states/flags, Brisbane/countdown, date-only/expired/stale/partial/outage/malformed/timeout, safe text/links, GET-only, 320/375/768/1440');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

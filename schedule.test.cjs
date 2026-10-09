const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const M=require('./schedule/market-sessions.js');
const fixed=Date.parse('2026-10-09T12:00:00Z'),iso=t=>new Date(t).toISOString();
// Pure timezone checks: Brisbane week, independently changing regional DST,
// source weekdays, exact half-open boundaries and overnight clipping.
assert.equal(M.monday(fixed),'2026-10-05');assert.equal(M.date(Date.parse('2026-10-11T14:00Z')),'2026-10-12');
for(const [d,h,z,utc] of [
 ['2026-10-02',8,'Australia/Sydney','2026-10-01T22:00:00.000Z'],['2026-10-05',8,'Australia/Sydney','2026-10-04T21:00:00.000Z'],
 ['2026-10-23',8,'Europe/London','2026-10-23T07:00:00.000Z'],['2026-10-26',8,'Europe/London','2026-10-26T08:00:00.000Z'],
 ['2026-10-30',8,'America/New_York','2026-10-30T12:00:00.000Z'],['2026-11-02',8,'America/New_York','2026-11-02T13:00:00.000Z'],
 ['2026-03-06',8,'America/New_York','2026-03-06T13:00:00.000Z'],['2026-03-09',8,'America/New_York','2026-03-09T12:00:00.000Z'],
 ['2026-03-27',8,'Europe/London','2026-03-27T08:00:00.000Z'],['2026-03-30',8,'Europe/London','2026-03-30T07:00:00.000Z'],
 ['2026-04-03',8,'Australia/Sydney','2026-04-02T21:00:00.000Z'],['2026-04-06',8,'Australia/Sydney','2026-04-05T22:00:00.000Z'],
 ['2026-11-02',9,'Asia/Tokyo','2026-11-02T00:00:00.000Z']])assert.equal(iso(M.instant(d,h,z)),utc,z+' '+d);
assert.deepEqual(M.active(fixed).map(s=>s.id),['london','new-york']);
const week=M.week('2026-10-05');assert.equal(week.length,7);const saturday=week[5];assert(saturday.sessions.some(s=>s.id==='new-york'&&s.sourceDate==='2026-10-09'));assert.equal(week[6].sessions.length,0);
const ny=week[4].sessions.find(s=>s.id==='new-york'&&s.sourceDate==='2026-10-09');assert.equal(ny.clipTo,saturday.from);assert(M.active(ny.to-1).some(s=>s.id==='new-york'));assert(!M.active(ny.to).some(s=>s.id==='new-york'));
assert(!M.validDate('2026-02-30'));assert(!M.validDate('x'));
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://local').pathname);if(file.endsWith(path.sep))file+='index.html';fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date(fixed)});await page.clock.pauseAt(new Date(fixed));
 const base=process.env.RRR_SCHEDULE_BASE_URL||`http://127.0.0.1:${server.address().port}`;let scenario='healthy',release,held;
 function fixture(){
  const previous={label:'Unemployment rate',value:0,units:'Percent',frequency:'Monthly, seasonally adjusted',observation_period:'2026-08-01',status:'available',vintage:'Latest revised observation; not original pre-release information',source_url:'https://fred.stlouisfed.org/series/UNRATE'};
  const common={event_risk:{version:'economic-event-risk-v1',state:'HIGH_ALERT'},country:'US',source:'FRED',release_date:'2026-10-09',release_timezone:'America/New_York',time_status:'VERIFIED',source_url:'https://fred.stlouisfed.org/release?rid=10',time_source:'https://www.bls.gov/schedule/news_release/bls.ics',impact:'HIGH',impact_verified:true,impact_classification_owner:'RRR.Trading',impact_classification_version:'rrr-economic-impact-v1',impact_classification_rule:'us-cpi',impact_classification_basis:'Reviewed internal assessment; agency verifies identity and scheduling.',impact_source:'https://www.bls.gov/schedule/',previous:[previous]};
  const events=[
   {...common,id:'cpi',title:'CPI <img src=x onerror="window.injected=1">',scheduled_at:'2026-10-09T12:30:00Z',forecast:99},
   {...common,id:'employment',title:'Employment Situation',scheduled_at:'2026-10-09T12:45:00Z'},
   {...common,id:'outside',title:'Outside session release',scheduled_at:'2026-10-09T23:30:00Z'},
   {...common,id:'date-us',title:'US source-date release',release_date:'2026-10-11',scheduled_at:null,time_status:'DATE CONFIRMED, TIME UNAVAILABLE'},
   {...common,id:'date-au',title:'AU source-date release',country:'AU',release_timezone:'Australia/Sydney',release_date:'2026-10-11',scheduled_at:null,time_status:'DATE CONFIRMED, TIME UNAVAILABLE'},
   {...common,id:'missing-rule',title:'MUST NOT SHOW MISSING RULE',impact_classification_rule:null,scheduled_at:'2026-10-09T13:00:00Z'},
   {...common,id:'false-owner',title:'MUST NOT SHOW FALSE AGENCY RATING',impact_classification_owner:'BLS',scheduled_at:'2026-10-09T13:00:00Z'},
   {...common,id:'cancelled',title:'MUST NOT SHOW CANCELLED',event_status:'CANCELLED',scheduled_at:'2026-10-09T13:00:00Z'},
   {...common,id:'medium',title:'MUST NOT SHOW MEDIUM',scheduled_at:'2026-10-09T13:00:00Z',impact:'MEDIUM'},
   {...common,id:'past',title:'MUST NOT SHOW PAST',scheduled_at:'2026-10-09T11:00:00Z'},
   {...common,id:'news',title:'MUST NOT SHOW NEWS',release_date:null,scheduled_at:'2026-10-09T13:00:00Z'},
   {...common,id:'unverified-impact',title:'MUST NOT SHOW UNVERIFIED IMPACT',impact_verified:false,scheduled_at:'2026-10-09T13:00:00Z'},
   {...common,id:'today-unknown',title:'Source-current-date timing unverified',scheduled_at:null,time_status:'DATE CONFIRMED, TIME UNAVAILABLE'},
   {...common,id:'unsafe-impact',title:'MUST NOT SHOW UNSAFE IMPACT',impact_source:'https://www.bls.gov@evil.example',scheduled_at:'2026-10-09T13:00:00Z'}];
  if(scenario==='unclassified')for(const e of events){delete e.impact;delete e.impact_verified;delete e.impact_source;}
  if(scenario==='partial')events[0].stale=true;
  if(scenario==='safe-links'){events[0].source_url='javascript:window.injected=1';events[0].previous[0].source_url='https://fred.stlouisfed.org@evil.example';}
  if(scenario==='invalid-time')events[0].scheduled_at='2026-10-09T12:30:00';
  if(scenario==='bad-date')events[0].release_date='2026-02-30';
  if(scenario==='risk-stale')events[0].event_risk={version:'economic-event-risk-v1',state:'<script>bad</script>'};
  if(scenario==='previous-stale')events[0].previous[0].status='stale';
  return {schema_version:1,classification_version:'rrr-economic-impact-v1',risk_assessed_at:iso(fixed-(scenario==='risk-expired'?180000:10000)),status:scenario==='partial'?'partial':'ok',generated_at:iso(fixed+(scenario==='stale'?-90000000:scenario==='future'?3600000:-10000)),expires_at:iso(fixed+(scenario==='stale'?-1:86400000)),events:scenario==='empty'?[]:scenario==='date-only'?events.filter(e=>e.id==='date-us'||e.id==='date-au'):events,window_start:'2026-10-09',window_end:'2026-11-02',health:{fred_status:'ok',last_successful_fred_refresh:iso(fixed-10000),official_sources:{BLS:{status:'unavailable',error:'Official calendar unavailable'}}},coverage_gaps:['Consensus forecasts unavailable.','Fed/ECB/BoE/BoJ calendars unavailable.']};
 }
 await page.route('https://stream.radiorrr.com/**',r=>r.abort());
 await page.route('https://api.rrr.trading/**',async r=>{const url=new URL(r.request().url());requests.push({path:url.pathname,method:r.request().method()});if(url.pathname==='/api/schedule/economic'){if(scenario==='loading')await held;if(scenario==='outage'||scenario==='404')return r.fulfill({status:scenario==='404'?404:503,json:{}});if(scenario==='malformed')return r.fulfill({json:{schema_version:1,status:'ok',events:'wrong'}});if(scenario==='timeout')return;return r.fulfill({json:fixture()});}return r.fulfill({status:503,json:{}});});
 const load=async()=>{await page.goto(base+'/schedule/');await page.waitForFunction(()=>!document.getElementById('schedule-refresh').disabled);};
 await load();assert.equal(await page.locator('.day-disclosure').count(),7);assert.match(await page.locator('#week-range').innerText(),/5 Oct.*11 Oct/);assert(await page.locator('#previous-week').isDisabled());assert(!await page.locator('#next-week').isDisabled());
 assert.equal(await page.locator('.announcement').count(),6);assert.equal(await page.locator('#regional-events .announcement').count(),3);assert.match(await page.locator('#regional-events').innerText(),/America\/New_York.*TIME NOT VERIFIED/);assert.equal(await page.locator('#regional-events .event-countdown').count(),0);
 assert.match(await page.locator('#current-markets').innerText(),/LONDON.*NEW YORK ACTIVE/);assert.equal(await page.locator('.session-row[data-active="true"]').count(),2);assert.match(await page.locator('#next-announcement').innerText(),/IN 0 DAYS 0 HOURS 30 MINUTES/);
 const outside=page.locator('.session-row').filter({hasText:'Outside session release'});assert.equal(await outside.getAttribute('data-day'),'2026-10-10');assert.match(await outside.innerText(),/REGIONAL ANNOUNCEMENTS/);assert.match(await outside.innerText(),/9:30 am/);
 assert.match(await page.locator('.event-count').first().innerText(),/2 announcements/);assert(!/MUST NOT SHOW/.test(await page.locator('main').innerText()));assert.equal(await page.locator('#schedule-events img').count(),0);assert(!await page.evaluate(()=>window.injected));
 assert.equal(await page.locator('.announcement[open]').count(),0);await page.locator('.announcement summary').first().focus();await page.keyboard.press('Enter');assert(await page.locator('.announcement').first().evaluate(e=>e.open));assert.match(await page.locator('.event-details').first().innerText(),/0 · Percent/);assert.match(await page.locator('.event-details').first().innerText(),/Forecast unavailable/);assert.match(await page.locator('.event-details').first().innerText(),/reviewed RRR.Trading assessment/);assert.match(await page.locator('.event-details').first().innerText(),/Event risk: HIGH_ALERT/);assert(!/Event risk: HIGH_ALERT/.test(await page.locator('#regional-events').innerText()));assert(!/99/.test(await page.locator('.event-details').first().innerText()));
 // Preserve keyboard focus and expanded details on the automatic minute redraw.
 await page.clock.runFor(60000);assert(await page.locator('.announcement').first().evaluate(e=>e.open));assert(await page.locator('.announcement summary').first().evaluate(e=>e===document.activeElement));
 for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);if(width<700){const day=page.locator('.day-toggle').filter({hasText:'Friday'});await day.focus();await page.keyboard.press('Enter');assert.equal(await day.getAttribute('aria-expanded'),'false');await page.keyboard.press('Enter');assert.equal(await day.getAttribute('aria-expanded'),'true');}fs.mkdirSync(path.join(__dirname,'.runtime/schedule-lineup'),{recursive:true});await page.screenshot({path:path.join(__dirname,`.runtime/schedule-lineup/fixture-${width}.png`),fullPage:true});}
 await page.locator('#next-week').click();assert.match(await page.locator('#week-range').innerText(),/12 Oct.*18 Oct/);assert.equal(await page.locator('#regional-events .announcement').count(),1,'source US Sunday can overlap next Brisbane Monday, AU Sunday cannot');
 await page.locator('#next-week').click();await page.locator('#next-week').click();await page.locator('#next-week').click();assert(await page.locator('#next-week').isDisabled());await page.locator('#previous-week').click();assert.match(await page.locator('#week-range').innerText(),/26 Oct/);await page.locator('#today').click();assert.match(await page.locator('#week-range').innerText(),/5 Oct/);
 for(scenario of ['unclassified','date-only','empty','stale','future','partial','risk-stale','risk-expired','previous-stale','invalid-time','bad-date','safe-links','404','malformed']){
  await load();const body=await page.locator('main').innerText();
  if(['stale','future','404','malformed','unclassified'].includes(scenario))assert.equal(await page.locator('.announcement').count(),0,scenario);
  if(scenario==='unclassified'){assert.match(body,/High-impact classification unavailable/);assert(!/No upcoming releases returned/.test(body));}
  if(scenario==='empty')assert.match(body,/No upcoming releases returned/);
  if(scenario==='date-only'){assert.match(await page.locator('#next-announcement').innerText(),/TIME NOT VERIFIED/);assert.equal(await page.locator('.event-countdown').count(),0);}
  if(scenario==='partial')assert(!await page.locator('.announcement summary').filter({hasText:'CPI'}).count());
  if(['invalid-time','bad-date'].includes(scenario))assert(!await page.locator('.announcement summary').filter({hasText:'CPI'}).count());
  if(['risk-stale','risk-expired'].includes(scenario)){assert.match(await page.locator('#next-announcement').innerText(),/Event risk: UNASSESSED/);assert(!/script>bad/.test(body));}
  if(scenario==='previous-stale'){await page.locator('.announcement summary').first().click();assert.match(await page.locator('.event-details').first().innerText(),/Stale historical observation/);}
  if(scenario==='safe-links')assert.equal(await page.locator('.announcement a').evaluateAll(links=>links.filter(a=>!['fred.stlouisfed.org','www.bls.gov'].includes(new URL(a.href).hostname)).length),0);
 }
 scenario='healthy';await load();scenario='outage';await page.locator('#schedule-refresh').click();await page.waitForFunction(()=>!document.getElementById('schedule-refresh').disabled);assert.equal(await page.locator('.announcement').count(),0);assert.match(await page.locator('#next-announcement').innerText(),/Calendar unavailable/);assert(await page.locator('#next-week').isDisabled());assert(!/no scheduled announcements/i.test(await page.locator('main').innerText()));
 scenario='loading';held=new Promise(r=>release=r);await page.goto(base+'/schedule/');assert.match(await page.locator('#schedule-status').innerText(),/Loading/);scenario='healthy';release();await page.waitForSelector('.announcement');
 // Minute tick updates overlapping activity and removes past releases.
 await page.clock.fastForward(4*3600000);assert(!await page.locator('.announcement summary').filter({hasText:'CPI'}).count());assert.match(await page.locator('#current-markets').innerText(),/^NEW YORK ACTIVE$/);
 // Saved evidence expiry suspends all announcements without an upstream response.
 await page.clock.setFixedTime(new Date(fixed+86400001));await page.clock.runFor(1000);assert.equal(await page.locator('.announcement').count(),0);assert.match(await page.locator('#schedule-status').innerText(),/unavailable or stale/);
 await page.clock.setFixedTime(new Date(fixed));scenario='healthy';await load();scenario='timeout';await page.locator('#schedule-refresh').click();await page.clock.runFor(12001);await page.waitForFunction(()=>!document.getElementById('schedule-refresh').disabled);assert.match(await page.locator('#schedule-status').innerText(),/unavailable/);
 // Default current-week browsing follows Brisbane Monday even across an outage.
 await page.clock.setFixedTime(new Date('2026-10-11T14:01:00Z'));await page.clock.runFor(1000);assert.match(await page.locator('#week-range').innerText(),/12 Oct.*18 Oct/);assert.match(await page.locator('.day-cell .today-label').locator('..').innerText(),/2026-10-12/);
 assert(requests.every(r=>r.method==='GET'));assert(requests.filter(r=>r.path.startsWith('/api/schedule')).every(r=>['/api/schedule/economic','/api/schedule/event-risk','/api/schedule/protection'].includes(r.path)));assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS weekly schedule: Brisbane/DST/midnight/seven days/navigation/active clock/strict HIGH/upcoming/date-only/details/countdown/expiry/failures/safe text/GET-only/320/375/768/1440');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});

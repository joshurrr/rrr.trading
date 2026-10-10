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
 ['2026-10-23',8,'Europe/Berlin','2026-10-23T06:00:00.000Z'],['2026-10-26',8,'Europe/Berlin','2026-10-26T07:00:00.000Z'],
 ['2026-11-02',9,'Asia/Tokyo','2026-11-02T00:00:00.000Z']])assert.equal(iso(M.instant(d,h,z)),utc,z+' '+d);
assert.deepEqual(M.active(fixed).map(s=>s.id),['london','new-york']);
const week=M.week('2026-10-05');assert.equal(week.length,7);const saturday=week[5];assert(saturday.sessions.some(s=>s.id==='new-york'&&s.sourceDate==='2026-10-09'));assert.equal(week[6].sessions.length,0);
const ny=week[4].sessions.find(s=>s.id==='new-york'&&s.sourceDate==='2026-10-09');assert.equal(ny.clipTo,saturday.from);assert(M.active(ny.to-1).some(s=>s.id==='new-york'));assert(!M.active(ny.to).some(s=>s.id==='new-york'));
assert(!M.validDate('2026-02-30'));assert(!M.validDate('x'));
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://local').pathname);if(file.endsWith(path.sep))file+='index.html';fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage({timezoneId:'America/Los_Angeles'}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date(fixed)});await page.clock.pauseAt(new Date(fixed));
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
   {...common,id:'released',title:'MUST NOT SHOW RELEASED',event_status:'CONFIRMED_RELEASED',scheduled_at:'2026-10-09T13:00:00Z'},
   {...common,id:'medium',title:'MUST NOT SHOW MEDIUM',scheduled_at:'2026-10-09T13:00:00Z',impact:'MEDIUM'},
   {...common,id:'past',title:'MUST NOT SHOW PAST',scheduled_at:'2026-10-09T11:00:00Z'},
   {...common,id:'news',title:'MUST NOT SHOW NEWS',release_date:null,scheduled_at:'2026-10-09T13:00:00Z'},
   {...common,id:'unverified-impact',title:'MUST NOT SHOW UNVERIFIED IMPACT',impact_verified:false,scheduled_at:'2026-10-09T13:00:00Z'},
   {...common,id:'today-unknown',title:'Source-current-date timing unverified',scheduled_at:null,time_status:'DATE CONFIRMED, TIME UNAVAILABLE'},
   {...common,id:'unsafe-impact',title:'MUST NOT SHOW UNSAFE IMPACT',impact_source:'https://www.bls.gov@evil.example',scheduled_at:'2026-10-09T13:00:00Z'}];
  if(scenario==='complete-empty')return {schema_version:1,status:'ok',generated_at:iso(fixed-10000),expires_at:iso(fixed+86400000),events:[],window_start:'2026-10-09',window_end:'2026-11-02',health:{fred_status:'ok',official_sources:{BLS:{status:'ok'}}},coverage_gaps:[]};
  if(scenario==='unclassified')for(const e of events){delete e.impact;delete e.impact_verified;delete e.impact_source;}
  if(scenario==='partial')events[0].stale=true;
  if(scenario==='safe-links'){events[0].source_url='javascript:window.injected=1';events[0].previous[0].source_url='https://fred.stlouisfed.org@evil.example';}
  if(scenario==='invalid-time')events[0].scheduled_at='2026-10-09T12:30:00';
  if(scenario==='bad-date')events[0].release_date='2026-02-30';
  if(scenario==='risk-stale')events[0].event_risk={version:'economic-event-risk-v1',state:'<script>bad</script>'};
  if(scenario==='previous-stale')events[0].previous[0].status='stale';
  if(scenario==='coverage')return {schema_version:1,status:'partial',generated_at:iso(fixed-10000),expires_at:iso(fixed+86400000),events:[
   {...common,id:'ppi',title:'Producer Price Index',release_date:'2026-10-15',scheduled_at:null,time_status:'DATE CONFIRMED, TIME UNAVAILABLE',impact_classification_rule:'us-ppi',impact_source:'https://www.bls.gov/ppi/'},
   {...common,id:'retail',title:'Reviewed Retail Sales',release_date:'2026-10-15',scheduled_at:null,time_status:'DATE CONFIRMED, TIME UNAVAILABLE',impact_classification_rule:'us-retail',impact_source:'https://www.census.gov/retail/'},
   {...common,id:'uk-gdp',title:'UK monthly GDP',country:'UK',source:'ONS',release_date:'2026-10-15',release_timezone:'Europe/London',scheduled_at:'2026-10-15T06:00:00Z',impact_classification_rule:'uk-monthly-gdp',impact_source:'https://www.ons.gov.uk/economy/grossdomesticproductgdp',source_url:'https://www.ons.gov.uk/releases/gdpmonthlyestimateukaugust2026',time_source:'https://www.ons.gov.uk/releases/gdpmonthlyestimateukaugust2026'},
   {...common,id:'eu-inflation',title:'EU HICP inflation',country:'EU',source:'EUROSTAT',release_date:'2026-10-16',release_timezone:'Europe/Luxembourg',scheduled_at:null,time_status:'DATE CONFIRMED, TIME UNAVAILABLE',impact_classification_rule:'eu-inflation',impact_source:'https://ec.europa.eu/eurostat/news/euro-indicators/release-calendar'},
   {...common,id:'jp-cpi',title:'National Japanese CPI',country:'JP',source:'STATJP',release_date:'2026-10-23',release_timezone:'Asia/Tokyo',scheduled_at:null,time_status:'DATE CONFIRMED, TIME UNAVAILABLE',impact_classification_rule:'jp-cpi',impact_source:'https://www.stat.go.jp/english/data/cpi/1582.htm'},
   {...common,id:'medium-reviewed',title:'MUST NOT SHOW REVIEWED MEDIUM',release_date:'2026-10-15',scheduled_at:null,impact:'MEDIUM',impact_classification_rule:'us-industrial'},
   {...common,id:'medium-forged',title:'MUST NOT SHOW FORGED MEDIUM RULE',release_date:'2026-10-15',scheduled_at:null,impact:'HIGH',impact_classification_rule:'us-industrial'}],health:{},coverage_gaps:['Global coverage remains partial.']};
  return {schema_version:1,classification_version:'rrr-economic-impact-v1',risk_assessed_at:iso(fixed-(scenario==='risk-expired'?180000:10000)),status:scenario==='partial'?'partial':'ok',generated_at:iso(fixed+(scenario==='stale'?-90000000:scenario==='future'?3600000:-10000)),expires_at:iso(fixed+(scenario==='stale'?-1:86400000)),events:scenario==='empty'?[]:scenario==='date-only'?events.filter(e=>e.id==='date-us'||e.id==='date-au'):events,window_start:'2026-10-09',window_end:'2026-11-02',health:{fred_status:'ok',last_successful_fred_refresh:iso(fixed-10000),official_sources:{BLS:{status:'unavailable',error:'Official calendar unavailable'}}},coverage_gaps:['Consensus forecasts unavailable.','Fed/ECB/BoE/BoJ calendars unavailable.']};
 }
 await page.route('https://stream.radiorrr.com/**',r=>r.abort());
 await page.route('https://api.rrr.trading/**',async r=>{const url=new URL(r.request().url());requests.push({path:url.pathname,search:url.search,method:r.request().method()});assert.equal(url.search,'','saved calendar GET must never request historical ranges');if(url.pathname==='/api/schedule/economic'){if(scenario==='loading')await held;if(scenario==='outage'||scenario==='404')return r.fulfill({status:scenario==='404'?404:503,json:{}});if(scenario==='malformed')return r.fulfill({json:{schema_version:1,status:'ok',events:'wrong'}});if(scenario==='timeout')return;return r.fulfill({json:fixture()});}return r.fulfill({status:503,json:{}});});
 const load=async()=>{await page.goto(base+'/schedule/');await page.waitForFunction(()=>!document.getElementById('schedule-refresh').disabled);};

 await load();
 const dates=()=>page.locator('.day-toggle').evaluateAll(rows=>rows.map(r=>r.dataset.focusKey.slice(4)));
 assert.deepEqual(await dates(),Array.from({length:7},(_,i)=>M.shift('2026-10-09',i)));
 assert.match(await page.locator('#week-range').innerText(),/9 Oct.*15 Oct/);
 assert(await page.locator('#previous-week').isDisabled());
 assert.equal(await page.locator('.schedule-summary,#economic-event-risk,#economic-protection,.schedule-coverage,.risk-cell').count(),0);
 assert.equal(await page.locator('.schedule-table thead th').count(),4);
 assert.equal(await page.locator('.session-row[data-active="true"]').count(),2);
 assert.equal(await page.locator('.session-row[data-day="2026-10-09"][data-from]').count(),2,'completed Sydney/Tokyo omitted');
 assert.equal(await page.locator('.announcement').count(),6);
 assert.match(await page.locator('.session-row').filter({hasText:'US source-date release'}).innerText(),/TIME NOT VERIFIED/);
 assert.equal(await page.locator('.session-row').filter({hasText:'Outside session release'}).getAttribute('data-day'),'2026-10-10');
 assert.match(await page.locator('.session-row').filter({hasText:'Outside session release'}).innerText(),/REGIONAL ANNOUNCEMENTS/);
 assert(!/MUST NOT SHOW/.test(await page.locator('main').innerText()));
 assert.equal(await page.locator('#schedule-events img').count(),0);assert(!await page.evaluate(()=>window.injected));
 await page.locator('.announcement summary').first().focus();await page.keyboard.press('Enter');
 assert(await page.locator('.announcement').first().evaluate(e=>e.open));
 assert.match(await page.locator('.event-details').first().innerText(),/HIGH ALERT/);
 await page.clock.runFor(60000);assert(await page.locator('.announcement').first().evaluate(e=>e.open));
 assert(await page.locator('.announcement summary').first().evaluate(e=>e===document.activeElement));
 const homepage=await browser.newPage();await homepage.route('https://api.rrr.trading/**',r=>r.fulfill({status:503,json:{}}));await homepage.route('https://stream.radiorrr.com/**',r=>r.abort());await homepage.goto(base+'/');
 for(const width of [320,375,768,1440,1920]){
  await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);
  await homepage.setViewportSize({width,height:1000});
  const bounds=await homepage.locator('main.shell').boundingBox(),scheduleBounds=await page.locator('main.shell').boundingBox();
  assert(Math.abs(bounds.x-scheduleBounds.x)<1&&Math.abs(bounds.width-scheduleBounds.width)<1,'homepage container alignment '+width);
  const layout=await page.evaluate(()=>{const section=document.querySelector('.schedule-page'),wrapper=document.querySelector('.schedule-table'),table=wrapper.querySelector('table');return {section:section.getBoundingClientRect().width,wrapper:wrapper.getBoundingClientRect().width,table:table.getBoundingClientRect().width,inner:wrapper.clientWidth,columns:[...table.querySelectorAll('thead th')].map(e=>e.getBoundingClientRect().width/table.getBoundingClientRect().width),buttons:[...document.querySelectorAll('.schedule-controls button')].every(e=>e.getBoundingClientRect().height>=44)};});
  assert(Math.abs(layout.section-layout.wrapper)<1&&Math.abs(layout.table-layout.inner)<1,'full-width table '+width);assert(layout.buttons,'usable controls '+width);
  if(width>700)for(const [i,proportion] of [.13,.23,.21,.43].entries())assert(Math.abs(layout.columns[i]-proportion)<.01,'column proportion '+width);
  if(width<700){const day=page.locator('.day-toggle').first();await day.focus();await page.keyboard.press('Enter');assert.equal(await day.getAttribute('aria-expanded'),'false');await page.keyboard.press('Enter');assert.equal(await day.getAttribute('aria-expanded'),'true');}
  fs.mkdirSync(path.join(__dirname,'.runtime/schedule-forward'),{recursive:true});await page.screenshot({path:path.join(__dirname,'.runtime/schedule-forward/fixture-'+width+'.png'),fullPage:true});
 }
 await homepage.close();
 await page.locator('#next-week').click();assert.match(await page.locator('#week-range').innerText(),/16 Oct.*22 Oct/);
 assert(!await page.locator('#previous-week').isDisabled());
 await page.locator('#previous-week').click();assert(await page.locator('#previous-week').isDisabled());
 // Programmatic navigation is clamped too; refresh cannot overwrite a future selection.
 await page.locator('#previous-week').dispatchEvent('click');assert.equal((await dates())[0],'2026-10-09');
 await page.locator('#next-week').click();await page.locator('#schedule-refresh').click();await page.waitForFunction(()=>!document.getElementById('schedule-refresh').disabled);
 assert.equal((await dates())[0],'2026-10-16');
 await page.locator('#current-week').click();assert.equal((await dates())[0],'2026-10-09');
 for(let i=0;i<5;i++)await page.locator('#next-week').click();assert(!await page.locator('#next-week').isDisabled());
 assert.match(await page.locator('#schedule-events').innerText(),/Outside calendar coverage/);
 await page.locator('#today').click();assert.equal((await dates())[0],'2026-10-09');
 scenario='complete-empty';await load();
 const happy='Nothing to worry about today - Happy trading.';
 const checkEmpty=async()=>{assert.equal(await page.locator('.announcement').count(),0);assert(await page.locator('.row-empty').count());assert((await page.locator('.row-empty').allTextContents()).every(t=>t===happy));};
 for(const width of [320,375,768,1440]){
  await page.setViewportSize({width,height:1000});await checkEmpty();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'empty-copy overflow '+width);
  await page.screenshot({path:path.join(__dirname,'.runtime/schedule-forward/empty-'+width+'.png'),fullPage:true});
 }
 for(const id of ['next-week','previous-week','next-week','current-week','next-week','today']){await page.locator('#'+id).click();await checkEmpty();}
 for(let i=0;i<5;i++)await page.locator('#next-week').click();
 assert(!await page.locator('#schedule-events').innerText().then(t=>t.includes(happy)));
 for(scenario of ['unclassified','date-only','empty','stale','future','partial','risk-stale','risk-expired','invalid-time','bad-date','safe-links','404','malformed']){
  await load();const body=await page.locator('main').innerText();
  if(['stale','future','404','malformed','unclassified'].includes(scenario))assert.equal(await page.locator('.announcement').count(),0,scenario);
  if(scenario==='unclassified')assert.match(body,/High-impact classification unavailable/);
  if(scenario==='empty')assert.match(body,/No upcoming high-impact announcements/);
  assert(!(await page.locator('#schedule-events').innerText()).includes(happy),'uncertain coverage '+scenario);
  if(scenario==='empty'||scenario==='partial')assert.match(await page.locator('#schedule-events').innerText(),/coverage incomplete or uncertain|classification unavailable/i);
  if(scenario==='date-only'){assert.match(body,/TIME NOT VERIFIED/);assert.equal(await page.locator('.event-countdown').count(),0);}
  if(['partial','invalid-time','bad-date'].includes(scenario))assert(!await page.locator('.announcement summary').filter({hasText:'CPI'}).count());
  if(['risk-stale','risk-expired'].includes(scenario)){assert(!/HIGH ALERT|script>bad/.test(body));}
  if(scenario==='safe-links')assert.equal(await page.locator('.announcement a').evaluateAll(links=>links.filter(a=>!['fred.stlouisfed.org','www.bls.gov'].includes(new URL(a.href).hostname)).length),0);
 }
 scenario='coverage';await load();
 for(const title of ['Producer Price Index','Reviewed Retail Sales','UK monthly GDP'])assert(await page.locator('.announcement summary').filter({hasText:title}).count(),title);
 assert(!/MUST NOT SHOW/.test(await page.locator('#schedule-events').innerText()));
 assert.match(await page.locator('#schedule-events').innerText(),/TIME NOT VERIFIED/);
 await page.locator('#next-week').click();assert(await page.locator('.announcement summary').filter({hasText:'EU HICP inflation'}).count());
 await page.locator('#next-week').click();assert(await page.locator('.announcement summary').filter({hasText:'National Japanese CPI'}).count());
 scenario='healthy';await load();scenario='outage';await page.locator('#schedule-refresh').click();await page.waitForFunction(()=>!document.getElementById('schedule-refresh').disabled);
 assert.equal(await page.locator('.announcement').count(),0);assert.match(await page.locator('#schedule-status').innerText(),/unavailable/);
 await page.locator('#next-week').click();assert.equal((await dates())[0],'2026-10-16');await page.locator('#today').click();
 scenario='loading';held=new Promise(r=>release=r);await page.goto(base+'/schedule/');assert.match(await page.locator('#schedule-status').innerText(),/Loading/);
 await page.locator('#next-week').click();scenario='healthy';release();await page.waitForFunction(()=>!document.getElementById('schedule-refresh').disabled);assert.equal((await dates())[0],'2026-10-16');await page.locator('#today').click();
 // Exact release boundary removes announcements, and closing sessions disappear.
 await page.clock.setFixedTime(new Date('2026-10-09T12:30:00Z'));await page.clock.runFor(1000);assert(!await page.locator('.announcement summary').filter({hasText:'CPI'}).count());
 await page.clock.setFixedTime(new Date('2026-10-09T16:00:00Z'));await page.clock.runFor(1000);
 assert.equal((await dates())[0],'2026-10-10');assert.equal(await page.locator('.session-row[data-active="true"]').count(),1);
 assert.equal(await page.locator('.session-row[data-day="2026-10-10"]').filter({hasText:'NEW YORK'}).count(),1,'Friday NY continues on Saturday');
 assert(!await page.locator('.announcement summary').filter({hasText:'Source-current-date timing unverified'}).count(),'older source dates withheld');
 await page.clock.setFixedTime(new Date('2026-10-09T21:00:00Z'));await page.clock.runFor(1000);
 assert.equal(await page.locator('.session-row[data-active="true"]').count(),0);assert.equal(await page.locator('.session-row[data-day="2026-10-10"][data-from]').count(),0);
 // Future selection survives midnight; Previous clamps its partial period to today.
 await page.clock.setFixedTime(new Date(fixed));scenario='healthy';await load();await page.locator('#next-week').click();
 await page.clock.setFixedTime(new Date('2026-10-09T14:00:00Z'));await page.clock.runFor(1000);assert.equal((await dates())[0],'2026-10-16');
 await page.locator('#previous-week').click();assert.equal((await dates())[0],'2026-10-10');assert(await page.locator('#previous-week').isDisabled());
 await page.clock.setFixedTime(new Date('2026-10-10T14:00:00Z'));await page.clock.runFor(1000);assert.equal((await dates())[0],'2026-10-11');
 await page.clock.setFixedTime(new Date(fixed+86400001));await page.clock.runFor(1000);assert.equal(await page.locator('.announcement').count(),0);
 await page.clock.setFixedTime(new Date(fixed));scenario='healthy';await load();scenario='timeout';await page.locator('#schedule-refresh').click();await page.clock.runFor(12001);await page.waitForFunction(()=>!document.getElementById('schedule-refresh').disabled);assert.match(await page.locator('#schedule-status').innerText(),/unavailable/);
 assert(requests.every(r=>r.method==='GET'));assert(requests.filter(r=>r.path.startsWith('/api/schedule')).every(r=>r.path==='/api/schedule/economic'));
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS forward schedule: Brisbane/DST/midnight/seven days/clamped navigation/active sessions/strict HIGH/released exclusion/date-only/details/expiry/failures/safe text/GET-only/no date queries/320/375/768/1440');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});

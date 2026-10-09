const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const fixed=Date.parse('2026-10-14T12:00:00Z'),iso=t=>new Date(t).toISOString();
const event={id:'cpi',title:'US CPI <img src=x onerror=window.injected=1>',scheduled_at:iso(fixed+1200000),time_verified:true,time_status:'VERIFIED',release_date:'2026-10-14',release_timezone:'America/New_York'};
const b=(bot,tf)=>({bot,timeframe:tf,state:'HIGH_ALERT',mode:'SHADOW',would_restrict:true,enforced:false,automatic_exits_enabled:false,entry_status:'WOULD BE RESTRICTED',reason:'Critical verified event within configured window.',next_event:event,windows:[{state:'HIGH_ALERT',event,retained:false}],date_only_events:[{...event,title:'Date-only policy',scheduled_at:null,time_verified:false,release_timezone:'America/New_York'}],monitoring_enabled:true,position_observation_available:true,heightened_positions:1,positions:[{pair:'BTC/USDT:USDT <script>unsafe</script>',direction:'LONG',heightened:true,monitoring:{assessment:'PROTECTIVE ACTION CANDIDATE',unrealized_profit_pct:-1,stop_distance_pct:.5,volatility_pct_per_5m_bar:.6,strategy_exit_signal:true,economic_surprise:{reason:'Consensus unavailable · previous values are not forecasts.'}}}]});
function fixture(scenario,bot,tools){
 const bots={short:b('short','15m'),medium:b('medium','1h'),long:b('long','4h')};
 const v={schema_version:1,version:'economic-protection-v1',status:'SHADOW MODE ACTIVE',mode:'SHADOW',shadow_mode:true,execution_connected:false,automatic_economic_exits_executed:0,assessed_at:iso(fixed),last_successful_evaluation:iso(fixed),valid_until:iso(fixed+90000),snapshot_fresh:true,calendar_fresh:true,calendar_generated_at:iso(fixed-10000),calendar_coverage:'PARTIAL COVERAGE',bots_under_high_alert:3,high_alert_positions:3,shadow_restrictions_recorded:10,bots,logging_healthy:true,mode_consistent:true,bot_acknowledgements:{short:{fresh:true},medium:{fresh:false},long:{fresh:false}}};
 if(scenario==='disabled'){v.mode='DISABLED';v.status='DISABLED BY CONFIGURATION';for(const p of Object.values(bots)){p.mode='DISABLED';p.would_restrict=false;p.entry_status='DISABLED BY CONFIGURATION';p.monitoring_enabled=false;p.positions=[];p.heightened_positions=0;}}
 if(scenario==='stale')v.snapshot_fresh=false;
 if(scenario==='future')v.assessed_at=iso(fixed+31000);
 if(scenario==='expired')v.valid_until=iso(fixed);
 if(scenario==='malformed')v.bots.short=null;
 if(scenario==='bad-flags')v.execution_connected=true;
 if(scenario==='missing-position'){for(const p of Object.values(bots)){p.position_observation_available=false;p.heightened_positions=null;}}
 if(scenario==='date-only'){for(const p of Object.values(bots)){p.state='UNASSESSED';p.next_event=null;p.windows=[];p.would_restrict=false;p.entry_status='UNASSESSED';p.positions=[];p.heightened_positions=0;}}
 if(scenario==='outage-retained'){v.calendar_fresh=false;for(const p of Object.values(bots))p.windows[0].retained=true;}
 if(scenario==='normal'){for(const p of Object.values(bots)){p.state='NORMAL';p.windows=[];p.date_only_events=[];p.would_restrict=false;p.entry_status='NO PROPOSED WINDOW';p.positions=[];p.heightened_positions=0;p.reason='NORMAL is not a safety claim.';}}
 if(['ADVANCE_WARNING','EVENT_ACTIVE','POST_EVENT_MONITORING','RECOVERY','UNASSESSED'].includes(scenario))for(const p of Object.values(bots))p.state=scenario;
 if(bot){v.bot=scenario==='malformed'?null:v.bots[bot];delete v.bots;}
 if(tools&&scenario==='degraded'){v.status='DEGRADED';v.logging_healthy=false;}
 return v;
}
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://local').pathname);if(file.endsWith(path.sep))file+='index.html';fs.readFile(file,(err,body)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(body);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date(fixed)});await page.clock.pauseAt(new Date(fixed));
 let scenario='healthy',hold,release;
 await page.route('https://stream.radiorrr.com/**',r=>r.abort());
 await page.route('https://api.rrr.trading/**',async r=>{
  const pathname=new URL(r.request().url()).pathname;requests.push({pathname,method:r.request().method()});
  if(pathname.includes('economic-protection')||pathname.startsWith('/api/schedule/protection')){
   if(scenario==='loading')await hold;
   if(scenario==='timeout')return;
   if(['outage','404'].includes(scenario))return r.fulfill({status:scenario==='404'?404:503,json:{}});
   const bot=pathname.match(/demos\/(short|medium|long)/)?.[1];return r.fulfill({json:fixture(scenario,bot,pathname.endsWith('/health'))});
  }
  return r.fulfill({status:503,json:{}});
 });
 const base=`http://127.0.0.1:${server.address().port}`,panel=page.locator('#economic-protection');
 const load=async route=>{await page.goto(base+route);await page.waitForFunction(()=>document.querySelector('#economic-protection button')&&!document.querySelector('#economic-protection button').disabled);};
 for(const route of ['/demo/15minbot/','/demo/1hrbot/','/demo/4hrbot/','/schedule/','/tools/']){
  scenario='healthy';const before=requests.filter(r=>r.pathname.includes('protection')).length;await load(route);
  assert.equal(requests.filter(r=>r.pathname.includes('protection')).length-before,1);
  if(route.includes('demo')){
   assert.match(await panel.innerText(),/HIGH ALERT/);assert.match(await panel.innerText(),/WOULD BE RESTRICTED.*simulated/);assert.match(await panel.innerText(),/10:20 pm AEST/);
   assert.match(await page.locator('#economic-position-alerts').innerText(),/PROTECTIVE ACTION CANDIDATE/);assert.match(await page.locator('#economic-position-alerts').innerText(),/NONE — SHADOW MODE/);
   assert(await page.locator('#open-trades').count());assert(await page.locator('#performance').count());assert(await page.locator('#bot-operational-details').count());
  }
  if(route==='/tools/'){await page.locator('#calendar-monitoring summary').click();assert.match(await panel.innerText(),/SHADOW MODE ACTIVE/);assert.match(await panel.innerText(),/No recent authenticated admission observation/);}
  if(route==='/schedule/')assert.match(await panel.innerText(),/Bots under high alert: 3/);
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:1000});const box=await panel.boundingBox();assert(box&&box.x>=0&&box.x+box.width<=width+1,'panel bounded '+route+width);assert(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+1));fs.mkdirSync('.runtime/economic-phase4',{recursive:true});await panel.screenshot({path:`.runtime/economic-phase4/${route.split('/').filter(Boolean).pop()}-${width}.png`});}
  assert.equal(await panel.locator('img,script').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
  await panel.locator('button').focus();assert.equal(await panel.locator('button').evaluate(e=>e===document.activeElement),true);
  const scenarios=route==='/tools/'?['disabled','degraded','stale','expired','outage','404','bad-flags']:['ADVANCE_WARNING','EVENT_ACTIVE','POST_EVENT_MONITORING','RECOVERY','UNASSESSED','disabled','date-only','missing-position','outage-retained','normal','stale','future','expired','malformed','bad-flags','outage','404'];
  for(scenario of scenarios){
   await panel.locator('button').click();await page.waitForFunction(()=>!document.querySelector('#economic-protection button').disabled);const body=await panel.innerText();
   if(['stale','future','expired','malformed','bad-flags','outage','404'].includes(scenario)){assert.match(body,/ECONOMIC PROTECTION UNAVAILABLE/,scenario);assert(!body.includes('WOULD BE RESTRICTED'));}
   if(scenario==='disabled')assert.match(body,/DISABLED/);
   if(scenario==='date-only'){assert.match(body,/TIME NOT VERIFIED/);assert(!body.includes('Time until release:'));}
   if(scenario==='missing-position'&&route.includes('demo'))assert.match(await page.locator('#economic-position-alerts').innerText(),/does not establish no positions/);
   if(scenario==='outage-retained')assert.match(body,/retained verified evidence during outage/);
   if(scenario==='normal'&&route.includes('demo'))assert.match(body,/not a safety claim/);
  }
 }
 scenario='healthy';await load('/demo/15minbot/');await page.clock.setFixedTime(new Date(fixed+91000));await page.clock.runFor(1000);assert.match(await panel.innerText(),/ECONOMIC PROTECTION UNAVAILABLE/);
 await page.clock.setFixedTime(new Date(fixed));await load('/schedule/');scenario='timeout';await panel.locator('button').click();await page.clock.runFor(12001);await page.waitForFunction(()=>!document.querySelector('#economic-protection button').disabled);assert.match(await panel.innerText(),/ECONOMIC PROTECTION UNAVAILABLE/);
 scenario='loading';hold=new Promise(r=>release=r);await page.goto(base+'/demo/4hrbot/');assert.match(await panel.innerText(),/Loading protection evidence/);scenario='healthy';release();await page.waitForFunction(()=>!document.querySelector('#economic-protection button').disabled);
 assert(requests.every(r=>r.method==='GET'));assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS economic shadow protection: all bots/Schedule/Tools, position warnings, 320/375/768/1440, states/date-only/outage/expiry/loading, safe text, GET-only and preserved dashboards');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

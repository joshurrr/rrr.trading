(() => {
'use strict';
const M=window.MarketSchedule,endpoint='https://api.rrr.trading/api/schedule/economic';
const $=id=>document.getElementById(id),node=(tag,value,cls)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);if(cls)e.className=cls;return e;};
const time=v=>typeof v==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
const text=v=>typeof v==='string'&&v.trim()?v:'Unavailable';
const clock=at=>new Intl.DateTimeFormat('en-AU',{timeZone:M.zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(at);
const format=v=>time(v)===null?'Unavailable':new Intl.DateTimeFormat('en-AU',{timeZone:M.zone,dateStyle:'medium',timeStyle:'short'}).format(time(v))+' AEST';
const dayLabel=d=>new Intl.DateTimeFormat('en-AU',{timeZone:'UTC',weekday:'long',day:'numeric',month:'short'}).format(Date.parse(d+'T00:00:00Z'));
const safeUrl=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&['fred.stlouisfed.org','www.bls.gov','www.bea.gov','www.rba.gov.au','www.federalreserve.gov','www.ecb.europa.eu','www.bankofengland.co.uk','www.boj.or.jp','www.ons.gov.uk','www.abs.gov.au'].includes(u.hostname);}catch{return false;}};
let snapshot=null,failed=false,busy=false,controller=null,selected=M.monday(),followCurrentWeek=true,lastMinute='',days=M.week(selected),ready=false;
const expandedDays=new Set([M.date(Date.now())]),openEvents=new Set();
const fresh=()=>{const at=time(snapshot?.generated_at),end=time(snapshot?.expires_at);return !failed&&at!==null&&end!==null&&at<=Date.now()+30000&&Date.now()-at<=M.DAY&&end>Date.now()&&snapshot?.stale!==true&&['ok','partial'].includes(snapshot?.status);};
const horizon=()=>M.validDate(snapshot?.window_start)&&M.validDate(snapshot?.window_end)&&snapshot.window_end>=snapshot.window_start&&Date.parse(snapshot.window_end)-Date.parse(snapshot.window_start)<=366*M.DAY?{start:snapshot.window_start,end:snapshot.window_end}:null;
function source(parent,label,url){if(!safeUrl(url))return;const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);}
// HIGH is a reviewed RRR.Trading judgement; the official URL supports announcement identity.
const impactRules=new Set(['us-cpi','us-employment','us-gdp','us-pce','au-policy','us-policy','eu-policy','jp-policy','uk-policy','uk-cpi','uk-employment','uk-gdp','au-cpi','au-employment','au-gdp']);
const high=e=>e.impact==='HIGH'&&e.impact_verified===true&&safeUrl(e.impact_source)&&e.impact_classification_owner==='RRR.Trading'&&e.impact_classification_version==='rrr-economic-impact-v1'&&impactRules.has(e.impact_classification_rule)&&typeof e.impact_classification_basis==='string'&&!!e.impact_classification_basis.trim();
const verified=e=>{if(e.stale===true||e.time_status!=='VERIFIED'||time(e.scheduled_at)===null||!safeUrl(e.time_source))return false;try{return M.date(time(e.scheduled_at),e.release_timezone)===e.release_date;}catch{return false;}};
const eventRisk=e=>fresh()&&e.event_risk?.version==='economic-event-risk-v1'&&time(snapshot?.risk_assessed_at)!==null&&Date.now()-time(snapshot.risk_assessed_at)>=-30000&&Date.now()-time(snapshot.risk_assessed_at)<120000&&(verified(e)||e.event_risk.state==='TIME_UNVERIFIED')&&['SCHEDULED','APPROACHING','HIGH_ALERT','RELEASE_WINDOW','POST_RELEASE_WINDOW','TIME_UNVERIFIED','DATA_STALE','UNKNOWN','CANCELLED','COMPLETED'].includes(e.event_risk.state)?e.event_risk.state:'UNASSESSED';
const lacksClassification=()=>snapshot?.events?.some(e=>e&&typeof e==='object'&&(!Object.hasOwn(e,'impact')||(e.impact==='HIGH'&&!high(e))));
function candidates(){
 if(!fresh())return [];
 return snapshot.events.slice(0,500).filter(e=>{
  if(!e||typeof e!=='object'||e.stale===true||!M.validDate(e.release_date)||!high(e)||['CANCELLED','POSTPONED','MISSING_FROM_SOURCE'].includes(e.event_status))return false;
  if(verified(e))return time(e.scheduled_at)>Date.now();
  // A supplied but unverified timestamp is never a countdown or a guessed date.
  if(e.scheduled_at!==null&&e.scheduled_at!==undefined||!String(e.time_status).startsWith('DATE CONFIRMED'))return false;
  // Retain source dates separately. Date boundaries cannot confirm publication.
  try{M.date(Date.now(),e.release_timezone);return true;}catch{return false;}
 });
}
function overlapsWeek(e){
 if(verified(e)){const at=time(e.scheduled_at);return at>=days[0].from&&at<days[6].to;}
 try{return M.instant(e.release_date,0,e.release_timezone)<days[6].to&&M.instant(M.shift(e.release_date,1),0,e.release_timezone)>days[0].from;}catch{return false;}
}
function countdown(at){const mins=Math.max(0,Math.floor((at-Date.now())/60000));return mins<1?'IN LESS THAN 1 MINUTE':`IN ${Math.floor(mins/1440)} DAYS ${Math.floor(mins%1440/60)} HOURS ${mins%60} MINUTES`;}
function announcement(e,key){
 const d=node('details',undefined,'announcement');d.dataset.eventKey=key;d.open=openEvents.has(key);
 d.addEventListener('toggle',()=>{if(!d.isConnected)return;if(d.open)openEvents.add(key);else openEvents.delete(key);});
 const summary=node('summary');summary.dataset.focusKey='event-'+key;summary.append(node('span','HIGH · ','impact-label'),document.createTextNode(text(e.title)),node('small',verified(e)?format(e.scheduled_at):`${e.release_date} · ${text(e.release_timezone)} · TIME NOT VERIFIED`));d.append(summary);
 const body=node('div',undefined,'event-details');
 for(const [label,v] of [['Announcement',text(e.title)],['Category',text(e.event_category)],['Country / region',text(e.country)],['Data source',text(e.source)],['Source calendar date',`${e.release_date} · ${text(e.release_timezone)}`],['Verified release timestamp',verified(e)?text(e.scheduled_at):'TIME NOT VERIFIED'],['Brisbane time',verified(e)?format(e.scheduled_at):'Unavailable without a verified timestamp'],['Impact','HIGH · reviewed RRR.Trading assessment'],['Classification version',text(e.impact_classification_version)],['Classification basis',text(e.impact_classification_basis)],['Verification',text(e.time_status)],['Forecast','Forecast unavailable']])body.append(node('p',`${label}: ${v}`));
 body.append(node('p',`Event risk: ${eventRisk(e)} · informational only; not controlling trades.`));
 if(e.reference_period)body.append(node('p',`Official reference period: ${text(e.reference_period)}`));
 if(e.reporting_period)body.append(node('p',`Official release description: ${text(e.reporting_period)}`));
 if(verified(e))body.append(node('p',countdown(time(e.scheduled_at)),'event-countdown'));
 body.append(node('p','Previous original release: unavailable. Revised historical context below is not a consensus forecast or the original prior print.'));
 const dl=node('dl');for(const p of (Array.isArray(e.previous)?e.previous:[]).slice(0,20)){
  if(!p||typeof p!=='object')continue;dl.append(node('dt',`Historical context · ${text(p.label)}`));
  const ok=typeof p.value==='number'&&Number.isFinite(p.value)&&p.status==='available';
  dl.append(node('dd',ok?`${p.value.toLocaleString('en-AU',{maximumFractionDigits:3})} · ${text(p.units)}`:p.status==='stale'?'Stale historical observation · unavailable as current context':'Previous value unavailable'));
  dl.append(node('dd',`Reporting period: ${text(p.observation_period)} · ${text(p.frequency)}`));if(p.vintage)dl.append(node('dd',text(p.vintage)));if(p.retrieved_at)dl.append(node('dd',`Retrieved: ${format(p.retrieved_at)}`));const link=node('dd');source(link,'FRED series',p.source_url);dl.append(link);
 }body.append(dl);source(body,'Release source',e.source_url);body.append(node('p'));source(body,'Official time source',e.time_source);body.append(node('p'));source(body,'Official announcement identity supporting classification',e.impact_source);d.append(body);return d;
}
function updateNow(){
 const now=Date.now(),active=M.active(now);
 $('current-markets').textContent=active.length?active.map(s=>s.name).join(' + ')+' ACTIVE':'TRADITIONAL WINDOWS INACTIVE';
 $('brisbane-clock').textContent=dayLabel(M.date(now))+' · '+clock(now)+' Brisbane (AEST)';
 const indicators=$('market-indicators');indicators.replaceChildren();for(const s of M.sessions){const on=active.some(a=>a.id===s.id),label=node('span',`${s.name} · ${on?'ACTIVE':'INACTIVE'}`,'market-indicator');label.dataset.active=String(on);indicators.append(label);}
 for(const row of document.querySelectorAll('.session-row[data-from]')){const on=now>=+row.dataset.from&&now<+row.dataset.to;row.dataset.active=String(on);row.querySelector('.session-state').textContent=on?'ACTIVE':'INACTIVE';}
}
function summary(events){
 const host=$('next-announcement');host.replaceChildren();
 if(!ready){host.append(node('p','Loading calendar…','summary-value'));return;}
 if(!fresh()){host.append(node('p','Calendar unavailable','summary-value'),node('p','Upcoming announcements cannot currently be verified.','summary-note'));return;}
 if(!events.length){host.append(node('p',lacksClassification()?'High-impact classification unavailable':snapshot.events.length?'No eligible upcoming HIGH releases returned':'No upcoming releases returned','summary-value'),node('p',lacksClassification()?'The calendar source does not supply verified high-impact classifications. Announcements are withheld until verified.':'No eligible upcoming evidence within the saved window; global coverage remains incomplete.','summary-note'));return;}
 // Verified-time ordering is independent of date-only source dates.
 const upcoming=events.filter(e=>verified(e)||e.release_date>M.date(Date.now(),e.release_timezone));
 const next=upcoming.filter(verified).sort((a,b)=>time(a.scheduled_at)-time(b.scheduled_at))[0]||upcoming.filter(e=>!verified(e)).sort((a,b)=>a.release_date.localeCompare(b.release_date))[0];
 if(!next){host.append(node('p','Upcoming timing unverified','summary-value'),node('p','Date-only records remain below; passage of a source date does not confirm release.','summary-note'));return;}
 host.append(node('p',text(next.title),'summary-value'),node('p','HIGH IMPACT','impact-label'),node('p',verified(next)?format(next.scheduled_at):`${dayLabel(next.release_date)} · ${text(next.release_timezone)} (source date)`));
 host.append(node('p',verified(next)?countdown(time(next.scheduled_at)):'TIME NOT VERIFIED · release order within date-only evidence is uncertain',verified(next)?'event-countdown':'summary-note'));
 if(verified(next)&&events.some(e=>!verified(e)))host.append(node('p','Next verified-time release. Date-only announcements below may precede it; their release order is unverified.','summary-note'));
 host.append(node('p',`Event risk: ${eventRisk(next)} · informational only`,'summary-note'));
}
function render(){
 if(followCurrentWeek)selected=M.monday();
 lastMinute=String(Math.floor(Date.now()/60000))+':'+fresh();days=M.week(selected);
 const events=candidates(),weekly=events.filter(overlapsWeek),timed=weekly.filter(verified),regional=weekly.filter(e=>!verified(e));
 const activeKey=document.activeElement?.dataset.focusKey;
 for(const d of document.querySelectorAll('details[data-event-key]')){if(d.open)openEvents.add(d.dataset.eventKey);else openEvents.delete(d.dataset.eventKey);}
 $('week-range').textContent=dayLabel(selected)+' – '+dayLabel(M.shift(selected,6));
 const h=horizon();$('schedule-horizon').textContent=h?`Calendar coverage: ${h.start} – ${h.end}. Dates outside this source window are not covered.`:'Calendar horizon unavailable. Week navigation is limited to the current week until coverage is verified.';
 $('previous-week').disabled=!fresh()||!h||M.shift(selected,-1)<h.start;
 $('next-week').disabled=!fresh()||!h||M.shift(selected,7)>h.end;
 $('schedule-status').dataset.state=!ready?'loading':!fresh()?'unavailable':lacksClassification()&&!events.length?'classification':snapshot.status;
 $('schedule-status').textContent=!ready?'Loading economic schedule…':!fresh()?'Economic calendar unavailable or stale. Announcement times and countdowns are suspended; regional windows remain indicative.':lacksClassification()&&!events.length?'High-impact classification unavailable. Scheduled releases are not shown until their impact is verified.':snapshot.status==='partial'?'Partial calendar coverage. Missing sources are identified in coverage details.':weekly.length?'Verified high-impact evidence within the displayed week.':`No eligible upcoming high-impact announcements returned for this week within the saved window. Global coverage is incomplete.`;
 if(fresh()&&snapshot.status==='partial'&&!events.length)$('schedule-status').textContent+=' Partial source coverage also applies.';
 const list=$('schedule-events');list.replaceChildren();
 for(const day of days){
  const today=day.date===M.date(Date.now()),dayName=dayLabel(day.date).split(' ')[0].toUpperCase();
  const head=node('tr',undefined,'day-disclosure'),th=node('th');th.colSpan=5;th.scope='rowgroup';const toggle=node('button',undefined,'day-toggle');toggle.type='button';toggle.dataset.focusKey='day-'+day.date;toggle.setAttribute('aria-expanded',String(expandedDays.has(day.date)));toggle.setAttribute('aria-controls','rows-'+day.date);
  toggle.append(node('span',`${dayLabel(day.date)}${today?' · TODAY':''}`),node('span',expandedDays.has(day.date)?'−':'+'));th.append(toggle);head.append(th);list.append(head);
  const groupId='rows-'+day.date;
  const entries=day.sessions.map(s=>({s,events:timed.filter(e=>{const at=time(e.scheduled_at);return at>=s.clipFrom&&at<s.clipTo&&s.countries.includes(e.country);})}));
  const outside=timed.filter(e=>{const at=time(e.scheduled_at);return at>=day.from&&at<day.to&&!entries.some(r=>r.events.includes(e));});
  if(outside.length)entries.push({s:null,events:outside,label:'REGIONAL ANNOUNCEMENTS',note:'Outside the regional activity window'});
  if(!day.sessions.length||[0,6].includes(new Date(day.date+'T00:00:00Z').getUTCDay()))entries.push({s:null,events:[],label:'CRYPTO DERIVATIVES',note:'OPEN 24/7 · traditional markets generally closed'});
  entries.forEach((entry,i)=>{
   const {s}=entry,row=node('tr',undefined,'session-row'+(i===0?' day-start':''));row.dataset.day=day.date;row.dataset.collapsed=String(!expandedDays.has(day.date));row.id=groupId+'-'+i;
   if(s){row.dataset.from=String(s.clipFrom);row.dataset.to=String(s.clipTo);}
   const dc=node('td',undefined,'day-cell');if(i===0){dc.append(node('strong',dayName),node('small',day.date));if(today)dc.append(node('span','TODAY','today-label'));}
   const name=node('td',undefined,'session-name');name.append(node('strong',s?s.name:entry.label),node('small',s?'Indicative activity window':entry.note,s?'session-state':undefined));
   const tm=node('td',s?`${s.clipFrom===day.from?'00:00':clock(s.clipFrom)} – ${s.clipTo===day.to?'24:00':clock(s.clipTo)}`:entry.label==='CRYPTO DERIVATIVES'?'00:00 – 24:00':'See verified release times','session-time');
   if(s&&(s.from<day.from||s.to>day.to))tm.append(node('small',s.from<day.from?`Continues from previous day · ${s.sourceDate} at source`:'Continues next Brisbane day'));
   const outsideCoverage=h&&(day.date<h.start||day.date>h.end);
   const emptyText=outsideCoverage?'Outside calendar coverage':!fresh()||!h?'Calendar evidence unavailable or stale':lacksClassification()?'HIGH-impact classification unavailable':'No matching HIGH-impact events in the available calendar data for this window. Global coverage is partial; date-only announcements are listed separately.';
   const ev=node('td',undefined,'announcement-cell');if(entry.events.length){ev.append(node('span',`${entry.events.length} announcement${entry.events.length===1?'':'s'}`,'event-count'));for(const e of entry.events)ev.append(announcement(e,String(snapshot.events.indexOf(e))));}else ev.append(node('span',emptyText,'row-empty'));
   const risk=node('td',undefined,'risk-cell');risk.append(node('span',entry.events.length?'HIGH IMPACT':'UNASSESSED','risk-label'+(entry.events.length?' high':'')));risk.append(node('small',entry.events.length?[...new Set(entry.events.map(riskState=>eventRisk(riskState)))].join(' · ').replaceAll('_',' ')+' · informational':'Risk unassessed — '+(outsideCoverage?'outside calendar coverage.':!fresh()?'evidence unavailable or stale.':'calendar evidence incomplete.')));row.append(dc,name,tm,ev,risk);list.append(row);
  });
  toggle.setAttribute('aria-controls',entries.map((_,i)=>groupId+'-'+i).join(' '));
  toggle.addEventListener('click',()=>{const open=!expandedDays.has(day.date);if(open)expandedDays.add(day.date);else expandedDays.delete(day.date);toggle.setAttribute('aria-expanded',String(open));toggle.lastChild.textContent=open?'−':'+';for(const r of list.querySelectorAll('.session-row'))if(r.dataset.day===day.date)r.dataset.collapsed=String(!open);});
 }
 $('regional-announcements').hidden=!regional.length;$('regional-events').replaceChildren();for(const e of regional)$('regional-events').append(announcement(e,String(snapshot.events.indexOf(e))));
 summary(events);updateNow();
 $('schedule-updated').textContent=`Saved evidence refreshed: ${format(snapshot?.generated_at)}. Source dates and verified times are distinct; failures or expiry suspend current claims.`;
 const health=snapshot?.health||{};$('schedule-health').textContent=`FRED: ${fresh()?text(health.fred_status):'unavailable / stale'} · Last successful refresh: ${format(health.last_successful_fred_refresh)} · Saved releases: ${snapshot?.events?.length??'Unavailable'} · Impact classification: ${text(snapshot?.classification_version)} · Calendar: ${text(health.calendar_status)} · HIGH: ${fresh()?health.high_impact_events??'Unavailable':'Unavailable'} · Date-only: ${fresh()?health.date_only_events??'Unavailable':'Unavailable'}`;
 const gaps=$('schedule-gaps');gaps.replaceChildren();for(const gap of (Array.isArray(snapshot?.coverage_gaps)?snapshot.coverage_gaps:['Saved economic calendar unavailable.']).slice(0,50))gaps.append(node('li',text(gap)));
 for(const [name,v] of Object.entries(health.official_sources||{}).slice(0,20))gaps.append(node('li',`${name}: ${text(v?.status)}${v?.error?' · '+text(v.error):''}`));
 for(const error of (Array.isArray(health.errors)?health.errors:[]).slice(0,20))gaps.append(node('li',text(error?.error)));
 if(activeKey)Array.from(document.querySelectorAll('[data-focus-key]')).find(e=>e.dataset.focusKey===activeKey)?.focus({preventScroll:true});
}
async function refresh(){if(busy)return;busy=true;const b=$('schedule-refresh');b.disabled=true;b.textContent='Checking…';controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(endpoint,{method:'GET',cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const value=await r.json();if(value?.schema_version!==1||!Array.isArray(value.events)||!['ok','partial','unavailable','stale'].includes(value.status))throw Error();snapshot=value;failed=false;}catch{failed=true;}finally{clearTimeout(timeout);ready=true;busy=false;b.disabled=false;b.textContent='↻ Refresh';render();}}
function move(d){selected=d;followCurrentWeek=d===M.monday();expandedDays.clear();expandedDays.add(d===M.monday()?M.date(Date.now()):d);render();}
$('previous-week').addEventListener('click',()=>move(M.shift(selected,-7)));$('next-week').addEventListener('click',()=>move(M.shift(selected,7)));$('current-week').addEventListener('click',()=>move(M.monday()));$('today').addEventListener('click',()=>{move(M.monday());const target=Array.from(document.querySelectorAll('.day-toggle')).find(e=>e.dataset.focusKey==='day-'+M.date(Date.now()));if(matchMedia('(max-width:700px)').matches)target?.focus();else document.querySelector('.today-label')?.scrollIntoView({block:'center'});});
$('schedule-refresh').addEventListener('click',refresh);render();refresh();
const poll=setInterval(()=>{if(!document.hidden)refresh();},60000),tick=setInterval(()=>{if(document.hidden)return;const key=String(Math.floor(Date.now()/60000))+':'+fresh();if(key!==lastMinute)render();else updateNow();},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();refresh();}});window.addEventListener('pagehide',()=>{clearInterval(poll);clearInterval(tick);controller?.abort();});
})();

(() => {
'use strict';
const M=window.MarketSchedule,endpoint='https://api.rrr.trading/api/schedule/economic';
const $=id=>document.getElementById(id),node=(tag,value,cls)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);if(cls)e.className=cls;return e;};
const time=v=>typeof v==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
const text=v=>typeof v==='string'&&v.trim()?v:'Unavailable';
const clock=at=>new Intl.DateTimeFormat('en-AU',{timeZone:M.zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(at);
const format=v=>time(v)===null?'Unavailable':new Intl.DateTimeFormat('en-AU',{timeZone:M.zone,dateStyle:'medium',timeStyle:'short'}).format(time(v))+' AEST';
const dayLabel=d=>new Intl.DateTimeFormat('en-AU',{timeZone:'UTC',weekday:'long',day:'numeric',month:'short'}).format(Date.parse(d+'T00:00:00Z'));
const safeUrl=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&['fred.stlouisfed.org','www.bls.gov','www.bea.gov','www.rba.gov.au','www.federalreserve.gov','www.ecb.europa.eu','www.bankofengland.co.uk','www.boj.or.jp','www.ons.gov.uk','www.abs.gov.au','www.census.gov','ec.europa.eu','www.stat.go.jp','www.esri.cao.go.jp'].includes(u.hostname);}catch{return false;}};
let snapshot=null,failed=false,busy=false,controller=null,selected=M.date(Date.now()),followToday=true,lastMinute='',days=M.week(selected),ready=false,lastDate=M.date(Date.now());
const expandedDays=new Set([M.date(Date.now())]),openEvents=new Set();
const fresh=()=>{const at=time(snapshot?.generated_at),end=time(snapshot?.expires_at);return !failed&&at!==null&&end!==null&&at<=Date.now()+30000&&Date.now()-at<=M.DAY&&end>Date.now()&&snapshot?.stale!==true&&['ok','partial'].includes(snapshot?.status);};
const horizon=()=>M.validDate(snapshot?.window_start)&&M.validDate(snapshot?.window_end)&&snapshot.window_end>=snapshot.window_start&&Date.parse(snapshot.window_end)-Date.parse(snapshot.window_start)<=366*M.DAY?{start:snapshot.window_start,end:snapshot.window_end}:null;
function source(parent,label,url){if(!safeUrl(url))return;const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);}
// HIGH is a reviewed RRR.Trading judgement; the official URL supports announcement identity.
const impactRules=new Set(['us-cpi','us-employment','us-gdp','us-pce','au-policy','us-policy','eu-policy','jp-policy','uk-policy','uk-cpi','uk-employment','uk-gdp','au-cpi','au-employment','au-gdp','us-ppi','us-retail','uk-monthly-gdp','eu-inflation','eu-flash-inflation','eu-gdp','eu-gdp-employment','jp-cpi','jp-gdp']);
const high=e=>e.impact==='HIGH'&&e.impact_verified===true&&safeUrl(e.impact_source)&&e.impact_classification_owner==='RRR.Trading'&&e.impact_classification_version==='rrr-economic-impact-v1'&&impactRules.has(e.impact_classification_rule)&&typeof e.impact_classification_basis==='string'&&!!e.impact_classification_basis.trim();
const verified=e=>{if(e.stale===true||e.time_status!=='VERIFIED'||time(e.scheduled_at)===null||!safeUrl(e.time_source))return false;try{return M.date(time(e.scheduled_at),e.release_timezone)===e.release_date;}catch{return false;}};
const eventRisk=e=>fresh()&&e.event_risk?.version==='economic-event-risk-v1'&&time(snapshot?.risk_assessed_at)!==null&&Date.now()-time(snapshot.risk_assessed_at)>=-30000&&Date.now()-time(snapshot.risk_assessed_at)<120000&&(verified(e)||e.event_risk.state==='TIME_UNVERIFIED')&&['SCHEDULED','APPROACHING','HIGH_ALERT','RELEASE_WINDOW','POST_RELEASE_WINDOW','TIME_UNVERIFIED','DATA_STALE','UNKNOWN','CANCELLED','COMPLETED'].includes(e.event_risk.state)?e.event_risk.state:'UNASSESSED';
const lacksClassification=()=>snapshot?.events?.some(e=>e&&typeof e==='object'&&(!Object.hasOwn(e,'impact')||(e.impact==='HIGH'&&!high(e))));
function candidates(){
 if(!fresh())return [];
 return snapshot.events.slice(0,500).filter(e=>{
  if(!e||typeof e!=='object'||e.stale===true||!M.validDate(e.release_date)||!high(e)||['CANCELLED','POSTPONED','MISSING_FROM_SOURCE','CONFIRMED_RELEASED','RELEASED','COMPLETED'].includes(e.event_status)||e.event_risk?.state==='COMPLETED'||time(e.actual_release_at)!==null&&time(e.actual_release_at)<=Date.now())return false;
  if(verified(e))return time(e.scheduled_at)>Date.now();
  // A supplied but unverified timestamp is never a countdown or a guessed date.
  if(e.scheduled_at!==null&&e.scheduled_at!==undefined||!String(e.time_status).startsWith('DATE CONFIRMED'))return false;
  // Withhold older source dates without claiming publication was confirmed.
  try{return e.release_date>=M.date(Date.now())&&e.release_date>=M.date(Date.now(),e.release_timezone);}catch{return false;}
 });
}
function overlapsWeek(e){
 if(verified(e)){const at=time(e.scheduled_at);return at>=days[0].from&&at<days[6].to;}
 try{return M.instant(e.release_date,0,e.release_timezone)<days[6].to&&M.instant(M.shift(e.release_date,1),0,e.release_timezone)>days[0].from;}catch{return false;}
}
function countdown(at){const mins=Math.max(0,Math.floor((at-Date.now())/60000));return mins<1?'IN LESS THAN 1 MINUTE':`IN ${Math.floor(mins/1440)} DAYS ${Math.floor(mins%1440/60)} HOURS ${mins%60} MINUTES`;}
function announcement(e,key){
 const d=node('details',undefined,'announcement');d.dataset.eventKey=key;d.open=openEvents.has(key);if(verified(e))d.dataset.at=String(time(e.scheduled_at));
 d.addEventListener('toggle',()=>{if(!d.isConnected)return;if(d.open)openEvents.add(key);else openEvents.delete(key);});
 const summary=node('summary');summary.dataset.focusKey='event-'+key;summary.append(node('span','HIGH · ','impact-label'),document.createTextNode(text(e.title)),node('small',`${text(e.country)} · ${verified(e)?format(e.scheduled_at):`${e.release_date} · ${text(e.release_timezone)} · TIME NOT VERIFIED`}`));d.append(summary);
 const body=node('div',undefined,'event-details');
 body.append(node('p',`Country / region: ${text(e.country)} · ${text(e.source)}`));
 body.append(node('p',verified(e)?countdown(time(e.scheduled_at)):'TIME NOT VERIFIED · source-local date; publication status unknown',verified(e)?'event-countdown':undefined));
 const risk=eventRisk(e);if(risk!=='UNASSESSED')body.append(node('p',`Event risk: ${risk.replaceAll('_',' ')} · informational`));
 source(body,'Official announcement source',e.source_url);source(body,'Official time source',e.time_source);
 d.append(body);return d;
}
function updateNow(){
 const now=Date.now();
 for(const row of document.querySelectorAll('.session-row[data-from]')){const on=now>=+row.dataset.from&&now<+row.dataset.to;row.dataset.active=String(on);row.querySelector('.session-state').textContent=on?'ACTIVE':'UPCOMING';}
}
function scrollCurrent(){
 const row=document.querySelector('.session-row[data-active="true"]')||document.querySelector('.session-row[data-from]')||document.querySelector('.session-row');
 if(!row)return;
 expandedDays.add(row.dataset.day);
 for(const r of document.querySelectorAll('.session-row'))if(r.dataset.day===row.dataset.day)r.dataset.collapsed='false';
 const toggle=document.querySelector('[data-focus-key="day-'+row.dataset.day+'"]');if(toggle){toggle.setAttribute('aria-expanded','true');toggle.lastChild.textContent='−';}
 const box=row.getBoundingClientRect();if(box.bottom>innerHeight||box.top<0)row.scrollIntoView({block:'center'});
}
function render(){
 const todayDate=M.date(Date.now());
 if(todayDate!==lastDate){lastDate=todayDate;expandedDays.add(todayDate);}
 if(followToday||selected<todayDate)selected=todayDate;
 lastMinute=String(Math.floor(Date.now()/60000))+':'+fresh();days=M.week(selected);
 const events=candidates(),weekly=events.filter(overlapsWeek),timed=weekly.filter(verified),regional=weekly.filter(e=>!verified(e));
 const activeKey=document.activeElement?.dataset.focusKey;
 for(const d of document.querySelectorAll('details[data-event-key]')){if(d.open)openEvents.add(d.dataset.eventKey);else openEvents.delete(d.dataset.eventKey);}
 $('week-range').textContent=dayLabel(selected)+' – '+dayLabel(M.shift(selected,6));
 const h=horizon();$('schedule-horizon').textContent=h?`Saved announcement coverage through ${h.end}; other dates are outside coverage.`:'Announcement coverage unavailable.';
 $('previous-week').disabled=selected<=todayDate;
 $('next-week').disabled=false;
 $('schedule-status').dataset.state=!ready?'loading':!fresh()?'unavailable':lacksClassification()&&!events.length?'classification':snapshot.status;
 $('schedule-status').textContent=!ready?'Loading economic schedule…':!fresh()?'Economic calendar unavailable or stale. Regional windows remain indicative.':lacksClassification()&&!events.length?'High-impact classification unavailable.':!weekly.length?'No upcoming high-impact announcements. Calendar coverage is partial.':snapshot.status==='partial'?'Partial announcement coverage.':'Upcoming high-impact announcements in this seven-day period.';
 if(fresh()&&snapshot.status==='partial'&&!events.length)$('schedule-status').textContent+=' Partial source coverage also applies.';
 const list=$('schedule-events');list.replaceChildren();
 for(const day of days){
  const today=day.date===M.date(Date.now()),dayName=dayLabel(day.date).split(' ')[0].toUpperCase();
  const head=node('tr',undefined,'day-disclosure'),th=node('th');th.colSpan=4;th.scope='rowgroup';const toggle=node('button',undefined,'day-toggle');toggle.type='button';toggle.dataset.focusKey='day-'+day.date;toggle.setAttribute('aria-expanded',String(expandedDays.has(day.date)));toggle.setAttribute('aria-controls','rows-'+day.date);
  toggle.append(node('span',`${dayLabel(day.date)}${today?' · TODAY':''}`),node('span',expandedDays.has(day.date)?'−':'+'));th.append(toggle);head.append(th);list.append(head);
  const groupId='rows-'+day.date;
  const entries=day.sessions.filter(s=>s.to>Date.now()).map(s=>({s,events:timed.filter(e=>{const at=time(e.scheduled_at);return at>=s.clipFrom&&at<s.clipTo&&s.countries.includes(e.country);})}));
  const outside=timed.filter(e=>{const at=time(e.scheduled_at);return at>=day.from&&at<day.to&&!entries.some(r=>r.events.includes(e));});
  if(outside.length)entries.push({s:null,events:outside,label:'REGIONAL ANNOUNCEMENTS',note:'Outside the regional activity window'});
  const dateOnly=regional.filter(e=>{try{return days.find(d=>M.instant(e.release_date,0,e.release_timezone)<d.to&&M.instant(M.shift(e.release_date,1),0,e.release_timezone)>d.from)?.date===day.date;}catch{return false;}});
  if(dateOnly.length)entries.push({s:null,events:dateOnly,label:'DATE-ONLY ANNOUNCEMENTS',note:'Source-local dates · Brisbane release day unverified'});
  if(!entries.length||[0,6].includes(new Date(day.date+'T00:00:00Z').getUTCDay()))entries.push({s:null,events:[],label:'CRYPTO DERIVATIVES',note:'OPEN 24/7 · traditional markets generally closed'});
  entries.forEach((entry,i)=>{
   const {s}=entry,row=node('tr',undefined,'session-row'+(i===0?' day-start':''));row.dataset.day=day.date;row.dataset.collapsed=String(!expandedDays.has(day.date));row.id=groupId+'-'+i;
   if(s){row.dataset.from=String(s.clipFrom);row.dataset.to=String(s.clipTo);}
   const dc=node('td',undefined,'day-cell');if(i===0){dc.append(node('strong',dayName),node('small',day.date));if(today)dc.append(node('span','TODAY','today-label'));}
   const name=node('td',undefined,'session-name');name.append(node('strong',s?s.name:entry.label),node('small',s?'Indicative activity window':entry.note,s?'session-state':undefined));
   const tm=node('td',s?`${s.clipFrom===day.from?'00:00':clock(s.clipFrom)} – ${s.clipTo===day.to?'24:00':clock(s.clipTo)}`:entry.label==='CRYPTO DERIVATIVES'?'00:00 – 24:00':'See verified release times','session-time');
   if(s&&(s.from<day.from||s.to>day.to))tm.append(node('small',s.from<day.from?'Overnight session continuing':'Continues next Brisbane day'));
   if(entry.label==='DATE-ONLY ANNOUNCEMENTS')tm.textContent='TIME NOT VERIFIED';
   const outsideCoverage=h&&(day.date<h.start||day.date>h.end);
   const emptyText=outsideCoverage?'Outside calendar coverage':!fresh()||!h?'Calendar evidence unavailable or stale':lacksClassification()?'HIGH-impact classification unavailable':'No upcoming high-impact announcements.';
   const ev=node('td',undefined,'announcement-cell');if(entry.events.length){ev.append(node('span',`${entry.events.length} announcement${entry.events.length===1?'':'s'}`,'event-count'));for(const e of entry.events)ev.append(announcement(e,String(snapshot.events.indexOf(e))));}else ev.append(node('span',emptyText,'row-empty'));
   row.append(dc,name,tm,ev);list.append(row);
  });
  toggle.setAttribute('aria-controls',entries.map((_,i)=>groupId+'-'+i).join(' '));
  toggle.addEventListener('click',()=>{const open=!expandedDays.has(day.date);if(open)expandedDays.add(day.date);else expandedDays.delete(day.date);toggle.setAttribute('aria-expanded',String(open));toggle.lastChild.textContent=open?'−':'+';for(const r of list.querySelectorAll('.session-row'))if(r.dataset.day===day.date)r.dataset.collapsed=String(!open);});
 }
 updateNow();
 if(activeKey)Array.from(document.querySelectorAll('[data-focus-key]')).find(e=>e.dataset.focusKey===activeKey)?.focus({preventScroll:true});
}
async function refresh(){if(busy)return;busy=true;const b=$('schedule-refresh');b.disabled=true;b.textContent='Checking…';controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(endpoint,{method:'GET',cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const value=await r.json();if(value?.schema_version!==1||!Array.isArray(value.events)||!['ok','partial','unavailable','stale'].includes(value.status))throw Error();snapshot=value;failed=false;}catch{failed=true;}finally{clearTimeout(timeout);ready=true;busy=false;b.disabled=false;b.textContent='↻ Refresh';render();}}
function move(d){if(!M.validDate(d))return;selected=d<M.date(Date.now())?M.date(Date.now()):d;followToday=selected===M.date(Date.now());expandedDays.clear();expandedDays.add(selected);render();}
$('previous-week').addEventListener('click',()=>move(M.shift(selected,-7)));$('next-week').addEventListener('click',()=>move(M.shift(selected,7)));$('current-week').addEventListener('click',()=>move(M.date(Date.now())));$('today').addEventListener('click',()=>{move(M.date(Date.now()));const target=Array.from(document.querySelectorAll('.day-toggle')).find(e=>e.dataset.focusKey==='day-'+M.date(Date.now()));if(matchMedia('(max-width:700px)').matches)target?.focus();else document.querySelector('.today-label')?.scrollIntoView({block:'center'});});
$('schedule-refresh').addEventListener('click',refresh);render();scrollCurrent();refresh();
const poll=setInterval(()=>{if(!document.hidden)refresh();},60000),tick=setInterval(()=>{if(document.hidden)return;const key=String(Math.floor(Date.now()/60000))+':'+fresh();if(key!==lastMinute||lastDate!==M.date(Date.now())||Array.from(document.querySelectorAll('.session-row[data-to],.announcement[data-at]')).some(r=>+(r.dataset.to||r.dataset.at)<=Date.now()))render();else updateNow();},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();refresh();}});window.addEventListener('pagehide',()=>{clearInterval(poll);clearInterval(tick);controller?.abort();});
})();

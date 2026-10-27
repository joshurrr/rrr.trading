(() => {
'use strict';
const M=window.MarketSchedule,api='https://api.rrr.trading/api/schedule/',endpoint=api+'economic';
const $=id=>document.getElementById(id),node=(tag,value,cls)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);if(cls)e.className=cls;return e;};
const time=v=>typeof v==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
const text=v=>typeof v==='string'&&v.trim()?v:'Unavailable';
const clock=at=>new Intl.DateTimeFormat('en-AU',{timeZone:M.zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(at);
const format=v=>time(v)===null?'Unavailable':new Intl.DateTimeFormat('en-AU',{timeZone:M.zone,dateStyle:'medium',timeStyle:'short',hourCycle:'h23'}).format(time(v))+' AEST';
const formatBrisbane=v=>time(v)===null?'Unavailable':new Intl.DateTimeFormat('en-AU',{timeZone:M.zone,dateStyle:'medium',timeStyle:'short',hourCycle:'h23'}).format(time(v))+' Brisbane';
const dayLabel=d=>new Intl.DateTimeFormat('en-AU',{timeZone:'UTC',weekday:'long',day:'numeric',month:'short'}).format(Date.parse(d+'T00:00:00Z'));
const safeUrl=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&['fred.stlouisfed.org','www.bls.gov','www.bea.gov','www.rba.gov.au','www.federalreserve.gov','www.ecb.europa.eu','www.bankofengland.co.uk','www.boj.or.jp','www.ons.gov.uk','www.abs.gov.au','www.census.gov','www.newyorkfed.org','ec.europa.eu','www.stat.go.jp','www.esri.cao.go.jp'].includes(u.hostname);}catch{return false;}};
let snapshot=null,riskSnapshot=null,healthSnapshot=null,solCalendar=null,solCalendarFailed=true,failed=false,riskFailed=false,healthFailed=false,busy=false,controller=null,selected=M.date(Date.now()),followToday=true,lastMinute='',days=M.week(selected),ready=false,lastDate=M.date(Date.now());
const expandedDays=new Set([M.date(Date.now())]),openEvents=new Set();
const fresh=()=>{const at=time(snapshot?.generated_at),end=time(snapshot?.expires_at);return !failed&&at!==null&&end!==null&&at<=Date.now()+30000&&Date.now()-at<=M.DAY&&end>Date.now()&&snapshot?.stale!==true&&['ok','partial'].includes(snapshot?.status);};
const horizon=()=>M.validDate(snapshot?.window_start)&&M.validDate(snapshot?.window_end)&&snapshot.window_end>=snapshot.window_start&&Date.parse(snapshot.window_end)-Date.parse(snapshot.window_start)<=366*M.DAY?{start:snapshot.window_start,end:snapshot.window_end}:null;
function source(parent,label,url){if(!safeUrl(url))return;const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);}
const eventRiskValue=e=>e?.event_risk||e?.risk;
const validStatus=v=>['ok','partial','unavailable','stale'].includes(v);
function ageLabel(v){const at=time(v);if(at===null)return 'Timestamp unavailable';const mins=Math.max(0,Math.floor((Date.now()-at)/60000));return `Assessed ${format(v)} · ${mins<60?`${mins} min ago`:`${Math.floor(mins/60)} hr ${mins%60} min ago`}`;}
function renderOverview(){
 const state=$('calendar-overview-state'),note=$('calendar-overview-note'),eventBox=$('calendar-events'),sourceBox=$('calendar-source-health');
 const sol=solCalendar,solState=sol?.state,solTimes=sol?.timestamps||{},data=sol?.data||{},coverage=data.coverage,window=data.decision_window;
 const solAt=time(solTimes.timestamp),solEnd=time(solTimes.expires_at),solExpired=solState==='STALE'||solEnd!==null&&solEnd<=Date.now(),solFresh=!solCalendarFailed&&['AVAILABLE','PARTIAL'].includes(solState)&&solAt!==null&&solAt<=Date.now()&&solEnd>Date.now();
 const required=['BLS','BEA','FED_EVENTS','FED','RETAIL'],checks=coverage?.checks||{};
 const complete=coverage?.policy==='crypto-critical-calendar-v1'&&required.every(k=>checks[k]?.status==='ok'&&time(checks[k]?.last_checked)!==null&&time(checks[k].last_checked)===time(checks[k].last_success));
 const riskValue=data.event_risk||sol?.event_risk||'UNKNOWN_EVENT_RISK';
 const decisionWindow=window?.previous_seconds===21600&&window?.upcoming_seconds===172800;
 const receiptsFresh=time(coverage?.expires_at)!==null&&time(coverage.expires_at)>Date.now();
 const supportedRisk=solState==='AVAILABLE'&&complete&&receiptsFresh&&decisionWindow&&Array.isArray(data.coverage_gaps)&&data.coverage_gaps.length===0&&data.rejected_events===0&&data.omitted_events===0&&['NO_MATERIAL_EVENT_RISK','MATERIAL_EVENT_RISK'].includes(riskValue);
 const risk=supportedRisk?riskValue:'UNKNOWN_EVENT_RISK';
 const coverageLabel=!coverage?'Unavailable':supportedRisk?'VERIFIED':'INCOMPLETE';
 const stateLabel=solExpired?'STALE':solState||'UNAVAILABLE';
 state.textContent=stateLabel;state.dataset.state=stateLabel==='AVAILABLE'&&solFresh?'current':stateLabel==='PARTIAL'?'partial':'unavailable';
 $('calendar-risk-state').textContent=risk.replaceAll('_',' ');
 $('calendar-risk-time').textContent=`Assessed ${format(solTimes.observed_at||data.risk_assessed_at)} · freshness ${solFresh?stateLabel==='PARTIAL'?'PARTIAL':'CURRENT':stateLabel==='STALE'?'STALE':'UNAVAILABLE'}`;
 $('calendar-coverage-state').textContent=coverageLabel;
 $('calendar-coverage-note').textContent=coverage?`${coverage.policy||'Policy unavailable'} · ${Object.keys(checks).length} critical receipts · ${receiptsFresh?'receipt current':'receipt stale or timestamp unavailable'}`:'Validated critical-source receipt not exposed.';
 $('calendar-readiness').textContent='Not exposed';
 $('calendar-snapshot-state').textContent=stateLabel;
 $('calendar-freshness').textContent=solFresh?`Saved ${format(solTimes.timestamp)} · expires ${format(solTimes.expires_at)}`:`Freshness ${solExpired?'STALE':'UNAVAILABLE'}`;
 const events=Array.isArray(data.events)?data.events:[];
 const material=decisionWindow?events.filter(e=>validSolCalendarEvent(e)&&time(e.scheduled_at)>=Date.now()-21600*1000&&time(e.scheduled_at)<=Date.now()+172800*1000).sort((a,b)=>time(a.scheduled_at)-time(b.scheduled_at)):[];
 const next=material.find(e=>time(e.scheduled_at)>=Date.now());
 $('calendar-next-event').textContent=next?text(next.name):'None verified';
 $('calendar-next-time').textContent=next?formatBrisbane(next.scheduled_at):'No upcoming verified time in the saved window';
 const successes=required.map(k=>checks[k]).filter(c=>c&&c.status==='ok'&&time(c.last_success)!==null);
 const checked=coverage?.checked_at;
 const allSuccessful=solState==='AVAILABLE'&&complete&&successes.length===required.length&&successes.every(c=>time(c.last_success)===time(checked));
 $('calendar-verified-at').textContent=allSuccessful?format(checked):'Unavailable';
 $('calendar-verified-note').textContent=allSuccessful?'All required receipts report success at this check time.':'Critical-source checks do not establish a complete successful verification.';
 note.textContent=!solFresh?'Saved SOL calendar evidence is unavailable or stale.':risk==='UNKNOWN_EVENT_RISK'?'Calendar coverage is incomplete or unverified; event risk remains UNKNOWN_EVENT_RISK.':risk==='NO_MATERIAL_EVENT_RISK'?'Validated critical-source checks found no material event in the decision window.':`${material.length} verified material event${material.length===1?'':'s'} in the saved decision window.`;
 $('calendar-window-note').textContent=decisionWindow?'Previous 6 hours · Upcoming 48 hours · Brisbane display timezone · per-request SOL event receipt not exposed':'Decision-window receipt missing or invalid; material-event window cannot be confirmed.';
 eventBox.replaceChildren();
 if(!solFresh||!decisionWindow)eventBox.append(node('p','Verified material events unavailable because the saved SOL calendar or decision-window receipt is missing or stale.'));
 else if(risk==='UNKNOWN_EVENT_RISK')eventBox.append(node('p','Coverage is incomplete. Listed events, if any, are verified saved events; absence from this list does not establish a quiet window.'));
 if(solFresh&&decisionWindow&&material.length){for(const e of material){const row=node('article',undefined,'calendar-event'),provenance=e.provenance||{};row.append(node('span',`${text(e.country)} · ${text(e.importance)} · ${text(e.event_phase).replaceAll('_',' ')}`,'calendar-event-impact'),node('strong',text(e.name),'calendar-event-title'),node('span',formatBrisbane(e.scheduled_at)+' · verified','calendar-event-time'),node('span',`Source: ${text(provenance.source)} · risk: ${text(e.risk.state).replaceAll('_',' ')}`,'calendar-event-risk'));if(typeof e.evidence_id==='string'&&/^C_[0-9a-f]{16}$/.test(e.evidence_id))row.append(node('small',`Saved calendar evidence: ${e.evidence_id}`,'calendar-event-reference'));if(provenance.time_source)source(row,'Time verification',provenance.time_source);if(provenance.impact_source)source(row,'Impact source',provenance.impact_source);for(const ref of Array.isArray(provenance.schedule_sources)?provenance.schedule_sources:[])source(row,'Official schedule',ref);eventBox.append(row);}}
 else if(solFresh&&decisionWindow&&risk==='NO_MATERIAL_EVENT_RISK')eventBox.append(node('p','NO_MATERIAL_EVENT_RISK · Validated critical-source checks found no material events in the previous 6 hours or upcoming 48 hours.'));
 else if(solFresh&&decisionWindow&&risk!=='UNKNOWN_EVENT_RISK')eventBox.append(node('p','No verified material events were returned in this saved decision window.'));
 sourceBox.replaceChildren();
 const header=node('p',coverage?`Critical coverage: ${coverageLabel} · checked ${format(coverage.checked_at)} · expires ${format(coverage.expires_at)}`:'Critical coverage receipt unavailable.');sourceBox.append(header);
 if(coverage){const list=node('ul',undefined,'receipt-list');for(const key of required){const c=checks[key];if(!c){list.append(node('li',`${key}: receipt missing`));continue;}const refs=Array.isArray(c.references)?c.references:[];const li=node('li',`${key} · ${text(c.provider)} · ${String(c.status||'unknown').toUpperCase()} · checked ${format(c.last_checked)} · success ${format(c.last_success)} · coverage ${format(c.coverage_start)}–${format(c.coverage_end)} · ${c.events??'—'} events`);for(const ref of refs)source(li,'Source',ref);list.append(li);}sourceBox.append(list);}
 const optional=data.optional_degradation||[];if(optional.length){sourceBox.append(node('p','Optional-source degradation'));const list=node('ul');for(const item of optional)list.append(node('li',item));sourceBox.append(list);}
 const health=sol?.health||snapshot?.health||healthSnapshot?.health||riskSnapshot?.calendar_health;
 const rows=Object.entries(health?.official_sources||{});if(rows.length){sourceBox.append(node('p','Additional source health'));const list=node('ul');for(const [name,value] of rows){const li=node('li',`${name}: ${String(value?.status||'unknown').toUpperCase()}${value?.error?` · ${value.error}`:''}`);list.append(li);}sourceBox.append(list);}
 const gaps=data.coverage_gaps||[];if(gaps.length){sourceBox.append(node('p','Critical validation gaps'));const list=node('ul');for(const gap of gaps)list.append(node('li',gap));sourceBox.append(list);}
 if(Array.isArray(sol?.reasons)&&sol.reasons.length){sourceBox.append(node('p','Saved validation reasons'));const list=node('ul');for(const reason of sol.reasons)list.append(node('li',reason));sourceBox.append(list);}
 const globalGaps=data.global_coverage_gaps||snapshot?.coverage_gaps||riskSnapshot?.coverage_gaps||healthSnapshot?.coverage_gaps||[];if(globalGaps.length){sourceBox.append(node('p','Global / optional coverage caveats'));const list=node('ul');for(const gap of globalGaps)list.append(node('li',gap));sourceBox.append(list);}
 if(!coverage&&!rows.length&&!gaps.length&&!globalGaps.length)sourceBox.append(node('p','Detailed source-health information unavailable.'));
 $('calendar-sol-meta').textContent=`Assessment ${stateLabel} · generated ${format(solTimes.timestamp)} · observed ${format(solTimes.observed_at)} · expires ${format(solTimes.expires_at)} · per-request SOL consumption not exposed.`;
 $('calendar-sol-record').textContent=sol?JSON.stringify(sol,null,2):'UNAVAILABLE · No saved calendar assessment is exposed.';
}
// HIGH is a reviewed RRR.Trading judgement; the official URL supports announcement identity.
const impactRules=new Set(['us-cpi','us-employment','us-gdp','us-pce','au-policy','us-policy','eu-policy','jp-policy','uk-policy','uk-cpi','uk-employment','uk-gdp','au-cpi','au-employment','au-gdp','us-ppi','us-retail','uk-monthly-gdp','eu-inflation','eu-flash-inflation','eu-gdp','eu-gdp-employment','jp-cpi','jp-gdp']);
const validSolCalendarEvent=e=>{const p=e?.provenance||{},riskStates=['SCHEDULED','APPROACHING','HIGH_ALERT','RELEASE_WINDOW','POST_RELEASE_WINDOW','TIME_UNVERIFIED','DATA_STALE','UNKNOWN','CANCELLED','COMPLETED'];try{return e.importance==='HIGH'&&e.impact==='HIGH'&&e.time_status==='VERIFIED'&&M.validDate(e.release_date)&&time(e.scheduled_at)!==null&&M.date(time(e.scheduled_at),e.release_timezone)===e.release_date&&safeUrl(p.time_source)&&safeUrl(p.impact_source)&&p.classification_owner==='RRR.Trading'&&p.classification_version==='rrr-economic-impact-v1'&&impactRules.has(p.classification_rule)&&riskStates.includes(e.risk?.state)&&['UPCOMING','RELEASE_UNCONFIRMED','COMPLETED'].includes(e.event_phase);}catch{return false;}};
const high=e=>e.impact==='HIGH'&&e.impact_verified===true&&safeUrl(e.impact_source)&&e.impact_classification_owner==='RRR.Trading'&&e.impact_classification_version==='rrr-economic-impact-v1'&&impactRules.has(e.impact_classification_rule)&&typeof e.impact_classification_basis==='string'&&!!e.impact_classification_basis.trim();
const verified=e=>{if(e.stale===true||e.time_status!=='VERIFIED'||time(e.scheduled_at)===null||!safeUrl(e.time_source))return false;try{return M.date(time(e.scheduled_at),e.release_timezone)===e.release_date;}catch{return false;}};
const eventRisk=e=>fresh()&&e.event_risk?.version==='economic-event-risk-v1'&&time(snapshot?.risk_assessed_at)!==null&&Date.now()-time(snapshot.risk_assessed_at)>=-30000&&Date.now()-time(snapshot.risk_assessed_at)<120000&&(verified(e)||e.event_risk.state==='TIME_UNVERIFIED')&&['SCHEDULED','APPROACHING','HIGH_ALERT','RELEASE_WINDOW','POST_RELEASE_WINDOW','TIME_UNVERIFIED','DATA_STALE','UNKNOWN','CANCELLED','COMPLETED'].includes(e.event_risk.state)?e.event_risk.state:'UNASSESSED';
const lacksClassification=()=>snapshot?.events?.some(e=>e&&typeof e==='object'&&(!Object.hasOwn(e,'impact')||(e.impact==='HIGH'&&!high(e))));
// Reassuring copy requires complete saved evidence; this is presentation only.
const coverageUncertain=()=>snapshot?.status!=='ok'||!Array.isArray(snapshot?.coverage_gaps)||snapshot.coverage_gaps.length>0||!snapshot?.health||Object.values(snapshot.health.official_sources||{}).some(s=>s?.status!=='ok')||snapshot.health.fred_status&&snapshot.health.fred_status!=='ok'||snapshot.events.some(e=>!e||typeof e!=='object'||e.stale===true||e.event_status==='MISSING_FROM_SOURCE'||high(e)&&!verified(e));
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
function announcement(e,key,s){
 const d=node('details',undefined,'announcement');d.dataset.eventKey=key;d.open=openEvents.has(key);if(verified(e))d.dataset.at=String(time(e.scheduled_at));
 d.addEventListener('toggle',()=>{if(!d.isConnected)return;if(d.open)openEvents.add(key);else openEvents.delete(key);});
 const summary=node('summary');summary.dataset.focusKey='event-'+key;
 summary.append(node('span',`${text(e.country)} · HIGH`,'impact-label'),node('span',text(e.title),'announcement-title'),node('small',verified(e)?format(e.scheduled_at):`TIME NOT VERIFIED · ${e.release_date} (${text(e.release_timezone)})`));d.append(summary);
 if(!verified(e))summary.append(node('small',`Source-local date only · release time and Brisbane release day unverified`));
 else if(s?.unassigned)summary.append(node('small','Outside regional session hours'));
 const body=node('div',undefined,'event-details');
 body.append(node('p',`Country / region: ${text(e.country)} · ${text(e.source)}`));
 body.append(node('p',verified(e)?countdown(time(e.scheduled_at)):'TIME NOT VERIFIED · source-local date; publication status unknown',verified(e)?'event-countdown':undefined));
 const risk=eventRisk(e);if(risk!=='UNASSESSED')body.append(node('p',`Event risk: ${risk.replaceAll('_',' ')} · informational`));
 source(body,'Official announcement source',e.source_url);source(body,'Official time source',e.time_source);
 d.append(body);return d;
}
function updateNow(){
 const now=Date.now();
 for(const row of document.querySelectorAll('.session-row[data-sessions]')){let sessions=[];try{sessions=JSON.parse(row.dataset.sessions);}catch{}const active=sessions.filter(x=>now>=x.from&&now<x.to);row.dataset.active=String(active.length>0);const old=row.querySelector('.session-state');if(old)old.textContent=active.length?'ACTIVE · '+active.map(x=>x.name).join(', '):'INDICATIVE WINDOWS';}
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
 lastMinute=String(Math.floor(Date.now()/60000))+':'+fresh();days=M.week(selected);renderOverview();
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
 const list=$('schedule-events');list.replaceChildren();const assignedDateOnly=new Set();
 for(const day of days){
  const today=day.date===M.date(Date.now()),groupId='rows-'+day.date;
  const head=node('tr',undefined,'day-disclosure'),th=node('th');th.colSpan=4;th.scope='rowgroup';const toggle=node('button',undefined,'day-toggle');toggle.type='button';toggle.dataset.focusKey='day-'+day.date;toggle.setAttribute('aria-expanded',String(expandedDays.has(day.date)));toggle.setAttribute('aria-controls',groupId);
  toggle.append(node('span',`${dayLabel(day.date)}${today?' · TODAY':''}`),node('span',expandedDays.has(day.date)?'−':'+'));th.append(toggle);head.append(th);list.append(head);
  const sessions=day.sessions.filter(x=>x.to>Date.now()),sessionGroups=[...sessions.reduce((map,x)=>map.set(x.name,[...(map.get(x.name)||[]),x]),new Map())];
  const timedToday=timed.filter(e=>{const at=time(e.scheduled_at);return at>=day.from&&at<day.to;});
  const dateOnlyToday=regional.filter(e=>{if(assignedDateOnly.has(e.id))return false;try{return M.instant(e.release_date,0,e.release_timezone)<day.to&&M.instant(M.shift(e.release_date,1),0,e.release_timezone)>day.from;}catch{return false;}});for(const e of dateOnlyToday)assignedDateOnly.add(e.id);
  const dayEvents=[...new Map([...timedToday,...dateOnlyToday].map(e=>[e.id,e])).values()];
  const row=node('tr',undefined,'session-row day-start');row.dataset.day=day.date;row.dataset.collapsed=String(!expandedDays.has(day.date));row.id=groupId;
  row.dataset.sessions=JSON.stringify(sessions.map(x=>({from:x.clipFrom,to:x.clipTo,name:x.name})));
  const dc=node('td',undefined,'day-cell');dc.append(node('strong',dayLabel(day.date).split(' ')[0].toUpperCase()),node('small',day.date));if(today)dc.append(node('span','TODAY','today-label'));
  const name=node('td',undefined,'session-name');name.append(node('strong',sessions.length?'MARKET SESSIONS':'TRADITIONAL MARKETS CLOSED'),node('small',sessions.length?sessionGroups.map(([name])=>name).join(' · '):'Crypto derivatives trade 24/7'),node('small','INDICATIVE WINDOWS','session-state'));
  const tm=node('td',undefined,'session-time');if(sessions.length){for(const [name,items] of sessionGroups){const times=items.map(x=>`${x.clipFrom===day.from?'00:00':clock(x.clipFrom)}–${x.clipTo===day.to?'24:00':clock(x.clipTo)}`).join(' · ');tm.append(node('span',`${name}: ${times}`,'daily-session-time'));}}else tm.append(node('span','24/7 crypto derivatives'));
  const outsideCoverage=h&&(day.date<h.start||day.date>h.end);
  const emptyText=outsideCoverage?'Outside calendar coverage':!fresh()||!h?'Calendar evidence unavailable or stale':lacksClassification()?'HIGH-impact classification unavailable':coverageUncertain()?'Announcement coverage incomplete or uncertain':'No verified high-impact announcements';
  const ev=node('td',undefined,'announcement-cell');if(dayEvents.length){ev.append(node('span',`${dayEvents.length} announcement${dayEvents.length===1?'':'s'}`,'event-count'));for(const e of dayEvents){const at=verified(e)?time(e.scheduled_at):null,match=sessions.find(x=>at!==null&&x.countries.includes(e.country)&&at>=x.clipFrom&&at<x.clipTo);ev.append(announcement(e,String(snapshot.events.indexOf(e)),match|| (at!==null?{unassigned:true}:null)));}}else ev.append(node('span',emptyText,'row-empty'));
  row.append(dc,name,tm,ev);list.append(row);
  toggle.addEventListener('click',()=>{const open=!expandedDays.has(day.date);if(open)expandedDays.add(day.date);else expandedDays.delete(day.date);toggle.setAttribute('aria-expanded',String(open));toggle.lastChild.textContent=open?'−':'+';row.dataset.collapsed=String(!open);});
 }
 updateNow();
 if(activeKey)Array.from(document.querySelectorAll('[data-focus-key]')).find(e=>e.dataset.focusKey===activeKey)?.focus({preventScroll:true});
}
async function refresh(){if(busy)return;busy=true;const b=$('schedule-refresh');b.disabled=true;b.textContent='Checking…';controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);const get=async path=>{const r=await fetch(api+path,{method:'GET',cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();return r.json();};const getSol=async()=>{const r=await fetch('https://v4.rrr.trading/v4/paper',{method:'GET',credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();return r.json();};try{const [economic,risk,health,sol]=await Promise.allSettled([get('economic'),get('event-risk'),get('health'),getSol()]);if(economic.status==='fulfilled'&&economic.value?.schema_version===1&&Array.isArray(economic.value.events)&&validStatus(economic.value.status)){snapshot=economic.value;failed=false;}else failed=true;if(risk.status==='fulfilled'&&risk.value?.schema_version===1&&Array.isArray(risk.value.events)&&validStatus(risk.value.status)){riskSnapshot=risk.value;riskFailed=false;}else riskFailed=true;if(health.status==='fulfilled'&&health.value?.schema_version===1&&validStatus(health.value.status)){healthSnapshot=health.value;healthFailed=false;}else healthFailed=true;if(sol.status==='fulfilled'&&sol.value?.version==='paper-read-api-v1'&&sol.value.mode==='paper'&&sol.value.overview?.version==='paper-overview-v1'&&sol.value.overview.purpose==='PUBLIC_SAVED_OBSERVATIONS_ONLY'&&sol.value.overview.calendar){solCalendar=sol.value.overview.calendar;solCalendarFailed=false;}else solCalendarFailed=true;}catch{failed=true;riskFailed=true;healthFailed=true;solCalendarFailed=true;}finally{clearTimeout(timeout);ready=true;busy=false;b.disabled=false;b.textContent='↻ Refresh';render();}}
function move(d){if(!M.validDate(d))return;selected=d<M.date(Date.now())?M.date(Date.now()):d;followToday=selected===M.date(Date.now());expandedDays.clear();expandedDays.add(selected);render();}
$('previous-week').addEventListener('click',()=>move(M.shift(selected,-7)));$('next-week').addEventListener('click',()=>move(M.shift(selected,7)));$('current-week').addEventListener('click',()=>move(M.date(Date.now())));$('today').addEventListener('click',()=>{move(M.date(Date.now()));const target=Array.from(document.querySelectorAll('.day-toggle')).find(e=>e.dataset.focusKey==='day-'+M.date(Date.now()));if(matchMedia('(max-width:700px)').matches)target?.focus();else document.querySelector('.today-label')?.scrollIntoView({block:'center'});});
$('schedule-refresh').addEventListener('click',refresh);render();scrollCurrent();refresh();
const poll=setInterval(()=>{if(!document.hidden)refresh();},60000),tick=setInterval(()=>{if(document.hidden)return;const key=String(Math.floor(Date.now()/60000))+':'+fresh();if(key!==lastMinute||lastDate!==M.date(Date.now())||Array.from(document.querySelectorAll('.session-row[data-to],.announcement[data-at]')).some(r=>+(r.dataset.to||r.dataset.at)<=Date.now()))render();else updateNow();},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();refresh();}});window.addEventListener('pagehide',()=>{clearInterval(poll);clearInterval(tick);controller?.abort();});
})();

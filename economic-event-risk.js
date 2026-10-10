(() => {
 'use strict';
 // One shared read-only request loop per document; no trading feed ownership.
 const host=document.getElementById('economic-event-risk') || (document.getElementById('bot-summary')?.appendChild(document.createElement('section')));
 if(!host)return;
 host.id='economic-event-risk';host.className='economic-event-risk';host.setAttribute('aria-labelledby','economic-risk-title');
 const node=(tag,value,cls)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=String(value);if(cls)el.className=cls;return el;};
 const text=v=>typeof v==='string'&&v.trim()?v:'Unavailable';
 const instant=v=>typeof v==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
 const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 const format=v=>instant(v)===null?'Unavailable':new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'}).format(instant(v))+' AEST · Brisbane';
 const hosts=new Set(['fred.stlouisfed.org','www.bls.gov','www.bea.gov','www.rba.gov.au','www.federalreserve.gov','www.ecb.europa.eu','www.bankofengland.co.uk','www.boj.or.jp','www.ons.gov.uk','www.abs.gov.au','www.census.gov','ec.europa.eu','www.stat.go.jp','www.esri.cao.go.jp']);
 const safe=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&hosts.has(u.hostname);}catch{return false;}};
 const explanations={SCHEDULED:'Reviewed HIGH announcements are scheduled; this is not an all-clear statement.',APPROACHING:'A verified HIGH announcement is approaching. Timing awareness only.',HIGH_ALERT:'A verified HIGH announcement is near its scheduled release.',RELEASE_WINDOW:'The scheduled release window is active; publication is not confirmed by clock passage.',POST_RELEASE_WINDOW:'The scheduled time has passed; actual publication still requires confirmation.',TIME_UNVERIFIED:'HIGH announcements have unverified release times. Precise timing risk cannot be assessed.',DATA_STALE:'Risk unassessed — calendar evidence is stale.',UNKNOWN:'Risk unassessed — available calendar evidence is incomplete.',CANCELLED:'Returned announcement cancellation evidence does not establish no other risk.',COMPLETED:'The API confirms publication of returned evidence; global coverage remains limited.'};
 const rules=new Set(['us-cpi','us-employment','us-gdp','us-pce','au-policy','us-policy','eu-policy','jp-policy','uk-policy','uk-cpi','uk-employment','uk-gdp','au-cpi','au-employment','au-gdp','us-ppi','us-retail','uk-monthly-gdp','eu-inflation','eu-flash-inflation','eu-gdp','eu-gdp-employment','jp-cpi','jp-gdp']);
 const high=e=>e&&e.impact==='HIGH'&&e.impact_verified===true&&e.impact_classification_owner==='RRR.Trading'&&e.impact_classification_version==='rrr-economic-impact-v1'&&rules.has(e.impact_classification_rule)&&safe(e.impact_source)&&typeof e.impact_classification_basis==='string'&&!!e.impact_classification_basis.trim();
 const usable=e=>high(e)&&e.stale!==true&&e.source_status==='ok'&&!['CANCELLED','POSTPONED','MISSING_FROM_SOURCE','CONFIRMED_RELEASED'].includes(e.event_status)&&date(e.release_date);
 const verified=e=>{if(e.time_verified!==true||e.time_status!=='VERIFIED'||instant(e.scheduled_at)===null||!safe(e.time_source))return false;try{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:e.release_timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant(e.scheduled_at));const part=k=>parts.find(p=>p.type===k)?.value;return `${part('year')}-${part('month')}-${part('day')}`===e.release_date;}catch{return false;}};
 const header=node('div',undefined,'economic-risk-header'),title=node('h2','ECONOMIC EVENT RISK');title.id='economic-risk-title';
 const refreshButton=node('button','↻ Refresh');refreshButton.type='button';header.append(title,refreshButton);
 const status=node('p','Loading economic risk…','economic-risk-state');status.setAttribute('role','status');
 const explanation=node('p',undefined,'economic-risk-note'),grid=node('div',undefined,'economic-risk-grid'),next=node('div'),coverage=node('div');grid.append(next,coverage);
 const dateOnly=node('details'),dateSummary=node('summary','Date-only HIGH announcements · TIME NOT VERIFIED'),dateList=node('div');dateOnly.append(dateSummary,dateList);
 const link=node('a','VIEW GLOBAL MARKET SCHEDULE');link.href='/schedule/';
 host.append(header,status,explanation,grid,dateOnly,node('p','Informational only · execution disconnected. HIGH impact does not establish asset direction or trading readiness.','economic-risk-note'),link);
 let snapshot=null,failed=false,ready=false,busy=false,controller=null,generation=0,stopped=false;
 const fresh=()=>{const now=Date.now(),assessed=instant(snapshot?.assessed_at),generated=instant(snapshot?.generated_at),expires=instant(snapshot?.expires_at);return !failed&&assessed!==null&&generated!==null&&expires!==null&&assessed<=now+30000&&now-assessed<120000&&generated<=now+30000&&now-generated<=86400000&&expires>now&&snapshot?.calendar_health?.stale!==true&&snapshot?.stale!==true&&['ok','partial'].includes(snapshot?.status)&&!['STALE','UNAVAILABLE'].includes(snapshot?.calendar_health?.calendar_status);};
 function event(parent,e){
  parent.append(node('p',text(e.title),'economic-event-name'),node('p',`${text(e.country)} · HIGH impact · Source: ${text(e.source)}`));
  if(verified(e)){
   parent.append(node('p',format(e.scheduled_at)));
   const delta=instant(e.scheduled_at)-Date.now();
   parent.append(node('p',delta>0?`Countdown: ${Math.floor(delta/86400000)}d ${Math.floor(delta%86400000/3600000)}h ${Math.floor(delta%3600000/60000)}m`:'Scheduled time passed · publication not confirmed','economic-countdown'));
  }else parent.append(node('p',`${e.release_date} · ${text(e.release_timezone)} (source date) · TIME NOT VERIFIED`));
  if(safe(e.source_url)){const source=node('a','Official source');source.href=e.source_url;source.target='_blank';source.rel='noopener noreferrer';parent.append(source);}
 }
 function render(){
  const current=fresh();host.dataset.state=current?snapshot.risk_state:'unavailable';
  status.textContent=!ready?'Loading economic risk…':current?`CURRENT ECONOMIC RISK: ${snapshot.risk_state}`:'ECONOMIC RISK UNAVAILABLE';
  explanation.textContent=!ready?'Checking saved shared evidence…':current?explanations[snapshot.risk_state]:'Unable to verify upcoming economic events. Risk unassessed — '+(failed?'shared endpoint unavailable or malformed.':'calendar or risk evidence stale / incomplete.');
  const coverageOpen=coverage.querySelector('details')?.open===true;
  next.replaceChildren(node('h3','NEXT HIGH-IMPACT ANNOUNCEMENT · VERIFIED TIME'));coverage.replaceChildren(node('h3','CALENDAR COVERAGE'));dateList.replaceChildren();
  const evidence=current?snapshot.events.filter(usable):[];
  const timed=evidence.filter(verified).filter(e=>instant(e.scheduled_at)>Date.now()).sort((a,b)=>instant(a.scheduled_at)-instant(b.scheduled_at));
  const dates=evidence.filter(e=>!verified(e)&&e.scheduled_at==null&&String(e.time_status).startsWith('DATE CONFIRMED')).sort((a,b)=>a.release_date.localeCompare(b.release_date));
  // Keep uncertainty visible ahead of the next verified instant; never manufacture
  // a cross-timezone chronological ordering for date-only announcements.
  next.dataset.at=timed[0]?.scheduled_at||'';
  if(timed[0])event(next,timed[0]);else next.append(node('p',current?'No upcoming verified-time HIGH announcement in available evidence.':'Upcoming announcement unavailable.'));
  for(const e of evidence.filter(e=>['RELEASE_WINDOW','POST_RELEASE_WINDOW','HIGH_ALERT','APPROACHING'].includes(e.risk?.state)).slice(0,5))next.append(node('p',`Supporting evidence: ${text(e.title)} · ${e.risk.state}${e.risk.awareness?' · '+text(e.risk.awareness):''}`));
  if(dates.length)next.append(node('p',`${dates.length} date-only HIGH announcement(s) below may precede this release; release order cannot be verified.`));
  dateOnly.hidden=!dates.length;for(const e of dates.slice(0,100)){const item=node('div',undefined,'economic-date-event');event(item,e);dateList.append(item);}
  const h=snapshot?.calendar_health;
  coverage.append(node('p',current?text(h?.calendar_status):'Coverage unavailable as current evidence'),node('p',`Evidence freshness: ${current?'Fresh saved calendar; risk assessed '+format(snapshot.assessed_at):!ready?'Loading':snapshot?'Stale / unverified saved evidence':'Unavailable'}`),node('p',`Saved refresh: ${format(snapshot?.generated_at)}`),node('p',`Assessment sufficiency: ${!current||['UNKNOWN','DATA_STALE','TIME_UNVERIFIED'].includes(snapshot?.risk_state)?'Incomplete — precise current risk not fully assessed.':'Supports the returned informational state only; global coverage remains incomplete.'}`));
  if(!current&&snapshot)coverage.append(node('p',`Last returned risk: ${snapshot.risk_state} · not current.`));
  const gaps=node('details'),summary=node('summary','Source coverage gaps'),list=node('ul');gaps.open=coverageOpen;gaps.append(summary,list);
  for(const [name,v] of Object.entries(h?.official_sources||{}).slice(0,20))if(v?.status!=='ok')list.append(node('li',`${name}: ${text(v?.status)} · ${text(v?.error)}`));
  for(const gap of (Array.isArray(snapshot?.coverage_gaps)?snapshot.coverage_gaps:[]).slice(0,50))list.append(node('li',text(gap)));
  if(!list.children.length)list.append(node('li','Comprehensive global coverage is not established.'));
  coverage.append(gaps);
 }
 async function refresh(){
  if(busy||stopped)return;busy=true;refreshButton.disabled=true;const seq=++generation;controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch('https://api.rrr.trading/api/schedule/event-risk',{method:'GET',cache:'no-store',signal:controller.signal});if(!response.ok)throw Error();const value=await response.json();
   if(value?.schema_version!==1||value.version!=='economic-event-risk-v1'||value.informational_only!==true||value.execution_connected!==false||!Object.hasOwn(explanations,value.risk_state)||!Array.isArray(value.events)||value.events.some(e=>!e||typeof e!=='object'||Array.isArray(e))||!['ok','partial','stale','unavailable'].includes(value.status)||!value.calendar_health||!['OPERATIONAL','PARTIAL COVERAGE','STALE','UNAVAILABLE'].includes(value.calendar_health.calendar_status))throw Error();
   if(seq!==generation||stopped)return;snapshot=value;failed=false;
  }catch{if(seq===generation&&!stopped)failed=true;}finally{clearTimeout(timer);if(seq===generation&&!stopped){ready=true;busy=false;refreshButton.disabled=false;render();}}
 }
 // Update text only on clock ticks, preserving disclosure and keyboard focus.
 let lastFresh=null;
 function tick(){const current=fresh();if(current!==lastFresh){lastFresh=current;render();}else if(current){const shown=next.querySelector('.economic-countdown'),delta=instant(next.dataset.at)-Date.now();if(shown&&delta>0)shown.textContent=`Countdown: ${Math.floor(delta/86400000)}d ${Math.floor(delta%86400000/3600000)}h ${Math.floor(delta%3600000/60000)}m`;else if(shown)render();}}
 refreshButton.addEventListener('click',refresh);render();refresh();
 const poll=setInterval(()=>{if(!document.hidden)refresh();},60000),clock=setInterval(()=>{if(!document.hidden)tick();},1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();refresh();}});
 window.addEventListener('pagehide',()=>{stopped=true;generation++;controller?.abort();clearInterval(poll);clearInterval(clock);});
})();

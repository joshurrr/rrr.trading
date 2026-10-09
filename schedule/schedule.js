(() => {
'use strict';
const endpoint='https://api.rrr.trading/api/schedule/economic';
const list=document.getElementById('schedule-events'),status=document.getElementById('schedule-status'),button=document.getElementById('schedule-refresh'),region=document.getElementById('schedule-region');
let snapshot=null,failed=false,busy=false,controller=null,lastRenderKey='';
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;};
const time=value=>{if(typeof value!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(value))return null;const t=Date.parse(value);return Number.isFinite(t)?t:null;};
const format=value=>{const t=time(value);return t===null?'Unavailable':new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'}).format(t)+' AEST';};
const text=v=>typeof v==='string'?v:'Unavailable';
const safeUrl=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&['fred.stlouisfed.org','www.bls.gov','www.bea.gov','www.rba.gov.au'].includes(u.hostname);}catch{return false;}};
const fresh=()=>{const t=time(snapshot?.generated_at),expires=time(snapshot?.expires_at);return t!==null&&expires!==null&&t<=Date.now()+30000&&Date.now()-t<=86400000&&expires>Date.now()&&snapshot?.stale!==true;};
function source(parent,label,url){if(!safeUrl(url))return;const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);}
function render(){
 lastRenderKey=String(Math.floor(Date.now()/60000))+':'+fresh();
 const current=fresh()&&!failed,state=failed?'unavailable':!snapshot?'unavailable':!fresh()?'stale':snapshot.status;
 status.dataset.state=state;
 status.textContent=failed&&snapshot?'Economic calendar unavailable. Retained dates are saved evidence; verified times and countdowns are suspended.':!snapshot?'Economic calendar unavailable. The saved calendar endpoint may not be deployed or reachable.':!fresh()?'STALE calendar evidence. Refresh required before using release dates or times.':snapshot.status==='unavailable'?'FRED schedule unavailable. See source health and coverage gaps.':snapshot.status==='partial'?'Partial calendar coverage. Failed release sources are identified below.':'Upcoming covered announcements · Australia/Brisbane';
 document.getElementById('schedule-updated').textContent=`Saved calendar refreshed: ${format(snapshot?.generated_at)} · Verified times: Australia/Brisbane (AEST, UTC+10). Date-only releases retain the source date and timezone.`;
 list.replaceChildren();
 const events=(snapshot?.events||[]).slice(0,500).filter(e=>e&&typeof e==='object'&&(region.value==='all'||e.country===region.value)&&/^\d{4}-\d{2}-\d{2}$/.test(e.release_date||'')&&Number.isFinite(Date.parse(e.release_date+'T00:00:00Z'))&&new Date(e.release_date+'T00:00:00Z').toISOString().slice(0,10)===e.release_date&&(!current||!e.scheduled_at||time(e.scheduled_at)===null||time(e.scheduled_at)>Date.now()));
 if(!events.length)list.append(node('p',current&&snapshot?.status!=='unavailable'?'No upcoming announcements returned for this region within the covered window. This does not establish a complete global calendar.':'No current release schedule can be verified.'));
 for(const e of events){
  const card=node('article',undefined,'schedule-event');card.append(node('p',`${text(e.country)} · ${text(e.source)}`,'event-meta'),node('h2',text(e.title)));
  const at=time(e.scheduled_at),verified=current&&!e.stale&&e.time_status==='VERIFIED'&&at!==null&&at>Date.now()&&safeUrl(e.time_source);
  card.append(node('p',verified?format(e.scheduled_at):`${e.release_date} · ${text(e.release_timezone)}`,'event-time'));
  card.append(node('p',verified?'Verified announcement time':!current||e.stale?'STALE SAVED DATE · TIME UNAVAILABLE':'DATE CONFIRMED, TIME UNAVAILABLE',verified?'event-meta':'event-warning'));
  if(verified){const remaining=Math.max(0,Math.floor((at-Date.now())/60000));card.append(node('p',`In ${Math.floor(remaining/1440)}d ${Math.floor(remaining%1440/60)}h ${remaining%60}m`,'event-countdown'));}
  if(e.reporting_period)card.append(node('p',`Official release description: ${text(e.reporting_period)}`,'event-context'));
  card.append(node('p','Forecast unavailable','event-context'));
  const dl=node('dl');
  for(const p of Array.isArray(e.previous)?e.previous:[]){
   if(!p||typeof p!=='object')continue;
   dl.append(node('dt',`Historical context · ${text(p.label)}`));
   const available=typeof p.value==='number'&&Number.isFinite(p.value)&&p.status==='available'&&current&&!e.stale;
   dl.append(node('dd',available?`${p.value.toLocaleString('en-AU',{maximumFractionDigits:3})} · ${text(p.units)}`:p.status==='stale'||!current||e.stale?'Stale historical observation · unavailable as current context':'Previous value unavailable'));
   if(p.observation_period)dl.append(node('dd',`Reporting period: ${text(p.observation_period)} · ${text(p.frequency)}`,'event-context'));
   if(p.vintage)dl.append(node('dd',text(p.vintage),'event-context'));
   if(p.retrieved_at)dl.append(node('dd',`Retrieved: ${format(p.retrieved_at)}`,'event-context'));
   const link=node('dd');source(link,'FRED series',p.source_url);if(link.childNodes.length)dl.append(link);
  }
  card.append(dl);const links=node('p',undefined,'event-context');source(links,'Release source',e.source_url);if(verified){links.append(document.createTextNode(' · '));source(links,'Official time source',e.time_source);}card.append(links);list.append(card);
 }
 const h=snapshot?.health||{};document.getElementById('schedule-health').textContent=`FRED: ${current?text(h.fred_status):'unavailable / stale'} · Last fully successful FRED refresh: ${format(h.last_successful_fred_refresh)} · Upcoming releases: ${current&&Number.isInteger(h.upcoming_releases)?h.upcoming_releases:'Unavailable'} · Verified timestamps: ${current&&Number.isInteger(h.verified_timestamps)?h.verified_timestamps:'Unavailable'} · International refresh: ${format(h.last_successful_international_refresh)}`;
 const gaps=document.getElementById('schedule-gaps');gaps.replaceChildren();
 for(const gap of Array.isArray(snapshot?.coverage_gaps)?snapshot.coverage_gaps:['Saved economic calendar connection unavailable.','Consensus forecasts unavailable.','International calendar coverage unverified.'])gaps.append(node('li',text(gap)));
 for(const error of Array.isArray(h.errors)?h.errors:[])gaps.append(node('li',`Release ${Number.isInteger(error.release_id)?error.release_id:'unknown'}: ${text(error.error)}`));
 for(const error of Array.isArray(h.observation_errors)?h.observation_errors:[])gaps.append(node('li',`Historical series ${text(error.series_id)}: ${text(error.error)}`));
 for(const [name,v] of Object.entries(h.official_sources||{}))gaps.append(node('li',`${name} calendar: ${text(v?.status)} · Last successful refresh: ${format(v?.last_success)}${v?.error?' · '+text(v.error):''}`));
}
async function refresh(){if(busy)return;busy=true;button.disabled=true;button.textContent='Checking…';controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(endpoint,{method:'GET',cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const value=await r.json();if(value?.schema_version!==1||!Array.isArray(value.events)||!['ok','partial','unavailable','stale'].includes(value.status))throw Error();snapshot=value;failed=false;}catch{failed=true;}finally{clearTimeout(timeout);busy=false;button.disabled=false;button.textContent='↻ Refresh';render();}}
button.addEventListener('click',refresh);region.addEventListener('change',render);refresh();
const poll=setInterval(()=>{if(!document.hidden)refresh();},60000),expiry=setInterval(()=>{const key=String(Math.floor(Date.now()/60000))+':'+fresh();if(key!==lastRenderKey)render();},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
window.addEventListener('pagehide',()=>{clearInterval(poll);clearInterval(expiry);controller?.abort();});
})();

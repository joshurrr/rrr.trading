'use strict';
(() => {
const endpoint='https://api.rrr.trading/api/v2/system/health';
const groups=['services','intelligence','bots','execution','api_health'];
const statuses=new Set(['healthy','operational','ready','waiting','blocked','execution_blocked','degraded','offline','failed','unknown','unavailable','stale','timeout']);
const inventory={services:['Public Trading API','Cloudflare Tunnel','15 MIN BOT','1 HR BOT','4 HR BOT','Legacy gate service','Administration service'],intelligence:['Market scanner','Trading universe','Market data','Technical analysis','Asset news','Macro intelligence','Event intelligence','Candidate scoring','Universe synchronisation'],bots:['15 MIN BOT','1 HR BOT','4 HR BOT'],execution:['Candidate discovery','Technical signal evaluation','Intelligence validation','Risk assessment','Execution admission','Order submission connectivity','Open position monitoring','15 MIN BOT exits','1 HR BOT exits','4 HR BOT exits'],api_health:['Consolidated monitoring API']};
const clock=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
let snapshot=null,received=0,failed=false,busy=false,filter='all',timer;
const text=v=>v===null||v===undefined||v===''?'Unavailable':typeof v==='boolean'?v?'Yes':'No':String(v);
const at=v=>Number.isFinite(Date.parse(v))?clock.format(new Date(v))+' Brisbane':'Unavailable';
const node=(tag,content,cls)=>{const n=document.createElement(tag);if(content!==undefined)n.textContent=text(content);if(cls)n.className=cls;return n;};
const stale=()=>failed||!snapshot||!Number.isFinite(Date.parse(snapshot.valid_until))||Date.now()>Date.parse(snapshot.valid_until)||Date.parse(snapshot.timestamp)>Date.now()+30000;
function state(value){return statuses.has(value)?value:'unknown';}
function paintStatus(n,status,label){status=state(status);n.className='health-status '+status;n.textContent=label||status.replaceAll('_',' ').toUpperCase();}
function renderGroup(key){
 const host=document.getElementById(key),items=Array.isArray(snapshot?.[key])?snapshot[key].slice(0,30):inventory[key].map((name,i)=>({id:key+i,name,status:'unknown',reason:failed?'Monitoring evidence unavailable.':'Awaiting consolidated backend evidence.',rows:[]}));
 if(!items.length){host.replaceChildren(node('p','Monitoring evidence unavailable.','data-note'));return;}
 const present=new Set();
 for(const item of items){if(!item||typeof item.id!=='string')continue;present.add(item.id);
  let card=[...host.children].find(c=>c.dataset.key===item.id);
  if(!card){card=node('article',undefined,'health-card');card.dataset.key=item.id;card.append(node('h3'),node('div',undefined,'health-status'),node('p'),node('dl'),node('details'));card.lastChild.append(node('summary','View observation details'),node('dl'));host.append(card);}
  card.children[0].textContent=text(item.name);
  const status=snapshot&&stale()?'stale':state(item.status);paintStatus(card.children[1],status);
  card.children[2].textContent=text(item.reason||item.basis);
  const rows=key==='api_health'?[{label:'GET endpoint',value:item.endpoint},{label:'Handler response code',value:item.http_code},{label:'Probe duration (ms)',value:item.response_ms},{label:'Last successful response',value:at(item.last_success_at)},{label:'Last checked',value:at(item.checked_at)}]:Array.isArray(item.rows)?item.rows.slice(0,25):[];
  const appendRows=(target,list)=>{target.replaceChildren();for(const r of list){const pair=node('div');pair.append(node('dt',r.label),node('dd',r.value));target.append(pair);}};
  appendRows(card.children[3],rows.slice(0,3));appendRows(card.lastChild.lastChild,rows.slice(3).concat([{label:'Observation',value:at(item.observed_at)}]));
 }
 for(const c of [...host.children])if(!present.has(c.dataset.key))c.remove();
}
function activity(){const list=document.getElementById('activity');list.replaceChildren();const events=(Array.isArray(snapshot?.recent_activity)?snapshot.recent_activity:[]).slice(0,40).filter(e=>filter==='all'||e.category===filter||filter==='errors'&&['failed','degraded','offline','blocked'].includes(e.status));for(const e of events){const li=node('li');li.append(node('time',at(e.at)),node('span',e.message));list.append(li);}if(!events.length)list.append(node('li',snapshot?'No saved observations for this filter.':'Activity evidence unavailable.'));}
function render(){
 const expired=stale(),n=document.getElementById('overall-title');
 paintStatus(n,expired?'unknown':snapshot.overall_status,expired?(snapshot?'UNKNOWN · STALE SNAPSHOT':'UNKNOWN') : undefined);
 document.getElementById('overall-reason').textContent=expired?(snapshot?'The last successful snapshot is retained. Current system readiness cannot be verified.':'Consolidated monitoring is unavailable. Backend deployment or connectivity must be verified; API reachability alone does not establish trading readiness.'):text(snapshot.explanation);
 const age=received?Math.max(0,Math.floor((Date.now()-received)/1000)):null;
 document.getElementById('updated').textContent=received?`Last successful response ${age}s ago · backend snapshot ${at(snapshot.timestamp)}${expired?' · STALE':''}`:'No successful monitoring update · automatic retry every 30 seconds';
 groups.forEach(renderGroup);activity();const gaps=document.getElementById('gaps');gaps.replaceChildren();for(const gap of (snapshot?.monitoring_gaps||['Consolidated endpoint not yet available','Container and trading readiness cannot be inferred from a responding API']))gaps.append(node('li',gap));
}
async function refresh(){if(busy)return;busy=true;const button=document.getElementById('refresh');button.setAttribute('aria-busy','true');button.textContent='Checking…';const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(endpoint,{method:'GET',cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Check unavailable');const value=await response.json();if(value?.schema_version!==1||!groups.every(k=>Array.isArray(value[k]))||!statuses.has(value.overall_status))throw Error('Invalid snapshot');snapshot=value;received=Date.now();failed=false;}catch{failed=true;}finally{clearTimeout(timeout);busy=false;button.removeAttribute('aria-busy');button.textContent='↻ Refresh';render();}}
for(const name of ['all','system','intelligence','bots','execution','errors']){const button=node('button',name.toUpperCase());button.type='button';button.setAttribute('aria-pressed',String(name===filter));button.addEventListener('click',()=>{filter=name;for(const b of button.parentElement.children)b.setAttribute('aria-pressed',String(b===button));activity();});document.getElementById('activity-filters').append(button);}
document.getElementById('refresh').addEventListener('click',refresh);
groups.forEach(renderGroup);refresh();timer=setInterval(refresh,30000);setInterval(()=>{if(snapshot&&stale())render();else if(received)document.getElementById('updated').textContent=`Last successful response ${Math.max(0,Math.floor((Date.now()-received)/1000))}s ago · backend snapshot ${at(snapshot.timestamp)}`;},1000);
window.SystemHealth=Object.freeze({refresh});window.addEventListener('pagehide',()=>clearInterval(timer));
})();

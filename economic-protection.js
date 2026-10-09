(() => {
 'use strict';
 const bot=({'15minbot':'short','1hrbot':'medium','4hrbot':'long'})[location.pathname.split('/')[2]];
 const tools=location.pathname.startsWith('/tools/');
 const parent=tools?document.getElementById('calendar-monitoring'):document.getElementById('economic-event-risk');
 if(!parent)return;
 const n=(tag,value,cls)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);if(cls)e.className=cls;return e;};
 const host=n('section',undefined,tools?'economic-protection':'economic-event-risk economic-protection');host.id='economic-protection';host.setAttribute('aria-labelledby','economic-protection-title');
 const title=n(tools?'h3':'h2',tools?'ECONOMIC PROTECTION HEALTH':'ECONOMIC EVENT PROTECTION STATUS');title.id='economic-protection-title';
 const header=n('div',undefined,'economic-protection-header'),refresh=n('button','↻ Refresh');refresh.type='button';header.append(title,refresh);
 const state=n('p','Loading protection evidence…','economic-protection-state');state.setAttribute('role','status');
 const content=n('div',undefined,'economic-protection-grid'),note=n('p','Shadow evaluation does not control trades. Automatic economic exits remain disabled.','economic-risk-note');
 host.append(header,state,content,note);if(tools)parent.append(host);else parent.insertAdjacentElement('afterend',host);
 const alerts=bot&&document.getElementById('exit-panel')?n('div',undefined,'economic-position-alerts'):null;
 if(alerts){alerts.id='economic-position-alerts';document.getElementById('exit-panel').append(alerts);}
 const at=v=>typeof v==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
 const format=v=>at(v)===null?'Unavailable':new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'}).format(at(v))+' AEST · Brisbane';
 const value=v=>typeof v==='string'&&v.trim()?v:'Unavailable';
 const states=new Set(['NORMAL','ADVANCE_WARNING','HIGH_ALERT','EVENT_ACTIVE','POST_EVENT_MONITORING','RECOVERY','UNASSESSED']);
 const healthStates=new Set(['DISABLED BY CONFIGURATION','SHADOW MODE ACTIVE','ENFORCEMENT ACTIVE','DEGRADED','UNAVAILABLE']);
 const count=v=>Number.isInteger(v)&&v>=0?v:'Unavailable';
 let snapshot=null,failed=false,ready=false,busy=false,controller,stopped=false;
 const fresh=()=>!failed&&snapshot?.snapshot_fresh===true&&at(snapshot?.assessed_at||snapshot?.last_successful_evaluation)!==null&&at(snapshot?.assessed_at||snapshot?.last_successful_evaluation)<=Date.now()+30000&&Date.now()-at(snapshot?.assessed_at||snapshot?.last_successful_evaluation)<90000&&at(snapshot?.valid_until)>Date.now();
 function row(target,label,text){target.append(n('p',label+': '+text));}
 function event(target,e){
  if(!e){row(target,'Next critical announcement','Unavailable in verified timing evidence');return;}
  row(target,'Next critical announcement',value(e.title));
  if(e.time_verified===true&&e.time_status==='VERIFIED'&&at(e.scheduled_at)!==null){row(target,'Scheduled release',format(e.scheduled_at));const delta=at(e.scheduled_at)-Date.now();row(target,'Time until release',delta>0?Math.ceil(delta/60000)+' minutes':'Scheduled time passed · publication not confirmed');}
  else row(target,'Source date',value(e.release_date)+' · '+value(e.release_timezone)+' · TIME NOT VERIFIED');
 }
 function positions(target,b){
  target.append(n('h3','ECONOMIC POSITION OBSERVATIONS · SHADOW'));
  if(b.position_observation_available!==true){target.append(n('p','Open position observations unavailable or stale. Missing evidence does not establish no positions.'));return;}
  const entries=b.positions.filter(p=>p.heightened===true);
  if(!entries.length){target.append(n('p','No positions currently reported under heightened economic monitoring.'));return;}
  for(const p of entries.slice(0,20)){
   const card=n('div',undefined,'economic-position-observation');card.append(n('h4',value(p.pair)+' · '+value(p.direction)),n('p','Enhanced monitoring · '+value(p.monitoring?.assessment)));
   row(card,'Event warnings',b.windows.map(w=>value(w.event?.title)).join(', '));
   row(card,'Unrealized P/L',Number.isFinite(p.monitoring?.unrealized_profit_pct)?p.monitoring.unrealized_profit_pct.toFixed(2)+'%':'Unavailable');
   row(card,'Distance to existing stop',Number.isFinite(p.monitoring?.stop_distance_pct)?p.monitoring.stop_distance_pct.toFixed(2)+'%':'Unavailable');
   row(card,'Existing strategy exit flag',p.monitoring?.strategy_exit_signal===true?'Active · execution eligibility unverified':p.monitoring?.strategy_exit_signal===false?'Inactive':'Unavailable');
   row(card,'Market volatility',Number.isFinite(p.monitoring?.volatility_pct_per_5m_bar)?p.monitoring.volatility_pct_per_5m_bar.toFixed(3)+'% per 5m bar':'Unavailable');
   row(card,'Economic surprise',value(p.monitoring?.economic_surprise?.reason));
   card.append(n('p','Actual economic action: NONE — SHADOW MODE. Price reaction does not establish announcement causation.'));target.append(card);
  }
 }
 function render(){
  const detailsOpen=content.querySelector('details')?.open===true;
  content.replaceChildren();alerts?.replaceChildren();const current=fresh();host.dataset.state=current?(tools?snapshot.status:snapshot.bot?.state||'SHADOW'):'UNAVAILABLE';
  state.textContent=!ready?'Loading protection evidence…':current?(tools?snapshot.status:'PROTECTION MODE: '+snapshot.mode+' · '+(bot?snapshot.bot.state.replaceAll('_',' '):'SHARED POLICY')):'ECONOMIC PROTECTION UNAVAILABLE';
  if(!current){content.append(n('p',!ready?'Checking saved backend policy…':'Current protection cannot be verified. The Phase 3 economic risk evidence remains separate.'));if(snapshot)row(content,'Last successful evaluation',format(snapshot.last_successful_evaluation));if(alerts)alerts.append(n('p','Economic position monitoring unavailable · existing exit monitoring remains independent.'));return;}
  if(tools){
   row(content,'Last successful policy evaluation',format(snapshot.last_successful_evaluation));row(content,'Snapshot freshness','Current until '+format(snapshot.valid_until));
   row(content,'Shadow decision logging',snapshot.logging_healthy===true?'Operational':'Degraded / unavailable');row(content,'Mode consistency',snapshot.mode_consistent===true?'Confirmed SHADOW / disabled':'Unverified');
   for(const [name,ack] of Object.entries(snapshot.bot_acknowledgements||{}))row(content,name+' admission acknowledgement',ack?.fresh===true?'Recent policy observation · no enforcement':'No recent authenticated admission observation');
   row(content,'Shadow restrictions recorded',count(snapshot.shadow_restrictions_recorded));return;
  }
  const policies=bot?[snapshot.bot]:Object.values(snapshot.bots);const b=policies[0];
  if(bot){row(content,'New entries',value(b.entry_status)+' · simulated, enforcement disabled');row(content,'Open position monitoring',b.monitoring_enabled===false?'Disabled by configuration':count(b.heightened_positions)+' under heightened monitoring');row(content,'State reason',value(b.reason));}
  else{row(content,'Bot states',policies.map(p=>p.timeframe+': '+p.state.replaceAll('_',' ')).join(' · '));row(content,'Bots under high alert',count(snapshot.bots_under_high_alert));row(content,'New entry protection','Simulated only · '+policies.filter(p=>p.would_restrict).length+' bot policy window(s) proposed');row(content,'Open positions under heightened monitoring',count(snapshot.high_alert_positions));}
  event(content,b.next_event);
  for(const w of b.windows.slice(0,5))row(content,'Active scheduled window',value(w.event?.title)+' · '+value(w.state).replaceAll('_',' ')+(w.retained?' · retained verified evidence during outage':''));
  if(b.date_only_events.length)row(content,'Date-only critical announcements',b.date_only_events.slice(0,bot?3:1).map(e=>value(e.title)+' · '+value(e.release_date)+' · '+value(e.release_timezone)+' · TIME NOT VERIFIED').join('; ')+(b.date_only_events.length>1?' · '+b.date_only_events.length+' date-only records in shared evidence':''));
  row(content,'Calendar coverage',value(snapshot.calendar_coverage));row(content,'Calendar freshness',snapshot.calendar_fresh===true?'Fresh saved evidence · '+format(snapshot.calendar_generated_at):'Unavailable / stale · bounded retained windows may apply');
  row(content,'Automatic economic exits','DISABLED · executed '+count(snapshot.automatic_economic_exits_executed));
  const diagnostics=bot?content:n('details');if(!bot){diagnostics.open=detailsOpen;diagnostics.append(n('summary','Protection evaluation details'));content.append(diagnostics);}
  row(diagnostics,'Policy evaluation',format(snapshot.last_successful_evaluation));row(diagnostics,'Shadow restrictions recorded',count(snapshot.shadow_restrictions_recorded));
  if(alerts)positions(alerts,b);
  if(!bot){const links=n('p');for(const [name,url] of [['15m bot','/demo/15minbot/'],['1h bot','/demo/1hrbot/'],['4h bot','/demo/4hrbot/']]){const a=n('a',name);a.href=url;links.append(a,document.createTextNode(' '));}content.append(links);}
 }
 function valid(v){
  if(v?.schema_version!==1||v.version!=='economic-protection-v1'||v.shadow_mode===false||v.execution_connected!==false||v.automatic_economic_exits_executed!==0||!healthStates.has(v.status))return false;
  if(v.status==='UNAVAILABLE')return true;
  if(!['SHADOW','DISABLED'].includes(v.mode))return false;
  if(tools)return true;
  const policies=bot?[v.bot]:Object.values(v.bots||{});if(policies.length!==(bot?1:3))return false;
  return policies.every(b=>b&&states.has(b.state)&&b.enforced===false&&b.automatic_exits_enabled===false&&Array.isArray(b.windows)&&Array.isArray(b.date_only_events)&&Array.isArray(b.positions)&&b.positions.every(p=>p&&typeof p==='object')&&b.windows.every(w=>w&&w.event&&states.has(w.state)));
 }
 async function update(){
  if(busy||stopped)return;busy=true;refresh.disabled=true;controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
  const endpoint=tools?'/api/schedule/protection/health':bot?'/api/demos/'+bot+'/economic-protection':'/api/schedule/protection';
  try{const r=await fetch('https://api.rrr.trading'+endpoint,{method:'GET',cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const v=await r.json();if(!valid(v))throw Error();if(!stopped){snapshot=v;failed=false;}}
  catch{if(!stopped)failed=true;}finally{clearTimeout(timeout);if(!stopped){ready=true;busy=false;refresh.disabled=false;render();}}
 }
 refresh.addEventListener('click',update);render();update();
 const poll=setInterval(()=>{if(!document.hidden)update();},30000),clock=setInterval(()=>{if(!document.hidden&&snapshot){if(!fresh())render();}},1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();update();}});
 window.addEventListener('pagehide',()=>{stopped=true;controller?.abort();clearInterval(poll);clearInterval(clock);});
})();

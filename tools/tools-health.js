(function(){
  'use strict';
  const endpoint='/api/v2/system/health';
  const components=[
    ['market','Market Data','Exchange connectivity, price feeds and freshness.'],
    ['intelligence','Market Intelligence','Macro conditions, asset news and research.'],
    ['technical','Technical Analysis','Indicators and timeframe assessments.'],
    ['decision','AI Decision Engine','LLM availability, recent decisions and errors.'],
    ['execution','Risk & Execution','Risk checks, trading activity and position management.'],
    ['storage','Database & Storage','Database connectivity and storage health.']
  ];
  const $=id=>document.getElementById(id);
  const text=value=>typeof value==='string'&&value.trim()?value.trim():null;
  const state=value=>({healthy:'healthy',ok:'healthy',operational:'healthy',degraded:'degraded',warning:'degraded',failed:'failed',failure:'failed',error:'failed',unknown:'unknown',unavailable:'unknown',not_monitored:'unknown'})[String(value||'').toLowerCase()]||'unknown';
  const label=s=>({healthy:'HEALTHY',degraded:'DEGRADED',failed:'CONFIRMED FAILURE',unknown:'UNKNOWN'})[s];
  function evidence(item){return item&&typeof item==='object'&&(text(item.status)||text(item.state)||text(item.health));}
  function componentData(snapshot,key){const aliases={market:['market','market_data','market-data'],intelligence:['intelligence','market_intelligence','market-intelligence'],technical:['technical','technical_analysis','technical-analysis'],decision:['decision','ai_decision_engine','ai-decision-engine'],execution:['execution','risk_execution','risk-execution'],storage:['storage','database_storage','database-storage']};const pools=[snapshot?.components,snapshot?.services,snapshot?.intelligence,snapshot?.pipeline,snapshot?.storage];for(const pool of pools){if(!pool||typeof pool!=='object')continue;for(const alias of aliases[key]||[key])if(pool[alias]&&evidence(pool[alias]))return pool[alias];}return null;}
  function render(snapshot){
    const grid=$('health-grid'); grid.replaceChildren(); const statuses=[];
    for(const [key,name,description] of components){const item=componentData(snapshot,key), current=state(item?.status||item?.state||item?.health); statuses.push(current); const card=document.createElement('details'); card.className='health-card'; card.dataset.state=current; const summary=document.createElement('summary'); summary.innerHTML='<span class="health-card-title"><span class="status-dot" aria-hidden="true"></span><span>'+name+'</span></span><span class="health-state">'+label(current)+'</span>'; card.append(summary); const body=document.createElement('div'); body.className='health-details'; const p=document.createElement('p'); p.textContent=description; body.append(p); const detail=text(item?.explanation)||text(item?.message)||text(item?.detail)||(!item?'No supporting evidence is available from the public health feed.':'Diagnostics are available in the private administration dashboard.'); const d=document.createElement('p'); d.className='health-diagnostic'; d.textContent=detail; body.append(d); card.append(body); grid.append(card);}
    const overall=statuses.includes('failed')?'failed':statuses.includes('degraded')?'degraded':statuses.every(s=>s==='healthy')?'healthy':'unknown'; $('health-overall').dataset.state=overall; $('health-overall-label').textContent=label(overall); $('health-observed').textContent=text(snapshot?.observed_at||snapshot?.generated_at||snapshot?.timestamp)?'Evidence observed · '+new Date(snapshot.observed_at||snapshot.generated_at||snapshot.timestamp).toLocaleString('en-AU',{dateStyle:'medium',timeStyle:'short',timeZone:'Australia/Brisbane'}):'Evidence timestamp unavailable';
    const events=$('system-events'); events.replaceChildren(); const list=(Array.isArray(snapshot?.events)?snapshot.events:Array.isArray(snapshot?.activity)?snapshot.activity:[]).filter(Boolean).slice(0,10); if(!list.length){const p=document.createElement('p');p.className='muted';p.textContent='No verified V4.1 events are available from the public feed.';events.append(p);return;} for(const event of list){const p=document.createElement('p');p.textContent=(text(event.level)||text(event.severity)||'EVENT').toUpperCase()+' · '+(text(event.message)||text(event.description)||'Event details unavailable.');events.append(p);}
  }
  function unavailable(){render(null);$('health-observed').textContent='Health and event monitoring unavailable.';$('system-events').replaceChildren(Object.assign(document.createElement('p'),{className:'muted',textContent:'Recent system events are unavailable; no health conclusion can be drawn.'}));}
  async function load(){try{const r=await fetch(endpoint,{cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok)throw Error();const data=await r.json();if(!data||typeof data!=='object')throw Error();render(data);}catch{unavailable();}}
  load();
})();

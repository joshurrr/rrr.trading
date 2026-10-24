"use strict";
// Read-only saved V4 evidence. No legacy intelligence API, indicators or AI requests.
(() => {
  const API = 'https://v4.rrr.trading/v4/';
  const $ = id => document.getElementById('asset-analysis-' + id);
  const host = $('cards'), panel = $('panel'), detail = $('detail'), tabs = $('tabs');
  const names = ['Overview','Technical Analysis','News & Intelligence','SOL Decisions','Decision History'];
  const frames = ['15m','1h','4h'];
  let data = null, selected = null, origin = null, activeTab = 0, historyCount = 10;
  const node = (tag, text, cls) => { const el=document.createElement(tag); if(text!==undefined) el.textContent=String(text); if(cls) el.className=cls; return el; };
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const array = value => Array.isArray(value) ? value : [];
  const value = v => v === null || v === undefined || v === '' ? 'NOT_RECORDED' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  const time = v => v && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'})+' Brisbane' : 'NOT_RECORDED';
  const asTime = v => Number.isFinite(Date.parse(v)) ? Date.parse(v) : -Infinity;
  const freshness = row => row?.state === 'CURRENT' && Number.isFinite(Date.parse(row.expires_at)) && Date.now() >= Date.parse(row.expires_at) ? 'STALE' : row?.state || row?.status || 'NOT_RECORDED';
  const tone = v => ['LONG','UP','POSITIVE','BULLISH','APPROVE'].includes(v) ? 'aa-long' : ['SHORT','DOWN','NEGATIVE','BEARISH'].includes(v) ? 'aa-short' : ['CONFLICT','MIXED','UNKNOWN','HOLD','NO_TRADE','STALE','OPPOSES','FLAT','ERROR','REJECT','REJECTED'].includes(v) ? 'aa-uncertain' : 'aa-missing';
  const pairs = (entries, cls='aa-fields') => { const dl=node('dl',undefined,cls); entries.forEach(([k,v])=>{const d=node('div');d.append(node('dt',k),node('dd',value(v)));dl.append(d);});return dl; };
  const section = (title, ...content) => {const s=node('section',undefined,'aa-section');s.append(node('h3',title),...content);return s;};
  const list = values => {const ul=node('ul');const items=array(values);(items.length?items:['NOT_RECORDED']).forEach(v=>ul.append(node('li',value(v))));return ul;};
  const key = a => [a.identity.exchange,a.identity.instrument_id,a.identity.instrument_type,a.selection.side].join(':');
  const badge = (text, state=text) => node('span',text,tone(state));
  const news = a => a.luna?.status || 'NOT_RECORDED';
  const sol = a => a.sol?.current?.decision || a.sol?.status || 'NOT_RECORDED';
  const frameState = frame => frame?.status !== 'ASSESSED' ? frame?.status || 'NOT_RECORDED' : freshness({state:frame.state,expires_at:frame.expires_at});
  const direction = frame => frame?.status === 'ASSESSED' && !['STALE','UNAVAILABLE','ERROR','INVALID'].includes(frameState(frame)) ? frame.direction || 'UNKNOWN' : frameState(frame);
  const explain = a => `${a.selection.timeframe} ranking · momentum ${value(a.selection.momentum_support)} · ${value(a.selection.return_pct)}% recorded return`;
  const fetchJson = async name => {const r=await fetch(API+name,{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(!d || typeof d!=='object')throw Error('Invalid response');return d;};
  const validShortlists = view => ['LONG','SHORT'].every(side=>['CURRENT','STALE'].includes(view?.[side]?.state)&&Array.isArray(view[side].items));
  const validIdentity = a => a?.identity?.exchange==='bybit' && /^[A-Z0-9]{1,30}USDT$/.test(a.identity.instrument_id||'') && a.identity.instrument_type==='linear_perpetual' && a.selection?.symbol===a.identity.instrument_id && a.selection?.exchange===a.identity.exchange && a.selection?.instrument_type===a.identity.instrument_type && ['LONG','SHORT'].includes(a.selection?.side);
  function fallback(paper) {
    const shortlists=paper?.overview?.shortlists;
    if(paper?.version!=='paper-read-api-v1'||paper?.mode!=='paper'||!validShortlists(shortlists)) throw Error('Saved shortlist invalid');
    return {version:'asset-analysis-read-v1',mode:'paper',read_only:true,availability:'AVAILABLE',served_at:paper.served_at,shortlists,
      assets:['LONG','SHORT'].flatMap(side=>shortlists[side].items.map(selection=>({selection,identity:{exchange:selection.exchange,instrument_id:selection.symbol,instrument_type:selection.instrument_type},technical:{},technical_status:'UNAVAILABLE',selection_assessment:{},luna:{status:'UNAVAILABLE',reason:'The saved shortlist API does not expose asset-specific Luna assessments; assessment presence cannot be established.'},sol:{status:'UNAVAILABLE',records:[],blockers:[]},positions_status:'UNAVAILABLE',trades_status:'UNAVAILABLE',positions:[],trades:[]}))),
      market_context:paper.overview?.interpretation,history:{status:'UNAVAILABLE',items:[],explanation:'The saved shortlist API exposes the latest selection only. Historical selection snapshots and asset observations are not accessible through this response.'},fallback:true};
  }
  function renderSummary() {
    const view=data.shortlists, assets=data.assets;
    const times=['LONG','SHORT'].map(side=>view[side].observed_at).filter(v=>asTime(v)>-Infinity);
    const latest=times.sort((a,b)=>asTime(b)-asTime(a))[0];
    const state=['LONG','SHORT'].map(side=>freshness(view[side])).includes('STALE')?'STALE':'CURRENT';
    $('summary').replaceChildren(...Array.from(pairs([['Latest selection',time(latest)],['Shortlisted assets',new Set(assets.map(a=>a.identity.exchange+':'+a.identity.instrument_id)).size],['LONG shortlist',assets.filter(a=>a.selection.side==='LONG').length],['SHORT shortlist',assets.filter(a=>a.selection.side==='SHORT').length],['Data freshness',state]],'aa-summary').children));
    $('status').textContent=data.fallback?'Saved shortlist loaded · detailed evidence endpoint unavailable.':'Saved V4.1 evidence loaded · read only · paper trading.';
    $('evidence').replaceChildren(pairs([['Source',data.fallback?'/v4/paper (summary only)':'/v4/asset-analysis'],['API version',data.version],['API read time',time(data.served_at)],['LONG source',view.LONG.provenance?.source],['SHORT source',view.SHORT.provenance?.source],['LONG cycle',view.LONG.provenance?.cycle_started_at],['SHORT cycle',view.SHORT.provenance?.cycle_started_at],['Selection purpose',view.LONG.purpose]]),node('p','The shared header uses a separate Top 10 trading-universe feed. It does not report V4 shortlist membership.','aa-note'));
  }
  function renderCards() {
    host.replaceChildren();
    data.assets.forEach(a=>{
      const row=a.selection, symbol=row.symbol.replace(/USDT$/,'');
      const card=node('button',undefined,'aa-card');card.type='button';card.dataset.asset=key(a);card.setAttribute('aria-expanded',String(selected===a));card.setAttribute('aria-controls',panel.id);card.setAttribute('aria-label',`View full analysis for ${symbol}, ${row.side} rank ${row.rank}`);
      const head=node('span',undefined,'aa-card-heading'),logo=node('span',undefined,'aa-logo');
      const identity=window.AssetLogo.create(symbol,'aa-logo-image','aa-logo-fallback',44);identity.image.alt=symbol+' logo';logo.append(identity.fallback,identity.image);
      head.append(logo,node('strong',symbol,'aa-card-symbol'),node('span',row.side,'aa-direction '+tone(row.side)));
      const alignment=node('span',undefined,'aa-alignments');frames.forEach(tf=>{const item=node('span');item.append(node('strong',tf),badge(direction(a.technical?.[tf])));alignment.append(item);});
      const assessed=object(a.selection_assessment);
      card.append(head,node('span','Selection rank #'+value(row.rank),'aa-rank'),node('span',assessed.outcome ? `Saved assessment: ${assessed.outcome}` : explain(a),'aa-technical'),alignment);
      const evidence=pairs([['Asset news',news(a)],['Latest cycle SOL',sol(a)]],'aa-card-evidence');
      evidence.querySelectorAll('dd').forEach((dd,i)=>dd.className=tone(i?sol(a):news(a)));card.append(evidence);
      card.append(node('span',freshness(row)+' · '+time(row.observed_at),'aa-card-time'));
      const action=node('span',undefined,'aa-action');action.append(node('span','View Full Analysis'),node('span','↓'));card.append(action);
      card.addEventListener('click',()=>open(a,card));host.append(card);
    });
    if(!data.assets.length)host.append(node('p','No assets were recorded in the saved shortlist.','aa-note'));
  }
  function open(a,card) {
    selected=a;origin=card;activeTab=0;
    host.querySelectorAll('.aa-card').forEach(c=>c.setAttribute('aria-expanded',String(c===card)));
    $('panel-title').textContent=`${a.selection.symbol.replace(/USDT$/,'')} · ${a.selection.side} rank #${a.selection.rank}`;
    $('panel-meta').textContent=`${freshness(a.selection)} · selection ${time(a.selection.observed_at)} · ${a.identity.exchange} ${a.identity.instrument_type}`;
    panel.hidden=false;renderTabs();$('panel-title').focus({preventScroll:true});panel.scrollIntoView({behavior:'instant',block:'start'});
  }
  function close() {panel.hidden=true;selected=null;host.querySelectorAll('.aa-card').forEach(c=>c.setAttribute('aria-expanded','false'));origin?.focus({preventScroll:true});}
  function renderTabs() {
    tabs.replaceChildren();
    names.forEach((name,i)=>{const b=node('button',name);b.type='button';b.id='aa-tab-'+i;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(i===activeTab));b.setAttribute('aria-controls','aa-detail-panel');b.tabIndex=i===activeTab?0:-1;b.addEventListener('click',()=>selectTab(i));b.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(i+1)%names.length;if(e.key==='ArrowLeft')next=(i+names.length-1)%names.length;if(e.key==='Home')next=0;if(e.key==='End')next=names.length-1;if(next!==undefined){e.preventDefault();selectTab(next);tabs.children[next].focus();}});tabs.append(b);});renderDetail();
  }
  function selectTab(i) {activeTab=i;renderTabs();}
  function renderDetail() {
    detail.replaceChildren();const body=node('div');body.id='aa-detail-panel';body.setAttribute('role','tabpanel');body.setAttribute('aria-labelledby','aa-tab-'+activeTab);body.tabIndex=0;detail.append(body);
    const a=selected,row=a.selection,assessment=object(a.selection_assessment);
    if(activeTab===0){
      body.append(section('Latest saved selection',pairs([['Instrument',row.symbol],['Direction',row.side],['Rank',row.rank],['Selected at',time(row.observed_at)],['Selection state',freshness(row)],['Expires',time(row.expires_at)],['Recorded assessment',assessment.outcome],['Recorded entry readiness',assessment.entry_readiness]])),section('Why shortlisted',node('p',explain(a)),node('p','The saved selection ranked this asset in its directional research shortlist. This is not trade approval.','aa-note')),
        section('Supporting and conflicting evidence',node('p',`Ranking momentum: ${value(row.momentum_support)}. Saved assessment reasons and timing cautions follow; no additional rationale has been generated.`),list(assessment.reasons),list(assessment.entry_timing_caution)),
        section('Admission and paper position status',pairs([['Current-cycle admission records',array(a.sol?.admission).length?array(a.sol.admission).map(x=>x.status).join(' · '):'NOT_RECORDED'],['Open paper positions',a.positions_status!=='AVAILABLE'?(a.positions_status||'UNAVAILABLE'):array(a.positions).length?array(a.positions).map(p=>`${p.side} · ${p.availability} · entered ${time(p.entered_at)}`).join(' | '):'No verified matching open position returned'],['Retained completed paper trades',a.trades_status==='AVAILABLE'?array(a.trades).length:a.trades_status||'UNAVAILABLE']]),list(a.sol?.blockers)),
        section('Evidence provenance',pairs([['Cycle started',row.provenance?.cycle_started_at],['Source version',row.provenance?.source_version],['Observation ID',a.observation_id],['Technical join',a.technical_join]]),pairs(Object.entries(object(row.source_timestamps)).map(([k,v])=>[k,time(v)]))));
    } else if(activeTab===1){
      body.append(node('p','Original saved technical assessments only. Indicators and directional alignment are not recalculated in this page.','aa-note'));
      frames.forEach(tf=>{const f=object(a.technical?.[tf]);body.append(section(tf+' timeframe',pairs([['Assessment',f.status||a.technical_status||'NOT_RECORDED'],['Freshness',frameState(f)],['Trend',f.trend],['Momentum',f.momentum],['Direction',f.direction],['Alignment with '+row.side,f.sides?.[row.side]?.condition],['Assessed at',time(f.evaluated_at)],['Source candle',time(f.timestamp)],['Source observed',time(f.observed_at)],['Original expiry',time(f.expires_at)]]),pairs(Object.entries(object(f.indicators)).map(([k,v])=>[k,v])),node('p','Recorded warnings / reversal or timing cautions'),list(f.sides?.[row.side]?.warnings),list(f.reasons)));});
    } else if(activeTab===2){
      const luna=object(a.luna), saved=object(luna.assessment);
      body.append(section('Asset-specific Luna intelligence',pairs([['Status',news(a)],['Scope',luna.scope||'ASSET_SPECIFIC'],['Coverage',luna.coverage],['News state',luna.news_state],['Assessed at',time(luna.timestamps?.timestamp)],['Original expiry',time(luna.timestamps?.expires_at)],['Implication',saved.implication],['Model',luna.model]]),node('p',saved.summary||luna.reason||'No reliably attributed asset-specific assessment is exposed. Missing intelligence does not mean neutral sentiment.'),list(saved.uncertainty),list(luna.reasons)));
      ['bullish','bearish','catalysts','risks'].forEach(field=>{if(array(saved[field]).length)body.append(section(field,list(saved[field].map(c=>`${c.text} · ${array(c.evidence_ids).join(', ')}`))));});
      const assetSources=node('ul');array(luna.provenance).forEach(e=>{const li=node('li');li.append(node('span',`${value(e.evidence_id||e.id)} · ${value(e.source)} · ${time(e.published_at||e.observed_at)} `));try{const u=new URL(e.reference);if(u.protocol==='https:'&&!u.username&&!u.password){const link=node('a','Source');link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';li.append(link);}}catch{}assetSources.append(li);});
      if(assetSources.childElementCount)body.append(section('Saved asset sources',assetSources));
      const context=object(data.market_context), component=object(context.news_and_themes), content=object(component.content);
      body.append(section('Shared market context · not an asset-specific assessment',pairs([['Luna state',freshness(context)],['News state',freshness(component)],['Assessment time',time(context.source_at)],['News assessment time',time(component.source_at)],['News sentiment',content.sentiment],['Original expiry',time(context.expires_at)]]),node('p',value(context.assessment?.text)),node('p',value(content.summary)),list(content.uncertainty)));
      const symbol=row.symbol.replace(/USDT$/,'');
      const themes=array(content.themes).filter(t=>array(t.affected_markets).some(m=>[symbol,row.symbol].includes(String(m).toUpperCase())));
      body.append(section('Explicitly asset-targeted saved themes',themes.length?node('p','Matched only on exact asset identifiers in the retained affected-markets field.'):node('p','NOT_RECORDED · no saved theme explicitly names this asset.')));
      themes.forEach(t=>body.append(section(t.name,node('p',t.description),pairs([['Recorded implication',t.implication],['Evidence references',array(t.evidence_ids).join(', ')]]),node('h4','Catalysts'),list(array(t.catalysts).map(c=>c.text)),node('h4','Risks / conflicting evidence'),list(array(t.risks).map(c=>c.text)))));
      const sources=node('ul');array(component.provenance?.evidence).forEach(e=>{const li=node('li');li.append(node('span',`${value(e.id)} · ${value(e.source)} · ${time(e.published_at||e.observed_at)} · ${value(e.state)} `));try{const url=new URL(e.reference);if(url.protocol==='https:'&&!url.username&&!url.password){const link=node('a','Source');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';li.append(link);}}catch{}sources.append(li);});body.append(section('Saved market news sources',sources.childElementCount?sources:node('p','NOT_RECORDED')));
    } else if(activeTab===3){
      body.append(node('p','Original retained SOL entry decisions, including their recorded statuses. A LONG or SHORT proposal is separate from admission and a paper fill.','aa-note'),pairs([['Latest cycle status',a.sol?.status||'NOT_RECORDED']]),section('Current-cycle admission / execution records',array(a.sol?.admission).length?list(a.sol.admission.map(v=>`${value(v.status)} · ${array(v.reasons).join(', ')||'No reason recorded'} · position ${value(v.position_id)}`)):node('p','NOT_RECORDED'),list(a.sol?.blockers)));
      const reviewRecords=array(a.position_reviews);
      reviewRecords.forEach(r=>body.append(section('Position review · '+value(r.decision)+' · '+time(r.timestamp),pairs([['Position ID',r.position_id],['Original rationale',r.reasoning],['Recorded execution',r.execution],['Evidence references',array(r.evidence_refs).join(', ')],['Source',r.source]]))));
      const records=array(a.sol?.records);if(!records.length)body.append(node('p','No reliably joined retained SOL decision is returned. This does not establish whether an assessment happened outside the available records.','aa-note'));
      records.forEach(d=>body.append(section(`${value(d.decision||d.status)} · ${time(d.timestamp)}`,pairs([['Recorded AI status',d.ai_status],['Evidence status',d.status],['Scope',d.source],['Decision',d.decision],['Rationale',d.reasoning],['Entry conditions',d.entry_conditions],['Recorded execution / admission',d.execution],['Recorded error',d.error],['Controller status',d.budget_status],['Evidence references',array(d.evidence_refs).join(', ')],['Evidence fingerprint',d.evidence_fingerprint],['Decision request key',d.request_key]]),node('h4','Recorded rejection reasons'),list(d.rejection))));
    } else {
      const events=[];const add=(timestamp,title,text)=>{if(asTime(timestamp)>-Infinity)events.push({timestamp,title,text});};
      add(row.observed_at,'Shortlisted',`${row.side} rank #${row.rank} · ${row.timeframe} · saved cycle ${value(row.provenance?.cycle_started_at)}`);
      array(a.sol?.records).forEach(d=>{if(d.decision)add(d.timestamp,'SOL decision: '+d.decision,d.reasoning||'Rationale NOT_RECORDED');});
      const assessedTimes=[...new Set(frames.map(tf=>a.technical?.[tf]?.evaluated_at).filter(v=>asTime(v)>-Infinity))];
      assessedTimes.forEach(v=>add(v,'Saved technical assessment','Instrument and selection timestamp matched to observation '+value(a.observation_id)));
      array(a.position_reviews).forEach(r=>add(r.timestamp,'SOL position review: '+value(r.decision),value(r.reasoning)+' · execution '+value(r.execution)+' · position '+value(r.position_id)));
      array(a.positions).forEach(p=>add(p.entered_at,'Paper position opened',`${p.side} · position ${value(p.id)}`));
      array(a.trades).forEach(t=>{add(t.entered_at,'Retained paper trade entry',`${t.side} · trade ${value(t.id)}`);add(t.closed_at,'Paper trade closed',`${t.side} · realized P/L ${value(t.realized_pnl)} USDT · net P/L ${value(t.net_pnl)} USDT · ${value(t.exit_reason)}`);});
      body.append(node('p','Only timestamped retained events are shown. Position and trade events are instrument history; a link to this selection is NOT_RECORDED unless an explicit correlation is supplied. Missing Luna, admission timestamps and unexposed cycles are not inferred.','aa-note'),timeline(events));
    }
  }
  function timeline(events) {const ol=node('ol',undefined,'aa-timeline');events.sort((a,b)=>asTime(a.timestamp)-asTime(b.timestamp)).forEach(e=>{const li=node('li'),t=node('time',time(e.timestamp));t.dateTime=e.timestamp;li.append(t,node('strong',e.title),node('p',e.text));ol.append(li);});return ol;}
  function renderHistory() {
    const history=object(data.history), items=array(history.items).slice(0,30);
    $('history-status').textContent=`${history.status||'NOT_RECORDED'} · ${history.explanation||'No persisted selection history is exposed.'}`;
    const target=$('history');target.replaceChildren();if(!items.length)return;
    const table=node('table',undefined,'aa-history-table'),head=node('thead'),tr=node('tr');['Saved selection (Brisbane)','Asset','Direction','Rank','Record'].forEach(v=>tr.append(node('th',v)));head.append(tr);table.append(head);
    const body=node('tbody');items.slice(0,historyCount).forEach(v=>{const row=node('tr');[time(v.timestamp),v.symbol,v.side,'#'+value(v.rank),v.event].forEach(t=>row.append(node('td',value(t))));body.append(row);});table.append(body);const scroll=node('div',undefined,'aa-history-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Retained selection records');scroll.append(table);target.append(scroll);
    if(items.length>historyCount){const more=node('button','Show more retained records','aa-history-more');more.type='button';more.addEventListener('click',()=>{historyCount=Math.min(30,historyCount+10);renderHistory();});target.append(more);}
    target.append(node('p',`Showing ${Math.min(historyCount,items.length)} of ${items.length} returned records (maximum 30). Rank and bias are shown as recorded; missing cycles cannot prove an asset entered or left the shortlist.`,'aa-note'));
  }
  async function load() {
    $('refresh').disabled=true;host.setAttribute('aria-busy','true');$('status').textContent='Loading saved V4.1 evidence…';close();
    try {
      let response;
      try {response=await fetchJson('asset-analysis');if(response.version!=='asset-analysis-read-v1'||response.mode!=='paper'||response.read_only!==true)throw Error('Invalid evidence contract');}
      catch {response=fallback(await fetchJson('paper'));}
      if(response.availability!=='AVAILABLE'||!validShortlists(response.shortlists))throw Error('Shortlist unavailable');
      response.assets=array(response.assets).filter(validIdentity).filter(a=>array(response.shortlists[a.selection.side].items).some(row=>row.symbol===a.selection.symbol&&row.exchange===a.identity.exchange&&row.instrument_type===a.identity.instrument_type&&row.rank===a.selection.rank&&row.observed_at===a.selection.observed_at));
      data=response;historyCount=10;renderSummary();renderCards();renderHistory();
    } catch {
      data=null;$('status').textContent='UNAVAILABLE · saved V4.1 selection evidence could not be verified.';host.replaceChildren(node('p','Refresh to retry. No shortlist or intelligence has been inferred.','aa-note'));$('summary').replaceChildren();$('evidence').replaceChildren(node('p','UNAVAILABLE · request failed or the saved selection contract was not returned.'));$('history-status').textContent='UNAVAILABLE · no retained history could be read.';$('history').replaceChildren();
    } finally {host.setAttribute('aria-busy','false');$('refresh').disabled=false;}
  }
  $('close').addEventListener('click',close);panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});$('refresh').addEventListener('click',load);load();
})();

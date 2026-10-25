"use strict";
// Read-only saved V4 evidence. No legacy intelligence API, indicators or AI requests.
(() => {
  let cachedEvidence=null, pendingEvidence=null, cachedAt=0;
  function create(root) {
  const API = 'https://v4.rrr.trading/v4/';
  const $ = id => root.querySelector('#asset-analysis-' + id);
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
  const validIdentity = a => a?.identity?.exchange==='bybit' && /^[A-Z0-9]{1,30}USDT$/.test(a.identity.instrument_id||'') && a.identity.instrument_type==='linear_perpetual' && a.selection?.symbol===a.identity.instrument_id && (a.historical_only===true ? a.selection?.side==='HISTORICAL' : a.selection?.exchange===a.identity.exchange && a.selection?.instrument_type===a.identity.instrument_type && ['LONG','SHORT'].includes(a.selection?.side));
  function fallback(paper) {
    const shortlists=paper?.overview?.shortlists;
    if(paper?.version!=='paper-read-api-v1'||paper?.mode!=='paper'||!validShortlists(shortlists)) throw Error('Saved shortlist invalid');
    return {version:'asset-analysis-read-v1',mode:'paper',read_only:true,availability:'AVAILABLE',served_at:paper.served_at,shortlists,
      assets:['LONG','SHORT'].flatMap(side=>shortlists[side].items.map(selection=>({selection,identity:{exchange:selection.exchange,instrument_id:selection.symbol,instrument_type:selection.instrument_type},technical:{},technical_status:'UNAVAILABLE',selection_assessment:{},luna:{status:'UNAVAILABLE',reason:'The saved shortlist API does not expose asset-specific Luna assessments; assessment presence cannot be established.'},sol:{status:'UNAVAILABLE',records:[],blockers:[]},positions_status:'UNAVAILABLE',trades_status:'UNAVAILABLE',positions:[],trades:[]}))),
      market_context:paper.overview?.interpretation,history:{status:'UNAVAILABLE',items:[],explanation:'The saved shortlist API exposes the latest selection only. Historical selection snapshots and asset observations are not accessible through this response.'},fallback:true};
  }
  function includeReviewAssets(response, paper) {
    if(paper?.version!=='paper-read-api-v1'||paper.mode!=='paper')return response;
    const rankings=paper.overview?.rankings;
    if(!validShortlists(rankings))return response;
    const source=response.shortlists;
    // Never combine different saved cycles or attach detailed evidence by symbol alone.
    if(!['LONG','SHORT'].every(side=>source[side].provenance?.cycle_started_at && source[side].provenance.cycle_started_at===rankings[side].provenance?.cycle_started_at))return response;
    const review=Object.fromEntries(['LONG','SHORT'].map(side=>[side,{...rankings[side],items:rankings[side].items.filter(row=>row.side===side&&row.selected_for_technical_assessment===true)}]));
    const summaries=fallback({...paper,overview:{...paper.overview,shortlists:review}});
    const additions=summaries.assets.filter(validIdentity).filter(a=>!response.assets.some(saved=>key(saved)===key(a)));
    if(!additions.length)return response;
    const shortlists=Object.fromEntries(['LONG','SHORT'].map(side=>[side,{...source[side],
      state:source[side].state==='STALE'||review[side].state==='STALE'?'STALE':'CURRENT',
      items:[...source[side].items,...additions.filter(a=>a.selection.side===side).map(a=>a.selection)]}]));
    return {...response,shortlists,assets:[...response.assets,...additions.map(a=>({...a,review_selection:true}))],review_assets:true};
  }
  function includeSavedIntelligence(response) {
    const saved=array(response.asset_intelligence);
    const technical=array(response.technical_assessments);
    return {...response,assets:response.assets.map(a=>{
      const matches=saved.filter(v=>['exchange','instrument_id','instrument_type'].every(k=>v.identity?.[k]===a.identity[k]));
      const frames=technical.filter(v=>['exchange','instrument_id','instrument_type'].every(k=>v.identity?.[k]===a.identity[k]));
      if(frames.length===1)a={...a,technical:object(frames[0].technical)};
      return matches.length===1?{...a,luna:object(matches[0].luna)}:a;
    })};
  }
  function renderSummary() {
    const view=data.shortlists, assets=data.assets.filter(a=>!a.historical_only);
    const times=['LONG','SHORT'].map(side=>view[side].observed_at).filter(v=>asTime(v)>-Infinity);
    const latest=times.sort((a,b)=>asTime(b)-asTime(a))[0];
    const state=['LONG','SHORT'].map(side=>freshness(view[side])).includes('STALE')?'STALE':'CURRENT';
    $('summary').replaceChildren(...Array.from(pairs([['Latest selection',time(latest)],['Selected assets',new Set(assets.map(a=>a.identity.exchange+':'+a.identity.instrument_id)).size],['LONG review',assets.filter(a=>a.selection.side==='LONG').length],['SHORT review',assets.filter(a=>a.selection.side==='SHORT').length],['Data freshness',state]],'aa-summary').children));
    $('status').textContent=data.review_assets?'Saved review selections loaded - includes assets selected for technical assessment; trade approval is separate.':data.fallback?'Saved shortlist loaded · detailed evidence endpoint unavailable.':'Saved V4.1 evidence loaded · read only · paper trading.';
    $('evidence').replaceChildren(pairs([['Source',data.review_assets?'/v4/asset-analysis + /v4/paper rankings':data.fallback?'/v4/paper (summary only)':'/v4/asset-analysis'],['API version',data.version],['API read time',time(data.served_at)],['LONG source',view.LONG.provenance?.source],['SHORT source',view.SHORT.provenance?.source],['LONG cycle',view.LONG.provenance?.cycle_started_at],['SHORT cycle',view.SHORT.provenance?.cycle_started_at],['Selection purpose',view.LONG.purpose]]),node('p','The shared header uses a separate Top 10 trading-universe feed. It does not report V4 shortlist membership.','aa-note'));
  }
  function renderCards() {
    host.replaceChildren();
    data.assets.forEach(a=>{
      const row=a.selection, symbol=row.symbol.replace(/USDT$/,''), historical=a.historical_only===true;
      const card=node('button',undefined,'aa-card');card.type='button';card.dataset.asset=key(a);card.setAttribute('aria-expanded',String(selected===a));card.setAttribute('aria-controls',panel.id);card.setAttribute('aria-label',historical?`View retained SOL activity for ${symbol}`:`View full analysis for ${symbol}, ${row.side} rank ${row.rank}`);
      const head=node('span',undefined,'aa-card-heading'),logo=node('span',undefined,'aa-logo');
      const identity=window.AssetLogo.create(symbol,'aa-logo-image','aa-logo-fallback',44);identity.image.alt=symbol+' logo';logo.append(identity.fallback,identity.image);
      head.append(logo,node('strong',symbol,'aa-card-symbol'),node('span',row.side,'aa-direction '+tone(row.side)));
      const alignment=node('span',undefined,'aa-alignments');frames.forEach(tf=>{const item=node('span');item.append(node('strong',tf),badge(direction(a.technical?.[tf])));alignment.append(item);});
      const assessed=object(a.selection_assessment);
      card.append(head,node('span',historical?'Retained SOL activity':'Selection rank #'+value(row.rank),'aa-rank'),node('span',historical?'Historical paper position or SOL position review; no current research selection is implied.':a.review_selection ? 'Selected for technical assessment - detailed evidence unavailable' : assessed.outcome ? `Saved assessment: ${assessed.outcome}` : explain(a),'aa-technical'),alignment);
      const latestActivity=historical?(array(a.sol?.records)[0]?.decision||array(a.position_reviews)[0]?.decision||'HISTORICAL_ACTIVITY'):sol(a);
      const evidence=pairs([['Asset news',news(a)],[historical?'Retained SOL activity':'Latest cycle SOL',latestActivity]],'aa-card-evidence');
      evidence.querySelectorAll('dd').forEach((dd,i)=>dd.className=tone(i?sol(a):news(a)));card.append(evidence);
      card.append(node('span',historical?'ASSET LEVEL · not linked to current selection':freshness(row)+' · '+time(row.observed_at),'aa-card-time'));
      const action=node('span',undefined,'aa-action');action.append(node('span','View Full Analysis'),node('span','↓'));card.append(action);
      card.addEventListener('click',()=>open(a,card));host.append(card);
    });
    if(!data.assets.length){
      host.append(node('p','No assets were recorded in the saved shortlist.','aa-note'));
      const gaps=array(data.history?.gaps);
      if(gaps.some(g=>['retained_account_decisions_unavailable','position_review_history_unavailable','position_review_history_window_truncated'].includes(g)))host.append(node('p','Historical SOL activity retrieval is PARTIAL or UNAVAILABLE; the retained account or review history could not be fully read. No decisions were inferred.','aa-note'));
    }
  }
  function open(a,card) {
    selected=a;origin=card;activeTab=0;
    host?.querySelectorAll('.aa-card').forEach(c=>c.setAttribute('aria-expanded',String(c===card)));
    $('panel-title').textContent=a.historical_only?`${a.selection.symbol.replace(/USDT$/, "")} · retained SOL activity`:`${a.selection.symbol.replace(/USDT$/, "")} · ${a.selection.side} rank #${a.selection.rank}`;
    $('panel-meta').textContent=a.historical_only?`ASSET LEVEL · no current research selection · ${a.identity.exchange} ${a.identity.instrument_type}`:`${freshness(a.selection)} · selection ${time(a.selection.observed_at)} · ${a.identity.exchange} ${a.identity.instrument_type}`;
    panel.hidden=false;renderTabs();if(host){$('panel-title').focus({preventScroll:true});panel.scrollIntoView({behavior:'instant',block:'start'});}
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
      if(a.historical_only){
        body.append(section('Asset-level retained activity',node('p','This asset has retained paper position or SOL review evidence but no row in the current research shortlist. This history does not establish a current research direction.','aa-note'),pairs([['Instrument',row.symbol],['Current research selection','NO_CURRENT_SELECTION'],['Retained entry decisions',array(a.sol?.records).length],['Retained position reviews',array(a.position_reviews).length]])));
      } else {
      body.append(section('Latest saved selection',pairs([['Instrument',row.symbol],['Direction',row.side],['Rank',row.rank],['Selected at',time(row.observed_at)],['Selection state',freshness(row)],['Expires',time(row.expires_at)],['Recorded assessment',assessment.outcome],['Recorded entry readiness',assessment.entry_readiness]])),section('Why shortlisted',node('p',explain(a)),node('p',a.review_selection ? 'The saved rankings mark this asset as selected for technical assessment. SOL submission and trade approval are not established.' : 'The saved selection ranked this asset in its directional research shortlist. This is not trade approval.','aa-note')),
        section('Supporting and conflicting evidence',node('p',`Ranking momentum: ${value(row.momentum_support)}. Saved assessment reasons and timing cautions follow; no additional rationale has been generated.`),list(assessment.reasons),list(assessment.entry_timing_caution)),
        section('Admission and paper position status',pairs([['Current-cycle admission records',array(a.sol?.admission).length?array(a.sol.admission).map(x=>x.status).join(' · '):'NOT_RECORDED'],['Open paper positions',a.positions_status!=='AVAILABLE'?(a.positions_status||'UNAVAILABLE'):array(a.positions).length?array(a.positions).map(p=>`${p.side} · ${p.availability} · entered ${time(p.entered_at)}`).join(' | '):'No verified matching open position returned'],['Retained completed paper trades',a.trades_status==='AVAILABLE'?array(a.trades).length:a.trades_status||'UNAVAILABLE']]),list(a.sol?.blockers)),
        section('Evidence provenance',pairs([['Cycle started',row.provenance?.cycle_started_at],['Source version',row.provenance?.source_version],['Observation ID',a.observation_id],['Technical join',a.technical_join]]),pairs(Object.entries(object(row.source_timestamps)).map(([k,v])=>[k,time(v)]))));
      }
    } else if(activeTab===1){
      body.append(node('p','Recorded technical evidence for SOL. Historical fallback is display only and does not establish what SOL received for the selected decision.','aa-note'));
      const labels={'15m':'15m — Short-Term','1h':'1h — Medium-Term','4h':'4h — Higher-Timeframe'};
      const present=entries=>entries.filter(([,v])=>v!==undefined&&v!==null&&v!==''&&(!Array.isArray(v)||v.length));
      frames.forEach(tf=>{
        const f=object(a.technical?.[tf]), original=object(f.recorded_payload), params=object(f.parameters);
        const block=section(labels[tf]);block.classList.add('aa-technical-frame');
        if(f.status!=='ASSESSED'){
          block.append(node('p','UNAVAILABLE — No recorded assessment is available.','aa-note'));body.append(block);return;
        }
        const state=frameState(f)==='STALE'?'STALE':['CURRENT','AVAILABLE','PARTIAL'].includes(frameState(f))?'CURRENT':'UNKNOWN';
        const exact=f.attribution==='SOL_DECISION';
        block.append(node('p',`${exact?'SOL decision evidence':'HISTORICAL — Last recorded technical assessment'} · ${state}`,'aa-note '+tone(state)),
          node('p',`${state} — Last assessed ${time(f.evaluated_at||f.timestamp)}`,'aa-technical-stamp'));
        const signals=node('div',undefined,'aa-technical-signals');
        present([['Direction',f.direction],['Trend',f.trend],['Momentum',f.momentum]]).forEach(([k,v])=>{
          const item=node('span');item.append(node('small',k),badge(value(v),v));signals.append(item);
        });block.append(signals);
        const indicatorLabels={close:'Closing price',ema_fast:params.ema_fast?`EMA${params.ema_fast}`:'Fast EMA',ema_slow:params.ema_slow?`EMA${params.ema_slow}`:'Slow EMA',rsi:params.rsi_period?`RSI${params.rsi_period}`:'RSI',atr:params.atr_period?`ATR${params.atr_period}`:'ATR',atr_pct:'ATR (%)',distance_from_fast_ema_pct:'Distance from fast EMA (%)'};
        block.append(pairs(present(Object.entries(object(f.indicators))).map(([k,v])=>[indicatorLabels[k]||k,v]),'aa-fields aa-indicators'));
        const sides=node('div',undefined,'aa-technical-sides');
        ['LONG','SHORT'].forEach(side=>{
          const saved=object(f.sides?.[side]||f[side]);if(!Object.keys(saved).length)return;
          const group=node('div');group.append(node('strong',side,tone(side)));
          if(saved.condition!==undefined)group.append(node('p',value(saved.condition),tone(saved.condition)));
          if(array(saved.warnings).length)group.append(list(saved.warnings));
          const other=Object.entries(saved).filter(([k])=>!['condition','warnings'].includes(k));if(other.length)group.append(pairs(present(other)));
          sides.append(group);
        });block.append(sides);
        if(array(original.reasons).length)block.append(list(original.reasons));
        const assessed=asTime(f.evaluated_at||f.timestamp), age=Number.isFinite(assessed)?Math.max(0,Math.floor((Date.now()-assessed)/1000)):null;
        block.append(pairs(present([['Source candle',f.timestamp?time(f.timestamp):null],['Source at',f.source_at?time(f.source_at):null],['Observed at',f.observed_at?time(f.observed_at):null],['Original expiry',f.expires_at?time(f.expires_at):null],['Assessment age',age===null?null:`${age} seconds`],['Decision request',exact?f.request_key:null],['Recorded freshness',original.effective_freshness||original.state]])));
        const details=node('details',undefined,'aa-evidence');details.append(node('summary','Original evidence & additional fields'),node('pre',JSON.stringify(Object.keys(original).length?original:f,null,2),'aa-technical-json'));block.append(details);body.append(block);
      });
    } else if(activeTab===2){
      const luna=object(a.luna), saved=object(luna.assessment);
      body.append(section('Latest saved asset news & intelligence',node('p','Latest saved Luna assessment and supporting news for this asset, from the same saved record used to build SOL�s asset evidence. This may be newer than a displayed SOL decision. Stale evidence remains historical context.','aa-note'),pairs([['Status',news(a)],['Scope',luna.scope||'ASSET_SPECIFIC'],['Coverage',luna.coverage],['News state',luna.news_state],['Last successful news check',time(luna.discovery?.last_successful_check)],['Latest discovery attempt',time(luna.discovery?.checked_at)],['Assessed at',time(luna.timestamps?.timestamp)],['Original expiry',time(luna.timestamps?.expires_at)],['Implication',saved.implication],['Model',luna.model]]),node('p',saved.summary||luna.reason||'No reliably attributed asset-specific assessment is exposed. Missing intelligence does not mean neutral sentiment.'),list(saved.uncertainty),list(luna.reasons)));
      ['bullish','bearish','catalysts','risks'].forEach(field=>{if(array(saved[field]).length)body.append(section(field,list(saved[field].map(c=>`${c.text} · ${array(c.evidence_ids).join(', ')}`))));});
      array(luna.news).forEach(item=>{
        const article=section(item.headline,node('p',item.summary||'Article summary not recorded.'),pairs([['Published',time(item.published_at)],['Context',item.development_status],['Evidence ID',item.evidence_id]]));
        try {const u=new URL(item.provenance?.reference);if(u.protocol==='https:'&&!u.username&&!u.password){const link=node('a','Read source');link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';article.append(link);}} catch {}
        body.append(article);
      });
      const assetSources=node('ul');array(luna.provenance).filter(e=>!array(luna.news).some(item=>item.provenance?.reference===e.reference)).forEach(e=>{const li=node('li');li.append(node('span',`${value(e.evidence_id||e.id)} · ${value(e.source)} · ${time(e.published_at||e.observed_at)} `));try{const u=new URL(e.reference);if(u.protocol==='https:'&&!u.username&&!u.password){const link=node('a','Source');link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';li.append(link);}}catch{}assetSources.append(li);});
      if(assetSources.childElementCount)body.append(section('Saved asset sources',assetSources));
      const context=object(data.market_context), component=object(context.news_and_themes), content=object(component.content);
      body.append(section('Shared market context · not an asset-specific assessment',pairs([['Luna state',freshness(context)],['News state',freshness(component)],['Assessment time',time(context.source_at)],['News assessment time',time(component.source_at)],['News sentiment',content.sentiment],['Original expiry',time(context.expires_at)]]),node('p',value(context.assessment?.text)),node('p',value(content.summary)),list(content.uncertainty)));
      const symbol=row.symbol.replace(/USDT$/,'');
      const themes=array(content.themes).filter(t=>array(t.affected_markets).some(m=>[symbol,row.symbol].includes(String(m).toUpperCase())));
      body.append(section('Explicitly asset-targeted saved themes',themes.length?node('p','Matched only on exact asset identifiers in the retained affected-markets field.'):node('p','NOT_RECORDED · no saved theme explicitly names this asset.')));
      themes.forEach(t=>body.append(section(t.name,node('p',t.description),pairs([['Recorded implication',t.implication],['Evidence references',array(t.evidence_ids).join(', ')]]),node('h4','Catalysts'),list(array(t.catalysts).map(c=>c.text)),node('h4','Risks / conflicting evidence'),list(array(t.risks).map(c=>c.text)))));
      const sources=node('ul');array(component.provenance?.evidence).forEach(e=>{const li=node('li');li.append(node('span',`${value(e.id)} · ${value(e.source)} · ${time(e.published_at||e.observed_at)} · ${value(e.state)} `));try{const url=new URL(e.reference);if(url.protocol==='https:'&&!url.username&&!url.password){const link=node('a','Source');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';li.append(link);}}catch{}sources.append(li);});body.append(section('Saved market news sources',sources.childElementCount?sources:node('p','NOT_RECORDED')));
    } else if(activeTab===3){
      const records=array(a.sol?.records), reviewRecords=array(a.position_reviews);
      const activity=[...records.map(d=>({...d,activity_type:'ENTRY'})),...reviewRecords.map(r=>({...r,activity_type:'POSITION_REVIEW'}))]
        .filter(r=>asTime(r.timestamp)>-Infinity).sort((x,y)=>asTime(y.timestamp)-asTime(x.timestamp));
      const current=object(a.sol?.current_selection), currentDecision=a.sol?.current;
      if(!current.status)current.status='CORRELATION_UNAVAILABLE';
      body.append(section('Latest SOL Activity',activity.length?node('p',`${activity[0].activity_type==='ENTRY'?'Entry decision':'Position review'} · ${value(activity[0].decision)} · ${time(activity[0].timestamp)}`):node('p','NOT_RECORDED · No retained SOL entry decision or position review is available for this asset.')));
      body.append(section('Current Selection Decision',pairs([['Correlation status',current.status||'NOT_EVALUATED'],['Research cycle',current.cycle_started_at||row.provenance?.cycle_started_at],['SOL decision',current.status==='EVALUATED'?(currentDecision?.decision||currentDecision?.status):'NOT_EVALUATED'],['Correlation detail',current.reason||'']]),current.status==='EVALUATED'&&currentDecision?pairs([['Decision time',time(currentDecision.timestamp)],['Proposed direction',currentDecision.decision],['Recorded reasoning',currentDecision.reasoning],['Admission / execution',currentDecision.execution],['Blocking reason',array(currentDecision.rejection).join(', ')||currentDecision.error],['Position',currentDecision.position_id],['Correlation ID',currentDecision.request_key]]):node('p',current.status==='CORRELATION_UNAVAILABLE'?'The saved selection and cycle do not share a reliable cycle identifier; no current-cycle decision is joined.':current.status==='NO_CURRENT_SELECTION'?'NO_CURRENT_SELECTION · Historical activity is shown at asset level without a current research selection.':'NOT_EVALUATED · No retained SOL evaluation is associated with this research cycle.','aa-note')));
      body.append(section('Decision History',node('p','Retained asset-level decisions and position reviews are shown independently of the current research direction. Historical records are not linked to the current selection without matching cycle provenance.','aa-note')));
      if(!activity.length)body.append(node('p','No retained SOL decisions or position reviews were returned. Missing records are not reconstructed from research rankings or unchanged positions.','aa-note'));
      activity.forEach(d=>{
        const isReview=d.activity_type==='POSITION_REVIEW';
        body.append(section(`${isReview?'Position review':'Entry decision'} · ${value(d.decision||d.status)} · ${time(d.timestamp)}`,pairs(isReview?[
          ['Decision type',d.decision],['Position ID',d.position_id],['Recorded reasoning',d.reasoning],['Recorded outcome',d.execution],['Evidence references',array(d.evidence_refs).join(', ')],['Record source',d.source]
        ]:[
          ['Proposed direction',d.decision],['AI status',d.ai_status||d.status],['Recorded reasoning',d.reasoning],['Admission / execution',d.execution],['Position ID',d.position_id],['Rejection / blocking reason',[...array(d.rejection),d.error].filter(Boolean).join(', ')],['Evidence references',array(d.evidence_refs).join(', ')],['Cycle correlation ID',d.cycle_started_at],['Decision request key',d.request_key],['Record source',d.source]
        ])));
      });
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
  async function readEvidence(force=false) {
    if(pendingEvidence)return pendingEvidence;
    if(!force&&cachedEvidence&&Date.now()-cachedAt<30000)return cachedEvidence;
    pendingEvidence=(async()=>{
      let response;
      try {response=await fetchJson('asset-analysis');if(response.version!=='asset-analysis-read-v1'||response.mode!=='paper'||response.read_only!==true)throw Error('Invalid evidence contract');}
      catch {response=fallback(await fetchJson('paper'));}
      if(response.availability!=='AVAILABLE'||!validShortlists(response.shortlists))throw Error('Shortlist unavailable');
      response.assets=array(response.assets).filter(validIdentity).filter(a=>a.historical_only===true||array(response.shortlists[a.selection.side].items).some(row=>row.symbol===a.selection.symbol&&row.exchange===a.identity.exchange&&row.instrument_type===a.identity.instrument_type&&row.rank===a.selection.rank&&row.observed_at===a.selection.observed_at));
      try {response=includeReviewAssets(response,await fetchJson('paper'));} catch { /* Keep verified detailed evidence when the summary feed is unavailable. */ }
      cachedEvidence=includeSavedIntelligence(response);cachedAt=Date.now();return cachedEvidence;
    })();
    try{return await pendingEvidence;}finally{pendingEvidence=null;}
  }
  let requestVersion=0;
  async function showAsset(symbol,side) {
    const version=++requestVersion;
    selected=null;activeTab=0;tabs.replaceChildren();detail.replaceChildren(node('p','Loading saved asset analysis…','aa-note'));$('panel-meta').textContent='';panel.hidden=false;panel.setAttribute('aria-busy','true');
    try {
      const evidence=await readEvidence();
      if(version!==requestVersion)return;
      data=evidence;
      const instrument=symbol.endsWith('USDT')?symbol:symbol+'USDT';
      const matches=data.assets.filter(a=>a.identity.instrument_id===instrument);
      const asset=matches.find(a=>a.selection.side===side)||matches[0];
      if(!asset){detail.replaceChildren(node('p',`UNAVAILABLE · No verified saved analysis record was returned for ${instrument}. No analysis has been inferred.`,'aa-note'));return;}
      open(asset,null);
    } catch {
      if(version===requestVersion)detail.replaceChildren(node('p','UNAVAILABLE · saved V4.1 asset evidence could not be verified. Close and reopen to retry.','aa-note'));
    } finally {if(version===requestVersion)panel.setAttribute('aria-busy','false');}
  }
  function clear(keepContent=false){requestVersion++;if(!keepContent){selected=null;tabs.replaceChildren();detail.replaceChildren();$('panel-title').textContent='';$('panel-meta').textContent='';}panel.setAttribute('aria-busy','false');}
  async function load() {
    $('refresh').disabled=true;host.setAttribute('aria-busy','true');$('status').textContent='Loading saved V4.1 evidence…';close();
    try {
      data=await readEvidence(true);historyCount=10;renderSummary();renderCards();renderHistory();
      const requested=new URLSearchParams(location.search).get('asset');
      if(requested){const match=data.assets.find(a=>a.identity.instrument_id===requested.toUpperCase()+'USDT'||a.identity.instrument_id===requested.toUpperCase());if(match)open(match,null);else $('status').textContent=`No verified Asset Analysis record is available for ${requested.toUpperCase()}.`;}
    } catch {
      data=null;$('status').textContent='UNAVAILABLE · saved V4.1 selection evidence could not be verified.';host.replaceChildren(node('p','Refresh to retry. No shortlist or intelligence has been inferred.','aa-note'));$('summary').replaceChildren();$('evidence').replaceChildren(node('p','UNAVAILABLE · request failed or the saved selection contract was not returned.'));$('history-status').textContent='UNAVAILABLE · no retained history could be read.';$('history').replaceChildren();
    } finally {host.setAttribute('aria-busy','false');$('refresh').disabled=false;}
  }
  if(host){$('close').addEventListener('click',close);panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});$('refresh').addEventListener('click',load);load();}
  return {showAsset,clear};
  }
  window.AssetAnalysis=Object.freeze({create});
  if(document.body.dataset.page==='asset-analysis')create(document);
})();

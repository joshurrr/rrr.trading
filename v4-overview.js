'use strict';
// Public presentation only. No V3 fallback, private feeds, LLM or trading actions.
(() => {
  const root = document.getElementById('v4-overview');
  if (!root) return;
  const keys = ['breadth','fear_greed','sentiment','research','shortlists','paper_trading'];
  const cards = Object.fromEntries(keys.map(key => {
    const card = root.querySelector('[data-v4-section="'+key+'"]');
    if (!card) return [key, null];
    return [key, {state:card.querySelector('.v4-state'), value:card.querySelector('.v4-value'),
      detail:card.querySelector(':scope > p'), time:card.querySelector('small'), list:card.querySelector('.v4-shortlist')}];
  }));
  const endpoint = 'https://v4.rrr.trading/v4/paper';
  const status = document.getElementById('v4-overview-status');
  const stamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  const format = value => stamp(value) === null ? 'Timestamp unavailable' : new Intl.DateTimeFormat('en-AU', {
    timeZone:'Australia/Brisbane', dateStyle:'medium', timeStyle:'short'
  }).format(new Date(value)) + ' AEST';
  const number = value => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-AU',{maximumFractionDigits:2}).format(value) : null;
  const count = value => Number.isInteger(value) && value >= 0 ? String(value) : 'unknown';
  const pct = value => number(value) === null ? 'unknown' : number(value) + '%';
  const reasons = values => Array.isArray(values) ? values.filter(v => typeof v === 'string').slice(0,2).map(v => v.slice(0,160).replaceAll('_',' ')).join(' · ') : '';
  const badge = (card,state) => {card.state.textContent=state;card.state.dataset.state=state;};
  function stateOf(view) {
    if (!view || !['CURRENT','STALE'].includes(view.state) || (view.mode && view.mode !== 'paper')) return 'UNAVAILABLE';
    const source=stamp(view.source_at), observed=stamp(view.observed_at), end=stamp(view.expires_at);
    if (source === null || observed === null || end === null || source > observed || observed > Date.now() || end <= source) return 'UNAVAILABLE';
    return view.state === 'STALE' || Date.now() >= end ? 'STALE' : 'CURRENT';
  }
  function times(card,view) {
    card.time.textContent='Source: ' + format(view?.source_at) + ' · Expires: ' + format(view?.expires_at);
    card.time.title='Observed: ' + format(view?.observed_at);
  }
  function show(key,view,value,detail,override) {
    const card=cards[key], state=override || stateOf(view);
    if (!card) return state;
    badge(card,state);times(card,view);
    card.value.textContent=state === 'UNAVAILABLE' ? 'Observation unavailable' : value;
    card.detail.textContent=state === 'UNAVAILABLE' ? reasons(view?.reasons) || 'No saved public V4 observation.' :
      (state === 'STALE' ? 'Historical · ' : '') + detail;
    return state;
  }
  const make = (tag,text) => {const n=document.createElement(tag);n.textContent=text;return n;};
  function savedIntelligence(view) {
    const host=document.getElementById('home-saved-assessment');
    if(!host)return null;
    const saved=view?.interpretation, state=stateOf(saved);
    const usable=['CURRENT','STALE'].includes(state) && saved?.validation==='SAVED_SCHEMA_AND_ORIGINAL_EVIDENCE_VALIDATED';
    const current=usable && state==='CURRENT' && saved.historical===false;
    const label=usable ? current?'CURRENT':'HISTORICAL / EXPIRED':'UNAVAILABLE';
    document.getElementById('home-assessment-label').textContent=label+' · Saved Luna assessment';
    document.getElementById('home-assessment-summary').textContent=usable ? saved.assessment?.text || 'Assessment text unavailable.' : 'Saved interpretation unavailable.';
    document.getElementById('home-assessment-time').textContent=usable ?
      'Luna · '+(saved.health || 'UNKNOWN coverage')+' · Source: '+format(saved.source_at)+' · Valid until: '+format(saved.expires_at)+
      (current?'':' · Historical context only; not current direction. Reasons: '+(reasons(saved.reasons)||'Saved evidence is not current.')) : 'Source timestamp unavailable.';
    const change=usable && ['STRENGTHENING','WEAKENING','UNKNOWN'].includes(saved.sentiment_change)?saved.sentiment_change:'UNKNOWN';
    document.getElementById('home-sentiment-change').textContent=(usable&&!current?'Historical sentiment change: ':'Sentiment change: ')+change+' · Interpretation change, not measured price momentum.';
    const themes=document.getElementById('home-theme-list');themes.replaceChildren();
    document.getElementById('home-themes-state').textContent=label+' · '+(usable?'Luna saved drivers · '+format(saved.source_at):'No validated saved interpretation exposed by the API.');
    if(usable) for(const [i,driver] of (Array.isArray(saved.drivers)?saved.drivers:[]).slice(0,3).entries()) {
      if(typeof driver?.text!=='string')continue;
      const row=make('article','');row.className='home-luna-driver';
      row.append(make('h3',(current?'':'Historical · ')+'Driver '+(i+1)),make('p',driver.text));
      const refs=Array.isArray(driver.evidence_ids)?driver.evidence_ids.filter(v=>typeof v==='string'):[];
      row.append(make('small','Luna · '+label+' · '+format(saved.source_at)+' · Evidence: '+(refs.join(', ')||'Unavailable')));themes.append(row);
    }
    if(!themes.children.length)themes.append(make('p',usable?'No drivers recorded in this assessment.':'Market themes unavailable.'));
    for(const [id,key,title] of [['home-contradictions','contradictions','Contradictions'],['home-uncertainty','uncertainty','Uncertainty and missing evidence']]) {
      const target=document.getElementById(id);target.replaceChildren();
      if(!usable)continue;
      target.append(make('h3',(current?'':'Historical · ')+title));
      const rows=Array.isArray(saved[key])?saved[key]:[];
      for(const row of rows.slice(0,3))target.append(make('p',typeof row==='string'?row:row?.text || 'Unavailable'));
      if(!rows.length)target.append(make('p','None recorded; this does not establish absence of risk.'));
    }
    if(usable && Array.isArray(saved.changes))for(const row of saved.changes.slice(0,3))if(typeof row?.text==='string')themes.append(make('p',(current?'Change: ':'Historical change: ')+row.text));
    const indexes=document.getElementById('home-cash-indexes');indexes.replaceChildren();
    for(const [key,title] of [['NASDAQ100','Nasdaq-100'],['SP500','S&P 500']]) {
      const item=view?.cash_indexes?.[key], state=stateOf(item), known=['CURRENT','STALE'].includes(state) &&
        item?.session_context==='DAILY_CASH_INDEX_CLOSE_NOT_LIVE_OR_FUTURES' && typeof item.value==='number' && Number.isFinite(item.value);
      const row=make('article','');row.append(make('h3',title+' · daily cash-index close'),
        make('p',known?(state==='STALE'?'HISTORICAL / STALE · ':'')+number(item.value)+' index points':'UNAVAILABLE'),
        make('small',known?'FRED · Observation date: '+item.observation_date+' · Collected: '+format(item.observed_at)+' · Expires: '+format(item.expires_at):'Source timestamp unavailable.'));indexes.append(row);
    }
    return usable?{saved,current}:null;
  }
  function marketBriefing(view, aiState) {
    const projected=savedIntelligence(view), ai=view.sentiment;
    const direction=projected ? projected.current?projected.saved.market_direction:null : aiState==='CURRENT'?ai?.market_direction:null;
    const label={UP:'BULLISH',DOWN:'BEARISH',NEUTRAL:'NEUTRAL'}[direction];
    document.getElementById('market-condition-headline').textContent=label || 'UNCONFIRMED';
    document.getElementById('market-condition-explanation').textContent=label ?
      projected?.saved.directional_pressure?.text || 'The current saved assessment indicates '+label.toLowerCase()+' direction.' :
      'No current validated directional assessment is available. The saved assessment below is historical context only.';
    badge({state:document.getElementById('market-condition-state')},label?'CURRENT':aiState);
    document.getElementById('market-condition-note').textContent=projected && !projected.current ?
      'Previous direction: '+({UP:'BULLISH',DOWN:'BEARISH',NEUTRAL:'NEUTRAL'}[projected.saved.market_direction]||'UNKNOWN')+' · HISTORICAL, not current direction.' :
      'Research context only · Source: '+format(ai?.source_at)+' · Expires: '+format(ai?.expires_at)+'.';
  }

  function detailedMarketBriefing(view, aiState) {
    const b=view.breadth?.values || {}, ai=view.sentiment, f=view.fear_greed?.values || {};
    const breadthState=stateOf(view.breadth), fearState=stateOf(view.fear_greed);
    const percentages=[b.rising_24h_pct,b.falling_24h_pct];
    const knownBreadth=percentages.every(v=>typeof v==='number' && Number.isFinite(v) && v>=0 && v<=100)
      && percentages[0]+percentages[1]<=100 && ['AVAILABLE','PARTIAL'].includes(view.breadth?.health)
      && Number.isInteger(b.assets_included) && b.assets_included>0;
    const knownFear=typeof f.value==='number' && Number.isFinite(f.value) && f.value>=0 && f.value<=100;
    const direction={UP:'upward pressure',DOWN:'downward pressure',NEUTRAL:'neutral pressure'}[ai?.market_direction];
    let headline='MARKET PICTURE INCOMPLETE', tone='mixed';
    let explanation='Insufficient fresh market evidence is available to establish an overall market condition.';
    // Describe participation and saved interpretation; no score, forecast or trading rule.
    if(breadthState==='CURRENT' && knownBreadth && aiState==='CURRENT' && direction && fearState==='CURRENT' && knownFear) {
      const rising=b.rising_24h_pct>b.falling_24h_pct, falling=b.falling_24h_pct>b.rising_24h_pct;
      const aligned=rising && ai.market_direction==='UP' || falling && ai.market_direction==='DOWN';
      const partial=view.breadth.health==='PARTIAL';
      if(aligned && !partial) {
        tone=rising?'positive':'negative';
        headline=rising?'UPWARD PRESSURE — OBSERVATIONS ALIGNED':'DOWNWARD PRESSURE — OBSERVATIONS ALIGNED';
      } else headline=partial?'MIXED MARKET — LIMITED COVERAGE':'MIXED MARKET — NO DIRECTIONAL CONSENSUS';
      explanation=(rising?'More monitored assets are rising than falling. ':falling?'More monitored assets are falling than rising. ':'Monitored rising and falling participation is balanced. ')
        +'The current saved assessment indicates '+direction+'. '
        +(partial?'Breadth coverage is partial, so broad market agreement is not established. ':!aligned?'These observations do not establish a shared direction. ':'This is agreement between two observations, not a prediction. ')
        +'Fear & Greed is sentiment context, not a directional forecast.';
    } else {
      if(breadthState==='STALE')explanation+=' Breadth is historical, not current participation.';
      if(aiState==='STALE' && direction)explanation+=' The historical assessment indicated '+direction+'; it is not fresh confirmation.';
      else if(aiState==='CURRENT' && direction)explanation+=' The current saved assessment indicates '+direction+', without enough fresh supporting observations for consensus.';
    }
    root.querySelector('.v4-market-briefing').dataset.tone=tone;
    document.getElementById('market-condition-headline').textContent=headline;
    document.getElementById('market-condition-explanation').textContent=explanation;
    const conditionState = [breadthState, fearState, aiState].includes('STALE') ? 'STALE' :
      [breadthState, fearState, aiState].includes('UNAVAILABLE') || !knownBreadth || !knownFear ? 'UNAVAILABLE' :
      view.breadth.health === 'PARTIAL' ? 'PARTIAL' : 'CURRENT';
    badge({state:document.getElementById('market-condition-state')}, conditionState);
    document.getElementById('market-condition-note').textContent = conditionState === 'CURRENT' ? 'Saved market assessment · research context only.' :
      conditionState === 'STALE' ? 'Historical evidence present · fresh consensus unavailable.' :
      conditionState === 'PARTIAL' ? 'Limited coverage · broad market agreement not established.' : 'Insufficient verified evidence · market condition unavailable.';
  }
  const assessmentText = row => row.selected_for_technical_assessment === true ? 'SELECTED FOR ASSESSMENT' :
    row.selected_for_technical_assessment === false ? 'RESEARCH ONLY' : 'ASSESSMENT STATUS UNKNOWN';
  const shortlistNodes = new Map();
  function shortlist(side,view) {
    if (!shortlistNodes.has(side)) {
      const strong=document.createElement('section'), heading=document.createElement('h4'), grid=document.createElement('div');
      strong.className='v4-shortlist-side';strong.dataset.side=side;grid.className='universe-grid';grid.id='v4-'+side.toLowerCase()+'-opportunities';strong.append(heading,grid);
      window.AssetCarousel?.enhance(grid,side+' research candidates');
      shortlistNodes.set(side,{strong,heading,grid});
    }
    const {strong,heading,grid}=shortlistNodes.get(side);
    let state=stateOf(view);
    if (!Array.isArray(view?.items) || view.purpose !== 'RESEARCH_RANKING_ONLY') state='UNAVAILABLE';
    const validRow = row => row?.side === side && typeof row.symbol === 'string' && /^[A-Z0-9]{1,40}$/.test(row.symbol)
      && typeof row.exchange === 'string' && /^[a-z0-9_-]{1,32}$/.test(row.exchange)
      && Number.isInteger(row.rank) && row.rank > 0 && ['15m','1h','4h'].includes(row.timeframe)
      && ['FAVOURS','OPPOSES','FLAT'].includes(row.momentum_support) && number(row.return_pct) !== null && stateOf({...row,source_at:row.observed_at}) !== 'UNAVAILABLE';
    if (state !== 'UNAVAILABLE' && !view.items.every(validRow)) state='UNAVAILABLE';
    if (state !== 'UNAVAILABLE' && (new Set(view.items.map(row=>row.symbol)).size !== view.items.length ||
      view.items.some((row,index)=>index>0 && row.rank<=view.items[index-1].rank))) state='UNAVAILABLE';
    if (state !== 'UNAVAILABLE' && view.items.some(row => stateOf({...row,source_at:row.observed_at}) === 'STALE')) state='STALE';
    heading.textContent=side+' CANDIDATES — '+(side==='LONG'?'BULLISH':'BEARISH')+' OPPORTUNITIES · '+state;
    heading.className=side === 'LONG' ? 'v4-long' : 'v4-short';
    const rows=state === 'UNAVAILABLE' ? [] : view.items.slice(0,7);
    if(rows.length && !grid.children.length)grid.replaceChildren();
    window.CandidateCards?.reconcile(grid,rows.map(row=>({symbol:row.symbol.replace(/USDT$/,''),
      asset:{direction:side,selected_timeframe:row.timeframe},options:{current:state==='CURRENT',rank:row.rank,
        reason:row.exchange+' · '+row.symbol+' · '+row.momentum_support+' momentum. Research ranking only.',
        entryState:assessmentText(row)+' · SOL decision not reported · not trade approval.',
        evidenceLabel:row.selected_for_technical_assessment === true?'Saved V4 evidence':'Research details'}})));
    rows.forEach((row,index)=>{
      const card=grid.children[index];if(!card)return;
      card.v4Observation={row,view,state};
      card.querySelector('.universe-score').textContent=pct(row.return_pct);
      card.querySelector('.candidate-score-label').textContent=row.timeframe+' price return · not a score';
      card.querySelector('.universe-trend').textContent=state+' · '+row.momentum_support;
      const direction=card.querySelector('.candidate-direction');direction.hidden=false;direction.textContent=side+' · '+row.timeframe;
      card.querySelector('.candidate-context').textContent=row.exchange+' · '+row.symbol+' · research ranking';
      card.dataset.assessment=row.selected_for_technical_assessment === true?'selected':row.selected_for_technical_assessment === false?'research':'unknown';
      let assessment=card.querySelector('.candidate-assessment');
      if(!assessment){assessment=document.createElement('span');assessment.className='candidate-assessment';card.querySelector('.candidate-info').append(assessment);}
      assessment.textContent=assessmentText(row);
      const timing='Source: '+format(row.observed_at)+' · Expires: '+format(row.expires_at);
      card.querySelector('.universe-confidence').textContent=timing+' · Score / confidence / price unavailable';
      card.querySelector('button').title=timing;
    });
    if(!rows.length)grid.textContent=state === 'UNAVAILABLE' ? 'Unavailable' : 'No ranked opportunities recorded';
    heading.textContent+=state==='UNAVAILABLE'?'':' · '+rows.length+' candidate'+(rows.length===1?'':'s');
    strong.title='Source: ' + format(view?.source_at) + ' · Expires: ' + format(view?.expires_at);
    return {strong,state};
  }
  let busy=false,snapshot=null;
  function researchActivity(view,rankings,sides,loading=false) {
    const node=document.getElementById('market-research-activity'), sources=['LONG','SHORT'].map(side=>rankings?.[side]);
    const states=sides?.map(side=>side.state) || ['UNAVAILABLE','UNAVAILABLE'];
    if (!node) return;
    const state=loading?'LOADING':states.every(s=>s==='UNAVAILABLE')?'UNAVAILABLE':states.includes('STALE')?'STALE':states.every(s=>s==='CURRENT')?'CURRENT':'PARTIAL';
    const counts=sources.map((source,index)=>states[index]==='UNAVAILABLE'?'unknown':count(source?.available_count));
    const ranked=counts[0]===counts[1]?counts[0]+' Assets Ranked':'LONG '+counts[0]+' / SHORT '+counts[1]+' Assets Ranked';
    const selected=stateOf(view)==='UNAVAILABLE'?'unknown':count(view?.counts?.assets_technically_assessed);
    const health=sources.map(source=>['AVAILABLE','PARTIAL','STALE','UNAVAILABLE'].includes(source?.health)?source.health:'UNKNOWN');
    const healthLabel=health[0]===health[1]?health[0]:'LONG '+health[0]+' / SHORT '+health[1];
    const sentiment=[...new Set(sources.flatMap(source=>Array.isArray(source?.items)?source.items.map(row=>
      ['AVAILABLE','PARTIAL','STALE','UNAVAILABLE','UNKNOWN'].includes(row?.source_freshness?.sentiment)?row.source_freshness.sentiment:'UNKNOWN'):[]))];
    const sourceTimes=sources.map((source,index)=>states[index]==='UNAVAILABLE'?null:source?.source_at);
    const updated=sourceTimes[0]===sourceTimes[1]?format(sourceTimes[0]):'LONG '+format(sourceTimes[0])+' / SHORT '+format(sourceTimes[1]);
    node.dataset.state=state;
    node.dataset.degraded=String(state!=='CURRENT' || health.some(h=>h!=='AVAILABLE') || sentiment.some(s=>s!=='AVAILABLE') || !sentiment.length);
    node.textContent=loading?'Market research loading · Ranking counts and update unavailable.':
      ranked+' · '+selected+' Selected for Assessment · Last Updated '+updated+
      ' · Rankings: '+state+' · Research health: '+healthLabel+' · Sentiment freshness: '+(sentiment.length===1?sentiment[0]:sentiment.length?'MIXED':'UNKNOWN');
    node.title='Saved research rankings, not trading decisions or a live process health check.';
  }
  function unavailable(message,loading=false) {
    window.HomeDemoPositions?.render(null,loading);
    savedIntelligence(null);
    researchActivity(null,null,null,loading);
    for(const key of keys){
      const card=cards[key];if(!card)continue;badge(card,loading?'LOADING':'UNAVAILABLE');
      if(card.value)card.value.textContent=loading?'Reading saved observation…':'Observation unavailable';
      if(card.list){card.list.replaceChildren();for(const side of ['LONG','SHORT'])card.list.append(shortlist(side,null).strong);}
      card.detail.textContent=loading?'Awaiting the read-only V4 feed.':'No verified public V4 observation.';
      card.time.textContent='Observation timestamp unavailable.';card.time.removeAttribute('title');
    }
    document.getElementById('market-condition-headline').textContent='UNCONFIRMED';
    document.getElementById('market-condition-explanation').textContent=loading?'Awaiting saved market observations.':'Insufficient fresh market evidence is available to establish an overall market condition.';

    badge({state:document.getElementById('market-condition-state')}, loading?'LOADING':'UNAVAILABLE');
    document.getElementById('market-condition-note').textContent=loading?'Awaiting saved market observations.':'Market evidence unavailable · open details for context.';
    status.textContent=message;
  }
  function render() {
    if(!snapshot)return;
    window.HomeDemoPositions?.render(snapshot);
    const view=snapshot.overview, states=[];
    const breadth=view.breadth, b=breadth?.values || {};
    states.push(show('breadth',breadth,pct(b.rising_24h_pct)+' rising · '+pct(b.falling_24h_pct)+' falling',
      'Bybit · 24h · '+count(b.assets_included)+' assets · median '+pct(b.median_change_24h_pct)+(breadth?.health === 'PARTIAL'?' · partial coverage':'')));
    const fear=view.fear_greed,f=fear?.values || {};
    states.push(show('fear_greed',fear,(number(f.value) ?? 'Unknown')+' / 100',
      (['Extreme Fear','Fear','Neutral','Greed','Extreme Greed'].includes(f.classification)?f.classification:'Classification unknown')+' · Bitcoin-focused daily index'));
    const research=view.research,c=research?.counts || {};
    states.push(show('research',research,count(c.assets_evaluated_for_ranking),
      'Assessed for ranking · '+count(c.assets_technically_assessed)+' technical · '+count(c.eligible_pool_assets)+' eligible pool'+(research?.status === 'ATTENTION'?' · '+(reasons(research.reasons)||'research attention'):'')));
    const sentiment=view.sentiment;
    let aiState=stateOf(sentiment);
    if (!['CURRENT','CONTEXT_ONLY'].includes(sentiment?.context_state) || aiState === 'CURRENT' && (sentiment.context_state !== 'CURRENT' || sentiment.status !== 'USABLE')) aiState='UNAVAILABLE';
    const direction={UP:'Upward pressure ↗',DOWN:'Downward pressure ↘',NEUTRAL:'Neutral pressure →'}[sentiment?.market_direction] || 'Direction unknown';
    states.push(show('sentiment',sentiment,aiState === 'STALE'?'Historical assessment':'Assessment available',aiState === 'STALE' ?
      direction+' · '+(sentiment.context_state === 'CONTEXT_ONLY'?'CONTEXT_ONLY · stale supporting evidence.':'Assessment expired · no fresh confirmation.') : direction+' · saved assessment, never trade approval.',aiState));
    if (document.body.dataset.page==='analysis') detailedMarketBriefing(view,aiState);
    else marketBriefing(view,aiState);
    const lists=cards.shortlists;
    if (lists) {
    const sides=['LONG','SHORT'].map(side=>shortlist(side,view.rankings?.[side]));
    researchActivity(research,view.rankings,sides);
    if(!sides.every((v,i)=>lists.list.children[i]===v.strong))lists.list.replaceChildren(...sides.map(v=>v.strong));
    const listState=sides.every(v=>v.state==='UNAVAILABLE')?'UNAVAILABLE':sides.some(v=>v.state==='STALE')?'STALE':sides.every(v=>v.state==='CURRENT')?'CURRENT':'PARTIAL';
    badge(lists,listState);states.push(listState);
    lists.detail.textContent='Rankings are research, not trade approval.';
    lists.time.textContent=['LONG','SHORT'].map(side=>side+': '+format(view.rankings?.[side]?.source_at)+' · expires '+format(view.rankings?.[side]?.expires_at)).join(' · ');
    }
    const paper=view.paper_trading, failures=paper?.monitoring?.unmonitored;
    const cycleKnown=['OK','ATTENTION','BLOCKED'].includes(paper?.status);
    const detail=!Array.isArray(failures)?'Monitoring coverage unknown.':failures.length?failures.length+' unmonitored demo position'+(failures.length===1?'':'s')+' · '+(reasons(paper.reasons)||'monitoring attention'):
      paper.monitoring.status==='OK'?'Last saved cycle: no unmonitored positions reported.':'Monitoring requires attention.';
    states.push(show('paper_trading',paper,'DEMO · '+paper?.status,detail,cycleKnown?stateOf(paper):'UNAVAILABLE'));
    const summary=(states.includes('UNAVAILABLE') || states.includes('PARTIAL')?'Partial coverage':'Saved V4 observations')+' · API snapshot: '+format(snapshot.served_at)+'.';
    if(status.textContent!==summary)status.textContent=summary;
  }
  async function refresh() {
    if(busy)return;busy=true;root.setAttribute('aria-busy','true');
    try{
      const response=await fetch(endpoint,{method:'GET',credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('unavailable');
      const value=await response.json();
      if(value?.version!=='paper-read-api-v1' || value.mode!=='paper' || value.overview?.version!=='paper-overview-v1' || value.overview.purpose!=='PUBLIC_SAVED_OBSERVATIONS_ONLY')throw new Error('invalid_paper_feed');
      snapshot=value;render();
    }catch(_){snapshot=null;unavailable('V4 public feed unavailable · connection or overview contract could not be verified.');}
    finally{busy=false;root.setAttribute('aria-busy','false');}
  }
  root.querySelector('.market-evidence-link')?.addEventListener('click',()=>{root.querySelector('#market-evidence').open=true;});
  window.refreshV4Overview=refresh;

  unavailable('Loading the read-only V4 overview…',true);refresh();
  setInterval(render,1000); // Source-provided deadlines only; no market requests.
  setInterval(()=>{if(!document.hidden)refresh();},30000);
  document.addEventListener('visibilitychange',()=>{render();if(!document.hidden)refresh();});
})();

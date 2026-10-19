'use strict';
// Public presentation only. No V3 fallback, private feeds, LLM or trading actions.
(() => {
  const root = document.getElementById('v4-overview');
  if (!root) return;
  const keys = ['breadth','fear_greed','sentiment','research','shortlists','paper_trading'];
  const cards = Object.fromEntries(keys.map(key => {
    const card = root.querySelector('[data-v4-section="'+key+'"]');
    return [key, {state:card.querySelector('.v4-state'), value:card.querySelector('.v4-value'),
      detail:card.querySelector('p'), time:card.querySelector('small'), list:card.querySelector('.v4-shortlist')}];
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
    badge(card,state);times(card,view);
    card.value.textContent=state === 'UNAVAILABLE' ? 'Observation unavailable' : value;
    card.detail.textContent=state === 'UNAVAILABLE' ? reasons(view?.reasons) || 'No saved public V4 observation.' :
      (state === 'STALE' ? 'Historical · ' : '') + detail;
    return state;
  }
  function marketBriefing(view, aiState) {
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
        headline=rising?'UPWARD PRESSURE — BREADTH & AI ALIGNED':'DOWNWARD PRESSURE — BREADTH & AI ALIGNED';
      } else headline=partial?'MIXED MARKET — LIMITED COVERAGE':'MIXED MARKET — NO DIRECTIONAL CONSENSUS';
      explanation=(rising?'More monitored assets are rising than falling. ':falling?'More monitored assets are falling than rising. ':'Monitored rising and falling participation is balanced. ')
        +'The current saved AI interpretation indicates '+direction+'. '
        +(partial?'Breadth coverage is partial, so broad market agreement is not established. ':!aligned?'These observations do not establish a shared direction. ':'This is agreement between two observations, not a prediction. ')
        +'Fear & Greed is sentiment context, not a directional forecast.';
    } else {
      if(breadthState==='STALE')explanation+=' Breadth is historical, not current participation.';
      if(aiState==='STALE' && direction)explanation+=' The historical AI interpretation indicated '+direction+'; it is not fresh confirmation.';
      else if(aiState==='CURRENT' && direction)explanation+=' The current saved AI interpretation indicates '+direction+', without enough fresh supporting observations for consensus.';
    }
    root.querySelector('.v4-market-briefing').dataset.tone=tone;
    document.getElementById('market-condition-headline').textContent=headline;
    document.getElementById('market-condition-explanation').textContent=explanation;
  }
  const decisionText = row => ['CANDIDATE','WAIT','BLOCKED'].includes(row?.decision?.outcome) ? 'Recorded '+row.decision.outcome : 'Trade decision unavailable';
  const shortlistNodes = new Map();
  function shortlist(side,view) {
    if (!shortlistNodes.has(side)) {
      const strong=document.createElement('section'), heading=document.createElement('strong'), grid=document.createElement('div');
      strong.className='v4-shortlist-side';strong.dataset.side=side;grid.className='universe-grid';grid.id='v4-'+side.toLowerCase()+'-opportunities';strong.append(heading,grid);
      window.AssetCarousel?.enhance(grid,'Top '+side+' opportunities');
      shortlistNodes.set(side,{strong,heading,grid});
    }
    const {strong,heading,grid}=shortlistNodes.get(side);
    let state=stateOf(view);
    if (!Array.isArray(view?.items)) state='UNAVAILABLE';
    const validRow = row => row?.side === side && typeof row.symbol === 'string' && /^[A-Z0-9]{1,40}$/.test(row.symbol)
      && typeof row.exchange === 'string' && /^[a-z0-9_-]{1,32}$/.test(row.exchange)
      && Number.isInteger(row.rank) && row.rank > 0 && ['15m','1h','4h'].includes(row.timeframe)
      && ['FAVOURS','OPPOSES','FLAT'].includes(row.momentum_support) && number(row.return_pct) !== null && stateOf({...row,source_at:row.observed_at}) !== 'UNAVAILABLE';
    if (state !== 'UNAVAILABLE' && !view.items.every(validRow)) state='UNAVAILABLE';
    if (state !== 'UNAVAILABLE' && view.items.some(row => stateOf({...row,source_at:row.observed_at}) === 'STALE')) state='STALE';
    heading.textContent='TOP '+side+' OPPORTUNITIES · '+state;
    heading.className=side === 'LONG' ? 'v4-long' : 'v4-short';
    const rows=state === 'UNAVAILABLE' ? [] : view.items.slice(0,8);
    if(rows.length && !grid.children.length)grid.replaceChildren();
    window.CandidateCards?.reconcile(grid,rows.map(row=>({symbol:row.symbol.replace(/USDT$/,''),
      asset:{direction:side,selected_timeframe:row.timeframe},options:{current:state==='CURRENT',rank:row.rank,
        reason:row.exchange+' · '+row.symbol+' · '+row.momentum_support+' momentum. Research ranking only.',
        entryState:decisionText(row)+' · research only, not trade approval.',evidenceLabel:'Saved V4 evidence'}})));
    rows.forEach((row,index)=>{
      const card=grid.children[index];if(!card)return;
      card.v4Observation={row,view,state};
      card.querySelector('.universe-score').textContent=pct(row.return_pct);
      card.querySelector('.candidate-score-label').textContent=row.timeframe+' price return · not a score';
      card.querySelector('.universe-trend').textContent=state+' · '+row.momentum_support;
      const direction=card.querySelector('.candidate-direction');direction.hidden=false;direction.textContent=side+' · '+row.timeframe;
      card.querySelector('.candidate-context').textContent=row.exchange+' · '+row.symbol+' · '+decisionText(row);
      const timing='Source: '+format(row.observed_at)+' · Expires: '+format(row.expires_at);
      card.querySelector('.universe-confidence').textContent=timing+' · Score / confidence / price unavailable';
      card.querySelector('button').title=timing;
    });
    if(!rows.length)grid.textContent=state === 'UNAVAILABLE' ? 'Unavailable' : 'No ranked opportunities recorded';
    heading.textContent+=(view?.items?.length>8?' · showing 8 of '+view.items.length:'');
    strong.title='Source: ' + format(view?.source_at) + ' · Expires: ' + format(view?.expires_at);
    return {strong,state};
  }
  let busy=false,snapshot=null;
  function unavailable(message,loading=false) {
    for(const key of keys){
      const card=cards[key];badge(card,loading?'LOADING':'UNAVAILABLE');
      if(card.value)card.value.textContent=loading?'Reading saved observation…':'Observation unavailable';
      if(card.list){card.list.replaceChildren();for(const side of ['LONG','SHORT'])card.list.append(shortlist(side,null).strong);}
      card.detail.textContent=loading?'Awaiting the read-only V4 feed.':'No verified public V4 observation.';
      card.time.textContent='Observation timestamp unavailable.';card.time.removeAttribute('title');
    }
    document.getElementById('market-condition-headline').textContent='MARKET PICTURE INCOMPLETE';
    document.getElementById('market-condition-explanation').textContent=loading?'Awaiting saved market observations.':'Insufficient fresh market evidence is available to establish an overall market condition.';
    root.querySelector('.v4-market-briefing').dataset.tone='mixed';
    status.textContent=message;
  }
  function render() {
    if(!snapshot)return;
    const view=snapshot.overview, states=[];
    const breadth=view.breadth, b=breadth?.values || {};
    states.push(show('breadth',breadth,pct(b.rising_24h_pct)+' rising · '+pct(b.falling_24h_pct)+' falling',
      'Bybit · 24h · '+count(b.assets_included)+' assets · median '+pct(b.median_change_24h_pct)+(breadth?.health === 'PARTIAL'?' · partial coverage':'')));
    const fear=view.fear_greed,f=fear?.values || {};
    states.push(show('fear_greed',fear,(number(f.value) ?? 'Unknown')+' / 100',
      (['Extreme Fear','Fear','Neutral','Greed','Extreme Greed'].includes(f.classification)?f.classification:'Classification unknown')+' · Bitcoin-focused daily index'));
    const research=view.research,c=research?.counts || {};
    states.push(show('research',research,count(c.assets_evaluated_for_ranking)+' assessed for ranking',
      count(c.assets_technically_assessed)+' technical · '+count(c.eligible_pool_assets)+' eligible pool'+(research?.status === 'ATTENTION'?' · '+(reasons(research.reasons)||'research attention'):'')));
    const sentiment=view.sentiment;
    let aiState=stateOf(sentiment);
    if (!['CURRENT','CONTEXT_ONLY'].includes(sentiment?.context_state) || aiState === 'CURRENT' && (sentiment.context_state !== 'CURRENT' || sentiment.status !== 'USABLE')) aiState='UNAVAILABLE';
    const direction={UP:'Upward pressure ↗',DOWN:'Downward pressure ↘',NEUTRAL:'Neutral pressure →'}[sentiment?.market_direction] || 'Direction unknown';
    states.push(show('sentiment',sentiment,direction,aiState === 'STALE' ?
      (sentiment.context_state === 'CONTEXT_ONLY'?'CONTEXT_ONLY · stale supporting evidence.':'Assessment expired · no fresh confirmation.') : 'Current saved AI context · never trade approval.',aiState));
    marketBriefing(view,aiState);
    const lists=cards.shortlists, sides=['LONG','SHORT'].map(side=>shortlist(side,view.shortlists?.[side]));
    if(!sides.every((v,i)=>lists.list.children[i]===v.strong))lists.list.replaceChildren(...sides.map(v=>v.strong));
    const listState=sides.every(v=>v.state==='UNAVAILABLE')?'UNAVAILABLE':sides.some(v=>v.state==='STALE')?'STALE':sides.every(v=>v.state==='CURRENT')?'CURRENT':'PARTIAL';
    badge(lists,listState);states.push(listState);
    lists.detail.textContent='Rankings are research, not trade approval.';
    lists.time.textContent=['LONG','SHORT'].map(side=>side+': '+format(view.shortlists?.[side]?.source_at)+' · expires '+format(view.shortlists?.[side]?.expires_at)).join(' · ');
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
  window.refreshV4Overview=refresh;
  unavailable('Loading the read-only V4 overview…',true);refresh();
  setInterval(render,1000); // Source-provided deadlines only; no market requests.
  setInterval(()=>{if(!document.hidden)refresh();},30000);
  document.addEventListener('visibilitychange',()=>{render();if(!document.hidden)refresh();});
})();

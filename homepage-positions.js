'use strict';
// Reuse the V4 snapshot and read chart history near each completed candle.
(() => {
  const root=document.getElementById('home-demo-positions');
  if(!root)return;
  const $=id=>document.getElementById(id);
  const present=text=>window.AITerminology?.present(text)??text;
  const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=present(text);if(className)n.className=className;return n;};
  // Match the public V4 dashboard's numeric formatting and source deadlines.
  const number=value=>{
    if((typeof value!=='number' && typeof value!=='string') || (typeof value==='string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())))return null;
    const n=Number(value);return Number.isFinite(n)?n:null;
  };
  const money=value=>number(value)===null?'Unavailable':new Intl.NumberFormat('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(number(value))+' USDT';
  const price=value=>number(value)===null?'Unavailable':new Intl.NumberFormat('en-AU',{maximumSignificantDigits:8}).format(number(value));
  const stamp=value=>typeof value==='string' && Number.isFinite(Date.parse(value))?Date.parse(value):null;
  const sourceNow=()=>latestDiagnostics.estimated_server_time_ms??Date.now();
  const expired=value=>stamp(value)!==null && sourceNow()>=stamp(value);
  const date=(value,timeStyle='short')=>stamp(value)===null?'unavailable':new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle}).format(new Date(value))+' AEST';
  const availability=source=>['AVAILABLE','STALE','PARTIAL','UNAVAILABLE'].includes(source?.availability)?source.availability:'UNAVAILABLE';
  const text=value=>typeof value==='string' && value.trim()?value.slice(0,80):'Unknown';
  const tone=(node,value)=>{const n=number(value);node.dataset.pnl=n===null?'unknown':n>0?'profit':n<0?'loss':'flat';};
  const signedMoney=value=>number(value)===null?'Unavailable':(number(value)>0?'+':'')+money(value);
  const age=value=>{
    const at=stamp(value);if(at===null || at>Date.now())return 'Unavailable';
    const minutes=Math.floor((Date.now()-at)/60000);
    return minutes<1?'Under 1m':minutes<60?minutes+'m':Math.floor(minutes/60)+'h '+minutes%60+'m';
  };
  const candleInterval=900000, chartRetryInterval=30000;
  const chartStats={poll_interval_ms:candleInterval, retry_interval_ms:chartRetryInterval,
    last_attempted_refresh:null,last_successful_refresh:null,actual_interval_ms:null,request_duration_ms:null,consecutive_failures:0};
  let signature='', latestData=null, latestDiagnostics={}, chartPending=false, sortBy='pnl';
  let latestRetainedPositions=null;
  let chartKey='', lastChartAttempt=null, chartDueAt=0;
  const chartRows=new Map();
  const positionKey=p=>JSON.stringify([p.position_id??p.id,p.symbol]);
  window.v4PositionChartDiagnostics=()=>({...chartStats,next_refresh_at:chartDueAt?new Date(chartDueAt).toISOString():null,
    source_age_ms:[...chartRows.values()].map(row=>({symbol:row.symbol,age_ms:stamp(row.source_at)===null?null:sourceNow()-stamp(row.source_at)}))});
  const sorting=el('select',undefined,'home-position-sort');sorting.id='home-position-sort';sorting.setAttribute('aria-label','Sort open positions');
  for(const [value,label] of [['pnl','Unrealised P/L'],['size','Largest position size'],['loss','Largest unrealised loss'],['newest','Newest position'],['oldest','Oldest position']]){const option=el('option',label);option.value=value;sorting.append(option);}
  root.querySelector('.home-positions-heading').append(sorting);
  sorting.addEventListener('change',()=>{sortBy=sorting.value;signature='';renderView(latestData,false,latestDiagnostics);});
  const percent=value=>value===null?'Unavailable':(value>0?'+':'')+value.toFixed(2)+'%';
  const financial=p=>{
    const live=p.position_type==='BYBIT_LIVE';
    const observed=stamp(p.mark_observed_at), expires=stamp(p.mark_expires_at);
    const validTime=observed!==null&&observed<=sourceNow()&&expires!==null&&expires>observed;
    const current=validTime&&p.availability==='AVAILABLE'&&number(p.current_mark)>0&&(live||number(p.unrealized_pnl)!==null);
    const retained=validTime&&p.availability==='STALE'&&number(p.last_known_mark)>0&&(live||number(p.last_known_unrealized_pnl)!==null);
    const mark=current?number(p.current_mark):retained?number(p.last_known_mark):null;
    const fresh=current&&!expired(p.mark_expires_at)&&latestDiagnostics.display!=='RETAINED'&&!latestRetainedPositions;
    const f=p.financials||{}, net=current||retained&&live?number(f.estimated_net_pnl_usdt):null;
    const gross=current?number(p.unrealized_pnl):retained?number(p.last_known_unrealized_pnl):null;
    const margin=number(f.margin_used_usdt), qty=number(p.quantity);
    return {fresh,mark,qty,pnl:net??gross,isNet:net!==null,margin,
      size:mark===null?null:(current?number(f.position_notional_usdt):null)??(qty>0?qty*mark:null),
      pct:net!==null?number(f.estimated_net_return_pct):margin>0&&gross!==null?gross/margin*100:null};
  };
  async function requestCharts(items){
    if(document.hidden || chartPending || items.length>6)return;
    const keys=items.filter(p=>p.exchange==='bybit').map(positionKey).sort();
    const key=keys.join(',');
    if(!key)return;
    const now=sourceNow(),started=performance.now();
    if((key===chartKey && now<chartDueAt) || (lastChartAttempt!==null && started-lastChartAttempt<chartRetryInterval))return;
    chartPending=true;chartKey=key;
    const activeKeys=new Set(keys);
    for(const savedKey of chartRows.keys())if(!activeKeys.has(savedKey))chartRows.delete(savedKey);
    chartStats.actual_interval_ms=lastChartAttempt===null?null:Math.round(started-lastChartAttempt);
    chartStats.last_attempted_refresh=new Date().toISOString();
    lastChartAttempt=started;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch('https://v4.rrr.trading/v4/live/charts',{signal:controller.signal,credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}});
      if(!response.ok)throw Error('chart_request_failed');
      const value=await response.json();
      if(value?.version!=='live-position-charts-v1'||value.mode!=='bybit_live'||!Array.isArray(value.items))throw Error('invalid_chart_response');
      const received=new Set();
      const completedAt=Math.floor(now/candleInterval)*candleInterval;
      for(const row of value.items){
        if(!row || !['AVAILABLE','STALE'].includes(row.health) || row.interval_seconds!==900 || !Array.isArray(row.points) || stamp(row.source_at)===null || stamp(row.expires_at)===null)continue;
        const rowKey=positionKey(row);
        if(!activeKeys.has(rowKey))continue;
        const saved=chartRows.get(rowKey);
        if(!saved || (stamp(row.source_at)>=stamp(saved.source_at)
            && (stamp(row.points.at(-1)?.at)??0)>=(stamp(saved.points.at(-1)?.at)??0)))chartRows.set(rowKey,row);
        const entered=stamp(items.find(p=>positionKey(p)===rowKey)?.entered_at);
        const latestClose=stamp(row.points.at(-1)?.at);
        if(row.health==='AVAILABLE'&&!expired(row.expires_at)&&entered!==null
            &&(entered>completedAt || (latestClose!==null && latestClose>=completedAt)))received.add(rowKey);
      }
      if(received.size!==activeKeys.size)throw Error('chart_history_incomplete');
      chartStats.last_successful_refresh=new Date().toISOString();
      chartStats.consecutive_failures=0;
      const nextClose=(Math.floor(now/candleInterval)+1)*candleInterval;
      const expires=Math.min(...[...activeKeys].map(rowKey=>stamp(chartRows.get(rowKey).expires_at)));
      chartDueAt=Math.min(nextClose+5000,expires);
    }catch{
      chartStats.consecutive_failures++;
      chartDueAt=sourceNow()+chartRetryInterval;
    }finally{
      chartStats.request_duration_ms=Math.round(performance.now()-started);
      clearTimeout(timeout);chartPending=false;signature='';renderView(latestData,false,latestDiagnostics);
    }
  }
  function miniChart(p,{fresh,mark},activeStop){
    const block=el('div',undefined,'home-mini-chart'),plot=el('div',undefined,'home-mini-plot');
    const row=chartRows.get(positionKey(p));
    const entered=stamp(p.entered_at), observed=stamp(p.mark_observed_at);
    const markValid=mark!==null;
    const markFresh=markValid&&fresh;
    const interval=number(row?.interval_seconds)*1000;
    const points=(Array.isArray(row?.points)?row.points:[]).filter(v=>stamp(v.at)!==null&&stamp(v.at)>=entered&&stamp(v.at)<=sourceNow()&&number(v.price)>0).map(v=>({t:stamp(v.at),v:number(v.price)})).sort((a,b)=>a.t-b.t);
    const legend=el('dl',undefined,'home-chart-legend');
    for(const [kind,label,value] of [['entry','Entry',p.entry_price],['current',markValid&&!markFresh?'Mark · STALE':'Current',mark],['stop','Stop',activeStop]]){const item=el('div',undefined,'home-chart-label '+kind);item.dataset.kind=kind;item.append(el('dt',label),el('dd',number(value)>0?price(value):'—'));legend.append(item);}
    if(points.length<2 || interval!==900000){plot.append(el('span',chartPending?'Loading price history…':'Price history unavailable','home-chart-empty'));}
    else {
      legend.classList.add('is-positioned');
      const entry=number(p.entry_price),stop=number(activeStop),values=points.map(v=>v.v).concat([entry,stop,markValid?mark:null].filter(v=>v!==null&&v>0));
      let low=Math.min(...values),high=Math.max(...values);const pad=Math.max((high-low)*.1,high*.0001);low-=pad;high+=pad;
      const start=row.partial?points[0].t:Math.min(points[0].t,entered),end=Math.max(points.at(-1).t,observed||0,start+1);
      const x=t=>((t-start)/(end-start)*300).toFixed(2),y=v=>(72-(v-low)/(high-low)*68).toFixed(2);
      const labels=[['entry',entry],['current',markValid?mark:null],['stop',stop]].filter(([,value])=>value!==null&&value>0).map(([kind,value])=>({kind,target:Number(y(value))})).sort((a,b)=>a.target-b.target);
      let previous=-Infinity;for(const label of labels){label.position=Math.max(label.target,previous+14);previous=label.position;}
      if(labels.length&&labels.at(-1).position>73){const shift=labels.at(-1).position-73;for(const label of labels)label.position-=shift;}
      for(const label of labels){const item=legend.querySelector('[data-kind="'+label.kind+'"]');if(item){item.style.top=label.position+'px';item.dataset.anchorY=label.target.toFixed(2);item.dataset.labelY=label.position.toFixed(2);}}
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 300 78');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('role','img');svg.setAttribute('aria-label',p.symbol+' saved 15-minute closing prices; gaps are not interpolated');
      const shape=(tag,attrs)=>{const n=document.createElementNS(svg.namespaceURI,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);return n;};
      for(const [value,kind] of [[entry,'entry'],[stop,'stop'],[markValid?mark:null,'current']])if(value!==null&&value>0)shape('line',{x1:0,x2:300,y1:y(value),y2:y(value),class:'chart-reference '+kind,'data-price':value});
      let d='',last=null;for(const point of points){d+=(last!==null&&point.t-last<=interval*1.5?' L':' M')+x(point.t)+' '+y(point.v);last=point.t;}
      if(markFresh&&observed>=last&&observed-last<=interval*1.5&&row.health==='AVAILABLE'&&!expired(row.expires_at))
        d+=' L'+x(observed)+' '+y(mark);
      shape('path',{d,class:'chart-price'});
      if(markValid)shape('circle',{cx:x(observed),cy:y(mark),r:3.5,class:'chart-current','data-price':mark});
      plot.append(svg);
    }
    block.append(plot,legend);
    const historyNote=row?'15m closes · '+(row.partial?'Partial history · ':'')+(expired(row.expires_at)||row.health!=='AVAILABLE'?'STALE · ':'')+'Source: '+date(row.source_at):'Historical prices are unavailable; no path inferred.';
    const currentNote=markFresh?'Current price · '+date(p.mark_observed_at,'medium'):markValid?'Last mark · STALE · '+date(p.mark_observed_at,'medium'):'Current price unavailable';
    const refreshNote=chartStats.consecutive_failures?' · Latest history refresh incomplete':'';
    const note=el('small',historyNote+' · '+currentNote+refreshNote,'home-chart-note');
    const wrap=el('div',undefined,'home-chart-section');wrap.append(block,note);return wrap;
  }
  function render(data,loading=false,diagnostics={}) {
    latestData=data;
    const source=latestRetainedPositions??data?.open_positions, wallet=data?.wallet;
    window.dispatchEvent(new CustomEvent('rrr-v4-home-position-snapshot',{detail:{data,diagnostics}}));
    const items=Array.isArray(source?.items)?source.items:null;
    const live=data?.version==='live-read-api-v1'&&data.mode==='bybit_live';
    const invalid=!(live||data?.version==='paper-read-api-v1'&&data.mode==='paper') ||
      (source?.mode && source.mode!==data.mode) || (wallet?.mode && wallet.mode!==data.mode) ||
      items?.some(p=>!p || typeof p!=='object' || Array.isArray(p) || (p.mode && p.mode!==data.mode));
    const valuations=invalid?[]:items?.map(financial)||[];
    if(!invalid && items?.length && !latestRetainedPositions)requestCharts(items);
    const key=JSON.stringify([data,latestRetainedPositions,loading,diagnostics.display,diagnostics.state,valuations.map(f=>f.fresh),expired(wallet?.valuation_expires_at),expired(source?.expires_at),
      [...chartRows.values()].map(row=>expired(row.expires_at)),Math.floor(sourceNow()/60000)]);
    if(signature===key)return;signature=key;
    const state=invalid || !items || availability(source)==='UNAVAILABLE'?'UNAVAILABLE':
      latestRetainedPositions||diagnostics.display==='RETAINED'||(live&&expired(source.expires_at))?'STALE':source.inventory_availability==='AVAILABLE'?'AVAILABLE':availability(source);
    const badgeState=state==='AVAILABLE'&&(valuations.some(f=>!f.fresh)||expired(wallet?.valuation_expires_at)||availability(wallet)==='STALE')?'STALE VALUATION':state;
    const stateNode=$('home-positions-state');stateNode.textContent=loading?'LOADING':badgeState;stateNode.dataset.state=loading?'LOADING':badgeState==='STALE VALUATION'?'STALE':badgeState;
    $('home-position-time').textContent='Source: '+date(invalid?null:wallet?.as_of)+' · API read: '+date(invalid?null:data.served_at)+(state==='STALE'?' · STALE / historical positions':'');
    const list=$('home-position-list'), expanded=new Set([...list.querySelectorAll('.home-position:has(details[open])')].map(n=>n.dataset.positionKey));list.replaceChildren();
    if(state==='UNAVAILABLE' || !items.length){
      list.append(el('p',loading?'Loading positions…':state==='UNAVAILABLE'?'Positions Unavailable':state==='STALE'?'STALE · Last saved snapshot recorded zero positions. Current positions unknown.':live?'No Open Bybit Positions':'No Open Demo Positions','home-position-empty'));return;
    }
    const sorted=items.map((p,i)=>({p,f:valuations[i]})).sort((a,b)=>{const value=({p,f})=>sortBy==='size'?f.size:sortBy==='newest'||sortBy==='oldest'?stamp(p.entered_at):f.pnl;const va=value(a),vb=value(b),ascending=sortBy==='loss'||sortBy==='oldest';return va===null?1:vb===null?-1:ascending?va-vb:vb-va;});
    for(const {p,f} of sorted){
      const {fresh}=f;
      const card=el('article',undefined,'home-position');card.dataset.positionKey=p.id||p.symbol;
      const head=el('div',undefined,'home-position-identity');
      const symbol=text(p.symbol), base=/^[A-Z0-9]{1,40}$/.test(symbol)?symbol.replace(/USDT$/,''):null;
      card.setAttribute('role','group');
      const logo=el('span',undefined,'home-position-logo');
      if(base && window.AssetLogo){const asset=window.AssetLogo.create(base,'home-position-image','home-position-monogram',36);logo.append(asset.image,asset.fallback);}
      else logo.append(el('span','?','home-position-monogram'));
      const identity=el('div',undefined,'home-position-name');const heading=el('h3',symbol);heading.dataset.assetAnalysisSymbol=symbol;
      const typeLabels={BYBIT_LIVE:'BYBIT LIVE',STANDALONE_PAPER:'STANDALONE PAPER',PAIRED_PAPER:'PAIRED PAPER · BYBIT LINK',MANUAL_BYBIT_MIRROR:'BYBIT LIVE · PAPER MIRROR'};
      identity.append(heading,el('small',typeLabels[p.position_type]||'POSITION SOURCE UNKNOWN','home-position-type'));
      const side=el('span',['LONG','SHORT'].includes(p.side)?p.side:'UNKNOWN','home-position-side');side.dataset.side=side.textContent;
      const timing=el('div',undefined,'home-position-timing');
      const elapsed=el('strong',age(p.entered_at));elapsed.title='Entered: '+date(p.entered_at);
      timing.append(elapsed,el('small','since entry'));
      head.append(logo,identity,side,timing);
      const details=el('div',undefined,'home-position-financial');
      const profit=el('div',undefined,'home-position-profit');
      const pnl=el('strong');
      if(f.pnl!==null){const formatted=signedMoney(f.pnl),amount=formatted.replace(/ USDT$/,'');pnl.append(el('span',amount,'home-position-pnl-value'),el('span','USDT','home-position-pnl-currency'));}
      else pnl.textContent='—';
      const stale=f.mark!==null&&!fresh?' · STALE':'';
      profit.append(el('span',(f.isNet?'Net Unrealised P/L (est.)':'Gross Unrealised P/L')+stale),pnl,el('small',f.pct!==null?percent(f.pct)+(f.isNet?' return (est. net)':' gross return'):'—','home-position-pnl-percent'));tone(profit,f.pnl);
      const fields=el('dl',undefined,'home-position-allocation');
      for(const [label,value] of [['Position Size',money(f.size)+stale],['Quantity',f.qty>0?price(f.qty):'Unavailable'],['Margin Used',money(f.margin)],['Leverage',number(p.leverage)>0?price(p.leverage)+'×':'Unavailable']]){const item=el('div');item.append(el('dt',label),el('dd',value));fields.append(item);}
      details.append(profit,fields);
      const updated=el('p',f.mark===null?'Mark unavailable':(fresh?'Mark observed: ':'STALE · Last mark observed: ')+date(p.mark_observed_at,'medium'),'home-position-observed');
      const protection=p.protection || {};
      const knownStatus=['PROTECTED','ORIGINAL STOP'].includes(protection.status)?protection.status:'UNKNOWN';
      const summary=el('div',undefined,'home-position-protection');
      const active=number(protection.active_stop), mark=fresh?number(p.current_mark):null;
      const lastStop=live&&(!fresh||state==='STALE')?number(protection.last_verified_stop):null;
      const validStop=(!live||fresh)&&['PROTECTED','ORIGINAL STOP'].includes(knownStatus)&&active>0&&['LONG','SHORT'].includes(p.side)&&number(p.quantity)>0&&number(p.entry_price)>0;
      const stopNet=validStop?number(p.financials?.estimated_net_stop_pnl_usdt):null;
      const statusName=validStop?(stopNet>0?'PROFIT LOCKED':'STOP ACTIVE'):
        p.position_type==='BYBIT_LIVE'?(state==='AVAILABLE'&&knownStatus==='PROTECTED'?'STOP VERIFIED':'STOP UNVERIFIED'):'UNPROTECTED';
      const status=el('span',statusName,'home-protection-status');status.dataset.status=statusName;
      const review=p.sol_review;
      const successfulDecision=value=>['HOLD','PROTECT','REDUCE','EXIT'].includes(value)?value:null;
      // sol_review is the full, position-ID-scoped API projection. Older or
      // partial snapshots can omit its success fields while protection still
      // carries the validated receipt for this same position.
      const reviewDecision=successfulDecision(review?.decision);
      const receiptDecision=successfulDecision(protection.latest_decision);
      const reviewAt=stamp(review?.reviewed_at)!==null?review.reviewed_at:
        stamp(review?.evaluated_at)!==null?review.evaluated_at:null;
      const receiptAt=stamp(protection.last_successful_review_at)!==null?protection.last_successful_review_at:null;
      const bybitOwned=review?.source==='BYBIT_LIVE'||review?.latest_attempt?.review_owner==='BYBIT_LIVE';
      const useReceipt=!bybitOwned&&(reviewDecision===null||reviewAt===null)&&receiptDecision!==null&&receiptAt!==null&&
        (reviewDecision===null||reviewDecision===receiptDecision);
      const decision=reviewDecision??(useReceipt?receiptDecision:null);
      const reviewedAt=reviewAt??(useReceipt?receiptAt:null);
      const executionResult=review?.execution??(useReceipt?protection.review_result:null);
      const outcome={STOP_ADJUSTED:'applied',RECOMMENDATION_ONLY:'recommendation only',BLOCKED:'proposal rejected',
        NOT_REQUESTED:'no adjustment requested',EXECUTED:'executed',SUPERSEDED_BY_PROTECTION:'superseded by protection'}[executionResult] || 'execution not recorded';
      const stop=value=>number(value)===null?'UNKNOWN':price(value);
      const reviewedMs=stamp(reviewedAt),enteredMs=stamp(p.entered_at);
      const recordedReview=decision!==null&&reviewedMs!==null&&enteredMs!==null&&reviewedMs<=sourceNow()&&reviewedMs>=enteredMs;
      const freshness=review?.freshness==='STALE'||expired(review?.fresh_until)?'STALE':review?.freshness==='CURRENT'?'CURRENT':'RECORDED';
      const attempt=review?.latest_attempt?.status;
      const failedAttempt=['FAILED','BLOCKED','UNAVAILABLE'].includes(attempt);
      const missing=failedAttempt?'REVIEW FAILED':'AWAITING REVIEW';
      const bybitDecision=decision==='EXIT'?'EXIT ADVISED':
        decision==='PROTECT'&&executionResult==='STOP_ADJUSTED'?'STOP UPDATED':decision;
      const label=bybitOwned?(failedAttempt?'REVIEW FAILED':recordedReview?
        bybitDecision+(freshness==='STALE'?' · STALE':''):'BYBIT REVIEW PENDING'):
        failedAttempt?'REVIEW FAILED':recordedReview&&freshness==='STALE'?'REVIEW STALE':
        recordedReview?decision:attempt?missing:'NOT REVIEWED';
      const ai=el('span',p.position_type==='BYBIT_LIVE'&&!recordedReview?
        p.entry_authority==='SOL'?'AI-INITIATED TRADE':p.entry_authority==='MANUAL'?'MANUAL BYBIT ENTRY':'ENTRY SOURCE UNAVAILABLE':
        'AI: '+label,'home-ai-decision');
      ai.title=recordedReview?'Last successful AI review: '+date(reviewedAt,'medium')+' · '+age(reviewedAt)+' ago · '+outcome:
        bybitOwned?(failedAttempt?'Latest Bybit AI review failed':'Waiting for a completed Bybit AI review'):
        attempt?'Latest review attempt: '+attempt.toLowerCase():'No completed AI review recorded';
      summary.append(status,ai);
      const reviewNote=el('p',(recordedReview?'AI '+freshness.toLowerCase()+' decision · ':'No completed AI review recorded. ')+
        (attempt&&attempt!=='COMPLETED'?'Latest attempt: '+attempt.toLowerCase()+' · ':'')+
        (executionResult==='BLOCKED'?'Execution blocked · decision retained':outcome),'home-position-review-outcome');
      const distance=validStop&&mark>0?(p.side==='LONG'?mark-active:active-mark)/mark*100:null;
      const stopLine=el('p','Stop: '+(validStop?price(active):lastStop>0?price(lastStop)+' (last verified)':'Unavailable')+' | Distance: '+(distance===null?'Unavailable':distance.toFixed(2)+'%')+' | Est. net P/L if stopped: '+signedMoney(stopNet),'home-position-stopline');
      const extra=el('details',undefined,'home-protection-details');extra.open=expanded.has(p.id||p.symbol);extra.append(el('summary','Protection details'));
      const values=el('dl',undefined,'home-protection-fields');
      const field=(label,value)=>{const block=el('div');block.append(el('dt',label),el('dd',value));values.append(block);};
      field('Estimated Stop P/L',number(protection.estimated_stop_pnl_usdt)===null?'—':signedMoney(protection.estimated_stop_pnl_usdt));
      field('Original Stop',stop(protection.original_stop));
      const reviewed=el('p','Last reviewed: '+(recordedReview?date(reviewedAt)+' · '+age(reviewedAt)+' ago':'—'),'home-position-reviewed');
      extra.append(reviewNote,stopLine,values,el('p','Detailed stop estimate above is gross, before fees and slippage. The net estimate uses recorded fees and assumes execution at the stop; slippage can cause losses.','home-protection-note'),reviewed);
      // Estimates are supplied by the read-only projection; the account ledger is unchanged.
      card.append(head,details,miniChart(p,f,validStop?active:lastStop),summary,extra,updated);list.append(card);
    }
  }
  function renderView(data,loading=false,diagnostics={},retainedPositions=latestRetainedPositions) {
    latestRetainedPositions=retainedPositions;
    latestDiagnostics=diagnostics;
    render(data,loading,diagnostics);
    const retained=diagnostics.display==='RETAINED'||Boolean(latestRetainedPositions);
    root.dataset.display=retained?'RETAINED':diagnostics.display||'UNAVAILABLE';
    root.dataset.refreshState=diagnostics.state||'LOADING';
    if(!loading && diagnostics.state) {
      const sectionNotes=Object.entries(diagnostics.sections||{}).filter(([,item])=>item?.availability!=='AVAILABLE')
        .map(([name,item])=>name.replaceAll('_',' ')+': '+(item?.reason||item?.availability||'unavailable')).join(' · ');
      const label=(retained?'Refresh failed · Showing last received data · '+diagnostics.state:diagnostics.display==='UNAVAILABLE'?'Snapshot unavailable · '+diagnostics.state:
        diagnostics.display==='PARTIAL'?'PARTIAL · Independently validated sections':diagnostics.state==='DATA_STALE'?'Valuation stale · Ledger received':'Ledger received')+
        (sectionNotes?' · '+sectionNotes:'')+' · Source: '+date(diagnostics.source_timestamp)+' · Refreshed: '+date(diagnostics.last_successful_refresh);
      $('home-position-time').textContent=label;
    }
  }
  window.HomeDemoPositions=Object.freeze({render:renderView});
})();

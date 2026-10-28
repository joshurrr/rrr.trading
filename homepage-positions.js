'use strict';
// Reuse the V4 snapshot; price history uses one cached read-only request per five minutes.
(() => {
  const root=document.getElementById('home-demo-positions');
  if(!root)return;
  const $=id=>document.getElementById(id);
  const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
  // Match the public V4 dashboard's numeric formatting and source deadlines.
  const number=value=>{
    if((typeof value!=='number' && typeof value!=='string') || (typeof value==='string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())))return null;
    const n=Number(value);return Number.isFinite(n)?n:null;
  };
  const money=value=>number(value)===null?'Unavailable':new Intl.NumberFormat('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(number(value))+' USDT';
  const price=value=>number(value)===null?'Unavailable':new Intl.NumberFormat('en-AU',{maximumSignificantDigits:8}).format(number(value));
  const stamp=value=>typeof value==='string' && Number.isFinite(Date.parse(value))?Date.parse(value):null;
  const expired=value=>stamp(value)!==null && Date.now()>=stamp(value);
  const date=value=>stamp(value)===null?'unavailable':new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'}).format(new Date(value))+' AEST';
  const availability=source=>['AVAILABLE','STALE','PARTIAL','UNAVAILABLE'].includes(source?.availability)?source.availability:'UNAVAILABLE';
  const text=value=>typeof value==='string' && value.trim()?value.slice(0,80):'Unknown';
  const tone=(node,value)=>{const n=number(value);node.dataset.pnl=n===null?'unknown':n>0?'profit':n<0?'loss':'flat';};
  const signedMoney=value=>number(value)===null?'Unavailable':(number(value)>0?'+':'')+money(value);
  const cents=value=>Math.round(value*100);
  function portfolioMetrics(data,loading=false) {
    const total=$('home-total-pnl'),recorded=$('home-realized-pnl'),recordedNote=$('home-realized-pnl-note');
    const wallet=data?.wallet,fields=wallet?.field_availability||{};
    const validSnapshot=data?.version==='paper-read-api-v1' && data?.mode==='paper' && (!wallet?.mode || wallet.mode==='paper');
    const valid=validSnapshot && availability(wallet)!=='UNAVAILABLE' &&
      ['wallet_balance','equity','realized_pnl','unrealized_pnl','entry_fees_paid','exit_fees_paid'].every(key=>fields[key]==='AVAILABLE') &&
      !expired(wallet?.valuation_expires_at);
    const values=valid?['wallet_balance','equity','realized_pnl','unrealized_pnl','entry_fees_paid','exit_fees_paid'].map(key=>number(wallet[key])):[];
    const reconciles=values.length===6 && values.every(value=>value!==null) && values[4]>=0 && values[5]>=0 &&
      Math.abs(values[1]-values[0]-values[3])<=0.0100001;
    // V4's realised/unrealised fields are gross; subtract both recorded fee totals for net account P/L.
    const overall=reconciles?values[2]+values[3]-values[4]-values[5]:null;
    total.textContent=loading&&!data?'Loading…':signedMoney(overall);
    total.dataset.state=overall===null?'unavailable':'available';
    total.dataset.tone=overall===null?'neutral':overall>0?'up':overall<0?'down':'neutral';
    const history=data?.completed_trades,asOf=stamp(history?.as_of),ledgerRealized=number(wallet?.realized_pnl);
    const rows=history?.items;
    let recordedPnl=null, activity=null;
    const realizedState=availability(wallet)==='UNAVAILABLE'?'UNAVAILABLE':fields.realized_pnl||availability(wallet);
    if(validSnapshot && ['AVAILABLE','PARTIAL'].includes(availability(history)) && asOf!==null && asOf<=Date.now() && Array.isArray(rows)) {
      const validRows=rows.filter(row=>row && typeof row==='object' && !Array.isArray(row) && stamp(row.closed_at)!==null &&
        stamp(row.closed_at)<=asOf && number(row.realized_pnl)!==null && number(row.entry_price)>0 && number(row.exit_price)>0 &&
        stamp(row.entered_at)!==null && stamp(row.entered_at)<=stamp(row.closed_at) && typeof row.symbol==='string' && row.symbol.trim() && ['LONG','SHORT'].includes(row.side));
      const recent=validRows.filter(row=>stamp(row.closed_at)>Date.now()-86400000 && stamp(row.closed_at)<=asOf);
      const historyComplete=availability(history)==='AVAILABLE' && validRows.length===rows.length && realizedState==='AVAILABLE' && ledgerRealized!==null &&
        Math.abs(cents(validRows.reduce((sum,row)=>sum+number(row.realized_pnl),0))-cents(ledgerRealized))<=1;
      if(historyComplete)recordedPnl=recent.reduce((sum,row)=>sum+number(row.realized_pnl),0);
      const closedTrades=[...recent].sort((a,b)=>stamp(b.closed_at)-stamp(a.closed_at));
      const outcomesComplete=historyComplete&&recent.every(row=>number(row.net_pnl)!==null);
      const wins=outcomesComplete?recent.filter(row=>number(row.net_pnl)>0).length:null;
      const losses=outcomesComplete?recent.filter(row=>number(row.net_pnl)<0).length:null;
      const breakeven=outcomesComplete?recent.length-wins-losses:null;
      activity={availability:historyComplete?'AVAILABLE':closedTrades.length?'PARTIAL':'UNAVAILABLE',asOf:history.as_of,completed:recent.length,wins,losses,breakeven,
        winRate:outcomesComplete&&wins+losses?wins/(wins+losses)*100:null,realizedPnl:recordedPnl,trades:closedTrades,
        reason:history.reasons?.[0]||(!historyComplete?'History completeness or ledger reconciliation unavailable':null)};
    }
    recorded.textContent=loading&&!data?'Loading…':signedMoney(recordedPnl);
    recorded.dataset.state=recordedPnl===null?'unavailable':'available';
    recorded.dataset.tone=recordedPnl===null?'neutral':recordedPnl>0?'up':recordedPnl<0?'down':'neutral';
    recordedNote.textContent=recordedPnl===null?'Complete, reconciled V4 trade history unavailable.':'Gross realised P/L · rolling 24h · ledger history reconciled.';
    return activity || {availability:'UNAVAILABLE',asOf:history?.as_of||null};
  }
  function walletMetric(data,key,valueId,noteId,loading=false) {
    const wallet=data?.wallet, valid=data?.version==='paper-read-api-v1' && data?.mode==='paper' && (!wallet?.mode || wallet.mode==='paper');
    const expiredValuation=key==='equity' && expired(wallet?.valuation_expires_at);
    const field=valid ? (availability(wallet)==='UNAVAILABLE'?'UNAVAILABLE':wallet?.field_availability?.[key] || availability(wallet)) : 'UNAVAILABLE';
    const state=expiredValuation && field==='AVAILABLE'?'STALE':field;
    const fresh=state==='AVAILABLE', value=fresh?wallet?.[key]:null;
    const target=$(valueId), note=$(noteId);
    target.textContent=loading && !data?'Loading…':money(value);tone(target,key==='realized_pnl'?value:null);
    const label=key==='wallet_balance' || key==='realized_pnl'?'Ledger saved ':'Valuation saved ';
    note.textContent=state==='STALE'?'STALE · Last known: '+money(wallet?.last_known?.[key]):
      fresh?label+date(wallet?.as_of):loading && !data?'Awaiting validated public wallet snapshot.':'Wallet field unavailable in the public snapshot.';
  }
  function renderWallet(data,loading=false) {
    walletMetric(data,'equity','home-equity','home-equity-note',loading);
    walletMetric(data,'wallet_balance','home-wallet-balance','home-wallet-balance-note',loading);
    walletMetric(data,'realized_pnl','home-wallet-realized','home-wallet-realized-note',loading);
  }
  const age=value=>{
    const at=stamp(value);if(at===null || at>Date.now())return 'Unavailable';
    const minutes=Math.floor((Date.now()-at)/60000);
    return minutes<1?'Under 1m':minutes<60?minutes+'m':Math.floor(minutes/60)+'h '+minutes%60+'m';
  };
  let signature='', latestData=null, latestDiagnostics={}, chartData=null, chartRequestedAt=0, chartPending=false, sortBy='pnl';
  const sorting=el('select',undefined,'home-position-sort');sorting.id='home-position-sort';sorting.setAttribute('aria-label','Sort open positions');
  for(const [value,label] of [['pnl','Unrealised P/L'],['size','Largest position size'],['loss','Largest unrealised loss'],['newest','Newest position'],['oldest','Oldest position']]){const option=el('option',label);option.value=value;sorting.append(option);}
  root.querySelector('.home-positions-heading').append(sorting);
  const summaryMetrics=root.querySelector('.home-position-metrics');
  for(const [id,label] of [['home-position-directions','SHORT / LONG'],['home-position-average','Average return']]){const block=el('div');const value=el('strong','Unavailable');value.id=id;block.append(el('span',label),value);summaryMetrics.append(block);}
  sorting.addEventListener('change',()=>{sortBy=sorting.value;signature='';renderView(latestData,false,latestDiagnostics);});
  const percent=value=>value===null?'Unavailable':(value>0?'+':'')+value.toFixed(2)+'%';
  const financial=p=>{
    const fresh=p.availability==='AVAILABLE'&&!expired(p.mark_expires_at);
    const f=p.financials||{}, net=fresh?number(f.estimated_net_pnl_usdt):null;
    const gross=fresh?number(p.unrealized_pnl):null;
    const margin=number(f.margin_used_usdt), qty=number(p.quantity), mark=fresh?number(p.current_mark):null;
    return {net,pnl:net??gross,isNet:net!==null,margin,
      size:fresh?(number(f.position_notional_usdt)??(qty>0&&mark>0?qty*mark:null)):null,
      pct:fresh?(net!==null?number(f.estimated_net_return_pct):margin>0&&gross!==null?gross/margin*100:null):null};
  };
  function requestCharts(data){
    if(chartPending || Date.now()-chartRequestedAt<300000 || !data?.open_positions?.items?.length)return;
    chartPending=true;chartRequestedAt=Date.now();
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    fetch('https://v4.rrr.trading/v4/paper/charts',{signal:controller.signal,credentials:'omit',headers:{Accept:'application/json'}})
      .then(r=>{if(!r.ok)throw Error('unavailable');return r.json();})
      .then(value=>{chartData=value?.version==='paper-position-charts-v1'&&value.mode==='paper'?value:null;})
      .catch(()=>{chartData=null;}).finally(()=>{clearTimeout(timeout);chartPending=false;signature='';renderView(latestData,false,latestDiagnostics);});
  }
  function miniChart(p,fresh,activeStop){
    const block=el('div',undefined,'home-mini-chart'),plot=el('div',undefined,'home-mini-plot');
    const row=chartData?.items?.find(v=>v.position_id&&v.position_id===p.id&&v.symbol===p.symbol);
    const entered=stamp(p.entered_at), observed=stamp(p.mark_observed_at), mark=number(p.current_mark);
    const markValid=mark!==null&&mark>0&&observed!==null&&observed<=Date.now();
    const markFresh=markValid&&fresh;
    const interval=number(row?.interval_seconds)*1000;
    const points=(Array.isArray(row?.points)?row.points:[]).filter(v=>stamp(v.at)!==null&&stamp(v.at)>=entered&&stamp(v.at)<=Date.now()&&number(v.price)>0).map(v=>({t:stamp(v.at),v:number(v.price)})).sort((a,b)=>a.t-b.t);
    const legend=el('dl',undefined,'home-chart-legend');
    for(const [label,value] of [['Entry',p.entry_price],['Current'+(markValid&&!markFresh?' · STALE':markFresh?' · '+age(p.mark_observed_at):''),markValid?mark:null],['Stop',activeStop]]){const item=el('div');item.append(el('dt',label),el('dd',number(value)>0?price(value):'—'));legend.append(item);}
    if(points.length<2 || interval!==900000){plot.append(el('span',chartPending?'Loading price history…':'Price history unavailable','home-chart-empty'));}
    else {
      const entry=number(p.entry_price),stop=number(activeStop),values=points.map(v=>v.v).concat([entry,stop,markValid?mark:null].filter(v=>v!==null&&v>0));
      let low=Math.min(...values),high=Math.max(...values);const pad=Math.max((high-low)*.1,high*.0001);low-=pad;high+=pad;
      const start=row.partial?points[0].t:Math.min(points[0].t,entered),end=Math.max(points.at(-1).t,observed||0,start+1);
      const x=t=>((t-start)/(end-start)*300).toFixed(2),y=v=>(72-(v-low)/(high-low)*68).toFixed(2);
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 300 78');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('role','img');svg.setAttribute('aria-label',p.symbol+' saved 15-minute closing prices; gaps are not interpolated');
      const shape=(tag,attrs)=>{const n=document.createElementNS(svg.namespaceURI,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);return n;};
      for(const [value,kind] of [[entry,'entry'],[stop,'stop'],[markValid?mark:null,'current']])if(value!==null&&value>0)shape('line',{x1:0,x2:300,y1:y(value),y2:y(value),class:'chart-reference '+kind,'data-price':value});
      let d='',last=null;for(const point of points){d+=(last!==null&&point.t-last<=interval*1.5?' L':' M')+x(point.t)+' '+y(point.v);last=point.t;}
      shape('path',{d,class:'chart-price'});
      if(markValid)shape('circle',{cx:x(observed),cy:y(mark),r:3.5,class:'chart-current','data-price':mark});
      plot.append(svg);
    }
    block.append(plot,legend);
    const historyNote=row?'15m closes · '+(row.partial?'Partial history · ':'')+(expired(row.expires_at)||row.health!=='AVAILABLE'?'STALE · ':'')+'Source: '+date(row.source_at):'Historical prices are unavailable; no path inferred.';
    const currentNote=markFresh?'Current price · '+date(p.mark_observed_at):markValid?'Current price STALE · Last observed '+date(p.mark_observed_at):'Current price '+(observed===null?'UNAVAILABLE':'UNAVAILABLE · '+date(p.mark_observed_at));
    const note=el('small',historyNote+' · '+currentNote,'home-chart-note');
    const wrap=el('div',undefined,'home-chart-section');wrap.append(block,note);return wrap;
  }
  function render(data,loading=false,diagnostics={}) {
    latestData=data;
    const source=data?.open_positions, wallet=data?.wallet;
    renderWallet(data,loading);
    const activity=portfolioMetrics(data,loading);
    activity.display=diagnostics.display;
    activity.snapshot_timestamp=diagnostics.snapshot_timestamp;
    window.dispatchEvent(new CustomEvent('rrr-v4-completed-trade-activity',{detail:activity}));
    const items=Array.isArray(source?.items)?source.items:null;
    const invalid=!data || data.version!=='paper-read-api-v1' || data.mode!=='paper' ||
      (source?.mode && source.mode!=='paper') || (wallet?.mode && wallet.mode!=='paper') ||
      items?.some(p=>!p || typeof p!=='object' || Array.isArray(p) || (p.mode && p.mode!=='paper'));
    const expiredMarks=Boolean(items?.some(p=>expired(p.mark_expires_at)));
    const key=JSON.stringify([data,loading,diagnostics.display,diagnostics.state,expiredMarks,expired(wallet?.valuation_expires_at),Math.floor(Date.now()/60000)]);
    if(signature===key)return;signature=key;
    const state=invalid || !items || availability(source)==='UNAVAILABLE'?'UNAVAILABLE':source.inventory_availability==='AVAILABLE'?'AVAILABLE':availability(source);
    const badgeState=state==='AVAILABLE'&&(expiredMarks||expired(wallet?.valuation_expires_at)||availability(wallet)==='STALE')?'STALE VALUATION':state;
    const stateNode=$('home-positions-state');stateNode.textContent=loading?'LOADING':badgeState;stateNode.dataset.state=loading?'LOADING':badgeState==='STALE VALUATION'?'STALE':badgeState;
    $('home-position-count').textContent=state==='UNAVAILABLE'?'Unavailable':String(items.length)+(state==='STALE'?' · historical':state==='PARTIAL'?' · validated rows':'');
    const field=availability(wallet)==='UNAVAILABLE'?'UNAVAILABLE':wallet?.field_availability?.unrealized_pnl || availability(wallet);
    const valuationState=invalid?'UNAVAILABLE':expiredMarks || expired(wallet?.valuation_expires_at)?'STALE':field;
    const pnl=valuationState==='AVAILABLE'?wallet?.unrealized_pnl:null;
    $('home-position-pnl').previousElementSibling.textContent='Gross unrealised P/L';
    $('home-position-pnl').textContent=money(pnl);tone($('home-position-pnl'),pnl);
    $('home-position-valuation').textContent=valuationState==='STALE'?'STALE · Last known: '+money(wallet?.last_known?.unrealized_pnl):
      valuationState==='AVAILABLE'?'Wallet valuation saved: '+date(wallet?.as_of):'Wallet valuation unavailable.';
    $('home-position-time').textContent='Source: '+date(invalid?null:wallet?.as_of)+' · API read: '+date(invalid?null:data.served_at)+(state==='STALE'?' · STALE / historical positions':'');
    const list=$('home-position-list'), expanded=new Set([...list.querySelectorAll('.home-position:has(details[open])')].map(n=>n.dataset.positionKey));list.replaceChildren();
    if($('home-position-directions'))$('home-position-directions').textContent=state==='UNAVAILABLE'?'Unavailable':'0 SHORT / 0 LONG';
    if($('home-position-average'))$('home-position-average').textContent='Unavailable';
    if(state==='UNAVAILABLE' || !items.length){
      list.append(el('p',loading?'Loading saved demo positions…':state==='UNAVAILABLE'?'Positions Unavailable':state==='STALE'?'STALE · Last saved snapshot recorded zero positions. Current positions unknown.':'No Open Demo Positions','home-position-empty'));return;
    }
    requestCharts(data);
    const metrics=items.map(financial), allNet=state==='AVAILABLE'&&metrics.every(v=>v.isNet);
    const total=state==='AVAILABLE'&&metrics.every(v=>v.pnl!==null)?metrics.reduce((sum,v)=>sum+v.pnl,0):null;
    const avg=state==='AVAILABLE'&&metrics.every(v=>v.pct!==null)&&metrics.every(v=>v.isNet===allNet)?metrics.reduce((sum,v)=>sum+v.pct,0)/items.length:null;
    $('home-position-pnl').textContent=signedMoney(allNet?total:pnl);tone($('home-position-pnl'),allNet?total:pnl);
    $('home-position-pnl').previousElementSibling.textContent=allNet?'Est. net unrealised P/L':'Gross unrealised P/L';
    if(allNet)$('home-position-valuation').textContent='Entry + estimated closing fees included';
    const counts=$('home-position-directions'),average=$('home-position-average');
    counts.textContent=items.filter(p=>p.side==='SHORT').length+' SHORT / '+items.filter(p=>p.side==='LONG').length+' LONG';average.textContent=percent(avg)+(avg===null?'':allNet?' net (est.)':' gross');
    const sorted=[...items].sort((a,b)=>{const fa=financial(a),fb=financial(b);const ascending=sortBy==='loss'||sortBy==='oldest';const va=sortBy==='size'?fa.size:sortBy==='newest'||sortBy==='oldest'?stamp(a.entered_at):fa.pnl;const vb=sortBy==='size'?fb.size:sortBy==='newest'||sortBy==='oldest'?stamp(b.entered_at):fb.pnl;return va===null?1:vb===null?-1:ascending?va-vb:vb-va;});
    for(const p of sorted){
      const fresh=['AVAILABLE','PARTIAL'].includes(state) && p.availability==='AVAILABLE' && !expired(p.mark_expires_at);
      const card=el('article',undefined,'home-position');card.dataset.positionKey=p.id||p.symbol;
      const head=el('div',undefined,'home-position-identity');
      const symbol=text(p.symbol), base=/^[A-Z0-9]{1,40}$/.test(symbol)?symbol.replace(/USDT$/,''):null;
      card.tabIndex=0;card.setAttribute('role','group');card.setAttribute('aria-haspopup','dialog');card.setAttribute('aria-label',`View Asset Analysis for ${symbol}`);
      const logo=el('span',undefined,'home-position-logo');
      if(base && window.AssetLogo){const asset=window.AssetLogo.create(base,'home-position-image','home-position-monogram',36);logo.append(asset.image,asset.fallback);}
      else logo.append(el('span','?','home-position-monogram'));
      const identity=el('div',undefined,'home-position-name');identity.append(el('h3',symbol),el('small',(p.exchange==='bybit'?'Bybit':text(p.exchange))+' · DEMO'));
      const side=el('span',['LONG','SHORT'].includes(p.side)?p.side:'UNKNOWN','home-position-side');side.dataset.side=side.textContent;
      const timing=el('div',undefined,'home-position-timing');
      const elapsed=el('strong',age(p.entered_at));elapsed.title='Entered: '+date(p.entered_at);
      timing.append(elapsed,el('small','since entry'));
      head.append(logo,identity,side,timing);
      const f=financial(fresh?p:{...p,availability:'STALE'});
      const details=el('div',undefined,'home-position-financial');
      const profit=el('div',undefined,'home-position-profit');
      profit.append(el('span',f.isNet?'Net Unrealised P/L (est.)':'Gross Unrealised P/L'),el('strong',fresh?signedMoney(f.pnl):'—'),el('small',fresh?percent(f.pct)+(f.isNet?' return (est. net)':' gross return'):'—','home-position-pnl-percent'));tone(profit,fresh?f.pnl:null);
      const fields=el('dl',undefined,'home-position-allocation');
      for(const [label,value] of [['Position Size',money(f.size)],['Margin Used',money(f.margin)],['Leverage',number(p.leverage)>0?price(p.leverage)+'×':'Unavailable']]){const item=el('div');item.append(el('dt',label),el('dd',value));fields.append(item);}
      details.append(profit,fields);
      const updated=el('p',(fresh?'Mark observed: ':'STALE / unavailable mark · Last observed: ')+date(p.mark_observed_at),'home-position-observed');
      const protection=p.protection || {};
      const knownStatus=['PROTECTED','ORIGINAL STOP'].includes(protection.status)?protection.status:'UNKNOWN';
      const summary=el('div',undefined,'home-position-protection');
      const active=number(protection.active_stop), mark=fresh?number(p.current_mark):null;
      const validStop=['PROTECTED','ORIGINAL STOP'].includes(knownStatus)&&active>0&&['LONG','SHORT'].includes(p.side)&&number(p.quantity)>0&&number(p.entry_price)>0;
      const stopNet=validStop?number(p.financials?.estimated_net_stop_pnl_usdt):null;
      const statusName=validStop?(stopNet>0?'PROFIT LOCKED':'STOP ACTIVE'):'UNPROTECTED';
      const status=el('span',statusName,'home-protection-status');status.dataset.status=statusName;
      const decision=['HOLD','PROTECT','EXIT'].includes(protection.latest_decision)?protection.latest_decision:'UNKNOWN';
      const outcome={STOP_ADJUSTED:'applied',RECOMMENDATION_ONLY:'recommendation only',BLOCKED:'proposal rejected',
        NOT_REQUESTED:'no adjustment requested',EXECUTED:'executed'}[protection.review_result] || 'result UNKNOWN';
      const stop=value=>number(value)===null?'UNKNOWN':price(value);
      const accepted=stamp(protection.last_successful_review_at)!==null&&stamp(protection.last_successful_review_at)<=Date.now()&&['NOT_REQUESTED','RECOMMENDATION_ONLY','STOP_ADJUSTED','EXECUTED'].includes(protection.review_result);
      const ai=el('span','AI: '+(accepted&&decision!=='UNKNOWN'?decision:'UNAVAILABLE'),'home-ai-decision');ai.title=outcome;summary.append(status,ai);
      const distance=validStop&&mark>0?(p.side==='LONG'?mark-active:active-mark)/mark*100:null;
      const stopLine=el('p','Stop: '+(validStop?price(active):'Unavailable')+' | Distance: '+(distance===null?'Unavailable':distance.toFixed(2)+'%')+' | Est. net P/L if stopped: '+signedMoney(stopNet),'home-position-stopline');
      const extra=el('details',undefined,'home-protection-details');extra.open=expanded.has(p.id||p.symbol);extra.append(el('summary','Protection details'));
      const values=el('dl',undefined,'home-protection-fields');
      const field=(label,value)=>{const block=el('div');block.append(el('dt',label),el('dd',value));values.append(block);};
      field('Estimated Stop P/L',number(protection.estimated_stop_pnl_usdt)===null?'—':signedMoney(protection.estimated_stop_pnl_usdt));
      field('Original Stop',stop(protection.original_stop));
      extra.append(values,el('p','Detailed stop estimate above is gross, before fees and slippage. The net estimate uses recorded fees and assumes execution at the stop; slippage can cause losses.','home-protection-note'));
      const reviewed=el('p','Last reviewed: '+(stamp(protection.last_successful_review_at)===null?'—':date(protection.last_successful_review_at)),'home-position-reviewed');
      // Estimates are supplied by the read-only projection; the account ledger is unchanged.
      card.append(head,details,miniChart(p,fresh,validStop?active:null),summary,stopLine,extra,reviewed,updated);list.append(card);
    }
  }
  function renderView(data,loading=false,diagnostics={}) {
    latestDiagnostics=diagnostics;
    render(data,loading,diagnostics);
    const retained=diagnostics.display==='RETAINED';
    root.dataset.display=diagnostics.display||'UNAVAILABLE';
    root.dataset.refreshState=diagnostics.state||'LOADING';
    if(!loading && diagnostics.state) {
      const sectionNotes=Object.entries(diagnostics.sections||{}).filter(([,item])=>item?.availability!=='AVAILABLE')
        .map(([name,item])=>name.replaceAll('_',' ')+': '+(item?.reason||item?.availability||'unavailable')).join(' · ');
      const label=(retained?'STALE · Retained snapshot · '+diagnostics.state:diagnostics.display==='UNAVAILABLE'?'Snapshot unavailable · '+diagnostics.state:
        diagnostics.display==='PARTIAL'?'PARTIAL · Independently validated sections':diagnostics.state==='DATA_STALE'?'Valuation stale · Ledger received':'Ledger received')+
        (sectionNotes?' · '+sectionNotes:'')+' · Source: '+date(diagnostics.source_timestamp)+' · Refreshed: '+date(diagnostics.last_successful_refresh);
      $('home-position-time').textContent=label;
      if(retained){
        $('home-positions-state').textContent='STALE';$('home-positions-state').dataset.state='STALE';
        for(const id of ['home-total-pnl','home-realized-pnl','home-equity','home-wallet-balance','home-wallet-realized','home-position-count','home-position-pnl','home-position-directions','home-position-average']){
          const node=$(id);if(node && !node.textContent.includes('STALE') && node.textContent!=='Unavailable')node.textContent+=' · STALE';
        }
        for(const node of root.querySelectorAll('.home-position-profit strong,.home-position-allocation dd,.home-chart-legend dd'))if(!node.textContent.includes('STALE') && node.textContent!=='Unavailable' && node.textContent!=='—')node.textContent+=' · STALE';
      }
    }
  }
  window.HomeDemoPositions=Object.freeze({render:renderView});
})();

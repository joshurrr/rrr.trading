"use strict";
// Read-only saved V4 evidence. No legacy intelligence API, indicators or AI requests.
(() => {
  let cachedEvidence=null, pendingEvidence=null, cachedAt=0;
  function create(root) {
  const API = 'https://v4.rrr.trading/v4/';
  const $ = id => root.querySelector('#asset-analysis-' + id);
  const host = $('cards'), panel = $('panel'), detail = $('detail'), tabs = $('tabs');
  const names = ['Overview','Technical Analysis','News & Intelligence','AI Decisions','Trade History'];
  const frames = ['15m','1h','4h'];
  let data = null, selected = null, origin = null, activeTab = 0, historyCount = 10, overviewVersion = 0, chartFrame = '15';
  const node = (tag, text, cls) => { const el=document.createElement(tag); if(text!==undefined) el.textContent=String(text); if(cls) el.className=cls; return el; };
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const array = value => Array.isArray(value) ? value : [];
  const value = v => v === null || v === undefined || v === '' ? 'NOT_RECORDED' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  const time = v => v && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'})+' Brisbane' : 'NOT_RECORDED';
  const asTime = v => Number.isFinite(Date.parse(v)) ? Date.parse(v) : -Infinity;
  const freshness = row => row?.state === 'CURRENT' && Number.isFinite(Date.parse(row.expires_at)) && Date.now() >= Date.parse(row.expires_at) ? 'STALE' : row?.state || row?.status || 'NOT_RECORDED';
  const tone = v => ['LONG','UP','POSITIVE','BULLISH','APPROVE'].includes(v) ? 'aa-long' : ['SHORT','DOWN','NEGATIVE','BEARISH','EXIT'].includes(v) ? 'aa-short' : v==='PROTECT'?'aa-protect':v==='HOLD'?'aa-hold':['CONFLICT','MIXED','UNKNOWN','NO_TRADE','STALE','OPPOSES','FLAT','ERROR','REJECT','REJECTED'].includes(v) ? 'aa-uncertain' : 'aa-missing';
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
      const card=node('button',undefined,'aa-card');card.type='button';card.dataset.asset=key(a);card.setAttribute('aria-expanded',String(selected===a));card.setAttribute('aria-controls',panel.id);card.setAttribute('aria-label',historical?`View retained AI activity for ${symbol}`:`View full analysis for ${symbol}, ${row.side} rank ${row.rank}`);
      const head=node('span',undefined,'aa-card-heading'),logo=node('span',undefined,'aa-logo');
      const identity=window.AssetLogo.create(symbol,'aa-logo-image','aa-logo-fallback',44);identity.image.alt=symbol+' logo';logo.append(identity.fallback,identity.image);
      head.append(logo,node('strong',symbol,'aa-card-symbol'),node('span',row.side,'aa-direction '+tone(row.side)));
      const alignment=node('span',undefined,'aa-alignments');frames.forEach(tf=>{const item=node('span');item.append(node('strong',tf),badge(direction(a.technical?.[tf])));alignment.append(item);});
      const assessed=object(a.selection_assessment);
      card.append(head,node('span',historical?'Retained AI activity':'Selection rank #'+value(row.rank),'aa-rank'),node('span',historical?'Historical paper position or AI position review; no current research selection is implied.':a.review_selection ? 'Selected for technical assessment - detailed evidence unavailable' : assessed.outcome ? `Saved assessment: ${assessed.outcome}` : explain(a),'aa-technical'),alignment);
      const latestActivity=historical?([...array(a.sol?.records),...array(a.position_reviews)].sort((x,y)=>asTime(y.timestamp)-asTime(x.timestamp))[0]?.decision||'HISTORICAL_ACTIVITY'):sol(a);
      const evidence=pairs([['Asset news',news(a)],[historical?'Retained AI activity':'Latest cycle AI',latestActivity]],'aa-card-evidence');
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
  const marketRoot='https://api.bybit.com/v5/market/';
  const fmtPrice=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumSignificantDigits:9}).format(n):'Unavailable';
  const fmtMoney=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+' USDT':'Unavailable';
  async function marketRead(path,params){const u=new URL(marketRoot+path);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('market');const d=await r.json();if(d.retCode!==0)throw Error('market');return d.result;}
  function drawCandles(chart,candles,position,frame){
    chart.replaceChildren();if(!candles?.length){chart.append(node('p','CANDLE DATA UNAVAILABLE','aa-note'));return;}
    const w=Math.max(360,chart.clientWidth||760),h=270,left=66,right=10,top=12,bottom=48,plotW=w-left-right,plotH=h-top-bottom;
    const markers=[position?.entry_price,position?.protection?.active_stop??position?.protection?.original_stop,position?.protection?.take_profit??position?.take_profit].map(Number).filter(v=>Number.isFinite(v)&&v>0);
    let lo=Math.min(...candles.map(c=>c.low),...markers),hi=Math.max(...candles.map(c=>c.high),...markers);const padding=(hi-lo)*.04||Math.abs(hi)*.005||1;lo-=padding;hi+=padding;const span=hi-lo,slot=plotW/candles.length,y=v=>top+(hi-v)/span*plotH,x=i=>left+i*slot+slot/2,svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',`Bybit ${frame} candlestick chart. Price in USDT on the vertical axis; Brisbane time on the horizontal axis.`);
    const element=(name,attrs,text)=>{const out=document.createElementNS(svg.namespaceURI,name);for(const [key,val] of Object.entries(attrs))out.setAttribute(key,String(val));if(text!==undefined)out.textContent=text;return out;};
    const axisPrice=new Intl.NumberFormat('en-US',{maximumSignificantDigits:5});
    for(let i=0;i<=4;i++){const value=hi-span*i/4,yy=top+plotH*i/4;svg.append(element('line',{x1:left,y1:yy,x2:w-right,y2:yy,class:'aa-chart-gridline'}),element('text',{x:left-8,y:yy+4,'text-anchor':'end',class:'aa-chart-y-axis-label'},axisPrice.format(value)));}
    candles.forEach((c,i)=>{const cx=x(i),up=c.close>=c.open,col=up?'#56d99a':'#ff7272',wick=element('line',{x1:cx,x2:cx,y1:y(c.high),y2:y(c.low),stroke:col}),body=element('rect',{x:cx-slot*.32,width:Math.max(1,slot*.64),y:Math.min(y(c.open),y(c.close)),height:Math.max(1,Math.abs(y(c.open)-y(c.close))),fill:col}),tip=element('title',{},`${new Date(c.time).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})} Brisbane · O ${fmtPrice(c.open)} H ${fmtPrice(c.high)} L ${fmtPrice(c.low)} C ${fmtPrice(c.close)}`);body.append(tip);svg.append(wick,body);});
    const axisTime=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}),tickIndices=[...new Set([0,Math.round((candles.length-1)/4),Math.round((candles.length-1)/2),Math.round(3*(candles.length-1)/4),candles.length-1])];
    tickIndices.forEach((idx,i)=>{const c=candles[idx],tickX=x(idx);svg.append(element('line',{x1:tickX,y1:top+plotH,x2:tickX,y2:top+plotH+4,class:'aa-chart-tick'}));const label=element('text',{x:tickX,y:h-17,'text-anchor':i===0?'start':i===tickIndices.length-1?'end':'middle',class:'aa-chart-x-axis-label'},axisTime.format(new Date(c.time)));const title=element('title',{},new Date(c.time).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' Brisbane');label.append(title);svg.append(label);});
    svg.append(element('text',{x:14,y:top+plotH/2,transform:`rotate(-90 14 ${top+plotH/2})`,'text-anchor':'middle',class:'aa-chart-axis-title'},'Price (USDT)'),element('text',{x:left+plotW/2,y:h-2,'text-anchor':'middle',class:'aa-chart-axis-title'},'Time · Brisbane'));
    const line=(price,label,color)=>{if(!Number.isFinite(Number(price))||Number(price)<=0)return;const yy=y(Number(price));svg.append(element('line',{x1:left,x2:w-right,y1:yy,y2:yy,stroke:color,'stroke-dasharray':'5 4','data-marker':label}));};
    line(position?.entry_price,'Entry','#7adcf0');line(position?.protection?.active_stop??position?.protection?.original_stop,'Stop','#ffab73');line(position?.protection?.take_profit??position?.take_profit,'Target','#8ae3b4');chart.append(svg);
  }
  async function renderOverview(body,a){
    const version=++overviewVersion,symbol=a.identity.instrument_id;
    const market=section('Market price',node('p','LOADING MARKET DATA','aa-note'));market.classList.add('aa-market');
    const layout=node('div',undefined,'aa-overview-grid'),chartSection=section('Price chart'),positionSection=section('Open position');
    const chart=node('div',undefined,'aa-chart');chartSection.append(chart);const controls=node('div',undefined,'aa-timeframes');
    [['15','15m'],['60','1h'],['240','4h']].forEach(([tf,label])=>{const b=node('button',label);b.type='button';b.setAttribute('aria-pressed',String(chartFrame===tf));b.addEventListener('click',()=>{chartFrame=tf;controls.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button===b)));loadCandles();});controls.append(b);});chartSection.append(controls);
    const pos=node('div','POSITION DATA UNAVAILABLE','aa-note');positionSection.append(pos);layout.append(chartSection,positionSection);body.append(market,layout);
    let ledger=null;try{const r=await fetch(API+'paper',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const d=await r.json();if(d.version!=='paper-read-api-v1'||d.mode!=='paper'||d.open_positions?.availability!=='AVAILABLE'||!Array.isArray(d.open_positions?.items))throw Error();ledger=d.open_positions;}catch{}
    if(version!==overviewVersion||selected!==a)return;
    const matches=ledger?.items.filter(p=>p.exchange==='bybit'&&(p.symbol===symbol||p.symbol===symbol.replace(/USDT$/,''))&&(!p.instrument_type||p.instrument_type==='linear_perpetual'))||[];
    const p=matches[0],financials=p?.financials||{},protection=p?.protection||{},activeStop=protection.active_stop??protection.original_stop;
    if(ledger){if(!p)pos.textContent='NO OPEN POSITION';else{const fresh=p.availability==='AVAILABLE'&&(!p.mark_expires_at||Date.now()<Date.parse(p.mark_expires_at)), numeric=(v)=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null,opened=Date.parse(p.entered_at),elapsed=Number.isFinite(opened)?Math.max(0,Date.now()-opened):null,duration=elapsed===null?'Unavailable':`${Math.floor(elapsed/3600000)}h ${Math.floor(elapsed%3600000/60000)}m`,pnl=fresh?(numeric(financials.estimated_net_pnl_usdt)??numeric(p.unrealized_pnl)):null;pos.className='aa-position-card';pos.replaceChildren(node('h4',`OPEN ${p.side} · ${numeric(p.leverage)!==null?p.leverage+'×':'Leverage unavailable'}`),pairs([['Size',numeric(financials.position_notional_usdt)===null?'Unavailable':fmtMoney(numeric(financials.position_notional_usdt))],['Entry',numeric(p.entry_price)===null?'Unavailable':fmtPrice(numeric(p.entry_price))+' USDT'],['Current',fresh&&numeric(p.current_mark)!==null?fmtPrice(numeric(p.current_mark))+' USDT':'STALE / unavailable'],['Stop loss',numeric(activeStop)===null?'Unavailable':fmtPrice(numeric(activeStop))+' USDT'],['Take profit',numeric(protection.take_profit??p.take_profit)===null?'Unavailable':fmtPrice(numeric(protection.take_profit??p.take_profit))+' USDT'],['Unrealised P/L',pnl===null?'Unavailable':fmtMoney(pnl)],['ROI',fresh&&numeric(financials.estimated_net_return_pct)!==null?numeric(financials.estimated_net_return_pct).toFixed(2)+'%':fresh&&numeric(financials.margin_used_usdt)>0&&numeric(p.unrealized_pnl)!==null?(numeric(p.unrealized_pnl)/numeric(financials.margin_used_usdt)*100).toFixed(2)+'%':'Unavailable'],['Duration',duration]], 'aa-fields'));}}
    const loadCandles=async()=>{const current=version,frame=chartFrame,label={'15':'15m','60':'1h','240':'4h'}[frame]||frame;try{const r=await marketRead('kline',{category:'linear',symbol,interval:frame,limit:'80'});if(current!==overviewVersion||selected!==a||frame!==chartFrame)return;const rows=(r.list||[]).slice().reverse().map(x=>({time:Number(x[0]),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4])}));drawCandles(chart,rows,p,label);}catch{if(current===overviewVersion&&frame===chartFrame)drawCandles(chart,[],p,label);}};
    async function loadTicker(){try{const r=await marketRead('tickers',{category:'linear',symbol});if(version!==overviewVersion||selected!==a)return;const t=r.list?.[0];if(!t)throw Error();const n=k=>Number.isFinite(Number(t[k]))?Number(t[k]):null,updated=Date.now(),change=n('price24hPcnt'),stamp=new Date(updated).toLocaleTimeString('en-AU',{timeZone:'Australia/Brisbane',hour:'2-digit',minute:'2-digit'});market.replaceChildren(node('h3',`${symbol.replace(/USDT$/,'')} / USDT`),pairs([['Current price',fmtPrice(n('lastPrice'))+' USDT'],['24h change',`${fmtPrice(n('lastPrice')!==null&&n('price24hPcnt')!==null?n('lastPrice')-n('lastPrice')/(1+n('price24hPcnt')):null)} USDT · ${change===null?'Unavailable':(change*100).toFixed(2)+'%'}`],['24h high',fmtPrice(n('highPrice24h'))+' USDT'],['24h low',fmtPrice(n('lowPrice24h'))+' USDT'],['24h volume',fmtPrice(n('turnover24h'))+' USDT'],['Updated',stamp+' Brisbane · CURRENT']],'aa-fields'));}catch{if(version===overviewVersion)market.replaceChildren(node('p','MARKET DATA UNAVAILABLE','aa-note'));}}
    loadTicker();loadCandles();
  }
  function renderDetail() {
    detail.replaceChildren();const body=node('div');body.id='aa-detail-panel';body.setAttribute('role','tabpanel');body.setAttribute('aria-labelledby','aa-tab-'+activeTab);body.tabIndex=0;detail.append(body);
    const a=selected,row=a.selection,assessment=object(a.selection_assessment);if(activeTab!==0)overviewVersion++;
    if(activeTab===0){
      renderOverview(body,a);
    } else if(activeTab===1){
      body.append(node('p','Recorded technical evidence. Historical fallback is display only and does not establish what the AI received for a specific decision.','aa-note'));
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
        block.append(node('p',`${exact?'Recorded decision evidence':'HISTORICAL — Last recorded technical assessment'} · ${state}`,'aa-note '+tone(state)),
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
      const statusLabel={RELEVANT_NEWS_AVAILABLE:'Relevant asset news available',NO_RELEVANT_NEWS_FOUND:'No relevant news found',DISCOVERY_UNAVAILABLE:'Discovery unavailable',PARTIAL_DISCOVERY:'Discovery partially complete',ASSESSMENT_STALE:'Assessment stale',ASSESSMENT_UNAVAILABLE:'Assessment unavailable'}[luna.news_availability]||luna.news_availability||'Assessment status unavailable';
      body.append(section('Latest saved asset news & intelligence',node('p','Validated asset-specific discovery and Luna assessment. Empty discovery is not substantive trading evidence.','aa-note'),pairs([['Assessment',news(a)],['News outcome',statusLabel],['Scope',luna.scope||'ASSET_SPECIFIC'],['Coverage',luna.coverage],['Last successful news check',time(luna.discovery?.last_successful_check)],['Latest discovery attempt',time(luna.discovery?.checked_at)],['Assessed at',time(luna.timestamps?.timestamp)],['Original expiry',time(luna.timestamps?.expires_at)],['Implication',saved.implication],['Model',luna.model]]),node('p',saved.summary||luna.reason||'No reliably attributed asset-specific assessment is exposed.'),list(saved.uncertainty),list(luna.reasons)));
      if(array(luna.verified_discovered_news).length)body.append(section('Verified discovered stories',...array(luna.verified_discovered_news).map(item=>{const card=section(item.headline,node('p',item.summary||'Publisher summary unavailable.'),pairs([['Source',item.provenance?.source],['Published',time(item.published_at)],['Observed',time(item.provenance?.observed_at)]]));try{const u=new URL(item.provenance?.reference);if(u.protocol==='https:'&&!u.username&&!u.password){const link=node('a','Read source');link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}}catch{}return card;})));
      if(array(luna.assessment_history).length)body.append(section('Earlier saved asset assessments',...array(luna.assessment_history).map(record=>{const old=object(record.data?.assessment);return section(time(record.timestamps?.timestamp),node('p',old.summary||'Summary unavailable.'),pairs([['State',record.state],['Expiry',time(record.timestamps?.expires_at)],['Implication',old.implication]]));})));
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
      const identity=object(luna.identity), symbol=row.symbol.replace(/USDT$/,'');
      const identifiers=new Set([symbol,row.symbol,...array(identity.aliases),...array(identity.protocols),...array(identity.organizations),identity.project_name,identity.ecosystem].filter(x=>typeof x==='string'&&x.length>=4).map(x=>x.toLocaleLowerCase().trim()));
      const themes=array(content.themes).filter(t=>array(t.affected_markets).some(m=>identifiers.has(String(m).toLocaleLowerCase().trim())));
      body.append(section('Explicitly asset-targeted saved themes',themes.length?node('p','Matched against this asset’s curated project, alias and protocol identities in the saved affected-markets field.'):node('p','NOT_RECORDED · no saved theme explicitly identifies this project or affected asset.')));
      themes.forEach(t=>body.append(section(t.name,node('p',t.description),pairs([['Recorded implication',t.implication],['Evidence references',array(t.evidence_ids).join(', ')]]),node('h4','Catalysts'),list(array(t.catalysts).map(c=>c.text)),node('h4','Risks / conflicting evidence'),list(array(t.risks).map(c=>c.text)))));
      const sources=node('ul');array(component.provenance?.evidence).forEach(e=>{const li=node('li');li.append(node('span',`${value(e.id)} · ${value(e.source)} · ${time(e.published_at||e.observed_at)} · ${value(e.state)} `));try{const url=new URL(e.reference);if(url.protocol==='https:'&&!url.username&&!url.password){const link=node('a','Source');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';li.append(link);}}catch{}sources.append(li);});body.append(section('Saved market news sources',sources.childElementCount?sources:node('p','NOT_RECORDED')));
    } else if(activeTab===3){
      const records=array(a.sol?.records).map(d=>({...d,activity_type:'ENTRY'}));
      const reviews=array(a.position_reviews).map(d=>({...d,activity_type:'POSITION_REVIEW'}));
      const activity=[...records,...reviews].filter(d=>asTime(d.timestamp)>-Infinity).sort((x,y)=>asTime(y.timestamp)-asTime(x.timestamp));
      const decisionName=d=>String(d.decision||d.status||'').toUpperCase();
      const typeName=d=>d.activity_type==='ENTRY'?'Entry Decision':'Position Management';
      const reasoning=d=>d.reasoning||d.recorded_reasoning||'Recorded reasoning is unavailable.';
      const latest=activity[0];
      body.append(section('Latest AI Decision',latest?(()=>{
        const card=node('div',undefined,'aa-decision-card');
        card.append(node('div',undefined,'aa-decision-heading'));
        card.firstChild.append(badge(decisionName(latest)||'UNKNOWN',decisionName(latest)),node('span',typeName(latest),'aa-type-badge'));
        card.append(node('p',`${a.historical_only?'Historical assessment · ':''}Recorded ${time(latest.timestamp)}`,'aa-note'));
        if(latest.execution)card.append(node('p',`Recorded outcome: ${value(latest.execution)}`,'aa-outcome'));
        card.append(node('div',reasoning(latest),'aa-reasoning'));
        const technical=node('details',undefined,'aa-technical-details');technical.append(node('summary','Technical details'),pairs([['Position ID',latest.position_id],['Correlation ID',latest.request_key],['Cycle',latest.cycle_started_at],['Evidence references',array(latest.evidence_refs).join(', ')],['Record source',latest.source],['Blocking reason',[...array(latest.rejection),latest.error].filter(Boolean).join(', ')]].filter(([,v])=>v!==undefined&&v!=='')));card.append(technical);return card;
      })():node('p','No AI decision or position review has been recorded for this asset.','aa-note')));
      body.append(section('Current Research Status',node('div',undefined,'aa-status-panel')));
      const statusPanel=body.lastChild;
      if(a.historical_only)statusPanel.append(badge('Current Research: NOT SELECTED','NOT_SELECTED'),node('p','Asset is not included in the latest research shortlist. Historical AI decisions and position management remain available.','aa-note'));
      else {
        const current=object(a.sol?.current_selection),currentDecision=object(a.sol?.current);
        const evaluated=current.status==='EVALUATED'&&currentDecision.decision;
        statusPanel.append(badge(current.status==='NO_CURRENT_SELECTION'?'Current Research: NOT SELECTED':evaluated?'Current research decision recorded':'Current research status unavailable',evaluated?currentDecision.decision:'NOT_SELECTED'));
        statusPanel.append(node('p',current.status==='NO_CURRENT_SELECTION'?'Asset is not included in the latest research shortlist. Historical AI decisions and position management remain available.':evaluated?`${value(currentDecision.decision)} · ${time(currentDecision.timestamp)}`:current.status==='CORRELATION_UNAVAILABLE'?'The saved research cycle could not be reliably matched to an AI decision. No current decision is inferred.':'No current-cycle AI decision is recorded. Historical decisions remain available.','aa-note'));
        if(evaluated)statusPanel.append(node('p',currentDecision.reasoning||'Recorded reasoning is unavailable.','aa-reasoning'));
      }
      const previous=activity.slice(1);
      body.append(section('Previous AI Decisions',previous.length?node('div',undefined,'aa-decision-list'):node('p','No earlier recorded AI decisions are available.','aa-note')));
      const decisionList=body.lastChild.querySelector('.aa-decision-list');
      if(decisionList)previous.forEach(d=>{const item=node('details',undefined,'aa-decision-row');const summary=node('summary');summary.append(node('time',time(d.timestamp)),badge(decisionName(d)||'UNKNOWN',decisionName(d)),node('span',typeName(d)));item.append(summary);item.append(node('p',d.execution?`Recorded outcome: ${value(d.execution)}`:'Recorded outcome unavailable.','aa-outcome'),node('div',reasoning(d),'aa-reasoning'));
        const ev=array(d.evidence_refs);if(ev.length)item.append(pairs([['Supporting evidence',ev.join(', ')]]));
        const technical=node('details',undefined,'aa-technical-details');technical.append(node('summary','Technical details'),pairs([['Position ID',d.position_id],['Correlation ID',d.request_key],['Cycle',d.cycle_started_at],['Record source',d.source],['Blocking reason',[...array(d.rejection),d.error].filter(Boolean).join(', ')],['Stop loss',d.stop_loss],['Technical details',d.technical_details]].filter(([,v])=>v!==undefined&&v!=='')));item.append(technical);decisionList.append(item);});
    } else {
      const events=[];const add=(timestamp,type,summary,details,kind='trade')=>{if(asTime(timestamp)>-Infinity)events.push({timestamp,type,summary,details,kind});};
      array(a.sol?.records).forEach(d=>add(d.timestamp,'AI recommendation',`${value(d.decision||d.status)} · entry recommendation`,[['Recorded outcome',d.execution],['Position ID',d.position_id],['Correlation ID',d.request_key],['Evidence references',array(d.evidence_refs).join(', ')]].filter(([,v])=>v!==undefined&&v!==''),'recommendation'));
      array(a.position_reviews).forEach(r=>add(r.timestamp,'Position review',`${value(r.decision)} · ${value(r.execution)}`,Object.entries(r).filter(([k,v])=>!['timestamp','decision','execution'].includes(k)&&v!==undefined&&v!==''),'management'));
      const tradeIds=new Set(array(a.trades).map(t=>t.id).filter(Boolean));
      array(a.positions).filter(p=>!p.id||!tradeIds.has(p.id)).forEach(p=>add(p.entered_at,'Paper trade entry',`${value(p.side)} position opened`,Object.entries(p).filter(([k,v])=>!['entered_at'].includes(k)&&v!==undefined&&v!=='')));
      array(a.trades).forEach(t=>{
        const size=t.quantity??t.size;
        add(t.entered_at,'Paper trade entry',`${value(t.side)}${size!==undefined&&size!==null&&size!==''?` · ${value(size)}`:''}`,Object.entries(t).filter(([k,v])=>!['entered_at','closed_at'].includes(k)&&v!==undefined&&v!==''));
        add(t.closed_at,'Paper trade exit',`${value(t.side)} · realised P/L ${value(t.realized_pnl)} USDT${t.net_pnl!==undefined?` · net ${value(t.net_pnl)} USDT`:''}${t.exit_reason?` · ${value(t.exit_reason)}`:''}`,Object.entries(t).filter(([k,v])=>!['entered_at','closed_at'].includes(k)&&v!==''&&v!==undefined));
        [['stop_loss_adjusted_at','Stop-loss adjustment'],['stop_loss_updated_at','Stop-loss adjustment']].forEach(([key,label])=>add(t[key],label,`Recorded stop loss ${value(t.stop_loss)}`,Object.entries(t).filter(([k,v])=>!['entered_at','closed_at'].includes(k)&&v!==''&&v!==undefined)));
      });
      events.sort((x,y)=>asTime(y.timestamp)-asTime(x.timestamp));
      const listNode=node('div',undefined,'aa-trade-timeline');
      events.forEach(e=>{const item=node('details',undefined,'aa-trade-event '+e.kind),summary=node('summary');summary.append(node('time',time(e.timestamp)),node('span',e.type,'aa-type-badge'),node('strong',e.summary));item.append(summary);const content=node('div',undefined,'aa-trade-details');content.append(pairs([['Timestamp',time(e.timestamp)],['Event type',e.type],['Recorded outcome',e.type==='Paper trade exit'?e.summary:e.kind==='management'?e.summary:'Not recorded']]),pairs(e.details));item.append(content);listNode.append(item);});
      body.append(section('Trade History',events.length?listNode:node('p','No timestamped paper trades or position activity are available for this asset.','aa-note')));
      body.append(node('p','AI recommendations, accepted position-management outcomes and executed paper trades are shown as separate recorded events. No relationship is inferred when the records do not contain an explicit link.','aa-note'));
    }
  }
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

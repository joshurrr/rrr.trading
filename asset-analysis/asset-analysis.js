"use strict";
// Read-only saved V4 evidence. No legacy intelligence API, indicators or AI requests.
(() => {
  let cachedEvidence=null, pendingEvidence=null, cachedAt=0;
  function create(root, banner = root.querySelector(".aa-identity-banner")) {
  const API = 'https://v4.rrr.trading/v4/';
  const $ = id => root.querySelector('#asset-analysis-' + id);
  const host = $('cards'), panel = $('panel'), detail = $('detail'), tabs = $('tabs');
  const names = ['Overview','Technical Analysis','News & Themes','AI Decisions','Trade History'];
  const frames = ['15m','1h','4h'];
  let data = null, selected = null, origin = null, planContext = null, activeTab = 0, historyCount = 10, overviewVersion = 0, chartFrame = '15';
  let chartObserver;
  const node = (tag, text, cls) => { const el=document.createElement(tag); if(text!==undefined) el.textContent=String(text); if(cls) el.className=cls; return el; };
  // CoinGecko artwork matched to the underlying Bybit linear contracts.
  const identities = {
    AKEUSDT:['Akedo','akedo'], JCTUSDT:['Janction','janction'],
    BTCUSDT:['Bitcoin','bitcoin'], ETHUSDT:['Ethereum','ethereum'],
    SOLUSDT:['Solana','solana'], XRPUSDT:['XRP','xrp'],
    ADAUSDT:['Cardano','cardano'], DOGEUSDT:['Dogecoin','dogecoin'],
    LINKUSDT:['Chainlink','chainlink']
  };
  function paintLogo(container,symbol,identity) {
    const asset=identity?.exchange==='bybit' && identity.instrument_type==='linear_perpetual'
      ? identities[identity.instrument_id] : undefined;
    const fallback=node('span',symbol.length>6?symbol.slice(0,4)+'\u2026':symbol,'aa-logo-fallback');
    container.replaceChildren(fallback);
    if(!asset)return '';
    const image=node('img');
    image.alt='';image.width=image.height=48;image.hidden=true;
    image.addEventListener('load',()=>{image.hidden=false;fallback.hidden=true;});
    image.addEventListener('error',()=>{image.hidden=true;fallback.hidden=false;});
    container.append(image);
    image.src='/assets/analysis-logos/'+asset[1]+'.png';
    return asset[0];
  }
  function paintBanner(symbol,a) {
    if(!banner)return;
    const name=paintLogo(banner.querySelector('.aa-logo'),symbol,a?.identity);
    banner.querySelector('.aa-identity-ticker').textContent=symbol;
    banner.querySelector('.aa-identity-name').textContent=name===symbol?'':name;
    const meta=banner.querySelector('.aa-identity-meta');
    meta.replaceChildren();
    banner.querySelector('.aa-header-quote')?.remove();
    if(!a)return;
    const status=a.historical_only?'ASSET LEVEL':freshness(a.trading_universe_member?data.trading_universe:a.selection);
    const context=a.historical_only?'No current research selection':a.trading_universe_member?'Saved trading universe':'Selection '+time(a.selection.observed_at);
    const badge=node('span',status,'aa-identity-badge');
    badge.dataset.freshness=status;
    meta.append(node('span',a.identity.exchange.toUpperCase()+' \u00b7 PERPETUAL','aa-identity-badge'),badge,node('span',context,'aa-identity-context'));
  }
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const array = value => Array.isArray(value) ? value : [];
  const decisionEvidence = decision => {
    const detail=node('details',undefined,'aa-evidence');
    detail.append(node('summary','Actual decision-time evidence'));
    const input=object(decision.decision_input);
    detail.append(Object.keys(input).length
      ? node('pre',JSON.stringify(input,null,2),'aa-technical-json')
      : node('p','UNAVAILABLE � The original decision input was not retained. Current observations are not substituted.','aa-note'));
    return detail;
  };
  const value = v => v === null || v === undefined || v === '' ? 'UNAVAILABLE' : typeof v === 'object' ? JSON.stringify(v) : String(v);
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
  const frameState = frame => frame?.status !== 'ASSESSED' ? frame?.status || 'UNAVAILABLE' : freshness({state:frame.state,expires_at:frame.expires_at});
  const direction = frame => frame?.status === 'ASSESSED' && !['STALE','UNAVAILABLE','ERROR','INVALID'].includes(frameState(frame)) ? frame.direction || 'UNKNOWN' : frameState(frame);
  const explain = a => `${a.selection.timeframe} ranking · momentum ${value(a.selection.momentum_support)} · ${value(a.selection.return_pct)}% recorded return`;
  const fetchJson = async name => {const r=await fetch(API+name,{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(!d || typeof d!=='object')throw Error('Invalid response');return d;};
  const validShortlists = view => ['LONG','SHORT'].every(side=>['CURRENT','STALE'].includes(view?.[side]?.state)&&Array.isArray(view[side].items));
  const validIdentity = a => a?.identity?.exchange==='bybit' && /^[A-Z0-9]{1,30}USDT$/.test(a.identity.instrument_id||'') && a.identity.instrument_type==='linear_perpetual' && a.selection?.symbol===a.identity.instrument_id && (a.historical_only===true ? a.selection?.side==='HISTORICAL' : a.selection?.exchange===a.identity.exchange && a.selection?.instrument_type===a.identity.instrument_type && ['LONG','SHORT'].includes(a.selection?.side));
  function fallback(paper) {
    const shortlists=paper?.overview?.shortlists;
    if(paper?.version!=='paper-read-api-v1'||paper?.mode!=='paper') throw Error('Saved paper contract invalid');
    return {version:'asset-analysis-read-v1',mode:'paper',read_only:true,availability:'AVAILABLE',served_at:paper.served_at,shortlists,trading_universe:paper.overview?.trading_universe||paper.overview?.research?.catalogue,
      assets:(validShortlists(shortlists)?['LONG','SHORT']:[]).flatMap(side=>shortlists[side].items.map(selection=>({selection,identity:{exchange:selection.exchange,instrument_id:selection.symbol,instrument_type:selection.instrument_type},technical:{},technical_status:'UNAVAILABLE',selection_assessment:{},luna:{status:'UNAVAILABLE',reason:'The saved shortlist API does not expose asset-specific Luna assessments; assessment presence cannot be established.'},sol:{status:'UNAVAILABLE',records:[],blockers:[]},positions_status:'UNAVAILABLE',trades_status:'UNAVAILABLE',positions:[],trades:[]}))),
      market_context:paper.overview?.interpretation,history:{status:'UNAVAILABLE',items:[],explanation:'The saved shortlist API exposes the latest selection only. Historical selection snapshots and asset observations are not accessible through this response.'},fallback:true};
  }
  function includeUniverse(response, paper) {
    const contract=paper?.version==='paper-read-api-v1'&&paper.mode==='paper';
    const universe=response.trading_universe || (contract ? paper.overview?.trading_universe || paper.overview?.research?.catalogue : null);
    const known=['CURRENT','STALE'].includes(universe?.state)&&Array.isArray(universe.assets)
      && Number.isFinite(asTime(universe.observed_at))&&asTime(universe.observed_at)<=Date.now()
      && universe.assets.length<=100&&universe.pool_asset_count===universe.assets.length
      && universe.assets.every(r=>r.exchange==='bybit'&&/^[A-Z0-9]{1,30}USDT$/.test(r.symbol||'')&&r.pair===r.symbol+'/USDT:USDT')
      && new Set(universe.assets.map(r=>r.symbol)).size===universe.assets.length;
    if(!known)return {...response,trading_universe:{state:'UNAVAILABLE'},universe_known:false};
    const matches=(a,r)=>a.identity.exchange===r.exchange&&a.identity.instrument_id===r.symbol&&a.identity.instrument_type==='linear_perpetual';
    const current=universe.assets.map(r=>{
      const existing=response.assets.find(a=>matches(a,r));
      const selection=existing&&!existing.historical_only?existing.selection:{symbol:r.symbol,side:'UNSELECTED',rank:null,observed_at:null,provenance:{}};
      return {...existing,identity:{exchange:r.exchange,instrument_id:r.symbol,instrument_type:'linear_perpetual'},selection,
        historical_only:false,trading_universe_member:true,market:r,
        technical:existing?.technical||{},luna:existing?.luna||{status:'UNAVAILABLE'},sol:existing?.sol||{status:'UNAVAILABLE',records:[]},
        positions:existing?.positions||[],trades:existing?.trades||[],selection_assessment:existing?.selection_assessment||{}};
    });
    const historical=response.assets.filter(a=>!universe.assets.some(r=>matches(a,r))).map(a=>({...a,historical_only:true,trading_universe_member:false,selection:{...a.selection,side:'HISTORICAL'}}));
    return {...response,trading_universe:universe,universe_known:true,assets:[...current,...historical]};
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
    const view=data.shortlists, valid=validShortlists(view), universe=data.trading_universe;
    const count=side=>valid?view[side].items.length:'UNAVAILABLE';
    const times=valid?['LONG','SHORT'].map(side=>view[side].observed_at).filter(v=>asTime(v)>-Infinity):[];
    const latest=times.sort((a,b)=>asTime(b)-asTime(a))[0];
    const selected=valid?new Set(['LONG','SHORT'].flatMap(side=>view[side].items.map(r=>[r.exchange,r.symbol,r.instrument_type].join(':')))).size:'UNAVAILABLE';
    $('summary').replaceChildren(...Array.from(pairs([
      ['Trading Assets',data.universe_known?data.assets.filter(a=>a.trading_universe_member).length:'UNAVAILABLE'],
      ['Latest selection',latest?time(latest):'UNAVAILABLE'],['Selected assets',selected],
      ['LONG review',count('LONG')],['SHORT review',count('SHORT')],
      ['Data freshness',data.universe_known?freshness(universe):'UNAVAILABLE']],'aa-summary').children));
    $('status').textContent=data.universe_known?`Saved trading universe loaded - ${freshness(universe)} - ${valid?'selection evidence available':'selection evidence unavailable'}.`:
      'Trading universe UNAVAILABLE - retained analysis only; current membership cannot be verified.';
    $('evidence').replaceChildren(pairs([['Source','/v4/asset-analysis + /v4/paper'],['API version',data.version],['API read time',time(data.served_at)],
      ['Trading universe',data.universe_known?freshness(universe):'UNAVAILABLE'],['Universe observed at',time(universe?.observed_at)],
      ['Universe expiry',time(universe?.expires_at)],['Universe source',universe?.provenance?.discovery_source],
      ['Selection evidence',valid?['LONG','SHORT'].map(side=>freshness(view[side])).join(' / '):'UNAVAILABLE']]));
  }
  function renderCards() {
    host.replaceChildren();
    data.assets.forEach(a=>{
      const row=a.selection, symbol=row.symbol.replace(/USDT$/,''), historical=a.historical_only===true, member=a.trading_universe_member===true, unselected=row.side==='UNSELECTED';
      const card=node('button',undefined,'aa-card');card.type='button';card.dataset.asset=key(a);card.setAttribute('aria-expanded',String(selected===a));card.setAttribute('aria-controls',panel.id);card.setAttribute('aria-label',historical?`View retained AI activity for ${symbol}`:`View full analysis for ${symbol}`);
      const head=node('span',undefined,'aa-card-heading'),logo=node('span',undefined,'aa-logo');
      paintLogo(logo,symbol,a.identity);
      head.append(logo,node('strong',symbol,'aa-card-symbol'),node('span',member?'TRADING ASSET':historical?'HISTORICAL':'MEMBERSHIP UNAVAILABLE','aa-direction '+tone(row.side)));
      const alignment=node('span',undefined,'aa-alignments');frames.forEach(tf=>{const item=node('span');item.append(node('strong',tf),badge(direction(a.technical?.[tf])));alignment.append(item);});
      const assessed=object(a.selection_assessment);
      card.append(head,node('span',historical?'Retained AI activity':unselected?'Selection UNAVAILABLE':'Selection rank #'+value(row.rank),'aa-rank'),node('span',historical?'Historical paper position or AI position review; no current membership is implied.':unselected?'Trading universe member - analysis shown where recorded.':a.review_selection ? 'Selected for technical assessment - detailed evidence unavailable' : assessed.outcome ? `Saved assessment: ${assessed.outcome}` : explain(a),'aa-technical'),alignment);
      const latestActivity=historical?([...array(a.sol?.records),...array(a.position_reviews)].sort((x,y)=>asTime(y.timestamp)-asTime(x.timestamp))[0]?.decision||'HISTORICAL_ACTIVITY'):sol(a);
      if(member)card.append(pairs([['Saved price',a.market.price===null||a.market.price===undefined?'UNAVAILABLE':a.market.price+' USDT'],['Universe status',freshness(data.trading_universe)]],'aa-card-evidence'));
      const evidence=pairs([['Asset news',news(a)],[historical?'Retained AI activity':'Latest cycle AI',latestActivity]],'aa-card-evidence');
      evidence.querySelectorAll('dd').forEach((dd,i)=>dd.className=tone(i?sol(a):news(a)));card.append(evidence);
      card.append(node('span',historical?'ASSET LEVEL - not linked to current selection':member?freshness(data.trading_universe)+' - universe '+time(data.trading_universe.observed_at):freshness(row)+' - '+time(row.observed_at),'aa-card-time'));
      const action=node('span',undefined,'aa-action');action.append(node('span','View Full Analysis'),node('span','↓'));card.append(action);
      card.addEventListener('click',()=>open(a,card));host.append(card);
    });
    if(!data.assets.length){
      host.append(node('p','No assets are available in the returned universe or retained analysis.','aa-note'));
      const gaps=array(data.history?.gaps);
      if(gaps.some(g=>['retained_account_decisions_unavailable','position_review_history_unavailable','position_review_history_window_truncated'].includes(g)))host.append(node('p','Historical SOL activity retrieval is PARTIAL or UNAVAILABLE; the retained account or review history could not be fully read. No decisions were inferred.','aa-note'));
    }
  }
  function open(a,card,options={}) {
    selected=a;origin=card;activeTab=Number.isInteger(options.tab)&&options.tab>=0&&options.tab<names.length?options.tab:0;planContext=options.plan||null;
    host?.querySelectorAll('.aa-card').forEach(c=>c.setAttribute('aria-expanded',String(c===card)));
    paintBanner(a.identity.instrument_id.replace(/USDT$/,''),a);
    panel.hidden=false;renderTabs();if(host){$('panel-title').focus({preventScroll:true});panel.scrollIntoView({behavior:'instant',block:'start'});}
  }
  function close() {chartObserver?.disconnect();panel.hidden=true;selected=null;host.querySelectorAll('.aa-card').forEach(c=>c.setAttribute('aria-expanded','false'));origin?.focus({preventScroll:true});}
  function renderTabs() {
    tabs.replaceChildren();
    names.forEach((name,i)=>{const b=node('button',name);b.type='button';b.id='aa-tab-'+i;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(i===activeTab));b.setAttribute('aria-controls','aa-detail-panel');b.tabIndex=i===activeTab?0:-1;b.addEventListener('click',()=>selectTab(i));b.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(i+1)%names.length;if(e.key==='ArrowLeft')next=(i+names.length-1)%names.length;if(e.key==='Home')next=0;if(e.key==='End')next=names.length-1;if(next!==undefined){e.preventDefault();selectTab(next);tabs.children[next].focus();}});tabs.append(b);});if(selected)renderDetail();else detail.replaceChildren(node('p','Loading saved asset analysis...','aa-note'));
  }
  function selectTab(i) {activeTab=i;renderTabs();}
  const marketRoot='https://api.bybit.com/v5/market/';
  const fmtPrice=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumSignificantDigits:9}).format(n):'Unavailable';
  const fmtMoney=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+' USDT':'Unavailable';
  async function marketRead(path,params){const u=new URL(marketRoot+path);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('market');const d=await r.json();if(d.retCode!==0)throw Error('market');return d.result;}
  function drawCandles(chart,candles,position,frame){
    chart.replaceChildren();if(!candles?.length){chart.append(node('p','CANDLE DATA UNAVAILABLE','aa-note'));return;}
    const w=Math.max(260,chart.clientWidth||760),h=chart.clientHeight||290,left=72,right=10,top=10,bottom=41,plotW=w-left-right,plotH=h-top-bottom;
    const markers=[position?.entry_price,position?.protection?.active_stop??position?.protection?.original_stop,position?.protection?.take_profit??position?.take_profit].map(Number).filter(v=>Number.isFinite(v)&&v>0);
    let lo=Math.min(...candles.map(c=>c.low),...markers),hi=Math.max(...candles.map(c=>c.high),...markers);const padding=(hi-lo)*.04||Math.abs(hi)*.005||1;lo-=padding;hi+=padding;const span=hi-lo,slot=plotW/candles.length,y=v=>top+(hi-v)/span*plotH,x=i=>left+i*slot+slot/2,svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',`Bybit ${frame} candlestick chart. Price in USDT on the vertical axis; Brisbane time on the horizontal axis.`);
    const element=(name,attrs,text)=>{const out=document.createElementNS(svg.namespaceURI,name);for(const [key,val] of Object.entries(attrs))out.setAttribute(key,String(val));if(text!==undefined)out.textContent=text;return out;};
    const axisPrice=new Intl.NumberFormat('en-US',{maximumSignificantDigits:5});
    for(let i=0;i<=4;i++){const value=hi-span*i/4,yy=top+plotH*i/4;svg.append(element('line',{x1:left,y1:yy,x2:w-right,y2:yy,class:'aa-chart-gridline'}),element('text',{x:left-8,y:yy+4,'text-anchor':'end',class:'aa-chart-y-axis-label'},axisPrice.format(value)));}
    candles.forEach((c,i)=>{const cx=x(i),up=c.close>=c.open,col=up?'#56d99a':'#ff7272',wick=element('line',{x1:cx,x2:cx,y1:y(c.high),y2:y(c.low),stroke:col}),body=element('rect',{x:cx-slot*.32,width:Math.max(1,slot*.64),y:Math.min(y(c.open),y(c.close)),height:Math.max(1,Math.abs(y(c.open)-y(c.close))),fill:col}),tip=element('title',{},`${new Date(c.time).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})} Brisbane · O ${fmtPrice(c.open)} H ${fmtPrice(c.high)} L ${fmtPrice(c.low)} C ${fmtPrice(c.close)}`);body.append(tip);svg.append(wick,body);});
    const axisTime=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}),tickFractions=w<380?[0,1]:w<520?[0,.5,1]:[0,.25,.5,.75,1],tickIndices=[...new Set(tickFractions.map(f=>Math.round(f*(candles.length-1))))];
    tickIndices.forEach((idx,i)=>{const c=candles[idx],tickX=x(idx);svg.append(element('line',{x1:tickX,y1:top+plotH,x2:tickX,y2:top+plotH+4,class:'aa-chart-tick'}));const label=element('text',{x:tickX,y:h-17,'text-anchor':i===0?'start':i===tickIndices.length-1?'end':'middle',class:'aa-chart-x-axis-label'},axisTime.format(new Date(c.time)));const title=element('title',{},new Date(c.time).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' Brisbane');label.append(title);svg.append(label);});
    svg.append(element('text',{x:14,y:top+plotH/2,transform:`rotate(-90 14 ${top+plotH/2})`,'text-anchor':'middle',class:'aa-chart-axis-title'},'Price (USDT)'),element('text',{x:left+plotW/2,y:h-2,'text-anchor':'middle',class:'aa-chart-axis-title'},'Time · Brisbane'));
    const line=(price,label,color)=>{if(!Number.isFinite(Number(price))||Number(price)<=0)return;const yy=y(Number(price));svg.append(element('line',{x1:left,x2:w-right,y1:yy,y2:yy,stroke:color,'stroke-dasharray':'5 4','data-marker':label}));};
    line(position?.entry_price,'Entry','#7adcf0');line(position?.protection?.active_stop??position?.protection?.original_stop,'Stop','#ffab73');line(position?.protection?.take_profit??position?.take_profit,'Target','#8ae3b4');chart.append(svg);
  }
  const savedQuote = symbol => data?.canonical_observations?.market_context?.market?.assets?.[symbol];
  const valueTone = n => n>0?'aa-positive':n<0?'aa-negative':'';
  function paintHeaderQuote(quote) {
    if(!banner)return;
    banner.querySelector('.aa-header-quote')?.remove();
    const summary=node('div',undefined,'aa-header-quote');
    const price=quote?.price, change=quote?.change_24h_pct;
    if(Number.isFinite(price)&&price>0){
      const value=node('strong',fmtPrice(price),'aa-quote-price');
      value.append(node('small',' USDT'));
      summary.append(value);
    }else summary.append(node('span','Price unavailable','aa-quote-unavailable'));
    if(Number.isFinite(change))summary.append(node('span',(change>0?'+':'')+change+'% / 24h','aa-quote-change '+valueTone(change)));
    const expiry=Date.parse(quote?.ticker_expires_at), expired=Number.isFinite(expiry)&&Date.now()>=expiry;
    const state=expired?'STALE':quote?.ticker_health||(quote?'UNKNOWN':'UNAVAILABLE');
    banner.insertBefore(summary,banner.lastElementChild);
    if(state==='AVAILABLE')return;
    const label=state==='STALE'||state==='CURRENT'?'Quote freshness':'Quote feed';
    const status=node('span',label+' \u00b7 '+state,'aa-quote-state');
    status.dataset.quoteState=state;
    summary.append(status);
  }
  async function renderOverview(body,a){
    const version=++overviewVersion,symbol=a.identity.instrument_id;
    const quote=savedQuote(symbol);
    if(quote){
      const market=node('details',undefined,'aa-market');
      market.append(node('summary','Market data details'),pairs([
        ['Source',quote.evidence?.ticker?.source||'UNKNOWN'],['Source timestamp',time(quote.ticker_observed_at)],
        ['Observed at',time(quote.evidence?.ticker?.observed_at)],['Expiry',time(quote.ticker_expires_at)],
        ['Feed health',quote.ticker_health||'UNKNOWN']
      ]));
      body.append(market);
    }
    const positionSummary=node('div',undefined,'aa-position-summary');
    positionSummary.hidden=true;
    const layout=node('div',undefined,'aa-overview-grid'),chartSection=section('Price chart'),positionSection=section('Open position');
    chartSection.classList.add('aa-chart-panel');
    const chart=node('div',undefined,'aa-chart');chart.append(node('p','Loading candle data...','aa-note'));
    const controls=node('div',undefined,'aa-timeframes');
    controls.setAttribute('role','group');controls.setAttribute('aria-label','Chart timeframe');
    [['15','15m'],['60','1h'],['240','4h']].forEach(([tf,label])=>{const b=node('button',label);b.type='button';b.setAttribute('aria-pressed',String(chartFrame===tf));b.addEventListener('click',()=>{if(chartFrame===tf)return;chartFrame=tf;controls.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button===b)));loadCandles();});controls.append(b);});
    chartSection.append(controls,chart);
    const pos=node('div','Loading position data...','aa-note');positionSection.append(pos);layout.append(chartSection,positionSection);
    body.append(positionSummary,layout);
    const canonical=node('details',undefined,'aa-evidence');canonical.append(node('summary','Canonical backend observations'),node('pre',JSON.stringify(data?.canonical_observations||{status:'UNAVAILABLE'},null,2),'aa-technical-json'));body.append(canonical);
    let p, candleRows=null, candleFrame=null, chartWidth=0, chartHeight=0;
    const timeframeLabel = frame => ({'15':'15m','60':'1h','240':'4h'})[frame] || frame;
    const paintChart = () => {
      chartWidth=chart.clientWidth;chartHeight=chart.clientHeight;
      drawCandles(chart,candleRows,p,timeframeLabel(candleFrame));
    };
    chartObserver=new ResizeObserver(()=>{
      if(candleRows&&candleFrame===chartFrame&&(chartWidth!==chart.clientWidth||chartHeight!==chart.clientHeight))paintChart();
    });
    chartObserver.observe(chart);
    const loadCandles=async()=>{const current=version,frame=chartFrame,label=timeframeLabel(frame);try{const r=await marketRead('kline',{category:'linear',symbol,interval:frame,limit:'80'});if(current!==overviewVersion||selected!==a||frame!==chartFrame)return;const rows=(r.list||[]).slice().reverse().map(x=>({time:Number(x[0]),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4])}));candleRows=rows;candleFrame=frame;paintChart();}catch{if(current===overviewVersion&&selected===a&&frame===chartFrame){candleRows=null;drawCandles(chart,[],p,label);}}};
    async function loadPosition(){
    let ledger=null;try{const r=await fetch(API+'paper',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const d=await r.json();if(d.version!=='paper-read-api-v1'||d.mode!=='paper'||d.open_positions?.availability!=='AVAILABLE'||!Array.isArray(d.open_positions?.items))throw Error();ledger=d.open_positions;}catch{}
    if(version!==overviewVersion||selected!==a)return;
    const matches=ledger?.items.filter(p=>p.exchange==='bybit'&&(p.symbol===symbol||p.symbol===symbol.replace(/USDT$/,''))&&(!p.instrument_type||p.instrument_type==='linear_perpetual'))||[];
    p=matches[0];const financials=p?.financials||{},protection=p?.protection||{},activeStop=protection.active_stop??protection.original_stop;
    if(!ledger)pos.textContent='POSITION DATA UNAVAILABLE';
    if(ledger){if(!p)pos.textContent='NO OPEN POSITION';else{const fresh=p.availability==='AVAILABLE'&&(!p.mark_expires_at||Date.now()<Date.parse(p.mark_expires_at)), numeric=(v)=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null,opened=Date.parse(p.entered_at),elapsed=Number.isFinite(opened)?Math.max(0,Date.now()-opened):null,duration=elapsed===null?'Unavailable':`${Math.floor(elapsed/3600000)}h ${Math.floor(elapsed%3600000/60000)}m`,pnl=fresh?(numeric(financials.estimated_net_pnl_usdt)??numeric(p.unrealized_pnl)):null;positionSummary.append(node('strong','Open position'),node('span',p.side,'aa-position-side '+tone(p.side)));
      if(numeric(p.leverage)!==null)positionSummary.append(node('span',p.leverage+'\u00d7 leverage'));
      if(numeric(p.entry_price)!==null)positionSummary.append(node('span','Entry '+fmtPrice(numeric(p.entry_price))+' USDT'));
      positionSummary.append(node('span',pnl===null?'Unrealised P/L unavailable':'Unrealised P/L '+fmtMoney(pnl),valueTone(pnl)));
      positionSummary.hidden=false;
      pos.className='aa-position-card';pos.replaceChildren(node('h4',`OPEN ${p.side} · ${numeric(p.leverage)!==null?p.leverage+'×':'Leverage unavailable'}`),pairs([['Size',numeric(financials.position_notional_usdt)===null?'Unavailable':fmtMoney(numeric(financials.position_notional_usdt))],['Entry',numeric(p.entry_price)===null?'Unavailable':fmtPrice(numeric(p.entry_price))+' USDT'],['Current',fresh&&numeric(p.current_mark)!==null?fmtPrice(numeric(p.current_mark))+' USDT':'STALE / unavailable'],['Stop loss',numeric(activeStop)===null?'Unavailable':fmtPrice(numeric(activeStop))+' USDT'],['Take profit',numeric(protection.take_profit??p.take_profit)===null?'Unavailable':fmtPrice(numeric(protection.take_profit??p.take_profit))+' USDT'],['Unrealised P/L',pnl===null?'Unavailable':fmtMoney(pnl)],['ROI',fresh&&numeric(financials.estimated_net_return_pct)!==null?numeric(financials.estimated_net_return_pct).toFixed(2)+'%':fresh&&numeric(financials.margin_used_usdt)>0&&numeric(p.unrealized_pnl)!==null?(numeric(p.unrealized_pnl)/numeric(financials.margin_used_usdt)*100).toFixed(2)+'%':'Unavailable'],['Duration',duration]], 'aa-fields'));}}
    if(candleRows&&candleFrame===chartFrame)paintChart();
    }
    loadCandles();loadPosition();
  }
  function renderDetail() {
    chartObserver?.disconnect();
    detail.replaceChildren();const body=node('div');body.id='aa-detail-panel';body.setAttribute('role','tabpanel');body.setAttribute('aria-labelledby','aa-tab-'+activeTab);body.tabIndex=0;detail.append(body);
    const a=selected,row=a.selection,assessment=object(a.selection_assessment);if(activeTab!==0)overviewVersion++;
    paintHeaderQuote(savedQuote(a.identity.instrument_id));
    if(activeTab===0){
      renderOverview(body,a);
    } else if(activeTab===1){
      body.append(node('p','Latest validated technical assessments. Expired or missing assessments are unavailable.','aa-note'));
      const labels={'15m':'15m — Short-Term','1h':'1h — Medium-Term','4h':'4h — Higher-Timeframe'};
      const present=entries=>entries.filter(([,v])=>v!==undefined&&v!==null&&v!==''&&(!Array.isArray(v)||v.length));
      frames.forEach(tf=>{
        const f=object(a.technical?.[tf]), original=object(f.recorded_payload), params=object(f.parameters);
        const block=section(labels[tf]);block.classList.add('aa-technical-frame');
        const expiry=Date.parse(f.expires_at), assessedAt=Date.parse(f.evaluated_at);
        if(f.status!=='ASSESSED'||f.state!=='CURRENT'||!Number.isFinite(expiry)||Date.now()>=expiry||!Number.isFinite(assessedAt)||assessedAt>Date.now()){
          block.append(node('p','Current technical analysis unavailable','aa-note'));
          if(f.evaluated_at||f.timestamp)block.append(node('p','Last update: '+time(f.evaluated_at||f.timestamp),'aa-technical-stamp'));
          body.append(block);return;
        }
        const state='CURRENT', exact=false;
        block.append(node('p','Current validated technical assessment','aa-note'),
          node('p','Last assessed '+time(f.evaluated_at),'aa-technical-stamp'));
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
        block.append(pairs(present([['Source candle',f.timestamp?time(f.timestamp):null],['Source at',f.source_at?time(f.source_at):null],['Observed at',f.observed_at?time(f.observed_at):null],['Original expiry',f.expires_at?time(f.expires_at):null],['Assessment age',age===null?null:`${age} seconds`],['Decision request',exact?f.request_key:null],['Freshness',state]])));
        const details=node('details',undefined,'aa-evidence');details.append(node('summary','Validated evidence & additional fields'),node('pre',JSON.stringify(Object.keys(original).length?original:f,null,2),'aa-technical-json'));block.append(details);body.append(block);
      });
    } else if(activeTab===2){
      const luna=object(a.luna), saved=object(luna.assessment);
      const themeHost=node('section');body.append(themeHost);const legacy=node('div');
      const statusLabel={RELEVANT_NEWS_AVAILABLE:'Relevant asset news available',HISTORICAL_NEWS_ONLY:'Historical evidence only; no new relevant news found',NO_RELEVANT_NEWS_FOUND:'No relevant news found',DISCOVERY_UNAVAILABLE:'Discovery unavailable',PARTIAL_DISCOVERY:'Discovery partially complete',ASSESSMENT_STALE:'Assessment stale',ASSESSMENT_UNAVAILABLE:'Assessment unavailable'}[luna.news_availability]||luna.news_availability||'Assessment status unavailable';
      legacy.append(section('Historical asset news & intelligence',node('p','Historical legacy assessment; not current intelligence supplied to SOL. Original timestamps and expiry are retained.','aa-note'),pairs([['Assessment',news(a)],['News outcome',statusLabel],['Scope',luna.scope||'ASSET_SPECIFIC'],['Coverage',luna.coverage],['Last successful news check',time(luna.discovery?.last_successful_check)],['Latest discovery attempt',time(luna.discovery?.checked_at)],['Assessed discovery attempt',time(luna.assessment_discovery?.checked_at)],['Assessed at',time(luna.timestamps?.timestamp)],['Original expiry',time(luna.timestamps?.expires_at)],['Implication',saved.implication],['Model',luna.model]]),node('p',saved.summary||luna.reason||'No reliably attributed asset-specific assessment is exposed.'),list(saved.uncertainty),list(luna.reasons)));
      if(array(luna.assessment_history).length)legacy.append(section('Earlier saved asset assessments',...array(luna.assessment_history).map(record=>{const old=object(record.data?.assessment);return section(time(record.timestamps?.timestamp),node('p',old.summary||'Summary unavailable.'),pairs([['State',record.state],['Expiry',time(record.timestamps?.expires_at)],['Implication',old.implication]]));})));
      ['bullish','bearish','catalysts','risks'].forEach(field=>{if(array(saved[field]).length)legacy.append(section(field,list(saved[field].map(c=>`${c.text} · ${array(c.evidence_ids).join(', ')}`))));});
      // Merge identical article versions across evidence generations, retaining all IDs.
      const canonicalUrl=reference=>{
        try{
          const url=new URL(reference);
          if(url.protocol!=='https:'||url.username||url.password)return String(reference||'');
          url.hash='';
          for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||/^(ref|source)$/i.test(key))url.searchParams.delete(key);
          url.searchParams.sort();
          if(url.hostname==='blog.ethereum.org'&&/^\/20\d{2}\//.test(url.pathname))url.pathname='/en'+url.pathname;
          return url.href;
        }catch{return String(reference||'');}
      };
      const articleVersions=new Map();
      const assessedAt=asTime(luna.timestamps?.timestamp);
      for(const [kind,items] of [['assessment',luna.news],['discovery',luna.verified_discovered_news],['history',luna.retained_historical_news]]){
        for(const item of array(items)){
          const url=canonicalUrl(item.provenance?.reference);
          const key=JSON.stringify([url,item.headline,item.summary||'',item.published_at]);
          const entry=articleVersions.get(key)||{item,labels:new Set(),ids:new Set(),lastVerified:null};
          if(kind==='assessment')entry.labels.add('Used in Luna assessment');
          if(kind==='discovery')entry.labels.add(item.evidence_status==='CURRENT_VERIFIED'?'Current verified discovery':'Latest saved discovery · freshness not classified');
          if(kind==='history'||item.evidence_status==='HISTORICAL_CONTEXT')entry.labels.add('Historical context · resolution unknown');
          const verified=item.last_verified_at||item.provenance?.observed_at;
          if(asTime(verified)>asTime(entry.lastVerified))entry.lastVerified=verified;
          if(kind==='discovery'&&Number.isFinite(assessedAt)){
            const firstSeen=asTime(item.first_verified_at||item.provenance?.observed_at);
            if(firstSeen>assessedAt)entry.labels.add('Discovered after the assessment');
            else if(asTime(verified)>assessedAt)entry.labels.add('Verified after the assessment');
          }
          if(item.evidence_id)entry.ids.add(item.evidence_id);
          articleVersions.set(key,entry);
        }
      }
      for(const {item,labels,ids,lastVerified} of articleVersions.values()){
        const article=section(item.headline,node('p',item.summary||'Article summary not recorded.'),
          pairs([['Evidence use',[...labels].join(' · ')],['Source',item.provenance?.source],
            ['Published',time(item.published_at)],['Last successfully verified',time(lastVerified)],
            ['Context',item.development_status],['Evidence IDs',[...ids].join(', ')||'Not used in this assessment']]));
        article.classList.add('aa-news-article');
        try {const u=new URL(item.provenance?.reference);if(u.protocol==='https:'&&!u.username&&!u.password){const link=node('a','Read source');link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';article.append(link);}} catch {}
        legacy.append(article);
      }
      const assetSources=node('ul');array(luna.provenance).filter(e=>!array(luna.news).some(item=>item.provenance?.reference===e.reference)).forEach(e=>{const li=node('li');li.append(node('span',`${value(e.evidence_id||e.id)} · ${value(e.source)} · ${time(e.published_at||e.observed_at)} `));try{const u=new URL(e.reference);if(u.protocol==='https:'&&!u.username&&!u.password){const link=node('a','Source');link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';li.append(link);}}catch{}assetSources.append(li);});
      if(assetSources.childElementCount)legacy.append(section('Saved asset sources',assetSources));
      const context=object(data.market_context), component=object(context.news_and_themes), content=object(component.content);
      legacy.append(section('Shared market context · not an asset-specific assessment',pairs([['Luna state',freshness(context)],['News state',freshness(component)],['Assessment time',time(context.source_at)],['News assessment time',time(component.source_at)],['News sentiment',content.sentiment],['Original expiry',time(context.expires_at)]]),node('p',value(context.assessment?.text)),node('p',value(content.summary)),list(content.uncertainty)));
      const identity=object(luna.identity), symbol=row.symbol.replace(/USDT$/,'');
      const identifiers=new Set([symbol,row.symbol,...array(identity.aliases),...array(identity.protocols),...array(identity.organizations),identity.project_name,identity.ecosystem].filter(x=>typeof x==='string'&&x.length>=4).map(x=>x.toLocaleLowerCase().trim()));
      const themes=array(content.themes).filter(t=>array(t.affected_markets).some(m=>identifiers.has(String(m).toLocaleLowerCase().trim())));
      legacy.append(section('Explicitly asset-targeted saved themes',themes.length?node('p','Matched against this asset’s curated project, alias and protocol identities in the saved affected-markets field.'):node('p','NOT_RECORDED · no saved theme explicitly identifies this project or affected asset.')));
      themes.forEach(t=>legacy.append(section(t.name,node('p',t.description),pairs([['Recorded implication',t.implication],['Evidence references',array(t.evidence_ids).join(', ')]]),node('h4','Catalysts'),list(array(t.catalysts).map(c=>c.text)),node('h4','Risks / conflicting evidence'),list(array(t.risks).map(c=>c.text)))));
      const sources=node('ul');array(component.provenance?.evidence).forEach(e=>{const li=node('li');li.append(node('span',`${value(e.id)} · ${value(e.source)} · ${time(e.published_at||e.observed_at)} · ${value(e.state)} `));try{const url=new URL(e.reference);if(url.protocol==='https:'&&!url.username&&!url.password){const link=node('a','Source');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';li.append(link);}}catch{}sources.append(li);});legacy.append(section('Saved market news sources',sources.childElementCount?sources:node('p','NOT_RECORDED')));
      window.EvolvingIntelligence.mount(themeHost,{asset:row.symbol,discovery:luna.discovery,legacy,canonical:data.canonical_observations?.theme_intelligence||null});
    } else if(activeTab===3){
      body.classList.add('aa-sol-tab');
      const records=array(a.sol?.records).map(d=>({...d,activity_type:'ENTRY'}));
      const planKey=typeof planContext?.request_key==='string'&&/^[a-f0-9]{64}$/.test(planContext.request_key)?planContext.request_key:null;
      const original=planContext?.originating_decision;
      // Only a persisted request key plus asset and direction may attach a plan receipt.
      if(planKey&&original?.request_key===planKey&&original.symbol===a.identity.instrument_id&&original.decision===planContext.side&&original.assessment_completed===true&&!records.some(d=>d.request_key===planKey))records.push({...original,activity_type:'ENTRY'});
      const reviews=array(a.position_reviews).map(d=>({...d,activity_type:'POSITION_REVIEW'}));
      const activity=[...records,...reviews].filter(d=>asTime(d.timestamp)>-Infinity).sort((x,y)=>asTime(y.timestamp)-asTime(x.timestamp));
      const decisionName=d=>String(d.decision||d.status||'').toUpperCase();
      const typeName=d=>d.activity_type==='ENTRY'?'Entry Decision':'Position Management';
      const reasoning=d=>d.reasoning||d.recorded_reasoning||'Recorded reasoning is unavailable.';
      const latest=activity[0];
      const matched=planKey?activity.find(d=>d.activity_type==='ENTRY'&&d.request_key===planKey&&d.decision===planContext.side):null;
      const markPlan=(card,d)=>{if(d!==matched)return;card.classList.add('aa-plan-origin');const label=node('span','Originating AI decision for selected plan','aa-plan-origin-label');const summary=card.querySelector(':scope > summary');if(summary)summary.append(label);else card.prepend(label);};
      if(planContext){
        const context=section('Selected conditional entry plan',node('p',`${row.symbol.replace(/USDT$/,'')} \u00b7 ${value(planContext.side)} \u00b7 ${value(planContext.status)}`,'aa-note'),node('p',planContext.status==='CLAIMED'?'Entry processing started; this plan does not confirm a fill.':'Awaiting entry confirmation; this plan is not an executed position.','aa-note'));
        context.classList.add('aa-plan-context');
        context.append(node('p',matched?'The originating AI decision is highlighted below. The latest decision may be different.':planKey?'Original AI decision unavailable in the returned records. Normal decision history remains available; the latest decision is not assumed to belong to this plan.':'Original AI decision unavailable: this plan has no reliable saved decision reference. Normal decision history remains available.','aa-plan-link-status'));
        body.append(context);
      }
      body.append(section('LATEST AI TRADING DECISION',latest?(()=>{
        const card=node('div',undefined,'aa-decision-card');
        card.append(node('div',undefined,'aa-decision-heading'));
        card.firstChild.append(badge(decisionName(latest)||'UNKNOWN',decisionName(latest)),node('span',typeName(latest),'aa-type-badge'));
        const stamp=node('time',time(latest.timestamp),'aa-sol-timestamp');stamp.dateTime=latest.timestamp;card.append(stamp);
        if(a.historical_only)card.append(node('p','Historical assessment','aa-note'));
        const directions=node('div',undefined,'aa-sol-directions'),saved=object(object(latest.decision_input).snapshot).evidence;
        ['5m','15m','1h','4h'].forEach(tf=>{const evidence=object(object(saved)['technical.'+tf]),dir=object(evidence.data).direction,arrow={UP:'\u2191',BULLISH:'\u2191',DOWN:'\u2193',BEARISH:'\u2193',FLAT:'\u2192',NEUTRAL:'\u2192',MIXED:'\u2194'}[dir];if(arrow){const indicator=node('span',`${tf} ${arrow} ${dir}`,tone(dir));indicator.title='Recorded decision-time direction - '+value(evidence.state);directions.append(indicator);}});
        if(directions.childElementCount)card.append(directions);
        if(latest.execution)card.append(node('p',`Recorded outcome: ${value(latest.execution)}`,'aa-outcome'));
        card.append(node('div',reasoning(latest),'aa-reasoning'));
        const technical=node('details',undefined,'aa-technical-details');technical.append(node('summary','Technical details'),pairs([['Position ID',latest.position_id],['Correlation ID',latest.request_key],['Cycle',latest.cycle_started_at],['Evidence references',array(latest.evidence_refs).join(', ')],['Record source',latest.source],['Blocking reason',[...array(latest.rejection),latest.error].filter(Boolean).join(', ')]].filter(([,v])=>v!==undefined&&v!=='')));const group=node('div',undefined,'aa-sol-evidence');group.append(technical,decisionEvidence(latest));card.append(group);markPlan(card,latest);return card;
      })():node('p','No AI decision or position review has been recorded for this asset.','aa-note')));
      if(planContext)body.append(body.firstChild);
      body.append(section('RESEARCH STATUS'));body.lastChild.classList.add('aa-sol-research');
      const statusPanel=body.lastChild;
      if(a.historical_only)statusPanel.append(badge('Current Research: NOT SELECTED','NOT_SELECTED'),node('p','Asset is not included in the latest research shortlist. Historical AI decisions and position management remain available.','aa-note'));
      else {
        const current=object(a.sol?.current_selection),currentDecision=object(a.sol?.current);
        const evaluated=current.status==='EVALUATED'&&currentDecision.decision;
        statusPanel.append(badge(current.status==='NO_CURRENT_SELECTION'?'Current Research: NOT SELECTED':evaluated?'Current research decision recorded':'Current research status unavailable',evaluated?currentDecision.decision:'NOT_SELECTED'));
        statusPanel.append(node('p',current.status==='NO_CURRENT_SELECTION'?'Asset is not included in the latest research shortlist. Historical AI decisions and position management remain available.':evaluated?`${value(currentDecision.decision)} · ${time(currentDecision.timestamp)}`:current.status==='CORRELATION_UNAVAILABLE'?'The saved research cycle could not be reliably matched to an AI decision. No current decision is inferred.':'No current-cycle AI decision is recorded. Historical decisions remain available.','aa-note'));
        if(evaluated)statusPanel.append(node('p',currentDecision.reasoning||'Recorded reasoning is unavailable.','aa-reasoning'));
      }
      body.append(node('p','AI decisions are recommendations; conditional entry plans await confirmation. OPENED records a paper position opening, not a pending plan or proof that a position is still open. See Open Positions and Trade History for recorded execution.','aa-note'));
      const previous=activity.slice(1);
      body.append(section('Previous SOL Decisions',previous.length?node('div',undefined,'aa-decision-list'):node('p','No earlier recorded AI decisions are available.','aa-note')));
      const decisionList=body.lastChild.querySelector('.aa-decision-list');
      if(decisionList)previous.forEach(d=>{const item=node('details',undefined,'aa-decision-row');const summary=node('summary');summary.append(node('time',time(d.timestamp)),badge(decisionName(d)||'UNKNOWN',decisionName(d)),node('span',typeName(d),'aa-type-badge'));if(d.execution)summary.append(node('span',value(d.execution),'aa-sol-execution'));item.append(summary);item.append(node('p',d.execution?`Recorded outcome: ${value(d.execution)}`:'Recorded outcome unavailable.','aa-outcome'),node('div',reasoning(d),'aa-reasoning'));
        const ev=array(d.evidence_refs);if(ev.length)item.append(pairs([['Supporting evidence',ev.join(', ')]]));
        const technical=node('details',undefined,'aa-technical-details');technical.append(node('summary','Technical details'),pairs([['Position ID',d.position_id],['Correlation ID',d.request_key],['Cycle',d.cycle_started_at],['Record source',d.source],['Blocking reason',[...array(d.rejection),d.error].filter(Boolean).join(', ')],['Stop loss',d.stop_loss],['Technical details',d.technical_details]].filter(([,v])=>v!==undefined&&v!=='')));item.append(technical,decisionEvidence(d));if(d===matched){item.open=true;markPlan(item,d);}decisionList.append(item);});
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
      const paperPromise=fetchJson('paper').catch(()=>null);
      let response;
      try {response=await fetchJson('asset-analysis');if(response.version!=='asset-analysis-read-v1'||response.mode!=='paper'||response.read_only!==true)throw Error('Invalid evidence contract');}
      catch {response=fallback(await paperPromise);}
      response.assets=array(response.assets).filter(validIdentity);
      // A validated universe in the detailed response needs no summary enrichment.
      const paper=includeUniverse(response,null).universe_known?null:await paperPromise;
      cachedEvidence=includeSavedIntelligence(includeUniverse(response,paper));cachedAt=Date.now();return cachedEvidence;
    })();
    try{return await pendingEvidence;}finally{pendingEvidence=null;}
  }
  let requestVersion=0;
  async function showAsset(symbol,side,options={}) {
    const version=++requestVersion;
    selected=null;activeTab=options.tab===3?3:0;planContext=null;renderTabs();paintBanner(symbol.replace(/USDT$/,''));panel.hidden=false;panel.setAttribute('aria-busy','true');
    try {
      const evidence=await readEvidence();
      if(version!==requestVersion)return;
      data=evidence;
      const instrument=symbol.endsWith('USDT')?symbol:symbol+'USDT';
      const matches=data.assets.filter(a=>a.identity.instrument_id===instrument);
      const asset=matches.find(a=>a.selection.side===side)||matches[0];
      if(!asset){detail.replaceChildren(node('p',`UNAVAILABLE · No verified saved analysis record was returned for ${instrument}. No analysis has been inferred.`,'aa-note'));return;}
      open(asset,null,{...options,tab:activeTab});
    } catch {
      if(version===requestVersion)detail.replaceChildren(node('p','UNAVAILABLE · saved V4.1 asset evidence could not be verified. Close and reopen to retry.','aa-note'));
    } finally {if(version===requestVersion)panel.setAttribute('aria-busy','false');}
  }
  function clear(keepContent=false){chartObserver?.disconnect();requestVersion++;planContext=null;if(!keepContent){selected=null;tabs.replaceChildren();detail.replaceChildren();}panel.setAttribute('aria-busy','false');}
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

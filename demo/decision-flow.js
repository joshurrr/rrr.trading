'use strict';
(() => {
  const key = document.body.dataset.bot;
  const config = {short:{status:'/api/demos/short/status',flow:'/api/demos/short/decision-flow',timeframe:'15m',strategy:'Short Term 15m',label:'15 min',confirmation:'1H'},long:{status:'/api/demos/long/status',flow:'/api/demos/long/decision-flow',timeframe:'4h',strategy:'Long Term 4hr',label:'4hr',confirmation:'1D'},medium:{status:'/status',flow:'/api/demos/medium/decision-flow',timeframe:'1h',strategy:'Medium 1hr',label:'1hr',confirmation:'4H'}}[key];
  if (!config) return;
  const $ = id => document.getElementById(id);
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  // Hide a repeated settlement currency in labels; keep feed identifiers intact.
  const pairLabel = pair => typeof pair === 'string' ? pair.replace(/^([A-Z0-9]+\/([A-Z0-9]+)):\2$/, '$1') : pair ?? '—';
  const esc = v => String(v ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const value = v => finite(v) ? new Intl.NumberFormat('en-US',{maximumFractionDigits:4}).format(v) : '—';
  const money = v => finite(v) ? v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' USDT' : '—';
  const pct = v => finite(v) ? (v>0?'+':'')+v.toFixed(2)+'%' : '—';
  const state = v => typeof v === 'string' && v.trim() ? v.toUpperCase() : 'UNKNOWN';
  const date = v => {
    // Existing trade feed uses naive UTC strings. Never interpret them as browser local time.
    const raw = typeof v === 'string' && /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d$/.test(v) ? v.replace(' ','T')+'Z' : v;
    return raw && Number.isFinite(Date.parse(raw)) ? new Date(raw).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' Brisbane' : '—';
  };
  const colour = v => /^(PASS|PASSED|ALLOWED|AVAILABLE|ACTIVE|OPEN|LONG|SHORT|ORDER SENT|SIGNAL)$/.test(v) ? 'pass' : /^(FAIL|TRIGGERED|MAX POSITIONS|POSITION ALREADY OPEN|BLOCKED.*)$/.test(v) ? 'block' : /^(WAIT|PENDING|SCANNING|STALE|FAIL-OPEN)$/.test(v) ? 'wait' : '';
  const row = (label, v, status = '') => `<div class="mini"><span>${esc(label)}</span><span class="${({pass:'ok',block:'bad',wait:'warn'})[colour(status)]||'unknown'}">${esc(v)}</span></div>`;
  function stage(id, outcome, content) {
    const node=$(id), s=state(outcome);
    node.className='node '+colour(s)+(id==='final'?' decision':'');
    node.querySelector('.node-main,.big').textContent=s;
    node.querySelector('.contents').innerHTML=content;
  }
  function metric(id, text, amount) {
    $(id).textContent=text;
    $(id).className='v '+(finite(amount)&&amount>0?'good':finite(amount)&&amount<0?'bad':'');
  }
  let statusSeen=false, flowSeen=false, busy=false, savedMacro=null, macroState='UNAVAILABLE';
  function brisbaneDay(now=new Date()) {
    const fields=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
    return `${fields.year}-${fields.month}-${fields.day}`;
  }
  function expectedMacroDay(now=new Date()) {
    const hour=Number(new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',hour:'2-digit',hourCycle:'h23'}).format(now));
    return brisbaneDay(hour<7?new Date(now.getTime()-86400000):now);
  }
  async function loadMacro() {
    savedMacro=null; macroState='UNAVAILABLE';
    try {
      const day=expectedMacroDay();
      const response=await fetch('https://api.rrr.trading/api/reports/macro/'+(day===brisbaneDay()?'today':day),{cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!response.ok) return;
      const report=await response.json();
      const score=report.macro_score, generated=Date.parse(report.generated_at);
      if(report.report_type!=='macro_base'||report.timezone!=='Australia/Brisbane'||typeof report.macro_regime!=='string'||!report.macro_regime.trim()||!Number.isFinite(generated)||generated>Date.now()||(score!==null&&(!finite(score)||score<0||score>100))) return;
      if(report.report_date!==expectedMacroDay()||brisbaneDay(new Date(generated))!==report.report_date) { macroState='STALE'; return; }
      savedMacro=report; macroState=score===null?'UNAVAILABLE':'AVAILABLE';
    } catch { /* Failed refresh must not present a previous report as current. */ }
  }
  function renderStatus(d) {
    const b=d.bot,p=d.portfolio||{};
    statusSeen=true;
    for(const id of ['settings','performance','trades-panel']) $(id).classList.remove('stale');
    $('bot-state').textContent=state(b.state);
    $('status-time').textContent='· bot observation '+date(new Date(d.generated_at*1000).toISOString());
    $('metrics-status').textContent='Settings and performance · public '+config.label+' bot feed';
    $('metrics-status').hidden=key==='long'||key==='short';
    $('trades-status').textContent=Array.isArray(d.open_trades)?d.open_trades.length+' open positions':'UNAVAILABLE';
    const exchange=typeof b.exchange==='string'?b.exchange.trim():'';
    metric('exchange',exchange?exchange[0].toUpperCase()+exchange.slice(1):'—');
    metric('starting',finite(p.starting_balance)?Math.round(p.starting_balance).toLocaleString('en-US')+' USDT':'—');
    metric('maxOpen',b.max_open_trades===-1?'Unlimited':finite(b.max_open_trades)&&b.max_open_trades>=0?String(b.max_open_trades):'—');
    const amount=typeof b.stake_amount==='string'&&b.stake_amount.trim()?Number(b.stake_amount):b.stake_amount;
    metric('maxTrade',b.stake_amount==='unlimited'?'Unlimited':finite(amount)&&amount>=0?Math.round(amount).toLocaleString('en-US')+' USDT':'—');
    const minutes=finite(b.started_at)&&b.started_at>0&&b.started_at<=d.generated_at?Math.floor((d.generated_at-b.started_at)/60):null;
    metric('runtime',minutes===null?'—':minutes>=1440?Math.floor(minutes/1440)+'d '+Math.floor(minutes/60)%24+'h':minutes>=60?Math.floor(minutes/60)+'h '+minutes%60+'m':minutes+'m');
    const count=v=>Number.isSafeInteger(v)&&v>=0;
    metric('winRate',count(p.winning_trades)&&count(p.losing_trades)?`${p.winning_trades} wins · ${p.losing_trades} losses`:'—');
    metric('profit',money(p.profit_all_abs),p.profit_all_abs);
    metric('profitPct',pct(p.profit_all_pct),p.profit_all_pct);
    const drawdown=finite(p.max_drawdown)&&p.max_drawdown>=0?-100*p.max_drawdown:null;
    metric('drawdown',pct(drawdown),drawdown);
    metric('completed',key==='medium'?(count(p.winning_trades)&&count(p.losing_trades)?String(p.winning_trades+p.losing_trades):'—'):count(p.closed_trades)?String(p.closed_trades):'—');
    if (key==='medium'||key==='short') {
      window.renderDemoAssets?.(b.pairs);
      const history=Array.isArray(d.history)?d.history:[];
      $('completed-status').textContent=Array.isArray(d.history)?history.length+' recent completed trades':'UNAVAILABLE';
      const rationale=t=>({roi:'Profit target',stop_loss:'Stop loss',trailing_stop_loss:'Trailing stop',force_exit:'Manual close',exit_signal:'Strategy exit',hourly_verified_critical_risk:'Verified critical news risk'})[t.exit_reason]||'Strategy trade';
      $('completed-trades').innerHTML=history.map(t=>'<tr><td>'+esc(pairLabel(t.pair))+'</td><td>'+esc(t.direction)+'</td><td>'+esc(money(t.open_rate))+'</td><td>'+esc(money(t.close_rate))+'</td><td>'+esc(money(t.profit_abs))+' '+esc(finite(t.profit_pct)?'('+pct(t.profit_pct)+')':'')+'</td><td>'+esc(rationale(t))+'</td><td>'+esc(date(t.close_date))+'</td></tr>').join('');
    }
    $('open-trades').innerHTML=Array.isArray(d.open_trades)?d.open_trades.map(t=>`<tr><td>${esc(pairLabel(t.pair))}</td><td>${esc(t.direction)}</td><td>${esc(money(t.open_rate))}</td><td>${esc(money(t.current_rate))}</td><td>${esc(finite(t.stake_amount)&&t.stake_amount>=0?money(t.stake_amount):'—')}</td><td class="${finite(t.profit_abs)&&t.profit_abs>0?'good':finite(t.profit_abs)&&t.profit_abs<0?'bad':''}">${esc(money(t.profit_abs))} ${esc(finite(t.profit_pct)?'('+pct(t.profit_pct)+')':'')}</td><td>${esc(date(t.open_date))}</td><td>Strategy entry · detailed rationale unavailable</td></tr>`).join(''):'';
  }
  function renderFlow(d) {
    flowSeen=true;
    for(const id of ['flow','last-decision','recent-decisions','exit-panel']) $(id).classList.remove('stale');
    $('flow-status').textContent='Diagnostics observed '+date(new Date(d.generated_at*1000).toISOString())+' · candle times below are bot candle close times';
    const scan=Array.isArray(d.market_scan)?d.market_scan:[];
    const scanNote=$('entry-scan-status');
    if(scanNote) {
      const latest=Math.max(...scan.map(s=>Date.parse(s.timestamp)));
      const complete=scan.length>0&&new Set(scan.map(s=>s.pair)).size===scan.length&&scan.every(s=>Date.parse(s.timestamp)===latest&&['NO SIGNAL','SIGNAL','OPEN'].includes(s.state))&&latest<=Date.now()&&Date.now()-latest<=17*60000;
      const signals=scan.filter(s=>s.state==='SIGNAL').length;
      scanNote.textContent=!complete?'Entry scan incomplete or stale · a reason for having no trades cannot be verified.':signals?signals+' technical candidate'+(signals===1?'':'s')+' · context, per-bot admission and order confirmation still required.':scan.every(s=>s.state==='NO SIGNAL')?'No entry signals across all '+scan.length+' scanned assets · closed candle '+date(new Date(latest).toISOString())+'.':'No new technical candidates in the supplied scan · existing positions are monitored separately.';
    }
    stage('scan','UNKNOWN',row('Configured assets',scan.length)+scan.map(s=>row(pairLabel(s.pair),state(s.state),state(s.state))).join(''));
    $('scan').querySelector('.node-main').textContent=scan.length?scan.length+' assets':'UNAVAILABLE';
    const technical=d.technical||{}, indicators=technical.values||{};
    // Use the recorded entry flag for this exact pair and closed candle.
    const hasCandle=typeof technical.pair==='string'&&Number.isFinite(Date.parse(technical.timestamp));
    const observation=hasCandle?scan.find(s=>s.pair===technical.pair&&s.timestamp===technical.timestamp):null;
    const finalObservation=d.final_decision||{};
    const noEntry=hasCandle&&finalObservation.state==='NO SIGNAL'&&finalObservation.pair===technical.pair&&finalObservation.timestamp===technical.timestamp;
    const technicalState=state(technical.state)!=='UNKNOWN'?technical.state:
      observation&&['SIGNAL','NO SIGNAL'].includes(observation.state)?observation.state:noEntry?'NO SIGNAL':'UNKNOWN';
    stage('technical',technicalState,row('Evaluated pair',pairLabel(technical.pair))+['ema20','ema50','ema200','rsi','macd','macdsignal','volume'].map(k=>row(({ema20:'EMA 20',ema50:'EMA 50',ema200:'EMA 200',rsi:'RSI',macd:'MACD',macdsignal:'MACD signal',volume:'Volume'})[k],value(indicators[k]))).join('')+row('Per-check outcomes','UNKNOWN')+`<p class="why">Closed analyzed candle: ${esc(date(technical.timestamp))}. Raw values; checklist outcomes are not retained.</p>`);
    const daily=(key!=='long'?d.higher_timeframe_trend:d.daily_trend)||{}, vals=daily.values||{};
    const trendAvailable=daily.fresh===true&&['ema20','ema50','ema200','close'].every(k=>finite(vals[k]));
    const trend=trendAvailable?(vals.ema20>vals.ema50&&vals.ema50>vals.ema200&&vals.close>vals.ema50?'UPTREND':
      vals.ema20<vals.ema50&&vals.ema50<vals.ema200&&vals.close<vals.ema50?'DOWNTREND':'MIXED'):'UNKNOWN';
    const pricePosition=trendAvailable?(vals.close>vals.ema200?'ABOVE':vals.close<vals.ema200?'BELOW':'AT EMA200'):'UNKNOWN';
    const direction=observation?.direction;
    const conflict=key==='medium'&&direction==='LONG'?'NOT REQUIRED':trendAvailable&&['LONG','SHORT'].includes(direction)?
      ((direction==='LONG'&&trend==='UPTREND')||(direction==='SHORT'&&trend==='DOWNTREND')?'NO':'YES'):
      technicalState==='NO SIGNAL'?'NO ENTRY SIGNAL':'UNKNOWN';
    const trendState=daily.fresh===false?'STALE':state(daily.state)!=='UNKNOWN'?daily.state:trend;
    stage('daily',trendState,row(config.confirmation+' observed trend',trend)+row('Price vs EMA200',pricePosition)+row('Trend conflict',conflict)+row(config.confirmation+' data',daily.fresh===true?'FRESH':daily.fresh===false?'STALE':'UNKNOWN',daily.fresh===false?'STALE':'')+['ema20','ema50','ema200','close'].map(k=>row(config.confirmation+' '+k,value(vals[k]))).join('')+'<p class="why">Observed trend uses the supplied EMA order and price vs EMA50. Individual confirmation checks are not retained; this reading does not prove entry approval.</p>');
    const tr=d.traderouter||{}, recorded=!!tr.macro, macro=tr.macro||(savedMacro?{available:macroState==='AVAILABLE',fresh:true,source_score_0_100:savedMacro.macro_score,regime:savedMacro.macro_regime,confidence:savedMacro.confidence,coverage:savedMacro.scoring?.coverage,report_date:savedMacro.report_date,updated_at:savedMacro.generated_at}:{}), crypto=tr.crypto||{}, asset=tr.asset||{};
    const layerState=l=>l.fresh===false?'STALE':l.available===false?'UNAVAILABLE':l.available===true&&l.fresh===true?'AVAILABLE':'UNKNOWN';
    const noSignal=d.final_decision?.state==='NO SIGNAL', checkState=recorded?tr.state:noSignal?'NOT REQUIRED':'UNKNOWN';
    const dataState=recorded?layerState(macro):macroState;
    const calendarNote=key==='long'?'The separate four-hour guard checks available saved primary calendars. Its decisions and partial calendar coverage are not published in this legacy card.':key==='medium'?'The separate hourly guard uses partial saved primary calendars and verified news. Its individual votes are not published in this legacy card; full economic calendar coverage remains unavailable.':'Economic calendar unavailable.';
    stage('intelligence',checkState,row('Macro data',dataState,dataState)+row('Macro score',finite(macro.source_score_0_100)?value(macro.source_score_0_100)+' / 100':'—')+row('Macro regime',state(macro.regime))+row('Macro direction',state(tr.macro_direction))+row('Confidence',finite(macro.confidence)?value(macro.confidence)+'%':'—')+row('Data coverage',finite(macro.coverage)?value(macro.coverage*100)+'%':'—')+row('Report date',macro.report_date??'—')+row('Report generated',date(macro.updated_at))+row('Crypto context',layerState(crypto)==='AVAILABLE'?state(crypto.regime):layerState(crypto))+row('Asset context',layerState(asset)==='AVAILABLE'?state(asset.regime):layerState(asset))+row('Research flags',state(tr.research_flags))+row('Entry veto',state(tr.entry_veto),tr.entry_veto==='ACTIVE'?'FAIL':state(tr.entry_veto))+`<p class="why">${recorded?'Recorded candidate context only.':(noSignal?'No entry signal; candidate check not required.':'Candidate check has no retained context.')+' Saved daily FRED report shown separately; it does not verify a bot entry check.'} Confidence describes source evidence. ${calendarNote} <a href="/#macro-base">Report and observation dates</a>.</p>`);
    const r=d.risk||{};
    const riskState=state(r.state);
    const riskHeading=noSignal?'NO ENTRY TO CHECK':riskState==='UNKNOWN'?'NOT RECORDED':
      riskState==='PASS'?'PASSED':riskState==='FAIL'?'BLOCKED':riskState;
    stage('risk',riskHeading,row('Open positions',value(r.open_positions)+' / '+(r.max_open_positions===-1?'Unlimited':value(r.max_open_positions)))+row('Position capacity',state(r.capacity),state(r.capacity))+row('Max trade amount',r.stake_amount==='unlimited'?'Unlimited':money(typeof r.stake_amount==='string'&&r.stake_amount.trim()?Number(r.stake_amount):r.stake_amount))+row('Configured stop-loss',finite(r.stoploss)?pct(r.stoploss*100):'—')+row('Stop protection','UNKNOWN')+row('Exposure',state(r.exposure))+`<p class="why">${noSignal?'No entry signal on the evaluated candle; no entry risk outcome is required.':'Capacity is a current count, not a completed entry risk decision.'}</p>`);
    const final=d.final_decision||{};
    stage('final',final.state,`<p class="why">${esc(final.reason||'Actual decision reason unavailable.')}</p>`+row('Pair',pairLabel(final.pair))+row('Evaluated',date(final.timestamp))+row('Order sent',state(final.order_sent)));
    const last=d.last_decision;
    $('last-decision').textContent=last?`Last retained entry decision · ${date(last.timestamp)} · ${pairLabel(last.pair)} · ${state(last.state)} · ${last.reason||'Reason unavailable'}`:'Last retained entry decision · UNAVAILABLE';
    $('history-status').textContent='Retained entry-confirmation records · newest first · '+state(d.history_state)+' · not every candle evaluation';
    const history=Array.isArray(d.recent_decisions)?d.recent_decisions.slice().sort((a,b)=>(Date.parse(b.timestamp)||0)-(Date.parse(a.timestamp)||0)).slice(0,20):[];
    $('recent-decisions').innerHTML=history.length?history.map(item=>`<div class="event"><span class="muted">${esc(date(item.timestamp))}</span><span>${esc(pairLabel(item.pair))}</span><span><span class="badge ${colour(state(item.state))}">${esc(state(item.state))}</span> ${esc(item.reason||'Reason unavailable.')}</span></div>`).join(''):'<p class="muted">No retained decisions available. Missing history does not mean WAIT or no signal.</p>';
    const exits=Array.isArray(d.exit_monitoring)?d.exit_monitoring:[];
    $('exit-status').textContent=key==='long'?'Closed-candle observations · live intrabar exit checks are not supplied by the public API.':'Closed-candle exit flags · intrabar monitoring UNKNOWN';
    const exitFields=[['Trend intact','trend'],['Momentum intact','momentum'],['Stop price','stop_loss'],['Trailing stop','trailing_stop'],['Profit target','profit_target']];
    const suppliedExitField=(e,k)=>k==='stop_loss'?finite(e[k])&&e[k]>0:!['UNKNOWN','UNAVAILABLE'].includes(state(e[k]));
    const missingExitFields=exitFields.filter(([,k])=>exits.some(e=>!suppliedExitField(e,k))).map(([label])=>label.toLowerCase());
    const exitNote=key==='long'&&exits.length?`<p class="why">${missingExitFields.length?esc('Not supplied for some or all positions: '+missingExitFields.join(', ')+'. '):''}INACTIVE means the last closed candle did not trigger a strategy exit. It does not report the current stop, trailing or profit-target check. Missing telemetry does not establish that exit protection is disabled.</p>`:'';
    $('exit-monitoring').innerHTML=exits.length?exitNote+exits.map(e=>`<h4>${esc(pairLabel(e.pair))}</h4>`+row('Candle close',date(e.timestamp))+(key==='long'?exitFields.filter(([,k])=>suppliedExitField(e,k)).map(([label,k])=>row(label,k==='stop_loss'?money(e[k]):state(e[k]))).join(''):row('Trend intact',state(e.trend))+row('Momentum intact',state(e.momentum))+row('Stop price',money(e.stop_loss))+row('Trailing stop',state(e.trailing_stop))+row('Profit target',state(e.profit_target)))+row('Exit signal',key==='long'&&state(e.exit_signal)==='UNKNOWN'?'Not supplied':state(e.exit_signal),state(e.exit_signal))).join(''):'<p class="muted">No active position exit diagnostics supplied.</p>';
    window.renderAssetBranches?.(d,{savedMacro,macroState});
    window.renderLongEntryProgress?.(d);
    $('diagnostic-note').textContent=d.note||'Missing checks and order outcomes remain UNKNOWN.';
  }
  async function request(path, timeout) {
    const response=await fetch('https://api.rrr.trading'+path,{cache:'no-store',signal:AbortSignal.timeout(timeout)});
    if(!response.ok) throw Error('UNAVAILABLE');
    const data=await response.json();
    if(data.ok!==true) throw Error('UNAVAILABLE');
    if(!finite(data.generated_at)||Math.abs(Date.now()/1000-data.generated_at)>30) throw Error('STALE');
    return data;
  }
  async function load() {
    if(busy) return;
    busy=true;
    try {
      const macroLoad=loadMacro();
      const results=await Promise.allSettled([
        request(config.status,10000).then(d=>{
          const b=d.bot||{};
          if((key!=='medium'&&d.demo!==key)||b.timeframe!==config.timeframe||b.mode!=='PAPER'||b.strategy!==config.strategy||b.exchange!=='bybit'||b.stake_currency!=='USDT'||b.trading_mode!=='futures'||b.margin_mode!=='isolated'||b.short_allowed!==true) throw Error('UNAVAILABLE');
          renderStatus(d);
        }),
        request(config.flow,30000).then(async d=>{
          if(d.bot!==key||d.timeframe!==config.timeframe) throw Error('UNAVAILABLE');
          await macroLoad;
          renderFlow(d);
        })
      ]);
      await macroLoad;
      if(results[0].status==='rejected') {
        const reason=results[0].reason.message==='STALE'?'STALE':'UNAVAILABLE';
        $('bot-state').textContent=reason;
        $('status-time').textContent=statusSeen?'· previous observation retained; not current':'· bot feed unavailable';
        $('metrics-status').textContent=reason+(statusSeen?' · previous values retained':'');
        $('metrics-status').hidden=false;
        if (key==='medium'||key==='short') {
          window.renderDemoAssets?.(null,'Bot asset universe unavailable.');
          $('completed-status').textContent=reason+' · recent completed trades unavailable';
          $('completed-trades').replaceChildren();
        }
        $('trades-status').textContent=reason+(statusSeen?' · previous trades retained; not current':'');
        for(const id of ['settings','performance','trades-panel']) $(id).classList.add('stale');
      }
      if(results[1].status==='rejected') {
        const reason=results[1].reason.message==='STALE'?'STALE':'UNAVAILABLE';
        if($('entry-scan-status')) $('entry-scan-status').textContent='Entry scan '+reason+' · a reason for having no trades cannot be verified.';
        window.assetFlowUnavailable?.(reason);
        window.longEntryProgressUnavailable?.(reason);
        $('flow-status').textContent='Diagnostics '+reason+(flowSeen?' · previous observations retained; not current':' · no public diagnostic observations available');
        for(const id of ['flow','last-decision','recent-decisions','exit-panel']) $(id).classList.add('stale');
        $('risk').querySelector('.node-main').textContent=reason;
        stage('final','UNKNOWN','<p class="why">Diagnostics '+reason+'. A current final decision cannot be verified.</p>'+row('Order sent','UNKNOWN'));
        $('exit-status').textContent=key==='long'?reason+(flowSeen?' · previous candle observations retained; current exit state cannot be verified.':' · current exit state cannot be verified.'):reason+' · current exit state UNKNOWN';
        $('history-status').textContent=reason+' · retained history is not a current decision';
      }
    } finally { busy=false; }
  }
  window.loadDecisionFlow=load;
  load(); setInterval(load,15000);
})();

'use strict';
(() => {
  const key = document.body.dataset.bot;
  const config = {short:{status:'/api/demos/short/status',flow:'/api/demos/short/decision-flow',timeframe:'15m',strategy:'Short Term 15m',label:'15 min',confirmation:'1H'},long:{status:'/api/demos/long/status',flow:'/api/demos/long/decision-flow',timeframe:'4h',strategy:'Long Term 4hr',label:'4hr',confirmation:'1D'},medium:{status:'/status',flow:'/api/demos/medium/decision-flow',timeframe:'1h',strategy:'Medium 1hr',label:'1hr',confirmation:'4H'}}[key];
  if (!config) return;
  const $ = id => document.getElementById(id);
  const finite = v => typeof v === 'number' && Number.isFinite(v);
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
  const colour = v => /^(PASS|ALLOWED|AVAILABLE|ACTIVE|OPEN|LONG|SHORT|ORDER SENT|SIGNAL)$/.test(v) ? 'pass' : /^(FAIL|TRIGGERED|MAX POSITIONS|POSITION ALREADY OPEN|BLOCKED.*)$/.test(v) ? 'block' : /^(WAIT|PENDING|SCANNING|STALE|FAIL-OPEN)$/.test(v) ? 'wait' : '';
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
  let statusSeen=false, flowSeen=false, busy=false;
  function renderStatus(d) {
    const b=d.bot,p=d.portfolio||{};
    statusSeen=true;
    for(const id of ['settings','performance','trades-panel']) $(id).classList.remove('stale');
    $('bot-state').textContent=state(b.state);
    $('status-time').textContent='· bot observation '+date(new Date(d.generated_at*1000).toISOString());
    $('metrics-status').textContent='Settings and performance · public '+config.label+' bot feed';
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
      const rationale=t=>({roi:'Profit target',stop_loss:'Stop loss',trailing_stop_loss:'Trailing stop',force_exit:'Manual close',exit_signal:'Strategy exit'})[t.exit_reason]||'Strategy trade';
      $('completed-trades').innerHTML=history.map(t=>'<tr><td>'+esc(t.pair)+'</td><td>'+esc(t.direction)+'</td><td>'+esc(money(t.open_rate))+'</td><td>'+esc(money(t.close_rate))+'</td><td>'+esc(money(t.profit_abs))+' '+esc(finite(t.profit_pct)?'('+pct(t.profit_pct)+')':'')+'</td><td>'+esc(rationale(t))+'</td><td>'+esc(date(t.close_date))+'</td></tr>').join('');
    }
    $('open-trades').innerHTML=Array.isArray(d.open_trades)?d.open_trades.map(t=>`<tr><td>${esc(t.pair)}</td><td>${esc(t.direction)}</td><td>${esc(money(t.open_rate))}</td><td>${esc(money(t.current_rate))}</td><td>${esc(finite(t.stake_amount)&&t.stake_amount>=0?money(t.stake_amount):'—')}</td><td class="${finite(t.profit_abs)&&t.profit_abs>0?'good':finite(t.profit_abs)&&t.profit_abs<0?'bad':''}">${esc(money(t.profit_abs))} ${esc(finite(t.profit_pct)?'('+pct(t.profit_pct)+')':'')}</td><td>${esc(date(t.open_date))}</td><td>Strategy entry · detailed rationale unavailable</td></tr>`).join(''):'';
  }
  function renderFlow(d) {
    flowSeen=true;
    for(const id of ['flow','last-decision','recent-decisions','exit-panel']) $(id).classList.remove('stale');
    $('flow-status').textContent='Diagnostics observed '+date(new Date(d.generated_at*1000).toISOString())+' · candle times below are bot candle close times';
    const scan=Array.isArray(d.market_scan)?d.market_scan:[];
    stage('scan','UNKNOWN',row('Configured assets',scan.length)+scan.map(s=>row(s.pair,state(s.state),state(s.state))).join(''));
    $('scan').querySelector('.node-main').textContent=scan.length?scan.length+' assets':'UNAVAILABLE';
    const technical=d.technical||{}, indicators=technical.values||{};
    stage('technical',technical.state,row('Evaluated pair',technical.pair??'—')+['ema20','ema50','ema200','rsi','macd','macdsignal','volume'].map(k=>row(({ema20:'EMA 20',ema50:'EMA 50',ema200:'EMA 200',rsi:'RSI',macd:'MACD',macdsignal:'MACD signal',volume:'Volume'})[k],value(indicators[k]))).join('')+row('Per-check outcomes','UNKNOWN')+`<p class="why">Closed analyzed candle: ${esc(date(technical.timestamp))}. Raw values; checklist outcomes are not retained.</p>`);
    const daily=(key!=='long'?d.higher_timeframe_trend:d.daily_trend)||{}, vals=daily.values||{};
    stage('daily',daily.state,row(config.confirmation+' direction','UNKNOWN')+row('Price vs EMA200','UNKNOWN')+row('Trend conflict','UNKNOWN')+row(config.confirmation+' data',daily.fresh===true?'FRESH':daily.fresh===false?'STALE':'UNKNOWN',daily.fresh===false?'STALE':'')+['ema20','ema50','ema200','close'].map(k=>row(config.confirmation+' '+k,value(vals[k]))).join(''));
    const tr=d.traderouter||{}, macro=tr.macro||{}, crypto=tr.crypto||{}, asset=tr.asset||{};
    const layerState=l=>l.fresh===false?'STALE':l.available===false?'UNAVAILABLE':l.available===true&&l.fresh===true?'AVAILABLE':'UNKNOWN';
    stage('intelligence',tr.state,row('Macro data',layerState(macro),layerState(macro))+row('Macro score',finite(macro.source_score_0_100)?value(macro.source_score_0_100)+' / 100':'—')+row('Macro regime',state(macro.regime))+row('Macro direction',state(tr.macro_direction))+row('Confidence',finite(macro.confidence)?value(macro.confidence)+'%':'—')+row('Data coverage',finite(macro.coverage)?value(macro.coverage*100)+'%':'—')+row('Crypto context',layerState(crypto)==='AVAILABLE'?state(crypto.regime):layerState(crypto))+row('Asset context',layerState(asset)==='AVAILABLE'?state(asset.regime):layerState(asset))+row('Research flags',state(tr.research_flags))+row('Entry veto',state(tr.entry_veto),tr.entry_veto==='ACTIVE'?'FAIL':state(tr.entry_veto))+`<p class="why">Recorded candidate context only. Confidence describes source evidence. Economic calendar unavailable.</p>`);
    const r=d.risk||{};
    stage('risk',r.state,row('Open positions',value(r.open_positions)+' / '+(r.max_open_positions===-1?'Unlimited':value(r.max_open_positions)))+row('Position capacity',state(r.capacity),state(r.capacity))+row('Max trade amount',r.stake_amount==='unlimited'?'Unlimited':money(typeof r.stake_amount==='string'&&r.stake_amount.trim()?Number(r.stake_amount):r.stake_amount))+row('Configured stop-loss',finite(r.stoploss)?pct(r.stoploss*100):'—')+row('Stop protection','UNKNOWN')+row('Exposure',state(r.exposure))+`<p class="why">Capacity is a current count, not a completed entry risk decision.</p>`);
    const final=d.final_decision||{};
    stage('final',final.state,`<p class="why">${esc(final.reason||'Actual decision reason unavailable.')}</p>`+row('Pair',final.pair??'—')+row('Evaluated',date(final.timestamp))+row('Order sent',state(final.order_sent)));
    const last=d.last_decision;
    $('last-decision').textContent=last?`Last retained entry decision · ${date(last.timestamp)} · ${last.pair??'—'} · ${state(last.state)} · ${last.reason||'Reason unavailable'}`:'Last retained entry decision · UNAVAILABLE';
    $('history-status').textContent='Retained entry-confirmation records · newest first · '+state(d.history_state)+' · not every candle evaluation';
    const history=Array.isArray(d.recent_decisions)?d.recent_decisions.slice().sort((a,b)=>(Date.parse(b.timestamp)||0)-(Date.parse(a.timestamp)||0)).slice(0,20):[];
    $('recent-decisions').innerHTML=history.length?history.map(item=>`<div class="event"><span class="muted">${esc(date(item.timestamp))}</span><span>${esc(item.pair)}</span><span><span class="badge ${colour(state(item.state))}">${esc(state(item.state))}</span> ${esc(item.reason||'Reason unavailable.')}</span></div>`).join(''):'<p class="muted">No retained decisions available. Missing history does not mean WAIT or no signal.</p>';
    const exits=Array.isArray(d.exit_monitoring)?d.exit_monitoring:[];
    $('exit-status').textContent='Closed-candle exit flags · intrabar monitoring UNKNOWN';
    $('exit-monitoring').innerHTML=exits.length?exits.map(e=>`<h4>${esc(e.pair)}</h4>`+row('Candle close',date(e.timestamp))+row('Trend intact',state(e.trend))+row('Momentum intact',state(e.momentum))+row('Stop price',money(e.stop_loss))+row('Trailing stop',state(e.trailing_stop))+row('Profit target',state(e.profit_target))+row('Exit signal',state(e.exit_signal),state(e.exit_signal))).join(''):'<p class="muted">No active position exit diagnostics supplied.</p>';
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
      const results=await Promise.allSettled([
        request(config.status,10000).then(d=>{
          const b=d.bot||{};
          if((key!=='medium'&&d.demo!==key)||b.timeframe!==config.timeframe||b.mode!=='PAPER'||b.strategy!==config.strategy||b.exchange!=='bybit'||b.stake_currency!=='USDT'||b.trading_mode!=='futures'||b.margin_mode!=='isolated'||b.short_allowed!==true) throw Error('UNAVAILABLE');
          renderStatus(d);
        }),
        request(config.flow,30000).then(d=>{
          if(d.bot!==key||d.timeframe!==config.timeframe) throw Error('UNAVAILABLE');
          renderFlow(d);
        })
      ]);
      if(results[0].status==='rejected') {
        const reason=results[0].reason.message==='STALE'?'STALE':'UNAVAILABLE';
        $('bot-state').textContent=reason;
        $('status-time').textContent=statusSeen?'· previous observation retained; not current':'· bot feed unavailable';
        $('metrics-status').textContent=reason+(statusSeen?' · previous values retained':'');
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
        $('flow-status').textContent='Diagnostics '+reason+(flowSeen?' · previous observations retained; not current':' · no public diagnostic observations available');
        for(const id of ['flow','last-decision','recent-decisions','exit-panel']) $(id).classList.add('stale');
        stage('final','UNKNOWN','<p class="why">Diagnostics '+reason+'. A current final decision cannot be verified.</p>'+row('Order sent','UNKNOWN'));
        $('exit-status').textContent=reason+' · current exit state UNKNOWN';
        $('history-status').textContent=reason+' · retained history is not a current decision';
      }
    } finally { busy=false; }
  }
  window.loadDecisionFlow=load;
  load(); setInterval(load,15000);
})();

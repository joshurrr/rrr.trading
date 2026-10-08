'use strict';
(() => {
  const timeframe={short:'15m',medium:'1h',long:'4h'}[document.body.dataset.bot];
  if(!timeframe) return;
  const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const missing='DATA UNAVAILABLE';
  const safe=v=>typeof v==='string'&&v.trim()&&!/^(UNKNOWN|UNAVAILABLE)$/i.test(v)?v:missing;
  const utc=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d$/.test(v)?v.replace(' ','T')+'Z':v;
  const date=v=>Number.isFinite(Date.parse(utc(v)))?new Date(utc(v)).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' Brisbane':missing;
  const price=v=>finite(v)?v.toLocaleString('en-US',{maximumFractionDigits:8})+' USDT':missing;
  const signed=(v,unit)=>finite(v)?(v>0?'+':'')+v.toFixed(2)+unit:missing;
  const tone=v=>/^(YES|HOLDING|NOT REACHED|MONITORING|ALIGNED|ACTIVE|INACTIVE)$/.test(v)?'good':/^(EXIT CONDITION ACTIVE|EXIT SIGNAL ACTIVE|SIGNAL ACTIVE|REACHED|TRIGGERED)$/.test(v)?'bad':/^(NO|STALE|MONITORING INCOMPLETE|STOP TIGHTENED)$/.test(v)?'warn':'';
  const metric=(label,value,note='',colour='')=>`<div class="exit-reading"><div class="mini"><span>${esc(label)}</span><strong class="${colour}">${esc(value)}</strong></div>${note?`<p>${esc(note)}</p>`:''}</div>`;
  let status=null,flow=null,statusProblem=missing,flowProblem=missing;
  const num=v=>finite(v)?v.toLocaleString('en-US',{maximumFractionDigits:6}):missing;
  function telemetryReadings(m,statusCurrent,candleCurrent){
    const tr=m.trend||{},mo=m.momentum||{},sig=m.strategy_exit||{},stop=m.stop_loss||{},trail=m.trailing_stop||{},roi=m.roi||{};
    const usable=(component,candle=false)=>(candle?candleCurrent:statusCurrent)&&component.available===true;
    const current=statusCurrent;
    const candleMissing=m.candle_observed_at?'STALE':missing;
    const readings=[];
    const add=(label,state,explanation)=>readings.push({label,state,explanation});
    add('Trend context',usable(tr,true)?safe(tr.state):candleCurrent?missing:candleMissing,
        'Close / EMA50: '+num(tr.close)+' / '+num(tr.ema50)+'. Descriptive comparison, separate from the native exit flag.');
    add('Momentum context',usable(mo,true)?safe(mo.state):candleCurrent?missing:candleMissing,
        'RSI '+num(mo.rsi)+' · MACD / signal: '+num(mo.macd)+' / '+num(mo.macd_signal)+'.');
    add('Stop loss',usable(stop)&&stop.active===true?'ACTIVE':current?missing:'STALE',
        'Stop price '+price(stop.price)+' · initial '+price(stop.initial_price)+
        (finite(stop.distance_ratio)?' · distance '+signed(stop.distance_ratio*100,'%')+' from current bot price.':'.'));
    add('Trailing stop',usable(trail)?safe(trail.state):current?missing:'STALE',
        (finite(trail.positive_offset)?'Configured offset '+signed(trail.positive_offset*100,'%')+' · ':'')+
        (finite(trail.positive)?'distance '+signed(trail.positive*100,'%')+'. ':'')+'Exact native activation is not exposed; stop tightening may have other causes.');
    add('Profit target / ROI',usable(roi)?safe(roi.state):current?missing:'STALE',
        (finite(roi.current_required_roi)?'Current age-based target '+signed(roi.current_required_roi*100,'%')+'. ':'')+
        (finite(roi.next_threshold_minutes)&&finite(roi.next_required_roi)?'Next '+signed(roi.next_required_roi*100,'%')+' at '+num(roi.next_threshold_minutes)+' elapsed minutes. ':'')+'Runtime exit eligibility is separate.');
    add('Strategy exit',usable(sig,true)&&typeof sig.active==='boolean'?(sig.active?'SIGNAL ACTIVE':'INACTIVE'):candleCurrent?missing:candleMissing,
        (sig.applicable_signal||'Applicable signal unavailable')+' = '+(usable(sig,true)&&typeof sig.active==='boolean'?(sig.active?'YES':'NO'):missing)+
        (sig.exit_tag?' · '+sig.exit_tag:'')+'. Native candle signal; configuration gates and custom exits can differ.');
    return readings;
  }
  let expiryKey='';
  function expiredKey(){return JSON.stringify([status&&Date.now()/1000-status.generated_at>30,...(flow?.exit_monitoring||[]).map(e=>e.telemetry&&[e.telemetry.valid_until,e.telemetry.status_valid_until,e.telemetry.candle_valid_until].map(at=>Date.parse(at)<Date.now()))]);}
  function render(){
    expiryKey=expiredKey();
    const panel=document.getElementById('exit-panel'),grid=document.getElementById('exit-monitoring'),note=document.getElementById('exit-status');
    panel.classList.toggle('stale',!status);
    grid.classList.add('exit-grid');
    if(!status||!Array.isArray(status.open_trades)||Date.now()/1000-status.generated_at>30){
      note.textContent=(status?'STALE':statusProblem)+' · current open positions cannot be verified.';
      grid.innerHTML='<p class="muted">Open-position data unavailable. Previous positions are not shown as current.</p>';return;
    }
    const trades=status.open_trades;
    note.textContent=trades.length+' open position'+(trades.length===1?'':'s')+' · price / P/L observed '+date(new Date(status.generated_at*1000).toISOString())+(flow?'':' · exit evidence '+flowProblem.toLowerCase());
    if(!trades.length){grid.innerHTML='<p class="muted">No open positions currently being monitored</p>';return;}
    grid.innerHTML=trades.map(t=>{
      // Status is the source of truth for membership; never infer a trade from an entry vote.
      const e=flow?.exit_monitoring?.find(e=>e.pair===t.pair&&(e.trade_id==null||e.trade_id===t.id));
      const m=e?.telemetry;
      const expires=Date.parse(m?.valid_until),current=!!m&&m.timeframe===timeframe&&m.side===t.direction&&m.fresh===true&&Number.isFinite(expires)&&expires>=Date.now();
      const identity=!!m&&m.timeframe===timeframe&&m.side===t.direction;
      const statusCurrent=identity&&(m.status_valid_until?m.status_fresh===true&&Date.parse(m.status_valid_until)>=Date.now():current);
      const candleCurrent=identity&&(m.candle_valid_until?m.candle_fresh===true&&Date.parse(m.candle_valid_until)>=Date.now():current);
      const checks=m?telemetryReadings(m,statusCurrent,candleCurrent):Array.isArray(e?.checks)?e.checks:null;
      const state=m?(current?safe(m.state):m.fresh===false&&m.state==='MONITORING INCOMPLETE'?'MONITORING INCOMPLETE':'STALE'):checks?safe(e.status):'MONITORING INCOMPLETE';
      const opened=Date.parse(utc(t.open_date)),age=Number.isFinite(opened)?Math.floor((status.generated_at*1000-opened)/60000):null;
      const ageText=age===null||age<0?missing:age>=1440?Math.floor(age/1440)+'d '+Math.floor(age/60)%24+'h':age>=60?Math.floor(age/60)+'h '+age%60+'m':age+'m';
      const candleAt=Date.parse(e?.timestamp),candleFresh=Number.isFinite(candleAt)&&candleAt<=Date.now()&&Date.now()-candleAt<=({'15m':900,'1h':3600,'4h':14400}[timeframe]+120)*1000;
      const legacy=[['Trend intact','trend'],['Momentum intact','momentum'],['Stop price','stop_loss'],['Trailing stop','trailing_stop'],['Profit target / ROI','profit_target'],['Exit signal','exit_signal']].map(([label,k])=>({label,state:k==='stop_loss'?price(e?.[k]):['trend','momentum','exit_signal'].includes(k)&&!candleFresh?missing:safe(e?.[k]),explanation:k==='exit_signal'?(candleFresh?'Recorded flag on the latest completed candle; execution is separate.':'Completed-candle evidence is stale or unavailable.'):'Detailed exit evidence requires the read-only backend update.'}));
      return `<article class="node exit-card" data-pair="${esc(t.pair)}"><div class="exit-card-top"><h4>${esc(t.pair?.replace(/^(.*\/([^:]+)):\2$/,'$1'))}</h4><span class="badge ${tone(state)}">${esc(state)}</span></div><p class="asset-role">OPEN POSITION · EXIT MONITORING</p>`+
        metric('Position',['LONG','SHORT'].includes(t.direction)?t.direction:missing)+metric('Entry price',price(t.open_rate))+metric('Current price',price(t.current_rate),'Bot price observation; separate from the completed candle.')+
        metric('Unrealised P/L',signed(t.profit_abs,' USDT')+' / '+signed(t.profit_pct,'%'),'Bot-reported P/L, including its cost calculation.',finite(t.profit_abs)?t.profit_abs>0?'good':t.profit_abs<0?'bad':'':'')+metric('Trade age',ageText,'Opened '+date(t.open_date))+
        `<h5>EXIT CHECKS</h5>`+(checks||legacy).map(c=>metric(c.label,safe(c.state),c.explanation,tone(c.state))).join('')+
        metric('Checked',date(m?.observed_at||(finite(flow?.generated_at)?new Date(flow.generated_at*1000).toISOString():null)))+metric('Latest completed candle',date(m?.candle_observed_at||e?.latest_closed_candle||e?.timestamp),'Native strategy signal on the completed '+timeframe+' candle.')+
        `<p class="why">${esc(m?.note||e?.summary||'The supplied evidence does not verify every current exit condition. An inactive candle signal alone does not prove the trade should remain open.')} An observed condition does not confirm that an exit order was submitted.</p></article>`;
    }).join('');
  }
  setInterval(()=>{if(status&&expiryKey!==expiredKey()) render();},1000);
  window.ExitMonitoring={status(d){status=d;statusProblem=missing;render();},flow(d){flow=d;flowProblem=missing;render();},statusUnavailable(reason){status=null;statusProblem=reason;render();},flowUnavailable(reason){flow=null;flowProblem=reason;render();}};
})();

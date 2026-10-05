'use strict';
(() => {
  if(document.body.dataset.bot!=='short') return;
  const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const missing='DATA UNAVAILABLE';
  const safe=v=>typeof v==='string'&&v.trim()&&!/^(UNKNOWN|UNAVAILABLE)$/i.test(v)?v:missing;
  const utc=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d$/.test(v)?v.replace(' ','T')+'Z':v;
  const date=v=>Number.isFinite(Date.parse(utc(v)))?new Date(utc(v)).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' Brisbane':missing;
  const price=v=>finite(v)?v.toLocaleString('en-US',{maximumFractionDigits:8})+' USDT':missing;
  const signed=(v,unit)=>finite(v)?(v>0?'+':'')+v.toFixed(2)+unit:missing;
  const tone=v=>/^(YES|HOLDING|NOT REACHED)$/.test(v)?'good':/^(EXIT CONDITION ACTIVE|REACHED|TRIGGERED)$/.test(v)?'bad':/^(NO|STALE|MONITORING INCOMPLETE|STOP TIGHTENED)$/.test(v)?'warn':'';
  const metric=(label,value,note='',colour='')=>`<div class="exit-reading"><div class="mini"><span>${esc(label)}</span><strong class="${colour}">${esc(value)}</strong></div>${note?`<p>${esc(note)}</p>`:''}</div>`;
  let status=null,flow=null,statusProblem=missing,flowProblem=missing;
  function render(){
    const panel=document.getElementById('exit-panel'),grid=document.getElementById('exit-monitoring'),note=document.getElementById('exit-status');
    panel.classList.toggle('stale',!status);
    if(!status||!Array.isArray(status.open_trades)){
      note.textContent=statusProblem+' · current open positions cannot be verified.';
      grid.innerHTML='<p class="muted">Open-position data unavailable. Previous positions are not shown as current.</p>';return;
    }
    const trades=status.open_trades;
    note.textContent=trades.length+' open position'+(trades.length===1?'':'s')+' · price / P/L observed '+date(new Date(status.generated_at*1000).toISOString())+(flow?'':' · exit evidence '+flowProblem.toLowerCase());
    if(!trades.length){grid.innerHTML='<p class="muted">No open positions currently being monitored</p>';return;}
    grid.innerHTML=trades.map(t=>{
      // Status is the source of truth for membership; never infer a trade from an entry vote.
      const e=flow?.exit_monitoring?.find(e=>e.pair===t.pair&&(e.trade_id==null||e.trade_id===t.id));
      const checks=Array.isArray(e?.checks)?e.checks:null;
      const state=checks?safe(e.status):'MONITORING INCOMPLETE';
      const opened=Date.parse(utc(t.open_date)),age=Number.isFinite(opened)?Math.floor((status.generated_at*1000-opened)/60000):null;
      const ageText=age===null||age<0?missing:age>=1440?Math.floor(age/1440)+'d '+Math.floor(age/60)%24+'h':age>=60?Math.floor(age/60)+'h '+age%60+'m':age+'m';
      const candleAt=Date.parse(e?.timestamp),candleFresh=Number.isFinite(candleAt)&&candleAt<=Date.now()&&Date.now()-candleAt<=17*60000;
      const legacy=[['Trend intact','trend'],['Momentum intact','momentum'],['Stop price','stop_loss'],['Trailing stop','trailing_stop'],['Profit target / ROI','profit_target'],['Exit signal','exit_signal']].map(([label,k])=>({label,state:k==='stop_loss'?price(e?.[k]):['trend','momentum','exit_signal'].includes(k)&&!candleFresh?missing:safe(e?.[k]),explanation:k==='exit_signal'?(candleFresh?'Recorded flag on the latest completed candle; execution is separate.':'Completed-candle evidence is stale or unavailable.'):'Detailed exit evidence requires the read-only backend update.'}));
      return `<article class="node exit-card" data-pair="${esc(t.pair)}"><div class="exit-card-top"><h4>${esc(t.pair?.replace(/^(.*\/([^:]+)):\2$/,'$1'))}</h4><span class="badge ${tone(state)}">${esc(state)}</span></div><p class="asset-role">OPEN POSITION · EXIT MONITORING</p>`+
        metric('Position',['LONG','SHORT'].includes(t.direction)?t.direction:missing)+metric('Entry price',price(t.open_rate))+metric('Current price',price(t.current_rate),'Bot price observation; separate from the completed candle.')+
        metric('Unrealised P/L',signed(t.profit_abs,' USDT')+' / '+signed(t.profit_pct,'%'),'Bot-reported P/L, including its cost calculation.',finite(t.profit_abs)?t.profit_abs>0?'good':t.profit_abs<0?'bad':'':'')+metric('Trade age',ageText,'Opened '+date(t.open_date))+
        `<h5>EXIT CHECKS</h5>`+(checks||legacy).map(c=>metric(c.label,safe(c.state),c.explanation,tone(c.state))).join('')+
        metric('Latest completed candle',date(e?.latest_closed_candle||e?.timestamp),'Strategy signals use completed 15-minute candles.')+
        `<p class="why">${esc(e?.summary||'The supplied evidence does not verify every current exit condition. An inactive candle signal alone does not prove the trade should remain open.')} An observed condition does not confirm that an exit order was submitted.</p></article>`;
    }).join('');
  }
  window.shortExitMonitoring={status(d){status=d;statusProblem=missing;render();},flow(d){flow=d;flowProblem=missing;render();},statusUnavailable(reason){status=null;statusProblem=reason;render();},flowUnavailable(reason){flow=null;flowProblem=reason;render();}};
})();

'use strict';
(() => {
  const body=document.getElementById('home-closed-trades-body');
  const state=document.getElementById('home-closed-trades-state');
  if(!body||!state)return;
  const number=value=>{
    if((typeof value!=='number'&&typeof value!=='string')||(typeof value==='string'&&!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())))return null;
    const result=Number(value);return Number.isFinite(result)?result:null;
  };
  const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
  const date=value=>new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value))+' AEST';
  const cell=(row,value)=>{const td=document.createElement('td');td.textContent=value;row.append(td);return td;};
  const closeReasons=Object.freeze({PROTECTIVE_STOP:'Protective Stop',STOP_LOSS:'Stop Loss',TRAILING_STOP:'Trailing Stop',TAKE_PROFIT:'Take Profit',SOL_EXIT:'SOL Exit',RISK_EXIT:'Risk Exit',MANUAL_EXIT:'Manual Exit'});
  const closeReason=value=>typeof value==='string'?closeReasons[value.trim().toUpperCase()]||'Not recorded':'Not recorded';
  const unavailable=message=>{body.replaceChildren();const row=document.createElement('tr'),td=cell(row,message);td.colSpan=11;state.textContent=message;body.append(row);};
  function render(event){
    const data=event.detail||{};
    const summary=document.getElementById('home-closed-summary');
    summary.textContent='Trades Closed: '+(data.count===null?'Unavailable':data.count)+' | Net P/L: '+window.HomePerformance.money(data.net);
    if(!['AVAILABLE','PARTIAL','STALE'].includes(data.availability)||!Array.isArray(data.trades)){unavailable('Closed trade history unavailable · complete, validated V4 ledger evidence is missing.');return;}
    const status=data.complete?'':'History '+data.availability+' · Totals unavailable; saved validated rows only.';
    state.textContent=status;body.replaceChildren();
    if(!data.trades.length){unavailable(data.complete?'No trades closed in the last 24 hours.':status);return;}
    for(const trade of data.trades){
      const row=document.createElement('tr'),closed=stamp(trade.closed_at),entered=stamp(trade.entered_at);
      cell(row,trade.symbol);cell(row,trade.side);
      cell(row,number(trade.entry_price).toLocaleString('en-AU',{maximumSignificantDigits:10}));
      cell(row,number(trade.exit_price).toLocaleString('en-AU',{maximumSignificantDigits:10}));
      cell(row,date(entered));
      const duration=Math.max(0,closed-entered),hours=Math.floor(duration/3600000),minutes=Math.floor(duration%3600000/60000);
      cell(row,hours?hours+'h '+minutes+'m':minutes+'m');cell(row,date(closed));
      const pnl=cell(row,window.HomePerformance.money(number(trade.net_pnl)));
      pnl.dataset.tone=window.HomePerformance.tone(number(trade.net_pnl));cell(row,closeReason(trade.exit_reason));cell(row,number(trade.entry_fee)===null?'Unavailable':number(trade.entry_fee).toFixed(2));cell(row,number(trade.exit_fee)===null?'Unavailable':number(trade.exit_fee).toFixed(2));body.append(row);
    }
  }
  window.addEventListener('rrr-v4-completed-trade-activity',render);
})();

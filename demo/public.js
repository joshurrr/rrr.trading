'use strict';
(() => {
  const key = document.body.dataset.bot;
  const feeds = {medium:'/status',short:'/api/demos/short/status',long:'/api/demos/long/status'};
  const $ = id => document.getElementById(id);
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const esc = v => String(v ?? '—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (v,c) => {
    if (!finite(v)) return 'Unavailable';
    try { return new Intl.NumberFormat(undefined,{style:'currency',currency:c,maximumFractionDigits:2}).format(v); }
    catch { return v.toFixed(2)+' '+c; }
  };
  const date = v => v && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString() : '—';
  const settingMoney = (v,c) => finite(v) ? new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(v)+' '+c : 'Unavailable';
  const cls = v => finite(v) && v > 0 ? 'pos' : finite(v) && v < 0 ? 'neg' : '';
  const pct = v => finite(v) ? `${v>0?'+':''}${v.toFixed(2)}%` : 'Unavailable';
  const signedMoney = (v,c) => (finite(v) && v>0 ? '+' : '')+money(v,c);
  const result = (t,c) => signedMoney(t.profit_abs,c)+(finite(t.profit_pct)?` (${pct(t.profit_pct)})`:'');
  const performance = (id,amount,percent,c) => {
    $(id).textContent=signedMoney(amount,c);
    $(id).className=(id==='realised'?'':'value ')+cls(amount);
    if ($(id+'Pct')) {
      $(id+'Pct').textContent=pct(percent);
      $(id+'Pct').className='value return '+cls(percent);
    }
  };
  // started_at is Freqtrade's latest session startup, in epoch seconds.
  const runtime = (start,now) => {
    if (!finite(start) || start<=0 || start>now) return 'Unavailable';
    const minutes=Math.floor((now-start)/60000);
    const hours=Math.floor(minutes/60),days=Math.floor(hours/24);
    return days>0 ? days+'d '+hours%24+'h' : hours>0 ? hours+'h '+minutes%60+'m' : minutes+'m';
  };
  const stake = v => {
    // show_config can return a numeric string or the literal unlimited.
    if (v==='unlimited') return 'Unlimited';
    const n=typeof v==='string' && v.trim()!=='' ? Number(v) : v;
    return finite(n)&&n>=0 ? n : null;
  };
  // Only known exit labels are public. Raw strategy tags stay in admin.
  const rationale = t => ({roi:'Profit target',stop_loss:'Stop loss',trailing_stop_loss:'Trailing stop',force_exit:'Manual close',exit_signal:'Strategy exit'})[t.exit_reason] || 'Strategy trade';
  async function load() {
    try {
      const response = await fetch('https://api.rrr.trading'+feeds[key],{cache:'no-store',signal:AbortSignal.timeout(10000)});
      const d = await response.json();
      if (!response.ok || !d.ok) throw Error('Unavailable');
      const age = Date.now()/1000-d.generated_at, b=d.bot||{}, p=d.portfolio||{};
      if (!finite(d.generated_at) || age>30 || age< -30) throw Error('Stale');
      if (b.timeframe!==({short:'15m',medium:'1h',long:'4h'})[key] || b.mode!=='PAPER') throw Error('Unexpected feed');
      if (key!=='medium' && (d.demo!==key || b.strategy!==({short:'Short Term 15m',long:'Long Term 4hr'})[key] || b.exchange!=='bybit' || b.trading_mode!=='futures' || b.margin_mode!=='isolated' || b.short_allowed!==true || b.stake_currency!=='USDT')) throw Error('Unexpected feed');
      const c=b.stake_currency||'USD';
      $('stateBadge').textContent=b.state||'UNKNOWN';
      const exchange=typeof b.exchange==='string'?b.exchange.trim():'';
      $('exchange').textContent=exchange?exchange.charAt(0).toUpperCase()+exchange.slice(1):'Unavailable';
      $('starting').textContent=settingMoney(p.starting_balance,c);
      performance('profit',p.profit_all_abs,p.profit_all_pct,c);
      performance('realised',p.profit_closed_abs,p.profit_closed_pct,c);
      // Freqtrade's existing account drawdown is a non-negative ratio.
      const drawdown=finite(p.max_drawdown)&&p.max_drawdown>=0 ? -p.max_drawdown*100 : null;
      $('drawdown').textContent=pct(drawdown);
      $('drawdown').className='value return '+cls(drawdown);
      const amount=stake(b.stake_amount);
      $('maxTrade').textContent=amount==='Unlimited'?amount:settingMoney(amount,c);
      $('runtime').textContent=runtime(finite(b.started_at)?b.started_at*1000:null,d.generated_at*1000);
      const limit=b.max_open_trades;
      $('maxOpen').textContent=Number.isInteger(limit)&&limit>=0?String(limit):limit===-1?'Unlimited':'Unavailable';
      const wins=p.winning_trades,losses=p.losing_trades;
      // Medium's closed_trades is a capped history count; use full statistics.
      // Freqtrade includes break-even completed trades in winning_trades.
      const validCount=v=>Number.isSafeInteger(v)&&v>=0;
      const completed=key!=='medium'&&validCount(p.closed_trades)?p.closed_trades:
        validCount(wins)&&validCount(losses)&&validCount(wins+losses)?wins+losses:null;
      $('completed').textContent=completed===null?'Unavailable':String(completed);
      $('winRate').textContent=finite(wins)&&finite(losses)?`${wins} wins · ${losses} losses${wins+losses>0?` (${(wins/(wins+losses)*100).toFixed(1)}%)`:''}`:'Unavailable';
      window.renderDemoAssets(b.pairs);
      const render=(id,empty,rows,closed)=>{
        $(id).innerHTML=rows.map(t=>`<tr><td>${esc(t.pair)}</td><td>${esc(t.direction)}</td><td>${esc(money(t.open_rate,c))}</td><td>${esc(money(closed?t.close_rate:t.current_rate,c))}</td>${closed?'':`<td>${esc(c==='USDT'&&finite(t.stake_amount)&&t.stake_amount>=0?money(t.stake_amount,c):'Unavailable')}</td>`}<td class="${cls(finite(t.profit_abs)?t.profit_abs:t.profit_pct)}">${esc(result(t,c))}</td><td>${esc(closed?rationale(t):'Strategy entry')}</td><td>${esc(date(closed?t.close_date:t.open_date))}</td></tr>`).join('');
        $(empty).hidden=!!rows.length; $(empty).textContent=closed?'No completed trades yet.':'No open trades.';
      };
      render('openRows','openEmpty',d.open_trades||[],false);
      render('historyRows','historyEmpty',d.history||[],true);
      $('updated').textContent='Last updated: '+new Date(d.generated_at*1000).toLocaleString();
    } catch(error) {
      for(const id of ['exchange','starting','profit','profitPct','drawdown','realised','completed','maxOpen','maxTrade','runtime','winRate']) {
        $(id).textContent='Unavailable'; $(id).classList.remove('pos','neg');
      }
      window.renderDemoAssets(null,error.message==='Stale'?'Bot data is stale · asset universe unavailable.':'Bot asset universe unavailable.');
      for(const id of ['openRows','historyRows']) $(id).replaceChildren();
      for(const id of ['openEmpty','historyEmpty']) {$(id).hidden=false;$(id).textContent='Data unavailable.';}
      $('stateBadge').textContent=error.message==='Stale'?'STALE':'UNAVAILABLE';
      $('updated').textContent=error.message==='Stale'?'Data is stale · retrying':'Data unavailable · retrying';
    }
  }
  window.load=load;
  load(); setInterval(load,15000);
})();

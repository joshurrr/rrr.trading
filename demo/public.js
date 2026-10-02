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
  const result = (t,c) => money(t.profit_abs,c)+(finite(t.profit_pct)?` (${t.profit_pct.toFixed(2)}%)`:'');
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
      $('balance').textContent=money(p.equity ?? p.balance,c);
      $('starting').textContent=money(p.starting_balance,c);
      $('profit').textContent=money(p.profit_all_abs,c);
      $('realised').textContent=money(p.profit_closed_abs,c);
      $('openPos').textContent=p.open_positions??'Unavailable';
      const wins=p.winning_trades,losses=p.losing_trades;
      $('winRate').textContent=finite(wins)&&finite(losses)?`${wins} wins · ${losses} losses`:'Unavailable';
      const render=(id,empty,rows,closed)=>{
        $(id).innerHTML=rows.map(t=>`<tr><td>${esc(t.pair)}</td><td>${esc(t.direction)}</td><td>${esc(money(t.open_rate,c))}</td><td>${esc(money(closed?t.close_rate:t.current_rate,c))}</td><td>${esc(result(t,c))}</td><td>${esc(closed?rationale(t):'Strategy entry')}</td><td>${esc(date(closed?t.close_date:t.open_date))}</td></tr>`).join('');
        $(empty).hidden=!!rows.length; $(empty).textContent=closed?'No completed trades yet.':'No open trades.';
      };
      render('openRows','openEmpty',d.open_trades||[],false);
      render('historyRows','historyEmpty',d.history||[],true);
      $('updated').textContent='Last updated: '+new Date(d.generated_at*1000).toLocaleString();
    } catch(error) {
      for(const id of ['balance','starting','profit','realised','openPos','winRate']) $(id).textContent='Unavailable';
      for(const id of ['openRows','historyRows']) $(id).replaceChildren();
      for(const id of ['openEmpty','historyEmpty']) {$(id).hidden=false;$(id).textContent='Data unavailable.';}
      $('stateBadge').textContent=error.message==='Stale'?'STALE':'UNAVAILABLE';
      $('updated').textContent=error.message==='Stale'?'Data is stale · retrying':'Data unavailable · retrying';
    }
  }
  window.load=load;
  load(); setInterval(load,15000);
})();

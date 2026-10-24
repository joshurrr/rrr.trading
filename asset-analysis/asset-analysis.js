'use strict';
// V4.1 public shortlist view. Membership comes only from saved paper-cycle shortlist records.
(() => {
  const API = 'https://v4.rrr.trading/v4/paper';
  const host = document.getElementById('asset-analysis-cards');
  const status = document.getElementById('asset-analysis-status');
  const snapshot = document.getElementById('asset-analysis-snapshot');
  const refresh = document.getElementById('asset-analysis-refresh');
  const at = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-AU', {timeZone:'Australia/Brisbane', dateStyle:'medium', timeStyle:'short'}) + ' Brisbane' : 'UNAVAILABLE';
  const clean = value => typeof value === 'string' && value.trim() ? value : 'UNAVAILABLE';
  const show = async () => {
    refresh.disabled = true; host.setAttribute('aria-busy','true'); status.textContent = 'Loading saved V4.1 shortlist…';
    let data;
    try { const response = await fetch(API, {cache:'no-store', signal:AbortSignal.timeout(20000)}); if (!response.ok) throw Error('unavailable'); data = await response.json(); }
    catch { data = null; }
    const view = data?.overview?.shortlists;
    const validView = ['LONG','SHORT'].every(side => view?.[side] && ['CURRENT','STALE','UNAVAILABLE'].includes(view[side].state) && Array.isArray(view[side].items));
    if (!validView) {
      host.replaceChildren(Object.assign(document.createElement('p'), {className:'muted',textContent:'V4.1 shortlist UNAVAILABLE. The saved selection record could not be verified.'}));
      status.textContent = 'Shortlist unavailable · saved V4.1 selection evidence was not returned.'; snapshot.textContent = `API served ${at(data?.served_at)} · request and authentication boundaries are unchanged.`;
      host.setAttribute('aria-busy','false'); refresh.disabled = false; return;
    }
    if (view.LONG.state === 'UNAVAILABLE' || view.SHORT.state === 'UNAVAILABLE') {
      host.replaceChildren(Object.assign(document.createElement('p'), {className:'muted',textContent:`V4.1 shortlist UNAVAILABLE · LONG ${clean(view.LONG.state)} · SHORT ${clean(view.SHORT.state)}. A partial side cannot establish complete shortlist membership.`}));
      status.textContent = 'Shortlist membership unavailable · both saved directional shortlist records must be validated.';
      snapshot.textContent = `API served ${at(data?.served_at)} · retained cycle ${at(data?.latest_cycle?.started_at)}.`;
      host.setAttribute('aria-busy','false'); refresh.disabled = false; return;
    }
    const records = [...view.LONG.items.map(row => ({row, list:view.LONG})), ...view.SHORT.items.map(row => ({row, list:view.SHORT}))]
      .sort((a,b) => a.row.rank-b.row.rank || a.row.symbol.localeCompare(b.row.symbol) || a.row.side.localeCompare(b.row.side));
    const positions = Array.isArray(data?.open_positions?.items) ? data.open_positions.items : [];
    const history = Array.isArray(data?.completed_trades?.items) ? data.completed_trades.items : [];
    const children = [];
    for (const {row,list} of records) {
      if (!/^[A-Z0-9]{1,30}USDT$/.test(row.symbol || '') || row.exchange !== 'bybit') continue;
      const symbol = row.symbol.replace(/USDT$/,'');
      const position = positions.find(p => p?.symbol === row.symbol || p?.instrument_id === row.symbol);
      const evidenceAsset = {symbol, asset:symbol, direction:row.side, trend:'unavailable', opportunity_score:undefined};
      const newsAlignment = clean(row.sentiment_alignment);
      const rowCard = document.createElement('div');
      window.CandidateCards.reconcile(rowCard, [{symbol,asset:evidenceAsset,options:{allowed:true,current:row.state==='CURRENT',rank:row.rank,rankLabel:`${row.side} #${row.rank}`,evidenceLabel:'V4.1 shortlist evidence',reason:`${row.side} shortlist · ${row.timeframe} rank · momentum ${row.momentum_support} · news alignment ${newsAlignment} · ${row.return_pct}% recorded return`,entryState:`Shortlisted research only · approval NOT_RECORDED in this record · open position ${position ? 'recorded separately' : 'UNAVAILABLE in account feed'}`}}]);
      const el = rowCard.firstElementChild;
      if (!el) continue;
      const matchingTrades = history.filter(item => item?.symbol === row.symbol);
      const tradeDetail = matchingTrades.length ? `${matchingTrades.length} retained closed paper trade${matchingTrades.length===1?'':'s'}; see V4 intelligence trade evidence.` : 'UNAVAILABLE · retained trade history is not included in the public shortlist record.';
      el.v4Selection = {row,view:list,assessment:{asset:{name:symbol},news_summary:null,decision:null},positions,matchingTrades,tradeDetail};
      el.dataset.symbol = symbol;
      const direction = el.querySelector('.candidate-direction'); direction.hidden = false; direction.textContent = row.side;
      el.querySelector('.universe-score').textContent = `#${row.rank}`;
      el.querySelector('.candidate-score-label').textContent = `${row.side} selection rank · research only`;
      el.querySelector('.universe-trend').textContent = `News ${newsAlignment} · SOL ${clean(row.sol_decision_status)}`;
      el.querySelector('.candidate-context').textContent = `${row.timeframe} · ${row.momentum_support} · ${at(row.observed_at)}`;
      const logo = el.querySelector('.candidate-logo'); if (logo) { logo.alt = `${symbol} logo`; }
      children.push(el);
    }
    host.replaceChildren(...children);
    status.textContent = `${children.length} V4.1 shortlist entries · LONG ${view.LONG.items.length} · SHORT ${view.SHORT.items.length}. Shortlist, approved trade and open position are separate states.`;
    snapshot.textContent = `Last assessment ${at(view.LONG.observed_at || view.SHORT.observed_at)} · LONG ${clean(view.LONG.state)} · SHORT ${clean(view.SHORT.state)} · source ${clean(view.LONG.provenance?.source || view.SHORT.provenance?.source)}.`;
    if (!children.length) { const empty=document.createElement('p'); empty.className='muted'; empty.textContent='No assets were recorded in the current V4.1 shortlist.'; host.append(empty); }
    host.setAttribute('aria-busy','false'); refresh.disabled = false;
  };
  refresh.addEventListener('click', show); show();
})();

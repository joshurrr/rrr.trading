(() => {
  'use strict';
  const bot = document.body.dataset.bot;
  if (!['short', 'medium', 'long'].includes(bot)) return;
  const API = 'https://api.rrr.trading/api/v2/intelligence';
  let health = null, performance = null, records = null, observed = 0, epochSeen = false, resolved = false;
  const box = document.createElement('section'); box.className = 'panel v2-paper-panel'; box.id = 'v2-paper'; box.setAttribute('aria-label', 'RRR.Trading v2 paper execution');
  const heading = document.createElement('h2'); heading.textContent = 'RRR.Trading v2';
  const state = document.createElement('p'); state.setAttribute('role', 'status'); state.textContent = 'Execution evidence unavailable';
  const run = document.createElement('p'), architecture = document.createElement('details'), summary = document.createElement('summary');
  const note = document.createElement('p'), versions = document.createElement('p');
  architecture.className = 'v2-run-details'; summary.textContent = 'How the shared v2 paper run works'; architecture.append(summary, note, versions);
  const metrics = document.createElement('p'), totals = document.createElement('p'), samples = document.createElement('p'), evidence = document.createElement('div');
  box.append(heading, state, run, architecture, metrics, totals, samples, evidence); document.querySelector('main')?.prepend(box);
  function draw() {
    const fresh = health && Date.now() - observed < 45000 && health.stale === false && (health.status === 'available' || health.status === 'disabled' && health.enabled === false) && health.mode === 'PAPER';
    state.textContent = fresh ? health.enabled === true ? 'Execution: ACTIVE PAPER' : 'Execution: PAUSED PAPER · new entries disabled' : 'Execution evidence unavailable or stale';
    run.textContent = health?.run_id ? `Run: ${health.run_id} · Started: ${health.started_at || 'Unavailable'}` : 'No v2 paper run reported';
    note.textContent = health?.run_id ? 'Shared assets are evaluated across 15m, 1h and 4h, then one horizon may be selected. Shadow sizing and portfolio checks are separate from central paper execution. Native bots manage open position exits. The panel below uses this run only; legacy performance is excluded.' : 'V2 remains observational until a paper run is initialized and the execution gate is enabled.';
    versions.textContent = health?.versions ? `Versions: learning ${health.versions.learning_version || 'Unavailable'} · decision ${health.versions.decision_version || 'Unavailable'} · sizing ${health.versions.sizing_version || 'Unavailable'} · execution ${health.versions.execution_version || 'Unavailable'} · automatic promotion disabled` : 'Active version evidence unavailable';
    document.body.classList.toggle('v2-paper-owned', epochSeen);
    const p = performance, current = fresh && p?.available === true && p.run_id === health.run_id;
    const number = (value, suffix = '') => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString(undefined, {maximumFractionDigits: 2}) + suffix : 'Unavailable';
    const winRate = current ? p.trade_count === 0 ? 'No completed trades yet' : number(p.win_rate, '%') : 'Unavailable';
    metrics.textContent = current ? `V2 realized P/L: ${number(p.realized_pnl, ' USDT')} · Open P/L: ${number(p.open_pnl, ' USDT')} · Win rate: ${winRate} · Average closed trade: ${p.trade_count === 0 ? 'No completed trades yet' : number(p.average_trade, ' USDT')}` : 'V2 performance unavailable until current run evidence is verified.';
    totals.textContent = current ? `Starting balance: ${number(p.starting_balance, ' USDT')} · Total P/L: ${number(p.total_pnl, ' USDT')} · Return: ${number(p.return_pct, '%')} · Wins/losses: ${number(p.wins)}/${number(p.losses)} · Closed trades: ${number(p.trade_count)} · Sampled drawdown: ${number(p.max_drawdown_pct, '%')}` : '';
    samples.textContent = current ? Object.entries(p.by_timeframe || {}).map(([tf, value]) => `${tf}: ${value.trade_count} closed trades, ${number(value.realized_pnl, ' USDT')} realized${value.sample_sufficient ? '' : ' · insufficient sample'}`).join(' · ') || 'No closed v2 trades yet. Small samples do not establish profitability.' : 'Saved or legacy results are not substituted for current v2 performance.';
    evidence.replaceChildren();
    if (records?.run_id === health?.run_id && Array.isArray(records?.records)) {
      for (const record of records.records.slice(0, 10)) {
        const item = document.createElement('p'), button = document.createElement('button'), text = document.createElement('span');
        button.type = 'button'; button.textContent = record.symbol; button.dataset.intelligenceSymbol = record.symbol;
        text.textContent = ` · ${record.timeframe} ${record.direction} · ${record.status} · Opportunity ${record.opportunity_id} · ${record.why_go || 'Reason unavailable'}${fresh ? '' : ' · saved evidence only'}`;
        item.append(button, text); evidence.append(item);
      }
      if (!records.records.length) { const empty = document.createElement('p'); empty.textContent = 'No v2 executions recorded for this bot in the current run.'; evidence.append(empty); }
    }
  }
  function overlay(data) {
    epochSeen ||= data.bot?.entry_owner === 'paper-execution-v1';
    if (epochSeen) document.body.classList.add('v2-paper-owned');
    if (resolved && !epochSeen) return data;
    const p = performance, current = p?.run_id === health?.run_id && p?.available === true && health?.stale === false && Date.now() - observed < 45000;
    return {...data, bot: {...data.bot, started_at: epochSeen ? Date.parse(health?.started_at) / 1000 : data.bot?.started_at},
      portfolio: {starting_balance: p?.starting_balance ?? null, winning_trades: current ? p.wins : null, losing_trades: current ? p.losses : null,
        profit_all_abs: current ? p.total_pnl : null, profit_all_pct: current ? p.return_pct : null,
        max_drawdown: current ? p.max_drawdown_pct / 100 : null, closed_trades: current ? p.trade_count : null},
      history: current ? p.completed_trades : null};
  }
  window.V2Paper = Object.freeze({overlay});
  async function refresh() {
    const get = async path => { const r = await fetch(API + path, {cache: 'no-store', signal: AbortSignal.timeout(10000)}); if (!r.ok) throw Error('Unavailable'); return r.json(); };
    try {
      [health, performance] = await Promise.all([get('/execution/health'), get('/execution/performance?bot=' + bot)]);
      observed = Date.now(); resolved = true; epochSeen ||= Boolean(health?.run_id && health?.mode === 'PAPER');
      try { records = await get('/execution/records?bot=' + bot); } catch { records = null; }
    } catch { observed = 0; performance = null; resolved = true; }
    draw(); window.dispatchEvent(new Event('v2-paper-update'));
  }
  refresh(); setInterval(refresh, 15000);
})();

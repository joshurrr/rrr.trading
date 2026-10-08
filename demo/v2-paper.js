(() => {
  'use strict';
  const bot = document.body.dataset.bot;
  if (!['short', 'medium', 'long'].includes(bot)) return;
  const API = 'https://api.rrr.trading/api/v2/intelligence';
  let health = null, records = null, reporting = null, reportingObserved = 0, observed = 0, epochSeen = false, resolved = false;
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
    run.textContent = scopeText(runMetadata());
    note.textContent = health?.run_id ? 'Shared assets are evaluated across 15m, 1h and 4h, then one horizon may be selected. Shadow sizing and portfolio checks are separate from central paper execution. Native bots manage open position exits. The panel below uses this run only; legacy performance is excluded.' : 'V2 remains observational until a paper run is initialized and the execution gate is enabled.';
    versions.textContent = health?.versions ? `Versions: learning ${health.versions.learning_version || 'Unavailable'} · decision ${health.versions.decision_version || 'Unavailable'} · sizing ${health.versions.sizing_version || 'Unavailable'} · execution ${health.versions.execution_version || 'Unavailable'} · automatic promotion disabled` : 'Active version evidence unavailable';
    document.body.classList.toggle('v2-paper-owned', epochSeen);
    const report = currentReporting(), scoped = report?.portfolio;
    const p = scoped ? {run_id: report.run_id, available: true, starting_balance: scoped.starting_balance,
      realized_pnl: scoped.profit_closed_abs, open_pnl: scoped.profit_open_abs, total_pnl: scoped.profit_all_abs,
      return_pct: scoped.profit_all_pct, wins: scoped.winning_trades, losses: scoped.losing_trades,
      trade_count: scoped.closed_trades, win_rate: scoped.win_rate, max_drawdown_pct: scoped.max_drawdown === null ? null : scoped.max_drawdown * 100,
      average_trade: scoped.closed_trades && scoped.profit_closed_abs !== null ? scoped.profit_closed_abs / scoped.closed_trades : null} : null;
    const current = Boolean(p);
    const number = (value, suffix = '') => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString(undefined, {maximumFractionDigits: 2}) + suffix : 'Unavailable';
    const winRate = current ? p.trade_count === 0 ? 'No completed trades yet' : number(p.win_rate, '%') : 'Unavailable';
    metrics.textContent = current ? `V2 realized P/L: ${number(p.realized_pnl, ' USDT')} · Open P/L: ${number(p.open_pnl, ' USDT')} · Win rate: ${winRate} · Average closed trade: ${p.trade_count === 0 ? 'No completed trades yet' : number(p.average_trade, ' USDT')}` : 'V2 performance unavailable until current run evidence is verified.';
    totals.textContent = current ? `Starting balance: ${number(p.starting_balance, ' USDT')} · Total P/L: ${number(p.total_pnl, ' USDT')} · Return: ${number(p.return_pct, '%')} · Wins/losses: ${number(p.wins)}/${number(p.losses)} · Closed trades: ${number(p.trade_count)} · Closed-trade drawdown: ${number(p.max_drawdown_pct, '%')}` : '';
    samples.textContent = current ? 'Native Freqtrade trades opened within this run. Closed-trade drawdown excludes unrealized intratrade moves. Small samples do not establish profitability.' : 'Current-run native trade reporting unavailable. Legacy results are not substituted.';
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
  function scopeText(value) {
    const at = Date.parse(value?.started_at);
    return value?.run_id ? `Reporting scope: current paper run only · ${value.run_id} · started ${Number.isFinite(at) ? new Date(at).toLocaleString('en-AU', {timeZone: 'Australia/Brisbane'}) + ' Brisbane' : 'Unavailable'}` : 'Reporting scope: current paper run metadata unavailable';
  }
  function runMetadata() {
    if (!reportingObserved && health?.run_id) return health;
    return reporting?.run_id ? reporting : health;
  }
  function currentReporting() {
    const at = Date.parse(reporting?.observed_at);
    return reporting?.available === true && Boolean(reporting.run_id) && reporting.run_id === runMetadata()?.run_id && Number.isFinite(Date.parse(reporting.started_at)) && reporting.portfolio && Array.isArray(reporting.history) && Array.isArray(reporting.open_trades) && Date.now() - reportingObserved < 45000 && Number.isFinite(at) && Date.now() - at >= -30000 && Date.now() - at < 45000 ? reporting : null;
  }
  function overlay(data) {
    epochSeen ||= data.bot?.entry_owner === 'paper-execution-v1' || Boolean(reporting?.run_id);
    if (epochSeen) document.body.classList.add('v2-paper-owned');
    if (resolved && !epochSeen) return data;
    const report = currentReporting();
    const metadata = runMetadata();
    const boundary = Date.parse(metadata?.started_at);
    const openedAt = t => { const value = t.open_date; return typeof value === 'string' ? Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value.replace(' ', 'T') + 'Z') : NaN; };
    const nativeFresh = typeof data.generated_at === 'number' && Date.now() / 1000 - data.generated_at >= -30 && Date.now() / 1000 - data.generated_at < 30;
    const nativeOpen = nativeFresh && Number.isFinite(boundary) && Array.isArray(data.open_trades) && data.open_trades.every(t => Number.isFinite(openedAt(t))) ? data.open_trades.filter(t => openedAt(t) >= boundary) : null;
    return {...data, bot: {...data.bot, started_at: epochSeen ? Date.parse(metadata?.started_at) / 1000 : data.bot?.started_at},
      reporting_scope: scopeText(metadata),
      portfolio: report ? {...data.portfolio, ...report.portfolio} : {},
      open_trades: nativeOpen || (report ? report.open_trades : null),
      history: report ? report.history : null};
  }
  window.V2Paper = Object.freeze({overlay});
  async function refresh() {
    const get = async path => { const r = await fetch(API + path, {cache: 'no-store', signal: AbortSignal.timeout(10000)}); if (!r.ok) throw Error('Unavailable'); return r.json(); };
    const reportingRequest = (async () => {
      try {
        const r = await fetch('https://api.rrr.trading/api/demos/' + bot + '/reporting', {cache: 'no-store', signal: AbortSignal.timeout(15000)});
        if (!r.ok) throw Error('Unavailable');
        reporting = await r.json(); reportingObserved = Date.now(); epochSeen ||= Boolean(reporting?.run_id);
      } catch { reportingObserved = 0; }
    })();
    try {
      health = await get('/execution/health');
      observed = Date.now(); resolved = true; epochSeen ||= Boolean(health?.run_id && health?.mode === 'PAPER');
      try { records = await get('/execution/records?bot=' + bot); } catch { records = null; }
    } catch { observed = 0; resolved = true; }
    await reportingRequest;
    draw(); window.dispatchEvent(new Event('v2-paper-update'));
  }
  let refreshing = false;
  async function poll() { if (refreshing) return; refreshing = true; try { await refresh(); } finally { refreshing = false; } }
  poll(); setInterval(poll, 15000);
})();

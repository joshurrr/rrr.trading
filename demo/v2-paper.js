(() => {
  'use strict';
  const bot = document.body.dataset.bot;
  if (!['short', 'medium', 'long'].includes(bot)) return;
  const API = 'https://api.rrr.trading/api/v2/intelligence';
  let health = null, records = null, reporting = null, savedClosedReport = null, reportingObserved = 0, observed = 0, epochSeen = false, resolved = false, reportingResolved = false;
  const host = document.getElementById('v2-paper-diagnostics');
  const box = document.createElement('section'); box.className = 'v2-paper-panel'; box.id = 'v2-paper'; box.setAttribute('aria-label', 'V2 paper run diagnostics');
  const heading = document.createElement('h3'); heading.textContent = 'V2 paper run diagnostics';
  const state = document.createElement('p'); state.setAttribute('role', 'status'); state.textContent = 'Execution evidence unavailable';
  const run = document.createElement('p'), architecture = document.createElement('details'), summary = document.createElement('summary');
  const note = document.createElement('p'), versions = document.createElement('p');
  architecture.className = 'v2-run-details'; summary.textContent = 'How the shared v2 paper run works'; architecture.append(summary, note);
  const samples = document.createElement('p'), raw = document.createElement('details'), rawSummary = document.createElement('summary'), evidence = document.createElement('div');
  raw.className = 'v2-execution-records'; rawSummary.textContent = 'Raw execution records'; raw.append(rawSummary, evidence);
  box.append(heading, state, run, versions, architecture, samples, raw);
  // The static lower host owns placement; reporting still works if markup is absent.
  host?.append(box);
  function draw() {
    const fresh = health && Date.now() - observed < 45000 && health.stale === false && (health.status === 'available' || health.status === 'disabled' && health.enabled === false) && health.mode === 'PAPER';
    state.textContent = !resolved ? 'Loading execution evidence…' : fresh ? health.enabled === true ? 'Execution: ACTIVE PAPER' : 'Execution: PAUSED PAPER · new entries disabled' : 'Execution evidence unavailable or stale';
    run.textContent = scopeText(runMetadata());
    note.textContent = health?.run_id ? 'Shared assets are evaluated across 15m, 1h and 4h, then one horizon may be selected. Shadow sizing and portfolio checks are separate from central paper execution. Native bots manage open position exits. Dashboard performance and completed trades use this run only; legacy performance is excluded.' : 'V2 remains observational until a paper run is initialized and the execution gate is enabled.';
    versions.textContent = health?.versions ? `Versions: learning ${health.versions.learning_version || 'Unavailable'} · decision ${health.versions.decision_version || 'Unavailable'} · sizing ${health.versions.sizing_version || 'Unavailable'} · execution ${health.versions.execution_version || 'Unavailable'} · automatic promotion disabled` : 'Active version evidence unavailable';
    document.body.classList.toggle('v2-paper-owned', epochSeen);
    const current = Boolean(currentReporting());
    samples.textContent = !reportingResolved ? 'Loading current-run native trade reporting…' : current ? 'Native Freqtrade trades opened within this run. Closed-trade drawdown excludes unrealized intratrade moves. Small samples do not establish profitability.' : 'Current-run native trade reporting unavailable. Legacy results are not substituted.';
    evidence.replaceChildren();
    if (records?.run_id === health?.run_id && Array.isArray(records?.records)) {
      for (const record of records.records.slice(0, 10)) {
        const item = document.createElement('p'), button = document.createElement('button'), text = document.createElement('span');
        button.type = 'button'; button.textContent = record.symbol; button.dataset.intelligenceSymbol = record.symbol;
        text.textContent = ` · ${record.timeframe} ${record.direction} · ${record.status} · Opportunity ${record.opportunity_id} · ${record.why_go || 'Reason unavailable'}${fresh ? '' : ' · saved evidence only'}`;
        item.append(button, text); evidence.append(item);
      }
      if (!records.records.length) { const empty = document.createElement('p'); empty.textContent = 'No v2 executions recorded for this bot in the current run.'; evidence.append(empty); }
    } else {
      const missing = document.createElement('p'); missing.textContent = !resolved ? 'Loading current-run execution records…' : 'Current-run execution records unavailable; no absence of executions is inferred.'; evidence.append(missing);
    }
  }
  function scopeText(value) {
    const at = Date.parse(value?.started_at);
    return value?.run_id ? `Reporting scope: current paper run only · ${value.run_id} · started ${Number.isFinite(at) ? new Date(at).toLocaleString('en-AU', {timeZone: 'Australia/Brisbane'}) + ' Brisbane' : 'Unavailable'}` : 'Reporting scope: current paper run metadata unavailable';
  }
  function runMetadata() {
    if (reportingObserved && Date.now() - reportingObserved < 45000 && reporting?.run_id) return reporting;
    if (observed && Date.now() - observed < 45000 && health?.run_id) return health;
    return null;
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
      history: report ? report.history : null,
      saved_closed_reporting: !report && savedClosedReport && savedClosedReport.run_id === metadata?.run_id && savedClosedReport.started_at === metadata?.started_at ? savedClosedReport : null,
      reporting_loading: !reportingResolved};
  }
  window.V2Paper = Object.freeze({overlay, summary: () => ({metadata: runMetadata(), report: currentReporting(), loading: !reportingResolved, stale: Boolean(reportingObserved && !currentReporting())})});
  async function refresh() {
    const get = async path => { const r = await fetch(API + path, {cache: 'no-store', signal: AbortSignal.timeout(10000)}); if (!r.ok) throw Error('Unavailable'); return r.json(); };
    const reportingRequest = (async () => {
      try {
        const r = await fetch('https://api.rrr.trading/api/demos/' + bot + '/reporting', {cache: 'no-store', signal: AbortSignal.timeout(15000)});
        if (!r.ok) throw Error('Unavailable');
        reporting = await r.json(); reportingObserved = Date.now(); epochSeen ||= Boolean(reporting?.run_id);
        if (currentReporting()) savedClosedReport = {run_id:reporting.run_id, started_at:reporting.started_at, observed_at:reporting.observed_at, history:reporting.history};
      } catch { reportingObserved = 0; }
      finally {
        reportingResolved = true;
        draw(); window.dispatchEvent(new Event('v2-paper-update'));
      }
    })();
    try {
      health = await get('/execution/health');
      observed = Date.now(); resolved = true; epochSeen ||= Boolean(health?.run_id && health?.mode === 'PAPER');
      try { records = await get('/execution/records?bot=' + bot); } catch { records = null; }
    } catch { observed = 0; resolved = true; }
    await reportingRequest; reportingResolved = true;
    draw(); window.dispatchEvent(new Event('v2-paper-update'));
  }
  let refreshing = false;
  async function poll() { if (refreshing) return; refreshing = true; try { await refresh(); } finally { refreshing = false; } }
  draw(); poll(); setInterval(poll, 15000);
})();

'use strict';
(() => {
  const API = 'https://api.rrr.trading/api/v2/intelligence';
  const BOT = {
    short: { timeframe: '15m', status: '/api/demos/short/status', name: '15m' },
    medium: { timeframe: '1h', status: '/status', name: '1h' },
    long: { timeframe: '4h', status: '/api/demos/long/status', name: '4h' }
  };
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const parsed = v => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null;
  const date = v => {
    const ms = parsed(v);
    return ms === null ? 'Unavailable' : new Date(ms).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' }) + ' Brisbane';
  };
  const label = v => typeof v === 'string' && v.trim() ? v.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : 'Unavailable';
  const sentence = v => {
    if (typeof v !== 'string' || !v.trim()) return 'Reason unavailable.';
    const known = {
      NO_TIMEFRAME_CLEARS_THRESHOLDS: 'No timeframe met the recorded selection requirements.',
      NO_NONTECHNICAL_DIRECTION_CONFIRMATION: 'No non-technical direction confirmation was recorded.',
      CROSS_BOT_POSITIONS_UNVERIFIED: 'Cross-bot position status could not be verified.',
      ALL_TECHNICAL_TIMEFRAMES_UNAVAILABLE: 'Closed-candle technical evidence is unavailable.',
      INSUFFICIENT_DATA: 'Required evidence is missing or insufficient.',
      INSUFFICIENT_TECHNICAL_DATA: 'Closed-candle technical evidence is insufficient.',
      NO_CLEAR_DIRECTION: 'The recorded inputs did not establish a clear direction.',
      NO_GO: 'No timeframe met the recorded entry-opportunity thresholds.',
      STALE: 'The saved assessment is stale and is not current approval.'
    };
    if (known[v]) return known[v];
    return v.replaceAll('_', ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()) + (/[.!?]$/.test(v) ? '' : '.');
  };
  const request = async (url, timeout = 12000) => {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeout) });
    if (!response.ok) throw new Error('Unavailable');
    return response.json();
  };
  const v2Current = h => h && h.mode === 'PAPER' && (h.status === 'available' || h.status === 'disabled' && h.enabled === false) && h.stale === false && typeof h.run_id === 'string' && h.run_id && parsed(h.last_run) !== null && Date.now() - parsed(h.last_run) >= 0 && Date.now() - parsed(h.last_run) < 90000;
  const freshDecision = d => d?.available === true && d.freshness === 'FRESH';
  const chosen = (decisions, key) => {
    const list = decisions.map(x => x?.decision).filter(d => d && parsed(d.decision_time) !== null);
    return list.sort((a, b) => parsed(b.decision_time) - parsed(a.decision_time))[0] || null;
  };
  const details = (decision, timeframe) => decision?.timeframe_assessments?.[timeframe] || null;
  const currentStage = (asset, timeframe) => {
    const d = asset?.decision || {}, tf = details(d, timeframe), current = freshDecision(d);
    const e = asset?.execution || {}, executionCurrent = v2Current(e.health), executionStatus = String(e.latest_execution?.status || '').toUpperCase();
    const selected = current && d.selected_timeframe === timeframe && ['LONG', 'SHORT'].includes(d.direction);
    let stage;
    if (executionCurrent && (e.active_position === true || ['OPEN', 'FILLED'].includes(executionStatus))) stage = 'Position filled/open';
    else if (executionCurrent && e.reservation_pending === true) stage = 'Order/reservation pending · fill unverified';
    else if (executionCurrent && ['REJECTED', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(executionStatus)) stage = `Execution ${label(executionStatus)}`;
    else if (!current) stage = d.freshness === 'STALE' || d.available === false ? 'Stale · saved assessment only' : 'Current decision unavailable';
    else if (selected) stage = `Selected for ${timeframe} · entry not approved`;
    else if (d.decision === 'BLOCKED') stage = 'Blocked';
    else if (d.decision === 'NO_GO') stage = 'No timeframe selected';
    else if (d.decision === 'INSUFFICIENT_DATA') stage = 'Insufficient current evidence';
    else if (d.decision === 'GO') stage = `Selected for ${label(d.selected_timeframe)} · not assigned here`;
    else stage = label(d.decision);
    const direction = selected ? d.direction : executionCurrent && e.active_position === true && ['LONG','SHORT'].includes(e.latest_execution?.direction) ? `${e.latest_execution.direction} · existing position` : 'No direction selected';
    const reason = !current ? (d.reason_summary ? sentence(d.reason_summary) : 'Current decision reason unavailable.') : sentence(d.reason_summary || tf?.reason_summary || d.veto_reason);
    return { d, tf, current, selected, stage, direction, reason };
  };
  const executionStage = e => {
    if (!v2Current(e?.health)) return 'Execution evidence unavailable or stale';
    const r = e?.latest_execution;
    if (e?.reservation_pending === true) return 'Reservation pending · order status unverified';
    if (!r) return 'No execution record supplied';
    const status = String(r.status || '').toUpperCase();
    if (status === 'OPEN' || status === 'FILLED') return 'Position filled/open';
    if (['CLAIMED', 'UNKNOWN', 'SUBMITTED', 'PENDING'].includes(status)) return 'Submission or fill pending/unverified';
    if (['REJECTED', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(status)) return label(status);
    return `Execution record · ${label(status)}`;
  };
  const field = (labelText, value) => {
    const box = document.createElement('div'), name = document.createElement('span'), reading = document.createElement('span');
    name.className = 'candidate-label'; name.textContent = labelText;
    reading.className = 'candidate-value'; reading.textContent = value;
    box.append(name, reading); return box;
  };
  const safeDetails = (asset, timeframe) => {
    const d = asset?.decision || {}, state = currentStage(asset, timeframe), a = state.tf, e = asset?.execution || {}, sz = asset?.sizing || {};
    const list = document.createElement('div'); list.className = 'candidate-details';
    const checks = Array.isArray(a?.evidence?.flags) ? a.evidence.flags : [];
    const overallChecks = Array.isArray(d.evidence?.flags) ? d.evidence.flags : [];
    const reasons = [...new Set([...overallChecks, ...checks, d.veto_reason].filter(x => typeof x === 'string' && x.trim()))];
    const sizingCurrent = sz?.available === true && sz.freshness === 'FRESH' && parsed(sz.evidence_expires_at) > Date.now() && sz.opportunity_id === d.id;
    const rows = [
      ['Shared decision', state.current ? label(d.decision) : `${label(d.saved_decision || d.decision)} · saved only`],
      ['Timeframe assessment', a ? `${label(a.status)} · ${label(a.direction)}` : 'No timeframe assessment supplied'],
      ['Assessment reason', a?.reason_summary ? sentence(a.reason_summary) : 'No timeframe-specific reason supplied.'],
      ['Recorded checks', reasons.length ? reasons.map(sentence).join(' ') : 'No check list supplied by the feed.'],
      ['Selected horizon', state.current ? (d.selected_timeframe || 'None') : 'Unavailable · current decision stale/unavailable'],
      ['Shadow sizing / portfolio risk', sizingCurrent ? `${label(sz.risk_decision?.status || sz.risk_decision)} · ${sentence(sz.reason || sz.reason_summary)}` : (sz?.freshness && sz.freshness !== 'UNAVAILABLE' ? `${label(sz.freshness)} · ${sentence(sz.reason || sz.reason_summary)}` : 'No current sizing authorization supplied')],
      ['Execution record', executionStage(e)],
      ['Decision evaluated', date(d.decision_time)],
      ['Timeframe evidence checked', date(a?.created_at)],
      ['Closed technical candle', date(a?.evidence?.freshness?.technical_at)],
      ['Evidence freshness', state.current ? 'FRESH current decision' : `${label(d.freshness)} · saved evidence only`],
      ['Execution / risk versions', [e?.health?.versions?.execution_version, sz?.sizing_version, sz?.risk_version].filter(Boolean).join(' · ') || 'Unavailable']
    ];
    for (const [name, value] of rows) { const item = document.createElement('div'), strong = document.createElement('strong'); strong.textContent = `${name}: `; item.append(strong, document.createTextNode(value)); list.append(item); }
    return list;
  };
  const symbolButton = symbol => { const b = document.createElement('button'); b.type = 'button'; b.className = 'candidate-asset'; b.textContent = symbol; b.dataset.intelligenceSymbol = symbol; return b; };
  function renderHomeRows(symbols, assets) {
    const list = document.getElementById('candidate-progress-list'), state = document.getElementById('candidate-progress-status');
    if (!list || !Array.isArray(symbols) || !symbols.length) { if (list) list.textContent = 'Selected universe and current v2 candidate evidence unavailable.'; if (state) { state.textContent = 'Unavailable'; state.className = 'candidate-state neutral'; } return; }
    const lookup = new Map(assets.map(x => [x?.asset?.symbol, x]));
    list.replaceChildren();
    for (const symbol of symbols) {
      const asset = lookup.get(symbol), c = currentStage(asset, asset?.decision?.selected_timeframe || '1h'), d = c.d, freshness = c.current ? 'FRESH' : `${label(d?.freshness)} · saved only`;
      const card = document.createElement('article'); card.className = 'candidate-row';
      const title = document.createElement('div'); title.append(symbolButton(symbol));
      card.append(title, field('Direction', c.direction), field('Selected timeframe', c.current ? d.selected_timeframe || 'None' : 'Unavailable · stale evidence'), field('Latest outcome', c.stage), field('Waiting / blocking reason', c.reason));
      const exp = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = 'Recorded checks and evidence'; exp.append(summary, safeDetails(asset, d?.selected_timeframe || '1h')); card.append(exp);
      card.append(field('Evaluated', date(d?.decision_time)), field('Evidence freshness', freshness));
      list.append(card);
    }
    if (state) { state.textContent = 'Shared v2 decision evidence · current per-asset freshness shown below'; state.className = 'candidate-state neutral'; }
  }
  function renderActivity(panel, symbols, assets, timeframe) {
    const assigned = assets.filter(asset => freshDecision(asset?.decision) && asset.decision.selected_timeframe === timeframe).length;
    const reviewed = assets.filter(asset => {
      const d = asset?.decision || {}, a = details(d, timeframe);
      return Boolean(a && (parsed(a.created_at) !== null || parsed(a.evidence?.freshness?.technical_at) !== null));
    });
    const records = reviewed.map(asset => ({ asset, ...currentStage(asset, timeframe) }));
    const countEl = panel.querySelector('[data-candidate-assigned]');
    countEl.textContent = freshDecision(chosen(assets, timeframe)) ? `${assigned} assigned to ${timeframe} · ${records.length} timeframe assessments` : `Assignment count unavailable · ${records.length} saved timeframe assessments`;
    const summary = panel.querySelector('[data-candidate-empty]');
    const latest = records.map(r => r.tf?.evidence?.freshness?.technical_at).filter(x => parsed(x) !== null).sort((a,b) => parsed(b)-parsed(a))[0];
    if (assigned === 0 && records.length && records.every(r => r.current)) summary.textContent = `The latest available shared decision selected no asset for ${timeframe}. No entry approval, order or fill is implied. Latest relevant closed candle: ${date(latest)}.`;
    else if (!records.length) summary.textContent = 'No current timeframe evaluation records are supplied. The available feeds do not establish that this bot evaluated a candle.';
    else if (assigned === 0 && records.some(r => !r.current)) summary.textContent = `No current ${timeframe} assignment can be confirmed; some saved decisions are stale or unavailable. Latest recorded candle: ${date(latest)}.`;
    else summary.textContent = `${assigned} shared decision${assigned === 1 ? '' : 's'} selected ${timeframe}. A timeframe selection is not entry approval or an order.`;
    const body = panel.querySelector('tbody'); body.replaceChildren();
    const mobile = panel.querySelector('.candidate-mobile-rows'); mobile.replaceChildren();
    if (!records.length) { const p = document.createElement('p'); p.className = 'candidate-filter-note'; p.textContent = 'No recorded timeframe assessment rows are available.'; body.append(p); return; }
    const rowData = r => {
      const selectedElsewhere = r.current && r.d.selected_timeframe && r.d.selected_timeframe !== timeframe;
      const direction = r.selected ? r.d.direction : ['LONG','SHORT'].includes(r.tf?.direction) ? `${r.tf.direction} assessment · not assigned` : 'No selected direction';
      const execution = executionStage(r.asset?.execution);
      const outcome = /^(Position filled\/open|Reservation pending|Execution Rejected|Execution Cancelled|Execution Expired|Execution Failed)/.test(execution) ? execution : !r.current ? 'Stale · saved assessment' : r.selected ? `Selected for ${timeframe} · entry not approved` : selectedElsewhere ? `Selected for ${r.d.selected_timeframe} · not assigned here` : `${label(r.tf?.status)} · not selected`;
      const reason = r.current ? sentence(r.tf?.reason_summary || r.d.reason_summary) : 'Current shared decision is stale or unavailable.';
      return { symbol: r.asset?.asset?.symbol || 'Unavailable', direction, outcome, reason, checked: date(r.tf?.created_at), candle: date(r.tf?.evidence?.freshness?.technical_at) };
    };
    for (const r of records) {
      const v = rowData(r), tr = document.createElement('tr');
      for (const text of [v.symbol, v.direction, v.outcome, v.reason]) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
      const checked = document.createElement('td'); checked.textContent = v.checked; tr.append(checked);
      const expand = document.createElement('td'); expand.className = 'candidate-expand'; const details = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = 'Recorded checks'; details.append(summary, safeDetails(r.asset, timeframe)); expand.append(details); tr.append(expand); body.append(tr);
      const card = document.createElement('article'); card.className = 'candidate-mobile-card'; const h = document.createElement('h4'); h.textContent = v.symbol; card.append(h);
      for (const [name, value] of [['Direction', v.direction], ['Stage / outcome', v.outcome], ['Reason', v.reason], ['Last checked', v.checked]]) card.append(field(name, value));
      card.append(document.createTextNode(`Closed candle: ${v.candle}`)); const md = document.createElement('details'), ms = document.createElement('summary'); ms.textContent = 'Recorded checks'; md.append(ms, safeDetails(r.asset, timeframe)); card.append(md); mobile.append(card);
    }
  }
  async function renderBot(symbols, assets, universe, health) {
    const key = document.body.dataset.bot, cfg = BOT[key]; if (!cfg) return;
    let panel = document.getElementById('what-happening-now'), state, metrics;
    if (!panel) {
      panel = document.createElement('section'); panel.id = 'what-happening-now'; panel.className = 'panel candidate-progress bot-candidate-panel'; panel.setAttribute('aria-labelledby', 'what-happening-title');
      const heading = document.createElement('div'); heading.className = 'candidate-heading';
      const title = document.createElement('div'), h = document.createElement('h2'); h.id = 'what-happening-title'; h.textContent = "What's happening now?"; title.append(h);
      state = document.createElement('span'); state.className = 'candidate-state neutral'; state.setAttribute('role','status'); state.textContent = 'Loading current bot and v2 evidence'; heading.append(title,state);
      metrics = document.createElement('div'); metrics.className = 'candidate-progress-list'; metrics.id = 'bot-current-status';
      const activity = document.createElement('section'); activity.className = 'candidate-activity'; const ah = document.createElement('h3'); ah.textContent = `Candidate activity · ${cfg.timeframe}`;
      const activityNote = document.createElement('p'); activityNote.className = 'candidate-filter-note'; activityNote.textContent = 'Rows require a recorded assessment for this timeframe. They are not all assigned candidates. The feed supplies the latest decision and assessments, not a full sequence of internal stages.';
      const assigned = document.createElement('p'); assigned.className = 'candidate-filter-note'; assigned.dataset.candidateAssigned = ''; const empty = document.createElement('p'); empty.className = 'candidate-run-summary'; empty.dataset.candidateEmpty = '';
      const tableWrap = document.createElement('div'); tableWrap.className = 'tablewrap candidate-desktop-table'; tableWrap.tabIndex = 0; tableWrap.setAttribute('role','region'); tableWrap.setAttribute('aria-label', `${cfg.timeframe} candidate activity table`); const table = document.createElement('table'); table.className = 'candidate-activity-table'; const thead = document.createElement('thead'), tr = document.createElement('tr');
      for (const name of ['Asset','Direction','Stage / outcome','Reason','Last checked','Details']) { const th = document.createElement('th'); th.textContent = name; tr.append(th); }
      thead.append(tr); const tbody = document.createElement('tbody'); table.append(thead,tbody); tableWrap.append(table);
      const mobile = document.createElement('div'); mobile.className = 'candidate-mobile-rows';
      const link = document.createElement('p'); link.className = 'v2-home-link'; const anchor = document.createElement('a'); anchor.href = '/#live-candidate-progress'; anchor.textContent = 'View the complete shared decision view on the homepage →'; link.append(anchor);
      activity.append(ah,activityNote,assigned,empty,tableWrap,mobile,link); panel.append(heading,metrics,activity);
      const anchorAt = document.querySelector('main .section-label, main #settings'); if (anchorAt?.parentNode) anchorAt.parentNode.insertBefore(panel, anchorAt); else document.querySelector('main')?.prepend(panel);
    } else { state = panel.querySelector('[role="status"]'); metrics = panel.querySelector('#bot-current-status'); }
    metrics.replaceChildren();
    try {
      const botStatus = await request('https://api.rrr.trading' + cfg.status);
      const native = botStatus?.bot || {}, open = botStatus?.open_trades;
      const botFresh = botStatus?.ok === true && finite(botStatus.generated_at) && Math.abs(Date.now()/1000 - botStatus.generated_at) <= 30 && native.timeframe === cfg.timeframe && native.mode === 'PAPER';
      const assignedCount = assets.filter(a => freshDecision(a?.decision) && a.decision.selected_timeframe === cfg.timeframe).length;
      const latestDecision = chosen(assets, cfg.timeframe);
      const evaluation = assets.map(a => details(a?.decision, cfg.timeframe)?.created_at).filter(x => parsed(x) !== null).sort((a,b) => parsed(b)-parsed(a))[0];
      const candle = assets.map(a => details(a?.decision, cfg.timeframe)?.evidence?.freshness?.technical_at).filter(x => parsed(x) !== null).sort((a,b) => parsed(b)-parsed(a))[0];
      const run = v2Current(health) ? `Current run ${health.run_id} · PAPER ${health.enabled ? 'active' : 'paused'}` : 'Current v2 paper run unavailable or stale';
      const assetCount = Array.isArray(native.pairs) ? new Set(native.pairs.filter(x => typeof x === 'string')).size : null;
      const universeFresh = universe?.universe_sync?.fresh === true && parsed(universe.universe_sync.valid_until) > Date.now();
      metrics.append(field('Bot status', botFresh ? `${label(native.state)} · PAPER` : 'Unavailable or stale'), field('Current v2 run', run), field('Assets loaded', assetCount === null ? 'Unavailable' : `${assetCount} in bot feed`), field('V2 asset decision records', `${assets.length} of ${symbols.length || 0} selected assets`), field('Universe synchronization', universeFresh ? `${universe.universe_sync.selected_symbols?.length || 0} selected · synchronized ${date(universe.universe_sync.synced_at)}` : 'Stale or unavailable'), field('Page data refreshed', date(new Date().toISOString())), field('Latest timeframe evaluation', date(evaluation)), field('Latest shared decision', date(latestDecision?.decision_time)), field(`Latest ${cfg.timeframe} closed candle`, date(candle)), field(`Assigned to ${cfg.timeframe}`, v2Current(health) ? String(assignedCount) : 'Unavailable · v2 health stale'), field('Pending orders', 'Unavailable · no reliable pending-order count is published'), field('Open bot positions', botFresh && Array.isArray(open) ? String(open.length) : 'Unavailable'));
      const blocking = assignedCount ? 'A timeframe selection is recorded; entry approval and execution remain separate checks.' : latestDecision?.available === true ? sentence(latestDecision.reason_summary) : 'Current shared decision reason unavailable or stale.';
      metrics.append(field('Main waiting / blocking reason', blocking));
      state.textContent = botFresh && v2Current(health) ? 'Live bot and current v2 run' : 'Missing or stale operating evidence'; state.className = 'candidate-state ' + (botFresh && v2Current(health) ? 'pass' : 'neutral');
      renderActivity(panel, symbols, assets, cfg.timeframe);
    } catch {
      state.textContent = 'Bot operating evidence unavailable'; state.className = 'candidate-state neutral';
      metrics.append(field('Bot and current v2 run', 'Unavailable'), field('Pending orders', 'Unavailable · no reliable pending-order count is published'), field('Open bot positions', 'Unavailable'));
      panel.querySelector('[data-candidate-assigned]').textContent = 'Timeframe assignment count unavailable.';
      panel.querySelector('[data-candidate-empty]').textContent = 'Current timeframe evaluations could not be loaded.';
      panel.querySelector('tbody')?.replaceChildren(); panel.querySelector('.candidate-mobile-rows')?.replaceChildren();
      const p = document.createElement('p'); p.className = 'candidate-filter-note'; p.textContent = 'Candidate activity unavailable.'; panel.querySelector('tbody').append(p);
    }
  }
  let homePerformance = null, homeCandidateState = { symbols: [], assets: [] };
  function renderHomeDecisionCards() {
    const configs = { short: '15m', medium: '1h', long: '4h' };
    for (const [key, timeframe] of Object.entries(configs)) {
      const card = document.querySelector(`[data-home-bot="${key}"]`), dlist = card?.querySelector('dl'); if (!dlist) continue;
      const dt = Array.from(dlist.querySelectorAll('dt')).find(node => node.textContent === 'Latest v2 decision'), dd = dt?.nextElementSibling;
      if (!dd) continue;
      const latest = chosen(homeCandidateState.assets, timeframe), assigned = homeCandidateState.assets.filter(a => freshDecision(a?.decision) && a.decision.selected_timeframe === timeframe).length;
      dd.textContent = !latest ? 'Unavailable' : !freshDecision(latest) ? 'Stale or unavailable' : `${assigned} assigned · ${label(latest.decision)}`;
    }
  }
  function renderHomePerformance() {
    if (!homePerformance) return;
    for (const [key, performance] of Object.entries(homePerformance.values)) {
      const card = document.querySelector(`[data-home-bot="${key}"]`); if (!card) continue;
      card.querySelector('.v2-home-performance')?.remove();
      const dl = document.createElement('dl'); dl.className = 'v2-home-performance';
      const current = v2Current(homePerformance.health) && performance?.available === true && performance.run_id === homePerformance.health.run_id;
      const money = v => finite(v) ? `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} USDT` : 'Unavailable';
      const win = current ? (performance.trade_count === 0 ? 'No completed trades yet' : finite(performance.win_rate) ? `${performance.win_rate.toFixed(1)}%` : 'Unavailable') : 'V2 performance unavailable';
      const rows = [['Current v2 run', current ? homePerformance.health.run_id : 'Unavailable · run evidence missing/stale'], ['Realized P/L', current ? money(performance.realized_pnl) : 'Unavailable'], ['Win rate', win], ['Closed v2 trades', current && Number.isSafeInteger(performance.trade_count) ? String(performance.trade_count) : 'Unavailable']];
      for (const [k,v] of rows) { const item = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; item.append(dt,dd); dl.append(item); }
      card.append(dl);
    }
    renderHomeDecisionCards();
  }
  async function refreshHomePerformance() {
    const botKeys = ['short','medium','long'];
    try {
      const health = await request(API + '/execution/health');
      const values = await Promise.all(botKeys.map(async key => { try { return [key, await request(API + '/execution/performance?bot=' + key)]; } catch { return [key, null]; } }));
      homePerformance = { health, values: Object.fromEntries(values) }; renderHomePerformance();
    } catch { homePerformance = { health: null, values: Object.fromEntries(botKeys.map(k => [k,null])) }; renderHomePerformance(); }
  }
  async function refresh() {
    const home = document.getElementById('candidate-progress-list');
    const botKey = document.body.dataset.bot;
    if (!home && !BOT[botKey]) return;
    try {
      const universe = await request(API + '/opportunities?limit=1');
      const symbols = Array.isArray(universe?.universe_sync?.selected_symbols) ? universe.universe_sync.selected_symbols.filter(x => typeof x === 'string') : [];
      const responses = await Promise.all(symbols.map(async symbol => { try { const data = await request(API + '/assets/' + encodeURIComponent(symbol)); return data?.asset?.symbol === symbol ? data : null; } catch { return null; } }));
      const assets = responses.filter(Boolean);
      if (home) {
        homeCandidateState = { symbols, assets }; renderHomeDecisionCards();
        renderHomeRows(symbols, assets);
        const updated = document.getElementById('candidate-progress-updated');
        const last = chosen(assets, '1h');
        if (updated) updated.textContent = `Latest recorded shared evaluation: ${date(last?.decision_time)} · page refreshed ${date(new Date().toISOString())}. Page refresh, decision time, timeframe candle time and trade times are separate.`;
      } else await renderBot(symbols, assets, universe, assets[0]?.execution?.health);
    } catch {
      if (home) { home.textContent = 'Selected universe or v2 decision evidence unavailable. No candidate progress is inferred.'; const state = document.getElementById('candidate-progress-status'); if (state) { state.textContent = 'Unavailable'; state.className = 'candidate-state neutral'; } }
      else if (BOT[botKey]) {
        await renderBot([], [], null, null);
        const panel = document.getElementById('what-happening-now');
        if (panel) { panel.querySelector('[data-candidate-assigned]').textContent = 'Timeframe assignment unavailable · v2 opportunity feed failed.'; panel.querySelector('[data-candidate-empty]').textContent = 'No current evaluation can be confirmed because the selected universe feed is unavailable.'; }
      }
    }
  }
  if (document.getElementById('candidate-progress-list')) {
    refresh(); refreshHomePerformance();
    setInterval(() => { if (!document.hidden) { refresh(); refreshHomePerformance(); } }, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { refresh(); refreshHomePerformance(); } });
    const cards = document.getElementById('homepage-bots');
    if (cards && typeof MutationObserver === 'function') new MutationObserver(renderHomePerformance).observe(cards, { childList: true });
  } else if (BOT[document.body.dataset.bot]) {
    refresh(); setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  }
})();

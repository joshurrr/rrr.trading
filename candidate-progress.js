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
  const compactDate = v => {
    const ms = parsed(v); if (ms === null) return 'Unavailable';
    const calendar = d => d.toLocaleDateString('en-AU', {timeZone:'Australia/Brisbane'});
    return calendar(new Date(ms)) === calendar(new Date()) ? new Date(ms).toLocaleTimeString('en-AU', {timeZone:'Australia/Brisbane'}) : date(v);
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
  const universeCurrent = universe => universe?.universe_sync?.fresh === true && parsed(universe.universe_sync.valid_until) > Date.now();
  // Assignment comes only from the current backend selection, never assessment direction.
  const assignedHere = (asset, timeframe) => freshDecision(asset?.decision) && asset.decision.selected_timeframe === timeframe;
  const executionHere = (asset, timeframe) => asset?.execution?.latest_execution?.timeframe === timeframe ? asset.execution : null;
  const botAsset = (asset, timeframe) => ({ ...asset, execution: executionHere(asset, timeframe) });
  function activitySection(timeframe) {
    const section = document.createElement('section'); section.className = 'candidate-activity';
    const heading = document.createElement('h3'); heading.textContent = `${timeframe} Candidates`;
    const count = document.createElement('p'); count.dataset.candidateAssigned = ''; count.className = 'candidate-filter-note';
    const empty = document.createElement('p'); empty.dataset.candidateEmpty = ''; empty.className = 'candidate-run-summary'; empty.setAttribute('role', 'status');
    const warnings = document.createElement('div'); warnings.className = 'candidate-safety';
    const wrap = document.createElement('div'); wrap.className = 'tablewrap candidate-desktop-table'; wrap.tabIndex = 0; wrap.setAttribute('role','region'); wrap.setAttribute('aria-label', `${timeframe} candidates`);
    const table = document.createElement('table'); table.className = 'candidate-activity-table';
    const head = document.createElement('thead'), row = document.createElement('tr');
    for (const name of ['Asset','Direction','Current state','Reason','Last checked','Details']) { const cell = document.createElement('th'); cell.textContent = name; row.append(cell); }
    head.append(row); table.append(head, document.createElement('tbody')); wrap.append(table);
    const mobile = document.createElement('div'); mobile.className = 'candidate-mobile-rows';
    section.append(heading, count, empty, warnings, wrap, mobile); return section;
  }
  function renderActivity(panel, symbols, assets, timeframe, universe, positions) {
    const openSymbols = new Set(positions.fresh ? positions.trades.map(t => typeof t.pair === 'string' ? t.pair.match(/^([^/]+)\/USDT(?::USDT)?$/)?.[1] : null).filter(Boolean) : []);
    const records = assets.filter(a => assignedHere(a, timeframe) && !openSymbols.has(a.asset.symbol));
    const complete = universeCurrent(universe) && symbols.length > 0 && assets.length === symbols.length;
    panel.querySelector('[data-candidate-assigned]').textContent = complete ? `${records.length} assigned to ${timeframe}` : `${records.length} confirmed assignments to ${timeframe} · complete count unavailable`;
    const empty = panel.querySelector('[data-candidate-empty]'); empty.hidden = records.length > 0;
    const duration = { '15m': '15-minute', '1h': '1-hour', '4h': '4-hour' }[timeframe];
    empty.textContent = complete ? `No assets currently assigned to the ${timeframe} bot. The shared Top-10 continues to be assessed. Assets will appear here when the decision engine assigns them to the ${duration} timeframe.` : 'Current assignments cannot be fully verified because shared universe or asset evidence is unavailable. No assignment is inferred.';
    panel.querySelector('.candidate-desktop-table').hidden = !records.length;
    const body = panel.querySelector('tbody'), mobile = panel.querySelector('.candidate-mobile-rows'); body.replaceChildren(); mobile.replaceChildren(); mobile.hidden = !records.length;
    const warnings = panel.querySelector('.candidate-safety'); warnings.replaceChildren();
    if (!positions.fresh) {
      const notice = document.createElement('p'); notice.className = 'candidate-warning';
      notice.textContent = 'Current position observations unavailable or stale. Open positions and exit-monitoring status cannot be verified from this feed.'; warnings.append(notice);
    }
    if (openSymbols.size) {
      const note = document.createElement('p'); note.className = 'candidate-position-note';
      note.append(document.createTextNode(`${Array.from(openSymbols).join(', ')} · open position${openSymbols.size === 1 ? '' : 's'}. Existing exit rules manage these trades; entry assessments remain in recorded diagnostics. `));
      const link = document.createElement('a'); link.href = '#exit-panel'; link.textContent = 'View exit monitoring'; note.append(link); warnings.append(note);
    }
    for (const asset of assets) {
      if (openSymbols.has(asset.asset.symbol)) continue;
      const d = asset.decision || {}, e = executionHere(asset, timeframe);
      const expiredHere = !freshDecision(d) && (d.saved_selected_timeframe === timeframe || d.selected_timeframe === timeframe);
      const activeHere = e && (e.active_position === true || e.reservation_pending === true);
      if (expiredHere || activeHere && !freshDecision(d)) {
        const notice = document.createElement('p'); notice.className = 'candidate-warning';
        notice.textContent = `${asset.asset.symbol} assessment ${label(d.freshness).toLowerCase()} — no current entry approval. ${sentence(d.reason_summary)}${expiredHere ? ' Saved selection for this timeframe; excluded from current candidates.' : ' This bot has recorded position/reservation evidence.'}`;
        warnings.append(notice);
      }
    }
    for (const asset of records) {
      const scoped = botAsset(asset, timeframe), c = currentStage(scoped, timeframe), d = c.d;
      const values = [d.direction || 'Unavailable', c.stage, c.reason, date(d.decision_time)];
      const row = document.createElement('tr'), symbol = document.createElement('td'); symbol.append(symbolButton(asset.asset.symbol)); row.append(symbol);
      for (const value of values) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
      const expand = () => { const detail = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = 'Recorded checks'; detail.append(summary, safeDetails(scoped, timeframe)); return detail; };
      const cell = document.createElement('td'); cell.className = 'candidate-expand'; cell.append(expand()); row.append(cell); body.append(row);
      const card = document.createElement('article'); card.className = 'candidate-mobile-card'; card.append(symbolButton(asset.asset.symbol));
      ['Direction','Current state','Reason','Last checked'].forEach((name, i) => card.append(field(name, values[i]))); card.append(expand()); mobile.append(card);
    }
  }
  function botLayout(cfg) {
    const main = document.querySelector('main');
    const panel = document.createElement('section'); panel.id = 'what-happening-now'; panel.className = 'panel candidate-progress bot-candidate-panel'; panel.setAttribute('aria-labelledby','what-happening-title');
    const heading = document.createElement('div'); heading.className = 'candidate-heading';
    const title = document.createElement('h2'); title.id = 'what-happening-title'; title.textContent = "What's happening now?";
    const state = document.createElement('span'); state.className = 'candidate-state neutral'; state.setAttribute('role','status'); state.textContent = 'Loading bot evidence'; heading.append(title,state);
    const metrics = document.createElement('div'); metrics.id = 'bot-current-status'; metrics.className = 'candidate-progress-list';
    const meta = document.createElement('p'); meta.className = 'candidate-filter-note'; meta.dataset.botMeta = '';
    panel.append(heading,metrics,meta,activitySection(cfg.timeframe));
    const diagnostics = document.createElement('details'); diagnostics.id = 'shared-assessment-diagnostics'; diagnostics.className = 'panel candidate-progress';
    const summary = document.createElement('summary'); summary.textContent = 'Shared assessment diagnostics · loading';
    const list = document.createElement('div'); list.className = 'candidate-progress-list'; list.dataset.sharedAssessments = '';
    const link = document.createElement('p'); link.className = 'v2-home-link'; const anchor = document.createElement('a'); anchor.href = '/#live-candidate-progress'; anchor.textContent = 'View the complete shared decision view on the homepage →'; link.append(anchor);
    const secondary = document.createElement('p'); secondary.dataset.sharedMeta = ''; secondary.className = 'candidate-filter-note';
    diagnostics.append(summary,secondary,list,link);
    const operational = main.querySelector('#bot-operational-details');
    const open = main.querySelector('.open-trades-section'), completed = main.querySelector('.completed-trades-section'), exit = main.querySelector('#exit-panel')?.closest('.trade-panel'), footer = main.querySelector('footer');
    // Preserve existing feed owners and DOM IDs; move presentation containers only.
    for (const child of Array.from(main.children)) if (![open,completed,exit,footer,operational,main.querySelector('#bot-summary')].includes(child)) operational.append(child);
    const botSummary = main.querySelector('#bot-summary');
    if (botSummary) botSummary.after(panel); else main.prepend(panel);
    main.insertBefore(diagnostics, operational);
    for (const section of [open, exit, completed]) if (section) main.insertBefore(section, diagnostics);
    return panel;
  }
  let botCountStatus = null;
  function updateScopedOpenCount() {
    const reading = document.querySelector('[data-current-run-open-count] .candidate-value');
    if (!reading) return;
    const scoped = window.V2Paper?.overlay(botCountStatus || {bot:{}});
    reading.textContent = scoped && Array.isArray(scoped.open_trades) ? String(scoped.open_trades.length) : 'Unavailable';
  }
  window.addEventListener('v2-paper-update', updateScopedOpenCount);
  async function renderBot(symbols, assets, universe, health) {
    const cfg = BOT[document.body.dataset.bot]; if (!cfg) return;
    const panel = document.getElementById('what-happening-now') || botLayout(cfg);
    const metrics = panel.querySelector('#bot-current-status'), state = panel.querySelector('[role="status"]');
    const diagnostic = document.getElementById('shared-assessment-diagnostics');
    diagnostic.querySelector('summary').textContent = `Shared assessment diagnostics · ${symbols.length} assets${universeCurrent(universe) ? '' : ' · universe unavailable/stale'}`;
    const list = diagnostic.querySelector('[data-shared-assessments]'); list.replaceChildren();
    const lookup = new Map(assets.map(a => [a.asset.symbol,a]));
    for (const symbol of symbols) {
      const asset = lookup.get(symbol), d = asset?.decision || {}, c = currentStage(botAsset(asset, cfg.timeframe), cfg.timeframe);
      const card = document.createElement('article'); card.className = 'candidate-row'; card.append(symbolButton(symbol), field('Shared outcome', freshDecision(d) ? label(d.decision) : `${label(d.freshness)} · saved only`), field('Selected timeframe', freshDecision(d) ? d.selected_timeframe || 'None' : d.saved_selected_timeframe ? `${d.saved_selected_timeframe} · expired selection` : 'Unavailable'), field(`${cfg.timeframe} assessment`, c.tf ? label(c.tf.status) : 'Unavailable'), field('Reason', c.reason));
      const details = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = 'Recorded checks'; details.append(summary,safeDetails(botAsset(asset, cfg.timeframe),cfg.timeframe)); card.append(details); list.append(card);
    }
    if (!symbols.length) list.textContent = 'Shared universe unavailable; no asset assessment is inferred.';
    diagnostic.querySelector('[data-shared-meta]').textContent = `V2 asset decision records: ${assets.length} of ${symbols.length}. Latest shared decision: ${date(chosen(assets)?.decision_time)}. Pending-order count unavailable; no reliable count is published.`;
    const evaluation = assets.map(a => details(a.decision,cfg.timeframe)?.created_at).filter(x => parsed(x) !== null).sort((a,b) => parsed(b)-parsed(a))[0];
    const candle = assets.map(a => details(a.decision,cfg.timeframe)?.evidence?.freshness?.technical_at).filter(x => parsed(x) !== null).sort((a,b) => parsed(b)-parsed(a))[0];
    let botStatus = null; try { botStatus = await request('https://api.rrr.trading' + cfg.status); } catch { /* Retain independent decision evidence with honest missing bot state. */ }
    const native = botStatus?.bot || {};
    const botFresh = botStatus?.ok === true && finite(botStatus.generated_at) && Math.abs(Date.now()/1000 - botStatus.generated_at) <= 30 && native.timeframe === cfg.timeframe && native.mode === 'PAPER';
    const positions = { fresh: botFresh && Array.isArray(botStatus.open_trades), trades: Array.isArray(botStatus?.open_trades) ? botStatus.open_trades : [] };
    renderActivity(panel,symbols,assets,cfg.timeframe,universe,positions);
    const complete = universeCurrent(universe) && symbols.length > 0 && assets.length === symbols.length;
    const count = panel.querySelectorAll('tbody tr').length;
    const openCount = field('Open positions', 'Unavailable'); openCount.dataset.currentRunOpenCount = '';
    botCountStatus = botFresh ? botStatus : null;
    metrics.replaceChildren(field('Bot status',botFresh ? `${label(native.state)} · ${native.mode}` : 'Unavailable or stale'), field('Current v2 run',v2Current(health) ? `${health.run_id}${health.enabled === false ? ' · PAPER paused' : ''}${health.kill_switch === true ? ' · kill switch active' : ''}` : 'Unavailable or stale'), field('Shared universe',universeCurrent(universe) ? `${symbols.length} assets loaded` : 'Unavailable or stale'), field(`Assigned to ${cfg.timeframe}`,complete ? String(count) : `${count} confirmed · total unavailable`), openCount, field(`Latest ${cfg.timeframe} closed candle`,date(candle)));
    updateScopedOpenCount();
    panel.querySelector('[data-bot-meta]').textContent = `Universe synchronised ${compactDate(universe?.universe_sync?.synced_at)} · Last ${cfg.timeframe} assessment ${compactDate(evaluation)} · Page refreshed ${compactDate(new Date().toISOString())} · Brisbane`;
    state.textContent = botFresh && v2Current(health) ? health.enabled === false || health.kill_switch === true ? 'Paper entries paused / blocked' : 'Live bot and current v2 run' : 'Missing or stale operating evidence'; state.className = 'candidate-state ' + (botFresh && v2Current(health) ? health.enabled === false || health.kill_switch === true ? 'wait' : 'pass' : 'neutral');
  }
  let homePerformance = null, homeCandidateState = { symbols: [], assets: [] }, homeCandidatesResolved=false;
  // Homepage-only view of existing shared decisions and already fetched native status.
  // Native positions remain visible outside the Top-10; current-run counts use the run boundary.
  function renderHomeSummary() {
    const host=document.getElementById('homepage-activity-summary');if(!host)return;
    const rows=[], positions=new Set(), status=window.homepageBotStatus;
    window.ActivityPerformance?.render(status);
    let verified=0;
    for(const [key,cfg] of Object.entries(BOT)){
      const data=status?.[key];
      const current=data?.ok===true && finite(data.generated_at) && Math.abs(Date.now()/1000-data.generated_at)<=30 && data.bot?.timeframe===cfg.timeframe && data.bot.mode==='PAPER' && Array.isArray(data.open_trades) && data.open_trades.every(t=>typeof t?.pair==='string'&&/^[A-Z0-9]{1,20}\/USDT(?::USDT)?$/.test(t.pair));
      const nativeTrades=window.ActivityPerformance ? window.ActivityPerformance.positions(data,cfg.timeframe) : current ? data.open_trades : null;
      if(nativeTrades===null)continue;verified++;
      for(const trade of nativeTrades){
        const symbol=typeof trade.pair==='string'?trade.pair.match(/^([A-Z0-9]{1,20})\/USDT(?::USDT)?$/)?.[1]:null;
        if(!symbol)continue;
        positions.add(symbol+'|'+cfg.timeframe);
        rows.push({symbol,direction:['LONG','SHORT'].includes(trade.direction)?trade.direction:'Unverified',timeframe:cfg.timeframe,stage:'Position open · native paper',priority:0,id:trade.id,details:window.ActivityPerformance?.tradeDetails(trade),pnl:finite(trade.profit_abs)?trade.profit_abs:null,pct:finite(trade.profit_abs)&&finite(trade.profit_pct)?trade.profit_pct:null});
      }
    }
    for(const asset of homeCandidateState.assets){
      const d=asset.decision||{}, e=asset.execution, tf=e?.latest_execution?.timeframe||d.selected_timeframe;
      if(positions.has(asset.asset.symbol+'|'+tf))continue;
      const executionCurrent=v2Current(e?.health);
      const active=executionCurrent&&e.active_position===true;
      const pending=executionCurrent&&e.reservation_pending===true;
      if(!active&&!pending&&!freshDecision(d))continue;
      const selected=freshDecision(d)&&['15m','1h','4h'].includes(d.selected_timeframe);
      if(!active&&!pending&&!selected&&d.decision!=='BLOCKED')continue;
      const stage=active?'Position open · current execution evidence':pending?'Reservation pending · order/fill unverified':selected?`Selected for ${d.selected_timeframe} · entry not approved`:'Entry blocked';
      const direction=active||pending?['LONG','SHORT'].includes(e?.latest_execution?.direction)?e.latest_execution.direction:'Unverified':selected&&['LONG','SHORT'].includes(d.direction)?d.direction:'No direction selected';
      rows.push({symbol:asset.asset.symbol,direction,timeframe:active||pending?tf||'Unverified':selected?d.selected_timeframe:'None selected',stage,priority:active?0:pending?1:selected?2:4});
    }
    rows.sort((a,b)=>a.priority-b.priority||a.symbol.localeCompare(b.symbol)||a.timeframe.localeCompare(b.timeframe));
    const emptyText=!status||!homeCandidatesResolved?'Loading position and candidate evidence…':verified===3&&homeCandidateState.symbols.length&&homeCandidateState.assets.length===homeCandidateState.symbols.length&&homeCandidateState.assets.every(a=>freshDecision(a.decision))?'No positions or selected candidates confirmed in current coverage. See all recorded decisions below.':'No current activity can be confirmed from complete fresh evidence. See saved decisions below; missing data does not prove no positions.';
    const signature=JSON.stringify(rows.length?rows:emptyText);
    if(host.dataset.renderedSummary!==signature){
      host.dataset.renderedSummary=signature;
      const retained=new Set();
      for(const r of rows){
        const row=document.createElement('article');row.className='activity-row';row.dataset.priority=r.priority;
        row.dataset.activityKey=JSON.stringify([r.timeframe,r.symbol,r.id??r.stage]);
        row.append(symbolButton(r.symbol),field('Direction',r.direction),field('Bot / horizon',r.timeframe));
        if(r.priority===0){
          row.dataset.openPosition='';
          row.append(field('Trade size · remaining at entry price',r.details?.size||'Unavailable'),field('Opened at',r.details?.openedAt||'Unavailable'));
          const duration=field('Time open',r.details?.age||'Unavailable'); duration.className='activity-age';
          duration.querySelector('.candidate-value').dataset.openedAt=r.details?.opened??'';
          row.append(duration);
          const money=window.ActivityPerformance?.money(r.pnl)||'Unavailable';
          const pnl=field('Current unrealised P/L',money+(finite(r.pct)?` (${r.pct>0?'+':r.pct<0?'−':''}${Math.abs(r.pct).toFixed(2)}%)`:''));
          pnl.className='activity-pnl';pnl.querySelector('.candidate-value').dataset.tone=window.ActivityPerformance?.tone(r.pnl)||'neutral';row.append(pnl);
        }
        row.append(field('Current status',r.stage));
        const existing=Array.from(host.children).find(n=>n.dataset.activityKey===row.dataset.activityKey);
        if(existing){
          const oldValues=existing.querySelectorAll('.candidate-value'),newValues=row.querySelectorAll('.candidate-value');
          newValues.forEach((value,i)=>{if(oldValues[i].textContent!==value.textContent)oldValues[i].textContent=value.textContent;oldValues[i].dataset.tone=value.dataset.tone||'neutral';if('openedAt' in value.dataset)oldValues[i].dataset.openedAt=value.dataset.openedAt;});
        }
        const target=existing||row;retained.add(target);
        const at=host.children[retained.size-1];if(at!==target)host.insertBefore(target,at||null);
      }
      for(const child of Array.from(host.children))if(!retained.has(child))child.remove();
      if(!rows.length){const empty=document.createElement('p');empty.className='muted';empty.textContent=emptyText;host.append(empty);}
    }
    const failedRefreshes=Object.entries(BOT).filter(([key])=>window.homepageBotRefreshFailed?.[key]).map(([,cfg])=>cfg.timeframe);
    document.getElementById('homepage-position-warning').textContent=`${verified} of 3 native position feeds verified. ${failedRefreshes.length?`Latest ${failedRefreshes.join('/')} refresh failed; any retained observation expires after 45 seconds. `:''}${verified<3?'Missing or stale feeds cannot establish that a bot has no open positions. ':''}Open-row P/L is current native PAPER unrealised P/L, not a 24-hour change. The summary includes native history across V2 runs; bot performance cards below retain their current-run scope.`;
    for(const card of document.querySelectorAll('#universe-assets .universe-card')){
      const symbol=card.querySelector('[data-intelligence-symbol]')?.dataset.intelligenceSymbol, asset=homeCandidateState.assets.find(a=>a.asset.symbol===symbol);
      let line=card.querySelector('.universe-live-state');if(!line){line=document.createElement('p');line.className='universe-live-state';card.append(line);}
      const position=rows.find(r=>r.symbol===symbol&&r.priority<=1), d=asset?.decision;
      line.textContent=position?`${position.direction} · ${position.timeframe} · ${position.stage}`:freshDecision(d)&&d.selected_timeframe&&['LONG','SHORT'].includes(d.direction)?`${d.direction} · ${d.selected_timeframe} · selected horizon; entry unconfirmed`:freshDecision(d)&&d.decision==='BLOCKED'?'No direction selected · entry blocked':'No current direction selected';
    }
  }
  setInterval(() => { for (const node of document.querySelectorAll('#homepage-activity-summary [data-opened-at]')) node.textContent=window.ActivityPerformance?.age(node.dataset.openedAt ? Number(node.dataset.openedAt) : null)||'Unavailable'; },60000);
  window.addEventListener('homepage-bot-status',()=>{renderHomePerformance();renderHomeSummary();});
  function renderHomeDecisionCards() {
    const configs = { short: '15m', medium: '1h', long: '4h' };
    for (const [key, timeframe] of Object.entries(configs)) {
      const card = document.querySelector(`[data-home-bot="${key}"]`), dlist = card?.querySelector('dl'); if (!dlist) continue;
      const dt = Array.from(dlist.querySelectorAll('dt')).find(node => node.textContent === 'Latest v2 decision'), dd = dt?.nextElementSibling;
      if (!dd) continue;
      if(!homeCandidatesResolved){dd.textContent='Loading recorded decisions…';continue;}
      const latest = chosen(homeCandidateState.assets, timeframe), assigned = homeCandidateState.assets.filter(a => freshDecision(a?.decision) && a.decision.selected_timeframe === timeframe).length;
      dd.textContent = !latest ? 'Unavailable' : !freshDecision(latest) ? 'Stale or unavailable' : `${assigned} assigned · ${label(latest.decision)}`;
    }
  }
  function renderHomePerformance() {
    if (!homePerformance) return;
    for (const [key, performance] of Object.entries(homePerformance.values)) {
      const card = document.querySelector(`[data-home-bot="${key}"]`), dl = card?.querySelector('dl'); if (!dl) continue;
      const observed=parsed(performance?.observed_at), started=parsed(performance?.started_at);
      // Same native current-run reporting contract as the existing bot pages.
      const current = v2Current(homePerformance.health) && performance?.available === true && performance.run_id === homePerformance.health.run_id && started!==null && started===parsed(homePerformance.health.started_at) && observed!==null && Date.now()-observed>=-30000 && Date.now()-observed<45000 && performance.portfolio && Array.isArray(performance.history) && Array.isArray(performance.open_trades);
      const pnl=performance?.portfolio?.profit_closed_abs, tradeCount=performance?.portfolio?.closed_trades, winRate=performance?.portfolio?.win_rate;
      const money = v => finite(v) ? `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} USDT` : 'Unavailable';
      const win = current ? (tradeCount === 0 ? 'No completed trades yet' : finite(winRate) && winRate>=0 && winRate<=100 ? `${winRate.toFixed(1)}%` : 'Unavailable') : 'V2 performance unavailable';
      const native=window.homepageBotStatus?.[key], boundary=parsed(homePerformance.health?.started_at);
      const openedAt=t=>typeof t.open_date==='string'?Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(t.open_date)?t.open_date:t.open_date.replace(' ','T')+'Z'):NaN;
      const positionsCurrent=v2Current(homePerformance.health)&&boundary!==null&&(window.ActivityPerformance?window.ActivityPerformance.positions(native,BOT[key].timeframe)!==null:native?.ok===true&&finite(native.generated_at)&&Math.abs(Date.now()/1000-native.generated_at)<=30)&&Array.isArray(native?.open_trades)&&native.open_trades.every(t=>Number.isFinite(openedAt(t)));
      const openCount=positionsCurrent?String(native.open_trades.filter(t=>openedAt(t)>=boundary).length):'Unavailable';
      const rows = [['Current v2 run', current ? homePerformance.health.run_id : 'Unavailable · run evidence missing/stale'], ['Realized P/L', current ? money(pnl) : 'Unavailable'], ['Win rate', win], ['Open v2 positions',openCount], ['Closed v2 trades', current && Number.isSafeInteger(tradeCount) && tradeCount>=0 ? String(tradeCount) : 'Unavailable']];
      for (const [k,v] of rows) {
        const dt = Array.from(dl.querySelectorAll('dt')).find(node => node.textContent === k), dd = dt?.nextElementSibling;
        if (dd) {dd.textContent = v;if(k==='Realized P/L')dd.dataset.tone=current&&finite(pnl)?pnl>0?'up':pnl<0?'down':'neutral':'neutral';}
      }
    }
    renderHomeDecisionCards();
    renderHomeSummary();
  }
  async function refreshHomePerformance() {
    const botKeys = ['short','medium','long'];
    try {
      const health = await request(API + '/execution/health');
      const values = await Promise.all(botKeys.map(async key => { try { return [key, await request('https://api.rrr.trading/api/demos/' + key + '/reporting')]; } catch { return [key, null]; } }));
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
        homeCandidatesResolved=true;homeCandidateState = { symbols, assets }; renderHomeDecisionCards();
        renderHomeRows(symbols, assets);renderHomeSummary();
        const updated = document.getElementById('candidate-progress-updated');
        const last = chosen(assets, '1h');
        if (updated) updated.textContent = `Latest recorded shared evaluation: ${date(last?.decision_time)} · page refreshed ${date(new Date().toISOString())}. Page refresh, decision time, timeframe candle time and trade times are separate.`;
      } else { let health = null; try { health = await request(API + '/execution/health'); } catch {} await renderBot(symbols, assets, universe, health); }
    } catch {
      if (home) { homeCandidatesResolved=true;homeCandidateState={symbols:[],assets:[]};renderHomeDecisionCards();renderHomeSummary();home.textContent = 'Selected universe or v2 decision evidence unavailable. No candidate progress is inferred.'; const state = document.getElementById('candidate-progress-status'); if (state) { state.textContent = 'Unavailable'; state.className = 'candidate-state neutral'; } }
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
    const universeCards=document.getElementById('universe-assets');
    if(universeCards)new MutationObserver(renderHomeSummary).observe(universeCards,{childList:true});
  } else if (BOT[document.body.dataset.bot]) {
    // Establish page structure before requests; the static run diagnostics host stays in place.
    botLayout(BOT[document.body.dataset.bot]);
    refresh(); setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  }
})();

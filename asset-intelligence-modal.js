'use strict';
// Shared read-only Phase 2 UI. No selection, permissions or execution writes.
(() => {
  const API = 'https://api.rrr.trading';
  const frames = [['15m', 'Short Term', 45], ['1h', 'Medium Term', 180], ['4h', 'Long Term', 720]];
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const value = v => (typeof v === 'string' && v.trim()) || (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean' ? String(v) : 'Unavailable';
  const label = v => value(v).replaceAll('_', ' ');
  const score = v => finite(v) ? String(Math.round(v * 100) / 100) : 'Unavailable';
  const percent = v => finite(v) && v >= 0 && v <= 1 ? `${Math.round(v * 100)}%` : 'Unavailable';
  const at = v => v && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString('en-AU', {timeZone:'Australia/Brisbane', dateStyle:'medium', timeStyle:'short'}) + ' Brisbane' : 'Unavailable';
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  const metrics = rows => { const dl = el('dl', undefined, 'ai-metrics'); for (const [name, data] of rows) { const row = el('div'); row.append(el('dt', name), el('dd', data)); dl.append(row); } return dl; };
  const dialog = el('dialog', undefined, 'ai-dialog'); dialog.id = 'asset-intelligence-dialog'; dialog.setAttribute('aria-labelledby', 'ai-title');
  const shell = el('div', undefined, 'ai-shell'), head = el('header', undefined, 'ai-header');
  const heading = el('div'); const title = el('h2'); title.id = 'ai-title'; heading.append(el('p', 'Asset Intelligence', 'ai-eyebrow'), title, el('p', 'V2 DECISIONS: SHADOW MODE · NOT CONTROLLING TRADES', 'ai-shadow-header'));
  const close = el('button', '×', 'ai-close'); close.type = 'button'; close.setAttribute('aria-label', 'Close asset intelligence');
  head.append(heading, close); const body = el('div', undefined, 'ai-content'); body.setAttribute('aria-live', 'polite'); body.tabIndex = 0; body.setAttribute('role', 'region'); body.setAttribute('aria-label', 'Asset intelligence details'); shell.append(head, body); dialog.append(shell); document.body.append(dialog);
  let controller, origin, symbol, previousOverflow, sizingExpiryTimer, executionExpiryTimer, briefTimer, closeTimer, advanced, panels, request = 0, sessionActive = false;
  const summaryHeader = el('div', undefined, 'ai-summary-header'); heading.append(summaryHeader);
  const tabs = el('div', undefined, 'ai-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Asset details'); tabs.hidden = true;
  shell.insertBefore(tabs, body);
  const selection = el('section', undefined, 'ai-section ai-selection');
  selection.hidden = true; shell.append(selection);
  function selectionEvidence(trigger) {
    selection.replaceChildren(); selection.hidden = true;
    const evidence = trigger?.closest('.candidate-portrait')?.querySelector('.candidate-evidence');
    if (!evidence) return;
    selection.append(el('h3', 'Selection evidence'));
    for (const child of evidence.children) if (child.tagName !== 'SUMMARY') selection.append(child.cloneNode(true));
    selection.hidden = false;
  }
  function finish() {
    clearTimeout(closeTimer); dialog.classList.remove('ai-closing');
    sessionActive = false; request++; clearInterval(briefTimer); clearTimeout(sizingExpiryTimer); clearTimeout(executionExpiryTimer); controller?.abort(); document.body.style.overflow = previousOverflow ?? '';
    if (origin?.isConnected) origin.focus();
    else document.querySelector(`[data-intelligence-symbol="${symbol}"]`)?.focus();
  }
  function completeDismiss() {
    if (!dialog.open || !dialog.classList.contains('ai-closing')) return;
    dialog.close(); finish();
  }
  function dismiss() {
    if (!dialog.open || dialog.classList.contains('ai-closing')) return;
    request++; controller?.abort(); clearTimeout(sizingExpiryTimer); clearTimeout(executionExpiryTimer);
    dialog.classList.add('ai-closing');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) completeDismiss();
    else closeTimer = setTimeout(completeDismiss, 220); // Fallback if transitionend is interrupted.
  }
  dialog.addEventListener('transitionend', e => {
    if (e.target === dialog && e.pseudoElement === '' && e.propertyName === 'opacity') completeDismiss();
  });
  close.addEventListener('click', dismiss);
  dialog.addEventListener('cancel', e => { e.preventDefault(); dismiss(); });
  dialog.addEventListener('close', () => { if (!dialog.open && sessionActive) finish(); });
  // Native modal dialog supplies inert background, Escape and contained Tab navigation.
  let outside = false;
  const isOutside = event => { const r = dialog.getBoundingClientRect(); return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom; };
  dialog.addEventListener('pointerdown', e => { outside = e.target === dialog && isOutside(e); });
  dialog.addEventListener('click', e => { if (outside && e.target === dialog && isOutside(e)) dismiss(); outside = false; });
  dialog.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')].filter(n => !n.disabled && n.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if ((!e.shiftKey && document.activeElement === last) || (e.shiftKey && document.activeElement === first)) { e.preventDefault(); (e.shiftKey ? last : first)?.focus(); }
  });
  function section(name) { const s = el('section', undefined, 'ai-section'); s.append(el('h3', name)); (advanced || body).append(s); return s; }
  function stateCard(state, overall, minutes) {
    const s = state && typeof state === 'object' ? state : {};
    const available = s.available !== false && s.freshness !== 'unavailable' && Number.isFinite(Date.parse(s.generated_at));
    const bias = available ? (overall ? s.overall_bias : s.bias) : s.overall_bias === 'UNKNOWN' || s.bias === 'UNKNOWN' ? 'UNKNOWN' : 'UNAVAILABLE';
    const known = ['BULLISH','BEARISH','STRONGLY_BULLISH','STRONGLY_BEARISH','NEUTRAL','UNKNOWN','UNAVAILABLE'].includes(bias) ? bias : 'UNKNOWN';
    const card = el('div', undefined, 'ai-state'); const badge = el('strong', label(known), 'ai-bias');
    if (available && known.includes('BULLISH')) badge.dataset.tone = 'positive';
    if (available && known.includes('BEARISH')) badge.dataset.tone = 'negative';
    card.append(badge);
    const generated = Date.parse(s.generated_at);
    const stale = s.freshness === 'stale' || (available && Date.now() - generated > minutes * 60000);
    card.append(el('p', stale ? 'STALE · saved assessment' : available ? generated > Date.now() + 30000 ? 'Freshness unverified · future timestamp' : 'Latest saved assessment' : 'Assessment unavailable', stale ? 'ai-stale' : 'ai-note'));
    const permission = p => available && ['ALLOWED','BLOCKED'].includes(p) ? label(p) : 'Unavailable';
    const rows = [['Confidence', available ? percent(overall ? s.overall_confidence : s.confidence) : 'Unavailable'], ['Score', available ? score(overall ? s.intelligence_score : s.score) : 'Unavailable']];
    if (!overall) rows.push(['Long permission', permission(s.long_permission)], ['Short permission', permission(s.short_permission)]);
    rows.push(['State version', value(s.state_version)], ['Generated', at(s.generated_at)], ['Record updated', at(s.updated_at)]); card.append(metrics(rows));
    return card;
  }
  function marketSection(raw) {
    const s = section('Market & derivatives'); s.id = 'ai-market';
    const m = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const interval = finite(m.refresh_interval_seconds) && m.refresh_interval_seconds > 0 ? m.refresh_interval_seconds : 60;
    const age = Date.now() - Date.parse(m.timestamp);
    const freshness = !Number.isFinite(age) || age < -30000 ? 'UNAVAILABLE' : age > interval * 3000 ? 'STALE' : ['FRESH','AGING','STALE','UNAVAILABLE'].includes(m.freshness) ? m.freshness : 'UNAVAILABLE';
    const current = m.available === true && ['FRESH','AGING'].includes(freshness);
    s.append(el('p', `${freshness} · ${current ? 'Latest saved Bybit observations' : m.timestamp ? 'Saved values; current market context unavailable' : 'Market intelligence unavailable; no valid snapshot recorded'}. Informational only; trade permissions are unchanged.`, current && freshness === 'FRESH' ? 'ai-note' : 'ai-stale'));
    const num = (v, digits = 2) => finite(v) ? new Intl.NumberFormat('en-US', {maximumFractionDigits:digits}).format(v) : 'Unavailable';
    const pct = v => finite(v) ? `${v > 0 ? '+' : ''}${num(v, 4)}%` : 'Unavailable';
    const rate = v => finite(v) ? pct(v * 100) : 'Unavailable';
    const grid = el('div', undefined, 'ai-market-grid');
    const groups = [
      ['Market observations', [
        ['Snapshot price (USDT)', num(m.price, m.price < 10 ? 8 : 2)], ['24h price change', pct(m.price_change_24h)],
        ['24h volume (base units)', num(m.volume)], ['24h turnover (USDT)', num(m.turnover)],
        ['15m volume change', pct(m.volume_change_15m)], ['15m relative volume', finite(m.relative_volume_15m) ? num(m.relative_volume_15m) + '× baseline' : 'Unavailable'],
        ['Volume state', label(m.volume_state || 'UNKNOWN')], ['5m return volatility', finite(m.volatility) ? num(m.volatility, 4) + '% per bar' : 'Unavailable'],
        ['Volatility state', label(m.volatility_state || 'UNKNOWN')], ['Candles through', at(m.candles_observed_at)]
      ]],
      ['Derivatives observations', [
        ['Funding rate (per interval)', rate(m.funding_rate)], ['Funding interval', finite(m.funding_interval_hours) ? num(m.funding_interval_hours) + ' hours' : 'Unavailable'],
        ['Funding state', label(m.funding_state || 'UNKNOWN')], ['Last settled funding', rate(m.previous_funding_rate)],
        ['Settled funding time', at(m.funding_previous_at)], ['Funding change', finite(m.funding_change) ? num(m.funding_change * 100, 5) + ' percentage points' : 'Unavailable'],
        ['Open interest (base units)', num(m.open_interest)], ['Open interest value (USDT)', num(m.open_interest_value)],
        ['OI change · 15m / 1h / 4h', [m.oi_change_15m, m.oi_change_1h, m.oi_change_4h].map(pct).join(' / ')],
        ['Aligned price return · 15m / 1h / 4h', [m.price_return_15m, m.price_return_1h, m.price_return_4h].map(pct).join(' / ')],
        ['Historical OI through', at(m.oi_observed_at)], ['Price / OI · 1h', label(m.price_oi_state || 'FLAT_OR_UNCLEAR')],
        ['Spread', finite(m.spread_bps) ? num(m.spread_bps, 3) + ' bps' : 'Unavailable'], ['Liquidity state', label(m.liquidity_state || 'UNKNOWN')],
        ['Mark / index premium', pct(m.premium_pct)], ['Derivatives bias', current ? label(m.derivatives_bias || 'UNKNOWN') : 'UNKNOWN'],
        ['Evidence coverage confidence', current ? percent(m.derivatives_confidence) : 'Unavailable']
      ]]
    ];
    for (const [name, rows] of groups) { const panel = el('article', undefined, 'ai-state'); panel.append(el('h4', name), metrics(rows)); grid.append(panel); }
    s.append(grid, metrics([['Market / derivatives updated', at(m.timestamp)], ['Source', value(m.provenance?.source)], ['Collector version', value(m.collector_version)], ['Summary version', value(m.logic_version)]]));
    if (m.source_error) s.append(el('p', 'Source refresh failed; retained values are saved evidence.', 'ai-stale'));
    if (Array.isArray(m.component_errors) && m.component_errors.length) s.append(el('p', 'Partial data: ' + m.component_errors.map(label).join('; '), 'ai-note'));
    s.append(el('p', 'Volatility uses 48 closed 5m log returns. Relative volume compares the last closed 15m with 20 prior 15m blocks. OI changes use historical base-unit samples; their times can differ from the ticker. Funding direction is descriptive. Ratio and liquidation collection is unavailable. Confidence describes component and directional-window coverage, not predictive accuracy.', 'ai-note'));
  }
  let paperContext = false;
  function executionSection(raw, decision, sizing) {
    const s = section('Current v2 execution'); s.id = 'ai-execution';
    const e = raw && typeof raw === 'object' ? raw : {}, h = e.health || {}, r = e.latest_execution;
    const elapsed = Date.now() - Date.parse(h.last_run);
    const current = h.mode === 'PAPER' && h.status === 'available' && h.stale === false && typeof h.run_id === 'string' && elapsed >= 0 && elapsed < 90000;
    const valid = v => v?.available === true && v.freshness === 'FRESH' && Date.parse(v.evidence_expires_at) > Date.now();
    const decisionCurrent = valid(decision), sizingCurrent = decisionCurrent && valid(sizing) && sizing.opportunity_id === decision.id;
    s.append(el('strong', current ? h.enabled === true ? 'PAPER ONLY · CENTRAL EXECUTION GATE ENABLED' : 'PAPER ONLY · NEW ENTRIES DISABLED' : 'EXECUTION EVIDENCE UNAVAILABLE', 'ai-shadow-label'));
    const recorded = r && typeof r === 'object', status = recorded ? label(r.status) : 'NO RECORDED V2 EXECUTION';
    s.append(el('p', current && recorded && r.status === 'OPEN' ? `ACTIVE POSITION · ${value(r.timeframe)} ${label(r.direction)}` : `Execution: ${status}${current ? '' : ' · saved evidence only'}`, current ? 'ai-note' : 'ai-stale'));
    if (recorded && ['CLAIMED', 'UNKNOWN'].includes(r.status)) s.append(el('p', 'Submission or fill remains unverified. The asset reservation stays blocked; this record does not prove a trade opened.', 'ai-note'));
    const amount = v => finite(v) && v >= 0 ? `${score(v)} USDT` : 'Unavailable';
    s.append(metrics([
      ['Paper run', value(h.run_id)], ['Run started', at(h.started_at)],
      ['Decision', label(decisionCurrent ? decision.decision : 'UNAVAILABLE')], ['Decision horizon', decisionCurrent ? value(decision.selected_timeframe) : 'Unavailable'],
      ['Risk', label(sizingCurrent ? sizing.risk_decision : 'UNAVAILABLE')], ['Proposed stake', sizingCurrent ? amount(sizing.final_proposed_stake) : 'Unavailable'],
      ['Executed paper stake', recorded ? amount(r.executed_stake) : 'No recorded fill'],
      ['Recorded leverage', recorded && finite(r.leverage) ? `${score(r.leverage)}×` : 'Unavailable'],
      ['Execution reference', recorded && finite(r.reference_price) ? `${score(r.reference_price)} USDT` : 'Unavailable'],
      ['Execution price', recorded && finite(r.execution_price) ? `${score(r.execution_price)} USDT` : 'Unavailable'],
      ['Execution observed', at(r?.updated_at)], ['Exit reason', value(r?.payload?.exit_reason)],
      ['Pinned champion', value(h.versions?.learning_version)]
    ]));
    if (recorded) s.append(el('p', `Why this trade: ${value(r.payload?.why_go)} · ${value(r.payload?.why_horizon)} ${label(r.payload?.why_direction)}. Opportunity ${value(r.opportunity_id)}; sizing evidence ${value(r.sizing_id)}.`, 'ai-note'));
    s.append(el('p', 'Decision, risk proposal, authorization and actual fill are separate states. Only the selected native bot may submit a paper entry after the central guard passes. No real-money execution or automatic model promotion.', 'ai-note'));
    const deadline = Math.min(current ? Date.parse(h.last_run) + 90000 : Infinity, decisionCurrent ? Date.parse(decision.evidence_expires_at) : Infinity, sizingCurrent ? Date.parse(sizing.evidence_expires_at) : Infinity);
    if (Number.isFinite(deadline)) executionExpiryTimer = setTimeout(() => {
      if (!sessionActive) return;
      s.remove(); executionSection(raw, decision, sizing);
    }, Math.max(1, deadline - Date.now() + 1));
  }
  function decisionSection(raw) {
    const s = section('Current v2 decision'); s.id = 'ai-decision';
    s.append(el('strong', paperContext ? 'DECISION EVIDENCE · CENTRAL PAPER GATE REQUIRED' : 'SHADOW MODE · NOT CONTROLLING TRADES', 'ai-shadow-label'));
    const d = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const elapsed = Date.now() - Date.parse(d.decision_time);
    const maxAge = d.evidence?.configuration?.decision_max_age_seconds;
    const current = d.shadow_mode === true && d.execution_connected === false && d.available === true && d.freshness === 'FRESH' && Number.isFinite(elapsed) && elapsed >= -30000 && finite(maxAge) && maxAge > 0 && elapsed <= maxAge * 1000;
    const go = current && d.decision === 'GO' && ['LONG','SHORT'].includes(d.direction) && frames.some(([key]) => key === d.selected_timeframe) && finite(d.selected_score) && d.selected_score >= 0 && d.selected_score <= 100 && finite(d.selection_confidence) && d.selection_confidence >= 0 && d.selection_confidence <= 1;
    s.append(el('p', current ? go ? paperContext ? 'GO DECISION · EXECUTION NOT IMPLIED' : 'SHADOW GO' : d.decision === 'BLOCKED' ? paperContext ? 'BLOCKED' : 'SHADOW BLOCKED' : paperContext ? 'NO TRADE' : 'SHADOW NO TRADE' : paperContext ? 'Decision unavailable or stale' : 'Shadow decision unavailable or stale', 'ai-note'));
    if (d.saved_decision) s.append(el('p', `Saved result: ${label(d.saved_decision)} · historical evidence only`, 'ai-stale'));
    s.append(metrics([
      ['Direction', current ? label(d.direction || 'UNKNOWN') : 'Unavailable'],
      ['Best horizon', go ? `${d.selected_timeframe} ${frames.find(([key]) => key === d.selected_timeframe)[1]}` : 'None'],
      ['Evidence confidence', go ? percent(d.selection_confidence) : 'Unavailable'],
      ['Selected score (0–100)', go ? score(d.selected_score) : 'Unavailable'],
      ['Reason', value(d.reason_summary)], ['Veto / block', d.veto_reason ? label(d.veto_reason) : 'No recorded veto'],
      ['Decision freshness', label(d.freshness || 'UNAVAILABLE')], ['Evaluated', at(d.decision_time)],
      ['Decision model', value(d.model_version)], ['Horizon selector', value(d.selector_version)]
    ]));
    const grid = el('div', undefined, 'ai-decision-frames');
    for (const [key, name] of frames) {
      const f = d.timeframe_assessments?.[key] || {}, panel = el('article', undefined, 'ai-state'); panel.dataset.decisionTimeframe = key;
      panel.append(el('h4', `${key} ${name}`), el('strong', go && key === d.selected_timeframe ? paperContext ? 'SELECTED DECISION · GATE REQUIRED' : 'SELECTED · SHADOW ONLY' : current ? label(f.status || 'INSUFFICIENT_DATA') : 'STALE / UNAVAILABLE'), metrics([
        ['Score (0–100)', score(f.score)], ['Direction', label(f.direction || 'UNKNOWN')], ['Evidence confidence', percent(f.confidence)],
        ['Technical quality', percent(f.technical_score)], ['News contribution', score(f.news_score)],
        ['Derivatives contribution', score(f.derivatives_score)], ['Market quality', score(f.market_score)], ['Regime contribution', score(f.regime_score)],
        ['Noise / risk penalty', score(f.risk_penalty)], ['Cost proxy penalty', score(f.cost_penalty)], ['Reason', value(f.reason_summary)],
        ['Selection reason', label(f.evidence?.selection_reason)], ['Expected move', finite(f.evidence?.expected_move_pct) ? `${score(f.evidence.expected_move_pct)}%` : 'Unavailable · no validated forecast'],
        ['Technical observed', at(f.evidence?.freshness?.technical_at)], ['Market observed', at(f.evidence?.freshness?.market_at)], ['OI observed', at(f.evidence?.freshness?.oi_at)], ['News evidence', label(f.evidence?.freshness?.news)]
      ]));
      if (Array.isArray(f.evidence?.unavailable_components) && f.evidence.unavailable_components.length) panel.append(el('p', 'Unavailable inputs: ' + f.evidence.unavailable_components.map(label).join(', '), 'ai-note'));
      grid.append(panel);
    }
    s.append(grid, el('p', 'Scores compare deterministic risk-adjusted evidence. Confidence is an evidence indicator, not a success probability. Fee/slippage and noise are proxies. Execution requires a separate fresh sizing proposal and central paper authorization.', 'ai-note'));
  }
  function sizingSection(raw, decision) {
    const s = section(paperContext ? 'Position sizing evidence' : 'Shadow position sizing'); s.id = 'ai-sizing';
    s.append(el('strong', paperContext ? 'RISK EVIDENCE · CENTRAL PAPER GATE REQUIRED' : 'SHADOW ONLY · NOT CONTROLLING TRADES', 'ai-shadow-label'));
    const p = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const d = decision || {}, now = Date.now(), maxAge = d.evidence?.configuration?.decision_max_age_seconds;
    const age = now - Date.parse(d.decision_time);
    const opportunityCurrent = d.available === true && d.freshness === 'FRESH' && d.decision === 'GO' && d.shadow_mode === true && d.execution_connected === false && finite(maxAge) && maxAge > 0 && age >= -30000 && age <= maxAge * 1000 && (!d.evidence_expires_at || Date.parse(d.evidence_expires_at) >= now);
    const deadline = Date.parse(p.evidence_expires_at), proposalAge = now - Date.parse(p.decision_time);
    const current = opportunityCurrent && p.available === true && p.freshness === 'FRESH' && p.shadow_mode === true && p.execution_connected === false && p.opportunity_id === d.id && finite(d.id) && p.currency === 'USDT' && Number.isFinite(deadline) && deadline >= now && proposalAge >= 0 && ['ALLOW','REDUCE','BLOCK'].includes(p.risk_decision) && finite(p.final_proposed_stake) && p.final_proposed_stake >= 0 && finite(p.proposed_notional) && p.proposed_notional >= 0 && (p.risk_decision !== 'BLOCK' || (p.final_proposed_stake === 0 && p.proposed_notional === 0));
    const amount = v => finite(v) && v >= 0 ? `${new Intl.NumberFormat('en-US', {maximumFractionDigits:2}).format(v)} USDT` : 'Unavailable';
    const mult = v => finite(v) && v >= 0 ? `${score(v)}×` : 'Unavailable';
    s.append(el('p', current ? `${paperContext ? 'RISK' : 'SHADOW'} ${label(p.risk_decision)} · ${value(p.timeframe)} ${label(p.direction)}` : !opportunityCurrent ? 'No sizing proposal — no valid trade opportunity.' : paperContext ? 'Sizing unavailable or stale' : 'Shadow sizing unavailable or stale', current ? 'ai-note' : 'ai-stale'));
    if (current) {
      s.append(metrics([
        ['Base stake', amount(p.base_stake)], ['Evidence confidence', percent(p.decision_confidence)],
        ['Confidence band / multiplier', `${label(p.confidence_band)} · ${mult(p.confidence_multiplier)}`],
        ['Volatility multiplier', mult(p.volatility_multiplier)], ['Liquidity multiplier', mult(p.liquidity_multiplier)],
        ['Portfolio multiplier', mult(p.portfolio_multiplier)], ['Correlation multiplier', mult(p.correlation_multiplier)],
        ['Directional multiplier', mult(p.directional_multiplier)], ['Horizon multiplier', mult(p.timeframe_multiplier)],
        ['Raw proposed stake', amount(p.raw_proposed_stake)], ['Final proposed stake', amount(p.final_proposed_stake)],
        ['Proposed leverage', mult(p.leverage)], ['Proposed notional', amount(p.proposed_notional)],
        ['Reason / block', p.block_reason ? label(p.block_reason) : 'See risk adjustments below'],
        ['Expected move', finite(p.edge_check?.expected_move_pct) ? `${score(p.edge_check.expected_move_pct)}%` : 'Unavailable · no validated forecast'],
        ['Roundtrip cost proxy', finite(p.edge_check?.estimated_roundtrip_cost_bps) ? `${score(p.edge_check.estimated_roundtrip_cost_bps)} bps` : 'Unavailable']
      ]));
      if (Array.isArray(p.reasons)) {
        const list = el('ul', undefined, 'ai-risk-reasons');
        for (const reason of p.reasons) list.append(el('li', typeof reason === 'string' ? label(reason) : `${label(reason?.component)}: ${mult(reason?.multiplier)}`));
        s.append(list);
      }
      const portfolio = p.portfolio || {};
      s.append(el('h4', 'Portfolio evidence used'), metrics([
        ['Paper wallet equity', amount(portfolio.total_equity)], ['Open positions · all three bots', value(portfolio.open_position_count)],
        ['Gross entry notional', amount(portfolio.gross_notional)], ['Long / short notional', `${amount(portfolio.long_notional)} / ${amount(portfolio.short_notional)}`],
        ['Utilization', finite(portfolio.utilization_pct) ? `${score(portfolio.utilization_pct)}%` : 'Unavailable'],
        ['Concentration', label(portfolio.concentration_state)], ['Observed', at(portfolio.observed_at)],
        ['Proposed gross notional', amount(p.proposed_portfolio?.gross_notional)]
      ]));
    } else if (p.saved_proposal) s.append(el('p', 'Saved sizing evidence is historical and unusable.', 'ai-stale'));
    s.append(metrics([
      ['Sizing freshness', current ? 'FRESH' : p.freshness === 'STALE' || deadline < now ? 'STALE' : 'UNAVAILABLE'], ['Evaluated', at(p.decision_time)], ['Evidence expires', at(p.evidence_expires_at)],
      ['Sizing version', value(p.sizing_version)], ['Portfolio risk version', value(p.risk_version)], ['Concentration version', value(p.correlation_version)]
    ]), el('p', `Stake is committed paper equity; notional is stake × independently capped leverage. USDT is not converted USD. Confidence is uncalibrated evidence quality. Crypto-beta grouping is a conservative concentration proxy, not measured correlation. Missing expected move cannot prove an edge after costs. ${paperContext ? "The central paper guard must authorize this proposal before native submission." : "These proposals never change bot trades."}`, 'ai-note'));
    if (current) {
      const expiry = Math.min(deadline, Date.parse(d.decision_time) + maxAge * 1000, Number.isFinite(Date.parse(d.evidence_expires_at)) ? Date.parse(d.evidence_expires_at) : Infinity);
      const token = request;
      sizingExpiryTimer = setTimeout(() => {
        if (token !== request || !dialog.open) return;
        const replacement = sizingSection(raw, decision); s.replaceWith(replacement);
      }, Math.max(1, expiry - Date.now() + 1));
    }
    return s;
  }
  function learningSection(raw) {
    const s = section('Learned behavior'); s.id = 'ai-learning';
    s.append(el('p', 'SHADOW LEARNING · NOT CONTROLLING TRADES · NO AUTOMATIC PROMOTION', 'ai-shadow-header'));
    const l = raw && typeof raw === 'object' ? raw : {};
    if (l.available !== true || l.shadow_mode !== true || l.execution_connected !== false) {
      s.append(el('p', 'Learning history will appear when saved outcome evidence is available.', 'ai-note')); return;
    }
    if (l.health?.stale || l.health?.status === 'unavailable' || l.health?.status === 'degraded') s.append(el('p', 'Learning worker stale or unavailable · saved history only.', 'ai-stale'));
    s.append(metrics([['Champion', value(l.champion)], ['Shadow challenger', value(l.challenger)], ['Challenger state', label(l.challenger_status)], ['Outcome evaluator', value(l.evaluator_version)], ['Learning version', value(l.learning_version)]]));
    let sufficient = false;
    const grid = el('div', undefined, 'ai-decision-frames');
    for (const [tf] of frames) {
      const f = l.timeframes?.[tf] || {}, panel = el('article', undefined, 'ai-state'); panel.dataset.learningTimeframe = tf;
      const count = finite(f.observations) && f.observations >= 0 ? f.observations : null;
      const enough = f.asset_specific_learning === true && finite(l.minimum_samples) && l.minimum_samples >= 20 && count >= l.minimum_samples;
      panel.append(el('h4', `${symbol} · ${tf}`), metrics([['Independent episodes', value(count)]]));
      if (!enough) panel.append(el('p', 'Not enough history for asset-specific learning yet.', 'ai-note'));
      sufficient ||= enough;
      const weights = Array.isArray(f.weights) ? f.weights.filter(w => w && typeof w === 'object' && finite(w.effective_shadow_multiplier) && w.effective_shadow_multiplier >= .6 && w.effective_shadow_multiplier <= 1.4 && ((enough && w.fallback === 'ASSET' && finite(w.observation_count) && w.observation_count >= l.minimum_samples) || w.fallback === 'GLOBAL')) : [];
      weights.sort((a,b) => Math.abs(b.effective_shadow_multiplier - 1) - Math.abs(a.effective_shadow_multiplier - 1));
      for (const w of weights.slice(0,2)) {
        const delta = w.effective_shadow_multiplier - 1;
        panel.append(el('p', `${label(w.feature)} · ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} shadow multiplier · ${w.fallback === 'GLOBAL' ? 'global fallback' : `${w.observation_count} asset observations`}`, 'ai-note'));
      }
      const buckets = Array.isArray(f.calibration) ? f.calibration.filter(b => b && b.sufficient === true && finite(b.count) && b.count >= 20 && finite(b.predicted_confidence) && finite(b.observed_success_rate)) : [];
      const b = buckets.sort((a,b) => b.count-a.count)[0];
      if (b) panel.append(el('p', `Confidence bucket: ${percent(b.predicted_confidence)} evidence confidence · ${percent(b.observed_success_rate)} observed positive net outcomes (${b.count} episodes).`, 'ai-note'));
      else panel.append(el('p', 'Confidence calibration: insufficient outcome history.', 'ai-note'));
      grid.append(panel);
    }
    s.append(grid);
    const h = l.horizon_performance;
    if (h && finite(h.observations) && h.observations >= 20) s.append(metrics([['Horizon history episodes', value(h.observations)], ['Best horizon within noise threshold', percent(h.best_horizon_hit_rate)], ['Mean net regret (percentage points)', score(h.mean_regret_pct)]]));
    s.append(el('p', 'Net outcomes include estimated fees, spread and slippage. Correlated episodes are grouped. Evidence confidence is not a predicted win probability; bucket comparisons are descriptive. Hard safety blocks never become learned exceptions.', 'ai-note'));
    if (!sufficient) s.append(el('p', 'Learning history will appear as enough independent asset outcomes accumulate.', 'ai-note'));
  }
  function marketFresh(m) {
    const age = Date.now() - Date.parse(m?.timestamp), interval = finite(m?.refresh_interval_seconds) && m.refresh_interval_seconds > 0 ? m.refresh_interval_seconds : 60;
    return m?.available === true && !m.source_error && ['FRESH','AGING'].includes(m.freshness) && age >= -30000 && age <= interval * 3000;
  }
  function decisionFresh(d) {
    const age = Date.now() - Date.parse(d?.decision_time), max = d?.evidence?.configuration?.decision_max_age_seconds;
    return d?.shadow_mode === true && d.execution_connected === false && d.available === true && d.freshness === 'FRESH' && finite(max) && max > 0 && age >= -30000 && age <= max * 1000 && (!d.evidence_expires_at || Date.parse(d.evidence_expires_at) > Date.now());
  }
  const money = (v, digits = 2) => finite(v) ? `${new Intl.NumberFormat('en-US', {maximumFractionDigits:digits}).format(v)} USDT` : 'Not recorded';
  const change = v => finite(v) ? `${v > 0 ? '+' : ''}${score(v)}%` : 'Not calculated';
  const freshnessLabel = s => typeof s?.freshness === 'string' ? s.freshness.toLowerCase() : '';
  const explanation = v => { const known = {STRONGEST_VALID_RISK_ADJUSTED_HORIZON:'Strongest valid setup after risk adjustments', BLOCKED_EXISTING_POSITION:'An existing position blocks a new entry', NO_TIMEFRAME_CLEARS_THRESHOLDS:'No timeframe meets the entry thresholds'}; return Object.hasOwn(known, v) ? known[v] : value(v); };
  function badge(text, tone) { const b = el('span', text, 'ai-badge'); if (tone) b.dataset.tone = tone; return b; }
  function switchTab(index, focus = false) {
    [...tabs.children].forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; panels[i].hidden = i !== index; });
    body.scrollTop = 0; if (focus) tabs.children[index].focus();
  }
  function tabbedDetail(data) {
    advanced = el('section', undefined, 'ai-panel'); advanced.append(...body.childNodes, selection);
    const names = ['Overview','Trades','Intelligence','News & Market','Advanced'];
    panels = names.map((name, i) => {
      const panel = i === 4 ? advanced : el('section', undefined, 'ai-panel'); panel.id = `ai-panel-${i}`;
      panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', `ai-tab-${i}`); panel.tabIndex = 0; return panel;
    });
    tabs.replaceChildren(); names.forEach((name, i) => {
      const tab = el('button', name); tab.type = 'button'; tab.id = `ai-tab-${i}`; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', panels[i].id);
      tab.addEventListener('click', () => switchTab(i)); tab.addEventListener('keydown', e => {
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? 4 : e.key === 'ArrowRight' ? (i + 1) % 5 : e.key === 'ArrowLeft' ? (i + 4) % 5 : null;
        if (next !== null) { e.preventDefault(); switchTab(next, true); }
      }); tabs.append(tab);
    });
    body.append(...panels); tabs.hidden = false; switchTab(0);
    panels[3].append(el('h3', 'News & Market'), el('div', undefined, 'ai-market-brief'));
    const news = el('section'); news.id = 'ai-news-brief'; news.append(el('p', 'Loading news…', 'ai-note')); panels[3].append(news);
    const events = el('section'); events.id = 'ai-events-brief'; panels[3].append(events);
    const evidence = el('details', undefined, 'ai-raw'); evidence.append(el('summary', 'Full API evidence'), el('pre', JSON.stringify(data, null, 2))); advanced.append(evidence);
    let signature;
    const refresh = () => {
      const d = data.decision, m = data.market, h = data.execution?.health, r = data.execution?.latest_execution;
      const execAge = Date.now() - Date.parse(h?.last_run);
      const executionCurrent = h?.mode === 'PAPER' && h.status === 'available' && h.stale === false && typeof h.run_id === 'string' && execAge >= 0 && execAge < 90000;
      const current = decisionFresh(d), marketCurrent = marketFresh(m);
      const quoteAge = Date.now() - Date.parse(m?.timestamp), quoteCurrent = marketCurrent && quoteAge <= 120000;
      const overall = data.overall_state, age = Date.now() - Date.parse(overall?.generated_at);
      const overallCurrent = overall?.available !== false && !['stale','unavailable'].includes(freshnessLabel(overall)) && age >= -30000 && age <= 720 * 60000;
      const direction = overallCurrent && ['BULLISH','BEARISH','NEUTRAL','MIXED','STRONGLY_BULLISH','STRONGLY_BEARISH'].includes(overall.overall_bias) ? label(overall.overall_bias) : freshnessLabel(overall) === 'stale' || age > 720 * 60000 ? 'Stale' : 'Not calculated';
      const tradeStatus = !executionCurrent ? 'Current trade status unverified' : data.execution?.reservation_pending === true || ['CLAIMED','UNKNOWN'].includes(r?.status) ? 'Entry pending · fill unverified' : data.execution?.active_position === true || r?.status === 'OPEN' ? 'Active paper position' : data.execution?.active_position === false ? 'No active v2 position' : r?.status === 'CLOSED' ? 'Latest v2 trade closed' : 'Current trade status unverified';
      const decisionText = current ? label(d.decision) : d?.freshness === 'STALE' || d?.saved_decision || d?.available === true ? 'Stale' : 'Not calculated';
      const frameStates = frames.map(([key,,minutes]) => {
        const s = data.timeframes?.[key], elapsed = Date.now() - Date.parse(s?.generated_at);
        const stale = freshnessLabel(s) === 'stale' || elapsed > minutes * 60000;
        const valid = s?.available !== false && !['stale','unavailable'].includes(freshnessLabel(s)) && elapsed >= -30000 && elapsed <= minutes * 60000;
        return {key,s,valid,freshness:stale ? 'Stale' : valid ? 'Fresh' : s?.generated_at ? 'Unverified' : 'Not calculated'};
      });
      const next = JSON.stringify([executionCurrent,current,marketCurrent,quoteCurrent,overallCurrent,frameStates.map(f=>f.freshness)]); if (signature === next) return; signature = next;
      summaryHeader.replaceChildren();
      const priceLine = el('p', undefined, 'ai-perpetual-price'); priceLine.append(el('strong', quoteCurrent && finite(m?.price) && m.price > 0 ? money(m.price, 8) : m?.timestamp ? 'Bybit price stale or unverified' : 'Bybit price not collected'));
      if (quoteCurrent) priceLine.append(badge(change(m.price_change_24h) + ' · 24h', m.price_change_24h > 0 ? 'positive' : m.price_change_24h < 0 ? 'negative' : undefined));
      summaryHeader.append(priceLine, el('p', `Bybit perpetual · ${m?.timestamp ? at(m.timestamp) : 'No quote timestamp'}`, 'ai-note'));
      const statuses = el('div', undefined, 'ai-statuses'); statuses.append(badge(executionCurrent ? 'PAPER' : 'Mode unverified'), badge(`V2: ${tradeStatus}`), badge(`New entry: ${decisionText}`), badge(`Overall: ${direction}`)); summaryHeader.append(statuses);
      heading.querySelector('.ai-shadow-header').textContent = executionCurrent ? h.enabled ? 'Read-only · Paper entries require central authorization' : 'Read-only · New paper entries disabled' : 'Read-only · Current execution status unverified';
      panels[0].replaceChildren(el('h3', 'At a glance'), el('p', `${tradeStatus}.`, 'ai-lead'));
      panels[0].append(el('h4', 'Latest new-entry decision'), el('p', current ? `${decisionText}${d.selected_timeframe ? ' · ' + d.selected_timeframe : ''}. ${explanation(d.reason_summary)}` : 'A current new-entry assessment is not verified. Saved results are retained in Advanced.', 'ai-note'));
      panels[0].append(el('h4', 'Market conditions'), el('p', marketCurrent ? `Bybit market context is ${label(m.derivatives_bias || 'UNKNOWN').toLowerCase()}. Volatility: ${label(m.volatility_state || 'UNKNOWN').toLowerCase()}; liquidity: ${label(m.liquidity_state || 'UNKNOWN').toLowerCase()}. This market context is separate from the overall assessment and entry decision.` : 'Fresh market evidence is not verified. Retained observations are available in Advanced.', 'ai-note'));
      panels[0].append(el('p', 'The original rationale belongs to the recorded trade. A later new-entry decision does not explain or change that trade.', 'ai-note'));
      panels[2].replaceChildren(el('h3', 'Timeframe intelligence'));
      const table = el('table', undefined, 'ai-comparison'), thead = el('thead'), tr = el('tr');
      for (const name of ['Horizon','Direction','Score','Confidence','Freshness']) { const th = el('th', name); th.scope = 'col'; tr.append(th); } thead.append(tr); table.append(thead);
      const tbody = el('tbody'); for (const f of frameStates) { const row = el('tr'); row.append(el('th', f.key), el('td', f.valid ? label(f.s.bias || 'UNKNOWN') : '—'), el('td', f.valid ? score(f.s.score) : '—'), el('td', f.valid ? percent(f.s.confidence) : '—'), el('td', f.freshness)); tbody.append(row); } table.append(tbody); panels[2].append(table, el('p', 'Saved independent assessments; confidence is evidence quality. Decision-engine horizon scores and permissions are retained in Advanced.', 'ai-note'));
      const brief = panels[3].querySelector('.ai-market-brief'); brief.replaceChildren(el('p', marketCurrent ? `Market context: ${label(m.derivatives_bias || 'UNKNOWN')} · ${label(m.freshness)}` : 'Market context stale or not collected', 'ai-note'), metrics([['Funding per interval', marketCurrent && finite(m.funding_rate) ? change(m.funding_rate * 100) : 'Not calculated'], ['1h open-interest change', marketCurrent ? change(m.oi_change_1h) : 'Stale / unverified'], ['Liquidations / long-short ratio', 'Not collected']]));
    };
    refresh(); clearInterval(briefTimer); briefTimer = setInterval(refresh, 1000);
    panels[1].append(el('h3', 'Trades'), el('p', 'Loading current-run trade reporting…', 'ai-note'));
  }
  function renderDetail(data) {
    if (data?.asset?.symbol !== symbol) throw Error('Invalid identity');
    title.textContent = `${symbol}${data.asset.name ? ' — ' + data.asset.name : ''}`;
    advanced = null; body.replaceChildren(); body.append(el('p', `${label(data.asset.exchange)} · ${label(data.asset.market_type)} · API ${value(data.api_version)}`, 'ai-note'));
    const price = el('p', 'Current price: loading…', 'ai-note'); price.id = 'ai-price'; body.append(price);
    paperContext = data.execution?.health?.mode === 'PAPER' && typeof data.execution?.health?.run_id === 'string';
    heading.querySelector('.ai-shadow-header').textContent = paperContext ? 'V2 · PAPER ONLY · DECISION / RISK / EXECUTION' : 'V2 DECISIONS: SHADOW MODE · NOT CONTROLLING TRADES';
    executionSection(data.execution, data.decision, data.sizing);
    decisionSection(data.decision);
    sizingSection(data.sizing, data.decision);
    learningSection(data.learning);
    section('Overall intelligence').append(stateCard(data.overall_state, true, 720), el('p', paperContext ? 'Evidence confidence is not a success probability. Paper entries require a current central decision and risk authorization; native bots retain exit management.' : 'Evidence confidence is not a success probability. These states are informational; each bot retains its own entry checks.', 'ai-note'));
    if (data.news_summary && typeof data.news_summary === 'object') {
      const n = data.news_summary, summary = section('Asset news summary'); summary.id = 'ai-news-summary';
      summary.append(el('p', `${label(n.freshness)} · Saved asset-specific news; informational only.`, n.freshness === 'stale' || n.freshness === 'degraded' ? 'ai-stale' : 'ai-note'), metrics([
        ['News bias', label(n.news_bias)], ['News score (−1 to +1)', score(n.news_score)], ['Classification confidence', percent(n.news_confidence)],
        ['Relevant stories', value(n.relevant_story_count)], ['Recent events', value(n.recent_event_count)], ['High-impact events', value(n.high_impact_event_count)],
        ['Weighted impact', score(n.recent_weighted_impact)], ['Last intelligence update', at(n.last_intelligence_update)], ['Classifier version', value(n.classifier_version)]
      ]));
    }
    marketSection(data.market);
    const tf = section('Timeframe intelligence'), grid = el('div', undefined, 'ai-timeframes');
    for (const [key, name, minutes] of frames) { const panel = el('article'); panel.dataset.timeframe = key; panel.append(el('h4', `${key} ${name}`), stateCard(data.timeframes?.[key], false, minutes)); grid.append(panel); } tf.append(grid);
    if (data.universe_sync?.fresh === false) tf.append(el('p', 'STALE / UNAVAILABLE · asset registry selection source. This is separate from assessment freshness.', 'ai-stale'));
    for (const kind of ['news','events']) { const s = section(kind === 'news' ? 'Recent news' : 'Recent events'); s.id = `ai-${kind}`; s.append(el('p', `Loading ${kind}…`, 'ai-note')); }
    const history = section('Schema / foundation information'); history.append(metrics([['Current intelligence version', value(data.overall_state?.state_version)]]));
    // Foundation version metadata describes the schema, not asset observations or learned outcomes.
    for (const version of Array.isArray(data.versions) ? data.versions.filter(v => v && typeof v === 'object' && v.status === 'FOUNDATION') : []) history.append(el('p', `${value(version.version)} · ${label(version.status)} · ${value(version.description)}`, 'ai-note'));
    tabbedDetail(data);
  }
  function collection(kind, result) {
    const s = document.getElementById(`ai-${kind}`); if (!s) return;
    while (s.children.length > 1) s.lastChild.remove();
    if (kind === 'events') document.getElementById('ai-events-brief')?.replaceChildren(el('h3','Recent events'), el('p', result.status !== 'fulfilled' ? 'Event collection could not be verified.' : !result.value?.events?.length ? 'No events recorded.' : 'Saved events · timing and source evidence below.', 'ai-note'));
    if (result.status !== 'fulfilled' || result.value?.asset?.symbol !== symbol || !Array.isArray(result.value[kind])) { s.append(el('p', `${kind === 'news' ? 'News' : 'Events'} intelligence unavailable.`, 'ai-note')); if (kind === 'news') document.getElementById('ai-news-brief')?.replaceChildren(el('p', 'News collection could not be verified. Retry by reopening the asset.', 'ai-note')); return; }
    const records = result.value[kind].filter(record => record && typeof record === 'object' && !Array.isArray(record));
    if (kind === 'news') {
      const target = document.getElementById('ai-news-brief'); target.replaceChildren(el('h3', 'Relevant news'));
      if (['degraded','stale','unavailable'].includes(result.value.status)) target.append(el('p', `${label(result.value.status)} source collection · saved articles may be incomplete or stale.`, 'ai-stale'));
      if (!records.length) target.append(el('p', result.value[kind].length ? 'News records could not be verified.' : 'No asset-specific news recorded.', 'ai-note'));
      const sorted = [...records].sort((a,b) => (finite(b.relevance_score) ? b.relevance_score : -1) - (finite(a.relevance_score) ? a.relevance_score : -1) || (Date.parse(b.published_at) || 0) - (Date.parse(a.published_at) || 0));
      sorted.forEach((record, i) => {
        const article = el('article', undefined, 'ai-record ai-brief-story'); article.hidden = i >= 3;
        article.append(el('h4', value(record.headline)), el('p', `${value(record.source)} · ${at(record.published_at)}${record.freshness ? ' · ' + label(record.freshness) : ''}`, 'ai-note'));
        try { const url = new URL(record.source_url); if (url.protocol === 'https:' && !url.username && !url.password) { const link = el('a', 'Read source'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; article.append(link); } } catch {}
        target.append(article);
      });
      if (sorted.length > 3) { const more = el('button', `Show ${sorted.length - 3} more articles`, 'ai-retry'); more.type = 'button'; more.setAttribute('aria-expanded','false'); more.addEventListener('click', () => { const expanded = more.getAttribute('aria-expanded') !== 'true'; target.querySelectorAll('.ai-brief-story').forEach((node,i) => {node.hidden = !expanded && i >= 3;}); more.setAttribute('aria-expanded',String(expanded)); more.textContent = expanded ? 'Show fewer articles' : `Show ${sorted.length - 3} more articles`; }); target.append(more); }
    }
    if (result.value[kind].length && !records.length) { s.append(el('p', 'Intelligence records unavailable.', 'ai-note')); return; }
    if (['degraded','stale','unavailable'].includes(result.value.status)) s.append(el('p', `${label(result.value.status)} · source collection health. Saved evidence may be incomplete or stale.`, 'ai-stale'));
    if (!records.length) { s.append(el('p', kind === 'news' ? 'No asset-specific intelligence has been recorded yet.' : 'No events recorded yet.', 'ai-note')); if (result.value.status === 'unavailable') s.append(el('p', 'Source unavailable · no current collection evidence.', 'ai-note')); return; }
    for (const record of records) {
      const item = el('article', undefined, 'ai-record');
      item.append(el('h4', value(kind === 'news' ? record.headline : label(record.event_type))));
      if (kind === 'events' && record.description) item.append(el('p', value(record.description)));
      const rows = [['Source', value(record.source)], [kind === 'news' ? 'Published' : 'Event time', at(kind === 'news' ? record.published_at : record.event_time)], ['Direction', label(record.direction)], ['Confidence', percent(record.confidence)]];
      if (kind === 'news') rows.push(['Relevance', percent(record.relevance_score)], ['Impact', score(record.impact_score)], ['Event type', label(record.event_type)]); else rows.push(['Importance', score(record.importance)]);
      if (record.freshness) rows.push(['Evidence freshness', label(record.freshness)]);
      if (record.classifier_version) rows.push(['Classifier version', value(record.classifier_version)]);
      if (kind === 'events' && !record.event_time) rows.push(['Timing', 'Event time unknown; publication is separate']);
      item.append(metrics(rows));
      try {
        const url = new URL(record.source_url);
        if (url.protocol === 'https:' && !url.username && !url.password) {
          const link = el('a', 'Read source'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; item.append(link);
        }
      } catch {} s.append(item);
    }
    if (kind === 'events') {
      const brief = document.getElementById('ai-events-brief');
      for (const record of records) { const item = el('article', undefined, 'ai-record'); item.append(el('h4', label(record.event_type)), el('p', value(record.description), 'ai-note'), el('p', `${value(record.source)} · ${record.event_time ? at(record.event_time) : 'Event time unknown; publication is separate'} · ${label(record.freshness || 'unverified')}`, 'ai-note')); brief.append(item); }
    }
  }
  function price(result) {
    const target = document.getElementById('ai-price'); if (!target) return;
    const data = result.status === 'fulfilled' ? result.value : null;
    const market = data?.currency === 'USD' && Array.isArray(data.markets) ? data.markets.find(m => m.symbol === symbol) : null;
    const age = market?.updated_at ? Date.now() - Date.parse(market.updated_at) : NaN;
    target.textContent = finite(market?.price) && market.price > 0 && age >= -30000 && age <= 120000 ? `Current price: ${new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits:market.price < 10 ? 6 : 2}).format(market.price)} · ${value(data.source)} · ${at(market.updated_at)}` : `Current price unavailable${market?.updated_at ? ' · stale or invalid quote · ' + at(market.updated_at) : ''}`;
  }
  function trades(data, results, bots, receivedAt) {
    const target = panels[1]; target.replaceChildren(el('h3', 'Trades'), el('p', 'Current paper run · reported native fills and closed trades. Latest new-entry decisions are shown in Overview.', 'ai-note'));
    const raw = el('details', undefined, 'ai-raw'); raw.append(el('summary', 'Native trade reporting evidence')); advanced.append(raw);
    let count = 0, linked = false, expires = receivedAt + 45000;
    bots.forEach((bot, i) => {
      const report = results[i].status === 'fulfilled' ? results[i].value : null;
      if (report) raw.append(el('h4', bot.name), el('pre', JSON.stringify(report, null, 2)));
      // Reuse the dashboards' run identity, timestamp and native-fill acceptance.
      const independent = bot.id === 'slingshot';
      const validIndependent = report?.bot === 'slingshot' && report.mode === 'paper' && /^slingshot-paper-/.test(report.run_id || '');
      const accepted = independent && !validIndependent ? null : window.BotRegistry?.currentReporting(report, receivedAt, independent ? report : data.execution?.health);
      const safe = accepted && window.BotRegistry.positionReport(accepted);
      if (!safe || !Array.isArray(safe.open_trades)) { target.append(el('p', `${bot.name}: current-run trade reporting unverified.`, 'ai-stale')); return; }
      expires = Math.min(expires, Date.parse(report.observed_at) + 45000);
      const matches = row => row?.pair === `${symbol}/USDT:USDT`;
      const rows = [...safe.open_trades.filter(matches).map(row=>({row,open:true})), ...safe.history.filter(matches).map(row=>({row,open:false}))];
      const pending = [...(safe.pending_orders || []), ...(safe.unverified_positions || [])].filter(matches);
      if (pending.length) target.append(el('p', `${bot.name}: entry pending or fill unverified.`, 'ai-stale'));
      for (const {row,open} of rows) {
        count++; const card = el('article', undefined, 'ai-record'); card.append(el('h4', `${bot.name} · ${label(row.direction)}`), badge(open ? 'Open' : 'Closed'));
        const execution = data.execution?.latest_execution;
        const match = !independent && execution && row.entry_tag === `v2paper:${execution.opportunity_id}:${execution.sizing_id}`;
        linked ||= Boolean(match);
        const leverage = finite(row.leverage) ? row.leverage : match ? execution.leverage : null;
        card.append(metrics([['Entry', money(row.open_rate, 8)], ['Exit', open ? 'Not applicable · open trade' : money(row.close_rate, 8)], ['Leverage', finite(leverage) ? `${score(leverage)}×` : 'Historical evidence unavailable'], ['Stake', money(row.stake_amount)], ['Opened', at(row.open_date)], ['Closed', open ? 'Not applicable' : at(row.close_date)], ['Exit reason', open ? 'Not applicable · open trade' : row.exit_reason ? label(row.exit_reason) : 'Historical evidence unavailable']]));
        const pnl = el('p', `${open ? 'Unrealized' : 'Realized'} P&L: ${money(row.profit_abs)}${finite(row.profit_pct) ? ' (' + change(row.profit_pct) + ')' : ''}`, 'ai-pnl');
        if (finite(row.profit_abs)) pnl.dataset.tone = row.profit_abs > 0 ? 'positive' : row.profit_abs < 0 ? 'negative' : 'neutral'; card.append(pnl);
        card.append(el('h4', 'Original trade rationale'), el('p', match && execution.payload?.why_go ? `${explanation(execution.payload.why_go)} · ${value(execution.payload.why_horizon)} · ${label(execution.payload.why_direction)}` : 'Historical evidence unavailable. The latest new-entry decision is not substituted.', 'ai-note')); target.append(card);
      }
    });
    const saved = data.execution?.latest_execution;
    if (saved && !linked) {
      const closed = saved.status === 'CLOSED', p = saved.payload || {};
      const record = el('article', undefined, 'ai-record'); record.append(el('h4','Latest saved execution'), badge(`${label(saved.status)} · saved evidence`), metrics([['Entry', money(saved.execution_price, 8)], ['Exit', closed && finite(p.close_rate) ? money(p.close_rate, 8) : saved.status === 'OPEN' ? 'Not applicable · recorded open' : 'Historical evidence unavailable'], ['Leverage', finite(saved.leverage) ? `${score(saved.leverage)}×` : 'Not recorded'], ['Executed stake', money(saved.executed_stake)], ['Exit reason', p.exit_reason ? label(p.exit_reason) : saved.status === 'OPEN' ? 'Not applicable · recorded open' : 'Historical evidence unavailable']]), el('h4', 'Original trade rationale'), el('p', p.why_go ? `${explanation(p.why_go)} · ${value(p.why_horizon)} · ${label(p.why_direction)}` : 'Historical evidence unavailable.', 'ai-note'));
      const pnl = el('p', closed && finite(p.profit_abs) ? `Realized P&L: ${money(p.profit_abs)} · saved close` : 'P&L: Historical evidence unavailable', 'ai-pnl');
      if (closed && finite(p.profit_abs)) pnl.dataset.tone = p.profit_abs > 0 ? 'positive' : p.profit_abs < 0 ? 'negative' : 'neutral'; record.append(pnl); target.append(record);
    }
    target.append(el('p', 'The header shows central v2 status. Slingshot reports use their own paper run. Live positions are not verified here.', 'ai-note'));
    if (!count) target.append(el('p', 'No matching fills in the verified current-run reports. Missing reports do not establish that no trade exists.', 'ai-note'));
    const timer = setTimeout(() => { if (!sessionActive || !target.isConnected) return; target.replaceChildren(el('h3','Trades'), el('p', 'Stale · reopen the asset to refresh native trade reporting. Saved reporting evidence remains in Advanced.', 'ai-stale')); }, Math.max(1, expires - Date.now()));
    controller.signal.addEventListener('abort', () => clearTimeout(timer), {once:true});
  }
  async function open(raw, trigger = document.activeElement) {
    const next = String(raw || '').toUpperCase(); if (!/^[A-Z0-9]{1,20}$/.test(next)) return;
    if (!dialog.open && sessionActive) finish();
    clearTimeout(closeTimer); dialog.classList.remove('ai-closing');
    clearInterval(briefTimer); clearTimeout(sizingExpiryTimer); clearTimeout(executionExpiryTimer); controller?.abort(); controller = new AbortController(); const token = ++request; symbol = next;
    advanced = null; tabs.hidden = true; summaryHeader.replaceChildren(); heading.querySelector('.ai-shadow-header').textContent = 'Read-only asset evidence';
    selectionEvidence(trigger);
    if (!dialog.open) { sessionActive = true; origin = trigger; previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog.showModal(); }
    title.textContent = symbol; body.replaceChildren(el('p', 'Loading asset intelligence…', 'ai-note')); body.setAttribute('aria-busy','true'); close.focus();
    const get = async path => { const r = await fetch(API + path, {cache:'no-store', signal:AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])}); if (!r.ok) { const e = Error('Unavailable'); e.status = r.status; throw e; } return r.json(); };
    const base = `/api/v2/intelligence/assets/${encodeURIComponent(symbol)}`;
    const supplemental = Promise.allSettled([get(base + '/news'), get(base + '/events'), get('/api/market-summary')]);
    try {
      const data = await get(base); if (token !== request || !dialog.open) return;
      renderDetail(data); body.setAttribute('aria-busy','false');
      const bots = window.BotRegistry?.bots || [];
      // Preserve Slingshot's independent run acceptance; never merge it into the central run.
      const reporting = Promise.allSettled(bots.map(bot => get(bot.reporting))).then(results => { if (token === request && dialog.open) trades(data, results, bots, Date.now()); });
      const [news, events, market] = await supplemental; if (token !== request || !dialog.open) return;
      collection('news', news); collection('events', events); price(market);
      await reporting;
    } catch (e) {
      if (token !== request || !dialog.open) return;
      clearInterval(briefTimer); tabs.hidden = true; summaryHeader.replaceChildren();
      body.setAttribute('aria-busy','false'); body.replaceChildren(el('p', e.status === 404 ? 'Asset not found in the intelligence registry.' : 'Asset intelligence unavailable. Please try again.', 'ai-note'));
      const retry = el('button', 'Retry', 'ai-retry'); retry.type = 'button'; retry.addEventListener('click', () => open(symbol, origin)); body.append(retry);
    }
  }
  window.AssetIntelligence = Object.freeze({open});
  document.addEventListener('click', e => { const trigger = e.target.closest('[data-intelligence-symbol]'); if (trigger) { e.preventDefault(); open(trigger.dataset.intelligenceSymbol, trigger); } });
  function enhance() {
    // Known presentation surfaces only. Keep existing card contents and refresh owners.
    for (const node of document.querySelectorAll('.header-asset, .bot-universe-top strong, .scan-tile .scan-asset strong, .asset-path > h4, .hourly-exit-head h4, #exit-monitoring h4, #open-trades tr td:first-child, #completed-trades tr td:first-child')) {
      if (node.querySelector('[data-intelligence-symbol]') || node.dataset.intelligenceSymbol) continue;
      const pair = node.closest('[data-pair]')?.dataset.pair || node.closest('[data-symbol]')?.dataset.symbol || node.textContent.trim();
      const match = /^([A-Z0-9]{1,20})(?:\/(?:USD|USDT)(?::USDT)?)?$/.exec(pair); if (!match) continue;
      const b = el('button', node.textContent, 'ai-asset-link'); b.type = 'button'; b.dataset.intelligenceSymbol = match[1]; b.setAttribute('aria-haspopup','dialog'); b.setAttribute('aria-label', `Inspect ${match[1]} asset intelligence`); node.replaceChildren(b);
    }
  }
  enhance(); new MutationObserver(enhance).observe(document.body, {childList:true, subtree:true});
})();

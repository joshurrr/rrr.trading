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
  let controller, origin, symbol, previousOverflow, sizingExpiryTimer, request = 0, sessionActive = false;
  function finish() {
    sessionActive = false; request++; clearTimeout(sizingExpiryTimer); controller?.abort(); document.body.style.overflow = previousOverflow ?? '';
    if (origin?.isConnected) origin.focus();
    else document.querySelector(`[data-intelligence-symbol="${symbol}"]`)?.focus();
  }
  function dismiss() { if (!dialog.open) return; dialog.close(); finish(); }
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
  function section(name) { const s = el('section', undefined, 'ai-section'); s.append(el('h3', name)); body.append(s); return s; }
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
  function decisionSection(raw) {
    const s = section('Current v2 decision'); s.id = 'ai-decision';
    s.append(el('strong', 'SHADOW MODE · NOT CONTROLLING TRADES', 'ai-shadow-label'));
    const d = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const elapsed = Date.now() - Date.parse(d.decision_time);
    const maxAge = d.evidence?.configuration?.decision_max_age_seconds;
    const current = d.shadow_mode === true && d.execution_connected === false && d.available === true && d.freshness === 'FRESH' && Number.isFinite(elapsed) && elapsed >= -30000 && finite(maxAge) && maxAge > 0 && elapsed <= maxAge * 1000;
    const go = current && d.decision === 'GO' && ['LONG','SHORT'].includes(d.direction) && frames.some(([key]) => key === d.selected_timeframe) && finite(d.selected_score) && d.selected_score >= 0 && d.selected_score <= 100 && finite(d.selection_confidence) && d.selection_confidence >= 0 && d.selection_confidence <= 1;
    s.append(el('p', current ? go ? 'SHADOW GO' : d.decision === 'BLOCKED' ? 'SHADOW BLOCKED' : 'SHADOW NO TRADE' : 'Shadow decision unavailable or stale', 'ai-note'));
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
      panel.append(el('h4', `${key} ${name}`), el('strong', go && key === d.selected_timeframe ? 'SELECTED · SHADOW ONLY' : current ? label(f.status || 'INSUFFICIENT_DATA') : 'STALE / UNAVAILABLE'), metrics([
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
    s.append(grid, el('p', 'Scores compare deterministic risk-adjusted evidence. Confidence is an evidence indicator, not a success probability. Fee/slippage and noise are proxies. Active-position checks affect this shadow result only; existing bots keep their own trading decisions.', 'ai-note'));
  }
  function sizingSection(raw, decision) {
    const s = section('Shadow position sizing'); s.id = 'ai-sizing';
    s.append(el('strong', 'SHADOW ONLY · NOT CONTROLLING TRADES', 'ai-shadow-label'));
    const p = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const d = decision || {}, now = Date.now(), maxAge = d.evidence?.configuration?.decision_max_age_seconds;
    const age = now - Date.parse(d.decision_time);
    const opportunityCurrent = d.available === true && d.freshness === 'FRESH' && d.decision === 'GO' && d.shadow_mode === true && d.execution_connected === false && finite(maxAge) && maxAge > 0 && age >= -30000 && age <= maxAge * 1000 && (!d.evidence_expires_at || Date.parse(d.evidence_expires_at) >= now);
    const deadline = Date.parse(p.evidence_expires_at), proposalAge = now - Date.parse(p.decision_time);
    const current = opportunityCurrent && p.available === true && p.freshness === 'FRESH' && p.shadow_mode === true && p.execution_connected === false && p.opportunity_id === d.id && finite(d.id) && p.currency === 'USDT' && Number.isFinite(deadline) && deadline >= now && proposalAge >= 0 && ['ALLOW','REDUCE','BLOCK'].includes(p.risk_decision) && finite(p.final_proposed_stake) && p.final_proposed_stake >= 0 && finite(p.proposed_notional) && p.proposed_notional >= 0 && (p.risk_decision !== 'BLOCK' || (p.final_proposed_stake === 0 && p.proposed_notional === 0));
    const amount = v => finite(v) && v >= 0 ? `${new Intl.NumberFormat('en-US', {maximumFractionDigits:2}).format(v)} USDT` : 'Unavailable';
    const mult = v => finite(v) && v >= 0 ? `${score(v)}×` : 'Unavailable';
    s.append(el('p', current ? `SHADOW ${label(p.risk_decision)} · ${value(p.timeframe)} ${label(p.direction)}` : !opportunityCurrent ? 'No sizing proposal — no valid trade opportunity.' : 'Shadow sizing unavailable or stale', current ? 'ai-note' : 'ai-stale'));
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
    ]), el('p', 'Stake is committed paper equity; notional is stake × independently capped leverage. USDT is not converted USD. Confidence is uncalibrated evidence quality. Crypto-beta grouping is a conservative concentration proxy, not measured correlation. Missing expected move cannot prove an edge after costs. These proposals never change bot trades.', 'ai-note'));
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
  function renderDetail(data) {
    if (data?.asset?.symbol !== symbol) throw Error('Invalid identity');
    title.textContent = `${symbol}${data.asset.name ? ' — ' + data.asset.name : ''}`;
    body.replaceChildren(); body.append(el('p', `${label(data.asset.exchange)} · ${label(data.asset.market_type)} · API ${value(data.api_version)}`, 'ai-note'));
    const price = el('p', 'Current price: loading…', 'ai-note'); price.id = 'ai-price'; body.append(price);
    decisionSection(data.decision);
    sizingSection(data.sizing, data.decision);
    learningSection(data.learning);
    section('Overall intelligence').append(stateCard(data.overall_state, true, 720), el('p', 'Evidence confidence is not a success probability. These states are informational; each bot retains its own entry checks.', 'ai-note'));
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
  }
  function collection(kind, result) {
    const s = document.getElementById(`ai-${kind}`); if (!s) return;
    while (s.children.length > 1) s.lastChild.remove();
    if (result.status !== 'fulfilled' || result.value?.asset?.symbol !== symbol || !Array.isArray(result.value[kind])) { s.append(el('p', `${kind === 'news' ? 'News' : 'Events'} intelligence unavailable.`, 'ai-note')); return; }
    const records = result.value[kind].filter(record => record && typeof record === 'object' && !Array.isArray(record));
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
  }
  function price(result) {
    const target = document.getElementById('ai-price'); if (!target) return;
    const data = result.status === 'fulfilled' ? result.value : null;
    const market = data?.currency === 'USD' && Array.isArray(data.markets) ? data.markets.find(m => m.symbol === symbol) : null;
    const age = market?.updated_at ? Date.now() - Date.parse(market.updated_at) : NaN;
    target.textContent = finite(market?.price) && market.price > 0 && age >= -30000 && age <= 120000 ? `Current price: ${new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits:market.price < 10 ? 6 : 2}).format(market.price)} · ${value(data.source)} · ${at(market.updated_at)}` : `Current price unavailable${market?.updated_at ? ' · stale or invalid quote · ' + at(market.updated_at) : ''}`;
  }
  async function open(raw, trigger = document.activeElement) {
    const next = String(raw || '').toUpperCase(); if (!/^[A-Z0-9]{1,20}$/.test(next)) return;
    if (!dialog.open && sessionActive) finish();
    clearTimeout(sizingExpiryTimer); controller?.abort(); controller = new AbortController(); const token = ++request; symbol = next;
    if (!dialog.open) { sessionActive = true; origin = trigger; previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog.showModal(); }
    title.textContent = symbol; body.replaceChildren(el('p', 'Loading asset intelligence…', 'ai-note')); body.setAttribute('aria-busy','true'); close.focus();
    const get = async path => { const r = await fetch(API + path, {cache:'no-store', signal:AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])}); if (!r.ok) { const e = Error('Unavailable'); e.status = r.status; throw e; } return r.json(); };
    const base = `/api/v2/intelligence/assets/${encodeURIComponent(symbol)}`;
    const supplemental = Promise.allSettled([get(base + '/news'), get(base + '/events'), get('/api/market-summary')]);
    try {
      const data = await get(base); if (token !== request || !dialog.open) return;
      renderDetail(data); body.setAttribute('aria-busy','false');
      const [news, events, market] = await supplemental; if (token !== request || !dialog.open) return;
      collection('news', news); collection('events', events); price(market);
    } catch (e) {
      if (token !== request || !dialog.open) return;
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

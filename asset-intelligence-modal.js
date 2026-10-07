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
  const heading = el('div'); const title = el('h2'); title.id = 'ai-title'; heading.append(el('p', 'Asset Intelligence', 'ai-eyebrow'), title);
  const close = el('button', '×', 'ai-close'); close.type = 'button'; close.setAttribute('aria-label', 'Close asset intelligence');
  head.append(heading, close); const body = el('div', undefined, 'ai-content'); body.setAttribute('aria-live', 'polite'); body.tabIndex = 0; body.setAttribute('role', 'region'); body.setAttribute('aria-label', 'Asset intelligence details'); shell.append(head, body); dialog.append(shell); document.body.append(dialog);
  let controller, origin, symbol, previousOverflow, request = 0;
  function finish() {
    request++; controller?.abort(); document.body.style.overflow = previousOverflow ?? '';
    if (origin?.isConnected) origin.focus();
    else document.querySelector(`[data-intelligence-symbol="${symbol}"]`)?.focus();
  }
  close.addEventListener('click', () => dialog.close()); dialog.addEventListener('close', finish);
  // Native modal dialog supplies inert background, Escape and contained Tab navigation.
  let outside = false;
  const isOutside = event => { const r = dialog.getBoundingClientRect(); return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom; };
  dialog.addEventListener('pointerdown', e => { outside = e.target === dialog && isOutside(e); });
  dialog.addEventListener('click', e => { if (outside && e.target === dialog && isOutside(e)) dialog.close(); outside = false; });
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
  function renderDetail(data) {
    if (data?.asset?.symbol !== symbol) throw Error('Invalid identity');
    title.textContent = `${symbol}${data.asset.name ? ' — ' + data.asset.name : ''}`;
    body.replaceChildren(); body.append(el('p', `${label(data.asset.exchange)} · ${label(data.asset.market_type)} · API ${value(data.api_version)}`, 'ai-note'));
    const price = el('p', 'Current price: loading…', 'ai-note'); price.id = 'ai-price'; body.append(price);
    section('Overall intelligence').append(stateCard(data.overall_state, true, 720), el('p', 'Evidence confidence is not a success probability. These states are informational; each bot retains its own entry checks.', 'ai-note'));
    const tf = section('Timeframe intelligence'), grid = el('div', undefined, 'ai-timeframes');
    for (const [key, name, minutes] of frames) { const panel = el('article'); panel.dataset.timeframe = key; panel.append(el('h4', `${key} ${name}`), stateCard(data.timeframes?.[key], false, minutes)); grid.append(panel); } tf.append(grid);
    if (data.universe_sync?.fresh === false) tf.append(el('p', 'STALE / UNAVAILABLE · asset registry selection source. This is separate from assessment freshness.', 'ai-stale'));
    for (const kind of ['news','events']) { const s = section(kind === 'news' ? 'Recent news' : 'Recent events'); s.id = `ai-${kind}`; s.append(el('p', `Loading ${kind}…`, 'ai-note')); }
    const history = section('Learning / history'); history.append(el('p', 'Learning history will appear here once v2 outcome tracking is active.', 'ai-note'), metrics([['Current intelligence version', value(data.overall_state?.state_version)]]));
    // Foundation version metadata describes the schema, not asset observations or learned outcomes.
    for (const version of Array.isArray(data.versions) ? data.versions.filter(v => v && typeof v === 'object') : []) history.append(el('p', `${value(version.version)} · ${label(version.status)} · ${value(version.description)}`, 'ai-note'));
  }
  function collection(kind, result) {
    const s = document.getElementById(`ai-${kind}`); if (!s) return;
    while (s.children.length > 1) s.lastChild.remove();
    if (result.status !== 'fulfilled' || result.value?.asset?.symbol !== symbol || !Array.isArray(result.value[kind])) { s.append(el('p', `${kind === 'news' ? 'News' : 'Events'} intelligence unavailable.`, 'ai-note')); return; }
    const records = result.value[kind].filter(record => record && typeof record === 'object' && !Array.isArray(record));
    if (result.value[kind].length && !records.length) { s.append(el('p', 'Intelligence records unavailable.', 'ai-note')); return; }
    if (!records.length) { s.append(el('p', kind === 'news' ? 'No asset-specific intelligence has been recorded yet.' : 'No events recorded yet.', 'ai-note')); if (result.value.status === 'unavailable') s.append(el('p', 'Source unavailable · collection is not active yet.', 'ai-note')); return; }
    for (const record of records) {
      const item = el('article', undefined, 'ai-record');
      item.append(el('h4', value(kind === 'news' ? record.headline : label(record.event_type))));
      if (kind === 'events' && record.description) item.append(el('p', value(record.description)));
      const rows = [['Source', value(record.source)], [kind === 'news' ? 'Published' : 'Event time', at(kind === 'news' ? record.published_at : record.event_time)], ['Direction', label(record.direction)], ['Confidence', percent(record.confidence)]];
      if (kind === 'news') rows.push(['Relevance', percent(record.relevance_score)], ['Impact', score(record.impact_score)], ['Event type', label(record.event_type)]); else rows.push(['Importance', score(record.importance)]);
      item.append(metrics(rows)); s.append(item);
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
    controller?.abort(); controller = new AbortController(); const token = ++request; symbol = next;
    if (!dialog.open) { origin = trigger; previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog.showModal(); }
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

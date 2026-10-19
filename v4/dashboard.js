'use strict';
// Presentation only. This page has exactly one paper-feed endpoint and no writes.
(() => {
  const ENDPOINT = '/v4/paper';
  const $ = id => document.getElementById(id);
  const el = (tag, value, className) => {
    const node = document.createElement(tag);
    if (value !== undefined) node.textContent = value;
    if (className) node.className = className;
    return node;
  };
  const number = value => {
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))) return null;
    const n = Number(value); return Number.isFinite(n) ? n : null;
  };
  const money = value => { const n = number(value); return n === null ? 'Unavailable' : new Intl.NumberFormat('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}).format(n) + ' USDT'; };
  const price = value => { const n = number(value); return n === null ? 'Unavailable' : new Intl.NumberFormat('en-AU', {maximumSignificantDigits:8}).format(n); };
  const text = value => typeof value === 'string' && value.trim() ? value.slice(0, 180) : 'Unknown';
  const date = value => {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return 'Time unavailable';
    return new Intl.DateTimeFormat('en-AU', {timeZone:'Australia/Brisbane', dateStyle:'medium', timeStyle:'short'}).format(new Date(value)) + ' AEST';
  };
  const reason = value => text(value).replaceAll('_', ' ').replaceAll(':', ': ');
  const reasons = values => Array.isArray(values) ? values.map(reason).join(' · ') : '';
  const expired = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.now() >= Date.parse(value);
  const badge = (id, value, tone = '') => { $(id).textContent = value; $(id).dataset.tone = tone; };
  const availability = source => ['AVAILABLE','STALE','UNAVAILABLE'].includes(source?.availability) ? source.availability : 'UNAVAILABLE';
  const tone = value => value === 'AVAILABLE' ? 'good' : value === 'STALE' ? 'warn' : '';
  const side = value => { const node = el('span', ['LONG','SHORT'].includes(value) ? value : 'UNKNOWN', 'side'); node.dataset.side = node.textContent; return node; };
  const empty = (id, message) => $(id).replaceChildren(el('p', message, 'empty-state'));
  const pnlTone = (node, value) => { const n = number(value); node.classList.toggle('up', n !== null && n > 0); node.classList.toggle('down', n !== null && n < 0); };
  const metrics = [
    ['wallet-balance','balance-note','wallet_balance'], ['wallet-equity','equity-note','equity'],
    ['wallet-realized','realized-note','realized_pnl'], ['wallet-unrealized','unrealized-note','unrealized_pnl']
  ];
  let busy = false;

  function state(message, error = false) {
    badge('feed-status', message, error ? 'bad' : '');
    $('feed-time').textContent = error ? 'Demo API unavailable. No account data is shown.' : 'Loading demo data…';
    $('monitoring-notice').textContent = 'Monitoring coverage is unknown' + (error ? '; demo data could not be loaded.' : ' while demo data loads.');
    $('monitoring-notice').dataset.tone = error ? 'warn' : '';
    for (const [id,note] of metrics) { $(id).textContent = error ? 'Unavailable' : 'Loading…'; pnlTone($(id), null); $(note).textContent = error ? 'No verified demo snapshot.' : 'Awaiting saved demo data.'; }
    for (const id of ['cycle-state','sentiment-state','positions-state','trades-state']) badge(id, error ? 'Unavailable' : 'Loading');
    $('cycle-time').textContent = error ? 'Saved cycle unavailable.' : 'Loading saved cycle…';
    $('cycle-coverage').textContent = 'Monitoring coverage unknown.';
    $('cycle-reasons').textContent = ''; $('unmonitored-list').replaceChildren();
    $('sentiment-direction').textContent = 'Direction unknown';
    $('sentiment-time').textContent = error ? 'Saved assessment unavailable.' : 'Loading saved assessment…';
    $('sentiment-detail').textContent = 'Demo context only; never trade approval.';
    $('sentiment-unknowns').textContent = 'Confidence: unknown · Risk regime: unknown';
    empty('positions-list', error ? 'Open demo positions unavailable.' : 'Loading saved demo positions…');
    empty('trades-list', error ? 'Completed demo trades unavailable.' : 'Loading recorded demo trades…');
  }

  function walletView(wallet) {
    for (const [id,note,key] of metrics) {
      const field = availability(wallet) === 'UNAVAILABLE' ? 'UNAVAILABLE' : wallet.field_availability?.[key] || availability(wallet);
      const fresh = field === 'AVAILABLE';
      const value = fresh ? wallet[key] : null;
      $(id).textContent = money(value); pnlTone($(id), key.endsWith('pnl') ? value : null);
      const basis = wallet.valuation_basis === 'LEDGER_ONLY_NO_OPEN_POSITIONS' ? 'Ledger only · no open positions. Saved ' :
        wallet.field_availability ? (['wallet_balance','realized_pnl'].includes(key) ? 'Ledger saved ' : 'Valuation saved ') : 'Saved ';
      $(note).textContent = field === 'STALE' ? 'STALE · Last known: ' + money(wallet.last_known?.[key]) :
        fresh ? basis + date(wallet.as_of) : 'Saved demo account unavailable.';
    }
  }

  function cycleView(cycle) {
    const available = availability(cycle), monitoring = cycle?.monitoring;
    badge('cycle-state', available === 'UNAVAILABLE' ? 'Unavailable' : (available === 'STALE' ? 'STALE · ' : '') + text(cycle.status),
      available === 'STALE' || cycle?.status !== 'OK' ? 'warn' : 'good');
    $('cycle-time').textContent = available === 'UNAVAILABLE' ? 'No readable saved cycle summary.' : 'Last cycle: ' + date(cycle.started_at);
    $('unmonitored-list').replaceChildren();
    const failures = Array.isArray(monitoring?.unmonitored) ? monitoring.unmonitored : null;
    const count = value => Number.isInteger(value) && value >= 0 ? String(value) : 'unknown';
    $('cycle-coverage').textContent = failures === null || available === 'UNAVAILABLE' ? 'Monitoring coverage unknown.' :
      'Monitored: ' + count(monitoring.monitored_count) + ' / ' + count(monitoring.requested_positions) + ' demo positions in that cycle.';
    for (const item of failures || []) $('unmonitored-list').append(el('li', text(item.symbol) + ' · Unmonitored · ' + (reasons(item.reasons) || 'Reason unavailable')));
    $('cycle-reasons').textContent = reasons(cycle?.reasons) || (available === 'STALE' ? 'Historical cycle; monitoring status may be out of date.' : '');
    const warning = $('monitoring-notice');
    warning.dataset.tone = failures?.length || failures === null || available !== 'AVAILABLE' || monitoring?.status !== 'OK' ? 'warn' : '';
    warning.textContent = failures?.length ? 'Monitoring attention: unmonitored demo positions reported. See the cycle details below.' :
      failures === null || available === 'UNAVAILABLE' ? 'Cycle status unavailable. Monitoring coverage is unknown.' :
      available === 'STALE' ? 'STALE cycle summary. Current monitoring coverage is unknown.' :
      monitoring?.status !== 'OK' ? 'Demo-position monitoring requires attention. See the last cycle status.' :
      'The last cycle reported no unmonitored demo positions. This is a saved check, not continuous monitoring.';
    return Boolean(failures?.length || available !== 'AVAILABLE' || monitoring?.status !== 'OK');
  }

  function sentimentView(sentiment) {
    const available = availability(sentiment), context = sentiment?.context_state;
    const current = available === 'AVAILABLE' && context === 'CURRENT' && !expired(sentiment.entry_expires_at);
    const historical = available === 'STALE' && context === 'CONTEXT_ONLY' && !expired(sentiment.entry_expires_at);
    badge('sentiment-state', current ? 'Current' : historical ? 'Context only · STALE' : 'Unavailable', current ? 'good' : historical ? 'warn' : '');
    const direction = {UP:'Upward ↗', DOWN:'Downward ↘', NEUTRAL:'Neutral →'}[sentiment?.market_direction] || 'Direction unknown';
    $('sentiment-direction').textContent = current || historical ? direction + (historical ? ' (historical)' : '') : 'Direction unknown';
    $('sentiment-time').textContent = 'Assessed: ' + date(sentiment?.assessment_timestamp) + ' · Valid until: ' + date(sentiment?.entry_expires_at);
    $('sentiment-detail').textContent = historical ? 'Historical context, not fresh confirmation. Entry evidence: BLOCKED.' :
      current ? 'Entry evidence: ' + text(sentiment.status) + '. Sentiment is context, not trade approval.' : 'Current sentiment unavailable. ' + reasons(sentiment?.reasons);
    $('sentiment-unknowns').textContent = 'Confidence: ' + (sentiment?.confidence_status === 'UNKNOWN' || sentiment?.confidence == null ? 'unknown' : text(String(sentiment.confidence))) +
      ' · Risk regime: ' + (sentiment?.risk_regime_status === 'UNKNOWN' || sentiment?.risk_regime == null ? 'unknown' : text(sentiment.risk_regime));
  }

  function positionsView(source) {
    const status = availability(source);
    badge('positions-state', status, tone(status));
    if (status === 'UNAVAILABLE' || !Array.isArray(source.items)) return empty('positions-list', 'Open demo positions unavailable.');
    if (!source.items.length) return empty('positions-list', 'No open demo positions recorded.');
    $('positions-list').replaceChildren();
    for (const item of source.items) {
      const fresh = item.availability === 'AVAILABLE' && !expired(item.mark_expires_at);
      const card = el('article', undefined, 'market-card');
      const head = el('div', undefined, 'position-head');
      head.append(el('h3', text(item.symbol)), side(item.side), el('small', text(item.exchange) + ' · DEMO'));
      const statusNode = el('span', fresh ? 'Current mark' : 'STALE / unavailable', 'paper-state'); statusNode.dataset.tone = fresh ? '' : 'warn'; head.append(statusNode);
      const details = el('dl', undefined, 'position-details');
      const add = (label, value, note, pnl) => { const block = el('div'), dd = el('dd', value); if (pnl !== undefined) pnlTone(dd, pnl); block.append(el('dt', label), dd); if (note) block.append(el('small', note)); details.append(block); };
      add('Entry · USDT', price(item.entry_price));
      add('Current mark · USDT', fresh ? price(item.current_mark) : 'Unavailable', !fresh ? 'Last known: ' + price(item.last_known_mark) : null);
      add('Protective stop · USDT', price(item.protective_stop));
      add('Leverage', number(item.leverage) === null ? 'Unknown' : price(item.leverage) + '×');
      add('Unrealised P/L', fresh ? money(item.unrealized_pnl) : 'Unavailable', !fresh ? 'Last known: ' + money(item.last_known_unrealized_pnl) : null, fresh ? item.unrealized_pnl : null);
      add('Mark observed', date(item.mark_observed_at));
      card.append(head, details); $('positions-list').append(card);
    }
  }

  function tradesView(source) {
    const status = availability(source); badge('trades-state', status, tone(status));
    if (status === 'UNAVAILABLE' || !Array.isArray(source.items)) return empty('trades-list', 'Completed demo trades unavailable.');
    if (!source.items.length) return empty('trades-list', 'No completed demo trades recorded.');
    const table = el('table', undefined, 'paper-trades'); table.setAttribute('aria-label', 'Completed demo trades');
    const labels = ['Asset / side', 'Entry → exit · USDT', 'Opened · AEST', 'Closed · AEST', 'Realised P/L', 'Exit reason'];
    const thead = el('thead'), header = el('tr');
    for (const label of labels) { const th = el('th', label); th.scope = 'col'; header.append(th); } thead.append(header);
    const body = el('tbody');
    for (const item of source.items) {
      const row = el('tr'), asset = el('th', text(item.symbol)); asset.scope = 'row'; asset.append(el('small', text(item.exchange) + ' · DEMO'), side(item.side)); row.append(asset);
      const values = [price(item.entry_price) + ' → ' + price(item.exit_price), date(item.entered_at), date(item.closed_at), money(item.realized_pnl), reason(item.exit_reason)];
      values.forEach((value, i) => { const td = el('td'); const label = el('span', labels[i+1], 'cell-label'); label.setAttribute('aria-hidden','true'); td.append(label, el('span', value));
        if (i === 3) { pnlTone(td, item.realized_pnl); td.append(el('small', 'Net after fees: ' + money(item.net_pnl))); } row.append(td); }); body.append(row);
    }
    table.append(thead, body); $('trades-list').replaceChildren(table);
  }

  function validate(data) {
    if (!data || data.version !== 'paper-read-api-v1' || data.mode !== 'paper') throw new Error('not_paper');
    for (const key of ['wallet','open_positions','completed_trades','latest_cycle','sentiment']) {
      if (!data[key] || typeof data[key] !== 'object' || Array.isArray(data[key]) || (data[key].mode && data[key].mode !== 'paper')) throw new Error('invalid_paper_feed');
    }
    for (const key of ['open_positions','completed_trades']) for (const item of data[key].items || []) {
      if (!item || typeof item !== 'object' || (item.mode && item.mode !== 'paper')) throw new Error('not_paper');
    }
  }

  async function refresh() {
    if (busy) return;
    busy = true; $('refresh-paper').disabled = true; $('main').setAttribute('aria-busy','true'); state('Loading');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(ENDPOINT, {method:'GET', credentials:'omit', redirect:'error', cache:'no-store', signal:controller.signal});
      if (!response.ok) throw new Error('paper_feed_unavailable');
      const data = await response.json(); validate(data);
      // Presentation expiry only: use source-provided deadlines, never a new
      // freshness threshold or a recalculated account valuation.
      const expiredMarks = (data.open_positions.items || []).some(item => expired(item.mark_expires_at));
      if (expiredMarks || expired(data.wallet.valuation_expires_at)) {
        data.wallet.availability = 'STALE';
        data.wallet.valuation_availability = 'STALE';
        if (data.wallet.field_availability) for (const key of ['equity','unrealized_pnl','available_collateral']) data.wallet.field_availability[key] = 'STALE';
        if (expiredMarks) data.open_positions.availability = 'STALE';
      }
      if (data.sentiment.availability === 'AVAILABLE' && expired(data.sentiment.entry_expires_at)) data.sentiment.availability = 'STALE';
      walletView(data.wallet); const attention = cycleView(data.latest_cycle); sentimentView(data.sentiment); positionsView(data.open_positions); tradesView(data.completed_trades);
      const states = [data.wallet, data.open_positions, data.completed_trades, data.latest_cycle, data.sentiment].map(availability);
      const label = states.every(s => s === 'UNAVAILABLE') ? 'Unavailable' : states.includes('STALE') ? 'Stale / partial' : attention || states.includes('UNAVAILABLE') ? 'Partial' : 'Available';
      badge('feed-status', label, label === 'Available' ? 'good' : 'warn');
      $('feed-time').textContent = 'API snapshot: ' + date(data.served_at);
    } catch (_) { state('Error', true); }
    finally { clearTimeout(timeout); busy = false; $('refresh-paper').disabled = false; $('main').setAttribute('aria-busy','false'); }
  }
  $('refresh-paper').addEventListener('click', refresh);
  refresh();
})();

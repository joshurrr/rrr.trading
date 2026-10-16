(() => {
  'use strict';
  const anchor = document.getElementById('live-candidate-progress');
  if (!anchor) return;
  const node = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const panel = node('details', '', 'trade-history'); panel.id = 'homepage-trade-history';
  const summary = node('summary', '24-hour trade history');
  const note = node('p', 'Loading completed trade history…', 'feed-note'); note.setAttribute('role', 'status');
  const list = node('div', '', 'trade-history-list');
  panel.append(summary, note, list); anchor.append(panel);
  const bots = {short:'15m', medium:'1h', long:'4h'};
  const timestamp = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d/.test(value)) return NaN;
    return Date.parse(/(?:Z|[+-]\d\d:\d\d)$/i.test(value) ? value : value.replace(' ', 'T') + 'Z');
  };
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const price = value => finite(value) && value > 0 ? value.toLocaleString('en-AU', {maximumFractionDigits:8}) + ' USDT' : 'Unavailable';
  const date = value => new Date(value).toLocaleString('en-AU', {timeZone:'Australia/Brisbane', day:'numeric', month:'short', hour:'numeric', minute:'2-digit'}) + ' Brisbane';
  const cell = (label, value) => {
    const n = node('div'); n.append(node('span', label, 'candidate-label'), node('span', value, 'candidate-value')); return n;
  };
  let saved, signature;
  const exitReasons = new Map([
    ['trend_break', ['Trend Break', 'amber', 'Trade closed because the strategy detected a break in the trend.']],
    ['roi', ['Profit Target', 'green', 'Trade closed after reaching its configured profit target.']],
    ['trailing_stop_loss', ['Trailing Stop', 'cyan', 'Trade closed when its trailing stop was triggered.']],
    ['stop_loss', ['Stop Loss', 'red', 'Trade closed when its protective stop-loss was triggered.']],
    ['stoploss_on_exchange', ['Exchange Stop Loss', 'red', 'Trade closed by a stop-loss order on the exchange.']],
    ['exit_signal', ['Exit Signal', 'amber', 'Trade closed after the strategy issued an exit signal.']],
    ['force_exit', ['Manual Exit', 'grey', 'Trade closed through a forced-exit command.']],
    ['emergency_exit', ['Emergency Exit', 'red', 'Trade closed through the emergency exit mechanism.']],
    ['liquidation', ['Liquidation', 'red', 'Position closed through liquidation.']],
    ['partial_exit', ['Partial Exit', 'grey', 'Part of the position was closed.']]
  ]);
  function exitCell(reason) {
    const raw = typeof reason === 'string' ? reason.trim() : '';
    const [label, tone, explanation] = exitReasons.get(raw) || [raw || 'Not recorded', 'grey', raw ? 'Recorded exit reason: ' + raw : 'No exit reason was recorded for this trade.'];
    const field = cell('Exit reason', ''), badge = node('span', label, 'trade-exit-badge');
    badge.dataset.mechanism = tone;
    badge.title = explanation; badge.tabIndex = 0;
    badge.setAttribute('aria-label', label + ': ' + explanation);
    field.lastChild.append(badge); return field;
  }
  function draw() {
    const now = Date.now(), metadata = saved?.metadata, heartbeat = timestamp(metadata?.last_run);
    const ready = metadata?.mode === 'PAPER' && metadata.stale === false && now - heartbeat >= -30000 && now - heartbeat < 45000;
    const reports = Object.entries(bots).map(([key, tf]) => ({tf, report:ready ? window.BotRegistry?.currentReporting(saved?.reports?.[key], saved?.reportsObserved, metadata, now) : null}));
    const valid = reports.filter(r => r.report), end = valid.length ? Math.min(...valid.map(r => timestamp(r.report.observed_at))) : now;
    const start = end - 86400000, rows = [], gaps = [];
    for (const {tf, report} of reports) {
      if (!report) { gaps.push(tf + ' unavailable/stale'); continue; }
      const unique = new Map(); let malformed = false;
      for (const trade of report.history) {
        const closed = timestamp(trade?.close_date);
        if (!Number.isSafeInteger(trade?.id) || trade.id <= 0 || !/^[A-Z0-9]{1,20}\/USDT(?::USDT)?$/.test(trade?.pair) || !Number.isFinite(closed) || closed < timestamp(trade.open_date) || closed > timestamp(report.observed_at) || report.open_trades.some(t => t.id === trade.id)) { malformed = true; continue; }
        if (unique.has(trade.id) && JSON.stringify(unique.get(trade.id).trade) !== JSON.stringify(trade)) malformed = true;
        unique.set(trade.id, {trade, closed, tf});
      }
      if (malformed) { gaps.push(tf + ' invalid history'); continue; }
      const history = [...unique.values()];
      const ordered = history.every((r, i) => i === 0 || history[i - 1].closed >= r.closed);
      const complete = report.portfolio.closed_trades === history.length || ordered && history.length === 25 && history[24].closed <= start;
      if (!complete) gaps.push(tf + ' history incomplete');
      rows.push(...history.filter(r => r.closed > start && r.closed <= end));
    }
    rows.sort((a, b) => b.closed - a.closed || a.tf.localeCompare(b.tf) || b.trade.id - a.trade.id);
    const next = JSON.stringify([rows, gaps, Boolean(saved), valid.length ? end : null]);
    if (next === signature) return; signature = next;
    summary.textContent = '24-hour trade history' + (valid.length ? ` (${rows.length}${gaps.length ? ' recorded' : ''})` : '');
    note.textContent = !saved ? 'Loading completed trade history…' : !valid.length ? 'Trade history unavailable. Missing or stale evidence does not prove there were no trades.' : `Completed paper trades · newest first · closed in the 24 hours ending ${date(end)}.${gaps.length ? ' Partial coverage: ' + gaps.join('; ') + '.' : ''}`;
    list.replaceChildren();
    for (const {trade, closed, tf} of rows) {
      const row = node('article', '', 'trade-history-row');
      const asset = cell('Asset', ''), button = node('button', trade.pair.split('/')[0], 'candidate-asset');
      button.type = 'button'; button.dataset.intelligenceSymbol = trade.pair.split('/')[0]; asset.lastChild.append(button);
      const pnl = cell('Realized P/L', window.ActivityPerformance.money(trade.profit_abs));
      pnl.lastChild.dataset.tone = window.ActivityPerformance.tone(trade.profit_abs);
      row.dataset.tradeId = trade.id; row.dataset.bot = tf;
      row.append(asset, cell('Bot', tf), cell('Side', ['LONG','SHORT'].includes(trade.direction) ? trade.direction : 'Unverified'), cell('Entry price', price(trade.open_rate)), cell('Exit price', price(trade.close_rate)), pnl, exitCell(trade.exit_reason), cell('Closed', date(closed)));
      list.append(row);
    }
    if (valid.length && !rows.length) list.append(node('p', gaps.length ? 'No completed trades in the available 24-hour history; coverage is incomplete.' : 'No completed trades in the last 24 hours.', 'muted'));
  }
  window.addEventListener('rrr-order-evidence', event => { saved = {...event.detail, reportsObserved:Date.now()}; draw(); });
  draw(); setInterval(draw, 1000);
})();

'use strict';
// Native saved trades only. Current unrealised P/L is never a 24-hour change.
(() => {
  const configs = { short: '15m', medium: '1h', long: '4h' };
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const timestamp = v => {
    if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d/.test(v)) return null;
    const ms = Date.parse(/(?:Z|[+-]\d\d:\d\d)$/i.test(v) ? v : v.replace(' ', 'T') + 'Z');
    return Number.isFinite(ms) ? ms : null;
  };
  const money = v => finite(v) ? `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toFixed(2)} USDT` : 'Unavailable';
  const tone = v => finite(v) ? v > 0 ? 'up' : v < 0 ? 'down' : 'neutral' : 'neutral';
  // IDs are scoped by bot, not symbol: the same asset may have multiple positions.
  function unique(rows) {
    if (!Array.isArray(rows)) return null;
    const map = new Map();
    for (const row of rows) {
      if (!row || !Number.isSafeInteger(row.id) || row.id <= 0 || typeof row.pair !== 'string' || !/^[A-Z0-9]{1,20}\/USDT(?::USDT)?$/.test(row.pair)) return null;
      if (map.has(row.id) && JSON.stringify(map.get(row.id)) !== JSON.stringify(row)) return null;
      map.set(row.id, row);
    }
    return [...map.values()];
  }
  function positions(data, timeframe, now = Date.now()) {
    const observed = finite(data?.status_observed_at) ? data.status_observed_at : data?.generated_at;
    if (data?.ok !== true || data.bot?.mode !== 'PAPER' || data.bot.timeframe !== timeframe || data.bot.stake_currency !== 'USDT' || !finite(data.generated_at) || now - data.generated_at * 1000 < -30000 || now - data.generated_at * 1000 > 30000 || !finite(observed) || now - observed * 1000 < -30000 || now - observed * 1000 > 30000) return null;
    return unique(data.open_trades);
  }
  function calculate(status, now = Date.now()) {
    const sources = Object.entries(configs).map(([key, tf]) => ({ key, data: status?.[key], trades: positions(status?.[key], tf, now) }));
    const valid = sources.filter(s => s.trades !== null);
    // Latest common endpoint: a newer bot must not imply an older feed has
    // observed closes in the gap. This keeps one exact window across all bots.
    const end = valid.length ? Math.min(...valid.map(s => s.data.generated_at * 1000)) : null;
    const start = end === null ? null : end - 86400000;
    let realized = 0, wins = 0, count = 0, complete = valid.length === 3, amounts = true;
    const coverage = [];
    for (const source of sources) {
      if (source.trades === null) { coverage.push(`${configs[source.key]} unavailable/stale`); continue; }
      const history = unique(source.data.history);
      const dated = history?.map(t => ({ ...t, closed: timestamp(t.close_date) }));
      // Existing adapters request native close_date DESC, then retain 25 rows.
      // A truncated page is complete for this window only if it crosses its start.
      const ordered = dated && dated.every((t, i) => t.closed !== null && t.closed <= source.data.generated_at * 1000 && (i === 0 || dated[i - 1].closed >= t.closed) && !source.trades.some(open => open.id === t.id));
      const allSaved = Number.isSafeInteger(source.data.portfolio?.closed_trades) && source.data.portfolio.closed_trades === history?.length;
      const covered = ordered && (allSaved || dated.length === 25 && dated[24].closed <= start);
      if (!covered) complete = false;
      coverage.push(`${configs[source.key]} ${covered ? 'closed history covered' : 'closed history incomplete'}`);
      if (!ordered) { amounts = false; continue; }
      for (const trade of dated.filter(t => t.closed > start && t.closed <= end)) {
        count++;
        if (!finite(trade.profit_abs)) amounts = false;
        else { realized += trade.profit_abs; if (trade.profit_abs > 0) wins++; }
      }
    }
    return { end, start, verified: valid.length, complete, realized: valid.length && amounts ? realized : null, count, winRate: complete && amounts && count ? wins / count * 100 : null, openCount: valid.length === 3 ? valid.reduce((n, s) => n + s.trades.length, 0) : null, coverage };
  }
  let lastSuccess = null;
  const date = ms => new Date(ms).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' }) + ' Brisbane';
  function render(status) {
    const host = document.getElementById('activity-performance'); if (!host) return;
    const result = calculate(status);
    if (result.verified === 3) lastSuccess = result.end;
    const readings = {
      realized: money(result.realized),
      change: 'Unavailable',
      closed: result.verified ? `${result.count}${result.complete ? '' : ' recorded'}` : 'Unavailable',
      wins: result.winRate === null ? result.complete && result.count === 0 ? 'No closed trades' : 'Unavailable' : `${result.winRate.toFixed(1)}%`,
      open: result.openCount === null ? 'Unavailable' : String(result.openCount)
    };
    for (const [key, value] of Object.entries(readings)) {
      const node = host.querySelector(`[data-performance="${key}"]`); node.textContent = value;
      node.dataset.tone = key === 'realized' ? tone(result.realized) : 'neutral';
    }
    host.querySelector('[data-realized-label]').textContent = result.complete ? 'REALISED P/L · CLOSED TRADES' : 'RECORDED REALISED P/L · PARTIAL';
    host.querySelector('[data-performance-window]').textContent = result.end === null ? '24-hour window unavailable · waiting for fresh PAPER feeds.' : `Rolling 24 hours: ${date(result.start)} → ${date(result.end)}. Latest common bot observation; feeds are sampled independently.`;
    host.querySelector('[data-performance-coverage]').textContent = `${result.verified} of 3 PAPER feeds verified · ${result.coverage.join(' · ')}. ${result.complete ? '' : 'Recorded totals may omit trades; they are not complete 24-hour results. '}Native trade P/L includes reported costs; separate fee and funding totals are unavailable.`;
    host.querySelector('[data-performance-updated]').textContent = `Last successful all-bot update: ${lastSuccess === null ? 'Unavailable' : date(lastSuccess)}${result.verified < 3 && lastSuccess !== null ? ' · current feeds missing/stale' : ''}.`;
  }
  const api = { calculate, positions, money, tone, render };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.ActivityPerformance = api;
})();

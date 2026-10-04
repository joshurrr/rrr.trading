'use strict';
// Progressive enhancement for navigation, radio and public research data.
// Public read-only state. Each endpoint fails independently; no trading actions.
const API_BASE = 'https://api.rrr.trading';
const stripMarkets = [['BTC', 'Bitcoin'], ['ETH', 'Ethereum'], ['SOL', 'Solana'], ['XRP', 'XRP'], ['TOTAL', 'Crypto market cap']];
function renderMarketSummary(data = null, message = 'Market feed unavailable · retrying every 60s') {
  const now = Date.now();
  const timestamp = value => typeof value === 'string' ? Date.parse(value) : NaN;
  const isFresh = value => Number.isFinite(value) && now - value <= 120000 && value <= now + 30000;
  const received = timestamp(data?.updated_at);
  // Validate observations independently: envelope metadata and TOTAL cannot gate the coins.
  const markets = data?.currency === 'USD' && Array.isArray(data.markets) ? data.markets : [];
  const money = (value, cap = false, small = value < 10) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', ...(cap ? { notation: 'compact', maximumFractionDigits: 2 } : { minimumFractionDigits: small ? 4 : 2, maximumFractionDigits: small ? 4 : 2 }) }).format(value);
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const tiles = document.querySelectorAll('.market-tile');
  const observations = [];
  let populated = 0;
  stripMarkets.forEach(([symbol, name], index) => {
    const tile = tiles[index];
    const price = tile?.querySelector('.market-price');
    const change = tile?.querySelector('.market-move');
    if (!tile || !price || !change) return;
    tile.dataset.tone = 'neutral';
    if (symbol === 'TOTAL') tile.hidden = true;
    price.textContent = '—';
    change.textContent = 'Unavailable';
    try {
      const market = markets.find(m => m && typeof m === 'object' && m.symbol === symbol && finite(m.price) && m.price > 0 && isFresh(timestamp(m.updated_at)));
      if (market) {
        const pct = finite(market.change_24h) ? market.change_24h : null;
        const move = finite(market.change) ? market.change : null;
        const trend = pct ?? move;
        const sign = trend > 0 ? '▲' : trend < 0 ? '▼' : '';
        const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}`;
        // Build strings before updating the tile, so formatting failures stay local.
        const formattedPrice = money(market.price, symbol === 'TOTAL');
        const formattedChange = [sign, move !== null ? signed(move) + money(Math.abs(move), symbol === 'TOTAL', market.price < 10) : '', pct !== null ? `${signed(pct)}${Math.abs(pct).toFixed(2)}%` : '24h unavailable'].filter(Boolean).join(' ');
        if (symbol === 'TOTAL') tile.hidden = false;
        price.textContent = formattedPrice;
        change.textContent = formattedChange;
        tile.dataset.tone = trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral';
        observations.push(timestamp(market.updated_at));
        populated++;
      }
    } catch {
      // A malformed asset or failed formatter must not clear other market tiles.
      price.textContent = '—';
      change.textContent = 'Unavailable';
      tile.dataset.tone = 'neutral';
      if (symbol === 'TOTAL') tile.hidden = true;
    }
    tile.setAttribute('aria-label', `${name}: ${price.textContent}; ${change.textContent}`);
  });
  const updated = document.getElementById('market-strip-updated');
  if (!updated) return;
  const observed = isFresh(received) ? received : Math.max(...observations);
  updated.textContent = populated ? `Kraken · updated ${new Date(observed).toLocaleTimeString('en-AU', { timeZone: 'Australia/Brisbane', hour: '2-digit', minute: '2-digit', second: '2-digit' })} Brisbane${populated < 4 ? ' · partial data' : ''}` : data && !isFresh(received) ? 'Market data stale or invalid · retrying every 60s' : message;
  updated.title = 'USD spot prices from the trading engine’s exchange. Total market cap unavailable until a market-wide source is connected.';
}
async function refreshMarketSummary() {
  let data;
  try { data = await getPublic('/api/market-summary'); }
  catch { renderMarketSummary(); return; }
  renderMarketSummary(data);
}
async function pollMarketSummary() {
  if (!document.hidden) await refreshMarketSummary();
  window.setTimeout(pollMarketSummary, 60000);
}
pollMarketSummary();
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshMarketSummary(); });
const number = value => (typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value)) ? Number(value) : null;
const display = value => typeof value === 'string' && value.trim() ? value : number(value) !== null ? String(value) : '—';
const score = value => number(value) !== null && number(value) >= 0 && number(value) <= 100 ? number(value).toFixed(1).replace(/\.0$/, '') : '—';
const leverage = value => number(value) !== null && number(value) >= 0 ? `${number(value).toFixed(2)}x` : '—';
const text = (tag, value, className) => { const el = document.createElement(tag); el.textContent = value; if (className) el.className = className; return el; };
const set = (id, value) => { document.getElementById(id).textContent = value; };
function metrics(rows) {
  const dl = document.createElement('dl');
  rows.forEach(([label, value]) => { const row = document.createElement('div'); row.append(text('dt', label), text('dd', value)); dl.append(row); });
  return dl;
}
function direction(asset) {
  if (asset.trade_allowed === false || asset.risk_gate === 'blocked') return 'SKIP';
  return asset.trade_allowed === true && ['LONG', 'SHORT'].includes(asset.direction) ? asset.direction : 'UNAVAILABLE';
}
function provenance(asset) {
  const source = display(asset.sentiment_source);
  return source === 'placeholder' ? 'Placeholder input · not live news' : source === 'manual' ? 'Manual input · not automated news' : `Sentiment source: ${source}`;
}
async function getPublic(path) {
  const response = await fetch(`${API_BASE}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Unavailable');
  const data = await response.json();
  if (!data || typeof data !== 'object' || data.ok === false) throw new Error('Invalid response');
  return data;
}
async function refreshRegime() {
  try {
    const data = await getPublic('/market-regime');
    if (!['bullish', 'neutral', 'bearish'].includes(data.market_regime?.toLowerCase())) throw new Error('Invalid regime');
    set('assessment-status', '');
    set('assessment-regime', data.market_regime.toUpperCase());
    set('input-regime', data.market_regime.toUpperCase());
    document.querySelector('[data-report=regime]').hidden = false;
    document.getElementById('assessment-regime').parentElement.hidden = false;
    set('assessment-conviction', score(data.average_confidence) === '—' ? '—' : `${score(data.average_confidence)} / 100`);
  } catch { document.querySelector('[data-report=regime]').hidden = true; document.getElementById('assessment-regime').parentElement.hidden = true; set('assessment-regime', '—'); set('input-regime', 'Unavailable'); set('assessment-conviction', '—'); set('assessment-status', 'Model assessment unavailable. Retrying automatically.'); }
}
const macroLabels = { rates: 'Treasury rates', usd: 'US dollar', equities: 'US equities', liquidity: 'Financial conditions', volatility: 'Market volatility', macro_events: 'Economic events' };
const macroSeries = { DGS2: '2Y yield', DGS10: '10Y yield', DTWEXBGS: 'Broad USD', SP500: 'S&P 500', NASDAQCOM: 'Nasdaq', NFCI: 'NFCI', WALCL: 'Fed assets', VIXCLS: 'VIX' };
const macroNumber = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
function brisbaneDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const fields = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}
function expectedMacroDate(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', hour: '2-digit', hourCycle: 'h23' }).format(now));
  return brisbaneDate(hour < 7 ? new Date(now.getTime() - 86400000) : now);
}
function macroValue(observation) {
  const value = observation.value;
  if (['DGS2', 'DGS10'].includes(observation.series_id)) return `${value.toFixed(2)}%`;
  if (observation.series_id === 'WALCL') return `$${(value / 1000000).toFixed(2)}T`;
  return value.toLocaleString('en-US', { maximumFractionDigits: observation.series_id === 'NFCI' ? 3 : 2 });
}
function renderMacro(report = null, reason = 'Daily macro report unavailable. Retrying automatically.') {
  const available = report && macroNumber(report.macro_score);
  set('macro-score', available ? score(report.macro_score) : '—');
  set('macro-regime', available ? report.macro_regime : 'Macro assessment unavailable');
  const previousDay = report && report.report_date !== brisbaneDate();
  set('macro-state', report ? previousDay ? 'Previous day · valid until 7 am' : 'Saved daily snapshot' : 'Report unavailable');
  document.getElementById('macro-state').dataset.state = available ? 'available' : 'unavailable';
  document.getElementById('macro-fill').style.width = available ? `${report.macro_score}%` : '0%';
  set('macro-confidence', report && macroNumber(report.confidence) ? `${score(report.confidence)} / 100` : '—');
  const coverage = report?.scoring?.coverage;
  set('macro-coverage', typeof coverage === 'number' && Number.isFinite(coverage) && coverage >= 0 && coverage <= 1 ? `${Math.round(coverage * 100)}% of weighted inputs` : '—');
  let summary = reason;
  if (report) {
    const off = Object.entries(macroLabels).filter(([key]) => macroNumber(report.components[key]?.score) && report.components[key].score < 40).map(([, label]) => label.toLowerCase());
    const on = Object.entries(macroLabels).filter(([key]) => macroNumber(report.components[key]?.score) && report.components[key].score >= 60).map(([, label]) => label.toLowerCase());
    summary = available ? 'Base macro model: ' + report.macro_regime + '.' : 'No reliable macro inputs are available for this snapshot.';
    if (off.length) summary += ` Headwinds: ${off.join(', ')}.`;
    if (on.length) summary += ` Support: ${on.join(', ')}.`;
    if (previousDay) summary += ' Previous day’s scheduled report remains current until 7 am Brisbane.';
  }
  set('macro-summary', summary);
  const cards = Object.entries(macroLabels).map(([key, label]) => {
    const component = report?.components?.[key];
    const valid = component && macroNumber(component.score);
    const card = text('article', '', 'macro-component');
    card.dataset.tone = !valid ? 'unavailable' : component.score < 40 ? 'off' : component.score >= 60 ? 'on' : 'mixed';
    const heading = text('div', '', 'macro-component-top');
    const reading = text('span', valid ? score(component.score) : '—', 'macro-component-score');
    if (valid) reading.append(text('small', ' / 100'));
    heading.append(text('h3', label), reading);
    card.append(heading, text('p', valid ? component.status : 'Awaiting data'));
    if (!valid) reading.hidden = true;
    const observations = (Array.isArray(component?.provenance?.observations) ? component.provenance.observations : []).filter(o => o && Object.hasOwn(macroSeries, o.series_id) && typeof o.value === 'number' && Number.isFinite(o.value) && /^\d{4}-\d{2}-\d{2}$/.test(o.observation_date)).slice(0, 8);
    if (observations.length) {
      card.append(text('p', observations.slice(0, 2).map(o => `${macroSeries[o.series_id]} ${macroValue(o)}${o.fresh === false ? ' (stale)' : ''}`).join(' · ')));
      const details = text('details', '');
      details.append(text('summary', 'Dates & sources'));
      observations.forEach(o => {
        const row = text('span', '', 'macro-observation');
        const link = text('a', o.series_id);
        link.href = `https://fred.stlouisfed.org/series/${encodeURIComponent(o.series_id)}`;
        link.target = '_blank'; link.rel = 'noopener';
        row.append(link, document.createTextNode(` · ${o.value.toLocaleString('en-US', { maximumFractionDigits: 4 })} · observed ${o.observation_date}${o.fresh === false ? ' · stale, excluded' : ''}`));
        details.append(row);
      });
      card.append(details);
    }
    return card;
  });
  document.getElementById('macro-components').replaceChildren(...cards);
  if (report) {
    const generated = new Date(report.generated_at).toLocaleTimeString('en-AU', { timeZone: 'Australia/Brisbane', hour: '2-digit', minute: '2-digit' });
    set('macro-updated', `${report.report_date} · generated ${generated} Brisbane · source: FRED · next daily snapshot at 7 am`);
  } else set('macro-updated', 'Daily snapshot · scheduled for 7 am Brisbane');
}
async function refreshMacro() {
  try {
    const expectedDay = expectedMacroDate();
    const report = await getPublic(expectedDay === brisbaneDate() ? '/api/reports/macro/today' : `/api/reports/macro/${expectedDay}`);
    if (report.report_type !== 'macro_base' || report.timezone !== 'Australia/Brisbane' || !report.components ||
        !Object.keys(macroLabels).every(key => report.components[key] && typeof report.components[key] === 'object') ||
        typeof report.generated_at !== 'string' || !Number.isFinite(Date.parse(report.generated_at)) ||
        (report.macro_score !== null && !macroNumber(report.macro_score)) || typeof report.macro_regime !== 'string') throw new Error('Invalid macro report');
    if (report.report_date !== expectedMacroDate() || brisbaneDate(new Date(report.generated_at)) !== report.report_date || Date.parse(report.generated_at) > Date.now()) {
      renderMacro(null, 'The macro snapshot is not dated for the current 7 am Brisbane reporting cycle. Waiting for the scheduled daily report.');
      return;
    }
    renderMacro(report);
  } catch { renderMacro(); }
}
renderMacro(null, 'Loading the saved daily macro report…');
async function refresh() {
  if (!document.hidden) await Promise.allSettled([refreshRegime(), refreshMacro()]);
  window.setTimeout(refresh, 30000);
}
refresh();

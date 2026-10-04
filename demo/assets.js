'use strict';
// Relocated homepage renderer. Scores and exchange prices remain independent inputs.
(() => {
const API_BASE = 'https://api.rrr.trading';
// Hide a repeated settlement currency in labels; keep feed identifiers intact.
const pairLabel = pair => typeof pair === 'string' ? pair.replace(/^([A-Z0-9]+\/([A-Z0-9]+)):\2$/, '$1') : pair ?? '—';
const number = value => (typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value)) ? Number(value) : null;
const score = value => number(value) !== null && number(value) >= 0 && number(value) <= 100 ? number(value).toFixed(1).replace(/\.0$/, '') : '—';
const text = (tag, value, className) => { const el = document.createElement(tag); el.textContent = value; if (className) el.className = className; return el; };
function metrics(rows) {
  const dl = document.createElement('dl');
  rows.forEach(([label, value]) => { const row = document.createElement('div'); row.append(text('dt', label), text('dd', value)); dl.append(row); });
  return dl;
}
async function getPublic(path) {
  const response = await fetch(`${API_BASE}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Unavailable');
  const data = await response.json();
  if (!data || typeof data !== 'object' || data.ok === false) throw new Error('Invalid response');
  return data;
}
let modelAssets = [], marketData = null, botPairs = null, universeNote = 'Awaiting bot asset universe.';
function marketReading(symbol) {
  const fresh = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.now() - Date.parse(value) <= 120000 && Date.parse(value) <= Date.now() + 30000;
  const market = marketData?.currency === 'USD' && Array.isArray(marketData.markets) ? marketData.markets.find(m => m?.symbol === symbol) : null;
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  if (!market || !finite(market.price) || market.price <= 0 || !fresh(market.updated_at)) return {price:'Unavailable', move:'Unavailable', date:market?.updated_at ? 'Stale or invalid market data' : 'Market data unavailable'};
  const money = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',minimumFractionDigits:market.price < 10 ? 4 : 2,maximumFractionDigits:market.price < 10 ? 4 : 2});
  const signed = v => v > 0 ? '+' : v < 0 ? '−' : '';
  const move = [finite(market.change) ? signed(market.change) + money.format(Math.abs(market.change)) : '', finite(market.change_24h) ? `${signed(market.change_24h)}${Math.abs(market.change_24h).toFixed(2)}%` : '24h unavailable'].filter(Boolean).join(' · ');
  return {price:money.format(market.price), move, date:`Kraken · observed ${new Date(market.updated_at).toLocaleString('en-AU', {timeZone:'Australia/Brisbane'})} Brisbane`};
}
// Historical display names only; the selected bot supplies card membership.
const researchAssets = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'LINK', name: 'Chainlink' },
  { symbol: 'ONDO', name: 'Ondo' },
  { symbol: 'AAVE', name: 'Aave' },
  { symbol: 'UNI', name: 'Uniswap' },
  { symbol: 'HYPE', name: 'Hyperliquid' },
  { symbol: 'INJ', name: 'Injective' }
];
function renderAssetAnalysis(assets = []) {
  if (!document.getElementById('asset-cards')) return;
  if (!Array.isArray(botPairs)) {
    document.getElementById('asset-cards').replaceChildren(text('p', universeNote, 'sub'));
    return;
  }
  const cards = botPairs.map(pair => {
    const symbol = pair.split(/[\/-]/)[0];
    const name = researchAssets.find(a => a.symbol === symbol)?.name;
    const asset = assets.find(a => [ `${symbol}-USDT`, `${symbol}-USD`, `${symbol}/USD`, `${symbol}/USDT`, `${symbol}/USDT:USDT` ].includes(a.pair));
    let market;
    try { market = marketReading(symbol); } catch { market = {price:'Unavailable',move:'Unavailable',date:'Market data unavailable'}; }
    const card = text('article', '', 'market-card asset-card');
    card.dataset.asset = symbol;
    card.dataset.pair = pair;
    card.append(text('h3', name ? `${symbol} — ${name}` : symbol), text('span', pairLabel(pair), 'data-note'));
    const rows = [
      ['price', 'Current price', market.price],
      ['daily-move', 'Daily move', market.move],
      ['trend', 'Trend score', asset && score(asset.trend_score) !== '—' ? `${score(asset.trend_score)} / 100` : 'Awaiting analysis'],
      ['momentum', 'Momentum', 'Awaiting analysis'],
      ['volume', 'Volume', 'Awaiting analysis'],
      ['volatility', 'Volatility', 'Awaiting analysis'],
      ['relative-strength', 'Relative strength', 'Awaiting analysis'],
      ['conviction', 'Asset conviction', asset && score(asset.confidence) !== '—' ? `${score(asset.confidence)} / 100` : 'Awaiting analysis']
    ];
    const dl = metrics(rows.map(([, label, value]) => [label, value]));
    [...dl.children].forEach((row, i) => { row.querySelector('dd').dataset.field = rows[i][0]; });
    card.append(dl, text('p', asset ? 'API model scores · may include placeholder/manual inputs. Independent of bot trading decisions.' : 'Awaiting asset report.'));
    card.append(text('span', market.date, 'data-note market-observed'));
    if (!asset) card.append(text('span', 'Analysis pending', 'data-note'));
    return card;
  });
  document.getElementById('asset-cards').replaceChildren(...(cards.length ? cards : [text('p', 'No configured assets supplied by this bot.', 'sub')]));
}
// Membership and ordering come only from the selected bot's validated status feed.
window.renderDemoAssets = (pairs, note = 'Bot asset universe unavailable.') => {
  botPairs = Array.isArray(pairs) && pairs.every(p => typeof p === 'string' && p.trim()) ? [...new Set(pairs)] : null;
  universeNote = note;
  renderAssetAnalysis(modelAssets);
};
renderAssetAnalysis();
async function refreshScores() {
  if (!document.getElementById('asset-cards')) return;
  try {
    const data = await getPublic('/score');
    if (!Array.isArray(data.assets)) throw new Error('Invalid scores');
    const assets = data.assets.filter(a => a && typeof a.pair === 'string');
    modelAssets = assets;
    renderAssetAnalysis(modelAssets);
  } catch {
    modelAssets = [];
    renderAssetAnalysis(modelAssets);
  }
}


async function refreshAssetMarkets() {
  if (!document.getElementById('asset-cards')) return;
  try { marketData = await getPublic('/api/market-summary'); } catch { marketData = null; }
  renderAssetAnalysis(modelAssets);
}
function brisbaneDate(now = new Date()) {
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p => [p.type,p.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}
function renderDemoMacro(report = null, reason = 'Awaiting macro data') {
  const valid = report && typeof report.macro_score === 'number' && score(report.macro_score) !== '—';
  document.getElementById('demo-macro-score').textContent = valid ? `${score(report.macro_score)} / 100` : 'N/A';
  document.getElementById('demo-macro-regime').textContent = valid ? report.macro_regime : reason;
  document.getElementById('demo-macro-date').textContent = report ? `Saved daily report · ${report.report_date} · generated ${new Date(report.generated_at).toLocaleString('en-AU', {timeZone:'Australia/Brisbane'})} Brisbane` : 'Daily snapshot · scheduled for 7 am Brisbane';
}
async function refreshDemoMacro() {
  if (!document.getElementById('demo-macro-score')) return;
  try {
    const report = await getPublic('/api/reports/macro/today');
    if (report.report_type !== 'macro_base' || report.timezone !== 'Australia/Brisbane' || typeof report.macro_regime !== 'string' || !report.macro_regime.trim() || !Number.isFinite(Date.parse(report.generated_at)) || (report.macro_score !== null && (typeof report.macro_score !== 'number' || score(report.macro_score) === '—'))) throw new Error('Invalid report');
    if (report.report_date !== brisbaneDate() || brisbaneDate(new Date(report.generated_at)) !== report.report_date) {
      renderDemoMacro(null, 'Stale macro report · awaiting today’s data');
      return;
    }
    renderDemoMacro(report);
  } catch { renderDemoMacro(); }
}
async function refreshAnalysis() {
  if (!document.hidden) await Promise.allSettled([refreshScores(), refreshDemoMacro()]);
  window.setTimeout(refreshAnalysis, 30000);
}
async function refreshMarkets() {
  if (!document.hidden) await refreshAssetMarkets();
  window.setTimeout(refreshMarkets, 60000);
}
refreshAnalysis();
refreshMarkets();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshScores(); refreshDemoMacro(); refreshAssetMarkets(); } });
})();

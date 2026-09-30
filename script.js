'use strict';
// Progressive enhancement for navigation, radio and public research data.
async function loadDailyReport() {
  try {
    const response = await fetch('data/daily-crypto-report.html', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Report unavailable');
    // Only the repository-controlled report fragment is loaded. Never insert API strings as HTML.
    const documentFragment = new DOMParser().parseFromString(await response.text(), 'text/html');
    const report = documentFragment.querySelector('[data-report-date]');
    if (!report || !report.querySelector('section')) throw new Error('Invalid report');
    document.querySelector('#daily-report').replaceChildren(document.importNode(report, true));
    document.querySelector('#report-date').textContent = report.dataset.reportDate;
    document.querySelector('#report-captured').textContent = report.dataset.reportCaptured || '';
    document.querySelector('#report-kind').textContent = report.dataset.reportKind === 'sample' ? 'REPORT TEMPLATE' : 'PUBLISHED BRIEFING';
  } catch {
    document.querySelector('#report-status').textContent = 'The latest report could not be loaded. Showing the embedded report template.';
  }
}
loadDailyReport();

// Public read-only state. Each endpoint fails independently; no trading actions.
const API_BASE = 'https://api.rrr.trading';
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
// Stable asset definitions and data-field hooks keep future report adapters local.
const researchAssets = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' }
];
function renderAssetAnalysis(assets = []) {
  const cards = researchAssets.map(({ symbol, name }) => {
    const asset = assets.find(a => a.pair === `${symbol}-USDT`);
    const card = text('article', '', 'market-card asset-card');
    card.dataset.asset = symbol;
    card.append(text('h3', `${symbol} — ${name}`));
    const rows = [
      ['price', 'Current price', 'Awaiting analysis'],
      ['daily-move', 'Daily move', 'Awaiting analysis'],
      ['trend', 'Trend score', asset && score(asset.trend_score) !== '—' ? `${score(asset.trend_score)} / 100` : 'Awaiting analysis'],
      ['momentum', 'Momentum', 'Awaiting analysis'],
      ['volume', 'Volume', 'Awaiting analysis'],
      ['volatility', 'Volatility', 'Awaiting analysis'],
      ['relative-strength', 'Relative strength', 'Awaiting analysis'],
      ['conviction', 'Asset conviction', asset && score(asset.confidence) !== '—' ? `${score(asset.confidence)} / 100` : 'Awaiting analysis']
    ];
    const dl = metrics(rows.map(([, label, value]) => [label, value]));
    [...dl.children].forEach((row, i) => { row.querySelector('dd').dataset.field = rows[i][0]; });
    card.append(dl, text('p', asset ? 'API model scores · may include placeholder/manual inputs.' : 'Awaiting asset report.'));
    if (!asset) card.append(text('span', 'Analysis pending', 'data-note'));
    return card;
  });
  document.getElementById('asset-cards').replaceChildren(...cards);
}
renderAssetAnalysis();
async function refreshScores() {
  try {
    const data = await getPublic('/score');
    if (!Array.isArray(data.assets)) throw new Error('Invalid scores');
    const assets = data.assets.filter(a => a && typeof a.pair === 'string');
    renderAssetAnalysis(assets);
  } catch {
    renderAssetAnalysis();
  }
}

async function refreshRegime() {
  try {
    const data = await getPublic('/market-regime');
    if (!['bullish', 'neutral', 'bearish'].includes(data.market_regime?.toLowerCase())) throw new Error('Invalid regime');
    set('assessment-regime', data.market_regime.toUpperCase());
    set('input-regime', `${data.market_regime.toUpperCase()} · API model`);
    set('assessment-conviction', score(data.average_confidence) === '—' ? 'Awaiting analysis' : `${score(data.average_confidence)} / 100 · model average`);
  } catch { set('assessment-regime', 'Awaiting analysis'); set('input-regime', 'Awaiting daily report'); set('assessment-conviction', 'Awaiting analysis'); }
}
function amount(value, currency) {
  return number(value) === null ? '—' : `${number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}${typeof currency === 'string' ? ` ${currency}` : ''}`;
}
async function refreshStatus() {
  try {
    const data = await getPublic('/status');
    if (!data.bot || !data.portfolio) throw new Error('Invalid status');
    const b = data.bot, p = data.portfolio;
    const wins = number(p.winning_trades), losses = number(p.losing_trades);
    const rate = wins !== null && losses !== null && wins >= 0 && losses >= 0 && wins + losses > 0 ? `${(wins / (wins + losses) * 100).toFixed(1)}% (${wins + losses} closed)` : '— · awaiting completed trades';
    document.getElementById('bot-metrics').replaceChildren(...metrics([
      ['Mode', display(b.mode)], ['Bot state', display(b.state)], ['Starting balance', amount(p.starting_balance, b.stake_currency)], ['Realised P/L', amount(p.profit_all_abs, b.stake_currency)], ['Open positions / maximum', `${display(p.open_positions)} / ${display(p.max_open_positions ?? b.max_open_trades)}`], ['Win rate', rate], ['Strategy', display(b.strategy)], ['Exchange', display(b.exchange)], ['Timeframe', display(b.timeframe)]
    ]).children);
    set('bot-status', `Status API checked ${new Date().toLocaleTimeString()}`);
  } catch { document.getElementById('bot-metrics').replaceChildren(...metrics([['Configuration and performance', 'Unavailable']]).children); set('bot-status', 'Trading status unavailable. Retrying automatically.'); }
}
async function refresh() {
  if (!document.hidden) await Promise.allSettled([refreshScores(), refreshRegime(), refreshStatus()]);
  window.setTimeout(refresh, 30000);
}
refresh();

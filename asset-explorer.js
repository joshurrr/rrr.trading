'use strict';
// Read-only view of the latest saved V4 paper-cycle discovery and research evidence.
(() => {
  const API = 'https://v4.rrr.trading', $ = id => document.getElementById('explorer-' + id);
  const symbolOK = s => typeof s === 'string' && /^[A-Z0-9]{1,30}USDT$/.test(s);
  const stamp = s => typeof s === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(s) ? Date.parse(s) : NaN;
  const at = s => Number.isFinite(stamp(s)) ? new Date(s).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', dateStyle: 'medium', timeStyle: 'short' }) + ' Brisbane' : 'Unavailable';
  const node = (tag, text, cls) => { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; };
  let source = null, rows = [], busy = false, limit = 35, loaded = false;
  async function get() {
    const response = await fetch(API + '/v4/paper', { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error('V4 paper read API unavailable');
    return response.json();
  }
  function validCatalogue(c) {
    return c && ['CURRENT', 'STALE'].includes(c.state) && Number.isFinite(stamp(c.observed_at))
      && Array.isArray(c.assets) && c.assets.length <= 100
      && Number.isInteger(c.pool_asset_count) && c.pool_asset_count === c.assets.length
      && Number.isInteger(c.assessed_count) && c.assessed_count >= 0 && c.assessed_count <= c.pool_asset_count
      && Number.isInteger(c.eligible_count) && c.eligible_count >= c.pool_asset_count
      && c.assets.every(a => symbolOK(a?.symbol) && a.pair === a.symbol + '/USDT:USDT'
        && typeof a.technically_assessed === 'boolean')
      && new Set(c.assets.map(a => a.symbol)).size === c.assets.length;
  }
  function rankingFor(row) {
    const ranks = Object.entries(row.rankings || {}).filter(([, r]) => Number.isInteger(r?.rank) && r.rank > 0)
      .sort((a, b) => a[1].rank - b[1].rank || a[0].localeCompare(b[0]));
    return ranks.length ? ranks[0] : null;
  }
  function model() {
    const c = source?.overview?.research?.catalogue;
    if (!validCatalogue(c)) { rows = []; $('status').textContent = c?.availability === 'UNAVAILABLE' || c?.state === 'UNAVAILABLE'
      ? 'V4 asset catalogue unavailable: ' + (c.reasons?.join(', ') || 'saved discovery evidence is missing or invalid.')
      : 'V4 asset catalogue unavailable. Refresh to check the saved paper-cycle evidence.'; return null; }
    rows = c.assets.map(a => ({ ...a, rank: rankingFor(a), eligible: true }));
    $('universe').disabled = false; $('pool').disabled = true;
    const exclusions = Object.entries(c.excluded_counts || {}).filter(([, n]) => n > 0).map(([reason, count]) => `${reason.replaceAll('_', ' ')}: ${count}`);
    $('status').textContent = `${c.pool_asset_count} assets in the saved liquidity pool · ${c.assessed_count} technically assessed · ${c.eligible_count} eligible across the screened universe.`
      + (exclusions.length ? ` Discovery exclusions (aggregate counts): ${exclusions.join('; ')}.` : ' No discovery exclusion counts were recorded.');
    $('snapshot').textContent = `Last successful universe assessment: ${at(c.observed_at)} · ${c.state}. Source: saved V4.1 paper cycle.`;
    return c;
  }
  function render() {
    const c = model();
    const query = $('search').value.trim().toLowerCase(), assessed = $('universe').value, eligibility = $('pool').value, order = $('sort').value;
    const results = rows.filter(r => `${r.symbol} ${r.asset || ''}`.toLowerCase().includes(query)
      && (assessed === 'all' || (assessed === 'assessed' ? r.technically_assessed : assessed === 'excluded' ? r.ranking_excluded_reasons.length > 0 : !r.technically_assessed))
      && eligibility === 'all');
    results.sort((a, b) => {
      if (order === 'alpha') return a.symbol.localeCompare(b.symbol);
      const ar = a.rank?.[1]?.rank, br = b.rank?.[1]?.rank;
      if (ar !== undefined || br !== undefined) {
        if (ar === undefined) return 1; if (br === undefined) return -1;
        if (ar !== br) return (ar - br) * (order === 'low' ? -1 : 1);
      }
      return a.symbol.localeCompare(b.symbol);
    });
    $('count').textContent = c ? `${results.length} matching / ${rows.length} pool assets · showing ${Math.min(limit, results.length)} · ${c.eligible_count} eligible universe-wide` : 'Asset count unavailable';
    const host = document.getElementById('universe-assets');
    window.CandidateCards.reconcile(host, results.slice(0, limit).map(row => {
      const ranked = row.rank, name = row.asset || row.symbol;
      const rankingText = ranked ? `Saved ${ranked[0]} research rank #${ranked[1].rank}${ranked[1].timeframe ? ` (${ranked[1].timeframe})` : ''}; return ${typeof ranked[1].return_pct === 'number' ? ranked[1].return_pct + '%' : 'unavailable'}.` : 'No saved LONG/SHORT ranking is available for this asset.';
      return { symbol: row.symbol, asset: row, options: {
        allowed: false, current: c?.state === 'CURRENT', rank: ranked?.[1]?.rank,
        rankLabel: row.ranking_excluded_reasons.length ? 'EXCLUDED' : ranked ? `${ranked[0]} #${ranked[1].rank}` : row.technically_assessed ? 'ASSESSED' : 'ELIGIBLE',
        evidenceLabel: 'V4.1 saved evidence',
        reason: `${name} · ${row.ranking_excluded_reasons.length ? 'Excluded from saved rankings: ' + row.ranking_excluded_reasons.join(', ') + '. ' : ''}${rankingText} Opportunity score is not supplied by V4.1. Eligibility here means present in the saved eligible discovery pool; it does not mean entry approval.`,
        entryState: `${row.technically_assessed ? 'Technically assessed in this cycle.' : 'Not technically assessed in this cycle.'} Eligible discovery asset. Assessment: ${at(c?.observed_at)}. Trading approval and execution status are not implied.`
      } };
    }), { showEvidence: true });
    host.querySelectorAll('.candidate-score-label').forEach(e => { e.textContent = 'Opportunity score unavailable'; });
    host.querySelectorAll('.candidate-direction').forEach(e => { e.hidden = true; });
    if (!results.length) host.append(node('p', c ? rows.length ? 'No assets match these filters. Try another search or clear filters.' : 'The saved cycle contains zero eligible pool assets.' : 'Saved V4 asset data is unavailable. Please retry.', 'muted'));
    $('more').hidden = limit >= results.length;
  }
  async function refresh() {
    if (busy) return;
    busy = true; $('refresh').disabled = true; $('count').textContent = 'Loading V4.1 saved assets…'; $('results').setAttribute('aria-busy', 'true');
    try { source = await get(); }
    catch { source = null; }
    busy = false; loaded = true; $('refresh').disabled = false; $('results').setAttribute('aria-busy', 'false'); render();
  }
  for (const id of ['search', 'universe', 'pool', 'sort']) $(id).addEventListener(id === 'search' ? 'input' : 'change', () => { limit = 35; if (loaded) render(); });
  $('clear').addEventListener('click', () => { $('search').value = ''; $('universe').value = 'all'; $('pool').value = 'all'; $('sort').value = 'high'; limit = 35; if (loaded) render(); $('search').focus(); });
  $('refresh').addEventListener('click', refresh);
  $('more').addEventListener('click', () => { limit += 35; render(); });
  refresh();
})();

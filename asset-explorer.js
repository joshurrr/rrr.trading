'use strict';
// Browser-only discovery over saved GET responses. No evaluation or trading calls.
(() => {
  const API = 'https://api.rrr.trading', $ = id => document.getElementById('explorer-' + id);
  const symbolOK = s => typeof s === 'string' && /^[A-Z0-9]{1,20}$/.test(s);
  const validScore = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;
  const stamp = s => typeof s === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(s) ? Date.parse(s) : NaN;
  const at = s => Number.isFinite(stamp(s)) ? new Date(s).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', dateStyle: 'medium', timeStyle: 'short' }) + ' Brisbane' : 'Unavailable';
  const node = (tag, text, cls) => { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; };
  const saved = (p, key) => p && ['ok', 'stale'].includes(p.status) && typeof p.universe_version === 'string' && Number.isFinite(stamp(p.generated_at)) && stamp(p.generated_at) <= Date.now() + 30000 && Array.isArray(p[key]) && p[key].length > 0 && p[key].length <= 10000 && p[key].every(a => symbolOK(a?.symbol) && a.pair === a.symbol + '/USDT:USDT') && new Set(p[key].map(a => a.symbol)).size === p[key].length;
  let sources = {}, rows = [], busy = false, limit = 35, loaded = false;
  async function get(path) {
    const response = await fetch(API + path, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error('Source unavailable');
    return response.json();
  }
  async function registry() {
    const assets = []; let total;
    for (let offset = 0; offset < 10000; offset += 500) {
      const p = await get(`/api/v2/intelligence/assets?limit=500&offset=${offset}`);
      if (!Number.isInteger(p.total) || p.total < 0 || p.total > 10000 || !Array.isArray(p.assets) || p.assets.some(a => !symbolOK(a?.symbol)) || (total !== undefined && total !== p.total)) throw Error('Registry incomplete');
      total = p.total; assets.push(...p.assets);
      if (assets.length >= total) {
        if (assets.length !== total || new Set(assets.map(a => a.symbol)).size !== total) throw Error('Registry inconsistent');
        return assets;
      }
      if (p.assets.length !== 500) throw Error('Registry incomplete');
    }
    throw Error('Registry too large');
  }
  function model() {
    const u = saved(sources.universe, 'assets') && sources.universe.assets.length === 10 ? sources.universe : null;
    const c = saved(sources.candidates, 'candidates') ? sources.candidates : null;
    const matched = u && c && u.universe_version === c.universe_version && u.generated_at === c.generated_at;
    const freshUniverse = u && u.status === 'ok' && stamp(u.valid_until) > Date.now() && stamp(u.valid_until) > stamp(u.generated_at);
    const map = new Map((sources.registry || []).map(a => [a.symbol, { symbol: a.symbol, name: typeof a.name === 'string' ? a.name : '', asset: null, source: null }]));
    if (c) for (const asset of c.candidates) map.set(asset.symbol, { ...map.get(asset.symbol), symbol: asset.symbol, asset, source: c, fresh: !!(matched && freshUniverse && c.status === 'ok') });
    if (u) for (const asset of u.assets) map.set(asset.symbol, { ...map.get(asset.symbol), symbol: asset.symbol, asset, source: u, fresh: !!freshUniverse });
    const selected = new Set(u?.assets.map(a => a.symbol));
    rows = [...map.values()].map(row => ({ ...row, membership: freshUniverse ? selected.has(row.symbol) ? 'top' : 'outside' : 'unknown', pool: row.fresh && typeof row.asset?.approved_for_new_entries === 'boolean' ? row.asset.approved_for_new_entries ? 'eligible' : 'blocked' : 'unknown' }));
    $('universe').disabled = !freshUniverse;
    if (!freshUniverse) $('universe').value = 'all';
    $('pool').disabled = !rows.some(r => r.pool !== 'unknown');
    if ($('pool').disabled) $('pool').value = 'all';
    const scored = rows.filter(r => validScore(r.asset?.opportunity_score)).length;
    const notes = [];
    if (!sources.registry) notes.push('Registry unavailable; catalogue coverage is partial.');
    if (!c) notes.push('Broader candidate feed unavailable; wider opportunity scores cannot be verified.');
    if (matched && Number.isInteger(u.eligible_market_count) && c.candidates.length !== u.eligible_market_count) notes.push('The candidate feed covers only part of the reported screened pool.');
    if (!freshUniverse) notes.push('Current Top 10 membership and pool eligibility cannot be verified.');
    if (c && !matched) notes.push('Candidate and Top 10 snapshots differ; candidate freshness is unknown.');
    $('coverage').textContent = rows.length ? `${rows.length} available assets · ${scored} with saved opportunity scores · ${rows.length - scored} without a pool score. ${notes.join(' ')}` : Array.isArray(sources.registry) ? '0 registered assets returned; no saved pool assessments available.' : 'Asset data unavailable. Retry to check the saved feeds.';
    $('snapshot').textContent = c ? `Candidate assessment: ${at(c.generated_at)} · ${matched && freshUniverse && c.status === 'ok' ? 'FRESH' : matched ? 'STALE / EXPIRED' : 'VALIDITY UNKNOWN'}. Version: ${c.universe_version}.` : u ? `Top 10 assessment only: ${at(u.generated_at)}.` : 'Assessment timestamp unavailable.';
  }
  function render() {
    model();
    const query = $('search').value.trim().toLowerCase(), membership = $('universe').value, pool = $('pool').value, order = $('sort').value;
    const results = rows.filter(r => `${r.symbol} ${r.name || ''}`.toLowerCase().includes(query) && (membership === 'all' || membership === r.membership) && (pool === 'all' || pool === r.pool));
    results.sort((a, b) => {
      if (order === 'alpha') return a.symbol.localeCompare(b.symbol);
      const av = validScore(a.asset?.opportunity_score), bv = validScore(b.asset?.opportunity_score);
      if (av !== bv) return av ? -1 : 1;
      return (av ? (a.asset.opportunity_score - b.asset.opportunity_score) * (order === 'low' ? 1 : -1) : 0) || a.symbol.localeCompare(b.symbol);
    });
    $('count').textContent = !rows.length && !Array.isArray(sources.registry) ? 'Asset count unavailable' : `${results.length} matching / ${rows.length} available · showing ${Math.min(limit, results.length)}`;
    const host = document.getElementById('universe-assets');
    window.CandidateCards.reconcile(host, results.slice(0, limit).map(row => {
      const scored = validScore(row.asset?.opportunity_score);
      const matched = sources.universe?.universe_version === row.source?.universe_version && sources.universe?.generated_at === row.source?.generated_at;
      const state = !row.source ? 'No pool assessment' : row.fresh ? 'FRESH' : matched ? 'STALE / EXPIRED' : 'VALIDITY UNKNOWN';
      const membershipText = row.membership === 'top' ? 'Current Top 10' : row.membership === 'outside' ? 'Outside current Top 10' : 'Top 10 membership unknown';
      return { symbol: row.symbol, asset: row.asset, options: {
        current: row.fresh === true, rankLabel: row.membership === 'top' ? 'TOP 10' : row.source ? 'POOL' : 'REGISTRY',
        evidenceLabel: `${state} · Evidence`,
        reason: row.asset?.reason || 'No opportunity score is available in the saved pool for this registered asset. Open asset intelligence for any existing historical assessments.',
        entryState: `${row.name || row.symbol} · ${membershipText}. ${scored ? 'Universe opportunity score (0–100); no timeframe aggregation.' : 'Opportunity score unavailable.'} Assessed: ${at(row.source?.generated_at)}. ${row.fresh ? 'Valid until: ' + at(sources.universe?.valid_until) + '.' : 'Saved / unverified evidence is not a current signal.'} Pool eligibility: ${row.pool}. Top 10 membership and pool eligibility are not bot entry approval.`
      } };
    }), { showEvidence: true });
    if (!results.length) host.append(node('p', rows.length ? 'No assets match these filters. Try another search or clear filters.' : Array.isArray(sources.registry) ? 'No assets available in the saved feeds.' : 'Saved asset data is unavailable. Please retry.', 'muted'));
    $('more').hidden = limit >= results.length;
  }
  async function refresh() {
    if (busy) return;
    busy = true; $('refresh').disabled = true; $('count').textContent = 'Loading saved assets…'; $('results').setAttribute('aria-busy', 'true');
    const values = await Promise.allSettled([get('/api/trading-universe'), get('/api/trading-universe/candidates'), registry()]);
    sources = Object.fromEntries(['universe', 'candidates', 'registry'].map((key, i) => [key, values[i].status === 'fulfilled' ? values[i].value : null]));
    busy = false; loaded = true; $('refresh').disabled = false; $('results').setAttribute('aria-busy', 'false'); render();
    window.SiteHeader?.renderAssets(sources.universe); window.parent.SiteNavigation?.renderAssets(sources.universe);
  }
  for (const id of ['search', 'universe', 'pool', 'sort']) $(id).addEventListener(id === 'search' ? 'input' : 'change', () => { limit = 35; if (loaded) render(); });
  $('clear').addEventListener('click', () => { $('search').value = ''; $('universe').value = $('pool').value = 'all'; $('sort').value = 'high'; limit = 35; if (loaded) render(); $('search').focus(); });
  $('refresh').addEventListener('click', refresh);
  $('more').addEventListener('click', () => { limit += 35; render(); });
  // Expire displayed evidence locally without adding any polling requests.
  setInterval(() => { if (loaded && !busy && !document.hidden) render(); }, 30000);
  refresh();
})();

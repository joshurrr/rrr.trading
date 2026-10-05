'use strict';
(() => {
  const names = { short: '15 min Short Term', medium: '1 hour Medium Term', long: '4 hour Long Term' };
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const score = v => finite(v) && v >= 0 && v <= 100 ? v.toFixed(1).replace(/\.0$/, '') : 'Unavailable';
  const percent = v => finite(v) && v >= 0 && v <= 1 ? `${Math.round(v * 100)}%` : 'Unavailable';
  const el = (tag, content, cls) => { const node = document.createElement(tag); node.textContent = content; if (cls) node.className = cls; return node; };
  const at = value => { const date = new Date(value); return value && Number.isFinite(date.getTime()) ? date.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', dateStyle: 'medium', timeStyle: 'short' }) + ' Brisbane' : 'Unavailable'; };
  let busy = false;
  function render(data) {
    const status = document.getElementById('universe-status');
    const grid = document.getElementById('universe-assets');
    const sync = document.getElementById('universe-sync');
    const assets = data?.assets;
    const generated = Date.parse(data?.generated_at), expires = Date.parse(data?.valid_until);
    const valid = data?.schema_version === 1 && ['ok', 'stale'].includes(data.status) && typeof data.universe_version === 'string' && Number.isFinite(generated) && generated <= Date.now() + 30000 && Number.isFinite(expires) && expires > generated && Array.isArray(assets) && assets.length === 10 && new Set(assets.map(a => a?.pair)).size === 10 && assets.every((a, i) => a?.rank === i + 1 && /^[A-Z0-9]{1,20}$/.test(a.symbol) && a.pair === a.symbol + '/USDT:USDT' && finite(a.opportunity_score) && a.opportunity_score >= 0 && a.opportunity_score <= 100 && typeof a.reason === 'string');
    const stale = valid && (data.status === 'stale' || Date.now() > expires);
    const eligible = valid && Date.now() <= expires && data.entry_eligible === true;
    document.getElementById('intelligence-universe').textContent = eligible ? '10 assets approved for bot entry checks' : valid ? 'Last selection retained · new entries blocked' : 'Unavailable';
    status.textContent = valid ? stale ? 'Stale · last-known-good selection' : 'Saved daily selection' : 'Universe unavailable';
    status.dataset.state = valid && !stale ? 'available' : 'unavailable';
    grid.replaceChildren(); sync.replaceChildren();
    if (valid) {
      for (const asset of assets) {
        const card = el('article', '', 'universe-card');
        const heading = el('div', '', 'universe-card-top');
        const value = el('strong', score(asset.opportunity_score), 'universe-score'); value.setAttribute('aria-label', 'Opportunity score ' + score(asset.opportunity_score) + ' out of 100'); value.title = 'Opportunity Score / 100';
        heading.append(el('span', '#' + asset.rank, 'universe-rank'), el('h3', asset.symbol), value);
        card.append(heading, el('p', asset.pair, 'universe-pair'), el('p', asset.reason, 'universe-reason'));
        const dl = document.createElement('dl');
        const rows = [ ['Trend / momentum', ['positive', 'negative', 'mixed'].includes(asset.trend) ? asset.trend : 'Unavailable'], ['Macro fit', score(asset.macro_fit_score)], ['Themes', Array.isArray(asset.themes) && asset.themes.length ? asset.themes.map(t => String(t).replaceAll('_', ' ')).join(', ') : 'Unavailable'], ['Catalyst score', score(asset.catalyst_score)], ['Input coverage', percent(asset.data_coverage)], ['Evidence confidence', percent(asset.data_confidence)] ];
        for (const [label, value] of rows) { const row = document.createElement('div'); row.append(el('dt', label), el('dd', value)); dl.append(row); }
        card.append(dl, el('p', eligible && asset.approved_for_new_entries === true ? 'Approved for new entry checks' : 'New entries blocked', 'universe-entry-state'));
        grid.append(card);
      }
      document.getElementById('universe-updated').textContent = `Selected ${at(data.generated_at)} · Version ${data.universe_version} · Macro regime: ${String(data.macro_regime || 'unavailable').replaceAll('_', ' ')}${data.reason ? ' · ' + data.reason : ''}`;
      document.getElementById('universe-pairs').textContent = assets.map(a => a.pair).join(' · ');
      const added = Array.isArray(data.changes?.added) ? data.changes.added : [];
      const removed = Array.isArray(data.changes?.removed) ? data.changes.removed : [];
      document.getElementById('universe-changes').textContent = `Added: ${added.join(', ') || 'None'} · Removed: ${removed.join(', ') || 'None'}`;
    } else {
      grid.append(el('p', 'Approved selection unavailable. Retrying automatically.', 'muted'));
      document.getElementById('universe-updated').textContent = 'No current saved universe could be verified.';
      document.getElementById('universe-pairs').textContent = 'Approved pairs unavailable.';
      document.getElementById('universe-changes').textContent = '';
    }
    for (const [key, name] of Object.entries(names)) {
      const bot = valid ? data.bot_sync?.[key] : null;
      const checked = Date.parse(bot?.checked_at);
      const current = eligible && bot?.status === 'current' && bot.universe_version === data.universe_version && bot.loaded === 10 && bot.expected === 10 && Number.isFinite(checked) && checked <= Date.now() + 30000 && Date.now() - checked <= 120000;
      const state = current ? 'CURRENT · 10/10 assets loaded' : bot?.status === 'stale' || bot?.status === 'current' ? 'STALE · latest eligibility not verified' : 'UNAVAILABLE · load not verified';
      const card = el('article', '', 'universe-sync-card'); card.append(el('h4', name), el('p', state));
      if (bot?.universe_version) card.append(el('small', 'Loaded version: ' + bot.universe_version));
      if (Array.isArray(bot?.legacy_open_positions) && bot.legacy_open_positions.length) card.append(el('small', 'Legacy positions managed: ' + bot.legacy_open_positions.map(p => p.pair).join(', ')));
      sync.append(card);
    }
  }
  async function refresh() {
    if (busy) return; busy = true;
    try { const r = await fetch('https://api.rrr.trading/api/trading-universe', { cache: 'no-store', signal: AbortSignal.timeout(20000) }); if (!r.ok) throw Error('Unavailable'); render(await r.json()); }
    catch { render(null); } finally { busy = false; }
  }
  window.refreshTradingUniverse = refresh;
  refresh();
  window.setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();

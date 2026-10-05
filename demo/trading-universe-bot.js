'use strict';
(() => {
  const API_BASE = 'https://api.rrr.trading';
  const key = document.body.dataset.bot;
  const timeframe = ({short:'15m', medium:'1h', long:'4h'})[key];
  const panel = document.getElementById('bot-trading-universe');
  const grid = document.getElementById('bot-universe-assets');
  const status = document.getElementById('bot-universe-status');
  const revision = document.getElementById('bot-universe-revision');
  const headerAssets = document.getElementById('header-assets');
  if (!panel || !grid || !status || !revision || !timeframe) return;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const score = value => finite(value) && value >= 0 && value <= 100 ? `${Math.round(value)} / 100` : 'Unavailable';
  const text = value => value == null || value === '' ? 'Unavailable' : String(value);
  const allocation = asset => {
    const source = asset?.timeframes?.[timeframe] ?? asset?.allocations?.[timeframe] ?? asset?.timeframe_suitability?.[timeframe];
    if (typeof source === 'boolean') return {eligible: source};
    if (!source || typeof source !== 'object') return null;
    return {eligible: source.eligible === true || source.approved_for_new_entries === true, score: source.score ?? source.fit_score, reason: source.reason};
  };
  const render = data => {
    const assets = Array.isArray(data?.assets) ? data.assets : [];
    const generated = Date.parse(data?.generated_at), expires = Date.parse(data?.valid_until);
    const valid = data?.schema_version === 1 && ['ok', 'stale'].includes(data.status) && typeof data.universe_version === 'string' && Number.isFinite(generated) && generated <= Date.now() + 30000 && Number.isFinite(expires) && expires > generated && assets.length === 10 && new Set(assets.map(asset => asset?.pair)).size === 10 && assets.every((asset, index) => asset?.rank === index + 1 && /^[A-Z0-9]{1,20}$/.test(asset.symbol) && asset.pair === asset.symbol + '/USDT:USDT');
    if (!valid) {
      status.textContent = 'UNAVAILABLE · allocation not verified'; status.dataset.state = 'unavailable';
      revision.textContent = 'Current universe revision unavailable.'; grid.replaceChildren();
      if (headerAssets) headerAssets.replaceChildren();
      const empty = document.createElement('p'); empty.textContent = 'Timeframe allocation unavailable. New entries are not inferred from this page.'; grid.append(empty); return;
    }
    const rows = assets.map(asset => ({asset, item: allocation(asset)}));
    // Missing allocation metadata does not establish an empty allocation.
    // The canonical bot acknowledgement verifies loading, not timeframe fit or an entry signal.
    const hasAllocations = rows.every(row => row.item !== null);
    const allocated = hasAllocations ? rows.filter(row => row.item.eligible === true) : rows;
    if (headerAssets) { headerAssets.replaceChildren(); allocated.forEach(({asset}, index) => { const bubble = document.createElement('span'); bubble.className = `header-asset header-asset-${index % 4}`; bubble.textContent = asset.symbol; headerAssets.append(bubble); }); }
    const bot = data.bot_sync?.[key], checked = Date.parse(bot?.checked_at);
    const current = data.status === 'ok' && Date.now() <= expires && bot?.status === 'current' && bot.universe_version === data.universe_version && bot.loaded === assets.length && bot.expected === assets.length && Number.isFinite(checked) && checked <= Date.now() + 30000 && Date.now() - checked <= 120000;
    const blocked = Date.now() > expires || data.entry_eligible !== true;
    status.textContent = blocked ? 'STALE · new entries blocked' : data.status === 'stale' ? 'STALE · saved lineup retained' : hasAllocations ? `${allocated.length} markets allocated · entry checks still required` : current ? `${assets.length} markets loaded · entry checks still required` : 'Bot loading unverified · selected lineup shown';
    status.dataset.state = !blocked && data.status === 'ok' && (hasAllocations || current) ? 'available' : 'unavailable';
    revision.textContent = `Universe ${data.universe_version} · updated ${text(data.generated_at)}`; grid.replaceChildren();
    if (!allocated.length) { const empty = document.createElement('p'); empty.textContent = 'No verified assets are allocated to this timeframe.'; grid.append(empty); return; }
    allocated.forEach(({asset, item}) => {
      const card = document.createElement('article'); card.className = 'bot-universe-card'; card.dataset.symbol = asset.symbol;
      const top = document.createElement('div'); top.className = 'bot-universe-top'; const title = document.createElement('strong'); title.textContent = asset.symbol; const rank = document.createElement('span'); rank.textContent = `#${asset.rank ?? '—'}`; top.append(title, rank);
      const fit = document.createElement('div'); fit.className = 'bot-universe-fit'; fit.textContent = hasAllocations ? `Timeframe fit: ${score(item.score ?? asset.timeframe_scores?.[timeframe])}` : `Opportunity: ${score(asset.opportunity_score)}`;
      const badge = document.createElement('span'); const currentState = asset.state === 'NEW' ? 'NEW' : asset.state === 'RETIRING' ? 'RETIRING' : hasAllocations ? 'ALLOCATED' : current ? 'LOADED' : 'SELECTED'; badge.className = `bot-universe-state state-${currentState.toLowerCase()}`; badge.textContent = currentState;
      const reason = document.createElement('p'); reason.textContent = text(item?.reason ?? asset.reason); const confidence = document.createElement('small'); confidence.textContent = finite(asset.data_confidence) && asset.data_confidence >= 0 && asset.data_confidence <= 1 ? `${Math.round(asset.data_confidence * 100)}% evidence confidence` : 'Confidence unavailable';
      card.append(top, fit, badge, reason, confidence); grid.append(card);
    });
  };
  async function refresh() { try { const response = await fetch(`${API_BASE}/api/trading-universe?timeframe=${encodeURIComponent(timeframe)}`, {cache:'no-store', signal:AbortSignal.timeout(10000)}); if (!response.ok) throw Error('Unavailable'); render(await response.json()); } catch { render(null); } }
  window.refreshBotTradingUniverse = refresh; refresh(); setInterval(() => { if (!document.hidden) refresh(); }, 60000); document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();

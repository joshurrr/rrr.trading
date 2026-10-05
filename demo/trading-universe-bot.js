'use strict';
(() => {
  const API_BASE = 'https://api.rrr.trading';
  const key = document.body.dataset.bot;
  const timeframe = ({short:'15m', medium:'1h', long:'4h'})[key];
  const panel = document.getElementById('bot-trading-universe');
  const grid = document.getElementById('bot-universe-assets');
  const status = document.getElementById('bot-universe-status');
  const revision = document.getElementById('bot-universe-revision');
  if (!panel || !grid || !status || !revision || !timeframe) return;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const score = value => finite(value) && value >= 0 && value <= 100 ? `${Math.round(value)}% fit` : 'Fit unavailable';
  const text = value => value == null || value === '' ? 'Unavailable' : String(value);
  const allocation = asset => {
    const source = asset?.timeframes?.[timeframe] ?? asset?.allocations?.[timeframe] ?? asset?.timeframe_suitability?.[timeframe];
    if (typeof source === 'boolean') return {eligible: source};
    if (!source || typeof source !== 'object') return null;
    return {eligible: source.eligible === true || source.approved_for_new_entries === true, score: source.score ?? source.fit_score, reason: source.reason};
  };
  const render = data => {
    const assets = Array.isArray(data?.assets) ? data.assets.filter(asset => asset && typeof asset.symbol === 'string') : [];
    const valid = data?.schema_version === 1 && typeof data.universe_version === 'string' && assets.length === 10;
    if (!valid) {
      status.textContent = 'UNAVAILABLE · allocation not verified'; status.dataset.state = 'unavailable';
      revision.textContent = 'Current universe revision unavailable.'; grid.replaceChildren();
      const empty = document.createElement('p'); empty.textContent = 'Timeframe allocation unavailable. New entries are not inferred from this page.'; grid.append(empty); return;
    }
    const allocated = assets.map(asset => ({asset, item: allocation(asset)})).filter(row => row.item?.eligible === true);
    status.textContent = data.entry_eligible === true ? `${allocated.length} assets allocated · entry checks still required` : 'STALE · new entries blocked';
    status.dataset.state = data.entry_eligible === true ? 'available' : 'unavailable';
    revision.textContent = `Universe ${data.universe_version} · updated ${text(data.generated_at)}`; grid.replaceChildren();
    if (!allocated.length) { const empty = document.createElement('p'); empty.textContent = 'No verified assets are allocated to this timeframe.'; grid.append(empty); return; }
    allocated.forEach(({asset, item}) => {
      const card = document.createElement('article'); card.className = 'bot-universe-card'; card.dataset.symbol = asset.symbol;
      const top = document.createElement('div'); top.className = 'bot-universe-top'; const title = document.createElement('strong'); title.textContent = asset.symbol; const rank = document.createElement('span'); rank.textContent = `#${asset.rank ?? '—'}`; top.append(title, rank);
      const fit = document.createElement('div'); fit.className = 'bot-universe-fit'; fit.textContent = score(item.score ?? asset.timeframe_scores?.[timeframe]);
      const badge = document.createElement('span'); const currentState = asset.state === 'NEW' ? 'NEW' : asset.state === 'RETIRING' ? 'RETIRING' : 'ACTIVE'; badge.className = `bot-universe-state state-${currentState.toLowerCase()}`; badge.textContent = currentState;
      const reason = document.createElement('p'); reason.textContent = text(item.reason ?? asset.reason); const confidence = document.createElement('small'); confidence.textContent = finite(asset.data_confidence) ? `${Math.round(asset.data_confidence * 100)}% evidence confidence` : 'Confidence unavailable';
      card.append(top, fit, badge, reason, confidence); grid.append(card);
    });
  };
  async function refresh() { try { const response = await fetch(`${API_BASE}/api/trading-universe?timeframe=${encodeURIComponent(timeframe)}`, {cache:'no-store', signal:AbortSignal.timeout(10000)}); if (!response.ok) throw Error('Unavailable'); render(await response.json()); } catch { render(null); } }
  window.refreshBotTradingUniverse = refresh; refresh(); setInterval(() => { if (!document.hidden) refresh(); }, 60000); document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();

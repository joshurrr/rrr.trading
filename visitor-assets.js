'use strict';
(() => {
  const KEY = 'rrr.trading.visitor.assets.v1', API = 'https://api.rrr.trading', symbolOK = s => typeof s === 'string' && /^[A-Z0-9]{1,20}$/.test(s);
  const node = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  const $ = id => document.getElementById('visitor-' + id);
  let selected = [], mode = 'recommended', initialised = false, central = null, approved = new Map(), validUntil = 0, loading = false, loaded = false, storageMessage = '', sourceMessage = '', timer;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p.version !== 1 || !Array.isArray(p.assets) || p.assets.length > 5000 || !p.assets.every(symbolOK) || !['recommended', 'personal'].includes(p.mode)) throw Error();
      selected = [...new Set(p.assets)]; mode = p.mode; initialised = true;
    }
  } catch { storageMessage = 'Saved preferences could not be read. You can customise this visit.'; }
  const fresh = () => loaded && Date.now() <= validUntil;
  const centralFresh = () => central?.status === 'ok' && Date.parse(central.valid_until) > Date.now();
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, assets: selected, mode })); storageMessage = ''; }
    catch { storageMessage = 'Browser storage is unavailable. Your choices apply to this visit only.'; }
  }
  function seed() {
    if (!initialised && centralFresh()) { selected = central.assets.map(a => a.symbol); initialised = true; }
  }
  function view(next) {
    mode = next; if (next === 'personal') { seed(); load(); }
    if (initialised) persist(); render();
  }
  function renderCards() {
    const host = $('cards');
    if (!selected.length) { host.replaceChildren(node('p', initialised ? 'Your watchlist is empty. Use Customise My Assets to add cryptocurrencies.' : 'Waiting for current recommendations to initialise your optional watchlist.', 'muted')); return; }
    window.CandidateCards.reconcile(host, selected.map(s => {
      const allowed = fresh() && approved.has(s), asset = allowed && centralFresh() ? central.assets.find(a => a.symbol === s) : null;
      return { symbol: s, asset, options: { rank: null, allowed, current: allowed, reason: asset?.reason || (allowed ? 'Open asset details for available saved market, news and intelligence evidence. A current recommendation score is unavailable.' : fresh() ? 'This asset is no longer in the approved list. Your saved choice is retained as unavailable; remove it or retry later.' : 'Asset eligibility cannot currently be verified. Your saved choice is retained.'), entryState: allowed ? 'Personal watchlist · not entry approval' : 'Eligibility unavailable' } };
    }));
  }
  const colours = ['#52d6f5', '#91b9ff', '#c0a1ff', '#f19de0', '#68e4cf'];
  function bubble(text, index) { const b = node('button', text, 'visitor-bubble'); b.type = 'button'; b.style.setProperty('--bubble-color', colours[index % colours.length]); return b; }
  function renderSelected() {
    $('selected').replaceChildren();
    selected.forEach((s, i) => {
      const wrap = node('span', undefined, 'visitor-bubble visitor-selected-bubble'); wrap.style.setProperty('--bubble-color', colours[i % colours.length]); wrap.append(node('span', s));
      const remove = node('button', '×'); remove.type = 'button'; remove.setAttribute('aria-label', `Remove ${s}`);
      remove.onclick = () => {
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const rect = wrap.getBoundingClientRect(), ghost = wrap.cloneNode(true);
          ghost.classList.add('visitor-removing'); ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true;
          Object.assign(ghost.style, { position: 'fixed', left: rect.left + 'px', top: rect.top + 'px', margin: '0', pointerEvents: 'none', zIndex: '20' });
          document.body.append(ghost); setTimeout(() => ghost.remove(), 160);
        }
        selected = selected.filter(a => a !== s); initialised = true; mode = 'personal'; persist(); render(); const next = $('selected').querySelectorAll('button')[Math.min(i, selected.length - 1)]; (next || $('search')).focus();
      };
      wrap.append(remove); $('selected').append(wrap);
    });
    if (!selected.length) $('selected').append(node('span', 'No assets selected.', 'data-note'));
  }
  function renderAvailable() {
    const host = $('available'); host.replaceChildren();
    if (!fresh()) return;
    const query = $('search').value.trim().toLowerCase(), chosen = new Set(selected);
    const results = [...approved.values()].filter(a => !chosen.has(a.symbol) && `${a.symbol} ${a.name || ''}`.toLowerCase().includes(query));
    for (const [i, a] of results.entries()) {
      const b = bubble('+ ' + a.symbol, i); b.title = a.name || a.symbol; b.setAttribute('aria-label', `Add ${a.symbol}${a.name && a.name !== a.symbol ? ' · ' + a.name : ''}`);
      b.onclick = () => { if (!fresh() || !approved.has(a.symbol) || selected.includes(a.symbol)) return; selected.push(a.symbol); initialised = true; mode = 'personal'; persist(); render(); $('selected').lastElementChild.querySelector('button').focus(); };
      host.append(b);
    }
    if (!results.length) host.append(node('p', query ? 'No matching approved cryptocurrencies.' : 'All approved assets are already selected.', 'data-note'));
  }
  function render() {
    const focusLabel = $('panel').contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') : null;
    $('recommended').setAttribute('aria-pressed', String(mode === 'recommended')); $('personal').setAttribute('aria-pressed', String(mode === 'personal'));
    document.getElementById('universe-assets').hidden = mode !== 'recommended'; $('watchlist').hidden = mode !== 'personal';
    document.getElementById('universe-title').textContent = mode === 'personal' ? 'MY ASSETS' : 'TOP 10 TRADING CANDIDATES';
    $('reset').disabled = !centralFresh() || !fresh() || !central.assets.every(a => approved.has(a.symbol));
    $('search').disabled = !fresh(); $('retry').hidden = fresh() || loading;
    $('source').textContent = loading ? 'Checking approved cryptocurrencies…' : fresh() ? `${approved.size} approved Bybit USDT perpetual assets · search the full list. Market eligibility is separate from bot entry approval.` : sourceMessage || 'The approved asset list is unavailable. Your saved choices are preserved. Retry to check again.';
    const unavailable = fresh() ? selected.filter(s => !approved.has(s)).length : 0;
    $('message').textContent = [storageMessage, unavailable ? `${unavailable} saved selection${unavailable === 1 ? ' is' : 's are'} currently unavailable. Your choices are retained; see My Assets for details.` : ''].filter(Boolean).join(' ');
    renderSelected(); renderAvailable(); renderCards();
    if (focusLabel) [...$('panel').querySelectorAll('button[aria-label]')].find(b => b.getAttribute('aria-label') === focusLabel)?.focus({ preventScroll: true });
  }
  async function get(path) { const r = await fetch(API + path, { cache: 'no-store', signal: AbortSignal.timeout(12000) }); if (!r.ok) { const e = Error('Unavailable'); e.status = r.status; throw e; } return r.json(); }
  async function registry() {
    const rows = []; let total;
    for (let offset = 0; offset < 10000; offset += 500) {
      const p = await get(`/api/v2/intelligence/assets?limit=500&offset=${offset}`);
      if (!Number.isInteger(p.total) || p.total < 0 || p.total > 10000 || !Array.isArray(p.assets) || (total !== undefined && total !== p.total)) throw Error();
      total = p.total; rows.push(...p.assets); if (rows.length >= total) { if (rows.length !== total || new Set(rows.map(a => a.symbol)).size !== total) throw Error(); return rows; }
      if (p.assets.length !== 500) throw Error();
    }
    throw Error();
  }
  async function list() {
    try { return await get('/api/assets/approved'); }
    catch (e) {
      if (e.status !== 404) throw e;
      // Older backend: accept only evidence proving the scoring pool covers every screened market.
      const [u, c, r] = await Promise.all([get('/api/trading-universe'), get('/api/trading-universe/candidates'), registry()]);
      if (u.schema_version !== 1 || u.status !== 'ok' || c.status !== 'ok' || !Array.isArray(u.excluded_pairs) || !Number.isInteger(u.eligible_market_count) || u.eligible_market_count < 1 || c.universe_version !== u.universe_version || c.generated_at !== u.generated_at || !Array.isArray(c.candidates) || c.candidates.length !== u.eligible_market_count) throw Error();
      const identities = new Map(r.filter(a => a.enabled === true && a.exchange === 'bybit' && a.market_type === 'linear_perpetual' && a.exchange_symbol === a.symbol + 'USDT').map(a => [a.symbol, a]));
      if (c.candidates.some(a => !symbolOK(a.symbol) || a.pair !== a.symbol + '/USDT:USDT' || !identities.has(a.symbol) || u.excluded_pairs?.includes(a.pair))) throw Error();
      return { schema_version: 1, status: 'ok', generated_at: u.generated_at, valid_until: u.valid_until, assets: c.candidates.map(a => ({ symbol: a.symbol, name: identities.get(a.symbol).name, pair: a.pair })) };
    }
  }
  async function load(force = false) {
    if (loading || (!force && fresh())) return;
    loading = true; render();
    try {
      const p = await list(), generated = Date.parse(p.generated_at), expires = Date.parse(p.valid_until);
      if (p.schema_version !== 1 || p.status !== 'ok' || !Number.isFinite(generated) || generated > Date.now() + 30000 || !Number.isFinite(expires) || expires <= Date.now() || expires <= generated || expires - generated > 3600000 || !Array.isArray(p.assets) || !p.assets.length || p.assets.length > 10000 || p.assets.some(a => !symbolOK(a.symbol) || a.pair !== a.symbol + '/USDT:USDT' || (a.name != null && typeof a.name !== 'string')) || new Set(p.assets.map(a => a.symbol)).size !== p.assets.length) throw Error();
      approved = new Map(p.assets.sort((a, b) => a.symbol.localeCompare(b.symbol)).map(a => [a.symbol, a])); validUntil = expires; loaded = true; sourceMessage = '';
      clearTimeout(timer); timer = setTimeout(() => { render(); if (!$('panel').hidden || mode === 'personal') load(true); }, Math.max(0, expires - Date.now() + 1));
    } catch { loaded = false; validUntil = 0; sourceMessage = 'The complete approved asset list could not be verified. Your saved choices are preserved. Please retry.'; }
    finally { loading = false; render(); }
  }
  $('open').onclick = () => {
    const open = $('panel').hidden; $('panel').hidden = !open; $('open').setAttribute('aria-expanded', String(open));
    if (open) { seed(); render(); load(); $('done').focus(); }
  };
  $('done').onclick = () => { seed(); mode = 'personal'; if (initialised) persist(); $('panel').hidden = true; $('open').setAttribute('aria-expanded', 'false'); render(); $('personal').focus(); };
  $('reset').onclick = () => { if ($('reset').disabled) return; selected = central.assets.map(a => a.symbol); initialised = true; mode = 'personal'; persist(); render(); };
  $('recommended').onclick = () => view('recommended'); $('personal').onclick = () => view('personal'); $('search').oninput = renderAvailable; $('retry').onclick = () => load(true);
  window.VisitorAssets = { recommendations(data) { central = data; if (mode === 'personal' || !$('panel').hidden) seed(); render(); } };
  render(); if (mode === 'personal') load();
  setInterval(() => { if (!document.hidden && (mode === 'personal' || !$('panel').hidden)) { render(); load(true); } }, 60000);
})();

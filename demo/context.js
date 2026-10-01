/* Public Phase 2 diagnostics. Scores never control the bots. */
(() => {
  'use strict';
  const container = document.getElementById('trading-context');
  if (!container) return;
  const content = container.querySelector('[data-context-content]');
  const status = container.querySelector('[data-context-status]');
  const assets = ['BTC', 'ETH', 'SOL', 'XRP', 'LINK', 'ONDO', 'AAVE', 'UNI', 'HYPE', 'INJ'];
  const themeNames = {rwa_tokenisation: 'RWA / Tokenisation', defi: 'DeFi', ethereum_ecosystem: 'Ethereum ecosystem', core_majors: 'Core majors'};
  let snapshot = null;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  function row(label, layer, usable) {
    const node = document.createElement('div');
    node.className = 'context-row';
    const name = document.createElement('span');
    name.textContent = label;
    const reading = document.createElement('span');
    const deadline = layer?.valid_until ? Date.parse(layer.valid_until) : null;
    const expired = deadline !== null && Number.isFinite(deadline) && Date.now() > deadline;
    const valid = usable && (deadline === null || (Number.isFinite(deadline) && Date.now() <= deadline)) && layer?.available === true && layer.fresh === true && finite(layer.bias_score) && Math.abs(layer.bias_score) <= 100;
    reading.textContent = valid ? `${layer.bias_score > 0 ? '+' : ''}${layer.bias_score.toFixed(1)} · ${String(layer.regime || 'unavailable').replaceAll('_', ' ')}` : layer?.reason?.includes('stale') || expired || (!usable && snapshot && layer?.available === true) ? 'Stale / unavailable' : 'Unavailable';
    const meta = document.createElement('small');
    meta.textContent = valid ? `Evidence confidence ${finite(layer.confidence) ? layer.confidence.toFixed(0) + '/100' : 'unavailable'} · Coverage ${finite(layer.coverage) ? (layer.coverage * 100).toFixed(0) + '%' : 'unavailable'}` : '';
    node.append(name, reading, meta);
    return node;
  }
  function render() {
    content.replaceChildren();
    const stamp = Date.parse(snapshot?.generated_at);
    const elapsed = Date.now() - stamp;
    const fresh = snapshot?.mode === 'observation_only' && snapshot?.fresh === true && Number.isFinite(stamp) && elapsed >= -60000 && elapsed <= 660000;
    status.textContent = fresh ? `Snapshot ${new Date(stamp).toLocaleString('en-AU', {timeZone: 'Australia/Brisbane'})} Brisbane · Global context shared by both bots` : snapshot ? 'Context snapshot stale / unavailable' : 'Context endpoint unavailable';
    const brisbane = new Intl.DateTimeFormat('en-CA', {timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
    const hour = Number(new Intl.DateTimeFormat('en-GB', {timeZone: 'Australia/Brisbane', hour: '2-digit', hourCycle: 'h23'}).format(new Date()));
    const expected = hour >= 7 ? brisbane : new Date(Date.parse(brisbane + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
    const macroFresh = snapshot?.macro?.fresh && snapshot.macro.report_date >= expected && snapshot.macro.report_date <= brisbane;
    content.append(row('Macro', snapshot?.macro, !!macroFresh));
    content.append(row('Crypto regime', snapshot?.crypto, fresh));
    const heading = title => {const h = document.createElement('h3'); h.textContent = title; content.append(h);};
    heading('Themes · market derived');
    for (const [key, label] of Object.entries(themeNames)) content.append(row(label, snapshot?.themes?.[key], fresh));
    heading('Asset context');
    for (const asset of assets) {
      const layer = snapshot?.assets?.[asset];
      const deadline = Date.parse(layer?.valid_until);
      content.append(row(asset, layer, fresh && Number.isFinite(deadline) && Date.now() <= deadline));
    }
  }
  async function refresh() {
    try {
      const response = await fetch('https://api.rrr.trading/api/trading-context', {cache: 'no-store', signal: AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      if (data.mode !== 'observation_only' || !data.assets || !Array.isArray(data.universe)) throw new Error('invalid');
      snapshot = data;
    } catch {
      snapshot = null;
    }
    render();
  }
  render();
  refresh();
  setInterval(refresh, 60000);
  setInterval(render, 15000);
})();

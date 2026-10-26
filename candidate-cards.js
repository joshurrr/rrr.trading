'use strict';
// Homepage artwork is decorative. Colours/patterns never encode market evidence.
(() => {
  const node = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  const palettes = { BTC: [29, 12], ETH: [255, 210], SOL: [278, 165], XRP: [209, 237] };
  function identity(symbol) {
    let hash = 2166136261;
    for (const c of symbol) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
    return { hash, hues: palettes[symbol] || [hash % 360, (hash % 360 + 65) % 360] };
  }
  function create(symbol, compact = false) {
    const card = node('article', undefined, 'universe-card candidate-portrait'); card.dataset.symbol = symbol;
    const button = node('button', undefined, 'universe-bubble'); button.type = 'button';
    if (compact) {
      card.dataset.cardLayout = 'compact';
      const { image, fallback } = window.AssetLogo.create(symbol, 'candidate-icon-image', 'candidate-icon-fallback', 32);
      image.hidden = true; fallback.hidden = false;
      const icon = node('span', undefined, 'candidate-icon'); icon.setAttribute('aria-hidden', 'true'); icon.append(image, fallback);
      button.append(icon, node('span', symbol, 'candidate-compact-symbol'), node('span', '—', 'candidate-compact-price'), node('span', '—', 'candidate-compact-change'), node('span', 'OPEN', 'candidate-open-position'));
      card.append(button); return card;
    }
    const { hash, hues } = identity(symbol);
    button.style.setProperty('--asset-hue', hues[0]); button.style.setProperty('--asset-accent', hues[1]);
    const art = node('span', undefined, 'candidate-art'); art.setAttribute('aria-hidden', 'true');
    const chart = node('span', undefined, 'candidate-chart');
    for (let i = 0; i < 12; i++) {
      const candle = node('span'); const seed = ((hash >>> (i % 16)) + i * 37) % 71;
      candle.style.setProperty('--bar-height', 12 + seed % 37 + 'px');
      candle.style.setProperty('--bar-y', 10 + seed + 'px');
      candle.style.setProperty('--wick-height', 8 + seed % 18 + 'px'); chart.append(candle);
    }
    const { image: logo, fallback } = window.AssetLogo.create(symbol, 'candidate-logo', 'candidate-monogram');
    art.append(chart, fallback, logo);
    const top = node('span', undefined, 'universe-bubble-top'), ticker = node('span', undefined, 'universe-symbol');
    const small = logo.cloneNode(); small.className = 'universe-coin-logo'; small.width = 22; small.height = 22;
    small.addEventListener('error', () => { small.hidden = true; });
    ticker.append(small, node('span', symbol)); top.append(node('span', '', 'universe-rank'), ticker);
    const info = node('span', undefined, 'candidate-info');
    info.append(node('strong', '', 'universe-score'), node('span', 'Opportunity score', 'candidate-score-label'), node('span', '', 'universe-trend'), node('span', '', 'candidate-direction'), node('span', '', 'candidate-context'));
    const compactWrap = node('span', undefined, 'candidate-compact');
    const compactHead = node('span', undefined, 'candidate-compact-head');
    compactHead.append(node('span', '', 'candidate-compact-pair'), node('span', '', 'candidate-compact-eligibility'));
    compactWrap.append(compactHead, node('span', '', 'candidate-compact-symbol'), node('span', undefined, 'candidate-compact-foot'));
    button.append(art, top, info, compactWrap);
    const evidence = node('details', undefined, 'candidate-evidence');
    evidence.append(node('summary', 'Selection evidence'), node('p', '', 'universe-reason universe-analysis-reason'), node('small', '', 'universe-confidence'), node('p', '', 'universe-entry-state'));
    card.append(button, evidence); return card;
  }
  function update(card, asset, { allowed = true, current = true, rank = asset?.rank, rankLabel, reason, entryState, evidenceLabel = 'Selection evidence', assessment, compact = false, priceLabel = '—', changeLabel = '—', changeTone = '', activePosition = false } = {}) {
    card.candidateAssessment = { symbol: card.dataset.symbol, asset, current, assessment };
    card.classList.toggle('candidate-compact-mode', compact);
    const button = card.querySelector('button'), symbol = card.dataset.symbol;
    if (compact) {
      button.disabled = !allowed;
      if (allowed) { button.dataset.intelligenceSymbol = symbol; button.setAttribute('aria-haspopup', 'dialog'); }
      else { delete button.dataset.intelligenceSymbol; button.removeAttribute('aria-haspopup'); }
      button.setAttribute('aria-label', allowed ? `Inspect ${symbol} asset intelligence` : `${symbol} eligibility unavailable`);
      const ticker = card.querySelector('.candidate-compact-symbol'); ticker.textContent = symbol;
      ticker.style.fontSize = symbol.length <= 7 ? '20px' : symbol.length <= 10 ? '17px' : symbol.length <= 15 ? '14px' : '12px';
      card.querySelector('.candidate-compact-price').textContent = priceLabel;
      const change = card.querySelector('.candidate-compact-change'); change.textContent = changeLabel; change.dataset.tone = changeTone;
      card.querySelector('.candidate-open-position').hidden = !activePosition;
      return;
    }
    button.disabled = !allowed;
    if (allowed) { button.dataset.intelligenceSymbol = symbol; button.setAttribute('aria-haspopup', 'dialog'); }
    else { delete button.dataset.intelligenceSymbol; button.removeAttribute('aria-haspopup'); }
    button.setAttribute('aria-label', allowed ? `Inspect ${symbol} asset intelligence` : `${symbol} eligibility unavailable`);
    const score = asset?.opportunity_score, validScore = typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100;
    card.querySelector('.universe-rank').textContent = rankLabel || (rank ? `#${rank}` : 'MY ASSET');
    card.querySelector('.candidate-evidence summary').textContent = evidenceLabel;
    card.querySelector('.universe-score').textContent = validScore ? score.toFixed(1).replace(/\.0$/, '') : '—';
    const trend = ['positive', 'negative', 'mixed', 'neutral'].includes(asset?.trend) ? asset.trend : 'unavailable';
    button.dataset.trend = current ? trend : 'unavailable';
    card.querySelector('.universe-trend').textContent = !current ? 'Saved · unavailable' : trend === 'unavailable' ? 'Trend unavailable' : trend.toUpperCase();
    // Only an explicit API direction is shown; trend/score/eligibility never imply one.
    const direction = current && allowed && ['LONG', 'SHORT'].includes(asset?.direction) ? asset.direction : null;
    const horizon = ['15m', '1h', '4h'].includes(asset?.selected_timeframe) ? asset.selected_timeframe : null;
    const badge = card.querySelector('.candidate-direction'); badge.hidden = !direction; badge.textContent = direction ? direction + (horizon ? ` · ${horizon}` : '') : '';
    badge.dataset.apiDirection = direction || ''; badge.dataset.apiHorizon = horizon || '';
    const fullReason = reason || asset?.reason || 'Available evidence in asset details.';
    const sentence = fullReason.split(/(?<=[.!?])\s/)[0];
    const concise = sentence.length > 78 ? sentence.slice(0, 75).replace(/\s+\S*$/, '') + '…' : sentence;
    card.querySelector('.candidate-context').textContent = !current && !reason ? 'Current eligibility not verified' : concise;
    card.querySelector('.universe-analysis-reason').textContent = fullReason;
    const confidence = asset?.data_confidence;
    card.querySelector('.universe-confidence').textContent = typeof confidence === 'number' && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? `${Math.round(confidence * 100)}% evidence confidence` : 'Evidence confidence unavailable';
    card.querySelector('.universe-entry-state').textContent = entryState || '';
  }
  // Retain image/button DOM and focus when scores change or rankings reorder.
  function reconcile(host, rows, { showEvidence = host.id !== 'universe-assets' } = {}) {
    const saved = new Map([...host.children].filter(e => e.dataset.symbol).map(e => [e.dataset.symbol, e]));
    rows.forEach(({ symbol, asset, options }, index) => {
      const compact = options?.compact === true;
      let card = saved.get(symbol);
      if (card && (card.dataset.cardLayout === 'compact') !== compact) { card.remove(); card = null; }
      card ||= create(symbol, compact); saved.delete(symbol); update(card, asset, options);
      const evidence = card.querySelector('.candidate-evidence'); if (evidence) evidence.hidden = !showEvidence;
      if (host.children[index] !== card) {
        if (card.parentNode === host && host.moveBefore) host.moveBefore(card, host.children[index] || null);
        else host.insertBefore(card, host.children[index] || null);
      }
    });
    for (const card of saved.values()) card.remove();
    for (const child of [...host.children]) if (!child.dataset.symbol) child.remove();
  }
  window.CandidateCards = { reconcile };
})();

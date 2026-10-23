'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const text = (tag, value, className) => { const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; };
  const stamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  const date = value => stamp(value) === null ? 'UNKNOWN' : new Intl.DateTimeFormat('en-AU', {timeZone:'Australia/Brisbane', dateStyle:'medium', timeStyle:'short'}).format(new Date(value)) + ' Brisbane · ' + value;
  const paragraphs = (host, rows, empty) => {
    host.replaceChildren();
    for (const row of Array.isArray(rows) ? rows : []) {
      const value = typeof row === 'string' ? row : row?.text;
      if (typeof value !== 'string') continue;
      host.append(text('p', value, 'saved-text'));
      if (Array.isArray(row?.evidence_ids)) host.append(text('small', 'Evidence: ' + row.evidence_ids.join(', ') + ' · Saved state: ' + (row.state || 'UNKNOWN')));
    }
    if (!host.childNodes.length) host.append(text('p', empty));
  };
  function source(host, evidence) {
    host.append(text('p', [evidence.id || 'UNKNOWN', evidence.source || 'Publisher UNKNOWN', 'Published: ' + date(evidence.published_at), 'Collected / observed: ' + date(evidence.observed_at), 'Saved state: ' + (evidence.state || 'UNKNOWN'), 'Expires: ' + date(evidence.expires_at)].join(' · ')));
    try {
      const url = new URL(evidence.reference);
      if (url.protocol !== 'https:' || !['coindesk.com','www.coindesk.com','api.bybit.com','api.alternative.me','fred.stlouisfed.org'].includes(url.hostname) || url.username || url.password) return;
      const link = text('a', 'Original source'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; host.append(link);
    } catch { /* Missing source stays unavailable. */ }
  }
  function render(data) {
    const saved = data.overview.interpretation;
    const valid = saved?.validation === 'SAVED_SCHEMA_AND_ORIGINAL_EVIDENCE_VALIDATED' && ['CURRENT','STALE'].includes(saved.state) && stamp(saved.source_at) !== null && stamp(saved.expires_at) !== null && stamp(saved.source_at) <= Date.now() && stamp(saved.expires_at) > stamp(saved.source_at);
    const state = valid ? saved.state === 'STALE' || Date.now() >= stamp(saved.expires_at) ? 'STALE' : 'CURRENT' : 'UNAVAILABLE';
    $('news-state').textContent = state; $('news-state').dataset.state = state;
    $('feed-status').textContent = 'Saved public V4 feed · Read at ' + date(data.served_at);
    $('luna-commentary').textContent = valid && typeof saved.assessment?.text === 'string' ? saved.assessment.text : 'UNAVAILABLE · No validated saved assessment is exposed.';
    const meta = $('assessment-meta'); meta.replaceChildren();
    for (const [name, value] of [['Assessment timestamp', valid ? date(saved.source_at) : 'UNKNOWN'], ['Last updated', valid ? date(saved.observed_at) + ' (saved assessment; API read time is separate)' : 'UNKNOWN'], ['Freshness / coverage', state + ' · ' + (saved?.health || 'UNKNOWN')], ['Validation', saved?.validation || 'UNAVAILABLE'], ['Source / version', valid ? (saved.provenance?.source || 'UNKNOWN') + ' · ' + (saved.provenance?.source_version || 'UNKNOWN') : 'UNKNOWN'], ['Assessment ID', 'UNKNOWN · no assessment ID exposed'], ['SOL consumption / timestamp', 'UNKNOWN · no per-request receipt exposed']]) meta.append(text('dt', name), text('dd', value));
    paragraphs($('saved-drivers'), valid ? saved.drivers : [], 'Saved drivers unavailable.');
    paragraphs($('saved-conflicts'), valid ? saved.contradictions : [], 'No saved contradictions exposed; this does not establish absence of risks.');
    paragraphs($('saved-uncertainty'), valid ? saved.uncertainty : [], 'Saved uncertainty unavailable.');
    const full = $('full-analysis'); full.replaceChildren();
    if (valid) {
      for (const [label, rows] of [['Market mood', [saved.market_mood]], ['Directional pressure', [saved.directional_pressure]], ['Assessment', [saved.assessment]], ['Drivers', saved.drivers], ['Conflicting evidence', saved.contradictions], ['Changes', saved.changes], ['Uncertainty', saved.uncertainty]]) {
        full.append(text('h3', label)); const group = document.createElement('div'); paragraphs(group, rows, 'Not recorded.'); full.append(group);
      }
      full.append(text('p', 'Sentiment change: ' + (saved.sentiment_change || 'UNKNOWN') + ' · Reasons: ' + (Array.isArray(saved.reasons) ? saved.reasons.join(', ') || 'None exposed' : 'UNKNOWN')));
      for (const item of saved.provenance?.evidence || []) source(full, item);
    } else full.append(text('p', 'Saved analysis unavailable.'));
    const feed = $('news-feed'); feed.replaceChildren();
    const citations = valid && Array.isArray(saved.provenance?.evidence) ? saved.provenance.evidence.filter(item => /^A\d+$/.test(item?.id)) : [];
    citations.sort((a,b) => (stamp(b.published_at) ?? -Infinity) - (stamp(a.published_at) ?? -Infinity));
    feed.append(text('p', 'UNAVAILABLE · The current public API exposes news citation metadata but omits the retained headlines, summaries and classifications. Full news details require a read-only backend projection.'));
    for (const item of citations) {
      const article = document.createElement('article'); article.className = 'macro-panel';
      article.append(text('h3', 'Saved news citation · headline unavailable')); source(article, item);
      const details = document.createElement('details'); details.append(text('summary', 'Evidence availability'));
      details.append(text('p', 'Saved summary, affected assets, sentiment, impact and theme associations are not exposed. No classifications have been inferred.'));
      article.append(details); feed.append(article);
    }

  }
  async function refresh() {
    $('refresh-news').disabled = true;
    try {
      const response = await fetch('https://v4.rrr.trading/v4/paper', {method:'GET', credentials:'omit', redirect:'error', cache:'no-store', signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw Error('unavailable');
      const data = await response.json();
      if (data?.version !== 'paper-read-api-v1' || data.mode !== 'paper' || data.overview?.version !== 'paper-overview-v1' || data.overview.purpose !== 'PUBLIC_SAVED_OBSERVATIONS_ONLY') throw Error('contract');
      render(data);
    } catch {
      $('feed-status').textContent = 'UNAVAILABLE · Public feed access or response contract could not be verified.';
      $('news-state').textContent = 'UNAVAILABLE'; $('news-state').dataset.state = 'UNAVAILABLE';
      $('luna-commentary').textContent = 'UNAVAILABLE · Saved Luna assessment could not be read.';
      $('assessment-meta').replaceChildren();
      for (const id of ['full-analysis','saved-drivers','saved-conflicts','saved-uncertainty','news-feed']) $(id).textContent = 'UNAVAILABLE · Saved evidence could not be read.';
    } finally { $('refresh-news').disabled = false; }
  }
  $('refresh-news').addEventListener('click', refresh);
  refresh();
})();

'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const text = (tag, value, className) => { const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; };
  const stamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  const date = value => stamp(value) === null ? 'UNKNOWN' : new Intl.DateTimeFormat('en-AU', {timeZone:'Australia/Brisbane', dateStyle:'medium', timeStyle:'short'}).format(new Date(value)) + ' Brisbane · ' + value;
  const paragraphs = (host, rows, empty, showRefs = false) => {
    host.replaceChildren();
    for (const row of Array.isArray(rows) ? rows : []) {
      const value = typeof row === 'string' ? row : row?.text;
      if (typeof value !== 'string') continue;
      host.append(text('p', value, 'saved-text'));
      if (showRefs && Array.isArray(row?.evidence_ids)) host.append(text('small', 'Evidence: ' + row.evidence_ids.join(', ') + ' · Saved state: ' + (row.state || 'UNKNOWN')));
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
    const news = saved?.news_and_themes, content = news?.content;
    const validated = news?.validation === 'SAVED_SCHEMA_AND_ORIGINAL_EVIDENCE_VALIDATED';
    const timed = stamp(news?.source_at) !== null && stamp(news?.expires_at) !== null && stamp(news.source_at) <= Date.now() && stamp(news.expires_at) > stamp(news.source_at);
    const available = validated && content?.status === 'AVAILABLE' && typeof content.summary === 'string' && ['CURRENT','STALE'].includes(news.state) && timed;
    const insufficient = validated && content?.status === 'INSUFFICIENT_EVIDENCE' && news.state === 'UNAVAILABLE' && typeof content.summary === 'string';
    const readable = available || insufficient;
    const state = available ? news.state === 'STALE' || Date.now() >= stamp(news.expires_at) ? 'STALE' : 'CURRENT' : 'UNAVAILABLE';
    $('news-state').textContent = state; $('news-state').dataset.state = state;
    $('intelligence-label').textContent = available ? state === 'CURRENT' ? 'Luna Intelligence — Validated' : 'Luna Intelligence — Stale saved assessment' : insufficient ? 'Luna Intelligence — Insufficient evidence' : 'Luna Intelligence — Unavailable';
    $('feed-status').textContent = 'Saved public V4 feed · Read at ' + date(data.served_at);
    $('luna-commentary').textContent = readable ? content.summary : 'UNAVAILABLE · No validated saved News & Themes assessment is exposed.';
    const sentiment = readable && ['POSITIVE','NEGATIVE','NEUTRAL','MIXED','UNKNOWN'].includes(content.sentiment) ? content.sentiment : 'UNKNOWN';
    $('news-sentiment').textContent = 'News sentiment · ' + sentiment; $('news-sentiment').dataset.sentiment = sentiment;
    $('assessment-time').textContent = 'Assessment: ' + (readable && stamp(news.source_at) !== null ? new Intl.DateTimeFormat('en-AU', {timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'}).format(new Date(news.source_at)) + ' Brisbane' : 'Unavailable') + ' · ' + state;
    $('market-implications').textContent = readable && typeof content.market_implications === 'string' ? content.market_implications : 'Saved market implications unavailable.';
    const meta = $('assessment-meta'); meta.replaceChildren();
    for (const [name, value] of [['Assessment timestamp', readable ? date(news.source_at) : 'UNKNOWN'], ['Last updated', readable ? date(news.observed_at) : 'UNKNOWN'], ['Freshness / expiry', state + ' · ' + date(news?.expires_at)], ['Validation', news?.validation || 'UNAVAILABLE'], ['Source / version', readable ? (news.provenance?.source || 'UNKNOWN') + ' · ' + (news.provenance?.source_version || 'UNKNOWN') : 'UNKNOWN'], ['Assessment ID', 'UNKNOWN · no assessment ID exposed'], ['SOL consumption / timestamp', 'UNKNOWN · no per-request receipt exposed']]) meta.append(text('dt', name), text('dd', value));
    const evidence = readable && Array.isArray(news.provenance?.evidence) ? news.provenance.evidence : [];
    const themes = available && Array.isArray(content.themes) ? content.themes.filter(t => t && typeof t.name === 'string') : [];
    const host = $('market-themes'); host.replaceChildren();
    for (const theme of themes) {
      const article = document.createElement('article'); article.className = 'macro-panel';
      article.append(text('h3', theme.name));
      if (typeof theme.description === 'string') article.append(text('p', theme.description, 'saved-text'));
      const implication = text('p', 'Implication · ' + (theme.implication || 'UNKNOWN'), 'theme-implication'); implication.dataset.implication = theme.implication || 'UNKNOWN'; article.append(implication);
      article.append(text('p', 'Affected markets/assets: ' + (Array.isArray(theme.affected_markets) && theme.affected_markets.length ? theme.affected_markets.join(', ') : 'Not recorded')));
      const details = document.createElement('details'); details.append(text('summary', 'Supporting evidence, catalysts & risks'));
      for (const [label, rows] of [['Catalysts', theme.catalysts], ['Risks', theme.risks]]) { details.append(text('h3', label)); const group = document.createElement('div'); paragraphs(group, rows, 'Not recorded.', true); details.append(group); }
      const refs = Array.isArray(theme.evidence_ids) ? theme.evidence_ids : [];
      if (!refs.length) details.append(text('p', 'Supporting evidence unavailable.'));
      for (const ref of refs) { const citation = evidence.find(e => e.id === ref); if (citation) source(details, citation); else details.append(text('p', 'Citation metadata unavailable for ' + ref)); }
      article.append(details); host.append(article);
    }
    if (!themes.length) host.append(text('p', available ? 'No themes recorded in this saved assessment.' : 'UNAVAILABLE · No supported themes are available.'));
    paragraphs($('saved-catalysts'), themes.flatMap(t => Array.isArray(t.catalysts) ? t.catalysts : []), 'No saved catalysts available.');
    paragraphs($('saved-risks'), themes.flatMap(t => Array.isArray(t.risks) ? t.risks : []), 'No saved risks available.');
    paragraphs($('saved-conflicts'), readable ? content.conflicting_evidence : [], readable ? 'No conflicting evidence recorded; this does not establish absence of risk.' : 'Saved conflicting evidence unavailable.');
    paragraphs($('saved-uncertainty'), readable ? content.uncertainty : [], 'Saved uncertainty unavailable.');
    const full = $('full-analysis'); full.replaceChildren();
    if (readable) {
      full.append(text('p', 'Summary evidence: ' + (Array.isArray(content.evidence_ids) ? content.evidence_ids.join(', ') || 'None recorded' : 'Unavailable')));
      full.append(text('p', 'Status reasons: ' + (Array.isArray(news.reasons) ? news.reasons.join(', ') || 'None exposed' : 'UNKNOWN')));
      for (const item of evidence) source(full, item);
    } else full.append(text('p', 'Saved news intelligence details unavailable.'));
    const feed = $('news-feed'); feed.replaceChildren();
    const macroEvidence = saved?.validation === 'SAVED_SCHEMA_AND_ORIGINAL_EVIDENCE_VALIDATED' && Array.isArray(saved.provenance?.evidence) ? saved.provenance.evidence : [];
    const citations = [...new Map([...macroEvidence, ...evidence].filter(item => /^A\d+$/.test(item?.id)).map(item => [item.id,item])).values()];
    citations.sort((a,b) => (stamp(b.published_at) ?? -Infinity) - (stamp(a.published_at) ?? -Infinity));
    feed.append(text('p', 'UNAVAILABLE · The current public API exposes news citation metadata but omits the retained headlines, summaries and classifications.'));
    for (const item of citations) {
      const article = document.createElement('article'); article.className = 'macro-panel';
      article.append(text('h3', 'Saved news citation · headline unavailable')); source(article, item);
      const details = document.createElement('details'); details.append(text('summary', 'Evidence availability'));
      details.append(text('p', 'Article summary and classifications are not exposed. No article content has been inferred.'));
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
      $('intelligence-label').textContent = 'Luna Intelligence — Unavailable';
      $('news-sentiment').textContent = 'News sentiment · UNKNOWN'; $('news-sentiment').dataset.sentiment = 'UNKNOWN';
      $('assessment-time').textContent = 'Assessment timestamp unavailable';
      $('market-implications').textContent = 'Saved market implications unavailable.';
      for (const id of ['full-analysis','market-themes','saved-catalysts','saved-risks','saved-conflicts','saved-uncertainty','news-feed']) $(id).textContent = 'UNAVAILABLE · Saved evidence could not be read.';
    } finally { $('refresh-news').disabled = false; }
  }
  $('refresh-news').addEventListener('click', refresh);
  refresh();
})();

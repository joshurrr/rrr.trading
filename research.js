'use strict';
// Saved research only. No dependency on assessment, scoring, or bot controls.
(() => {
  const root = document.getElementById('daily-research');
  if (!root) return;
  const byId = id => document.getElementById(id);
  const node = (tag, value, className) => { const el = document.createElement(tag); el.textContent = value; if (className) el.className = className; return el; };
  const parse = value => typeof value === 'string' && /(Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
  const recent = (value, age) => Number.isFinite(parse(value)) && Date.now() - parse(value) >= 0 && Date.now() - parse(value) <= age;
  const url = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash ? u.href : null; } catch { return null; } };
  const valid = item => item && typeof item.title === 'string' && item.title.trim() && ['HIGH', 'MEDIUM', 'LOW'].includes(item.impact) && typeof item.category === 'string' && Array.isArray(item.affected_assets) && item.affected_assets.length && item.affected_assets.every(a => typeof a === 'string');
  const series = {
    SP500: ['S&P 500', value => `The S&P 500 stands at ${value}.`],
    NASDAQCOM: ['Nasdaq Composite', value => `The Nasdaq Composite stands at ${value}.`],
    DGS2: ['2-year US Treasury yield', value => `The 2-year US Treasury yield is ${value}.`],
    DGS10: ['10-year US Treasury yield', value => `The 10-year US Treasury yield is ${value}.`],
    DTWEXBGS: ['Broad US dollar index', value => `The broad US dollar index reads ${value}.`],
    NFCI: ['Financial conditions index', (value, reading) => `US financial conditions are ${reading < 0 ? 'looser than' : reading > 0 ? 'tighter than' : 'in line with'} their historical average.`],
    WALCL: ['Federal Reserve assets', value => `The Federal Reserve holds ${value} in assets.`],
    VIXCLS: ['VIX volatility index', value => `The VIX, which measures expected US stock market volatility, reads ${value}.`]
  };
  const titles = { 'macro:equities': 'US stocks', 'macro:liquidity': 'Financial conditions', 'macro:rates': 'US interest rates', 'macro:usd': 'US dollar', 'macro:volatility': 'Stock market volatility' };
  const readingValue = evidence => {
    if (['DGS2', 'DGS10'].includes(evidence.series_id)) return `${evidence.value.toFixed(2)}%`;
    if (evidence.series_id === 'WALCL') return `$${(evidence.value / 1000000).toFixed(2)} trillion`;
    return evidence.value.toLocaleString('en-US', { maximumFractionDigits: evidence.series_id === 'NFCI' ? 3 : 2 });
  };
  function themeContent(item) {
    const evidence = (Array.isArray(item.supporting_evidence) ? item.supporting_evidence : []).filter(e => e && Object.hasOwn(series, e.series_id) && typeof e.value === 'number' && Number.isFinite(e.value) && /^\d{4}-\d{2}-\d{2}$/.test(e.observation_date));
    const macro = item.category === 'macro' && Object.hasOwn(titles, item.id);
    const sentences = evidence.filter(e => e.fresh !== false).map(e => series[e.series_id][1](readingValue(e), e.value));
    return {
      title: macro ? titles[item.id] : item.title,
      summary: macro ? sentences.join(' ') || 'Current readings are unavailable for this theme.' : typeof item.summary === 'string' && item.summary.trim() ? item.summary : 'Summary unavailable.',
      evidence
    };
  }
  function render(data) {
    const themes = byId('research-themes'), events = byId('research-events');
    themes.replaceChildren(); events.replaceChildren();
    const available = data && ['available', 'degraded'].includes(data.status) && recent(data.generated_at, 26 * 3600000);
    const stale = data && (data.status === 'stale' || data.stale_theme_count > 0 || (data.generated_at && !recent(data.generated_at, 26 * 3600000)));
    byId('research-status').textContent = available ? (stale ? 'Partial · stale items excluded' : data.status === 'degraded' ? 'Partial source coverage' : 'Saved research') : stale ? 'Research stale' : 'Research unavailable';
    byId('research-updated').textContent = Number.isFinite(parse(data?.generated_at)) ? 'Snapshot: ' + new Date(data.generated_at).toLocaleString('en-AU', {timeZone:'Australia/Brisbane'}) + ' Brisbane · sources checked independently' : 'Saved research is temporarily unavailable.';
    const ranked = (Array.isArray(data?.themes) ? data.themes : []).filter(t => available && valid(t) && t.status === 'current' && parse(t.review_at) > Date.now() && recent(t.last_updated, 26 * 3600000));
    ranked.sort((a,b) => ['HIGH','MEDIUM','LOW'].indexOf(a.impact) - ['HIGH','MEDIUM','LOW'].indexOf(b.impact));
    ranked.slice(0,5).forEach(item => {
      const row = node('div', '', 'research-item');
      const content = themeContent(item);
      row.append(node('h4', content.title), node('span', item.impact, 'research-impact'), node('p', content.summary, 'theme-summary'));
      if (content.evidence.some(e => e.fresh === false)) row.append(node('p', 'Stale readings excluded from the summary.', 'research-meta'));
      if (content.evidence.length) {
        const details = node('details', '', 'theme-details');
        details.append(node('summary', 'Readings & sources'));
        content.evidence.forEach(e => {
          const link = node('a', series[e.series_id][0] + ' ↗', 'text-link');
          link.href = `https://fred.stlouisfed.org/series/${encodeURIComponent(e.series_id)}`;
          link.target = '_blank'; link.rel = 'noopener noreferrer';
          const reading = node('p', '', 'research-meta');
          reading.append(link, document.createTextNode(` · ${readingValue(e)} · observed ${e.observation_date}${e.fresh === false ? ' · stale, excluded' : ''}`));
          details.append(reading);
        });
        row.append(details);
      }
      const source = Array.isArray(item.sources) ? item.sources.find(s => url(s?.url)) : null;
      if (source && !content.evidence.length) { const link = node('a', source.name + ' ↗', 'text-link'); link.href = url(source.url); link.target='_blank'; link.rel='noopener noreferrer'; row.append(link); }
      row.append(node('small', 'Checked ' + new Date(item.last_updated).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'}) + ' Brisbane', 'research-meta'));
      themes.append(row);
    });
    if (!themes.childElementCount) themes.append(node('p', available ? 'No valid current themes currently tracked.' : stale ? 'Themes stale · awaiting a fresh snapshot.' : 'Current themes unavailable.', 'muted'));
    const upcoming = (Array.isArray(data?.upcoming_events) ? data.upcoming_events : []).filter(e => available && valid(e) && ['upcoming','imminent'].includes(e.status) && parse(e.event_time)>Date.now() && recent(e.last_verified, 2*3600000) && url(e.source_url));
    upcoming.sort((a,b) => parse(a.event_time)-parse(b.event_time));
    upcoming.slice(0,5).forEach(item => {
      const row = node('div', '', 'research-item');
      row.append(node('time', new Date(item.event_time).toLocaleString('en-AU', {timeZone:'Australia/Brisbane',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) + ' Brisbane', 'research-date'));
      row.firstChild.dateTime=item.event_time;
      row.append(node('h4', item.title), node('span', item.impact, 'research-impact'), node('p', item.category + ' · ' + item.affected_assets.join(', '), 'research-meta'));
      const link=node('a', item.source + ' ↗', 'text-link'); link.href=url(item.source_url); link.target='_blank'; link.rel='noopener noreferrer'; row.append(link);
      row.append(node('small','Verified '+new Date(item.last_verified).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' Brisbane','research-meta'));
      events.append(row);
    });
    if (!events.childElementCount) events.append(node('p', available ? 'No major upcoming events currently tracked.' : stale ? 'Events stale · awaiting verification.' : 'Upcoming events unavailable.', 'muted'));
    if (data?.unverified_event_count>0) events.append(node('p','Unverified events excluded pending source checks.','data-note'));
    if (data?.macro_events?.status === 'unavailable') events.append(node('p','Macro calendar unavailable · structured source not connected.','data-note'));
  }
  async function refresh() {
    try {
      const response = await fetch('https://api.rrr.trading/api/research', {cache:'no-store', signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw Error('Unavailable');
      render(await response.json());
    } catch { render(null); }
  }
  window.refreshResearch = refresh;
  window.renderResearch = render;
  refresh();
  window.setInterval(() => { if (!document.hidden) refresh(); }, 300000);
})();

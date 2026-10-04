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
    root.dataset.marketResearchAvailable = String(Boolean(available));
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
    if (!events.childElementCount) events.append(node('p', available ? data?.macro_events?.status === 'unavailable' ? 'Event calendar coverage unavailable.' : 'No major events detected in verified coverage.' : stale ? 'Events stale · awaiting verification.' : 'Upcoming events unavailable.', 'muted'));
    if (data?.unverified_event_count>0) events.append(node('p','Unverified events excluded pending source checks.','data-note'));
    if (data?.macro_events?.status === 'unavailable') events.append(node('p','Macro calendar unavailable · structured source not connected.','data-note'));
  }
  const checked = value => Number.isFinite(parse(value)) ? new Date(value).toLocaleString('en-AU', {timeZone:'Australia/Brisbane'}) + ' Brisbane' : 'Unavailable';
  const level = score => score >= 80 ? 'VERY HIGH' : score >= 60 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
  const calendarDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value;
  const dayLabel = value => new Date(value + 'T00:00:00Z').toLocaleDateString('en-AU', {timeZone:'UTC',day:'2-digit',month:'short',year:'numeric'});
  function eventDate(item) {
    if (item.date_precision === 'EXACT' && Number.isFinite(parse(item.event_date))) return checked(item.event_date);
    if (item.date_precision === 'DAY' && calendarDay(item.event_date)) return dayLabel(item.event_date) + ' · source calendar date';
    if (item.date_precision === 'DATE_RANGE' && calendarDay(item.event_date) && calendarDay(item.event_end_date) && item.event_end_date >= item.event_date) return dayLabel(item.event_date) + ' – ' + dayLabel(item.event_end_date) + ' · source calendar dates';
    if (item.date_precision === 'MONTH' && /^\d{4}-(0[1-9]|1[0-2])$/.test(item.event_date || '')) return new Date(item.event_date + '-01T00:00:00Z').toLocaleDateString('en-AU',{timeZone:'UTC',month:'long',year:'numeric'}) + ' · exact date TBC';
    if (item.date_precision === 'QUARTER' && /^\d{4}-Q[1-4]$/.test(item.event_date || '')) return item.event_date.split('-').reverse().join(' ') + ' · exact date TBC';
    if (item.date_precision === 'TBC') return 'Date TBC';
    return null;
  }
  function sourceLink(source) {
    if (!url(source?.url)) return null;
    const link = node('a', (source.name || 'Official source') + ' ↗', 'text-link');
    link.href=url(source.url); link.target='_blank'; link.rel='noopener noreferrer'; return link;
  }
  function renderCatalysts(eventData, themeData) {
    const events=byId('research-events'); events.replaceChildren();
    const labels={EVENTS_AVAILABLE:'Events available',NO_EVENTS:'No major events detected',PARTIAL:'Partial data',SOURCE_UNAVAILABLE:'Sources temporarily unavailable',STALE:'Saved events stale · awaiting verification'};
    const state=Object.hasOwn(labels,eventData?.status || '') ? eventData.status : 'SOURCE_UNAVAILABLE';
    const stale=state==='STALE' || !!eventData?.generated_at && !recent(eventData.generated_at,30*3600000);
    events.append(node('p',stale ? labels.STALE : labels[state],'data-note'));
    const rows=(Array.isArray(eventData?.events) ? eventData.events : []).filter(e => e && typeof e.title==='string' && e.title.trim() &&
      ['CONFIRMED','TENTATIVE','TBC','UPDATED'].includes(e.status) && typeof e.importance==='number' && Number.isFinite(e.importance) && e.importance>=0 && e.importance<=100 &&
      typeof e.confidence==='number' && Number.isFinite(e.confidence) && e.confidence>=0 && e.confidence<=100 && Array.isArray(e.assets) && e.assets.length && e.assets.every(a=>typeof a==='string') &&
      url(e.primary_source?.url) && (!['CONFIRMED','UPDATED'].includes(e.status) || e.confidence>=80 && ['PRIMARY','AUTHORITATIVE_STRUCTURED','SECONDARY_CONFIRMED'].includes(e.source_quality)) && eventDate(e) && !(e.date_precision==='EXACT' && parse(e.event_end_date || e.event_date)<Date.now()) &&
      (!['MONTH','QUARTER','TBC'].includes(e.date_precision) || ['TENTATIVE','TBC'].includes(e.status)));
    rows.sort((a,b)=>(b.priority_score || b.importance)-(a.priority_score || a.importance));
    const seen=new Set();
    rows.filter(e=>{const key=e.event_id || e.title+'|'+e.event_date;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,8).forEach(item=>{
      const row=node('div','','research-item catalyst-item');
      row.append(node('time',eventDate(item),'research-date'),node('h4',item.title),node('span',level(item.importance),'research-impact'));
      const scope=['MACRO','ALL_CRYPTO'].includes(item.market_scope) || item.assets.includes('ALL') ? 'ALL CRYPTO' : item.assets.join(', ');
      const timing=['MONTH','QUARTER','TBC'].includes(item.date_precision) ? 'Exact date TBC' : Number.isFinite(item.days_until) ? item.days_until===0 ? 'Today / in progress' : item.days_until<0 ? 'In progress' : item.days_until+' days' : 'Timing unavailable';
      row.append(node('p',scope+' · '+String(item.category || 'OTHER').replaceAll('_',' ')+' · '+timing,'research-meta'));
      row.append(node('p',item.status+' · confidence '+item.confidence+'/100'+(stale || item.source_stale ? ' · STALE, verify with source' : ''),'research-meta'));
      row.append(sourceLink(item.primary_source),node('small','Verified '+checked(item.last_verified_at),'research-meta'));
      events.append(row);
    });
    if (!rows.length && state!=='NO_EVENTS') events.append(node('p',state==='SOURCE_UNAVAILABLE' ? 'The event scan is unavailable. Coverage cannot be assessed.' : stale ? 'Awaiting fresh source verification.' : 'No verified upcoming items in the available coverage.','muted'));
    const health=eventData?.source_health;
    if (health && typeof health==='object') {
      const active=Object.values(health).filter(h=>h && h.status!=='disabled');
      events.append(node('p',active.filter(h=>h.status==='healthy').length+'/'+active.length+' connected sources healthy'+(stale?' at last scan':'')+' · checked '+checked(eventData.generated_at),'data-note'));
    }
    const themes=byId('research-themes');
    themes.querySelectorAll('[data-catalyst-theme]').forEach(el=>el.remove());
    const themeStale=themeData?.status==='STALE' || !recent(themeData?.generated_at,30*3600000);
    (Array.isArray(themeData?.themes) ? themeData.themes : []).filter(t=>t && typeof t.title==='string' && typeof t.summary==='string' && ['ACTIVE','WATCH','FADING'].includes(t.status) && Array.isArray(t.assets) && t.assets.every(a=>typeof a==='string') && Number.isFinite(t.importance) && Number.isFinite(t.confidence) && Array.isArray(t.supporting_sources) && t.supporting_sources.some(s=>url(s?.url))).slice(0,4).forEach(item=>{
      const row=node('div','','research-item catalyst-item'); row.dataset.catalystTheme=item.theme_id;
      row.append(node('h4',item.title),node('span',level(item.importance),'research-impact'),node('p',item.summary,'theme-summary'));
      row.append(node('p',item.assets.join(', ')+' · '+item.status+' · '+(item.horizon || 'Developing')+' · confidence '+item.confidence+'/100'+(themeStale || item.source_stale ? ' · STALE evidence' : ''),'research-meta'));
      const details=node('details','','theme-details'); details.append(node('summary','Evidence & sources'));
      item.supporting_sources.forEach(s=>{const link=sourceLink(s);if(link){const p=node('p',s.title ? s.title+' · ' : '','research-meta');p.append(link);details.append(p);}});
      row.append(details,node('small','Checked '+checked(item.last_updated_at),'research-meta')); themes.append(row);
    });
    const catalystAvailable=['EVENTS_AVAILABLE','PARTIAL','NO_EVENTS'].includes(eventData?.status) && !stale || ['EVENTS_AVAILABLE','PARTIAL','NO_EVENTS'].includes(themeData?.status) && !themeStale;
    if (catalystAvailable && (state==='PARTIAL' || root.dataset.marketResearchAvailable!=='true')) {
      byId('research-status').textContent='Partial research coverage';
      if (root.dataset.marketResearchAvailable!=='true') byId('research-updated').textContent='Catalyst snapshot: '+checked(eventData?.generated_at || themeData?.generated_at)+' · market themes unavailable.';
    }
  }
  async function refresh() {
    const get=async path=>{try{const response=await fetch('https://api.rrr.trading'+path,{cache:'no-store',signal:AbortSignal.timeout(10000)});return response.ok ? await response.json() : null;}catch{return null;}};
    const [market,events,themes]=await Promise.all([get('/api/research'),get('/api/research/events/upcoming'),get('/api/research/themes/latest')]);
    render(market); renderCatalysts(events,themes);
  }
  window.refreshResearch = refresh;
  window.renderResearch = render;
  window.renderCatalysts = renderCatalysts;
  refresh();
  window.setInterval(() => { if (!document.hidden) refresh(); }, 300000);
})();

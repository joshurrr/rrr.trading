'use strict';
// Read-only presentation rules. No execution scores, weights or controls are changed.
(() => {
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const time = v => typeof v === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(v) ? Date.parse(v) : NaN;
  const recent = (v, age, now) => now - time(v) >= -30000 && now - time(v) <= age;
  const signed = v => finite(v) && v >= -100 && v <= 100;
  const score = v => finite(v) && v >= 0 && v <= 100;
  const official = v => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password && ['fred.stlouisfed.org','www.bls.gov','www.bea.gov','www.rba.gov.au','www.federalreserve.gov','www.ecb.europa.eu','www.bankofengland.co.uk','www.boj.or.jp','www.ons.gov.uk','www.abs.gov.au','www.census.gov','ec.europa.eu','www.stat.go.jp','www.esri.cao.go.jp'].includes(u.hostname); } catch { return false; } };
  const rules = new Set(['us-cpi','us-employment','us-gdp','us-pce','au-policy','us-policy','eu-policy','jp-policy','uk-policy','uk-cpi','uk-employment','uk-gdp','au-cpi','au-employment','au-gdp','us-ppi','us-retail','uk-monthly-gdp','eu-inflation','eu-flash-inflation','eu-gdp-employment','jp-cpi','jp-gdp']);
  const format = v => Number.isFinite(time(v)) ? new Date(v).toLocaleString('en-AU', {timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short',hourCycle:'h23'}) + ' Brisbane' : 'Unavailable';
  function assess(context, macro, calendar, now = Date.now()) {
    const c = context?.crypto, m = context?.macro;
    const cycle = new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'});
    const cycleAt = new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',hour:'2-digit',hourCycle:'h23'}).format(now) < '07' ? now-86400000 : now;
    const contextOK = context?.ok === true && context.mode === 'observation_only' && context.fresh === true && recent(context.generated_at, 660000, now);
    const cryptoOK = contextOK && c?.available === true && c.fresh === true && signed(c.bias_score) && recent(c.updated_at, 1020000, now) && time(c.valid_until) > now && finite(c.coverage) && c.coverage >= .5 && c.coverage <= 1;
    const macroOK = contextOK && m?.available === true && m.fresh === true && signed(m.bias_score) && m.source === 'daily_macro_report' && m.report_date === cycle.format(cycleAt) && recent(m.generated_at, 86400000, now) && finite(m.coverage) && m.coverage >= .5 && m.coverage <= 1;
    const calendarOK = calendar?.schema_version === 1 && ['ok','partial'].includes(calendar.status) && calendar.stale !== true && recent(calendar.generated_at,86400000,now) && time(calendar.expires_at) > now && Array.isArray(calendar.events);
    const imminent = calendarOK ? calendar.events.filter(e => e && e.stale !== true && e.impact === 'HIGH' && e.impact_verified === true && official(e.impact_source) && e.impact_classification_owner === 'RRR.Trading' && e.impact_classification_version === 'rrr-economic-impact-v1' && rules.has(e.impact_classification_rule) && typeof e.impact_classification_basis === 'string' && e.impact_classification_basis.trim() && e.time_status === 'VERIFIED' && official(e.time_source) && recent(e.source_last_success,86400000,now) && typeof e.title === 'string' && e.title.trim() && !['CANCELLED','POSTPONED','MISSING_FROM_SOURCE','CONFIRMED_RELEASED','RELEASED','COMPLETED'].includes(e.event_status) && time(e.scheduled_at) >= now && time(e.scheduled_at) <= now + 3600000 && (() => { try { return new Intl.DateTimeFormat('en-CA',{timeZone:e.release_timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(e.scheduled_at)) === e.release_date; } catch { return false; } })()).sort((a,b) => time(a.scheduled_at)-time(b.scheduled_at))[0] : null;
    const coverage = `${cryptoOK || macroOK || calendarOK ? 'PARTIAL' : context || calendar ? 'STALE / INVALID' : 'UNAVAILABLE'} · Crypto ${cryptoOK ? 'current' : c ? 'stale / invalid' : 'unavailable'} · Macro ${macroOK ? 'daily snapshot' : m ? 'stale / invalid' : 'unavailable'} · Calendar ${calendarOK ? calendar.status === 'partial' ? 'partial' : 'available' : calendar ? 'stale / invalid' : 'unavailable'} · News verification incomplete`;
    const updated = `Last intelligence update: ${format(context?.generated_at)}`;
    if (!cryptoOK || !macroOK) return {mood:'UNKNOWN',headline:'The market picture is incomplete.',interpretation:'Fresh crypto and valid global macro evidence are both needed for an overall assessment. Missing intelligence does not establish calm conditions.',vibe:'The weather station is missing a reading.',coverage,updated,direction:'DIRECTION UNKNOWN · insufficient comparable evidence'};
    // Mood is a presentation interpretation of signed context, not a new trading model.
    const defensive = Math.min(c.bias_score, m.bias_score);
    let mood = defensive <= -50 ? 'FEARFUL' : defensive <= -20 ? 'NERVOUS' : c.bias_score >= 20 && m.bias_score >= 20 ? 'OPTIMISTIC' : 'CAUTIOUS';
    const reportOK = macro?.report_type === 'macro_base' && macro.timezone === 'Australia/Brisbane' && macro.report_date === cycle.format(cycleAt) && recent(macro.generated_at,86400000,now) && macro.generated_at === m.generated_at;
    const vol = reportOK ? macro.components?.volatility : null;
    const volatilityRisk = score(vol?.score) && vol.score < 40 && vol.provenance?.observations?.some(o => o.series_id === 'VIXCLS' && o.fresh === true && finite(o.value));
    if (volatilityRisk && !['FEARFUL','NERVOUS'].includes(mood)) mood = 'NERVOUS';
    if (imminent && !['FEARFUL','NERVOUS'].includes(mood)) mood = 'NERVOUS';
    // Raw news_attention items (including single-source/opinion reports) cannot set mood.
    const development = (Array.isArray(context.events?.active) ? context.events.active : []).find(e => e?.status === 'available' && e.stage === 'active' && e.market_scope === 'market' && e.importance === 'high' && e.event_type !== 'news_attention' && e.direction === 'bearish' && e.contradiction === false && e.reporting_disagreement === false && e.freshness?.source_healthy === true && recent(e.published_at,21600000,now) && time(e.expires_at) > now && finite(e.event_confidence) && e.event_confidence >= .8 && e.corroboration_count >= 2 && new Set((Array.isArray(e.evidence) ? e.evidence : []).filter(s => s && s.origin_group && s.origin_group !== 'unverified_reporting' && recent(s.retrieved_at,3600000,now)).map(s => s.origin_group)).size >= 2 && typeof e.headline === 'string' && e.headline.trim());
    if (development && mood !== 'FEARFUL') mood = 'NERVOUS';
    const cryptoText = c.bias_score <= -20 ? 'Crypto weakness' : c.bias_score >= 20 ? 'Crypto strength' : 'Mixed crypto momentum';
    const macroText = m.bias_score <= -20 ? 'a defensive global backdrop' : m.bias_score >= 20 ? 'a supportive global backdrop' : 'a mixed global backdrop';
    let headline = `${cryptoText} meets ${macroText}.`;
    let interpretation = `${c.bias_score <= -20 ? 'The tracked crypto market leans bearish' : c.bias_score >= 20 ? 'The tracked crypto market leans bullish' : 'The tracked crypto market has no clear directional lean'}, while the saved daily macro assessment is ${m.bias_score <= -20 ? 'defensive' : m.bias_score >= 20 ? 'supportive' : 'mixed'}. `;
    const components = c.components;
    interpretation += signed(components?.breadth) && signed(components?.market_momentum) ? components.breadth < 0 && components.market_momentum > 0 ? 'Short-term momentum is positive despite weaker market breadth.' : components.breadth > 0 && components.market_momentum < 0 ? 'Broad participation is positive, but short-term momentum is pulling back.' : components.breadth < 0 ? 'Market breadth reinforces the cautious tone.' : components.breadth > 0 ? 'Positive market breadth supports the stronger tone.' : 'Market breadth is evenly balanced.' : 'Detailed breadth and momentum coverage is incomplete.';
    if (volatilityRisk) interpretation += ' The daily volatility assessment adds a risk headwind.';
    if (development) { headline = 'A major developing report clouds the market.'; interpretation = `Corroborated report: ${development.headline}. This developing risk takes priority over routine momentum; possible market consequences remain uncertain.`; }
    if (imminent) { headline = 'A major economic release is approaching.'; interpretation = `Verified schedule: ${imminent.title} · ${format(imminent.scheduled_at)}. Release uncertainty takes priority over routine crypto momentum; its market impact is still unknown.`; if (development) interpretation += ` Also developing: ${development.headline}.`; }
    const vibe = {FEARFUL:'The wind is against risk; a rebound is still unproven.',NERVOUS:'The ground is unsettled; conviction is fragile.',OPTIMISTIC:'The wind is at risk’s back, with gaps still on the radar.',CAUTIOUS:'Crosswinds dominate; the evidence has yet to line up.'}[mood];
    // Comparable cohort, source coverage and catalyst regime; never compare poll times.
    const key = JSON.stringify([context.universe,c.coverage,m.coverage,calendarOK ? calendar.status : 'missing',Boolean(volatilityRisk),imminent?.event_id || imminent?.id || null,development?.event_id || null]);
    return {mood,headline,interpretation,vibe,coverage,updated:updated + ` · Crypto observed: ${format(c.updated_at)} · Macro saved: ${format(m.generated_at)}`,observation:{key,crypto:c.bias_score,macro:m.bias_score,cryptoAt:time(c.updated_at),macroAt:time(m.generated_at),at:now},direction:'DIRECTION UNKNOWN · awaiting a comparable update'};
  }
  function direction(current, previous) {
    if (!current || !previous || current.key !== previous.key || current.at - previous.at > 1800000 || current.cryptoAt < previous.cryptoAt || current.macroAt < previous.macroAt || current.cryptoAt === previous.cryptoAt && current.macroAt === previous.macroAt) return null;
    const changes = [current.crypto - previous.crypto,current.macro - previous.macro];
    if (changes.every(v => Math.abs(v) < 5)) return 'STABLE →';
    if (changes.every(v => v >= -5) && changes.some(v => v >= 5)) return 'IMPROVING ↗';
    if (changes.every(v => v <= 5) && changes.some(v => v <= -5)) return 'DETERIORATING ↘';
    return 'DIRECTION UNKNOWN · conflicting changes';
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = {assess,direction}; return; }
  const root = document.getElementById('market-vibe');
  if (!root) return;
  let values = [null,null,null], previous = null, lastDirection = null, busy = false, ready = false;
  function render() {
    if (!ready) return;
    const result = assess(...values);
    const observation = result.observation;
    const same = observation && previous && observation.key === previous.key && observation.cryptoAt === previous.cryptoAt && observation.macroAt === previous.macroAt && observation.at-previous.at <= 1800000;
    if (!same) { lastDirection = direction(observation,previous); previous = observation || null; }
    root.dataset.mood = result.mood.toLowerCase();
    for (const field of ['headline','interpretation','vibe','coverage','updated']) document.getElementById('vibe-'+field).textContent = result[field];
    const sessions = window.SiteHeader?.activeSessions?.();
    document.getElementById('vibe-sessions').textContent = Array.isArray(sessions) ? `Regional windows: ${sessions.length ? sessions.join(' + ') : 'outside the usual weekday windows'} · indicative hours; holidays not verified` : 'Regional session context unavailable';
    document.getElementById('vibe-mood').textContent = result.mood === 'UNKNOWN' ? 'MARKET VIBE UNKNOWN' : result.mood;
    document.getElementById('vibe-direction').textContent = lastDirection || result.direction;
    document.getElementById('vibe-direction').title = 'Compared with the previous distinct valid observation in this visit, within 30 minutes; 5-point tolerance on existing context scores.';
  }
  async function refresh() {
    if (busy) return; busy = true;
    try {
      const day = expectedMacroDate();
      const results = await Promise.allSettled(['/api/trading-context', day === brisbaneDate() ? '/api/reports/macro/today' : '/api/reports/macro/'+day, '/api/schedule/economic'].map(getPublic));
      values = results.map(r => r.status === 'fulfilled' ? r.value : null); ready = true; render();
    } finally { busy = false; }
  }
  window.refreshMarketVibe = refresh;
  refresh();
  setInterval(() => { render(); if (!document.hidden) refresh(); },30000);
  document.addEventListener('visibilitychange',() => { if (!document.hidden) { render(); refresh(); } });
})();

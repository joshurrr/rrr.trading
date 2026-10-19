'use strict';
// Public presentation only. No V3 fallback, private feeds, LLM or trading actions.
(() => {
  const root = document.getElementById('v4-overview');
  if (!root) return;
  const $ = suffix => document.getElementById('v4-' + suffix);
  const endpoint = 'https://v4.rrr.trading/v4/paper';
  const stamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  const format = value => stamp(value) === null ? 'Timestamp unavailable' : new Intl.DateTimeFormat('en-AU', {
    timeZone:'Australia/Brisbane', dateStyle:'medium', timeStyle:'short'
  }).format(new Date(value)) + ' AEST';
  const expired = value => stamp(value) !== null && Date.now() >= stamp(value);
  const badge = (id, state) => { $(id).textContent = state; $(id).dataset.state = state; };
  let busy = false, snapshot = null;

  function unavailable(message) {
    for (const prefix of ['sentiment', 'paper']) badge(prefix + '-state', 'UNAVAILABLE');
    $('sentiment-value').textContent = 'Assessment unavailable';
    $('sentiment-detail').textContent = 'No verified public V4 sentiment.';
    $('sentiment-time').textContent = 'Assessment timestamp unavailable.';
    $('paper-value').textContent = 'Cycle unavailable';
    $('paper-detail').textContent = 'Monitoring coverage unknown.';
    $('paper-time').textContent = 'Cycle timestamp unavailable.';
    $('overview-status').textContent = message;
  }

  function render() {
    if (!snapshot) return;
    const sentiment = snapshot.sentiment, cycle = snapshot.latest_cycle;
    const at = stamp(sentiment.assessment_timestamp), end = stamp(sentiment.entry_expires_at);
    const dated = at !== null && end !== null && at <= Date.now() && end > at;
    const current = dated && !expired(sentiment.entry_expires_at) && sentiment.availability === 'AVAILABLE' && sentiment.context_state === 'CURRENT' && sentiment.status === 'USABLE';
    const historical = dated && sentiment.availability === 'STALE' && sentiment.context_state === 'CONTEXT_ONLY';
    const stale = dated && (historical || sentiment.context_state === 'CURRENT' && expired(sentiment.entry_expires_at));
    badge('sentiment-state', current ? 'CURRENT' : stale ? 'STALE' : 'UNAVAILABLE');
    const direction = {UP:'Upward pressure ↗', DOWN:'Downward pressure ↘', NEUTRAL:'Neutral pressure →'}[sentiment.market_direction] || 'Direction unknown';
    $('sentiment-value').textContent = current ? direction : stale ? 'Historical · ' + direction.toLowerCase() : 'Assessment unavailable';
    $('sentiment-detail').textContent = current ? 'Current saved AI context · never trade approval.' : historical && !expired(sentiment.entry_expires_at) ? 'CONTEXT_ONLY · supporting evidence is stale.' : stale ? 'Assessment expired · not current confirmation.' : 'BLOCKED or unavailable · no fresh confirmation.';
    $('sentiment-time').textContent = 'Assessed: ' + format(sentiment.assessment_timestamp) + ' · Expires: ' + format(sentiment.entry_expires_at);

    const cycleAt = stamp(cycle.started_at);
    const available = ['AVAILABLE','STALE'].includes(cycle.availability) && cycleAt !== null && cycleAt <= Date.now() && ['OK','ATTENTION','BLOCKED'].includes(cycle.status);
    const failures = cycle.monitoring?.unmonitored;
    const known = Array.isArray(failures);
    // No public cycle expiry is supplied: describe an available cycle as SAVED,
    // not a claim of continuous monitoring or live execution.
    badge('paper-state', !available ? 'UNAVAILABLE' : cycle.availability === 'STALE' ? 'STALE' : cycle.status === 'OK' ? 'SAVED' : 'ATTENTION');
    $('paper-value').textContent = available ? 'PAPER · ' + cycle.status : 'Cycle unavailable';
    const reasons = Array.isArray(cycle.reasons) ? cycle.reasons.filter(v => typeof v === 'string').slice(0,3).map(v => v.replaceAll('_',' ')).join(' · ') : '';
    $('paper-detail').textContent = !available || !known ? 'Monitoring coverage unknown.' : failures.length ? failures.length + ' unmonitored paper position' + (failures.length === 1 ? '' : 's') + ' · ' + (reasons || 'monitoring attention') : cycle.monitoring.status !== 'OK' ? 'Monitoring requires attention.' : 'Last cycle: no unmonitored positions reported.';
    $('paper-time').textContent = 'Last cycle: ' + format(cycle.started_at);
    $('overview-status').textContent = 'Partial public coverage · API snapshot: ' + format(snapshot.served_at) + '. Other observations are not exposed.';
  }

  async function refresh() {
    if (busy) return;
    busy = true; root.setAttribute('aria-busy','true');
    try {
      const response = await fetch(endpoint, {method:'GET', credentials:'omit', redirect:'error', cache:'no-store', signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error('unavailable');
      const value = await response.json();
      if (value?.version !== 'paper-read-api-v1' || value.mode !== 'paper' ||
          !value.sentiment || !value.latest_cycle || [value.sentiment,value.latest_cycle].some(v => typeof v !== 'object' || Array.isArray(v) || (v.mode && v.mode !== 'paper'))) throw new Error('invalid_paper_feed');
      snapshot = value; render();
    } catch (_) {
      snapshot = null;
      unavailable('V4 public feed unavailable · connection or homepage access could not be verified.');
    } finally { busy = false; root.setAttribute('aria-busy','false'); }
  }
  window.refreshV4Overview = refresh;
  refresh();
  setInterval(render, 1000); // Recheck source-provided sentiment expiry without requests.
  setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  document.addEventListener('visibilitychange', () => { render(); if (!document.hidden) refresh(); });
})();

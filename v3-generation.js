'use strict';
(() => {
  const phases = new Set(['REBUILDING', 'VERIFYING', 'ACTIVE', 'FAILED', 'RESTART_HOLD']);
  function valid(value, now = Date.now()) {
    const at = Date.parse(value?.factory_reset_at);
    return value?.generation === 3 && value.application === 'RRR.Trading V3' && phases.has(value.phase) &&
      typeof value.entries_blocked === 'boolean' && Number.isFinite(at) && at <= now + 30000 &&
      /(?:Z|[+-]\d\d:\d\d)$/i.test(value.factory_reset_at) &&
      (value.run_id === null || /^v3-paper-[A-Za-z0-9-]{1,60}$/.test(value.run_id)) &&
      (value.phase === 'ACTIVE' ? Boolean(value.run_id) : value.entries_blocked === true);
  }
  function firstTrade(status, runId, now = Date.now()) {
    const opened = [];
    for (const bot of ['short', 'medium', 'long']) {
      const data = status?.[bot], start = Date.parse(data?.run_started_at);
      if (data?.run_id !== runId || !Number.isFinite(start) || !Array.isArray(data.history) ||
          !Array.isArray(data.open_trades) || data.portfolio?.closed_trades !== data.history.length) return null;
      for (const trade of [...data.history, ...data.open_trades]) {
        const value = trade?.open_date;
        if (typeof value !== 'string') return null;
        const at = Date.parse(/(?:Z|[+-]\d\d:\d\d)$/i.test(value) ? value : value.replace(' ', 'T') + 'Z');
        if (!Number.isFinite(at) || at < start || at > now) return null;
        opened.push(at);
      }
    }
    return opened.length ? Math.min(...opened) : null;
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = {valid, firstTrade}; return; }
  let generation = null, observed = 0, activity = null, activityObserved = 0;
  const main = document.getElementById('main'), panel = document.getElementById('v3-generation');
  if (!main || !panel) return;
  const title = document.createElement('h1'), state = document.createElement('p'), detail = document.createElement('p');
  title.textContent = 'RRR.Trading V3'; state.setAttribute('role', 'status');
  panel.append(title, state, detail);
  function current() { return generation && Date.now() - observed < 30000 ? generation : null; }
  window.RRRGeneration = Object.freeze({
    current,
    updateActivity(status, metadata) {
      const at = this.acceptsRun(metadata) ? firstTrade(status, metadata.run_id) : null;
      activity = at === null ? null : {run_id:metadata.run_id, at};
      activityObserved = Date.now();
      draw();
    },
    acceptsRun(metadata) {
      const g = current(), start = Date.parse(metadata?.started_at);
      return Boolean(g?.run_id && /^v3-paper-/.test(metadata?.run_id) && g.run_id === metadata.run_id &&
        /(?:Z|[+-]\d\d:\d\d)$/i.test(metadata?.started_at) &&
        Number.isFinite(start) && start >= Date.parse(g.factory_reset_at) && start <= Date.now() + 30000);
    }
  });
  function draw() {
    const g = current();
    const visible = Boolean(g?.run_id && ['ACTIVE', 'VERIFYING', 'RESTART_HOLD'].includes(g.phase));
    main.hidden = !visible;
    document.documentElement.classList.toggle('v3-ready', visible);
    state.textContent = !g ? 'V3 initialization has not been verified. Trading information is unavailable.' :
      g.phase === 'FAILED' ? 'V3 restart needs attention. New PAPER entries remain blocked.' :
      g.phase === 'REBUILDING' ? 'Collecting fresh intelligence. New PAPER entries remain blocked.' :
      g.entries_blocked ? 'V3 PAPER run initialized. New entries remain blocked during verification.' :
      'V3 PAPER trading · current run only';
    const tradingAt = activity && g && activity.run_id === g.run_id && Date.now() - activityObserved < 45000 ? activity.at : null;
    const timing = document.body.id === 'home' ? tradingAt !== null ?
      `Trading began: ${new Date(tradingAt).toLocaleString('en-AU', {timeZone:'Australia/Brisbane'})} Brisbane (first recorded trade).` :
      'Trading start: awaiting verified current-run trade evidence.' :
      `V3 initialized: ${new Date(g?.factory_reset_at).toLocaleString('en-AU', {timeZone:'Australia/Brisbane'})} Brisbane.`;
    detail.textContent = g ? `${timing} Existing LONG and SHORT trading is supported, subject to entry checks. Tested leverage: 1x. Confidence-based leverage from 1x to 2x is not active.` :
      'Historical trading and intelligence are withheld until the V3 generation is verified.';
  }
  async function refresh() {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch('https://api.rrr.trading/api/system/generation', {cache:'no-store', signal:controller.signal});
      const value = response.ok ? await response.json() : null;
      generation = valid(value) ? value : null; observed = Date.now();
      if (generation?.run_id && ['ACTIVE', 'VERIFYING', 'RESTART_HOLD'].includes(generation.phase)) {
        // A new installation invalidates all prior in-memory component feeds.
        // Reload only this page/iframe; the Radio RRR shell keeps playing.
        const key = 'rrr.trading.v3.loaded-generation';
        try {
          if (sessionStorage.getItem(key) !== generation.factory_reset_at) {
            sessionStorage.setItem(key, generation.factory_reset_at); location.reload(); return;
          }
        } catch (_) { generation = null; }
      }
    } catch (_) { generation = null; }
    finally { clearTimeout(timer); draw(); }
  }
  draw(); refresh(); setInterval(refresh, 10000); setInterval(draw, 1000);
})();

/* Phase 3 diagnostics. Reads public research records; never controls a bot. */
(() => {
  'use strict';
  const panel = document.getElementById('shadow-decisions');
  if (!panel) return;
  const bot = panel.dataset.bot;
  if (!['medium', 'short', 'long'].includes(bot)) return;
  const content = panel.querySelector('[data-shadow-content]');
  const status = panel.querySelector('[data-shadow-status]');
  let snapshot = null;
  let fetchedAt = 0;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const count = value => Number.isInteger(value) && value >= 0 ? String(value) : 'Unavailable';
  function paragraph(text) {
    const p = document.createElement('p');
    p.textContent = text;
    content.append(p);
  }
  function row(label, value) {
    const node = document.createElement('div');
    node.className = 'context-row';
    for (const text of [label, value]) {
      const span = document.createElement('span');
      span.textContent = text;
      node.append(span);
    }
    content.append(node);
  }
  const money = value => finite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(2)} USDT` : 'Unavailable';
  function render() {
    content.replaceChildren();
    if (!snapshot || Date.now() - fetchedAt > 90000) {
      status.textContent = snapshot ? 'Shadow feed stale / unavailable' : 'Shadow endpoint unavailable';
      paragraph('Awaiting verified shadow research data.');
      return;
    }
    const {events, summary, health} = snapshot;
    const botHealth = health.bots?.[bot];
    const lastPoll = Date.parse(botHealth?.last_poll_at);
    const live = health.worker_running === true && botHealth?.status === 'healthy' &&
      Number.isFinite(lastPoll) && Date.now() - lastPoll >= -60000 && Date.now() - lastPoll <= 120000;
    status.textContent = `${({medium:'Medium 1hr',short:'Short Term 15m',long:'Long Term 4hr'})[bot]} only · Observer ${live ? 'healthy' : 'stale / unavailable or degraded'}`;
    const latest = events.decisions[0];
    if (latest) {
      row('Most recent observed signal', `${latest.asset} ${latest.direction.toUpperCase()}`);
      row('Shadow decision', latest.shadow_decision);
      row('Contextual support', finite(latest.shadow_confidence) && latest.shadow_confidence >= 0 && latest.shadow_confidence <= 100 ? `${latest.shadow_confidence.toFixed(0)} / 100` : 'Unavailable');
      const observed = Date.parse(latest.signal_at);
      paragraph(Number.isFinite(observed) ? `Signal observed ${new Date(observed).toLocaleString('en-AU', {timeZone: 'Australia/Brisbane'})} Brisbane. Historical decision; not a current recommendation.` : 'Signal timestamp unavailable.');
      if (Array.isArray(latest.reasons)) {
        const list = document.createElement('ul');
        for (const reason of latest.reasons.slice(0, 20)) {
          const item = document.createElement('li');
          item.textContent = String(reason);
          list.append(item);
        }
        content.append(list);
      }
    } else {
      paragraph('No shadow decisions recorded for this bot yet.');
    }
    row('Shadow decisions', count(summary.signals));
    row('Allowed / Rejected / Vetoed', [summary.shadow.allowed, summary.shadow.rejected, summary.shadow.vetoed].map(count).join(' / '));
    const effect = summary.estimated_filter_effect;
    if (effect?.completed_trades > 0 && ['avoided_loss_abs', 'missed_profit_abs', 'net_effect_abs'].every(k => finite(effect[k]))) {
      row('Losses on rejected / vetoed trades', money(effect.avoided_loss_abs));
      row('Missed winners', money(effect.missed_profit_abs));
      row('Net shadow effect', money(effect.net_effect_abs));
      paragraph(`Based on ${effect.completed_trades} uniquely linked completed paper trades. All trades still executed normally. Excludes replacement trades and portfolio effects.`);
    } else {
      paragraph('Rejected-trade outcomes unavailable — awaiting linked completed trades with realised P/L.');
    }
    paragraph('Confidence measures contextual support; it is not a probability of profit. Cumulative records may include periods with incomplete signal capture.');
  }
  async function refresh() {
    try {
      const paths = [`/api/shadow-decisions?bot=${bot}&limit=1`, `/api/shadow-decisions/summary?bot=${bot}`, '/api/shadow-decisions/health'];
      const [events, summary, health] = await Promise.all(paths.map(async path => {
        const response = await fetch('https://api.rrr.trading' + path, {cache: 'no-store', signal: AbortSignal.timeout(10000)});
        if (!response.ok) throw new Error('Unavailable');
        const data = await response.json();
        if (data.mode !== 'shadow') throw new Error('Invalid mode');
        return data;
      }));
      if (events.ok !== true || !Array.isArray(events.decisions) || events.decisions.some(d => d.bot !== bot || !['long','short'].includes(d.direction) || !['ALLOW','REJECT','VETO'].includes(d.shadow_decision)) || summary.ok !== true || summary.filters?.bot !== bot || !summary.shadow) throw new Error('Invalid bot data');
      snapshot = {events, summary, health};
      fetchedAt = Date.now();
    } catch {
      snapshot = null;
    }
    render();
  }
  render();
  refresh();
  setInterval(refresh, 30000);
  setInterval(render, 15000);
})();

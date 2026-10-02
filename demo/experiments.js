/* Read-only global policy comparison. No execution authority. */
(() => {
  'use strict';
  const container = document.getElementById('policy-comparison');
  if (!container) return;
  const content = container.querySelector('[data-policy-content]');
  const status = container.querySelector('[data-policy-status]');
  let snapshot = null;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const number = value => finite(value) ? value.toLocaleString(undefined, {maximumFractionDigits: 3}) : 'Unavailable';
  const percent = value => finite(value) ? (value * 100).toFixed(1) + '%' : 'Unavailable';
  function row(label, value) {
    const node = document.createElement('div');
    node.className = 'context-row';
    const name = document.createElement('span'); name.textContent = label;
    const reading = document.createElement('span'); reading.textContent = value ?? 'Unavailable';
    node.append(name, reading); content.append(node);
  }
  function render() {
    content.replaceChildren();
    const elapsed = Date.now() - Date.parse(snapshot?.generated_at);
    const fresh = snapshot?.ok === true && snapshot.mode === 'shadow' && Number.isFinite(elapsed) && elapsed >= -60000 && elapsed <= 120000;
    status.textContent = fresh ? 'Shared research across paper bots · Updated ' + new Date(snapshot.generated_at).toLocaleString('en-AU', {timeZone: 'Australia/Brisbane'}) + ' Brisbane' : snapshot ? 'Comparison data stale / unavailable' : 'Comparison endpoint unavailable';
    if (!fresh) { row('Champion / Challenger comparison', 'Unavailable'); return; }
    const s = snapshot, m = s.metrics, e = s.experiment;
    row('Current Champion', s.champion ? 'v' + s.champion.version : 'Unavailable');
    row('Active Challenger', s.challenger ? 'v' + s.challenger.version : 'None');
    row('Experiment', e?.name);
    row('Experiment status', e?.status);
    row('Comparison policy identities', s.comparison_policy_ids ? s.comparison_policy_ids.champion_policy_id + ' / ' + s.comparison_policy_ids.challenger_policy_id : 'Unavailable');
    row('Completed outcome sample', m ? number(m.completed_trade_outcomes) + ' / ' + number(m.minimum_sample) : 'Unavailable');
    row('Manual review status', m?.sample_state?.replaceAll('_', ' '));
    row('Decision agreement', percent(m?.decision_agreement_rate));
    const measured = finite(m?.completed_trade_outcomes) && m.completed_trade_outcomes > 0;
    row('Losing trades avoided', measured ? number(m.losing_trades_avoided) : 'Unavailable');
    row('Winning trades missed', measured ? number(m.winning_trades_missed) : 'Unavailable');
    row('Outcome delta (Challenger − Champion)', number(m?.net_outcome_delta));
    row('Champion profit factor', number(m?.champion?.profit_factor));
    row('Challenger profit factor', number(m?.challenger?.profit_factor));
    row('Drawdown comparison', number(m?.drawdown_comparison));
    row('Champion designation updated', s.effective_at ? new Date(s.effective_at).toLocaleString('en-AU', {timeZone: 'Australia/Brisbane'}) + ' Brisbane' : 'Unavailable');
  }
  async function refresh() {
    try {
      const response = await fetch('https://api.rrr.trading/api/experiments/summary', {cache: 'no-store', signal: AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error('Unavailable');
      snapshot = await response.json();
    } catch { snapshot = null; }
    render();
  }
  render(); refresh(); setInterval(refresh, 60000); setInterval(render, 15000);
})();

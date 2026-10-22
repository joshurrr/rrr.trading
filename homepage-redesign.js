'use strict';
// Homepage-only composition: retain the existing feed owners and renderers.
(() => {
  const activity = document.getElementById('live-candidate-progress');
  const activitySlot = document.getElementById('home-activity-slot');
  if (activity && activitySlot) activitySlot.replaceChildren(activity);

  const positions = document.getElementById('home-demo-positions');
  const positionsSlot = document.getElementById('home-positions-slot');
  if (positions && positionsSlot) positionsSlot.append(positions);

  const copy = () => {
    const history = activity?.querySelector('#homepage-trade-history');
    if (history) history.open = true;
    const count = document.getElementById('home-position-count');
    const countTarget = document.getElementById('home-open-count');
    if (count && countTarget) countTarget.textContent = count.textContent;
    const pnl = document.getElementById('home-position-pnl');
    const pnlTarget = document.getElementById('home-open-pnl');
    if (pnl && pnlTarget) {
      pnlTarget.textContent = pnl.textContent;
      pnlTarget.dataset.pnl = pnl.dataset.pnl || 'unknown';
    }
    const updated = document.getElementById('home-position-time');
    const updatedTarget = document.getElementById('home-data-updated');
    if (updated && updatedTarget) updatedTarget.textContent = updated.textContent.replace(/^Last updated:\s*/, '');
    const realized = document.querySelector('#activity-performance [data-performance="realized"]');
    const realizedTarget = document.getElementById('home-realized-pnl');
    if (realized && realizedTarget) {
      realizedTarget.textContent = realized.textContent;
      realizedTarget.dataset.tone = realized.dataset.tone || 'neutral';
    }
    const secondary = document.querySelector('[data-home-realized-secondary]');
    if (realized && secondary) {
      secondary.textContent = realized.textContent;
      secondary.dataset.tone = realized.dataset.tone || 'neutral';
    }
  };
  if (positions) new MutationObserver(copy).observe(positions, { childList:true, subtree:true, characterData:true, attributes:true });
  if (activity) new MutationObserver(copy).observe(activity, { childList:true, subtree:true, characterData:true, attributes:true });
  copy();
})();

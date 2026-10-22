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
    if (history && !history.open) history.open = true;
    const count = document.getElementById('home-position-count');
    const countTarget = document.getElementById('home-open-count');
    if (count && countTarget && countTarget.textContent !== count.textContent) countTarget.textContent = count.textContent;
    const pnl = document.getElementById('home-position-pnl');
    const pnlTarget = document.getElementById('home-open-pnl');
    if (pnl && pnlTarget) {
      if (pnlTarget.textContent !== pnl.textContent) pnlTarget.textContent = pnl.textContent;
      const tone = pnl.dataset.pnl || 'unknown';
      if (pnlTarget.dataset.pnl !== tone) pnlTarget.dataset.pnl = tone;
    }
    const updated = document.getElementById('home-position-time');
    const updatedTarget = document.getElementById('home-data-updated');
    const updatedText = updated?.textContent.replace(/^Last updated:\s*/, '');
    if (updatedTarget && updatedText && updatedTarget.textContent !== updatedText) updatedTarget.textContent = updatedText;
  };
  const observe = (root, attributes) => {
    if (!root) return;
    new MutationObserver(copy).observe(root, {
      childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:attributes
    });
  };
  observe(positions, ['data-pnl']);
  observe(activity, ['data-tone']);
  copy();
})();

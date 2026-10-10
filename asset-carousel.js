'use strict';
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  for (const id of ['universe-assets', 'visitor-cards']) {
    const track = document.getElementById(id);
    if (!track) continue;
    const shell = document.createElement('div');
    shell.className = 'asset-carousel';
    track.before(shell);
    shell.append(track);
    track.tabIndex = 0;
    track.setAttribute('role', 'region');
    track.setAttribute('aria-label', id === 'universe-assets' ? 'Default assets carousel' : 'My assets carousel');
    const arrows = [-1, 1].map(direction => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'asset-carousel-arrow';
      button.textContent = direction < 0 ? '‹' : '›';
      button.setAttribute('aria-label', direction < 0 ? 'Previous assets' : 'Next assets');
      button.setAttribute('aria-controls', id);
      button.disabled = true;
      button.addEventListener('click', () => {
        const card = track.querySelector('.universe-card');
        if (!card) return;
        const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap);
        track.scrollBy({ left: direction * step * 3, behavior: reduced.matches ? 'instant' : 'smooth' });
      });
      shell.append(button);
      return button;
    });
    let frame;
    function update() {
      frame = undefined;
      const max = track.scrollWidth - track.clientWidth;
      const before = track.clientWidth > 0 && track.scrollLeft > 2;
      const after = track.clientWidth > 0 && track.scrollLeft < max - 2;
      shell.dataset.before = String(before);
      shell.dataset.after = String(after);
      arrows[0].disabled = !before;
      arrows[1].disabled = !after;
    }
    const schedule = () => { if (frame === undefined) frame = requestAnimationFrame(update); };
    track.addEventListener('scroll', schedule, { passive: true });
    // Native horizontal trackpad/touch gestures remain browser-owned. A vertical
    // mouse wheel moves the strip only while it has room in that direction.
    track.addEventListener('wheel', event => {
      if (event.ctrlKey || event.deltaX || !event.deltaY) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? track.clientWidth : 1);
      const max = track.scrollWidth - track.clientWidth;
      if ((delta > 0 && track.scrollLeft >= max - 2) || (delta < 0 && track.scrollLeft <= 2)) return;
      event.preventDefault();
      track.scrollBy({ left: delta, behavior: 'instant' });
    }, { passive: false });
    new ResizeObserver(schedule).observe(track);
    new MutationObserver(schedule).observe(track, { childList: true, attributes: true, attributeFilter: ['hidden'] });
    schedule();
  }
})();

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
    let drag, suppressUntil = 0;
    function finishDrag() {
      if (!drag) return;
      const ended = drag;
      drag = undefined;
      ended.listeners.abort();
      if (ended.active) suppressUntil = performance.now() + 400;
      track.classList.remove('is-dragging');
      if (track.hasPointerCapture(ended.id)) track.releasePointerCapture(ended.id);
      schedule();
    }
    track.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      finishDrag();
      suppressUntil = 0;
      const listeners = new AbortController();
      drag = { id: event.pointerId, x: event.clientX, left: track.scrollLeft, active: false, listeners };
      window.addEventListener('pointermove', move => {
        if (!drag || move.pointerId !== drag.id) return;
        if (!(move.buttons & 1)) { finishDrag(); return; }
        const distance = move.clientX - drag.x;
        if (!drag.active && Math.abs(distance) <= 6) return;
        if (!drag.active) {
          drag.active = true;
          track.classList.add('is-dragging');
          track.setPointerCapture(drag.id);
          window.getSelection()?.removeAllRanges();
        }
        move.preventDefault();
        track.scrollLeft = drag.left - distance;
      }, { signal: listeners.signal, passive: false });
      const end = endEvent => { if (endEvent.pointerId === drag?.id) finishDrag(); };
      window.addEventListener('pointerup', end, { signal: listeners.signal });
      window.addEventListener('pointercancel', end, { signal: listeners.signal });
      window.addEventListener('blur', finishDrag, { signal: listeners.signal });
      track.addEventListener('lostpointercapture', end, { signal: listeners.signal });
    });
    track.addEventListener('click', event => {
      // Keyboard activation has detail=0 and must remain available after a drag.
      if (event.detail && performance.now() < suppressUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressUntil = 0;
      }
    }, true);
    track.addEventListener('dragstart', event => event.preventDefault());
    window.addEventListener('pagehide', finishDrag);
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

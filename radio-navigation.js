// Direct URLs retain their original documents. Only the top-level browsing
// context enters the persistent shell; page scripts run inside its single frame.
(() => {
  if (window.top !== window || !window.history.pushState) return;
  location.replace('/radio-shell.html?route=' + encodeURIComponent(location.pathname + location.search + location.hash));
})();

// Narrow layouts use the page directly. On desktop, only the top-level browsing
// context enters the persistent shell; page scripts run inside its single frame.
(() => {
  if (window.top !== window || !window.history.pushState || matchMedia('(max-width: 700px)').matches) return;
  location.replace('/radio-shell.html?route=' + encodeURIComponent(location.pathname + location.search + location.hash));
})();

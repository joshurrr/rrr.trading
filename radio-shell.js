'use strict';
(() => {
  const frame = document.querySelector('#page-content');
  const error = document.querySelector('#navigation-error');
  let timeout;
  const internal = value => {
    let url;
    try { url = new URL(value, location.href); } catch { return null; }
    return url.origin === location.origin && url.pathname !== '/radio-shell.html' &&
      (url.pathname.endsWith('/') || /\.html$/.test(url.pathname) || !url.pathname.split('/').pop().includes('.')) ? url : null;
  };
  const route = url => url.pathname + url.search + url.hash;
  function load(value, push = true) {
    const url = internal(value);
    if (!url) return;
    if (push) {
      history.replaceState({scrollY:frame.contentWindow.scrollY}, '', location.href);
      history.pushState(null, '', route(url));
    }
    document.querySelectorAll('[data-page]').forEach(link => {
      const key = url.pathname.startsWith('/demo/') || url.pathname.startsWith('/website/demo/') ? 'bots' : url.pathname.split('/')[1] || 'home';
      if (link.dataset.page === key) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    error.hidden = true;
    clearTimeout(timeout);
    timeout = setTimeout(() => { error.hidden = false; }, 20000);
    // replace avoids adding a second entry to the browser's joint frame history.
    frame.contentWindow.location.replace(url.href);
  }
  function click(event) {
    const anchor = event.target.closest('a[href]');
    if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.download || anchor.target && anchor.target !== '_self') return;
    const url = internal(anchor.href);
    if (!url) return;
    event.preventDefault();
    if (url.pathname === location.pathname && url.search === location.search) {
      history.pushState(null, '', route(url));
      const target = frame.contentDocument.getElementById(decodeURIComponent(url.hash.slice(1)) || 'main');
      target?.scrollIntoView();
      target?.focus({preventScroll:true});
      return;
    }
    load(url.href);
  }
  window.SiteNavigation = Object.freeze({
    load,
    renderAssets: data => window.SiteHeader?.renderAssets(data)
  });
  document.addEventListener('click', click);
  frame.addEventListener('load', () => {
    clearTimeout(timeout);
    const doc = frame.contentDocument;
    if (!doc?.querySelector('main')) { error.hidden = false; return; }
    error.hidden = true;
    document.title = doc.title;
    frame.title = doc.title;
    const actual = internal(frame.contentWindow.location.href);
    if (actual && actual.pathname !== location.pathname) history.replaceState(null, '', route(actual));
    doc.addEventListener('click', click);
    // A frame navigation destroys its JS realm, polling loops and observers.
    // No script evaluation or global timer monkey-patching is needed.
    if (location.hash) doc.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    else frame.contentWindow.scrollTo(0, history.state?.scrollY || 0);
  });
  error.querySelector('button').addEventListener('click', () => load(location.href, false));
  window.addEventListener('popstate', () => load(location.href, false));
  const first = internal(new URLSearchParams(location.search).get('route') || '/');
  history.replaceState(null, '', first ? route(first) : '/');
  load(location.href, false);
})();

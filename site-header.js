'use strict';
// Single shared header for every public page.
(() => {
const mount = document.querySelector('[data-site-header]');
if (!mount) return;
const modes = [
  { key: 'home', href: '/', label: 'LIVE ANALYSIS', menu: 'HOME', icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 12 18.5 5.5"/>' },
  { key: 'short', href: '/demo/15minbot/', label: '15 MIN BOT', menu: '15 MIN', icon: '<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>' },
  { key: 'medium', href: '/demo/1hrbot/', label: '1 HR BOT', menu: '1 HOUR', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>' },
  { key: 'long', href: '/demo/4hrbot/', label: '4 HR BOT', menu: '4 HOUR', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6H6"/>' }
];
mount.innerHTML = `<a class="skip" href="#main">Skip to content</a><header class="site-header shell">
<a class="brand" href="/" aria-label="RRR.Trading home"><span class="brand-mark" aria-hidden="true">RRR<span>↗</span></span><span class="brand-name">RRR.TRADING</span></a>
<button class="menu-toggle" aria-expanded="false" aria-controls="navigation" hidden>Menu ☰</button>
<nav id="navigation" aria-label="Main navigation">${modes.map(mode => `<a href="${mode.href}" data-page="${mode.key}">${mode.menu}</a>`).join('')}<a href="/about.html" data-page="about">ABOUT</a></nav>
<div class="header-tools"><div class="radio" aria-label="Radio RRR live player"><button id="radio-toggle" aria-label="Play Radio RRR" aria-pressed="false" hidden>▶</button><strong><a href="https://radiorrr.com" target="_blank" rel="noopener noreferrer">RadioRRR</a></strong><small id="radio-status" class="visually-hidden" role="status">Press play to listen.</small><audio id="radio-audio" controls preload="none" src="https://stream.radiorrr.com/radio.mp3"></audio></div><span class="header-note"><i class="dot" aria-hidden="true"></i>Live Trading Music</span></div></header>`;
mount.insertAdjacentHTML('beforeend', `<nav class="operating-modes" aria-label="Trading modes">${modes.map(mode => `<a class="mode-button" href="${mode.href}" data-page="${mode.key}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${mode.icon}</svg><span>${mode.label}</span></a>`).join('')}</nav>`);
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
const mobile = window.matchMedia('(max-width: 900px)');
menu.hidden = false;
function closeMenu() {
  menu.setAttribute('aria-expanded', 'false');
  navigation.hidden = mobile.matches;
}
closeMenu();
mobile.addEventListener('change', closeMenu);
menu.addEventListener('click', () => {
  const expanded = menu.getAttribute('aria-expanded') === 'true';
  menu.setAttribute('aria-expanded', String(!expanded));
  navigation.hidden = expanded;
});
navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
navigation.addEventListener('keydown', event => {
  if (event.key === 'Escape' && mobile.matches) { closeMenu(); menu.focus(); }
});

const audio = document.querySelector('#radio-audio');
const toggle = document.querySelector('#radio-toggle');
const status = document.querySelector('#radio-status');
audio.controls = false;
audio.hidden = true;
toggle.hidden = false;
function radioState(playing, message) {
  toggle.textContent = playing ? 'Ⅱ' : '▶';
  toggle.setAttribute('aria-label', playing ? 'Pause Radio RRR' : 'Play Radio RRR');
  toggle.setAttribute('aria-pressed', String(playing));
  status.textContent = message;
}
toggle.addEventListener('click', async () => {
  if (!audio.paused) { audio.pause(); return; }
  status.textContent = 'Connecting to Radio RRR…';
  try { await audio.play(); }
  catch { radioState(false, 'Stream unavailable. Press play to retry.'); }
});
audio.addEventListener('playing', () => radioState(true, 'Playing live · Radio RRR'));
audio.addEventListener('pause', () => radioState(false, 'Paused · Press play to listen.'));
audio.addEventListener('waiting', () => { status.textContent = 'Buffering live stream…'; });
audio.addEventListener('ended', () => radioState(false, 'Stream ended. Press play to reconnect.'));
audio.addEventListener('error', () => radioState(false, 'Stream unavailable. Press play to retry.'));


const links = [...mount.querySelectorAll('[data-page]')];
const onHome = ['/', '/index.html'].includes(location.pathname);
function activate(key) {
  links.forEach(link => {
    if (link.dataset.page === key) link.setAttribute('aria-current', onHome && key !== 'home' ? 'location' : 'page');
    else link.removeAttribute('aria-current');
  });
}
function currentPage() {
  const path = location.pathname;
  const botKey = /^\/demo\/15minbot(?:\/|$)/.test(path) ? 'short' : /^\/demo\/1hrbot(?:\/|$)/.test(path) ? 'medium' : /^\/demo\/4hrbot(?:\/|$)/.test(path) ? 'long' : null;
  const pageKey = botKey || (path === '/reports.html' || path.startsWith('/reports/') ? 'reports' : document.body.dataset.page || path.split('/').filter(Boolean)[0]);
  activate(onHome ? 'home' : pageKey);
}
currentPage();
window.addEventListener('hashchange', currentPage);

})();

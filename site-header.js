'use strict';
// Single shared header for every public page.
(() => {
const mount = document.querySelector('[data-site-header]');
if (!mount) return;
mount.innerHTML = `<a class="skip" href="#main">Skip to content</a><header class="site-header shell">
<a class="brand" href="/" aria-label="RRR.Trading home"><span class="brand-mark" aria-hidden="true">RRR<span>↗</span></span><span class="brand-name">RRR.TRADING</span></a>
<button class="menu-toggle" aria-expanded="false" aria-controls="navigation" hidden>Menu ☰</button>
<nav id="navigation" aria-label="Main navigation"><a href="/" data-page="home">HOME</a><a href="/#today" data-page="today">TODAY</a><a href="/#reports" data-page="reports">REPORTS</a><a href="/demo" data-page="demo">DEMO ↗</a><a href="/#about" data-page="about">ABOUT</a></nav>
<div class="header-tools"><div class="radio" aria-label="Radio RRR live player"><button id="radio-toggle" aria-label="Play Radio RRR" aria-pressed="false" hidden>▶</button><strong><a href="https://radiorrr.com" target="_blank" rel="noopener noreferrer">RADIO RRR</a> <span>LIVE</span></strong><small id="radio-status" class="visually-hidden" role="status">Press play to listen.</small><audio id="radio-audio" controls preload="none" src="https://stream.radiorrr.com/radio.mp3"></audio></div><span class="header-note"><i class="dot"></i> SYSTEMATIC BY DESIGN</span></div></header>`;
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


const links = [...navigation.querySelectorAll('[data-page]')];
const onHome = ['/', '/index.html'].includes(location.pathname);
function activate(key) {
  links.forEach(link => {
    if (link.dataset.page === key) link.setAttribute('aria-current', onHome && key !== 'home' ? 'location' : 'page');
    else link.removeAttribute('aria-current');
  });
}
function currentPage() {
  activate(onHome ? (['today', 'reports', 'about'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home') : (document.body.dataset.page || location.pathname.split('/').filter(Boolean)[0]));
}
currentPage();
window.addEventListener('hashchange', currentPage);

})();

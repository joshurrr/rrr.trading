'use strict';
// Single shared header for every public page.
(() => {
const mount = document.querySelector('[data-site-header]');
if (!mount) return;
mount.innerHTML = `<a class="skip" href="#main">Skip to content</a><header class="site-header shell">
<a class="brand" href="/" aria-label="RRR.Trading home"><span class="brand-mark" aria-hidden="true">RRR<span>↗</span></span><span class="brand-name">RRR.TRADING</span></a>
<button class="menu-toggle" aria-expanded="false" aria-controls="navigation" hidden>Menu ☰</button>
<nav id="navigation" aria-label="Main navigation"><a href="/" data-page="home">HOME</a><a href="/reports.html" data-page="reports">REPORTS</a><div class="demo-nav"><button id="demo-toggle" data-page="demo" aria-expanded="false" aria-controls="demo-options">DEMO <span aria-hidden="true">▾</span></button><div id="demo-options" class="demo-options" hidden><a href="/demo/short/" data-demo="short">15 Min</a><a href="/demo/" data-demo="medium">1 Hour</a><a href="/demo/long/" data-demo="long">4 Hour</a></div></div><a href="/about.html" data-page="about">ABOUT</a></nav>
<div class="header-tools"><div class="radio" aria-label="Radio RRR live player"><button id="radio-toggle" aria-label="Play Radio RRR" aria-pressed="false" hidden>▶</button><strong><a href="https://radiorrr.com" target="_blank" rel="noopener noreferrer">RadioRRR</a></strong><small id="radio-status" class="visually-hidden" role="status">Press play to listen.</small><audio id="radio-audio" controls preload="none" src="https://stream.radiorrr.com/radio.mp3"></audio></div><span class="header-note"><i class="dot" aria-hidden="true"></i>Live Trading Music</span></div></header>`;
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
const mobile = window.matchMedia('(max-width: 900px)');
const demoToggle = document.querySelector('#demo-toggle');
const demoOptions = document.querySelector('#demo-options');
function closeDemo() {
  demoToggle.setAttribute('aria-expanded', 'false');
  demoOptions.hidden = true;
}
menu.hidden = false;
function closeMenu() {
  closeDemo();
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
demoToggle.addEventListener('click', () => {
  const expanded = demoToggle.getAttribute('aria-expanded') === 'true';
  demoToggle.setAttribute('aria-expanded', String(!expanded));
  demoOptions.hidden = expanded;
});
demoToggle.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    demoToggle.setAttribute('aria-expanded', 'true');
    demoOptions.hidden = false;
    demoOptions.querySelector('a').focus();
  }
});
document.addEventListener('click', event => { if (!event.target.closest('.demo-nav')) closeDemo(); });
document.querySelector('.demo-nav').addEventListener('focusout', event => {
  if (!event.currentTarget.contains(event.relatedTarget)) closeDemo();
});
navigation.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !demoOptions.hidden) {
    event.preventDefault();
    closeDemo();
    demoToggle.focus();
    return;
  }
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
  activate(onHome ? 'home' : (document.body.dataset.page || location.pathname.split('/').filter(Boolean)[0]));
}
currentPage();
if (document.body.dataset.page === 'demo') {
  const demoKey = location.pathname.startsWith('/demo/long/') ? 'long' : location.pathname.startsWith('/demo/short/') ? 'short' : 'medium';
  demoOptions.querySelector(`[data-demo="${demoKey}"]`).dataset.selected = 'true';
}
window.addEventListener('hashchange', currentPage);

})();

'use strict';
// Static market cards are deliberately separate from the live demo API.
// A future adapter can populate data-market / data-field elements after validating data.
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

async function loadDailyReport() {
  try {
    const response = await fetch('data/daily-crypto-report.html', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Report unavailable');
    // Only the repository-controlled report fragment is loaded. Never insert API strings as HTML.
    const documentFragment = new DOMParser().parseFromString(await response.text(), 'text/html');
    const report = documentFragment.querySelector('[data-report-date]');
    if (!report || !report.querySelector('section')) throw new Error('Invalid report');
    document.querySelector('#daily-report').replaceChildren(document.importNode(report, true));
    document.querySelector('#report-date').textContent = report.dataset.reportDate;
    document.querySelector('#report-captured').textContent = report.dataset.reportCaptured || '';
    document.querySelector('#report-kind').textContent = report.dataset.reportKind === 'sample' ? 'SAMPLE BRIEFING' : 'PUBLISHED BRIEFING';
  } catch {
    document.querySelector('#report-status').textContent = 'The latest report could not be loaded. Showing the embedded sample briefing.';
  }
}
loadDailyReport();

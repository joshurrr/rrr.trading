'use strict';
// Single shared header for every public page.
(() => {
const mount = document.querySelector('[data-site-header]');
if (!mount) return;
const framed = window.parent !== window && document.referrer.startsWith(location.origin + '/') && !!window.parent.SiteNavigation;
if (framed) document.documentElement.classList.add('radio-framed');
// Decorative playback indicator; CSS supplies motion, not audio analysis.
const equalizerBars = Array.from({length:20}, (_, i) => `<span style="--bar-height:${22+(i*17)%35}px;--bar-speed:${720+(i*137)%690}ms;--bar-delay:-${(i*193)%1400}ms;--bar-rest:${0.25+(i%5)*0.12}"></span>`).join('');
const modes = [
  { key: 'home', href: 'https://rrr.trading/', label: 'OVERVIEW', menu: 'HOME', icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 12 18.5 5.5"/>' },
  { key: 'intelligence', href: 'https://rrr.trading/market-conditions/', label: 'ANALYSIS', icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>' },
  { key: 'v4-trading', href: 'https://v4.rrr.trading/', label: 'TRADING', icon: '<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>' },
  { key: 'tools', href: 'https://admin.rrr.trading/', label: 'ADMIN', icon: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>' }
];
mount.innerHTML = `<a class="skip" href="${document.getElementById('overview-main') ? '#overview-main' : '#main'}">Skip to content</a><header class="site-header shell">
<a class="brand" href="https://rrr.trading/" aria-label="RRR.Trading home"><span class="brand-mark" aria-hidden="true">RRR<span>↗</span></span><span class="brand-name">RRR.TRADING</span></a>
<div class="header-tools"><div class="radio" aria-label="Radio RRR live player"><button id="radio-toggle" aria-label="Play Radio RRR" aria-pressed="false" hidden>▶</button><strong><a href="https://radiorrr.com" target="_blank" rel="noopener noreferrer">RadioRRR.com</a></strong><small id="radio-status" class="visually-hidden" role="status">Press play to listen.</small><audio id="radio-audio" controls preload="none" src="https://stream.radiorrr.com/radio.mp3"></audio></div><span class="header-note"><i class="dot" aria-hidden="true"></i>Live trading music</span></div><div class="header-content"><div class="header-programme"><p class="header-session-title">Loading crypto session…</p></div><div class="header-targets"><span class="header-target-label">TARGET TRADES:</span><div id="header-assets" class="header-assets" aria-label="Shared Top 10 selection"><span class="header-asset-note">Loading saved Top 10…</span></div></div><p class="header-commentary">We find assets and automatically trade them during this program</p></div></header>`;
mount.insertAdjacentHTML('beforeend', `<nav class="operating-modes" aria-label="Primary navigation">${modes.map(mode => {
  const link = `<a class="mode-button" href="${mode.href}" data-page="${mode.key}">${mode.key === 'home' ? '<span class="live-dot" aria-hidden="true"></span>' : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${mode.icon}</svg>`}<span>${mode.label}</span></a>`;
  if (mode.key === 'intelligence') return `<div class="intelligence-navigation"><button type="button" class="mode-button" data-page="intelligence" aria-expanded="false" aria-controls="intelligence-shortcuts">${link.slice(link.indexOf('<svg'),link.lastIndexOf('</a>'))} <span aria-hidden="true">▾</span></button><div id="intelligence-shortcuts" class="intelligence-shortcuts" hidden><a href="https://rrr.trading/macro/">Macro Intelligence</a><a href="https://rrr.trading/asset-explorer/">Asset Explorer</a><a href="https://rrr.trading/market-conditions/">Market Conditions</a><a href="https://rrr.trading/research-news/">Research &amp; News</a><a href="https://rrr.trading/trading-assessment/">Trading Assessment</a><a href="https://rrr.trading/schedule/">Economic Calendar</a></div></div>`;
  if (mode.key === 'v4-trading') return link;
  return link;
}).join('')}</nav>`);
if (framed) { mount.hidden = true; mount.querySelector('#radio-audio').remove(); }
const intelligenceMenu = mount.querySelector('#intelligence-shortcuts');
const intelligenceToggle = mount.querySelector('[aria-controls="intelligence-shortcuts"]');
const intelligenceNav = mount.querySelector('.intelligence-navigation');
const closeIntelligence = () => { intelligenceMenu.hidden = true; intelligenceToggle.setAttribute('aria-expanded','false'); };
intelligenceToggle.addEventListener('click', () => { const open = intelligenceMenu.hidden; intelligenceMenu.hidden = !open; intelligenceToggle.setAttribute('aria-expanded',String(open)); });
intelligenceToggle.addEventListener('keydown', event => { if (event.key === 'ArrowDown') { event.preventDefault(); intelligenceMenu.hidden = false; intelligenceToggle.setAttribute('aria-expanded','true'); intelligenceMenu.querySelector('a').focus(); } });
intelligenceNav.addEventListener('keydown', event => { if(event.key === 'Escape') { event.preventDefault(); closeIntelligence(); intelligenceToggle.focus(); } });
intelligenceNav.addEventListener('focusout', event => { if(!intelligenceNav.contains(event.relatedTarget)) closeIntelligence(); });
document.addEventListener('click', event => { if(!intelligenceNav.contains(event.target) || event.target.closest('#intelligence-shortcuts a')) closeIntelligence(); });
// One presentation clock and hero selection for every page. Existing universe
// renderers supply their saved responses; informational pages use the same public feed.
// Indicative activity windows, never market opening/closing times. UTC owns
// the weekend; IANA regional clocks own weekday hours (including DST).
const sessions=[['ASIA','Asia/Tokyo',9,17],['EUROPE','Europe/London',8,17],['US','America/New_York',8,17]].map(([name,zone,start,end])=>({name,start,end,clock:new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'2-digit',hourCycle:'h23'})}));
const activeSessions=(now=new Date())=>[0,6].includes(now.getUTCDay())?[]:sessions.filter(({clock,start,end})=>{
  const hour=+clock.formatToParts(now).find(p=>p.type==='hour').value;
  return hour>=start&&hour<end;
}).map(({name})=>name);
const sessionName=(now=new Date())=>{
  if(now.getUTCDay()===6)return 'SATURDAY SESSION';
  if(now.getUTCDay()===0)return 'SUNDAY SESSION';
  const active=activeSessions(now);
  if(active.length>1)return active.map(region=>({ASIA:'TOKYO',EUROPE:'LONDON',US:'NEW YORK'})[region]).join(' & ');
  const region=['US','EUROPE','ASIA'].find(name=>active.includes(name));
  return region?region+' SESSION':'OVERNIGHT SESSION';
};
const dayClock=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',weekday:'long'});
const updateSession=()=>{const now=new Date();const title=dayClock.format(now).toUpperCase()+' – '+sessionName(now);const heading=mount.querySelector('.header-session-title');if(heading.textContent!==title)heading.textContent=title;};
// Align every page to the same UTC minute boundary rather than page-load time.
const tick=()=>{updateSession();setTimeout(tick,60000-Date.now()%60000);};
tick();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateSession();});
let opportunitySnapshot = null;
const renderAssets=data=>{
  if (framed) window.parent.SiteNavigation.renderAssets(data);
  const target=mount.querySelector('#header-assets'), assets=data?.assets;
  const generated=Date.parse(data?.generated_at), expires=Date.parse(data?.valid_until);
  const valid=data?.schema_version===1&&['ok','stale'].includes(data.status)&&typeof data.universe_version==='string'&&Number.isFinite(generated)&&generated<=Date.now()+30000&&Number.isFinite(expires)&&expires>generated&&Array.isArray(assets)&&assets.length===10&&new Set(assets.map(a=>a?.pair)).size===10&&assets.every((a,i)=>a?.rank===i+1&&/^[A-Z0-9]{1,20}$/.test(a.symbol)&&a.pair===a.symbol+'/USDT:USDT'&&typeof a.opportunity_score==='number'&&Number.isFinite(a.opportunity_score)&&a.opportunity_score>=0&&a.opportunity_score<=100&&typeof a.reason==='string');
  opportunitySnapshot = valid ? data : null;
  const stale=valid&&(data.status==='stale'||Date.now()>expires);
  const signature=JSON.stringify({symbols:valid?assets.map(a=>a.symbol):[],state:valid?stale?'stale':'current':'unavailable'});
  if(target.dataset.selection===signature)return;
  target.dataset.selection=signature;target.replaceChildren();
  if(valid)assets.forEach((asset,index)=>{const b=document.createElement('button');b.type='button';b.className=`header-asset header-asset-${index%4}`;b.textContent=asset.symbol;b.dataset.intelligenceSymbol=asset.symbol;b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-label',`Inspect ${asset.symbol} asset intelligence`);target.append(b);});
  if(!valid||stale){const note=document.createElement('span');note.className='header-asset-note';note.textContent=valid?'Saved Top 10 · stale selection':'Top 10 selection unavailable';target.append(note);}
};
// Retained for cached callers; market sentiment is no longer shown in the banner.
const renderSentiment=()=>{};
window.SiteHeader=Object.freeze({activeSessions,sessionName,renderAssets,renderSentiment,opportunityFor: symbol => { const d=opportunitySnapshot, asset=d?.assets.find(a=>a.symbol===symbol); return asset ? { symbol, asset, current:d.status==='ok', assessment:{generated_at:d.generated_at,valid_until:d.valid_until,universe_version:d.universe_version,membership:'top',poolEligible:asset.approved_for_new_entries} } : null; }});
window.homepageActiveSessions=activeSessions;
const pageOwnsUniverse=[...document.scripts].some(s=>/(?:^|\/)(?:trading-universe|trading-universe-bot|asset-explorer)\.js$/.test(new URL(s.src||location.href).pathname));
if(!pageOwnsUniverse && !window.SiteNavigation){
  let busy=false;
  const refresh=async()=>{if(busy)return;busy=true;try{const response=await fetch('https://api.rrr.trading/api/trading-universe',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Unavailable');renderAssets(await response.json());}catch{renderAssets(null);}finally{busy=false;}};
  refresh();setInterval(()=>{if(!document.hidden)refresh();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
}

const audio = document.querySelector('#radio-audio');
const equalizer = document.createElement('div');
equalizer.className = 'radio-equalizer';
equalizer.hidden = true;
equalizer.setAttribute('aria-hidden', 'true');
equalizer.innerHTML = equalizerBars;
mount.querySelector('.header-tools').append(equalizer);
const toggle = document.querySelector('#radio-toggle');
const status = document.querySelector('#radio-status');
if (audio) {
audio.controls = false;
audio.hidden = true;
toggle.hidden = false;
const streamURL = audio.src;
let freshConnection = true;
let connectionTimer;
let playAttempt = 0;
function clearConnectionTimer() {
  clearTimeout(connectionTimer);
  connectionTimer = undefined;
}
function waitForStream() {
  if (connectionTimer) return;
  connectionTimer = setTimeout(() => {
    connectionTimer = undefined;
    ++playAttempt;
    freshConnection = true;
    audio.pause();
    radioState(false, 'Stream connection timed out. Press play to reconnect.');
  }, 15000);
}
function radioState(playing, message) {
  equalizer.hidden = !playing;
  toggle.textContent = playing ? 'Ⅱ' : '▶';
  toggle.setAttribute('aria-label', playing ? 'Pause Radio RRR' : 'Play Radio RRR');
  toggle.setAttribute('aria-pressed', String(playing));
  status.textContent = message;
}
toggle.addEventListener('click', async () => {
  if (!audio.paused && !audio.error && !audio.ended && !freshConnection) { ++playAttempt; audio.pause(); return; }
  const attempt = ++playAttempt;
  if (freshConnection || audio.error || audio.ended) {
    // A unique URL avoids reusing a stalled live-stream response. Ordinary
    // pause/resume and page navigation retain the existing connection.
    const url = new URL(streamURL);
    url.searchParams.set('reconnect', String(Date.now()) + '-' + attempt);
    audio.src = url.href;
    audio.load();
    freshConnection = false;
  }
  toggle.textContent = 'Ⅱ';
  toggle.setAttribute('aria-label', 'Cancel Radio RRR connection');
  status.textContent = 'Connecting to Radio RRR…';
  waitForStream();
  try { await audio.play(); }
  catch {
    if (attempt !== playAttempt) return;
    clearConnectionTimer();
    freshConnection = true;
    audio.pause();
    radioState(false, 'Stream unavailable. Press play to retry.');
  }
});
audio.addEventListener('playing', () => { clearConnectionTimer(); radioState(true, 'Playing live · Radio RRR'); });
audio.addEventListener('pause', () => { clearConnectionTimer(); radioState(false, freshConnection ? 'Stream interrupted. Press play to reconnect.' : 'Paused · Press play to listen.'); });
for (const event of ['waiting', 'stalled']) audio.addEventListener(event, () => {
  equalizer.hidden = true;
  status.textContent = 'Buffering live stream…';
  if (!audio.paused) waitForStream();
});
audio.addEventListener('ended', () => { clearConnectionTimer(); freshConnection = true; radioState(false, 'Stream ended. Press play to reconnect.'); });
audio.addEventListener('error', () => { clearConnectionTimer(); freshConnection = true; radioState(false, 'Stream unavailable. Press play to retry.'); });


}
const links = [...mount.querySelectorAll('.operating-modes [data-page]')];
const onHome = location.hostname === 'rrr.trading' && ['/', '/index.html'].includes(location.pathname);
function activate(key) {
  const onHome = location.hostname === 'rrr.trading' && ['/', '/index.html'].includes(location.pathname);
  links.forEach(link => {
    if (link.dataset.page === key) link.setAttribute('aria-current', onHome && key !== 'home' ? 'location' : 'page');
    else link.removeAttribute('aria-current');
  });
}
function currentPage() {
  const path = location.pathname;
  const onHome = location.hostname === 'rrr.trading' && ['/', '/index.html'].includes(path);
  const botPage = window.BotRegistry.bots.some(bot => path === bot.dashboard.replace(/\/$/,'') || path.startsWith(bot.dashboard)) || path === '/demo' || path.startsWith('/demo/') || path.startsWith('/website/demo/');
  const pageKey = botPage ? 'bots' : (path === '/reports.html' || path.startsWith('/reports/') ? 'reports' : document.body.dataset.page || path.split('/').filter(Boolean)[0]);
  const adminPage = location.hostname === 'admin.rrr.trading' || ['rrr.trading','v4.rrr.trading'].includes(location.hostname) && path.startsWith('/admin');
  const intelligence = location.hostname === 'rrr.trading' && ['macro','crypto-scanner','asset-explorer','market-conditions','research-news','trading-assessment','schedule'].includes(pageKey);
  activate(onHome ? 'home' : adminPage ? 'tools' : intelligence ? 'intelligence' : pageKey);
  intelligenceMenu.querySelectorAll('a').forEach(link => { if (link.pathname === path || link.pathname + 'index.html' === path) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); });
}
currentPage();
window.addEventListener('hashchange', currentPage);

})();

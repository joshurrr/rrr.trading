'use strict';
// Single shared header for every public page.
(() => {
const mount = document.querySelector('[data-site-header]');
if (!mount) return;
const path = location.pathname;
const heroTitle = 'Loading crypto session…';
const modes = [
  { key: 'home', href: '/', label: 'LIVE ANALYSIS', menu: 'HOME', icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 12 18.5 5.5"/>' },
  { key: 'schedule', href: '/schedule/', label: 'SCHEDULE', icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>' },
  { key: 'bots', href: '/bots/', label: 'TRADING BOTS', icon: '<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>' },
  { key: 'tools', href: '/tools/', label: 'TOOLS', menu: 'TOOLS', icon: '<path d="M4 12h4l2-7 4 14 2-7h4"/>' }
];
mount.innerHTML = `<a class="skip" href="#main">Skip to content</a><header class="site-header shell">
<a class="brand" href="/" aria-label="RRR.Trading home"><span class="brand-mark" aria-hidden="true">RRR<span>↗</span></span><span class="brand-name">RRR.TRADING</span></a>
<div class="header-tools"><div class="radio" aria-label="Radio RRR live player"><button id="radio-toggle" aria-label="Play Radio RRR" aria-pressed="false" hidden>▶</button><strong><a href="https://radiorrr.com" target="_blank" rel="noopener noreferrer">RadioRRR</a></strong><small id="radio-status" class="visually-hidden" role="status">Press play to listen.</small><audio id="radio-audio" controls preload="none" src="https://stream.radiorrr.com/radio.mp3"></audio></div><span class="header-note"><i class="dot" aria-hidden="true"></i>Live Trading Music</span></div><div class="header-hero-title">${heroTitle}</div><p class="header-program-subtitle">TOP 10 TRADING CANDIDATES</p><div id="header-assets" class="header-assets" aria-label="Shared Top 10 selection"><span class="header-asset-note">Loading saved Top 10…</span></div><p class="header-session-note">Global trading activity varies by region. Crypto perpetual markets operate 24/7.</p></header>`;
mount.insertAdjacentHTML('beforeend', `<nav class="operating-modes" aria-label="Primary navigation">${modes.map(mode => {
  const link = `<a class="mode-button" href="${mode.href}" data-page="${mode.key}">${mode.key === 'home' ? '<span class="live-dot" aria-hidden="true"></span>' : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${mode.icon}</svg>`}<span>${mode.label}</span></a>`;
  return mode.key === 'bots' ? `<div class="bots-navigation">${link}<button type="button" class="bots-menu-toggle" aria-label="Trading Bots shortcuts" aria-expanded="false" aria-controls="bots-shortcuts">▾</button><div id="bots-shortcuts" class="bots-shortcuts" hidden><a href="/bots/">ALL TRADING BOTS</a></div></div>` : link;
}).join('')}</nav>`);
const shortcuts = mount.querySelector('#bots-shortcuts'), menuToggle = mount.querySelector('.bots-menu-toggle');
for (const bot of window.BotRegistry.bots) {
  const link = document.createElement('a'); link.href = bot.dashboard; link.textContent = bot.name; shortcuts.append(link);
}
const closeShortcuts = () => { shortcuts.hidden = true; menuToggle.setAttribute('aria-expanded','false'); };
menuToggle.addEventListener('click', () => { const open = shortcuts.hidden; shortcuts.hidden = !open; menuToggle.setAttribute('aria-expanded',String(open)); });
menuToggle.addEventListener('keydown', event => { if(event.key === 'ArrowDown'){event.preventDefault();shortcuts.hidden=false;menuToggle.setAttribute('aria-expanded','true');shortcuts.querySelector('a').focus();} });
mount.querySelector('.bots-navigation').addEventListener('keydown', event => { if(event.key === 'Escape'){event.preventDefault();closeShortcuts();menuToggle.focus();} });
document.addEventListener('click', event => { if(!event.target.closest('.bots-navigation')) closeShortcuts(); });
mount.querySelector('.bots-navigation').addEventListener('focusout', event => { if(!event.currentTarget.contains(event.relatedTarget)) closeShortcuts(); });

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
  if(active.includes('EUROPE')&&active.includes('US'))return 'GLOBAL OVERLAP';
  const region=['US','EUROPE','ASIA'].find(name=>active.includes(name));
  return region?region+' SESSION':'OVERNIGHT SESSION';
};
const updateSession=()=>{const title='LIVE CRYPTO PERPETUALS — '+sessionName();const heading=mount.querySelector('.header-hero-title');if(heading.textContent!==title)heading.textContent=title;};
// Align every page to the same UTC minute boundary rather than page-load time.
const tick=()=>{updateSession();setTimeout(tick,60000-Date.now()%60000);};
tick();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateSession();});
const renderAssets=data=>{
  const target=mount.querySelector('#header-assets'), assets=data?.assets;
  const generated=Date.parse(data?.generated_at), expires=Date.parse(data?.valid_until);
  const valid=data?.schema_version===1&&['ok','stale'].includes(data.status)&&typeof data.universe_version==='string'&&Number.isFinite(generated)&&generated<=Date.now()+30000&&Number.isFinite(expires)&&expires>generated&&Array.isArray(assets)&&assets.length===10&&new Set(assets.map(a=>a?.pair)).size===10&&assets.every((a,i)=>a?.rank===i+1&&/^[A-Z0-9]{1,20}$/.test(a.symbol)&&a.pair===a.symbol+'/USDT:USDT'&&typeof a.opportunity_score==='number'&&Number.isFinite(a.opportunity_score)&&a.opportunity_score>=0&&a.opportunity_score<=100&&typeof a.reason==='string');
  const stale=valid&&(data.status==='stale'||Date.now()>expires);
  const signature=JSON.stringify({symbols:valid?assets.map(a=>a.symbol):[],state:valid?stale?'stale':'current':'unavailable'});
  if(target.dataset.selection===signature)return;
  target.dataset.selection=signature;target.replaceChildren();
  if(valid)assets.forEach((asset,index)=>{const b=document.createElement('button');b.type='button';b.className=`header-asset header-asset-${index%4}`;b.textContent=asset.symbol;b.dataset.intelligenceSymbol=asset.symbol;b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-label',`Inspect ${asset.symbol} asset intelligence`);target.append(b);});
  if(!valid||stale){const note=document.createElement('span');note.className='header-asset-note';note.textContent=valid?'Saved Top 10 · stale selection':'Top 10 selection unavailable';target.append(note);}
};
window.SiteHeader=Object.freeze({activeSessions,sessionName,renderAssets});
window.homepageActiveSessions=activeSessions;
const pageOwnsUniverse=[...document.scripts].some(s=>/(?:^|\/)(?:trading-universe|trading-universe-bot)\.js$/.test(new URL(s.src||location.href).pathname));
if(!pageOwnsUniverse){
  let busy=false;
  const refresh=async()=>{if(busy)return;busy=true;try{const response=await fetch('https://api.rrr.trading/api/trading-universe',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Unavailable');renderAssets(await response.json());}catch{renderAssets(null);}finally{busy=false;}};
  refresh();setInterval(()=>{if(!document.hidden)refresh();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
}

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


const links = [...mount.querySelectorAll('.operating-modes [data-page]')];
const onHome = ['/', '/index.html'].includes(location.pathname);
function activate(key) {
  links.forEach(link => {
    if (link.dataset.page === key) link.setAttribute('aria-current', onHome && key !== 'home' ? 'location' : 'page');
    else link.removeAttribute('aria-current');
  });
}
function currentPage() {
  const botPage = window.BotRegistry.bots.some(bot => path === bot.dashboard.replace(/\/$/,'') || path.startsWith(bot.dashboard)) || path === '/demo' || path.startsWith('/demo/') || path.startsWith('/website/demo/');
  const pageKey = botPage ? 'bots' : (path === '/reports.html' || path.startsWith('/reports/') ? 'reports' : document.body.dataset.page || path.split('/').filter(Boolean)[0]);
  activate(onHome ? 'home' : pageKey);
}
currentPage();
window.addEventListener('hashchange', currentPage);

})();

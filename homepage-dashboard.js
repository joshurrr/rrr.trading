'use strict';
// Presentation only. Conventional FX business sessions are not exchange calendars.
(() => {
  if (document.body.id !== 'home') return;
  const node = (tag, text, cls) => {const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
  const sessions=[['SYDNEY','Australia/Sydney',8,17],['TOKYO','Asia/Tokyo',9,18],['LONDON','Europe/London',8,17],['NEW YORK','America/New_York',8,17]];
  const activeSessions = (now=new Date()) => sessions.filter(([,zone,start,end])=>{
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
    return !['Sat','Sun'].includes(parts.weekday) && +parts.hour>=start && +parts.hour<end;
  }).map(([name])=>name);
  window.homepageActiveSessions=activeSessions;
  const hero=document.querySelector('.header-hero-title');
  if(hero){
    hero.after(node('p','TOP 10 TRADE SETUPS','header-program-subtitle'),node('p','Conventional weekday FX sessions · local time and daylight saving observed. Holiday activity may differ. Crypto markets remain open 24/7.','header-session-note'));
    const update=()=>{const active=activeSessions();hero.textContent=active.length?'CURRENT MARKET SESSION'+(active.length>1?'S':'')+' — '+active.join(' + '):'CRYPTO MARKETS — OPEN 24/7';};
    update();setInterval(update,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
  }
  // Summarize already validated rendered research, without competing requests or sentiment inference.
  const compact=document.getElementById('research-compact');
  const summarize=()=>{
    compact.replaceChildren();
    for(const [id,title] of [['research-themes','Current themes'],['research-events','Catalysts & developments']]){
      const source=document.getElementById(id);compact.append(node('h4',title));
      const rows=[...source.querySelectorAll('.research-item')].slice(0,2);
      if(rows.length){
        const coverage=source.querySelector(':scope>.data-note');if(coverage)compact.append(node('p',coverage.textContent,'data-note'));
        for(const row of rows){
          const freshness=[...row.querySelectorAll('.research-meta')].map(n=>n.textContent).filter(text=>/STALE|TENTATIVE|TBC|CONFIRMED|UPDATED/.test(text));
          compact.append(node('p',[row.querySelector('h4')?.textContent,row.querySelector('.theme-summary')?.textContent,row.querySelector('time')?.textContent,...freshness].filter(Boolean).join(' · ')));
        }
      }
      else compact.append(node('p',source.querySelector('p')?.textContent||'Loading saved evidence…','muted'));
    }
  };
  for(const id of ['research-themes','research-events'])new MutationObserver(summarize).observe(document.getElementById(id),{childList:true,subtree:true,characterData:true});
})();

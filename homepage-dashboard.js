'use strict';
// Homepage research summary only; the shared header owns the session clock.
(() => {
  if (document.body.id !== 'home') return;
  const node = (tag, text, cls) => {const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
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

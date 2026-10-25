'use strict';
(() => {
  const modal=document.getElementById('homepage-analysis-modal');
  if(!modal)return;
  const dialog=modal.querySelector('.homepage-analysis-dialog'),frame=modal.querySelector('iframe'),symbolLabel=modal.querySelector('.homepage-analysis-symbol');
  let opener=null, closingTimer=0;
  const symbolOf=el=>String(el?.dataset.symbol||el?.dataset.asset||el?.textContent||'').toUpperCase().match(/[A-Z0-9]{1,30}USDT\b|[A-Z0-9]{1,30}/)?.[0].replace(/USDT$/,'')||'';
  function open(symbol,source){
    if(!/^[A-Z0-9]{1,30}$/.test(symbol))return;
    clearTimeout(closingTimer);opener=source;symbolLabel.textContent=symbol;modal.hidden=false;document.body.classList.add('analysis-modal-open');
    frame.src='/asset-analysis/?asset='+encodeURIComponent(symbol);
    requestAnimationFrame(()=>{modal.classList.add('is-open');dialog.focus({preventScroll:true});});
  }
  function close(){if(modal.hidden)return;modal.classList.remove('is-open');document.body.classList.remove('analysis-modal-open');closingTimer=setTimeout(()=>{modal.hidden=true;frame.removeAttribute('src');opener?.focus?.({preventScroll:true});},240);}
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-analysis-dismiss]')||event.target.closest('.homepage-analysis-close')){close();return;}
    const candidate=event.target.closest('.candidate-portrait');
    const position=event.target.closest('#home-position-list .home-position');
    if(candidate){if(event.target.closest('details,summary'))return;const sym=symbolOf(candidate);if(sym){event.preventDefault();event.stopImmediatePropagation();open(sym,candidate.querySelector('button')||candidate);}return;}
    if(position){if(event.target.closest('details,summary,a,button'))return;const sym=symbolOf(position.querySelector('.home-position-name h3'));if(sym)open(sym,position);}
  },true);
  document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('#home-position-list .home-position')){event.preventDefault();const sym=symbolOf(event.target.querySelector('.home-position-name h3'));if(sym)open(sym,event.target);}});
  modal.querySelector('.homepage-analysis-close').addEventListener('click',close);
  frame.addEventListener('load',()=>{try{frame.contentDocument.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}},true);}catch{ /* Same-origin frontend route is expected; the close button remains available. */ }});
  document.addEventListener('keydown',event=>{if(modal.hidden)return;if(event.key==='Escape'){event.preventDefault();close();return;}if(event.key==='Tab'){const controls=[...dialog.querySelectorAll('button,[href],iframe')].filter(x=>!x.disabled);if(!controls.length)return;const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
})();

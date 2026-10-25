'use strict';
(() => {
  const modal=document.getElementById('homepage-analysis-modal');
  if(!modal)return;
  const dialog=modal.querySelector('.homepage-analysis-dialog'),body=modal.querySelector('.homepage-analysis-body'),symbolLabel=modal.querySelector('.homepage-analysis-symbol'),title=modal.querySelector('#homepage-analysis-title');
  const analysis=window.AssetAnalysis.create(body);
  let opener=null, closingTimer=0, animationFrame=0;
  const background=[];
  const symbolOf=el=>String(el?.dataset.symbol||el?.dataset.asset||el?.textContent||'').toUpperCase().match(/[A-Z0-9]{1,30}USDT\b|[A-Z0-9]{1,30}/)?.[0].replace(/USDT$/,'')||'';
  function open(symbol,source,side){
    if(!/^[A-Z0-9]{1,30}$/.test(symbol))return;
    clearTimeout(closingTimer);cancelAnimationFrame(animationFrame);opener=source;symbolLabel.textContent=symbol;title.textContent=symbol+' — Asset Analysis';modal.hidden=false;document.body.classList.add('analysis-modal-open');
    // Inert sibling branches all the way to body, including when the modal is in the footer.
    if(!background.length){let branch=modal;while(branch.parentElement){for(const sibling of branch.parentElement.children){if(sibling!==branch){background.push([sibling,sibling.inert]);sibling.inert=true;}}branch=branch.parentElement;if(branch===document.body)break;}}
    body.scrollTop=0;analysis.showAsset(symbol,side);
    animationFrame=requestAnimationFrame(()=>{modal.classList.add('is-open');modal.querySelector('.homepage-analysis-close').focus({preventScroll:true});});
  }
  function close(){if(modal.hidden)return;cancelAnimationFrame(animationFrame);clearTimeout(closingTimer);analysis.clear(true);modal.classList.remove('is-open');closingTimer=setTimeout(()=>{modal.hidden=true;analysis.clear();document.body.classList.remove('analysis-modal-open');for(const [element,inert] of background)element.inert=inert;background.length=0;if(opener?.isConnected)opener.focus({preventScroll:true});},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:250);}
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-analysis-dismiss]')||event.target.closest('.homepage-analysis-close')){close();return;}
    const candidate=event.target.closest('.candidate-portrait');
    const position=event.target.closest('#home-position-list .home-position');
    if(candidate){if(event.target.closest('details,summary'))return;const sym=symbolOf(candidate);if(sym){event.preventDefault();event.stopImmediatePropagation();open(sym,candidate.querySelector('button')||candidate,candidate.v4Observation?.row?.side||candidate.closest('[data-side]')?.dataset.side);}return;}
    if(position){if(event.target.closest('details,summary,a,button'))return;const sym=symbolOf(position.querySelector('.home-position-name h3'));if(sym)open(sym,position,position.querySelector('.home-position-side')?.dataset.side);}
  },true);
  document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('#home-position-list .home-position')){event.preventDefault();const sym=symbolOf(event.target.querySelector('.home-position-name h3'));if(sym)open(sym,event.target,event.target.querySelector('.home-position-side')?.dataset.side);}});
  document.addEventListener('keydown',event=>{if(modal.hidden)return;if(event.key==='Escape'){event.preventDefault();close();return;}if(event.key==='Tab'){const controls=[...dialog.querySelectorAll('button:not(:disabled),a[href],summary,[tabindex="0"]')].filter(x=>x.getClientRects().length&&x.tabIndex>=0);if(!controls.length)return;const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
})();

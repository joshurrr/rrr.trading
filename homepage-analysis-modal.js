'use strict';
(() => {
  if(document.getElementById('homepage-analysis-modal'))return;
  // The persistent shell's iframe starts below the site header. Mount the
  // overlay in that shell so viewport units refer to the whole browser page.
  let modalDocument=document;
  try{if(window.parent!==window&&window.parent.document.getElementById('page-content')?.contentWindow===window)modalDocument=window.parent.document;}catch{}
  if(modalDocument.getElementById('homepage-analysis-modal'))return;
  if(modalDocument!==document){
    for(const path of ['/asset-analysis/asset-analysis.css','/homepage-analysis-modal.css']){
      const source=[...document.querySelectorAll('link[rel="stylesheet"]')].find(link=>new URL(link.href).pathname===path);
      if(!source)continue;
      let link=[...modalDocument.querySelectorAll('link[rel="stylesheet"]')].find(link=>new URL(link.href).pathname===path);
      if(!link){link=modalDocument.createElement('link');link.rel='stylesheet';modalDocument.head.append(link);}
      link.href=source.href;
    }
  }
  const modal=document.createElement('div');modal.id='homepage-analysis-modal';modal.className='homepage-analysis-modal';modal.hidden=true;
  modal.innerHTML=`<div class="homepage-analysis-backdrop" data-analysis-dismiss></div>
<section class="homepage-analysis-dialog" role="dialog" aria-modal="true" aria-labelledby="homepage-analysis-title" tabindex="-1">
<header><div><span class="homepage-analysis-symbol" aria-hidden="true"></span><h2 id="homepage-analysis-title">Asset Analysis</h2></div><button type="button" class="homepage-analysis-close" aria-label="Close Asset Analysis">×</button></header>
<div class="homepage-analysis-body" data-page="asset-analysis">
<section id="asset-analysis-panel" class="aa-panel" aria-label="Selected asset analysis">
<h3 id="asset-analysis-panel-title" class="homepage-analysis-detail-title"></h3><p id="asset-analysis-panel-meta" class="aa-note"></p>
<div id="asset-analysis-tabs" class="aa-tabs" role="tablist" aria-label="Asset analysis sections"></div>
<div id="asset-analysis-detail" aria-live="polite"></div>
</section></div></section>`;
  modalDocument.body.append(modal);
  const dialog=modal.querySelector('.homepage-analysis-dialog'),body=modal.querySelector('.homepage-analysis-body'),symbolLabel=modal.querySelector('.homepage-analysis-symbol'),title=modal.querySelector('#homepage-analysis-title');
  const analysis=window.AssetAnalysis.create(body);
  let opener=null, closingTimer=0, animationFrame=0;
  const background=[];
  const symbolOf=el=>String(el?.dataset.symbol||el?.dataset.asset||el?.textContent||'').toUpperCase().match(/[A-Z0-9]{1,30}USDT\b|[A-Z0-9]{1,30}/)?.[0].replace(/USDT$/,'')||'';
  function open(symbol,source,side,options){
    if(!/^[A-Z0-9]{1,30}$/.test(symbol))return;
    clearTimeout(closingTimer);cancelAnimationFrame(animationFrame);opener=source;symbolLabel.textContent=symbol;title.textContent=symbol+' — Asset Analysis';modal.hidden=false;document.body.classList.add('analysis-modal-open');modalDocument.body.classList.add('analysis-modal-open');
    // Inert sibling branches all the way to body, including when the modal is in the footer.
    if(!background.length){let branch=modal;while(branch.parentElement){for(const sibling of branch.parentElement.children){if(sibling!==branch){background.push([sibling,sibling.inert]);sibling.inert=true;}}branch=branch.parentElement;if(branch===modalDocument.body)break;}}
    body.scrollTop=0;analysis.showAsset(symbol,side,options);
    animationFrame=requestAnimationFrame(()=>{modal.classList.add('is-open');modal.querySelector('.homepage-analysis-close').focus({preventScroll:true});});
  }
  function restoreBackground(){document.body.classList.remove('analysis-modal-open');modalDocument.body.classList.remove('analysis-modal-open');for(const [element,inert] of background)element.inert=inert;background.length=0;}
  function close(){if(modal.hidden)return;cancelAnimationFrame(animationFrame);clearTimeout(closingTimer);analysis.clear(true);modal.classList.remove('is-open');closingTimer=setTimeout(()=>{modal.hidden=true;analysis.clear();restoreBackground();if(opener?.isConnected)opener.focus({preventScroll:true});},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:250);}
  modal.addEventListener('click',event=>{if(event.target.closest('[data-analysis-dismiss],.homepage-analysis-close'))close();});
  document.addEventListener('click',event=>{
    const marketCard=event.target.closest('#home-market-cards .home-coin-card[data-symbol]');
    if(marketCard){event.preventDefault();open(symbolOf(marketCard),marketCard);return;}
    const plan=event.target.closest('#sol-activity-list .sol-plan-card');
    if(plan){event.preventDefault();open(symbolOf(plan),plan,plan.entryPlan?.side,{tab:3,plan:plan.entryPlan});return;}
    const candidate=event.target.closest('.candidate-portrait');
    const position=event.target.closest('#home-position-list .home-position');
    if(candidate){if(event.target.closest('details,summary'))return;const sym=symbolOf(candidate);if(sym){event.preventDefault();event.stopImmediatePropagation();open(sym,candidate.querySelector('button')||candidate,candidate.v4Observation?.row?.side||candidate.closest('[data-side]')?.dataset.side);}return;}
    if(position){if(event.target.closest('details,summary,a,button'))return;const sym=symbolOf(position.querySelector('.home-position-name h3'));if(sym)open(sym,position,position.querySelector('.home-position-side')?.dataset.side);}
  },true);
  document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('#home-market-cards .home-coin-card[data-symbol]')){event.preventDefault();open(symbolOf(event.target),event.target);return;}if((event.key==='Enter'||event.key===' ')&&event.target.matches('#home-position-list .home-position')){event.preventDefault();const sym=symbolOf(event.target.querySelector('.home-position-name h3'));if(sym)open(sym,event.target,event.target.querySelector('.home-position-side')?.dataset.side);}});
  function modalKeydown(event){if(modal.hidden)return;if(event.key==='Escape'){event.preventDefault();close();return;}if(event.key==='Tab'){const controls=[...dialog.querySelectorAll('button:not(:disabled),a[href],summary,[tabindex="0"]')].filter(x=>x.getClientRects().length&&x.tabIndex>=0);if(!controls.length)return;const first=controls[0],last=controls.at(-1);if(event.shiftKey&&modalDocument.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&modalDocument.activeElement===last){event.preventDefault();first.focus();}}}
  modalDocument.addEventListener('keydown',modalKeydown);
  window.addEventListener('pagehide',()=>{clearTimeout(closingTimer);cancelAnimationFrame(animationFrame);restoreBackground();modalDocument.removeEventListener('keydown',modalKeydown);modal.remove();},{once:true});
})();

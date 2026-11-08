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
<span class="homepage-analysis-frame" aria-hidden="true"></span><header class="aa-identity-banner"><span class="aa-logo" aria-hidden="true"></span><div class="aa-identity-copy"><h2 id="homepage-analysis-title"><span class="aa-identity-ticker"></span><span class="aa-identity-name"></span><span class="aa-identity-subtitle">Asset Analysis</span></h2><div class="aa-identity-meta"></div></div><button type="button" class="homepage-analysis-close" aria-label="Close Asset Analysis">&#215;</button></header>
<div class="homepage-analysis-body" data-page="asset-analysis">
<section id="asset-analysis-panel" class="aa-panel" aria-label="Selected asset analysis">
<div id="asset-analysis-tabs" class="aa-tabs" role="tablist" aria-label="Asset analysis sections"></div>
<div id="asset-analysis-detail" aria-live="polite"></div>
</section></div></section>`;
  modalDocument.body.append(modal);
  const dialog=modal.querySelector('.homepage-analysis-dialog'),body=modal.querySelector('.homepage-analysis-body');
  const analysis=window.AssetAnalysis.create(body,dialog.querySelector(".aa-identity-banner"));
  const motionWindow=modalDocument.defaultView, backdrop=modal.querySelector('.homepage-analysis-backdrop');
  const reducedMotion=motionWindow.matchMedia('(prefers-reduced-motion: reduce)');
  let opener=null, animations=[], phase='closed', generation=0;
  function cancelMotion(){generation++;for(const animation of animations)animation.cancel();animations=[];dialog.classList.remove('has-arrived');}
  function originRect(){
    if(!opener?.isConnected)return null;
    const rect=opener.getBoundingClientRect();let x=rect.left,y=rect.top;
    if(modalDocument!==document){const frame=window.frameElement?.getBoundingClientRect();if(!frame)return null;x+=frame.left;y+=frame.top;}
    if(!rect.width||!rect.height||x+rect.width<=0||y+rect.height<=0||x>=motionWindow.innerWidth||y>=motionWindow.innerHeight)return null;
    return {left:x,top:y,width:rect.width,height:rect.height};
  }
  function originTransform(rect){
    const target=dialog.getBoundingClientRect();
    return rect?`translate(${rect.left-target.left}px,${rect.top-target.top}px) scale(${rect.width/target.width},${rect.height/target.height})`:`translate(${target.width*.02}px,${target.height*.02}px) scale(.96)`;
  }
  function animateModal(opening,fromTransform){
    const token=generation, duration=reducedMotion.matches?0:(opening?400:275);
    const target=originTransform(originRect());
    const run=(element,frames)=>{const animation=element.animate(frames,{duration,easing:'cubic-bezier(.22,.75,.25,1)',fill:'both'});animations.push(animation);return animation.finished;};
    const tasks=[run(dialog,[{transform:fromTransform||(opening?target:'none'),opacity:1},{transform:opening?'none':target,opacity:opening?1:0}]),run(backdrop,[{opacity:opening?0:1},{opacity:opening?1:0}]),run(body,[{opacity:opening?0:1},{opacity:opening?1:0}])];
    Promise.all(tasks).then(()=>{
      if(token!==generation)return;
      cancelMotion();
      if(opening){phase='open';if(!reducedMotion.matches)dialog.classList.add('has-arrived');}
      else{phase='closed';modal.hidden=true;modal.classList.remove('is-open');analysis.clear();restoreBackground();if(opener?.isConnected)opener.focus({preventScroll:true});}
    }).catch(()=>{});
  }
  const background=[];
  const symbolOf=el=>String(el?.dataset.symbol||el?.dataset.asset||el?.textContent||'').toUpperCase().match(/[A-Z0-9]{1,30}USDT\b|[A-Z0-9]{1,30}/)?.[0].replace(/USDT$/,'')||'';
  function open(symbol,source,side,options){
    if(!/^[A-Z0-9]{1,30}$/.test(symbol))return;
    const previous=modal.hidden?null:motionWindow.getComputedStyle(dialog).transform;cancelMotion();phase='opening';opener=source;modal.hidden=false;document.body.classList.add('analysis-modal-open');modalDocument.body.classList.add('analysis-modal-open');
    // Inert sibling branches all the way to body, including when the modal is in the footer.
    if(!background.length){let branch=modal;while(branch.parentElement){for(const sibling of branch.parentElement.children){if(sibling!==branch){background.push([sibling,sibling.inert]);sibling.inert=true;}}branch=branch.parentElement;if(branch===modalDocument.body)break;}}
    body.scrollTop=0;analysis.showAsset(symbol,side,options);
    modal.classList.add('is-open');animateModal(true,previous);modal.querySelector('.homepage-analysis-close').focus({preventScroll:true});
  }
  function restoreBackground(){document.body.classList.remove('analysis-modal-open');modalDocument.body.classList.remove('analysis-modal-open');for(const [element,inert] of background)element.inert=inert;background.length=0;}
  function close(){if(modal.hidden||phase==='closing')return;const current=motionWindow.getComputedStyle(dialog).transform;cancelMotion();phase='closing';analysis.clear(true);animateModal(false,current);}
  function settleOnResize(){if(modal.hidden)return;const closing=phase==='closing';cancelMotion();if(closing){phase='closed';modal.hidden=true;modal.classList.remove('is-open');analysis.clear();restoreBackground();if(opener?.isConnected)opener.focus({preventScroll:true});}else phase='open';}
  motionWindow.addEventListener('resize',settleOnResize);
  reducedMotion.addEventListener('change',settleOnResize);
  modal.addEventListener('click',event=>{if(event.target.closest('[data-analysis-dismiss],.homepage-analysis-close'))close();});
  document.addEventListener('click',event=>{
    const marketCard=event.target.closest('#home-market-cards .home-coin-card[data-symbol]');
    if(marketCard){event.preventDefault();open(symbolOf(marketCard),marketCard);return;}
    const plan=event.target.closest('#sol-activity-list .sol-plan-card');
    if(plan){event.preventDefault();open(symbolOf(plan),plan,plan.entryPlan?.side,{tab:3,plan:plan.entryPlan});return;}
    const candidate=event.target.closest('.candidate-portrait');
    const position=event.target.closest('#home-position-list .home-position');
    if(candidate){if(event.target.closest('details,summary'))return;const sym=symbolOf(candidate);if(sym){event.preventDefault();event.stopImmediatePropagation();open(sym,event.target.closest('button')||candidate,candidate.v4Observation?.row?.side||candidate.closest('[data-side]')?.dataset.side);}return;}
    if(position){if(event.target.closest('details,summary,a,button'))return;const sym=symbolOf(position.querySelector('.home-position-name h3'));if(sym)open(sym,position,position.querySelector('.home-position-side')?.dataset.side);}
  },true);
  document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('#home-market-cards .home-coin-card[data-symbol]')){event.preventDefault();open(symbolOf(event.target),event.target);return;}if((event.key==='Enter'||event.key===' ')&&event.target.matches('#home-position-list .home-position')){event.preventDefault();const sym=symbolOf(event.target.querySelector('.home-position-name h3'));if(sym)open(sym,event.target,event.target.querySelector('.home-position-side')?.dataset.side);}});
  function modalKeydown(event){if(modal.hidden)return;if(event.key==='Escape'){event.preventDefault();close();return;}if(event.key==='Tab'){const controls=[...dialog.querySelectorAll('button:not(:disabled),a[href],summary,[tabindex="0"]')].filter(x=>x.getClientRects().length&&x.tabIndex>=0);if(!controls.length)return;const first=controls[0],last=controls.at(-1);if(event.shiftKey&&modalDocument.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&modalDocument.activeElement===last){event.preventDefault();first.focus();}}}
  modalDocument.addEventListener('keydown',modalKeydown);
  window.addEventListener('pagehide',()=>{cancelMotion();motionWindow.removeEventListener('resize',settleOnResize);reducedMotion.removeEventListener('change',settleOnResize);restoreBackground();modalDocument.removeEventListener('keydown',modalKeydown);modal.remove();},{once:true});
})();

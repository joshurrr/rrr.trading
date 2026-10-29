'use strict';
(() => {
  const button=document.getElementById('refresh-news');
  async function refresh(){
    button.disabled=true;
    try{
      await window.EvolvingIntelligence.mount(document.getElementById('persistent-intelligence'));
      document.getElementById('feed-status').textContent='Saved persistent Luna themes · Read-only paper trading context.';
    }finally{button.disabled=false;}
  }
  button.addEventListener('click',refresh);
  refresh();
})();

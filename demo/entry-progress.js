'use strict';
(() => {
  if (document.body.dataset.bot !== 'long') return;
  const ids=['scan','technical','daily','intelligence','risk','final'];
  const titles=['Market scan','Technical signal','Daily trend','Entry intelligence','Price & risk check','Final decision'];
  const stageLabel=s=>s.number===4?window.intelligenceWording.heading(s.state):s.state;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label=p=>String(p??'').replace(/:USDT$/,'');
  const summary=document.getElementById('entry-hold-summary');
  const paths=document.getElementById('entry-stage-paths');
  const date=v=>Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' Brisbane':'Not supplied';
  const unknown=reason=>{
    summary.className='hold-summary';
    summary.innerHTML='<strong>Blocking stage unverified</strong><p>'+esc(reason)+'</p>';
    paths.replaceChildren();
    document.querySelectorAll('.stage-hold-marker').forEach(n=>n.remove());
    document.querySelectorAll('.held-stage').forEach(n=>n.classList.remove('held-stage'));
  };
  window.renderLongEntryProgress=d=>{
    const p=d.entry_progress, age=Date.now()-Date.parse(p?.observed_at);
    const scan=Array.isArray(d.market_scan)?d.market_scan:[];
    if(p?.schema!==1||!Array.isArray(p.assets)||!Number.isFinite(age)||age<0||age>30000) {
      unknown('Current stage diagnostics are unavailable. Signals and historical approvals do not identify a current hold.');return;
    }
    const assets=p.assets.filter(a=>scan.some(s=>s.pair===a.pair&&s.timestamp===a.signal_at&&s.direction===a.direction)&&
      Array.isArray(a.stages)&&a.stages.length===6&&a.stages.every((s,i)=>s.number===i+1)&&
      (a.hold_stage===null||Number.isInteger(a.hold_stage)&&a.hold_stage>=2&&a.hold_stage<=5));
    if(!assets.length){unknown('No current asset stage diagnostics are supplied.');return;}
    const held=assets.filter(a=>a.hold_stage&&a.hold_stage!==2), waiting=assets.filter(a=>a.hold_stage===2);
    const btc=held.some(a=>a.hold_stage===4&&a.direction==='LONG')&&p.btc_guard?.state==='HELD';
    summary.className='hold-summary'+(held.length?' is-held':'');
    summary.innerHTML='<strong>'+esc(held.length?(btc?'Stage 4 · New longs held by BTC protection':held.length+' asset(s) held at an entry check'):waiting.length===assets.length?'Stage 2 · Waiting for a four-hour setup':'No confirmed blocking stage for remaining candidates')+'</strong>'+
      '<p>'+esc(btc?'The bot is running. BTC rollover protection blocks new longs until three completed 15-minute BTC candles show rising lows and closes, a close above the previous high, improving MACD histogram and rising RSI of at least 50.':held.length?'Follow each asset below for its blocking stage and reason. Other checks may still be unverified.':'A signal or passed guard check does not establish an order or fill.')+'</p>'+
      (btc?'<p class="hold-observed">BTC hold triggered '+esc(date(p.btc_guard.event_at))+' · checked '+esc(date(p.btc_guard.observed_at))+'</p>':'')+
      '<p class="hold-observed">Stage observations '+esc(date(p.observed_at))+' · <a href="#intelligence-title">Entry intelligence</a> · <a href="#risk-title">Price &amp; risk</a></p>';
    paths.innerHTML=assets.map(a=>'<article class="entry-path"><h3>'+esc(label(a.pair))+' <span>'+esc(a.direction||'No direction')+'</span></h3><p class="path-reason">'+esc(a.hold_stage?'Stage '+a.hold_stage+' · '+a.reason:a.reason)+'</p><ol class="stage-track">'+a.stages.slice(1).map((s)=>'<li class="'+(a.hold_stage===s.number?'track-held':'')+'"><a href="#'+ids[s.number-1]+'-title"><span>'+esc(s.number+' · '+titles[s.number-1])+'</span><strong>'+esc(stageLabel(s))+'</strong></a></li>').join('')+'</ol></article>').join('');
    document.querySelectorAll('.stage-hold-marker').forEach(n=>n.remove());
    document.querySelectorAll('.held-stage').forEach(n=>n.classList.remove('held-stage'));
    for(const a of assets) for(const s of a.stages) {
      const grid=document.querySelector('[data-stage="'+ids[s.number-1]+'"]');
      const card=grid&&Array.from(grid.querySelectorAll('.asset-path')).find(n=>n.dataset.pair===a.pair);
      if(!card||s.number<4)continue;
      if(s.number!==5)card.querySelectorAll('.mini,.why').forEach(n=>n.remove());
      else card.querySelectorAll('.why').forEach(n=>n.remove());
      if(a.hold_stage===s.number)card.classList.add('held-stage');
      const marker=document.createElement('div');marker.className='stage-hold-marker';
      marker.innerHTML='<strong>'+esc(stageLabel(s))+'</strong><p>'+esc(s.reason)+'</p>'+(s.observed_at?'<small>Check '+esc(date(s.observed_at))+'</small>':'');
      card.prepend(marker);
      card.querySelector('.node-main').textContent=stageLabel(s);
      if(s.number===4&&s.state==='FAIL-OPEN'){const note=document.createElement('p');note.className='why';note.textContent=window.intelligenceWording.explanation;card.append(note);}
      if(s.number===6){const note=document.createElement('p');note.className='why';note.textContent='Order or fill confirmation is not supplied by these stage diagnostics.';card.append(note);}
    }
  };
  window.longEntryProgressUnavailable=reason=>unknown('Stage diagnostics '+reason.toLowerCase()+'. Previous holds and approvals cannot be treated as current.');
})();

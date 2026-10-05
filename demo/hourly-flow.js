'use strict';
(() => {
  if (document.body.dataset.bot !== 'medium') return;
  const ids=['technical','daily','intelligence','risk','final'];
  const guides=new Map(ids.map(id=>[id,document.getElementById(id)]));
  const flow=document.getElementById('flow');
  const group=flow.querySelector('.flow-group');
  group.querySelector('.group-step-label').textContent='Step 1 · Scan, then follow each asset';
  group.querySelector('.group-intro p').textContent='The scan branches into one card per new signal or existing position at every stage below. OPEN means an existing position, not a new entry approval. Each column follows the same asset; on mobile, use the repeated pair labels.';
  group.append(document.getElementById('scan'));
  group.querySelector('.flow-steps').remove();
  const grids=new Map();
  for (const id of ids) {
    const guide=guides.get(id);
    const section=document.createElement('section');
    section.className='flow-group asset-stage';
    section.setAttribute('aria-labelledby',id+'-title');
    flow.append(section);
    section.append(guide);
    guide.dataset.hourlyGuide='';
    const grid=document.createElement('div');
    grid.className='asset-stage-grid'; grid.dataset.stage=id;
    grid.innerHTML='<p class="feed-note">Asset processing UNAVAILABLE · awaiting scan.</p>';
    section.append(grid); grids.set(id,grid);
  }
  flow.querySelector('.macro-group').remove();
  const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label=p=>String(p??'—').replace(/^([A-Z0-9]+\/([A-Z0-9]+)):\2$/,'$1');
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const num=v=>finite(v)?new Intl.NumberFormat('en-US',{maximumFractionDigits:4}).format(v):'UNKNOWN';
  const date=v=>Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' Brisbane':'UNKNOWN';
  const row=(k,v)=>`<div class="mini"><span>${esc(k)}</span><span>${esc(v)}</span></div>`;
  const note=v=>`<p class="why">${esc(v)}</p>`;
  const same=(a,b)=>a?.pair===b.pair&&Number.isFinite(Date.parse(b.timestamp))&&a.timestamp===b.timestamp;
  window.renderHourlyBranches=d=>{
    const all=Array.isArray(d.market_scan)?d.market_scan:[];
    const assets=all.filter((s,i)=>['OPEN','SIGNAL'].includes(s.state)&&typeof s.pair==='string'&&all.findIndex(a=>a.pair===s.pair)===i);
    const candidates=assets.filter(s=>s.state==='SIGNAL').length;
    document.getElementById('scan').querySelector('.contents').insertAdjacentHTML('beforeend',note(`${candidates} new signal(s) · ${assets.length-candidates} existing position(s). Follow their individual cards below. Other scanned assets have no current entry path.`));
    for(const id of ids) {
      const grid=grids.get(id);
      grid.style.setProperty('--asset-columns',Math.min(assets.length||1,4));
      grid.innerHTML=assets.length?assets.map(s=>{
        const open=s.state==='OPEN', selected=same(d.technical,s);
        let outcome='UNKNOWN',content='';
        if(id==='technical') {
          const v=s.indicators||(selected?d.technical.values:null)||{};
          outcome=s.direction?'SIGNAL OBSERVED':open?'POSITION OPEN':'UNKNOWN';
          content=row('Closed hourly candle',date(s.timestamp))+row('Current entry flag',s.direction||'No direction supplied')+Object.entries({ema20:'EMA 20',ema50:'EMA 50',ema200:'EMA 200',rsi:'RSI',macd:'MACD',macdsignal:'MACD signal',volume:'Volume'}).map(([k,l])=>row(l,num(v[k]))).join('')+note(open?'An existing position is monitored here. A current entry flag is not its original entry decision.':'This pair’s recorded signal and raw indicators; individual checklist outcomes are not retained.');
        } else if(id==='daily') {
          const v=s.daily_values||(selected?d.higher_timeframe_trend?.values:null)||{};
          const fresh=s.daily_fresh??(selected?d.higher_timeframe_trend?.fresh:null);
          const valid=fresh===true&&['ema20','ema50','ema200','close'].every(k=>finite(v[k]));
          const trend=valid?(v.ema20<v.ema50&&v.ema50<v.ema200&&v.close<v.ema50?'DOWNTREND':v.ema20>v.ema50&&v.ema50>v.ema200&&v.close>v.ema50?'UPTREND':'MIXED'):'UNKNOWN';
          outcome=s.direction==='LONG'?'NOT REQUIRED':fresh===false?'STALE':trend;
          content=row('4H observed trend',trend)+row('4H data',fresh===true?'FRESH':fresh===false?'STALE':'UNKNOWN')+row('Short trend alignment',s.direction==='LONG'?'NOT REQUIRED':s.direction==='SHORT'&&valid?(trend==='DOWNTREND'?'ALIGNED':'CONFLICT'):'UNKNOWN')+Object.entries(v).filter(([k])=>['ema20','ema50','ema200','close'].includes(k)).map(([k,v])=>row('4H '+k,num(v))).join('')+row('75-minute / 0.5 ATR entry checks','NOT PUBLISHED')+note('Observed trend is specific to this pair. Stable-history and final confirmation outcomes are not retained.');
        } else if(id==='intelligence') {
          const tr=selected?d.traderouter:null;
          content=row('Hourly guard vote','NOT PUBLISHED')+row('Verified news / event vote','NOT PUBLISHED')+row('Legacy gate',tr?.state||'UNKNOWN')+row('Recorded macro score',finite(tr?.macro?.source_score_0_100)?num(tr.macro.source_score_0_100)+' / 100':'UNKNOWN')+row('Recorded asset context',tr?.asset?.regime||'UNKNOWN')+note(tr?'Public legacy evidence for this exact pair and candle. It does not establish the separate hourly guard outcome.':'No public context vote for this pair and candle. Another asset’s context result is never reused.');
        } else if(id==='risk') {
          const r=d.risk||{};
          outcome=open?'POSITION ALREADY OPEN':'NOT RECORDED';
          content=row('Shared open positions',num(r.open_positions)+' / '+(r.max_open_positions===-1?'Unlimited':num(r.max_open_positions)))+row('Shared asset admission','NOT PUBLISHED')+note(open?'This scan reports an existing position; it is not a new admission.':'Capacity is shared across the bot. This count does not prove this asset passed admission.');
        } else {
          const f=same(d.final_decision,s)?d.final_decision:null;
          const exit=(d.exit_monitoring||[]).find(e=>e.pair===s.pair&&e.timestamp===s.timestamp);
          outcome=open?'POSITION OPEN':f?.state||'UNKNOWN';
          content=row('Pair',label(s.pair))+row('Candle close',date(s.timestamp))+row('Order sent',open?'Existing position':f?.order_sent||'UNKNOWN')+(open?row('Closed-candle exit signal',exit?.exit_signal||'UNKNOWN')+note('Continue exit monitoring below. Current entry checks do not reconstruct this position’s original approval.') : note(f?.reason||'No retained final outcome for this pair and candle. A technical signal does not establish an order or fill.'));
        }
        return `<article class="node asset-path" data-pair="${esc(s.pair)}"><h4>${esc(label(s.pair))}</h4><div class="asset-role">${open?'Existing position · exit monitoring':'New signal · entry candidate'}</div><div class="node-main">${esc(outcome)}</div>${content}</article>`;
      }).join(''):note('No new signals or existing positions in the supplied scan. All scanned assets remain visible in Stage 1.');
    }
  };
  window.hourlyFlowUnavailable=reason=>{
    for(const grid of grids.values()) {
      if(!grid.querySelector('.asset-path')) grid.innerHTML=note('Asset processing '+reason+' · no current scan available.');
      for(const card of grid.querySelectorAll('.asset-path')) {
        card.querySelector('.node-main').textContent=reason;
        card.querySelector('.asset-role').textContent='Previous observation retained · not current';
      }
    }
  };
})();

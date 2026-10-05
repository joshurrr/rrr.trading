'use strict';
(() => {
  const bot=document.body.dataset.bot;
  if (!['medium','long'].includes(bot)) return;
  const hourly=bot==='medium', confirmation=hourly?'4H':'1D', guard=hourly?'hourly':'four-hour';
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
    guide.dataset.assetGuide='';
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
  window.renderAssetBranches=d=>{
    const all=Array.isArray(d.market_scan)?d.market_scan:[];
    const assets=all.filter((s,i)=>['OPEN','SIGNAL'].includes(s.state)&&typeof s.pair==='string'&&all.findIndex(a=>a.pair===s.pair)===i);
    const candidates=assets.filter(s=>s.state==='SIGNAL').length;
    const names={BTC:'Bitcoin',ETH:'Ethereum',SOL:'Solana',XRP:'XRP',LINK:'Chainlink',ONDO:'Ondo',AAVE:'Aave',UNI:'Uniswap',HYPE:'Hyperliquid',INJ:'Injective'};
    document.getElementById('scan').querySelector('.contents').innerHTML=(all.length?'<div class="scan-tiles" aria-label="Market scan asset statuses">'+all.map(s=>{
      const symbol=String(s.pair??'').split('/')[0];
      const status=['OPEN','SIGNAL','NO SIGNAL','STALE'].includes(s.state)?s.state:'UNKNOWN';
      const tone={OPEN:'open',SIGNAL:'signal','NO SIGNAL':'none',STALE:'unavailable'}[status]||'unavailable';
      const meaning={OPEN:'Existing position',SIGNAL:'New entry candidate','NO SIGNAL':'No entry setup',STALE:'Candle data stale',UNKNOWN:'Scan unavailable'}[status];
      return `<article class="scan-tile scan-${tone}" data-pair="${esc(s.pair)}"><div class="scan-asset"><strong>${esc(symbol||label(s.pair))}</strong><span>${esc(names[symbol]||label(s.pair))}</span></div><div class="scan-state">${esc(status)}</div><div class="scan-meaning">${esc(meaning)}</div></article>`;
    }).join('')+'</div>':note('Market scan UNAVAILABLE · no asset observations supplied.'))+note(`${candidates} new signal(s) · ${assets.length-candidates} existing position(s). Follow their individual cards below. Other scanned assets have no current entry path.`);
    for(const id of ids) {
      const grid=grids.get(id);
      grid.style.setProperty('--asset-columns',Math.min(assets.length||1,4));
      grid.innerHTML=assets.length?assets.map(s=>{
        const open=s.state==='OPEN', selected=same(d.technical,s);
        let outcome='UNKNOWN',content='';
        if(id==='technical') {
          const v=s.indicators||(selected?d.technical.values:null)||{};
          outcome=s.direction?'SIGNAL OBSERVED':open?'POSITION OPEN':'UNKNOWN';
          content=row(hourly?'Closed hourly candle':'Closed four-hour candle',date(s.timestamp))+row('Current entry flag',s.direction||'No direction supplied')+Object.entries({ema20:'EMA 20',ema50:'EMA 50',ema200:'EMA 200',rsi:'RSI',macd:'MACD',macdsignal:'MACD signal',volume:'Volume'}).map(([k,l])=>row(l,num(v[k]))).join('')+note(open?'An existing position is monitored here. A current entry flag is not its original entry decision.':'This pair’s recorded signal and raw indicators; individual checklist outcomes are not retained.');
        } else if(id==='daily') {
          const higher=hourly?d.higher_timeframe_trend:d.daily_trend;
          const v=s.daily_values||(selected?higher?.values:null)||{};
          const fresh=s.daily_fresh??(selected?higher?.fresh:null);
          const valid=fresh===true&&['ema20','ema50','ema200','close'].every(k=>finite(v[k]));
          const trend=valid?(v.ema20<v.ema50&&v.ema50<v.ema200&&v.close<v.ema50?'DOWNTREND':v.ema20>v.ema50&&v.ema50>v.ema200&&v.close>v.ema50?'UPTREND':'MIXED'):'UNKNOWN';
          outcome=hourly&&s.direction==='LONG'?'NOT REQUIRED':fresh===false?'STALE':trend;
          content=row(confirmation+' observed trend',trend)+row(confirmation+' data',fresh===true?'FRESH':fresh===false?'STALE':'UNKNOWN')+row(hourly?'Short trend alignment':'Daily direction alignment',hourly&&s.direction==='LONG'?'NOT REQUIRED':['LONG','SHORT'].includes(s.direction)&&valid?((s.direction==='LONG'&&trend==='UPTREND')||(s.direction==='SHORT'&&trend==='DOWNTREND')?'ALIGNED':'CONFLICT'):'UNKNOWN')+Object.entries(v).filter(([k])=>['ema20','ema50','ema200','close'].includes(k)).map(([k,v])=>row(confirmation+' '+k,num(v))).join('')+row(hourly?'75-minute / 0.5 ATR entry checks':'Signal age / 0.5 ATR quote checks','NOT PUBLISHED')+note('Observed trend is specific to this pair. Stable-history and final confirmation outcomes are not retained.');
        } else if(id==='intelligence') {
          const tr=selected?d.traderouter:null;
          content=row(hourly?'Hourly guard vote':'Four-hour guard vote','NOT PUBLISHED')+row('Verified news / event vote','NOT PUBLISHED')+row('Legacy gate',tr?.state||'UNKNOWN')+row('Recorded macro score',finite(tr?.macro?.source_score_0_100)?num(tr.macro.source_score_0_100)+' / 100':'UNKNOWN')+row('Recorded asset context',tr?.asset?.regime||'UNKNOWN')+note(tr?`Public legacy evidence for this exact pair and candle. It does not establish the separate ${guard} guard outcome.`:'No public context vote for this pair and candle. Another asset’s context result is never reused.');
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
        return `<article class="node asset-path ${open?'scan-open':'scan-signal'}" data-pair="${esc(s.pair)}"><h4>${esc(label(s.pair))}</h4><div class="asset-role">${open?'Existing position · exit monitoring':'New signal · entry candidate'}</div><div class="node-main">${esc(outcome)}</div>${content}</article>`;
      }).join(''):note('No new signals or existing positions in the supplied scan. All scanned assets remain visible in Stage 1.');
    }
  };
  window.assetFlowUnavailable=reason=>{
    for(const tile of document.querySelectorAll('.scan-tile')) {
      tile.className='scan-tile scan-unavailable';
      tile.querySelector('.scan-state').textContent=reason;
      tile.querySelector('.scan-meaning').textContent='Previous scan · not current';
    }
    for(const grid of grids.values()) {
      if(!grid.querySelector('.asset-path')) grid.innerHTML=note('Asset processing '+reason+' · no current scan available.');
      for(const card of grid.querySelectorAll('.asset-path')) {
        card.className='node asset-path scan-unavailable';
        card.querySelector('.node-main').textContent=reason;
        card.querySelector('.asset-role').textContent='Previous observation retained · not current';
      }
    }
  };
})();

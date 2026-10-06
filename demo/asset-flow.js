'use strict';
(() => {
  const wording=window.intelligenceWording;
  const bot=document.body.dataset.bot;
  if (!['short','medium','long'].includes(bot)) return;
  const hourly=bot==='medium', short=bot==='short', confirmation=short?'1H':hourly?'4H':'1D', guard=hourly?'hourly':'four-hour';
  const ids=['technical','daily','intelligence','risk','final'];
  const guides=new Map(ids.map(id=>[id,document.getElementById(id)]));
  const flow=document.getElementById('flow');
  const group=flow.querySelector('.flow-group');
  if (bot!=='long') group.querySelector('.group-step-label').textContent='Step 1 · Scan, then follow each asset';
  if (bot!=='long') group.querySelector('.group-intro p').textContent='Current readings are visible while the bot waits. Technical and trend observations do not approve a trade. Entry checks below follow new signals and existing positions; OPEN means an existing position.';
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
  window.renderAssetBranches=(d,report={})=>{
    if(short){
      let overview=document.getElementById('saved-macro-overview');
      if(!overview){overview=document.createElement('div');overview.id='saved-macro-overview';document.getElementById('intelligence').append(overview);}
      overview.innerHTML='<p class="observation-label">Saved daily macro report · shared background</p>'+row('Macro data',report.macroState||'UNAVAILABLE')+row('Macro score',num(report.savedMacro?.macro_score))+row('Report date',report.savedMacro?.report_date||'UNKNOWN')+note('This saved report does not verify a bot entry check. Source confidence, coverage and macro score are separate measures.');
    }
    const all=Array.isArray(d.market_scan)?d.market_scan:[];
    const fresh=s=>!short||Number.isFinite(Date.parse(s.timestamp))&&Date.parse(s.timestamp)<=Date.now()&&Date.now()-Date.parse(s.timestamp)<=17*60000;
    const assets=all.filter((s,i)=>['OPEN','SIGNAL'].includes(s.state)&&typeof s.pair==='string'&&all.findIndex(a=>a.pair===s.pair)===i);
    const candidates=assets.filter(s=>s.state==='SIGNAL').length;
    const names={BTC:'Bitcoin',ETH:'Ethereum',SOL:'Solana',XRP:'XRP',LINK:'Chainlink',ONDO:'Ondo',AAVE:'Aave',UNI:'Uniswap',HYPE:'Hyperliquid',INJ:'Injective'};
    if (bot!=='long') document.getElementById('scan').querySelector('.contents').innerHTML=(all.length?'<div class="scan-tiles" aria-label="Market scan asset statuses">'+all.map(s=>{
      const symbol=String(s.pair??'').split('/')[0];
      const status=!fresh(s)?'STALE':['OPEN','SIGNAL','NO SIGNAL','STALE'].includes(s.state)?s.state:'UNKNOWN';
      const tone={OPEN:'open',SIGNAL:'signal','NO SIGNAL':'none',STALE:'unavailable'}[status]||'unavailable';
      const meaning={OPEN:'Existing position',SIGNAL:'New entry candidate','NO SIGNAL':'No entry setup',STALE:'Candle data stale',UNKNOWN:'Scan unavailable'}[status];
      return `<article class="scan-tile scan-${tone}" data-pair="${esc(s.pair)}"><div class="scan-asset"><strong>${esc(symbol||label(s.pair))}</strong><span>${esc(names[symbol]||label(s.pair))}</span></div><div class="scan-state">${esc(status)}</div><div class="scan-meaning">${esc(meaning)}</div></article>`;
    }).join('')+'</div>':note('Market scan UNAVAILABLE · no asset observations supplied.'))+note(`${candidates} new signal(s) · ${assets.length-candidates} existing position(s). ${short?'Stages 2 and 3 show entry signals and open positions. Readings are not entry approvals.':'Follow their individual cards below. Other scanned assets have no current entry path.'}`);
    for(const id of ids) {
      const grid=grids.get(id);
      const shown=assets;
      grid.style.setProperty('--asset-columns',Math.min(shown.length||1,4));
      grid.innerHTML=shown.length?shown.map(s=>{
        const open=s.state==='OPEN', waiting=s.state==='NO SIGNAL', current=fresh(s), selected=same(d.technical,s);
        let outcome='UNKNOWN',content='';
        if(id==='technical') {
          const v=s.indicators||(selected?d.technical.values:null)||{};
          outcome=!current?'STALE OBSERVATION':waiting?'WAITING FOR SETUP':s.direction?'SIGNAL OBSERVED':open?'POSITION OPEN':'UNKNOWN';
          content=row(short?'Closed 15-minute candle':hourly?'Closed hourly candle':'Closed four-hour candle',date(s.timestamp))+row('Current entry flag',s.direction||(waiting?'NO SIGNAL':'No direction supplied'))+Object.entries({ema20:'EMA 20',ema50:'EMA 50',ema200:'EMA 200',rsi:'RSI',macd:'MACD',macdsignal:'MACD signal',volume:'Volume'}).map(([k,l])=>row(l,num(v[k]))).join('')+note(open?'An existing position is monitored here. A current entry flag is not its original entry decision.':waiting?'No entry flag on this candle. These are observed indicators; the complete pullback checklist is not published.':'This pair’s recorded signal and raw indicators; individual checklist outcomes are not retained.');
        } else if(id==='daily') {
          const higher=bot!=='long'?d.higher_timeframe_trend:d.daily_trend;
          const v=s.daily_values||(selected?higher?.values:null)||{};
          const fresh=s.daily_fresh??(selected?higher?.fresh:null);
          const valid=fresh===true&&['ema20','ema50','ema200','close'].every(k=>finite(v[k]));
          const trend=valid?(v.ema20<v.ema50&&v.ema50<v.ema200&&v.close<v.ema50?'DOWNTREND':v.ema20>v.ema50&&v.ema50>v.ema200&&v.close>v.ema50?'UPTREND':'MIXED'):'UNKNOWN';
          outcome=!current?'STALE OBSERVATION':hourly&&s.direction==='LONG'?'NOT REQUIRED':fresh===false?'STALE':trend;
          content=row(confirmation+' observed trend',trend)+row(confirmation+' data',fresh===true?'FRESH':fresh===false?'STALE':'UNKNOWN')+row(short?'1-hour direction alignment':hourly?'Short trend alignment':'Daily direction alignment',hourly&&s.direction==='LONG'?'NOT REQUIRED':['LONG','SHORT'].includes(s.direction)&&valid?((s.direction==='LONG'&&trend==='UPTREND')||(s.direction==='SHORT'&&trend==='DOWNTREND')?'ALIGNED':'CONFLICT'):'UNKNOWN')+Object.entries(v).filter(([k])=>['ema20','ema50','ema200','close'].includes(k)).map(([k,v])=>row(confirmation+' '+k,num(v))).join('')+row(short?'Entry risk checks':hourly?'75-minute / 0.5 ATR entry checks':'Signal age / 0.5 ATR quote checks','NOT PUBLISHED')+note('Observed trend is specific to this pair. Stable-history and final confirmation outcomes are not retained.');
        } else if(id==='intelligence') {
          const tr=selected?d.traderouter:null;
          outcome=wording.heading(short?(tr?.state||'UNKNOWN'):'UNKNOWN');
          content=short?row('TradeRouter decision',wording.decision(tr?.state))+row('Recorded macro score',num(tr?.macro?.source_score_0_100))+row('Block decision',wording.block(tr?.entry_veto))+note(tr?'Retained TradeRouter decision evidence for this exact asset and candle. General headlines and the homepage event calendar are not a complete bot event check.':'No retained TradeRouter decision for this asset and candle. Another asset’s evidence is never reused.') : row(hourly?'Hourly guard vote':'Four-hour guard vote','NOT PUBLISHED')+row('Verified news / event vote','NOT PUBLISHED')+row('TradeRouter decision',wording.decision(tr?.state))+row('Block decision',wording.block(tr?.entry_veto))+row('Recorded macro score',finite(tr?.macro?.source_score_0_100)?num(tr.macro.source_score_0_100)+' / 100':'UNKNOWN')+row('Recorded asset context',tr?.asset?.regime||'UNKNOWN')+note(tr?`Public legacy evidence for this exact pair and candle. It does not establish the separate ${guard} guard outcome.`:'No public context vote for this pair and candle. Another asset’s context result is never reused.');
          if(tr?.state==='FAIL-OPEN') content+=note(wording.explanation);
        } else if(id==='risk') {
          const r=d.risk||{};
          outcome=open?'POSITION ALREADY OPEN':'NOT RECORDED';
          content=row('Bot open positions',num(r.open_positions)+' / '+(r.max_open_positions===-1?'Unlimited':num(r.max_open_positions)))+row('Cross-bot asset overlap','ALLOWED')+row('Per-bot admission','NOT PUBLISHED')+note(open?'This scan reports an existing position; it is not a new admission.':'Capacity belongs to this bot. This count does not prove this asset passed admission.');
        } else {
          const f=same(d.final_decision,s)?d.final_decision:null;
          const exit=(d.exit_monitoring||[]).find(e=>e.pair===s.pair&&e.timestamp===s.timestamp);
          outcome=open?'POSITION OPEN':f?.state||'UNKNOWN';
          content=row('Pair',label(s.pair))+row('Candle close',date(s.timestamp))+row('Order sent',open?'Existing position':f?.order_sent||'UNKNOWN')+(open?row('Closed-candle exit signal',exit?.exit_signal||'UNKNOWN')+note('Continue exit monitoring below. Current entry checks do not reconstruct this position’s original approval.') : note(f?.reason||'No retained final outcome for this pair and candle. A technical signal does not establish an order or fill.'));
        }
        return `<article class="node asset-path ${!current?'scan-unavailable':open?'scan-open':waiting?'scan-none':'scan-signal'}" data-pair="${esc(s.pair)}"><h4>${esc(label(s.pair))}</h4><div class="asset-role">${!current?'Previous candle · not current':open?'Existing position · exit monitoring':waiting?'Market observation · no entry candidate':'New signal · entry candidate'}</div><div class="node-main">${esc(outcome)}</div>${content}</article>`;
      }).join(''):note(short?'No entry candidates to evaluate on this scan. These checks wait for a qualifying signal; this is not an entry rejection.':'No new signals or existing positions in the supplied scan. All scanned assets remain visible in Stage 1.');
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

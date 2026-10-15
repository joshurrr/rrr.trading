(() => {
  'use strict';
  const bot=document.body.dataset.bot, home=!!document.getElementById('all-candidate-decisions');
  if (!home&&!['short','medium','long'].includes(bot)) return;
  const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const panel=node('section');panel.id='order-attempts';panel.className='panel order-attempts';
  const heading=node('h3','Entry orders & attempts'), note=node('p','Loading order evidence…'), list=node('div');
  note.className='feed-note';note.setAttribute('role','status');list.className='order-attempt-list';panel.append(heading,note,list);
  const anchor=home?document.getElementById('all-candidate-decisions'):document.querySelector('.completed-trades-section');
  anchor?.before(panel);
  let saved=null,drawn='';
  const states={ENTRY_PENDING:'ENTRY PENDING',PARTIALLY_FILLED:'PARTIALLY FILLED',FILLED:'FILLED ORDER · position confirmation separate',FILL_AWAITING_NATIVE_PERSISTENCE:'FILL REPORTED · awaiting native position',OPEN:'OPEN',CLOSED:'CLOSED',CANCELLED:'CANCELLED',REJECTED:'REJECTED',TIMED_OUT:'TIMED OUT',UNKNOWN:'UNKNOWN'};
  const money=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-AU',{maximumFractionDigits:8})+' USDT':'Unavailable';
  const date=v=>Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' Brisbane':'Unavailable';
  function draw() {
    const metadata=saved?.metadata, records=saved?.records;
    const match=metadata?.run_id&&Array.isArray(records?.records)&&records.records.every(r=>r&&typeof r==='object'&&!Array.isArray(r))&&records?.run_id===metadata.run_id&&(!window.RRRGeneration||window.RRRGeneration.acceptsRun(metadata));
    const age=Date.now()-saved?.recordsObserved, heartbeat=Date.now()-Date.parse(metadata?.last_run);
    const fresh=match&&Number.isFinite(age)&&age>=0&&age<45000&&metadata.mode==='PAPER'&&metadata.stale===false&&Number.isFinite(heartbeat)&&heartbeat>=-30000&&heartbeat<45000;
    const signature=JSON.stringify([saved,fresh,Boolean(match)]);
    if(signature===drawn)return;drawn=signature;
    const expanded=new Set(Array.from(list.querySelectorAll('details[open]')).map(d=>d.dataset.execution));
    list.replaceChildren();
    note.textContent=!saved?'Loading order evidence…':!match?'Order-attempt evidence unavailable. No absence of orders is inferred.':fresh?'Order attempts are separate from filled positions and completed trades.':'Saved order-attempt evidence · current state unavailable.';
    if (!match) return;
    const rows=Array.isArray(records.records)?records.records.slice(0,50).map(r=>{
      const report=saved.reports?.[{ '15m':'short','1h':'medium','4h':'long' }[r.timeframe]];
      const valid=window.BotRegistry.currentReporting(report,saved.recordsObserved,metadata)!==null;
      const pending=valid&&[...(report.pending_orders||[]),...(report.open_trades||[])].find(t=>t.amount===0&&(t.entry_tag||t.enter_tag)===`v2paper:${r.opportunity_id}:${r.sizing_id}`);
      return pending?{...r,order_state:'ENTRY_PENDING',native_pending_observed:true}:r;
    }):[];
    for (const r of rows) {
      const card=node('article');card.className='order-attempt';
      const status=(r.order_evidence===true||r.native_pending_observed===true)&&states[r.order_state]?states[r.order_state]:'UNKNOWN · order/fill outcome unverified';
      card.append(node('strong',`${r.symbol||'Asset unavailable'} · ${r.timeframe||'Timeframe unavailable'} · ${r.direction||'Direction unavailable'}`),node('p',status+(fresh?'':' · saved only')));
      card.append(node('p',`Requested margin: ${money(r.requested_stake)} · Executed margin: ${money(r.executed_stake)} · Leverage: ${typeof r.leverage==='number'&&Number.isFinite(r.leverage)&&r.leverage>0?r.leverage+'×':'Unavailable'}`));
      card.append(node('p',`Filled quantity: ${typeof r.filled_amount==='number'&&Number.isFinite(r.filled_amount)&&r.filled_amount>=0?r.filled_amount:'Unavailable'} · Fill price: ${money(r.execution_price)}`));
      card.append(node('p',`Requested: ${date(r.created_at)} · Updated: ${date(r.updated_at)}`));
      if(r.order_reason)card.append(node('p',r.order_reason));
      const detail=node('details'),summary=node('summary','Order identity');detail.dataset.execution=String(r.execution_id??r.opportunity_id);detail.open=expanded.has(detail.dataset.execution);detail.append(summary,node('p',`Execution: ${r.execution_id??'Unavailable'} · Native trade: ${r.native_trade_id??'Unavailable'} · Order: ${r.order_id??'Unavailable'} · Opportunity: ${r.opportunity_id??'Unavailable'}`));card.append(detail);list.append(card);
    }
    if(!rows.length)list.append(node('p','No retained execution attempts in this response. Older cancellation evidence may be unavailable.'));
    if(records.order_evidence_version!=='native-paper-order-v1')list.prepend(node('p','Detailed order lifecycle history is unavailable from the installed backend. Existing authorization records do not prove fills.'));
  }
  function refreshBot() {
    const summary=window.V2Paper?.summary();
    if(!summary)return;
    const records=summary.records ? {...summary.records,records:Array.isArray(summary.records.records)?summary.records.records.map(r=>{
      if(!r||typeof r!=='object')return r;
      const pending=summary.report?.pending_orders?.find(t=>(t.entry_tag||t.enter_tag)===`v2paper:${r.opportunity_id}:${r.sizing_id}`);
      return pending?{...r,order_state:'ENTRY_PENDING',native_pending_observed:true}:r;
    }):null} : null;
    saved={metadata:summary.metadata,records,recordsObserved:summary.recordsObserved};draw();
  }
  window.addEventListener('v2-paper-update',refreshBot);
  window.addEventListener('rrr-order-evidence',event=>{saved=event.detail;draw();});
  draw();if(!home)refreshBot();setInterval(draw,1000);
})();

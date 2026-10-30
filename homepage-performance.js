'use strict';
// Shared presentation model for the strip and history. Uses the existing validated snapshot only.
((scope)=>{
  const number=v=>(typeof v==='number'||typeof v==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim()))&&Number.isFinite(Number(v))?Number(v):null;
  const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
  const money=v=>v===null?'Unavailable':(v>0?'+':'')+v.toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})+' USDT';
  const tone=v=>v>0?'up':v<0?'down':'neutral';
  function model(data,diagnostics={},now=Date.now()){
    const served=stamp(data?.served_at),valid=data?.version==='paper-read-api-v1'&&data.mode==='paper';
    const fresh=valid&&served!==null&&served<=now+30000&&now-served<120000&&diagnostics.display!=='RETAINED';
    const history=data?.completed_trades,asOf=stamp(history?.as_of),all=history?.items;
    const validRow=t=>t&&stamp(t.entered_at)!==null&&stamp(t.closed_at)!==null&&stamp(t.entered_at)<=stamp(t.closed_at)&&stamp(t.closed_at)<=asOf&&number(t.net_pnl)!==null&&number(t.realized_pnl)!==null&&number(t.entry_price)>0&&number(t.exit_price)>0&&typeof t.symbol==='string'&&['LONG','SHORT'].includes(t.side);
    const ledger=number(data?.wallet?.realized_pnl);
    // AVAILABLE is the existing cache's full-list validation/reconciliation contract.
    const complete=fresh&&history?.availability==='AVAILABLE'&&history.truncated!==true&&asOf!==null&&asOf<=served&&Array.isArray(all)&&all.every(validRow)&&ledger!==null&&Math.abs(all.reduce((s,t)=>s+number(t.realized_pnl),0)-ledger)<=.0100001&&new Set(all.map(t=>t.id||[t.symbol,t.entered_at,t.closed_at].join('|'))).size===all.length;
    const trades=valid&&Array.isArray(all)?all.filter(validRow).filter(t=>stamp(t.closed_at)>now-86400000&&stamp(t.closed_at)<=now).sort((a,b)=>stamp(b.closed_at)-stamp(a.closed_at)):[];
    const source=data?.open_positions,items=source?.items,inventory=fresh&&(source?.inventory_availability==='AVAILABLE'||source?.availability==='AVAILABLE')&&Array.isArray(items)&&items.every(p=>p&&['LONG','SHORT'].includes(p.side));
    const netOpen=inventory&&source.availability==='AVAILABLE'&&items.every(p=>p.availability==='AVAILABLE'&&stamp(p.mark_expires_at)!==null&&stamp(p.mark_expires_at)>now&&number(p.financials?.estimated_net_pnl_usdt)!==null)?items.reduce((s,p)=>s+number(p.financials.estimated_net_pnl_usdt),0):null;
    // The paper ledger debits entry_fee at entered_at and exit_fee at closed_at,
    // in the same account commits. Keep the two fee windows independent.
    let fees=null;
    const feeRows=complete&&inventory?[...all,...items]:null;
    if(feeRows&&feeRows.every(p=>stamp(p.entered_at)!==null&&stamp(p.entered_at)<=served&&number(p.entry_fee)!==null&&number(p.entry_fee)>=0)
        &&all.every(p=>number(p.exit_fee)!==null&&number(p.exit_fee)>=0)
        &&new Set(feeRows.map(p=>p.id||[p.symbol,p.entered_at].join('|'))).size===feeRows.length){
      const entryTotal=feeRows.reduce((sum,p)=>sum+number(p.entry_fee),0),exitTotal=all.reduce((sum,p)=>sum+number(p.exit_fee),0);
      const recordedEntry=number(data.wallet.entry_fees_paid),recordedExit=number(data.wallet.exit_fees_paid);
      if(recordedEntry!==null&&recordedExit!==null&&Math.abs(entryTotal-recordedEntry)<=.0000001&&Math.abs(exitTotal-recordedExit)<=.0000001){
        const inside=at=>stamp(at)>now-86400000&&stamp(at)<=now;
        fees=feeRows.reduce((sum,p)=>sum+(inside(p.entered_at)?number(p.entry_fee):0),0)
          +all.reduce((sum,p)=>sum+(inside(p.closed_at)?number(p.exit_fee):0),0);
      }
    }
    return {trades,complete,availability:complete?'AVAILABLE':!valid?'UNAVAILABLE':fresh?'PARTIAL':'STALE',asOf:history?.as_of,served_at:data?.served_at,
      count:complete?trades.length:null,net:complete?trades.reduce((s,t)=>s+number(t.net_pnl),0):null,
      open:netOpen,positions:inventory?items.length:null,shorts:inventory?items.filter(p=>p.side==='SHORT').length:null,longs:inventory?items.filter(p=>p.side==='LONG').length:null,fees};
  }
  scope.HomePerformance={model,number,money,tone};
  if(typeof module!=='undefined')module.exports=scope.HomePerformance;
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id);if(!$('home-trading-performance'))return;
  let signature='';
  window.addEventListener('rrr-v4-home-position-snapshot',event=>{
    const result=model(event.detail?.data,event.detail?.diagnostics),key=JSON.stringify(result);
    if(key===signature)return;signature=key;
    for(const [id,value] of [['net',result.net],['open',result.open],['positions',result.positions],['closed',result.count],['fees',result.fees]]){
      const target=$('performance-'+id);target.textContent=['net','open','fees'].includes(id)?money(value):value===null?'Unavailable':String(value)+(id==='positions'?' Active':'');target.dataset.tone=tone(value);
    }
    $('performance-positions-note').textContent=result.positions===null?'Inventory unavailable':result.shorts+' Short / '+result.longs+' Long';
    $('performance-net-note').textContent=result.complete?'Net after recorded fees':result.availability+' · History not complete/current';
    $('performance-open-note').textContent=result.open===null?'Net valuation unavailable':'Estimated net · incl. closing fees';
    $('performance-fees-note').textContent=result.fees===null?'Complete recorded fee evidence unavailable':'Recorded entry / exit execution fees';
    $('home-performance-time').textContent='Snapshot · '+(stamp(result.served_at)===null?'unavailable':new Date(result.served_at).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' AEST');
    window.dispatchEvent(new CustomEvent('rrr-v4-completed-trade-activity',{detail:result}));
  });
})(typeof window==='undefined'?globalThis:window);

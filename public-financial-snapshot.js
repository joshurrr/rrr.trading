'use strict';
// Presentation-only, page-memory cache. No persistence, trading inputs or retries.
((scope) => {
  const MAX_AGE_MS=120000;
  const stamp=v=>typeof v==='string' && /(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v))?Date.parse(v):null;
  const number=v=>(typeof v==='number'||typeof v==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v))&&Number.isFinite(Number(v))?Number(v):null;
  const fields=['wallet_balance','equity','realized_pnl','unrealized_pnl','entry_fees_paid','exit_fees_paid'];
  function validate(data,now) {
    const missing=['wallet','open_positions','completed_trades','served_at'].filter(k=>data?.[k]===undefined);
    const fail=reason=>({reason,missing_fields:missing});
    if(missing.length)return fail('missing_required_fields');
    if(data.version!=='paper-read-api-v1'||data.mode!=='paper')return fail('invalid_paper_contract');
    const served=stamp(data.served_at), w=data.wallet, p=data.open_positions, h=data.completed_trades;
    if(served===null||served>now||now-served>=MAX_AGE_MS)return fail('snapshot_time_invalid_or_expired');
    if(!['AVAILABLE','STALE'].includes(w?.availability)||!['AVAILABLE','STALE'].includes(p?.availability)||h?.availability!=='AVAILABLE')return fail('financial_evidence_unavailable');
    const at=stamp(w.as_of);
    if(at===null||at>served||h.as_of!==w.as_of)return fail('financial_timestamps_inconsistent');
    if(!Array.isArray(p.items)||!Array.isArray(h.items))return fail('financial_items_missing');
    for(const key of fields)if(!['AVAILABLE','STALE'].includes(w.field_availability?.[key])||number(w.field_availability[key]==='STALE'?w.last_known?.[key]:w[key])===null)missing.push('wallet.'+key);
    if(missing.length)return fail('missing_or_invalid_wallet_fields');
    const values=Object.fromEntries(fields.map(k=>[k,number(w.field_availability[k]==='STALE'?w.last_known[k]:w[k])]));
    if(Math.abs(values.equity-values.wallet_balance-values.unrealized_pnl)>.0100001||values.entry_fees_paid<0||values.exit_fees_paid<0)return fail('wallet_reconciliation_failed');
    if(!h.items.every(t=>stamp(t?.closed_at)!==null&&stamp(t.closed_at)<=at&&stamp(t.entered_at)!==null&&stamp(t.entered_at)<=stamp(t.closed_at)&&number(t.realized_pnl)!==null&&number(t.net_pnl)!==null&&number(t.entry_price)>0&&number(t.exit_price)>0&&typeof t.symbol==='string'&&['LONG','SHORT'].includes(t.side)))return fail('closed_trade_validation_failed');
    if(Math.abs(h.items.reduce((s,t)=>s+number(t.realized_pnl),0)-values.realized_pnl)>.0100001)return fail('ledger_reconciliation_failed');
    if(!p.items.every(t=>t&&typeof t.symbol==='string'&&['LONG','SHORT'].includes(t.side)&&number(t.entry_price)>0&&['AVAILABLE','STALE'].includes(t.availability)&&stamp(t.entered_at)!==null&&stamp(t.entered_at)<=at&&stamp(t.mark_observed_at)!==null&&stamp(t.mark_expires_at)>stamp(t.mark_observed_at)))return fail('position_validation_failed');
    return null;
  }
  class Cache {
    constructor(clock=()=>Date.now()){this.clock=clock;this.saved=null;this.lastSuccess=null;this.error=null;this.highWater=null;}
    accept(data,diagnostics={}) {
      const now=this.clock(), invalid=validate(data,now), previous=this.highWater;
      const older=previous&&(stamp(data?.served_at)<previous.served||stamp(data?.wallet?.as_of)<previous.source||Number.isInteger(data?.wallet?.revision)&&previous.revision!==null&&data.wallet.revision<previous.revision);
      if(!invalid&&!older&&data.wallet.writer_lock_present&&this.saved){this.fail({state:'DATA_STALE',reason:'account_writer_lock_present',...diagnostics,response_snapshot_timestamp:data.served_at,response_generation:data.wallet.revision,response_correlation_id:data.snapshot?.request_id||null});return false;}
      if(invalid||older){this.fail({state:!older&&data?.snapshot?.financial_state==='API_UNAVAILABLE'?'API_UNAVAILABLE':'VALIDATION_FAILED',reason:older?'older_snapshot':invalid.reason,missing_fields:invalid?.missing_fields||[],...diagnostics,response_snapshot_timestamp:data?.served_at||null,response_generation:data?.wallet?.revision??null,response_correlation_id:data?.snapshot?.request_id||diagnostics.correlation_id||null,backend_reasons:data?.wallet?.reasons||[]});return false;}
      this.saved=structuredClone(data);this.lastSuccess=now;this.error=null;
      this.highWater={served:stamp(data.served_at),source:stamp(data.wallet.as_of),revision:Number.isInteger(data.wallet.revision)?data.wallet.revision:null};
      return true;
    }
    fail(error){this.error=error;}
    display() {
      const now=this.clock();
      if(this.saved&&(now-this.lastSuccess>=MAX_AGE_MS||now-stamp(this.saved.served_at)>=MAX_AGE_MS))this.saved=null;
      const sourceStale=this.saved&&(this.saved.wallet.availability==='STALE'||this.saved.open_positions.availability==='STALE'||stamp(this.saved.wallet.valuation_expires_at)!==null&&now>=stamp(this.saved.wallet.valuation_expires_at));
      return {data:this.saved,diagnostics:{endpoint:'https://v4.rrr.trading/v4/paper',maximum_age_ms:MAX_AGE_MS,
        ...this.error,state:this.error?.state||(sourceStale||!this.saved?'DATA_STALE':'CURRENT'),display:this.saved?(this.error||sourceStale?'RETAINED':'CURRENT'):'UNAVAILABLE',
        snapshot_timestamp:this.saved?.served_at||this.error?.snapshot_timestamp||null,source_timestamp:this.saved?.wallet.as_of||null,
        generation:this.saved?.wallet.revision??null,correlation_id:this.saved?.snapshot?.request_id||this.error?.correlation_id||null,
        last_successful_refresh:this.lastSuccess===null?null:new Date(this.lastSuccess).toISOString()}};
    }
  }
  scope.PublicFinancialSnapshot={Cache,validate,MAX_AGE_MS};
  if(typeof module!=='undefined')module.exports=scope.PublicFinancialSnapshot;
})(typeof window==='undefined'?globalThis:window);

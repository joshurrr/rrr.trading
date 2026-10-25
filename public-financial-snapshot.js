'use strict';
// Presentation-only, page-memory cache. No persistence, trading inputs or retries.
((scope) => {
  const MAX_AGE_MS=120000;
  const stamp=v=>typeof v==='string' && /(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v))?Date.parse(v):null;
  const number=v=>(typeof v==='number'||typeof v==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v))&&Number.isFinite(Number(v))?Number(v):null;
  const fields=['wallet_balance','equity','realized_pnl','unrealized_pnl','entry_fees_paid','exit_fees_paid'];
  const state=(availability,reason=null)=>({availability,reason});
  function walletView(source,served) {
    const unavailable=reason=>({data:{availability:'UNAVAILABLE',as_of:source?.as_of||null,field_availability:Object.fromEntries(fields.map(k=>[k,'UNAVAILABLE'])),reasons:[reason]},state:state('UNAVAILABLE',reason)});
    if(!source||!['AVAILABLE','STALE'].includes(source.availability))return unavailable('wallet_unavailable');
    const at=stamp(source.as_of);if(at===null||at>served||source.currency&&source.currency!=='USDT')return unavailable('wallet_timestamp_or_currency_invalid');
    const field_availability={},last_known={},values={},invalid=[];
    for(const key of fields){const freshness=source.field_availability?.[key],value=number(freshness==='STALE'?source.last_known?.[key]:freshness==='AVAILABLE'?source[key]:null);
      if(!['AVAILABLE','STALE'].includes(freshness)||value===null||(['entry_fees_paid','exit_fees_paid'].includes(key)&&value<0)){field_availability[key]='UNAVAILABLE';values[key]=null;last_known[key]=null;invalid.push('wallet.'+key);continue;}
      field_availability[key]=freshness;values[key]=freshness==='AVAILABLE'?source[key]:null;last_known[key]=freshness==='STALE'?source.last_known[key]:source[key];}
    if(['wallet_balance','equity','unrealized_pnl'].every(k=>last_known[k]!==null)&&Math.abs(last_known.equity-last_known.wallet_balance-last_known.unrealized_pnl)>.0100001){field_availability.equity='UNAVAILABLE';values.equity=null;last_known.equity=null;invalid.push('wallet.equity_reconciliation_failed');}
    if(source.valuation_expires_at!==undefined&&source.valuation_expires_at!==null&&stamp(source.valuation_expires_at)===null){for(const key of ['equity','unrealized_pnl']){field_availability[key]='UNAVAILABLE';values[key]=null;last_known[key]=null;}invalid.push('wallet.valuation_expires_at_invalid');}
    const count=fields.filter(k=>field_availability[k]!=='UNAVAILABLE').length,availability=count===fields.length?source.availability:count?'PARTIAL':'UNAVAILABLE';
    return {data:{...source,...values,last_known,field_availability,availability,reasons:[...(Array.isArray(source.reasons)?source.reasons.filter(v=>typeof v==='string'):[]),...invalid]},state:state(availability,invalid[0]||null)};
  }
  function validPosition(row,served) {
    if(!row||typeof row!=='object'||Array.isArray(row)||typeof row.symbol!=='string'||!row.symbol.trim()||!['LONG','SHORT'].includes(row.side)||number(row.entry_price)<=0||number(row.quantity)<=0||!['AVAILABLE','STALE'].includes(row.availability))return false;
    const entered=stamp(row.entered_at),observed=stamp(row.mark_observed_at),expires=stamp(row.mark_expires_at);
    if(entered===null||entered>served||observed===null||observed>served||entered>observed||expires===null||expires<=observed)return false;
    return row.availability==='AVAILABLE'?number(row.current_mark)>0&&number(row.unrealized_pnl)!==null:number(row.last_known_mark)>0&&number(row.last_known_unrealized_pnl)!==null;
  }
  function positionsView(source,served) {
    const unavailable=reason=>({data:{availability:'UNAVAILABLE',inventory_availability:'UNAVAILABLE',items:[],reasons:[reason]},state:state('UNAVAILABLE',reason)});
    if(!source||!['AVAILABLE','STALE'].includes(source.availability)||!Array.isArray(source.items))return unavailable('open_positions_missing_or_unavailable');
    const items=source.items.filter(row=>validPosition(row,served)),dropped=items.length!==source.items.length,seen=new Set();
    const unique=items.filter(row=>{const key=row.id||row.symbol;if(seen.has(key))return false;seen.add(key);return true;}),duplicate=unique.length!==items.length;
    const availability=dropped||duplicate?'PARTIAL':source.availability;
    return {data:{...source,availability,inventory_availability:dropped||duplicate?'PARTIAL':source.inventory_availability||'AVAILABLE',items:unique,
      reasons:[...(Array.isArray(source.reasons)?source.reasons.filter(v=>typeof v==='string'):[]),...(dropped?['invalid_position_rows_omitted']:[]),...(duplicate?['duplicate_position_rows_omitted']:[])]},state:state(availability,dropped?'invalid_position_rows_omitted':duplicate?'duplicate_position_rows_omitted':null)};
  }
  function validTrade(row,asOf) {
    const entered=stamp(row?.entered_at),closed=stamp(row?.closed_at);
    return !!row&&typeof row==='object'&&!Array.isArray(row)&&entered!==null&&closed!==null&&entered<=closed&&closed<=asOf&&number(row.realized_pnl)!==null&&number(row.net_pnl)!==null&&number(row.entry_price)>0&&number(row.exit_price)>0&&typeof row.symbol==='string'&&!!row.symbol.trim()&&['LONG','SHORT'].includes(row.side);
  }
  function tradesView(source,served,wallet) {
    const unavailable=reason=>({data:{availability:'UNAVAILABLE',as_of:source?.as_of||null,items:[],reasons:[reason]},state:state('UNAVAILABLE',reason)});
    if(!source||source.availability!=='AVAILABLE'||!Array.isArray(source.items))return unavailable('closed_trades_missing_or_unavailable');
    const asOf=stamp(source.as_of);if(asOf===null||asOf>served)return unavailable('closed_trade_timestamp_invalid');
    const items=source.items.filter(row=>validTrade(row,asOf)),invalidRows=items.length!==source.items.length,walletAt=stamp(wallet?.as_of);
    const realized=wallet?.field_availability?.realized_pnl==='STALE'?number(wallet.last_known?.realized_pnl):wallet?.field_availability?.realized_pnl==='AVAILABLE'?number(wallet.realized_pnl):null;
    let reason=invalidRows?'invalid_closed_trade_rows_omitted':null,complete=!invalidRows;
    if(walletAt!==null&&walletAt!==asOf){complete=false;reason=reason||'financial_timestamps_inconsistent';}
    if(realized===null||complete&&Math.abs(items.reduce((sum,row)=>sum+number(row.realized_pnl),0)-realized)>.0100001){complete=false;reason=reason||'ledger_reconciliation_failed';}
    const availability=complete?'AVAILABLE':'PARTIAL';
    return {data:{...source,availability,items,reasons:[...(Array.isArray(source.reasons)?source.reasons.filter(v=>typeof v==='string'):[]),...(reason?[reason]:[])]},state:state(availability,reason)};
  }
  function validate(data,now) {
    const served=stamp(data?.served_at);
    if(data?.version!=='paper-read-api-v1'||data?.mode!=='paper')return {fatal:'invalid_paper_contract'};
    if(served===null||served>now||now-served>=MAX_AGE_MS)return {fatal:'snapshot_time_invalid_or_expired'};
    const wallet=walletView(data.wallet,served),positions=positionsView(data.open_positions,served),trades=tradesView(data.completed_trades,served,wallet.data);
    return {data:{...data,wallet:wallet.data,open_positions:positions.data,completed_trades:trades.data},sections:{wallet:wallet.state,open_positions:positions.state,completed_trades:trades.state},served,source:stamp(wallet.data.as_of),revision:Number.isInteger(wallet.data.revision)?wallet.data.revision:null};
  }  class Cache {
    constructor(clock=()=>Date.now()){this.clock=clock;this.saved=null;this.lastSuccess=null;this.error=null;this.sections=null;this.highWater=null;}
    accept(data,diagnostics={}) {
      const now=this.clock(),result=validate(data,now),previous=this.highWater;
      if(result.fatal){this.fail({state:'VALIDATION_FAILED',reason:result.fatal,...diagnostics,response_snapshot_timestamp:data?.served_at||null,response_generation:data?.wallet?.revision??null,response_correlation_id:data?.snapshot?.request_id||diagnostics.correlation_id||null});return false;}
      const older=previous&&(result.served<previous.served||result.source!==null&&previous.source!==null&&result.source<previous.source||result.revision!==null&&previous.revision!==null&&result.revision<previous.revision);
      if(older){this.fail({state:'VALIDATION_FAILED',reason:'older_snapshot',...diagnostics,response_snapshot_timestamp:data?.served_at||null,response_generation:data?.wallet?.revision??null,response_correlation_id:data?.snapshot?.request_id||diagnostics.correlation_id||null});return false;}
      this.saved=structuredClone(result.data);this.sections=result.sections;this.lastSuccess=now;this.error=null;
      this.highWater={served:result.served,source:result.source,revision:result.revision};return true;
    }
    fail(error){this.error=error;}
    display() {
      const now=this.clock();
      if(this.saved&&(now-this.lastSuccess>=MAX_AGE_MS||now-stamp(this.saved.served_at)>=MAX_AGE_MS))this.saved=null;
      const sourceStale=this.saved&&(this.saved.wallet.availability==='STALE'||this.saved.open_positions.availability==='STALE'||stamp(this.saved.wallet.valuation_expires_at)!==null&&now>=stamp(this.saved.wallet.valuation_expires_at));
      const values=this.sections?Object.values(this.sections).map(v=>v.availability):[],unavailable=!this.saved||values.every(v=>v==='UNAVAILABLE');
      const partial=this.saved&&!unavailable&&values.some(v=>v==='PARTIAL'||v==='UNAVAILABLE');
      const state=this.error?.state||(unavailable?'VALIDATION_FAILED':sourceStale?'DATA_STALE':partial?'PARTIAL':'CURRENT');
      return {data:this.saved,diagnostics:{endpoint:'https://v4.rrr.trading/v4/paper',maximum_age_ms:MAX_AGE_MS,...this.error,sections:this.sections,
        state,display:this.saved?(this.error?'RETAINED':unavailable?'UNAVAILABLE':partial?'PARTIAL':'CURRENT'):'UNAVAILABLE',
        validation_state:unavailable?'VALIDATION_FAILED':partial?'PARTIAL':'VALID',
        valuation_state:sourceStale?'DATA_STALE':this.saved?'CURRENT':'UNAVAILABLE',writer_lock_present:this.saved?.wallet.writer_lock_present===true,
        snapshot_timestamp:this.saved?.served_at||this.error?.snapshot_timestamp||null,source_timestamp:this.saved?.wallet.as_of||this.error?.source_timestamp||null,
        generation:this.saved?.wallet.revision??null,correlation_id:this.saved?.snapshot?.request_id||this.error?.correlation_id||null,
        last_successful_refresh:this.lastSuccess===null?null:new Date(this.lastSuccess).toISOString()}};
    }
  }  scope.PublicFinancialSnapshot={Cache,validate,MAX_AGE_MS};
  if(typeof module!=='undefined')module.exports=scope.PublicFinancialSnapshot;
})(typeof window==='undefined'?globalThis:window);

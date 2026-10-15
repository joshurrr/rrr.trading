'use strict';
// Public presentation configuration only. Adding a bot never creates or enables it.
(() => {
  const bots = [
    {id:'short', name:'15 MIN BOT', timeframe:'15m', timeframeLabel:'15-minute', dashboard:'/demo/15minbot/', status:'/api/demos/short/status'},
    {id:'medium', name:'1 HR BOT', timeframe:'1h', timeframeLabel:'1-hour', dashboard:'/demo/1hrbot/', status:'/status'},
    {id:'long', name:'4 HR BOT', timeframe:'4h', timeframeLabel:'4-hour', dashboard:'/demo/4hrbot/', status:'/api/demos/long/status'},
    {id:'slingshot', name:'SLINGSHOT', timeframe:'15m', timeframeLabel:'15m entry · 1h / 4h confirmation', dashboard:'/demo/slingshot/', status:'/api/demos/slingshot/status', reporting:'/api/slingshot/reporting'}
  ].map(bot => Object.freeze({...bot, reporting:bot.reporting || '/api/demos/'+bot.id+'/reporting'}));
  function positionState(trade) {
    if (typeof trade?.amount !== 'number' || !Number.isFinite(trade.amount) || trade.amount < 0) return 'UNKNOWN';
    if (trade.amount === 0) return 'ENTRY_PENDING';
    return trade.position_state === 'PARTIALLY_FILLED' ? 'PARTIALLY_FILLED' : 'OPEN';
  }
  function separatePositions(rows) {
    if (!Array.isArray(rows)) return {open:null,pending:null,unknown:null};
    return {open:rows.filter(t => ['OPEN','PARTIALLY_FILLED'].includes(positionState(t))),
      pending:rows.filter(t => positionState(t)==='ENTRY_PENDING'), unknown:rows.filter(t => positionState(t)==='UNKNOWN')};
  }
  function positionReport(report) {
    if (!report) return report;
    const split=separatePositions(report.open_trades), portfolio={...report.portfolio};
    const pending=Array.isArray(report.pending_orders)?report.pending_orders:[], unverified=Array.isArray(report.unverified_positions)?report.unverified_positions:[];
    const invalidCollections=(report.pending_orders!=null&&!Array.isArray(report.pending_orders))||(report.unverified_positions!=null&&!Array.isArray(report.unverified_positions));
    // Older feeds include pending orders in position metrics. Suspend affected
    // totals; never invent their contribution or a fill from an OPEN label.
    if (invalidCollections || !split.open || split.pending?.length || split.unknown?.length || pending.length || unverified.length) {
      portfolio.open_positions=invalidCollections || !split.open || split.unknown?.length || unverified.length ? null : split.open.length;
      portfolio.total_trades=portfolio.open_positions===null ? null : Number.isSafeInteger(portfolio.closed_trades) ? portfolio.closed_trades+split.open.length : null;
      for (const key of ['profit_open_abs','profit_all_abs','profit_all_pct']) portfolio[key]=null;
    }
    return {...report,portfolio,open_trades:invalidCollections || split.unknown?.length || unverified.length ? null : split.open,
      pending_orders:[...pending,...(split.pending||[])],unverified_positions:[...unverified,...(split.unknown||[])]};
  }
  // Same current-run acceptance rules as the detailed V2 paper dashboards.
  function currentReporting(report, receivedAt, metadata, now = Date.now()) {
    if (window.RRRGeneration && !window.RRRGeneration.acceptsRun(metadata)) return null;
    const at = Date.parse(report?.observed_at);
    const start = Date.parse(report?.started_at), expectedStart = Date.parse(metadata?.started_at);
    return report?.available === true && Boolean(report.run_id) && report.run_id === metadata?.run_id &&
      Number.isFinite(start) && start === expectedStart && report.portfolio && Array.isArray(report.history) &&
      Array.isArray(report.open_trades) && now - receivedAt < 45000 && Number.isFinite(at) &&
      [...report.history, ...report.open_trades].every(row => {
        const value=row?.open_date;
        if(typeof value!=='string')return false;
        const opened=Date.parse(/(?:Z|[+-]\d\d:\d\d)$/i.test(value)?value:value.replace(' ','T')+'Z');
        return Number.isFinite(opened)&&opened>=start;
      }) &&
      now - at >= -30000 && now - at < 45000 ? report : null;
  }
  window.BotRegistry = Object.freeze({bots:Object.freeze(bots), currentReporting,positionState,separatePositions,positionReport});
})();

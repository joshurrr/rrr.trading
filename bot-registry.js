'use strict';
// Public presentation configuration only. Adding a bot never creates or enables it.
(() => {
  const bots = [
    {id:'short', name:'15 MIN BOT', timeframe:'15m', timeframeLabel:'15-minute', dashboard:'/demo/15minbot/', status:'/api/demos/short/status'},
    {id:'medium', name:'1 HR BOT', timeframe:'1h', timeframeLabel:'1-hour', dashboard:'/demo/1hrbot/', status:'/status'},
    {id:'long', name:'4 HR BOT', timeframe:'4h', timeframeLabel:'4-hour', dashboard:'/demo/4hrbot/', status:'/api/demos/long/status'}
  ].map(bot => Object.freeze({...bot, reporting:'/api/demos/'+bot.id+'/reporting'}));
  // Same current-run acceptance rules as the detailed V2 paper dashboards.
  function currentReporting(report, receivedAt, metadata, now = Date.now()) {
    const at = Date.parse(report?.observed_at);
    return report?.available === true && Boolean(report.run_id) && report.run_id === metadata?.run_id &&
      Number.isFinite(Date.parse(report.started_at)) && report.portfolio && Array.isArray(report.history) &&
      Array.isArray(report.open_trades) && now - receivedAt < 45000 && Number.isFinite(at) &&
      now - at >= -30000 && now - at < 45000 ? report : null;
  }
  window.BotRegistry = Object.freeze({bots:Object.freeze(bots), currentReporting});
})();

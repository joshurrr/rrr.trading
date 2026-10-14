'use strict';
const assert = require('node:assert/strict');
const {valid, firstTrade} = require('./v3-generation.js');
const now = Date.parse('2026-10-13T12:00:00Z');
const rebuilding = {generation:3,application:'RRR.Trading V3',factory_reset_at:'2026-10-13T11:00:00Z',phase:'REBUILDING',entries_blocked:true,run_id:null};
assert(valid(rebuilding,now));
assert(valid({...rebuilding,phase:'ACTIVE',entries_blocked:false,run_id:'v3-paper-new'},now));
for(const bad of [null,{}, {...rebuilding,generation:2},{...rebuilding,application:'V3'}, {...rebuilding,entries_blocked:false}, {...rebuilding,phase:'ACTIVE'}, {...rebuilding,run_id:'v2-paper-old'}, {...rebuilding,factory_reset_at:'2026-10-13T11:00:00'}, {...rebuilding,factory_reset_at:'2026-10-14T11:00:00Z'}]) assert(!valid(bad,now));
console.log('PASS V3 identity, blocked rebuild, timezone, future time and legacy-run rejection');
const tradeNow=Date.parse('2026-10-14T08:00:00Z'), runId='v3-paper-current';
const reports=()=>Object.fromEntries(['short','medium','long'].map(bot=>[bot,{run_id:runId,run_started_at:'2026-10-14T05:42:56Z',history:[],open_trades:[],portfolio:{closed_trades:0}}]));
let status=reports();status.long.open_trades=[{open_date:'2026-10-14 07:12:56'}];
assert.equal(firstTrade(status,runId,tradeNow),Date.parse('2026-10-14T07:12:56Z'));
status.long.history=status.long.open_trades;status.long.open_trades=[];status.long.portfolio.closed_trades=1;
assert.equal(firstTrade(status,runId,tradeNow),Date.parse('2026-10-14T07:12:56Z'));
for(const change of [s=>s.short=null,s=>s.short.run_id='v3-paper-old',s=>s.long.portfolio.closed_trades=2,s=>s.long.open_trades=[{open_date:'2026-10-14 04:00:00'}],s=>s.long.open_trades=[{open_date:'2026-10-14 09:00:00'}],s=>s.long.open_trades=[{open_date:'invalid'}]]){const s=reports();change(s);assert.equal(firstTrade(s,runId,tradeNow),null);}
assert.equal(firstTrade(reports(),runId,tradeNow),null);
console.log('PASS first recorded trade: UTC/Brisbane source, closed history, unavailable/legacy/incomplete/future evidence');

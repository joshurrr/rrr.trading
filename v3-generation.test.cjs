'use strict';
const assert = require('node:assert/strict');
const {valid} = require('./v3-generation.js');
const now = Date.parse('2026-10-13T12:00:00Z');
const rebuilding = {generation:3,application:'RRR.Trading V3',factory_reset_at:'2026-10-13T11:00:00Z',phase:'REBUILDING',entries_blocked:true,run_id:null};
assert(valid(rebuilding,now));
assert(valid({...rebuilding,phase:'ACTIVE',entries_blocked:false,run_id:'v3-paper-new'},now));
for(const bad of [null,{}, {...rebuilding,generation:2},{...rebuilding,application:'V3'}, {...rebuilding,entries_blocked:false}, {...rebuilding,phase:'ACTIVE'}, {...rebuilding,run_id:'v2-paper-old'}, {...rebuilding,factory_reset_at:'2026-10-13T11:00:00'}, {...rebuilding,factory_reset_at:'2026-10-14T11:00:00Z'}]) assert(!valid(bad,now));
console.log('PASS V3 identity, blocked rebuild, timezone, future time and legacy-run rejection');

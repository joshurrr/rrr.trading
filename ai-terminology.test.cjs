const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const window = {};
vm.runInNewContext(fs.readFileSync(require.resolve('./ai-terminology.js'), 'utf8'), { window });
const present = window.AITerminology.present;

assert.equal(present('SOL stale decision'), 'AI stale decision');
assert.equal(present('Last SOL review · SOL decision unavailable'), 'Last AI review · AI decision unavailable');
assert.equal(present('SOL engine review failed'), 'AI engine review failed');
assert.equal(present('AI monitoring CURRENT'), 'AI monitoring CURRENT');
assert.equal(present('SOLUSDT · SOL/USDT · Solana'), 'SOLUSDT · SOL/USDT · Solana');
assert.equal(present('SOL_STALE_DECISION'), 'SOL_STALE_DECISION');
const apiFields = { sol_review_status: 'SOL_STALE_DECISION' };
assert.equal(present(apiFields), apiFields);

console.log('AI terminology presentation checks passed.');

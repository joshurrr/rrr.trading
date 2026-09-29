const assert = require('node:assert/strict');
const {baseline,valid,shares}=require('./channel-model.js');
assert(valid(baseline()));
assert.deepEqual(shares([25,20,10,15,20,10]),[25,20,10,15,20,10]);
assert.deepEqual(shares([1,1,1]),[34,33,33]);
assert.deepEqual(shares([0,0,0]),[0,0,0]);
for(let seed=1;seed<1000;seed++){
 const weights=Array.from({length:6},(_,i)=>(seed*(i+7))%101);
 assert.equal(shares(weights).reduce((a,b)=>a+b,0),weights.some(Boolean)?100:0);
}
const zero=baseline();zero.weights.fill(0);assert(!valid(zero));
const noSignals=baseline();noSignals.subweights[0].fill(0);assert(!valid(noSignals));
noSignals.weights[0]=0;assert(valid(noSignals));
const risk=baseline();risk.profile.riskLimit=NaN;assert(!valid(risk));
risk.profile.riskLimit=6;assert(!valid(risk));
const malformed=baseline();malformed.weights[0]='25';assert(!valid(malformed));
const roundTrip=JSON.parse(JSON.stringify(baseline()));assert(valid(roundTrip));
const changed=baseline();changed.weights[0]=100;assert.equal(baseline().weights[0],25);
console.log('Channel model: normalization, bounds, empty inputs, serialization and baseline isolation passed.');


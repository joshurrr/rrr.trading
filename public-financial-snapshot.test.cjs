const assert=require('node:assert/strict');
const {Cache,MAX_AGE_MS}=require('./public-financial-snapshot.js');
let now=Date.parse('2026-10-25T12:00:00Z');
const iso=n=>new Date(n).toISOString();
function fixture(revision=1){const at=iso(now-1000);return {version:'paper-read-api-v1',mode:'paper',served_at:iso(now),
 wallet:{availability:'AVAILABLE',as_of:at,revision,wallet_balance:'10000',equity:'10000',realized_pnl:'0',unrealized_pnl:'0',entry_fees_paid:'0',exit_fees_paid:'0',field_availability:Object.fromEntries(['wallet_balance','equity','realized_pnl','unrealized_pnl','entry_fees_paid','exit_fees_paid'].map(k=>[k,'AVAILABLE']))},
 open_positions:{availability:'AVAILABLE',items:[]},completed_trades:{availability:'AVAILABLE',as_of:at,items:[]}};}
const cache=new Cache(()=>now),good=fixture();
assert(cache.accept(good));assert.equal(cache.display().diagnostics.display,'CURRENT');
const writing=structuredClone(good);writing.wallet.writer_lock_present=true;
assert.equal(cache.accept(writing),false);assert.equal(cache.display().diagnostics.reason,'account_writer_lock_present');
assert.equal(cache.display().diagnostics.display,'RETAINED');assert(cache.accept(good));
assert.equal(cache.display().data.open_positions.items.length,0,'genuine zero survives');
cache.fail({state:'API_UNAVAILABLE',http_status:503});
assert.equal(cache.display().diagnostics.display,'RETAINED');assert.equal(cache.display().data.wallet.wallet_balance,'10000');
assert.equal(cache.display().diagnostics.last_successful_refresh,iso(now));
for(const mutate of [d=>delete d.completed_trades,d=>d.wallet.equity='123',d=>d.completed_trades.as_of=iso(now-2000),d=>d.completed_trades.items.push({}),d=>d.wallet.availability='UNAVAILABLE',d=>d.open_positions.items=[{}],d=>d.wallet.wallet_balance=null]){
 const bad=structuredClone(good);mutate(bad);assert.equal(cache.accept(bad),false);assert.equal(cache.display().diagnostics.state,'VALIDATION_FAILED');assert.equal(cache.display().data.wallet.wallet_balance,'10000');
}
now+=1000;const newer=fixture(2);assert(cache.accept(newer));assert.equal(cache.accept(good),false);assert.equal(cache.display().data.wallet.revision,2);
now+=MAX_AGE_MS;assert.equal(cache.display().data,null,'cache expires without another request');
const old=structuredClone(newer);assert.equal(cache.accept(old),false,'a cached HTTP response cannot renew retention');
assert(cache.accept(fixture(3)));assert.equal(cache.display().diagnostics.display,'CURRENT');
assert.equal(cache.accept({...fixture(4),served_at:iso(now+1)}),false,'future timestamp rejected');
console.log('PASS financial snapshot validation, zero, transient failure, malformed/incomplete evidence, reconciliation, ordering, bounded expiry and recovery');

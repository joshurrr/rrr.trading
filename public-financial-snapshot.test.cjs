const assert=require('node:assert/strict');
const {Cache,MAX_AGE_MS}=require('./public-financial-snapshot.js');
let now=Date.parse('2026-10-25T12:00:00Z');
const iso=n=>new Date(n).toISOString();
function fixture(revision=1){const at=iso(now-1000);return {version:'paper-read-api-v1',mode:'paper',served_at:iso(now),
 wallet:{availability:'AVAILABLE',as_of:at,revision,wallet_balance:'10000',equity:'10000',realized_pnl:'0',unrealized_pnl:'0',entry_fees_paid:'0',exit_fees_paid:'0',field_availability:Object.fromEntries(['wallet_balance','equity','realized_pnl','unrealized_pnl','entry_fees_paid','exit_fees_paid'].map(k=>[k,'AVAILABLE']))},
 open_positions:{availability:'AVAILABLE',items:[]},completed_trades:{availability:'AVAILABLE',as_of:at,items:[]}};}
let lastServerAt=now-1;
function advance(snapshot,ms=1){lastServerAt=Math.max(lastServerAt,Date.parse(snapshot.served_at))+ms;snapshot.served_at=iso(lastServerAt);return snapshot;}
const cache=new Cache(()=>now),good=fixture();
assert(cache.accept(good));assert.equal(cache.display().diagnostics.display,'CURRENT');
for(const skew of [-10*60_000,10*60_000]){const skewed=new Cache(()=>now+skew);assert(skewed.accept(good),'browser wall-clock skew must not invalidate an API-served snapshot');assert.equal(skewed.display().data.wallet.wallet_balance,'10000');}
for(const overview of [
 {sentiment:{availability:'UNAVAILABLE',reasons:['ai_api_error']}},
 {sentiment:{availability:'UNAVAILABLE',reasons:['ai_request_circuit_open']}},
 {sentiment:{state:'STALE',availability:'STALE'},breadth:{state:'STALE',health:'STALE'}},
 {sentiment:{},breadth:{},fear_greed:{},research:{}}
]){const independent=fixture();independent.overview=overview;const c=new Cache(()=>now);assert(c.accept(independent));assert.equal(c.display().data.wallet.wallet_balance,'10000');}
const noOptionalIntelligence=fixture();delete noOptionalIntelligence.overview;assert(new Cache(()=>now).accept(noOptionalIntelligence),'overview is optional to financial validation');
const writing=structuredClone(good);writing.wallet.writer_lock_present=true;
assert.equal(cache.accept(advance(writing)),true);assert.equal(cache.display().diagnostics.writer_lock_present,true);
assert.equal(cache.display().diagnostics.display,'CURRENT');assert(cache.accept(advance(structuredClone(good))));
const expired=advance(structuredClone(good));expired.wallet.valuation_expires_at=iso(now-1);
assert(cache.accept(expired));assert.equal(cache.display().diagnostics.state,'DATA_STALE');
assert.equal(cache.display().diagnostics.display,'CURRENT','successful ledger refresh is not a retained failed request');assert(cache.accept(advance(structuredClone(good))));
assert.equal(cache.display().data.open_positions.items.length,0,'genuine zero survives');
cache.fail({state:'API_UNAVAILABLE',http_status:503});
assert.equal(cache.display().diagnostics.display,'RETAINED');assert.equal(cache.display().data.wallet.wallet_balance,'10000');
assert(Number.isFinite(Date.parse(cache.display().diagnostics.last_successful_refresh)));
const missingHistory=advance(fixture());delete missingHistory.completed_trades;assert(cache.accept(missingHistory));assert.equal(cache.display().data.wallet.wallet_balance,'10000');assert.equal(cache.display().data.completed_trades.availability,'UNAVAILABLE');assert.equal(cache.display().diagnostics.display,'PARTIAL');
const invalidEquity=advance(fixture());invalidEquity.wallet.equity='not-a-number';assert(cache.accept(invalidEquity));assert.equal(cache.display().data.wallet.equity,null);assert.equal(cache.display().data.wallet.field_availability.equity,'UNAVAILABLE');assert.equal(cache.display().data.wallet.wallet_balance,'10000');assert.equal(cache.display().diagnostics.sections.wallet.availability,'PARTIAL');
const invalidPosition=advance(fixture());invalidPosition.open_positions.items=[{symbol:'BTCUSDT',side:'LONG',availability:'AVAILABLE',quantity:'NaN',entry_price:'100',current_mark:'101',unrealized_pnl:'1',entered_at:iso(now-60000),mark_observed_at:iso(now-1000),mark_expires_at:iso(now+60000)}];assert(cache.accept(invalidPosition));assert.equal(cache.display().data.open_positions.items.length,0);assert.equal(cache.display().data.wallet.wallet_balance,'10000');assert.equal(cache.display().diagnostics.sections.open_positions.reason,'invalid_position_rows_omitted');
const invalidContract=fixture();invalidContract.mode='live';assert.equal(cache.accept(invalidContract),false);assert.equal(cache.display().diagnostics.state,'VALIDATION_FAILED');
now+=1000;const newer=fixture(2);assert(cache.accept(newer));assert.equal(cache.accept(good),false);assert.equal(cache.display().data.wallet.revision,2);
now+=MAX_AGE_MS;assert.equal(cache.display().data,null,'cache expires without another request');
const old=structuredClone(newer);assert.equal(cache.accept(old),false,'a cached HTTP response cannot renew retention');
assert(cache.accept(fixture(3)));assert.equal(cache.display().diagnostics.display,'CURRENT');
assert.equal(cache.accept({...fixture(4),served_at:iso(now+10*60_000)}),true,'API timestamp is authoritative when browser clock differs');
assert.equal(cache.accept({...fixture(5),served_at:'not-a-timestamp'}),false,'malformed server timestamp rejected');
console.log('PASS financial snapshot validation, zero, transient failure, malformed/incomplete evidence, reconciliation, ordering, bounded expiry and recovery');

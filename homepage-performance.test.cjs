const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {model}=require('./homepage-performance.js');
const now=Date.now(),iso=n=>new Date(n).toISOString();
const trade=(id,age,gross,net)=>({id,symbol:'BTCUSDT',side:'LONG',entered_at:iso(now-age-3600000),closed_at:iso(now-age),entry_price:100,exit_price:101,realized_pnl:gross,net_pnl:net,entry_fee:1,exit_fee:1,exit_reason:'TAKE_PROFIT'});
const fixture=()=>({version:'paper-read-api-v1',mode:'paper',served_at:iso(now),wallet:{realized_pnl:25},completed_trades:{availability:'AVAILABLE',as_of:iso(now),items:[trade('old',86400001,20,18),trade('recent',1000,5,3)]},open_positions:{availability:'AVAILABLE',inventory_availability:'AVAILABLE',items:[{side:'SHORT',availability:'AVAILABLE',mark_expires_at:iso(now+60000),financials:{estimated_net_pnl_usdt:-2}}]}});
let d=fixture(),r=model(d,{},now);assert.equal(r.net,3);assert.equal(r.count,1);assert.equal(r.open,-2);assert.equal(r.shorts,1);assert.equal(r.fees,null);
d=fixture();d.completed_trades.items.push(trade('newest',100,-4,-6));d.wallet.realized_pnl=21;r=model(d,{},now);assert.equal(r.net,-3);assert.equal(r.count,2);assert.equal(r.trades[0].id,'newest');
d=fixture();d.completed_trades.items[1].entered_at=iso(now-3*86400000);assert.equal(model(d,{},now).fees,null,'fees on recent closes are not fees paid in the window');
// Settled ledger age is not valuation age: a freshly read unchanged ledger stays valid.
d.wallet.as_of=iso(now-864000000);assert.equal(model(d,{},now).net,3);
d=fixture();d.completed_trades.items[1].closed_at=iso(now-86400000);d.completed_trades.items[1].entered_at=iso(now-90000000);assert.equal(model(d,{},now).count,0);
d=fixture();d.open_positions.items=[];assert.equal(model(d,{},now).open,0);assert.equal(model(d,{},now).positions,0);
d=fixture();d.completed_trades.items=[];d.wallet.realized_pnl=0;r=model(d,{},now);assert.equal(r.net,0);assert.equal(r.count,0);
for(const mutate of [d=>d.completed_trades.availability='PARTIAL',d=>d.completed_trades.truncated=true,d=>d.wallet.realized_pnl=100,d=>d.completed_trades.items[1].net_pnl=null,d=>d.completed_trades.items.push(d.completed_trades.items[0])]){d=fixture();mutate(d);r=model(d,{},now);assert.equal(r.net,null);assert.equal(r.count,null);assert.equal(r.open,-2);}
for(const diagnostics of [{display:'RETAINED'}]){r=model(fixture(),diagnostics,now);assert.equal(r.net,null);assert.equal(r.open,null);assert.equal(r.availability,'STALE');}
d=fixture();d.served_at=iso(now-120001);assert.equal(model(d,{},now).net,null);
d=fixture();d.open_positions.items[0].mark_expires_at=iso(now-1);r=model(d,{},now);assert.equal(r.open,null);assert.equal(r.net,3);assert.equal(r.positions,1);
d=fixture();delete d.open_positions.items[0].financials;assert.equal(model(d,{},now).open,null,'no gross fallback for net estimate');
// Actual V4.2 shape: inventory survives a stale SOL valuation. Entry and exit
// fees belong to separate execution timestamps, not the trade-close cohort.
d=fixture();d.completed_trades.items=[{...trade('closed',3600000,5,-2),entered_at:iso(now-25*3600000),entry_fee:'3',exit_fee:'4'}];
d.wallet={realized_pnl:'5',entry_fees_paid:'5',exit_fees_paid:'4'};
d.open_positions={availability:'STALE',inventory_availability:'AVAILABLE',items:[{id:'sol',symbol:'SOLUSDT',side:'SHORT',quantity:'4.7',entry_price:'95.660',entered_at:iso(now-2*3600000),entry_fee:'2',availability:'STALE',current_mark:null,unrealized_pnl:null,mark_observed_at:iso(now-600000),mark_expires_at:iso(now-480000),financials:{position_notional_usdt:null,margin_used_usdt:'449.6020',estimated_net_pnl_usdt:null}}]};
r=model(d,{},now);assert.equal(r.fees,6);assert.equal(r.open,null);assert.equal(r.positions,1);assert.equal(r.net,-2);
delete d.open_positions.items[0].entry_fee;assert.equal(model(d,{},now).fees,null,'old API cannot supply complete fee evidence');
d.open_positions.items[0].entry_fee='2';d.completed_trades.items[0].closed_at=iso(now-86400000);assert.equal(model(d,{},now).fees,2,'exclude exact rolling boundary exit and old entry');
d.wallet.entry_fees_paid='6';assert.equal(model(d,{},now).fees,null,'fee ledger reconciliation is required');
class Element{constructor(){this.children=[];this.dataset={};this.textContent='';}append(...x){this.children.push(...x);}replaceChildren(...x){this.children=x;}}
const nodes=new Map(),listeners={};for(const id of ['home-trading-performance','home-performance-time','home-closed-summary','home-closed-trades-body','home-closed-trades-state',...['net','open','positions','closed','fees'].flatMap(x=>['performance-'+x,'performance-'+x+'-note'])])nodes.set(id,new Element());
const window={addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn),dispatchEvent:e=>(listeners[e.type]||[]).forEach(f=>f(e))};
const context=vm.createContext({window,document:{getElementById:id=>nodes.get(id)||null,createElement:()=>new Element()},Date,Intl,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}});
for(const file of ['homepage-performance.js','homepage-trade-history.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
window.dispatchEvent({type:'rrr-v4-home-position-snapshot',detail:{data:fixture()}});
assert.equal(nodes.get('performance-net').textContent,'+3.00 USDT');assert(nodes.get('home-closed-summary').textContent.includes('+3.00 USDT'));assert.equal(nodes.get('home-closed-trades-body').children.length,1);assert.equal(nodes.get('home-closed-trades-body').children[0].children[7].textContent,'+3.00 USDT');
assert.equal(nodes.get('performance-fees').textContent,'Unavailable');
window.dispatchEvent({type:'rrr-v4-home-position-snapshot',detail:{data:null}});assert.equal(nodes.get('performance-net').textContent,'Unavailable');
const html=fs.readFileSync('index.html','utf8');const order=['home-market-strip','id="home-trading-performance"','id="home-demo-positions"','id="home-closed-trades"','<footer'];assert(order.every((x,i)=>i===0||html.indexOf(x)>html.indexOf(order[i-1])));
assert(!/fetch\(|setInterval\(/.test(fs.readFileSync('homepage-performance.js','utf8')));
console.log('PASS: shared net accounting, rolling boundaries, full-history reconciliation, incomplete/stale/duplicate handling, zero states, independent metrics, history/strip DOM agreement and no polling.');

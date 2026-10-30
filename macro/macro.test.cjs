const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
class Element {
 constructor(){this.children=[];this.dataset={};this.style={};this.value='';this.state=new State();}
 set textContent(v){this.value=String(v);this.children=[];}
 get textContent(){return this.value;}
 append(...v){this.children.push(...v);}
 replaceChildren(...v){this.children=v;}
 setAttribute(){}
 querySelector(){return this.state;}
}
class State {constructor(){this.dataset={};}}
async function run({unavailable=false}={}){
 const now=new Date().toISOString(),nodes=new Map(),requests=[],listeners={};let interval;
 const observation=values=>({state:'CURRENT',health:'AVAILABLE',source_at:now,observed_at:now,expires_at:new Date(Date.now()+3600000).toISOString(),values});
 const data={version:'paper-read-api-v1',mode:'paper',served_at:now,overview:{version:'paper-overview-v1',purpose:'PUBLIC_SAVED_OBSERVATIONS_ONLY',breadth:observation({rising_24h_pct:60,falling_24h_pct:30,assets_included:10}),fear_greed:observation({value:55,classification:'Neutral'})}};
 const document={hidden:false,getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},createElement:()=>new Element(),addEventListener:(name,fn)=>{listeners[name]=fn;}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/macro.js','utf8'),{document,Date,Intl,AbortSignal,setInterval(fn,ms){assert.equal(ms,30000);interval=fn;},fetch:async(url,options)=>{requests.push({url,options});return {ok:!unavailable,json:async()=>data};}});
 await new Promise(setImmediate);return {nodes,requests,document,listeners,interval};
}
test('overview renders saved observations using only the paper API',async()=>{
 const {nodes,requests}=await run();
 assert.equal(nodes.get('breadth-value').textContent,'60% rising · 30% falling');
 assert.equal(nodes.get('fear-value').textContent,'55 / 100');
 assert.match(nodes.get('snapshot-time').textContent,/API feed snapshot/);
 assert.equal(nodes.get('crypto-grid').children.length,2);
 assert.equal(nodes.has('macro-themes'),false);
 assert.deepEqual(requests.map(r=>r.url),['https://v4.rrr.trading/v4/paper']);
 assert.equal(requests[0].options.method,'GET');assert.equal(requests[0].options.cache,'no-store');
});
test('periodic and visibility refresh preserve the paper request without loading themes',async()=>{
 const {requests,document,listeners,interval}=await run();
 interval();await new Promise(setImmediate);assert.equal(requests.length,2);
 document.hidden=true;interval();listeners.visibilitychange();await new Promise(setImmediate);assert.equal(requests.length,2);
 document.hidden=false;listeners.visibilitychange();await new Promise(setImmediate);assert.equal(requests.length,3);
 assert.ok(requests.every(r=>r.url==='https://v4.rrr.trading/v4/paper'));
});
test('feed failure retains precise unavailable market states',async()=>{
 const {nodes,requests}=await run({unavailable:true});
 assert.match(nodes.get('macro-feed-status').textContent,/V4 public feed unavailable/);
 for(const id of ['breadth-value','fear-value','conditions-value'])assert.equal(nodes.get(id).textContent,'Unavailable');
 assert.equal(nodes.has('macro-themes'),false);assert.equal(requests.length,1);
});
test('Market Overview is the first section after the existing introduction',()=>{
 const html=fs.readFileSync(__dirname+'/index.html','utf8');
 assert.match(html,/<header class="macro-title">[\s\S]*?<\/header>\s*<section aria-labelledby="macro-overview-title">/);
 assert.doesNotMatch(html,/Current Macro Themes|DRIVERS|macro-themes|themes-title|View All Macro News/);
});

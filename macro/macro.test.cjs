const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
class Element {
 constructor(){this.children=[];this.dataset={};this.style={};this.value='';}
 set textContent(v){this.value=String(v);this.children=[];}
 get textContent(){return this.value;}
 append(...v){this.children.push(...v);}
 replaceChildren(...v){this.children=v;}
 setAttribute(){}
 querySelector(){return new Element();}
}
async function run(change=()=>{}){
 const source=new Date(Date.now()-60000).toISOString(),nodes=new Map();
 const saved={state:'CURRENT',historical:false,health:'PARTIAL',validation:'SAVED_SCHEMA_AND_ORIGINAL_EVIDENCE_VALIDATED',source_at:source,observed_at:source,expires_at:new Date(Date.now()+60000).toISOString(),assessment:{text:'Original <b>saved</b> wording'},provenance:{evidence:[]}};
 const data={version:'paper-read-api-v1',mode:'paper',served_at:new Date().toISOString(),sentiment:{status:'USABLE',context_state:'CURRENT',assessment_timestamp:source.replace('Z','+00:00'),market_direction:'DOWN'},overview:{version:'paper-overview-v1',purpose:'PUBLIC_SAVED_OBSERVATIONS_ONLY',interpretation:saved}};
 change(saved,data);
 vm.runInNewContext(fs.readFileSync(__dirname+'/macro.js','utf8'),{document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},createElement:()=>new Element(),addEventListener(){}},Date,Intl,URL,AbortSignal,setInterval(){},fetch:async()=>({ok:true,json:async()=>data})});
 await new Promise(setImmediate);return nodes;
}
test('equivalent UTC timestamps match and saved commentary remains verbatim',async()=>{
 const nodes=await run();assert.match(nodes.get('luna-freshness').textContent,/Same saved generation: YES/);assert.equal(nodes.get('luna-commentary').textContent,'Original <b>saved</b> wording');
});
test('invalid timestamps and rejected validation hide commentary with precise reasons',async()=>{
 for(const [change,reason] of [[s=>s.source_at=null,/source_at missing or invalid/],[s=>s.validation='REJECTED',/validation: REJECTED/],[s=>s.observed_at=new Date(Date.now()+60000).toISOString(),/in the future/]]){
 const nodes=await run(change);assert.match(nodes.get('luna-commentary').textContent,reason);assert.match(nodes.get('luna-freshness').textContent,/Freshness: UNAVAILABLE/);
 }
});
test('expired evidence stays historical',async()=>{
 const nodes=await run(s=>{s.health='AVAILABLE';s.expires_at=new Date(Date.now()-1000).toISOString();});assert.match(nodes.get('luna-freshness').textContent,/Freshness: STALE/);
});

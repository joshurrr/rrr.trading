const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, 'news.js'), 'utf8');
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.listeners = {}; this.value = ''; }
  set textContent(value) { this.value = String(value); this.children = []; }
  get textContent() { return this.value + this.children.map(c => c.textContent).join('\n'); }
  get childNodes() { return this.children; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.value = ''; this.children = nodes; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
}
const fixture = () => ({version:'paper-read-api-v1',mode:'paper',served_at:new Date().toISOString(),overview:{version:'paper-overview-v1',purpose:'PUBLIC_SAVED_OBSERVATIONS_ONLY',interpretation:{state:'CURRENT',validation:'SAVED_SCHEMA_AND_ORIGINAL_EVIDENCE_VALIDATED',source_at:new Date(Date.now()-60000).toISOString(),observed_at:new Date(Date.now()-60000).toISOString(),expires_at:new Date(Date.now()+60000).toISOString(),health:'PARTIAL',assessment:{text:'Saved original <img src=x onerror=alert(1)> summary'},drivers:[{text:'Original driver',evidence_ids:['A1'],state:'CURRENT'}],contradictions:[],uncertainty:['Coverage incomplete'],provenance:{source:'saved_luna_interpretation',source_version:'test',evidence:[{id:'A1',source:'coindesk',published_at:'2026-01-01T01:00:00Z',reference:'javascript:alert(1)'},{id:'A2',source:'coindesk',published_at:'2026-01-02T01:00:00Z',reference:'https://www.coindesk.com/example'}]}}}});
async function run(data) {
  const nodes = new Map();
  const document = {getElementById:id => { if (!nodes.has(id)) nodes.set(id,new Element('div')); return nodes.get(id); },createElement:tag=>new Element(tag)};
  const context = {document,URL,Date,Intl,AbortSignal,fetch:async()=>{if(data instanceof Error)throw data;return {ok:true,json:async()=>data};}};
  vm.runInNewContext(script,context);
  await new Promise(resolve=>setImmediate(resolve));
  return {nodes,context};
}
function descendants(node) { return node.children.flatMap(c=>[c,...descendants(c)]); }
test('preserves saved text, partial coverage and unknown consumption without HTML injection',async()=>{
  const data=fixture(),{nodes}=await run(data);
  assert.equal(nodes.get('luna-commentary').textContent,data.overview.interpretation.assessment.text);
  assert.equal(nodes.get('news-state').textContent,'CURRENT');
  assert.match(nodes.get('assessment-meta').textContent,/PARTIAL/);
  assert.match(nodes.get('assessment-meta').textContent,/UNKNOWN · no per-request receipt/);
  assert.equal(descendants(nodes.get('luna-commentary')).length,0);
  const articles=nodes.get('news-feed').children.filter(n=>n.tag==='article');
  assert.match(articles[0].textContent,/A2/);
  assert.match(articles[1].textContent,/A1/);
  assert.equal(descendants(nodes.get('news-feed')).filter(n=>n.tag==='a').length,1);
  assert.match(nodes.get('news-feed').textContent,/omits the retained headlines/);
});
test('expired assessment is historical and a failed refresh clears old evidence',async()=>{
  const data=fixture();data.overview.interpretation.expires_at=new Date(Date.now()-1000).toISOString();
  const {nodes,context}=await run(data);assert.equal(nodes.get('news-state').textContent,'STALE');
  context.fetch=async()=>{throw Error('offline');};
  await nodes.get('refresh-news').listeners.click();
  assert.equal(nodes.get('news-state').textContent,'UNAVAILABLE');
  assert.doesNotMatch(nodes.get('luna-commentary').textContent,/Saved original/);
  assert.equal(nodes.get('refresh-news').disabled,false);
});
test('rejects incorrect API contract and unvalidated saved text',async()=>{
  for(const data of [{version:'other'},new Error('blocked')]) {
    const {nodes}=await run(data);assert.equal(nodes.get('news-state').textContent,'UNAVAILABLE');
  }
  const data=fixture();data.overview.interpretation.validation='REJECTED';
  const {nodes}=await run(data);assert.equal(nodes.get('news-state').textContent,'UNAVAILABLE');
  assert.doesNotMatch(nodes.get('luna-commentary').textContent,/Saved original/);
});

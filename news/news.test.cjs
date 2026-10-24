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
const baseFixture = () => ({version:'paper-read-api-v1',mode:'paper',served_at:new Date().toISOString(),overview:{version:'paper-overview-v1',purpose:'PUBLIC_SAVED_OBSERVATIONS_ONLY',interpretation:{state:'CURRENT',validation:'SAVED_SCHEMA_AND_ORIGINAL_EVIDENCE_VALIDATED',source_at:new Date(Date.now()-60000).toISOString(),observed_at:new Date(Date.now()-60000).toISOString(),expires_at:new Date(Date.now()+60000).toISOString(),health:'PARTIAL',assessment:{text:'Saved original <img src=x onerror=alert(1)> summary'},drivers:[{text:'Original driver',evidence_ids:['A1'],state:'CURRENT'}],contradictions:[],uncertainty:['Coverage incomplete'],provenance:{source:'saved_luna_interpretation',source_version:'test',evidence:[{id:'A1',source:'coindesk',published_at:'2026-01-01T01:00:00Z',reference:'javascript:alert(1)'},{id:'A2',source:'coindesk',published_at:'2026-01-02T01:00:00Z',reference:'https://www.coindesk.com/example'}]}}}});
const fixture = () => {
  const data=baseFixture(), macro=data.overview.interpretation;
  macro.news_and_themes={state:'CURRENT',validation:'SAVED_SCHEMA_AND_ORIGINAL_EVIDENCE_VALIDATED',source_at:macro.source_at,observed_at:macro.observed_at,expires_at:macro.expires_at,provenance:macro.provenance,content:{status:'AVAILABLE',summary:'Original Luna news <img src=x onerror=alert(1)> summary',sentiment:'MIXED',market_implications:'Original market implications',evidence_ids:['A2'],conflicting_evidence:[{text:'Original conflicting evidence',evidence_ids:['A2']}],uncertainty:['Original news uncertainty'],themes:[{name:'Original theme',description:'Original description',implication:'MIXED',affected_markets:['Bitcoin','Oil'],evidence_ids:['A2'],catalysts:[{text:'Original catalyst',evidence_ids:['A2']}],risks:[{text:'Original risk',evidence_ids:['A2']}]}]}};
  return data;
};
async function run(data, adminData = null) {
  const nodes = new Map();
  const document = {getElementById:id => { if (!nodes.has(id)) nodes.set(id,new Element('div')); return nodes.get(id); },createElement:tag=>new Element(tag)};
  const context = {document,URL,Date,Intl,AbortSignal,fetch:async(url)=>{if(String(url).includes('/v4/admin?topic=intelligence'))return {ok:adminData!==null,json:async()=>adminData};if(data instanceof Error)throw data;return {ok:true,json:async()=>data};}};
  vm.runInNewContext(script,context);
  await new Promise(resolve=>setImmediate(resolve));
  return {nodes,context};
}
function descendants(node) { return node.children.flatMap(c=>[c,...descendants(c)]); }
test('preserves dedicated news text, themes and unknown consumption without HTML injection',async()=>{
  const data=fixture(),{nodes}=await run(data);
  assert.equal(nodes.get('luna-commentary').textContent,data.overview.interpretation.news_and_themes.content.summary);
  assert.equal(nodes.get('news-state').textContent,'CURRENT');
  assert.equal(nodes.get('news-sentiment').dataset.sentiment,'MIXED');
  assert.equal(nodes.get('market-implications').textContent,'Original market implications');
  assert.match(nodes.get('market-themes').textContent,/Original theme/);
  assert.equal(nodes.get('saved-catalysts').textContent,'Original catalyst');
  assert.equal(nodes.get('saved-risks').textContent,'Original risk');
  assert.equal(nodes.get('saved-conflicts').textContent,'Original conflicting evidence');
  assert.equal(nodes.get('saved-uncertainty').textContent,'Original news uncertainty');
  assert.match(nodes.get('assessment-meta').textContent,/UNKNOWN · no per-request receipt/);
  assert.equal(descendants(nodes.get('luna-commentary')).length,0);
  const articles=nodes.get('news-feed').children.filter(n=>n.tag==='article');
  assert.match(articles[0].textContent,/A2/);
  assert.match(articles[1].textContent,/A1/);
  assert.equal(descendants(nodes.get('news-feed')).filter(n=>n.tag==='a').length,1);
  assert.match(nodes.get('news-feed').textContent,/omits the retained headlines/);
});
test('renders saved SOL delivery stages and keeps asset news separate from macro themes',async()=>{
  const now=new Date().toISOString(), admin={version:'v4-admin-read-v1',served_at:now,diagnostics:{selected_topic:'intelligence',topics:{intelligence:{evidence:{
    shared_interpretation:{status:'AVAILABLE',assessment_at:now,expires_at:null,freshness:'CURRENT',validation:'VALIDATED_SAVED_ASSESSMENT',market_mood:{text:'Risk mood is cautious'},directional_pressure:{text:'Pressure is mixed'},drivers:[{text:'Rates remain a macro driver'}],changes:[],provenance:[],asset_specific_news:[{evidence_id:'A7',source:'coindesk',published_at:now,freshness:'AVAILABLE',classifications:[{symbol:'XRP',sentiment:'POSITIVE',catalyst:'Ledger update'}]}]},
    request_delivery:[{type:'POSITION_REVIEW',timestamp:now,request_stage:'SUBMITTED',records_present:true,intelligence:{macro_themes:{state:'AVAILABLE',timestamp:now,expires_at:null,confirmed_in_request:true,explicitly_cited:true},shared_market_interpretation:{state:'AVAILABLE',timestamp:now,expires_at:null,confirmed_in_request:true,explicitly_cited:false},economic_facts:[{reference:'macro.G_FRED_FEDFUNDS',state:'AVAILABLE',timestamp:now,confirmed_in_request:true,explicitly_cited:true}],economic_calendar:{state:'PARTIAL',timestamp:now,confirmed_in_request:true,explicitly_cited:false},asset_specific_news:{available:true,evidence_ids:['A7'],confirmed_in_request:true,explicitly_cited:true}},sol:{status:'CONFIRMED_RESPONSE',cited_references:['macro.market_themes','macro.G_FRED_FEDFUNDS']}}],request_delivery_missing_evidence:[]}}}}};
  const {nodes}=await run(fixture(),admin), view=nodes.get('sol-intelligence').textContent;
  assert.match(view,/Shared macro, geopolitical & economic themes/);
  assert.match(view,/Ledger update/);
  assert.match(view,/POSITION_REVIEW · CONFIRMED_RESPONSE/);
  assert.match(view,/Request stage SUBMITTED/);
  assert.match(view,/macro.G_FRED_FEDFUNDS/);
  assert.match(view,/SOL cited YES/);
});
test('expired assessment is historical and a failed refresh clears old evidence',async()=>{
  const data=fixture();data.overview.interpretation.news_and_themes.expires_at=new Date(Date.now()-1000).toISOString();
  const {nodes,context}=await run(data);assert.equal(nodes.get('news-state').textContent,'STALE');
  context.fetch=async()=>{throw Error('offline');};
  await nodes.get('refresh-news').listeners.click();
  assert.equal(nodes.get('news-state').textContent,'UNAVAILABLE');
  assert.doesNotMatch(nodes.get('luna-commentary').textContent,/Original Luna news/);
  assert.equal(nodes.get('refresh-news').disabled,false);
});
test('rejects incorrect API contract and unvalidated saved text',async()=>{
  for(const data of [{version:'other'},new Error('blocked')]) {
    const {nodes}=await run(data);assert.equal(nodes.get('news-state').textContent,'UNAVAILABLE');
  }
  const data=fixture();data.overview.interpretation.news_and_themes.validation='REJECTED';
  const {nodes}=await run(data);assert.equal(nodes.get('news-state').textContent,'UNAVAILABLE');
  assert.doesNotMatch(nodes.get('luna-commentary').textContent,/Original Luna news/);
});

test('news freshness is independent of stale combined macro assessment',async()=>{
  const data=fixture();data.overview.interpretation.state='STALE';data.overview.interpretation.expires_at=new Date(Date.now()-1000).toISOString();
  const {nodes}=await run(data);assert.equal(nodes.get('news-state').textContent,'CURRENT');
  assert.equal(nodes.get('intelligence-label').textContent,'Luna Intelligence — Validated');
  assert.doesNotMatch(nodes.get('luna-commentary').textContent,/Saved original/);
});
test('missing historical component never falls back to combined macro text',async()=>{
  const data=fixture();delete data.overview.interpretation.news_and_themes;
  const {nodes}=await run(data);assert.equal(nodes.get('news-state').textContent,'UNAVAILABLE');
  assert.doesNotMatch(nodes.get('luna-commentary').textContent,/Saved original/);
  assert.equal(nodes.get('market-themes').children.filter(n=>n.tag==='article').length,0);
});
test('insufficient evidence preserves the original saved explanation with no themes',async()=>{
  const data=fixture(),news=data.overview.interpretation.news_and_themes;
  news.state='UNAVAILABLE';news.expires_at=null;news.content={status:'INSUFFICIENT_EVIDENCE',summary:'Original insufficient-evidence explanation',sentiment:'UNKNOWN',market_implications:'Insufficient news evidence.',themes:[],uncertainty:['Missing evidence'],conflicting_evidence:[]};
  const {nodes}=await run(data);assert.equal(nodes.get('news-state').textContent,'UNAVAILABLE');
  assert.equal(nodes.get('luna-commentary').textContent,'Original insufficient-evidence explanation');
  assert.equal(nodes.get('market-themes').children.filter(n=>n.tag==='article').length,0);
});
test('Brisbane timestamps and explicit stale API state are respected',async()=>{
  const data=fixture(),news=data.overview.interpretation.news_and_themes;
  news.source_at='2026-01-01T03:26:01+00:00';news.expires_at='2099-01-01T00:00:00Z';news.state='STALE';
  const {nodes}=await run(data);assert.equal(nodes.get('news-state').textContent,'STALE');
  assert.match(nodes.get('assessment-time').textContent,/1:26 pm Brisbane/);
});

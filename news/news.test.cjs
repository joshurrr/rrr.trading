const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
class Element{
 constructor(){this.children=[];this.dataset={};this.listeners={};this.value='';}
 set textContent(v){this.value=String(v);this.children=[];}get textContent(){return this.value+this.children.map(n=>n.textContent).join('\n');}
 append(...n){this.children.push(...n);}prepend(...n){this.children.unshift(...n);}replaceChildren(...n){this.value='';this.children=n;}
 addEventListener(k,f){this.listeners[k]=f;}setAttribute(k,v){this[k]=v;}
}
const fixture=()=>({version:'theme-intelligence-read-v1',read_only:true,mode:'paper',scope:'SHARED',availability:'AVAILABLE',pending_status:'PENDING_UNASSESSED',themes:[{id:'low',name:'Low theme',scope:'CRYPTO',significance:'LOW',status:'EMERGING',sources:[]},{id:'high',name:'High theme',scope:'MACRO',significance:'HIGH',status:'ACTIVE',sources:[]}]});
async function run(data){const nodes=new Map();const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},createElement:()=>new Element()};let calls=0;const context={document,window:{},URL,Date,Intl,AbortSignal,fetch:async()=>{calls++;return {ok:true,json:async()=>data};}};vm.runInNewContext(fs.readFileSync(__dirname+'/news.js','utf8'),context);await new Promise(setImmediate);return {nodes,context,calls:()=>calls};}
test('saved classification ranks first, duplicate ids are removed and pending status is preserved',async()=>{const d=fixture();d.themes.push(d.themes[1]);const {nodes,calls}=await run(d);assert.equal(nodes.get('theme-list').children.length,2);assert.match(nodes.get('theme-list').children[0].textContent,/High theme/);assert.match(nodes.get('news-overview').textContent,/AI analysis pending/);assert.equal(calls(),1);});
test('equal metadata preserves input order and saved numeric scores rank descending',async()=>{const d=fixture();d.themes=d.themes.map(t=>({...t,significance:'MEDIUM',status:'ACTIVE'}));let result=await run(d);assert.match(result.nodes.get('theme-list').children[0].textContent,/Low theme/);d.themes.forEach((t,i)=>{delete t.significance;t.significance_score=i;});result=await run(d);assert.match(result.nodes.get('theme-list').children[0].textContent,/High theme/);});
test('failed refresh clears old records and releases refresh control',async()=>{const {nodes,context}=await run(fixture());context.fetch=async()=>{throw Error('offline');};await nodes.get('refresh-news').listeners.click();assert.match(nodes.get('feed-status').textContent,/UNAVAILABLE/);assert.doesNotMatch(nodes.get('theme-list').textContent,/High theme/);assert.equal(nodes.get('refresh-news').disabled,false);});
test('rejects incompatible contracts',async()=>{const {nodes}=await run({...fixture(),mode:'live'});assert.match(nodes.get('feed-status').textContent,/UNAVAILABLE/);assert.doesNotMatch(nodes.get('theme-list').textContent,/High theme/);});

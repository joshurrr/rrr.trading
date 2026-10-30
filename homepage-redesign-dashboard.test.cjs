'use strict';
// Focused DOM/feed contract regression; no browser or network required.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element {
 constructor(){this.children=[];this.dataset={};this.textContent='';this.attrs={};}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 setAttribute(k,v){this.attrs[k]=v;}
 removeAttribute(k){delete this.attrs[k];}
 querySelector(){return null;}
}
async function scenario({failure=false,field='change_24h_pct',count=0}={}){
 const nodes=new Map(),listeners={},requests=[],renders=[];
 const ids=['v4-overview','home-market-cards','home-market-updated','home-theme-list','home-event-list','home-current-count','home-current-count-note','home-current-exposure','home-current-pnl','home-current-status','home-current-status-note','home-activity-updated','home-recent-list'];
 for(const id of ids)nodes.set(id,new Element());
 const label=new Element(),targets=new Element();
 const document={hidden:false,referrer:'',body:{dataset:{},id:'home'},getElementById:id=>nodes.get(id)||null,querySelector:q=>q==='.header-target-label'?label:q==='.header-targets'?targets:null,createElement:()=>new Element(),addEventListener:()=>{}};
 const at=new Date(Date.now()-1000).toISOString(),expires=new Date(Date.now()+60000).toISOString();
 const observed={state:'CURRENT',source_at:at,observed_at:at,expires_at:expires};
 const data={version:'paper-read-api-v1',mode:'paper',served_at:at,open_positions:{availability:'AVAILABLE',items:Array.from({length:count},()=>({side:'LONG',symbol:'BTCUSDT',mark_expires_at:expires,financials:{estimated_net_pnl_usdt:2}}))},overview:{breadth:{...observed,health:'AVAILABLE',values:{rising_24h_pct:60,falling_24h_pct:40,assets_included:2}},fear_greed:{...observed,values:{value:0,classification:'Extreme Fear'}},paper_trading:{...observed,status:'OK'},research:{catalogue:{state:'CURRENT',observed_at:at,pool_asset_count:2,assessed_count:2,eligible_count:2,assets:['BTC','ETH'].map(symbol=>({symbol:symbol+'USDT',pair:symbol+'USDT/USDT:USDT',technically_assessed:true,price:100,[field]:2.5}))}}}};
 const window={addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn),dispatchEvent:e=>(listeners[e.type]||[]).forEach(fn=>fn(e)),HomeDemoPositions:{render:(value,loading)=>{renders.push({value,loading});window.dispatchEvent({type:'rrr-v4-home-position-snapshot',detail:{data:value}});}}};window.parent=window;window.PublicFinancialSnapshot={Cache:class{accept(value){this.value=value;return true;}fail(){this.value=null;}display(){return {data:this.value||null,diagnostics:{state:this.value?'CURRENT':'API_UNAVAILABLE'}};}}};
 const context=vm.createContext({window,document,location:{origin:'https://rrr.trading'},Intl,Date,URL,AbortController,AbortSignal,console,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},setInterval:()=>0,setTimeout,clearTimeout,fetch:async url=>{requests.push(url);if(url.endsWith('/v4/paper')){if(failure)throw Error('unavailable');return {ok:true,status:200,headers:{get:()=>null},json:async()=>data};}return {ok:false,status:404};}});
 vm.runInContext(fs.readFileSync('homepage-redesign-dashboard.js','utf8'),context);
 vm.runInContext(fs.readFileSync('v4-overview.js','utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 assert(requests.includes('https://v4.rrr.trading/v4/paper'),'removed legacy DOM cannot stop initial paper request');
 assert(renders.some(r=>r.loading===false),'position renderer independently receives completion');
 assert.equal(label.textContent,'TRADING STATUS:');
 if(failure){assert.equal(nodes.get('home-current-count').textContent,'Unavailable');assert.equal(renders.at(-1).value,null);}
 else{
 assert.equal(nodes.get('home-current-count').textContent,String(count));
 assert.equal(nodes.get('home-current-pnl').textContent,count?'+2.00 USDT':'0.00 USDT');
 assert.equal(nodes.get('home-current-status').textContent,'OK');
 assert(nodes.get('home-market-cards').children[0].children[1].textContent.includes('+2.5%'));
 assert(nodes.get('home-market-cards').children[4].children[1].textContent.startsWith('0 / 100'));
 assert.equal(renders.at(-1).value,data);
 }
 assert(requests.every(url=>url.startsWith('https://v4.rrr.trading/v4/')||url.endsWith('/api/schedule/economic')));
}
(async()=>{
 for(const field of ['change_24h_pct','price_change_24h','change_24h'])await scenario({field});
 await scenario({count:1});await scenario({failure:true});
 const html=fs.readFileSync('index.html','utf8');
 for(const name of ['script.js','candidate-progress.js','trading-universe.js','v3-generation.js'])assert(!html.includes('src="'+name)&&!html.includes('src="/'+name),name+' removed from homepage');
 console.log('PASS: removed DOM, supported V4 contracts without ok, change aliases, independent positions despite themes/calendar 404, paper failure, zero positions and zero P/L, retired homepage integrations.');
})().catch(error=>{console.error(error);process.exitCode=1;});

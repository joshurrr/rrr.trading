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
async function scenario({failure=false,tickerMissing=false,tickerExpired=false,count=0,missing=false,retained=false,stale=false}={}){
 const nodes=new Map(),listeners={},requests=[],renders=[];
 for(const id of ['v4-overview','home-market-cards','home-market-updated'])nodes.set(id,new Element());
 const label=new Element(),targets=new Element();
 const document={hidden:false,referrer:'',body:{dataset:{},id:'home'},getElementById:id=>nodes.get(id)||null,querySelector:q=>q==='.header-target-label'?label:q==='.header-targets'?targets:null,createElement:()=>new Element(),addEventListener:()=>{}};
 const at=new Date(Date.now()-1000).toISOString(),expires=new Date(Date.now()+60000).toISOString();
 const observed={state:'CURRENT',source_at:at,observed_at:at,expires_at:expires};
 const data={version:'paper-read-api-v1',mode:'paper',served_at:at,open_positions:{availability:'AVAILABLE',items:Array.from({length:count},()=>({side:'LONG',symbol:'BTCUSDT',mark_expires_at:expires,financials:{estimated_net_pnl_usdt:2}}))},overview:{breadth:{...observed,health:'AVAILABLE',values:{rising_24h_pct:60,falling_24h_pct:40,assets_included:2}},fear_greed:{...observed,values:{value:0,classification:'Extreme Fear'}},paper_trading:{...observed,status:'OK'},research:{catalogue:{state:'CURRENT',observed_at:at,pool_asset_count:2,assessed_count:2,eligible_count:2,assets:['BTC','ETH'].map(symbol=>({symbol:symbol+'USDT',pair:symbol+'USDT/USDT:USDT',technically_assessed:true,price:100,change_24h_pct:2.5}))}}}};
 data.market_prices=Object.fromEntries(['BTCUSDT','ETHUSDT'].map((symbol,i)=>[symbol,{symbol,source:'bybit',availability:'AVAILABLE',price:i?3500:68000,change_24h_pct:i?-1.25:2.5,source_at:at,observed_at:at,expires_at:expires}]));
 data.overview.research={state:'UNAVAILABLE',reasons:['saved_research_unavailable']};
 if(tickerMissing||missing)delete data.market_prices;
 if(tickerExpired)for(const item of Object.values(data.market_prices))item.expires_at=new Date(Date.now()-1).toISOString();
 if(missing)data.overview={};
 if(stale){data.overview.breadth.expires_at=new Date(Date.now()-1).toISOString();}
 if(!missing)data.overview.cash_indexes={NASDAQ100:{...observed,value:18000,change_1d_pct:-0.7,session_context:'DAILY_CASH_INDEX_CLOSE_NOT_LIVE_OR_FUTURES'}};
 const window={addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn),dispatchEvent:e=>(listeners[e.type]||[]).forEach(fn=>fn(e)),HomeDemoPositions:{render:(value,loading)=>{renders.push({value,loading});window.dispatchEvent({type:'rrr-v4-home-position-snapshot',detail:{data:value,diagnostics:{display:retained?'RETAINED':'CURRENT'}}});}}};window.parent=window;window.PublicFinancialSnapshot={Cache:class{accept(value){this.value=value;return true;}fail(){this.value=null;}display(){return {data:this.value||null,diagnostics:{state:this.value?'CURRENT':'API_UNAVAILABLE'}};}}};
 const context=vm.createContext({window,document,location:{origin:'https://rrr.trading'},Intl,Date,URL,AbortController,AbortSignal,console,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},setInterval:()=>0,setTimeout,clearTimeout,fetch:async url=>{requests.push(url);if(url.endsWith('/v4/paper')){if(failure)throw Error('unavailable');return {ok:true,status:200,headers:{get:()=>null},json:async()=>data};}return {ok:false,status:404};}});
 vm.runInContext(fs.readFileSync('homepage-redesign-dashboard.js','utf8'),context);
 vm.runInContext(fs.readFileSync('v4-overview.js','utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 assert(requests.includes('https://v4.rrr.trading/v4/paper'),'removed legacy DOM cannot stop initial paper request');
 assert(renders.some(r=>r.loading===false),'position renderer independently receives completion');
 assert.equal(label.textContent,'TRADING STATUS:');
 const cards=nodes.get('home-market-cards').children;
 assert.equal(cards.length,5);
 if(failure||missing){assert(cards.every(card=>card.children[1].textContent==='Unavailable'));}
 else{
 if(tickerMissing||tickerExpired)assert.equal(cards[0].children[1].textContent,'Unavailable');
 else{assert.equal(cards[0].children[1].textContent,'$68,000');assert(cards[0].children[2].textContent.includes('+2.5%'));assert(cards[1].children[2].textContent.includes('-1.25%'));assert(cards[0].title.includes('Source:'));}
 assert(cards[2].children[1].textContent.includes('60% ↑ / 40% ↓'));
 assert(cards[3].children[0].textContent.includes('Nasdaq-100'));
 assert(cards[3].children[2].textContent.includes('-0.7% · last close'));
 assert.equal(cards[4].children[1].textContent,'0 / 100');
 if(retained)assert.equal(cards[0].dataset.state,'STALE');
 if(retained||stale)assert.equal(cards[2].dataset.state,'STALE');
 }
 assert.equal(renders.at(-1).value,failure?null:data,'market availability never discards position data');
 assert.equal(requests.length,1,'only the existing paper snapshot request');
}
(async()=>{
 await scenario();await scenario({tickerMissing:true});await scenario({tickerExpired:true});
 await scenario({count:1});await scenario({failure:true});await scenario({missing:true,count:1});await scenario({retained:true});await scenario({stale:true});
 const html=fs.readFileSync('index.html','utf8');
 for(const name of ['script.js','candidate-progress.js','trading-universe.js','v3-generation.js'])assert(!html.includes('src="'+name)&&!html.includes('src="/'+name),name+' removed from homepage');
 assert(!/home-theme-list|home-event-list|home-current-title|home-recent-list|home-position-metrics|home-performance-panel|main hidden/.test(html));
 assert(html.indexOf('home-market-strip')<html.indexOf('id=\"home-demo-positions\"'));
 console.log('PASS: five compact V4 indicators, missing/stale/retained states, zero values, independent positions, one request, no legacy widgets or polling.');
})().catch(error=>{console.error(error);process.exitCode=1;});

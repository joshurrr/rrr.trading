(() => {
  'use strict';
  const root = document.getElementById('bybit-demo-public');
  if (!root || document.body.dataset.bot !== 'short') return;
  const endpoint = 'https://api.rrr.trading/api/demos/short/bybit-demo';
  const node = (tag, text, cls) => {const el = document.createElement(tag); if(text)el.textContent=text; if(cls)el.className=cls; return el;};
  const head=node('div','','bybit-demo-head'), intro=node('div');
  intro.append(node('p','Exchange demo transparency','bybit-demo-eyebrow'), node('h2','15-minute Bybit Demo copier'));
  head.append(intro,node('span','SIMULATED FUNDS','bybit-demo-badge'));
  const status=node('p','Loading exchange demo status…');status.setAttribute('role','status');
  const explanation=node('p','A separate exchange demo account for testing the copier. This is not real-money trading, and it is separate from the paper strategy results below.');
  const metrics=node('dl','','bybit-demo-metrics'), values={};
  for(const [key,label] of [['budget','Configured demo budget'],['execution','Exchange execution'],['pnl','Copier net P/L'],['trades','Confirmed copier trades']]){
    const card=node('div','','bybit-demo-metric'),value=node('dd','Unavailable');values[key]=value;card.append(node('dt',label),value);metrics.append(card);
  }
  const evidence=node('div','','bybit-demo-evidence'),positions=node('p'),fills=node('p');
  for(const [title,body] of [['Exchange-confirmed positions',positions],['Exchange-confirmed fills',fills]]){const section=node('section');section.append(node('h3',title),body);evidence.append(section);}
  const updated=node('p','','bybit-demo-footnote'),note=node('p','Demo results do not establish real-money performance. This public view has no account or trading controls.','bybit-demo-footnote');
  root.replaceChildren(head,status,explanation,metrics,evidence,updated,note);
  let saved=null,controller=null,requestId=0,timer=null;
  const budget=value=>typeof value==='number'&&Number.isFinite(value)&&value>=1&&value<=100000;
  function valid(data){
    if(!data||data.version!=='bybit-demo-public-v1'||data.mode!=='DEMO'||data.bot!=='short'||data.real_orders_possible!==false||typeof data.fresh!=='boolean'||data.max_age_seconds!==90)return false;
    if(data.budget_usdt!==null&&!budget(data.budget_usdt))return false;
    if(!data.fresh)return ['STALE','UNAVAILABLE'].includes(data.state)&&data.connection==='UNAVAILABLE'&&data.execution_enabled===null;
    if(data.execution_enabled!==false||!['CONNECTED_DISABLED','UNAVAILABLE','NOT_CONFIGURED'].includes(data.state))return false;
    if(!['VERIFIED','UNAVAILABLE','NOT_CONFIGURED'].includes(data.connection)||(data.state==='CONNECTED_DISABLED')!==(data.connection==='VERIFIED'))return false;
    const at=Date.parse(data.observed_at),age=Date.now()-at;
    if(typeof data.observed_at!=='string'||!/(?:Z|[+-]\d\d:\d\d)$/.test(data.observed_at)||!Number.isFinite(age)||age < -30000)return false;
    return data.performance?.state==='NOT_STARTED'&&data.performance.net_pnl_usdt===null&&data.performance.return_pct===null&&data.performance.trade_count===null&&data.positions?.state==='NOT_STARTED'&&Array.isArray(data.positions.items)&&data.positions.items.length===0&&data.fills?.state==='NOT_STARTED'&&Array.isArray(data.fills.items)&&data.fills.items.length===0;
  }
  function draw(){
    const age=Date.now()-Date.parse(saved?.observed_at),fresh=saved?.fresh===true&&age>=-30000&&age<=90000;
    const verified=fresh&&saved.connection==='VERIFIED';
    status.textContent=verified?'Demo connection verified · execution disabled':fresh&&saved.connection==='NOT_CONFIGURED'?'Demo copier not connected':saved?.state==='STALE'||(saved?.fresh&&age>90000)?'Saved demo status is stale · current state unavailable':'Demo status unavailable';
    values.budget.textContent=budget(saved?.budget_usdt)?saved.budget_usdt.toLocaleString('en-AU',{maximumFractionDigits:2})+' USDT'+(fresh?'':' · saved'):'Unavailable';
    values.execution.textContent=fresh?'Disabled':'Unavailable';
    values.pnl.textContent=fresh?'Not started':'Unavailable';values.trades.textContent=fresh?'Not started':'Unavailable';
    const message=fresh?'The order executor is not implemented yet. No copier positions or fills are reported.':'Current exchange evidence is unavailable. Missing data does not establish whether an account has positions or orders.';
    positions.textContent=message;fills.textContent=fresh?'Fills and performance will appear only after exchange execution and its reporting are implemented. Paper fills are not exchange fills.':message;
    const at=Date.parse(saved?.observed_at);
    updated.textContent=Number.isFinite(at)?'Last saved check: '+new Date(at).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' Brisbane · read-only feed refreshed every 30 seconds.':'No verified public snapshot has been received.';
  }
  async function refresh(){
    if(document.hidden)return;
    controller?.abort();controller=new AbortController();const active=controller,id=++requestId,deadline=setTimeout(()=>active.abort(),10000);
    try{const response=await fetch(endpoint,{method:'GET',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:active.signal});if(!response.ok)throw Error();const data=await response.json();if(id===requestId)saved=valid(data)?data:null;}
    catch(_){if(id===requestId)saved=null;}
    finally{clearTimeout(deadline);if(id===requestId){draw();clearTimeout(timer);timer=setTimeout(refresh,30000);}}
  }
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(document.hidden){++requestId;controller?.abort();}else{draw();refresh();}});
  window.addEventListener('pagehide',()=>{clearTimeout(timer);++requestId;controller?.abort();});
  draw();refresh();setInterval(draw,1000);
})();

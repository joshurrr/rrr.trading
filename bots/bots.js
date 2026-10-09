'use strict';
(() => {
  const root = document.getElementById('bot-cards');
  if (!root) return;
  const {bots, currentReporting} = window.BotRegistry;
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const count = v => Number.isSafeInteger(v) && v >= 0;
  const node = (tag, text, cls) => { const n=document.createElement(tag); n.textContent=text; if(cls)n.className=cls; return n; };
  const money = v => finite(v) ? v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' USDT' : 'Unavailable';
  const date = v => Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' Brisbane' : 'Unavailable';
  const states = bots.map(bot => {
    const card=node('article','','bot-overview-card');card.dataset.bot=bot.id;
    const status=node('p','Loading native status…');status.setAttribute('role','status');
    const scope=node('p','Loading current-run reporting…','bot-feed-note'), list=node('dl',''), fields={};
    for(const [key,label] of [['mode','Trading mode'],['version','Bot version'],['run','Current run'],['started','Run started'],['open','Open positions (current run)'],['capacity','Configured position limit'],['eligibility','Entry eligibility'],['completed','Completed trades'],['winRate','Win rate'],['realised','Realised P/L'],['unrealised','Open position P/L'],['total','Total P/L'],['statusAt','Native status updated'],['reportAt','Reporting updated']]) {
      const value=node('dd','Loading…');fields[key]=value;list.append(node('dt',label),value);
    }
    const link=node('a','VIEW BOT →','view-bot');link.href=bot.dashboard;link.setAttribute('aria-label','View '+bot.name);
    card.append(node('h2',bot.name),node('p',bot.timeframeLabel+' timeframe'),status,scope,list,link);root.append(card);
    return {bot,card,status,scope,fields,native:null,report:null,received:0,statusDone:false,reportDone:false};
  });
  function render(s) {
    const now=Date.now(), raw=s.native, age=finite(raw?.generated_at)?now/1000-raw.generated_at:null;
    const nativeFresh=raw?.ok===true && age!==null && age>=-30 && age<30 && raw.bot?.timeframe===s.bot.timeframe && ['PAPER','LIVE'].includes(raw.bot.mode) && (raw.demo===undefined || raw.demo===s.bot.id);
    const b=nativeFresh?raw.bot:null, r=s.report;
    const validStart=typeof r?.started_at==='string' && Number.isFinite(Date.parse(r.started_at)) && Date.parse(r.started_at)<=now;
    const metadata=s.received && now-s.received<45000 && typeof r?.run_id==='string' && r.run_id.trim() && validStart ? r : null;
    const report=b?.mode==='LIVE' ? null : currentReporting(r,s.received,metadata);
    const p=report?.portfolio||{}, missing=s.reportDone?'Unavailable':'Loading…';
    const set=(key,value,amount)=>{s.fields[key].textContent=value;s.fields[key].className=finite(amount)&&amount>0?'good':finite(amount)&&amount<0?'bad':'';};
    const statusState=b?.state==='RUNNING'?'Running':b?.state==='STOPPED'?'Stopped':'Unknown';
    s.status.textContent=nativeFresh?`Process: ${statusState} · ${b.mode==='PAPER'?'Paper':'Live'} mode`:!s.statusDone?'Loading native status…':raw?'Native status stale or invalid · process unavailable':'Native status unavailable · process unknown';
    set('mode',b?.mode|| (s.statusDone?'Unknown':'Loading…'));
    set('version',typeof b?.version==='string'&&b.version.trim()?b.version:'Unavailable');
    set('run',metadata?.run_id||missing);set('started',metadata?date(metadata.started_at):missing);
    set('capacity',b?.max_open_trades===-1?'Unlimited':count(b?.max_open_trades)?String(b.max_open_trades):'Unavailable');
    set('eligibility','Unknown · see bot evidence');
    set('open',count(p.open_positions)?String(p.open_positions):missing);
    set('completed',count(p.closed_trades)?String(p.closed_trades):missing);
    set('winRate',finite(p.win_rate)&&p.win_rate>=0&&p.win_rate<=100?p.win_rate.toFixed(2)+'%':missing);
    for(const [key,field] of [['realised','profit_closed_abs'],['unrealised','profit_open_abs'],['total','profit_all_abs']])set(key,finite(p[field])?money(p[field]):missing,p[field]);
    set('statusAt',finite(raw?.generated_at)&&Number.isFinite(new Date(raw.generated_at*1000).getTime())?date(new Date(raw.generated_at*1000).toISOString())+(nativeFresh?'':' · saved, not current'):'Unavailable');
    set('reportAt',typeof r?.observed_at==='string'?date(r.observed_at)+(report?'':' · saved, not current'):missing);
    s.scope.textContent=report?'Current paper run only · legacy performance excluded. Configured limit does not establish available capacity or entry approval.':!s.reportDone?'Loading current-run reporting…':r?'Current-run reporting stale, invalid or unavailable · legacy results are not substituted.':'Current-run reporting unavailable · legacy results are not substituted.';
  }
  const get=async route=>{const response=await fetch('https://api.rrr.trading'+route,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Unavailable');return response.json();};
  let busy=false;
  async function refresh() {
    if(busy)return;busy=true;
    try { await Promise.allSettled(states.flatMap(s=>[
      (async()=>{try{s.native=await get(s.bot.status);}catch{s.native=null;}finally{s.statusDone=true;render(s);}})(),
      (async()=>{try{s.report=await get(s.bot.reporting);s.received=Date.now();}catch{s.report=null;s.received=0;}finally{s.reportDone=true;render(s);}})()
    ])); } finally {busy=false;}
  }
  states.forEach(render);refresh();
  setInterval(()=>{states.forEach(render);if(!document.hidden)refresh();},15000);
  document.addEventListener('visibilitychange',()=>{states.forEach(render);if(!document.hidden)refresh();});
  // Expiry clears current claims between polls, including during a pending request.
  setInterval(()=>states.forEach(render),1000);
})();

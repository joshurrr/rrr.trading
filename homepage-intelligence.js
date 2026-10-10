'use strict';
// Read-only overview. Status results are shared with the asset universe loader.
(() => {
  const bots = [
    {key:'medium', timeframe:'1h', name:'1 hr Medium Term', route:'/demo/1hrbot/'},
    {key:'short', timeframe:'15m', name:'15 min Short Term', route:'/demo/15minbot/'},
    {key:'long', timeframe:'4h', name:'4 hr Long Term', route:'/demo/4hrbot/'}
  ];
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const fresh = d => d?.ok === true && finite(d.generated_at) && Math.abs(Date.now()/1000 - d.generated_at) <= 30;
  const statusFresh = d => d?.ok === true && finite(d.generated_at) && Date.now()/1000 - d.generated_at >= -30 && Date.now()/1000 - d.generated_at <= 45;
  const label = v => typeof v === 'string' && v.trim() ? v.replaceAll('_',' ').toUpperCase() : 'UNKNOWN';
  const node = (tag, value, cls) => { const el=document.createElement(tag); el.textContent=value; if(cls) el.className=cls; return el; };
  const set = (id,value) => { document.getElementById(id).textContent=value; };
  const date = v => typeof v === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' Brisbane' : 'Unavailable';
  let statusResults=[], flows={}, context=null, busy=false, statusResolved=false;
  function contextDecision(d) {
    // NO SIGNAL is a technical outcome; do not mislabel it as a context veto.
    if (!d) return 'Unavailable';
    if (d.traderouter?.macro) return label(d.traderouter.state);
    return d.final_decision?.state === 'NO SIGNAL' ? 'NO SIGNAL · context not required' : 'UNKNOWN · no retained context';
  }
  function renderBots() {
    const cards=bots.map((bot,i) => {
      const raw=statusResults[i]?.status==='fulfilled' ? statusResults[i].value : null;
      const d=statusFresh(raw) && raw.bot?.timeframe===bot.timeframe && raw.bot.mode==='PAPER' ? raw : null;
      const card=node('article','','paper-card'); card.dataset.homeBot=bot.key;
      const statusText = d ? (window.homepageBotRefreshFailed?.[bot.key] ? 'Refresh failed · last observed ' : '')+label(d.bot.state)+' · PAPER' : !statusResolved ? 'Loading bot status…' : raw ? 'Stale or invalid bot data' : 'Bot data unavailable';
      const title=node('h3',{'15m':'15 MIN BOT','1h':'1 HR BOT','4h':'4 HR BOT'}[bot.timeframe]);
      card.append(title,node('p',statusText,'paper-status'));
      const pairs=Array.isArray(d?.bot.pairs) && d.bot.pairs.every(v=>typeof v==='string') ? new Set(d.bot.pairs).size : null;
      const rows=[['Bot status',statusText],['Realized P/L','Loading current-run P/L…'],['Win rate','Loading current-run results…'],['Open v2 positions','Checking current-run positions…'],['Closed v2 trades','Loading current-run results…'],['Current v2 run','Loading current-run evidence'],['Latest v2 decision','Loading recorded decisions…'],['Loaded assets',pairs===null?!statusResolved?'Loading asset feed…':'Unavailable':pairs+' in bot feed']];
      const dl=node('dl','');
      rows.forEach(([key,value])=>{const row=node('div','');if(key==='Realized P/L')row.className='pnl-metric';row.append(node('dt',key),node('dd',value));dl.append(row);});
      const link=node('a','View bot →','text-link');link.href=bot.route;
      card.append(dl,link);
      return card;
    });
    // Display in timeframe order, while preserving status feed order.
    const host=document.getElementById('homepage-bots');
    if(!host.children.length)host.replaceChildren(cards[1],cards[0],cards[2]);
    else for(const card of cards){
      const existing=host.querySelector(`[data-home-bot="${card.dataset.homeBot}"]`);
      existing.querySelector('.paper-status').textContent=card.querySelector('.paper-status').textContent;
      for(const name of ['Bot status','Loaded assets']){
        const find=root=>[...root.querySelectorAll('dt')].find(dt=>dt.textContent===name)?.nextElementSibling;
        find(existing).textContent=find(card).textContent;
      }
    }
  }
  function renderIntelligence() {
    const age=Date.now()-Date.parse(context?.generated_at);
    const usable=context?.fresh===true && context.mode==='observation_only' && Number.isFinite(age) && age>=-60000 && age<=660000;
    const crypto=context?.crypto;
    const deadline=crypto?.valid_until ? Date.parse(crypto.valid_until) : Infinity;
    const layer=usable && crypto?.available===true && crypto.fresh===true && deadline>=Date.now();
    const checks=bots.filter(b=>flows[b.key]);
    set('intelligence-regime',layer?label(crypto.regime):'Unavailable');
    set('intelligence-confidence',layer && finite(crypto.confidence) && crypto.confidence>=0 && crypto.confidence<=100 ? crypto.confidence.toFixed(0)+' / 100':'Unavailable');
    set('intelligence-gate',checks.some(b=>flows[b.key].traderouter?.macro)?'See per-bot checks':'Unavailable');
    set('intelligence-status',usable?'Observation context':context?'Context stale / unavailable':'Context unavailable');
    set('intelligence-assessment',(usable?'Global market context is observation only. ':'Global market context is unavailable. ')+(checks.length ? checks.length+' of 3 bot diagnostic feeds available. Context outcomes below describe recorded candidate checks; approval does not confirm an order.' : 'Bot context checks are unavailable. Research and event coverage do not establish asset eligibility or execution approval.'));
    // There is no single global execution decision. Keep each bot identity explicit.
    set('intelligence-decision','Candidate context checks: '+bots.map(b=>b.timeframe+' '+contextDecision(flows[b.key])).join(' · '));
    set('intelligence-updated','Last intelligence update: '+(usable?date(context.generated_at):'Unavailable'));
  }
  window.renderHomepageBots = results => {
    window.homepageBotRefreshFailed=Object.fromEntries(bots.map((b,i)=>[b.key,results[i]?.status==='rejected']));
    // A transient failed request must not discard a still-recent observation.
    // Fulfilled invalid/stale responses replace previous data and fail closed.
    statusResults=results.map((result,i)=>result?.status==='rejected'&&statusResults[i]?.status==='fulfilled'&&statusFresh(statusResults[i].value)?statusResults[i]:result);
    statusResolved=true;renderBots();
    window.homepageBotStatus=Object.fromEntries(bots.map((b,i)=>{const d=statusResults[i]?.status==='fulfilled'?statusResults[i].value:null;return [b.key,statusFresh(d)&&d.bot?.timeframe===b.timeframe&&d.bot?.mode==='PAPER'?d:null];}));
    window.dispatchEvent(new Event('homepage-bot-status'));
  };
  async function refreshHomepageIntelligence() {
    if(busy) return; busy=true;
    try {
      const results=await Promise.allSettled([getPublic('/api/trading-context'),...bots.map(b=>getPublic('/api/demos/'+b.key+'/decision-flow'))]);
      context=results[0].status==='fulfilled'?results[0].value:null;
      bots.forEach((b,i)=>{const d=results[i+1].status==='fulfilled'?results[i+1].value:null;flows[b.key]=fresh(d) && d.bot===b.key && d.timeframe===b.timeframe ? d : null;});
      renderIntelligence();
    } finally {busy=false;}
  }
  window.refreshHomepageIntelligence=refreshHomepageIntelligence;
  renderBots();renderIntelligence();refreshHomepageIntelligence();
  setInterval(()=>{if(!document.hidden) refreshHomepageIntelligence();},30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) refreshHomepageIntelligence();});
})();

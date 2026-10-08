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
  const label = v => typeof v === 'string' && v.trim() ? v.replaceAll('_',' ').toUpperCase() : 'UNKNOWN';
  const node = (tag, value, cls) => { const el=document.createElement(tag); el.textContent=value; if(cls) el.className=cls; return el; };
  const set = (id,value) => { document.getElementById(id).textContent=value; };
  const date = v => typeof v === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' Brisbane' : 'Unavailable';
  let statusResults=[], flows={}, context=null, busy=false;
  function contextDecision(d) {
    // NO SIGNAL is a technical outcome; do not mislabel it as a context veto.
    if (!d) return 'Unavailable';
    if (d.traderouter?.macro) return label(d.traderouter.state);
    return d.final_decision?.state === 'NO SIGNAL' ? 'NO SIGNAL · context not required' : 'UNKNOWN · no retained context';
  }
  function renderBots() {
    const cards=bots.map((bot,i) => {
      const raw=statusResults[i]?.status==='fulfilled' ? statusResults[i].value : null;
      const d=fresh(raw) && raw.bot?.timeframe===bot.timeframe && raw.bot.mode==='PAPER' ? raw : null;
      const card=node('article','','paper-card'); card.dataset.homeBot=bot.key;
      const title=node('h3',bot.name); title.prepend(node('strong',bot.timeframe+' '));
      card.append(title,node('p',d ? label(d.bot.state)+' · PAPER' : raw ? 'Stale or invalid bot data' : 'Bot data unavailable','paper-status'));
      const pairs=Array.isArray(d?.bot.pairs) && d.bot.pairs.every(v=>typeof v==='string') ? new Set(d.bot.pairs).size : null;
      const rows=[['Bot status',d ? label(d.bot.state)+' · PAPER' : raw ? 'Stale or invalid bot data' : 'Bot data unavailable'],['Loaded assets',pairs===null?'Unavailable':pairs+' in bot feed'],['Latest v2 decision','V2 decision unavailable'],['Current v2 run','Loading current-run evidence'],['Realized P/L','V2 performance unavailable'],['Win rate','V2 performance unavailable'],['Closed v2 trades','V2 performance unavailable']];
      const dl=node('dl','');
      rows.forEach(([key,value])=>{const row=node('div','');row.append(node('dt',key),node('dd',value));dl.append(row);});
      const link=node('a','View bot →','text-link');link.href=bot.route;
      card.append(dl,node('p','Shared v2 assessments and recorded reasons are shown in Live candidate progress.','data-note'),link);
      return card;
    });
    // Display in timeframe order, while preserving status feed order.
    document.getElementById('homepage-bots').replaceChildren(cards[1],cards[0],cards[2]);
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
  window.renderHomepageBots = results => {statusResults=results;renderBots();};
  async function refreshHomepageIntelligence() {
    if(busy) return; busy=true;
    try {
      const results=await Promise.allSettled([getPublic('/api/trading-context'),...bots.map(b=>getPublic('/api/demos/'+b.key+'/decision-flow'))]);
      context=results[0].status==='fulfilled'?results[0].value:null;
      bots.forEach((b,i)=>{const d=results[i+1].status==='fulfilled'?results[i+1].value:null;flows[b.key]=fresh(d) && d.bot===b.key && d.timeframe===b.timeframe ? d : null;});
      renderIntelligence();renderBots();
    } finally {busy=false;}
  }
  window.refreshHomepageIntelligence=refreshHomepageIntelligence;
  renderBots();renderIntelligence();refreshHomepageIntelligence();
  setInterval(()=>{if(!document.hidden) refreshHomepageIntelligence();},30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) refreshHomepageIntelligence();});
})();

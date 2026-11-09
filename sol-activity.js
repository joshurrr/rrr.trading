'use strict';
(() => {
  const root=document.getElementById('home-sol-activity');
  if(!root)return;
  const list=document.getElementById('sol-activity-list'),note=document.getElementById('sol-activity-time');
  const time=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
  const date=v=>time(v)===null?'unavailable':new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date(v))+' AEST';
  const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  let signature='',saved=null;
  function render(data,loading=false,{retained=false}={}){
    const candidate=data?.version==='paper-read-api-v1'&&data.mode==='paper'?data.sol_activity:null;
    const usable=candidate?.version==='sol-activity-v1'&&candidate.mode==='paper'&&['AVAILABLE','STALE'].includes(candidate.availability)&&time(candidate.source_at)!==null&&time(candidate.source_at)<=Date.now()&&time(candidate.expires_at)>time(candidate.source_at)&&Array.isArray(candidate.items);
    if(usable&&(!saved||time(candidate.source_at)>=time(saved.source_at)))saved=candidate;
    const view=saved;
    retained=retained||!usable||usable&&time(candidate.source_at)<time(saved?.source_at);
    const key=JSON.stringify([view,loading,retained,time(view?.expires_at)!==null&&Date.now()>=time(view.expires_at),(Array.isArray(view?.items)?view.items:[]).map(r=>Date.now()>=time(r.expires_at))]);
    if(key===signature)return;signature=key;
    list.replaceChildren();
    if(view?.version!=='sol-activity-v1'||view.mode!=='paper'||!['AVAILABLE','STALE'].includes(view.availability)||time(view.source_at)===null||time(view.source_at)>Date.now()||time(view.expires_at)===null){
      list.append(el('p',loading?'Reading AI activity…':'AI activity unavailable.'));
      note.textContent='Saved paper-trading decisions · Status time unavailable';return;
    }
    const stale=retained||view.availability==='STALE'||Date.now()>=time(view.expires_at);
    const prefix=view.entries_enabled===false?'Entries disabled · Saved plan · ':view.entries_enabled!==true?'Entry availability unknown · Saved plan · ':'';
    for(const row of (Array.isArray(view.items)?view.items:[])){
      if(!/^[A-Z0-9]{1,30}USDT$/.test(row.symbol)||!['LONG','SHORT'].includes(row.side)||time(row.expires_at)===null||Date.now()>=time(row.expires_at))continue;
      let message;
      if(row.status==='CLAIMED')message='Entry processing started; fill not confirmed.';
      else if(row.status==='ARMED')message='Pullback confirmed — waiting for a later completed 5-minute candle to confirm '+(row.side==='SHORT'?'downside':'upside')+'.';
      else if(row.status==='PENDING')message={WAIT_FOR_PULLBACK:'Waiting for a pullback, then 5-minute entry confirmation.',WAIT_FOR_BREAKOUT:'Waiting for 5-minute breakout confirmation.',TRADE_NOW:'Entry proposed; execution not confirmed.'}[row.action];
      if(!message)continue;
      const card=el('article',''),plan=el('div','');plan.className='sol-plan-card';plan.dataset.assetAnalysisSymbol=row.symbol;plan.entryPlan=row;
      const title=el('span',prefix+row.symbol.replace(/USDT$/,'')+' \u00b7 '+row.side);title.className='sol-plan-title';
      const description=el('span',message);description.className='sol-plan-message';
      plan.append(title,description,el('small','Last candle checked: '+date(row.last_candle_at)+' \u00b7 Plan expires: '+date(row.expires_at)),el('span','View AI decision'));card.append(plan);list.append(card);
    }
    if(!list.children.length)list.append(el('p',stale?'Saved activity is stale; current plans are unknown.':view.entries_enabled===false?'New entries are disabled.':view.active_count===0?'No active entry plans in the latest saved status.':'No unexpired plans can be displayed; awaiting updated status.'));
    if(view.omitted>0)list.append(el('p',view.omitted+' additional plans in the saved status.'));
    note.textContent=(stale?'STALE · ':'')+'Status recorded '+date(view.source_at)+' · Conditional paper plans; fills appear under open positions.';
  }
  window.HomeSolActivity={render};
})();

'use strict';
(() => {
  const root=document.getElementById('home-sol-activity');
  if(!root)return;
  const list=document.getElementById('sol-activity-list'),note=document.getElementById('sol-activity-time');
  const time=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
  const date=v=>time(v)===null?'unavailable':new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date(v))+' AEST';
  const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  let signature='';
  function render(data,loading=false){
    const view=data?.version==='paper-read-api-v1'&&data.mode==='paper'?data.sol_activity:null;
    const key=JSON.stringify([view,loading,time(view?.expires_at)!==null&&Date.now()>=time(view.expires_at),(Array.isArray(view?.items)?view.items:[]).map(r=>Date.now()>=time(r.expires_at))]);
    if(key===signature)return;signature=key;
    list.replaceChildren();
    if(view?.version!=='sol-activity-v1'||view.mode!=='paper'||!['AVAILABLE','STALE'].includes(view.availability)||time(view.source_at)===null||time(view.source_at)>Date.now()||time(view.expires_at)===null){
      list.append(el('p',loading?'Reading SOL’s saved activity…':'SOL activity unavailable.'));
      note.textContent='Saved paper-trading decisions · Status time unavailable';return;
    }
    const stale=view.availability==='STALE'||Date.now()>=time(view.expires_at);
    const prefix=stale?'Last saved plan · ':view.entries_enabled===false?'Entries disabled · Saved plan · ':view.entries_enabled!==true?'Entry availability unknown · Saved plan · ':'';
    for(const row of (Array.isArray(view.items)?view.items:[])){
      if(!/^[A-Z0-9]{1,30}USDT$/.test(row.symbol)||!['LONG','SHORT'].includes(row.side)||time(row.expires_at)===null||Date.now()>=time(row.expires_at))continue;
      let message;
      if(row.status==='CLAIMED')message='Entry processing started; fill not confirmed.';
      else if(row.status==='ARMED')message='Pullback confirmed — waiting for a later completed 5-minute candle to confirm '+(row.side==='SHORT'?'downside':'upside')+'.';
      else if(row.status==='PENDING')message={WAIT_FOR_PULLBACK:'Waiting for a pullback, then 5-minute entry confirmation.',WAIT_FOR_BREAKOUT:'Waiting for 5-minute breakout confirmation.',TRADE_NOW:'Entry proposed; execution not confirmed.'}[row.action];
      if(!message)continue;
      const card=el('article','');card.append(el('h3',prefix+row.symbol.replace(/USDT$/,'')+' · '+row.side),el('p',message),el('small','Last candle checked: '+date(row.last_candle_at)+' · Plan expires: '+date(row.expires_at)));list.append(card);
    }
    if(!list.children.length)list.append(el('p',stale?'Saved activity is stale; current plans are unknown.':view.entries_enabled===false?'New entries are disabled.':view.active_count===0?'No active entry plans in the latest saved status.':'No unexpired plans can be displayed; awaiting updated status.'));
    if(view.omitted>0)list.append(el('p',view.omitted+' additional plans in the saved status.'));
    note.textContent=(stale?'STALE · ':'')+'Status recorded '+date(view.source_at)+' · Conditional paper plans; fills appear under open positions.';
  }
  window.HomeSolActivity={render};
})();

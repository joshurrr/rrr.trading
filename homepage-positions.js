'use strict';
// Render the homepage's existing V4 snapshot. No fetches or financial calculations.
(() => {
  const root=document.getElementById('home-demo-positions');
  if(!root)return;
  const $=id=>document.getElementById(id);
  const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
  // Match the public V4 dashboard's numeric formatting and source deadlines.
  const number=value=>{
    if((typeof value!=='number' && typeof value!=='string') || (typeof value==='string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())))return null;
    const n=Number(value);return Number.isFinite(n)?n:null;
  };
  const money=value=>number(value)===null?'Unavailable':new Intl.NumberFormat('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(number(value))+' USDT';
  const price=value=>number(value)===null?'Unavailable':new Intl.NumberFormat('en-AU',{maximumSignificantDigits:8}).format(number(value));
  const stamp=value=>typeof value==='string' && Number.isFinite(Date.parse(value))?Date.parse(value):null;
  const expired=value=>stamp(value)!==null && Date.now()>=stamp(value);
  const date=value=>stamp(value)===null?'unavailable':new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'}).format(new Date(value))+' AEST';
  const availability=source=>['AVAILABLE','STALE','UNAVAILABLE'].includes(source?.availability)?source.availability:'UNAVAILABLE';
  const text=value=>typeof value==='string' && value.trim()?value.slice(0,80):'Unknown';
  const tone=(node,value)=>{const n=number(value);node.dataset.pnl=n===null?'unknown':n>0?'profit':n<0?'loss':'flat';};
  const age=value=>{
    const at=stamp(value);if(at===null || at>Date.now())return 'Unavailable';
    const minutes=Math.floor((Date.now()-at)/60000);
    return minutes<1?'Under 1m':minutes<60?minutes+'m':Math.floor(minutes/60)+'h '+minutes%60+'m';
  };
  let signature='';
  function render(data,loading=false) {
    const source=data?.open_positions, wallet=data?.wallet;
    const items=Array.isArray(source?.items)?source.items:null;
    const invalid=!data || data.version!=='paper-read-api-v1' || data.mode!=='paper' ||
      (source?.mode && source.mode!=='paper') || (wallet?.mode && wallet.mode!=='paper') ||
      items?.some(p=>!p || typeof p!=='object' || Array.isArray(p) || (p.mode && p.mode!=='paper'));
    const expiredMarks=Boolean(items?.some(p=>expired(p.mark_expires_at)));
    const key=JSON.stringify([data,loading,expiredMarks,expired(wallet?.valuation_expires_at),Math.floor(Date.now()/60000)]);
    if(signature===key)return;signature=key;
    const state=invalid || !items?'UNAVAILABLE':availability(source)==='AVAILABLE' && expiredMarks?'STALE':availability(source);
    const stateNode=$('home-positions-state');stateNode.textContent=loading?'LOADING':state;stateNode.dataset.state=loading?'LOADING':state;
    $('home-position-count').textContent=state==='UNAVAILABLE'?'Unavailable':String(items.length)+(state==='STALE'?' · historical':'');
    const field=availability(wallet)==='UNAVAILABLE'?'UNAVAILABLE':wallet?.field_availability?.unrealized_pnl || availability(wallet);
    const valuationState=invalid?'UNAVAILABLE':expiredMarks || expired(wallet?.valuation_expires_at)?'STALE':field;
    const pnl=valuationState==='AVAILABLE'?wallet?.unrealized_pnl:null;
    $('home-position-pnl').textContent=money(pnl);tone($('home-position-pnl'),pnl);
    $('home-position-valuation').textContent=valuationState==='STALE'?'STALE · Last known: '+money(wallet?.last_known?.unrealized_pnl):
      valuationState==='AVAILABLE'?'Wallet valuation saved: '+date(wallet?.as_of):'Wallet valuation unavailable.';
    $('home-position-time').textContent='Last updated: '+date(invalid?null:data.served_at)+(state==='STALE'?' · STALE / historical positions':'');
    const list=$('home-position-list');list.replaceChildren();
    if(state==='UNAVAILABLE' || !items.length){
      list.append(el('p',loading?'Loading saved demo positions…':state==='UNAVAILABLE'?'Positions Unavailable':state==='STALE'?'STALE · Last saved snapshot recorded zero positions. Current positions unknown.':'No Open Demo Positions','home-position-empty'));return;
    }
    for(const p of items){
      const fresh=state==='AVAILABLE' && p.availability==='AVAILABLE' && !expired(p.mark_expires_at);
      const card=el('article',undefined,'home-position');
      const head=el('div',undefined,'home-position-identity');
      const symbol=text(p.symbol), base=/^[A-Z0-9]{1,40}$/.test(symbol)?symbol.replace(/USDT$/,''):null;
      const logo=el('span',undefined,'home-position-logo');
      if(base && window.AssetLogo){const asset=window.AssetLogo.create(base,'home-position-image','home-position-monogram',36);logo.append(asset.image,asset.fallback);}
      else logo.append(el('span','?','home-position-monogram'));
      const identity=el('div');identity.append(el('h3',symbol),el('small',text(p.exchange)+' · DEMO'));
      const side=el('span',['LONG','SHORT'].includes(p.side)?p.side:'UNKNOWN','home-position-side');side.dataset.side=side.textContent;
      head.append(logo,identity,side);
      const details=el('dl',undefined,'home-position-fields');
      const add=(label,value,className)=>{const block=el('div',undefined,className);block.append(el('dt',label),el('dd',value));details.append(block);return block;};
      add('Leverage',number(p.leverage)===null?'Unknown':price(p.leverage)+'×');
      add('Entry · USDT',price(p.entry_price));
      const mark=add('Current mark · USDT',fresh?price(p.current_mark):'Unavailable');
      if(!fresh)mark.append(el('small','Last known: '+price(p.last_known_mark)));
      const profit=add('Unrealised P/L',fresh?money(p.unrealized_pnl):'Unavailable','home-position-profit');tone(profit,fresh?p.unrealized_pnl:null);
      if(!fresh)profit.append(el('small','Last known: '+money(p.last_known_unrealized_pnl)));
      const elapsed=add('Time since entry',age(p.entered_at));elapsed.title='Entered: '+date(p.entered_at);
      const updated=el('p',(fresh?'Mark observed: ':'STALE / unavailable mark · Last observed: ')+date(p.mark_observed_at),'home-position-observed');
      card.append(head,details,updated);list.append(card);
    }
  }
  window.HomeDemoPositions=Object.freeze({render});
})();

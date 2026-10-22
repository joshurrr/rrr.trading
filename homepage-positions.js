'use strict';
// Render the homepage's existing V4 snapshot. No additional fetches.
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
  const signedMoney=value=>number(value)===null?'Unavailable':(number(value)>0?'+':'')+money(value);
  const cents=value=>Math.round(value*100);
  function portfolioMetrics(data,loading=false) {
    const total=$('home-total-pnl'),recorded=$('home-realized-pnl'),recordedNote=$('home-realized-pnl-note');
    const wallet=data?.wallet,fields=wallet?.field_availability||{};
    const validSnapshot=data?.version==='paper-read-api-v1' && data?.mode==='paper' && (!wallet?.mode || wallet.mode==='paper');
    const valid=validSnapshot && availability(wallet)!=='UNAVAILABLE' &&
      ['wallet_balance','equity','realized_pnl','unrealized_pnl','entry_fees_paid','exit_fees_paid'].every(key=>fields[key]==='AVAILABLE') &&
      !expired(wallet?.valuation_expires_at);
    const values=valid?['wallet_balance','equity','realized_pnl','unrealized_pnl','entry_fees_paid','exit_fees_paid'].map(key=>number(wallet[key])):[];
    const reconciles=values.length===6 && values.every(value=>value!==null) && values[4]>=0 && values[5]>=0 &&
      Math.abs(values[1]-values[0]-values[3])<=0.0100001;
    // V4's realised/unrealised fields are gross; subtract both recorded fee totals for net account P/L.
    const overall=reconciles?values[2]+values[3]-values[4]-values[5]:null;
    total.textContent=loading&&!data?'Loading…':signedMoney(overall);
    total.dataset.state=overall===null?'unavailable':'available';
    total.dataset.tone=overall===null?'neutral':overall>0?'up':overall<0?'down':'neutral';
    const history=data?.completed_trades,asOf=stamp(history?.as_of),ledgerRealized=number(wallet?.realized_pnl);
    const rows=history?.items;
    let recordedPnl=null;
    const realizedState=availability(wallet)==='UNAVAILABLE'?'UNAVAILABLE':fields.realized_pnl||availability(wallet);
    if(validSnapshot && realizedState==='AVAILABLE' && availability(history)==='AVAILABLE' && asOf!==null && asOf<=Date.now() && Array.isArray(rows) && ledgerRealized!==null) {
      const validRows=rows.every(row=>row && typeof row==='object' && !Array.isArray(row) && stamp(row.closed_at)!==null &&
        stamp(row.closed_at)<=asOf && number(row.realized_pnl)!==null);
      const allTime=validRows?rows.reduce((sum,row)=>sum+number(row.realized_pnl),0):null;
      if(validRows && Math.abs(cents(allTime)-cents(ledgerRealized))<=1) {
        const start=asOf-86400000;
        recordedPnl=rows.filter(row=>stamp(row.closed_at)>start && stamp(row.closed_at)<=asOf)
          .reduce((sum,row)=>sum+number(row.realized_pnl),0);
      }
    }
    recorded.textContent=loading&&!data?'Loading…':signedMoney(recordedPnl);
    recorded.dataset.state=recordedPnl===null?'unavailable':'available';
    recorded.dataset.tone=recordedPnl===null?'neutral':recordedPnl>0?'up':recordedPnl<0?'down':'neutral';
    recordedNote.textContent=recordedPnl===null?'Complete, reconciled V4 trade history unavailable.':'Gross realised P/L · rolling 24h · ledger history reconciled.';
  }
  function walletMetric(data,key,valueId,noteId,loading=false) {
    const wallet=data?.wallet, valid=data?.version==='paper-read-api-v1' && data?.mode==='paper' && (!wallet?.mode || wallet.mode==='paper');
    const expiredValuation=key==='equity' && expired(wallet?.valuation_expires_at);
    const field=valid ? (availability(wallet)==='UNAVAILABLE'?'UNAVAILABLE':wallet?.field_availability?.[key] || availability(wallet)) : 'UNAVAILABLE';
    const state=expiredValuation && field==='AVAILABLE'?'STALE':field;
    const fresh=state==='AVAILABLE', value=fresh?wallet?.[key]:null;
    const target=$(valueId), note=$(noteId);
    target.textContent=loading && !data?'Loading…':money(value);tone(target,key==='realized_pnl'?value:null);
    const label=key==='wallet_balance' || key==='realized_pnl'?'Ledger saved ':'Valuation saved ';
    note.textContent=state==='STALE'?'STALE · Last known: '+money(wallet?.last_known?.[key]):
      fresh?label+date(wallet?.as_of):loading && !data?'Awaiting validated public wallet snapshot.':'Wallet field unavailable in the public snapshot.';
  }
  function renderWallet(data,loading=false) {
    walletMetric(data,'equity','home-equity','home-equity-note',loading);
    walletMetric(data,'wallet_balance','home-wallet-balance','home-wallet-balance-note',loading);
    walletMetric(data,'realized_pnl','home-wallet-realized','home-wallet-realized-note',loading);
  }
  const age=value=>{
    const at=stamp(value);if(at===null || at>Date.now())return 'Unavailable';
    const minutes=Math.floor((Date.now()-at)/60000);
    return minutes<1?'Under 1m':minutes<60?minutes+'m':Math.floor(minutes/60)+'h '+minutes%60+'m';
  };
  let signature='';
  function render(data,loading=false) {
    const source=data?.open_positions, wallet=data?.wallet;
    renderWallet(data,loading);
    portfolioMetrics(data,loading);
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
      const protection=p.protection || {};
      const knownStatus=['PROTECTED','ORIGINAL STOP'].includes(protection.status)?protection.status:'UNKNOWN';
      const summary=el('div',undefined,'home-position-protection');
      const status=el('span',knownStatus,'home-protection-status');status.dataset.status=knownStatus;
      const decision=['HOLD','PROTECT','EXIT'].includes(protection.latest_decision)?protection.latest_decision:'UNKNOWN';
      const outcome={STOP_ADJUSTED:'applied',RECOMMENDATION_ONLY:'recommendation only',BLOCKED:'proposal rejected',
        NOT_REQUESTED:'no adjustment requested',EXECUTED:'executed'}[protection.review_result] || 'result UNKNOWN';
      const stop=value=>number(value)===null?'UNKNOWN':price(value);
      summary.append(status,el('span',`Luna ${decision} · ${outcome}`),el('span','Active stop · '+stop(protection.active_stop)));
      const extra=el('details',undefined,'home-protection-details');extra.append(el('summary','Position protection'));
      const values=el('dl',undefined,'home-protection-fields');
      const field=(label,value)=>{const block=el('div');block.append(el('dt',label),el('dd',value));values.append(block);};
      field('Original approved stop · USDT',stop(protection.original_stop));
      field('Estimated P/L at active stop',number(protection.estimated_stop_pnl_usdt)===null?'UNKNOWN':money(protection.estimated_stop_pnl_usdt));
      field('Last successful review',stamp(protection.last_successful_review_at)===null?'UNKNOWN':date(protection.last_successful_review_at));
      extra.append(values,el('p','Estimate before fees and slippage. A stop does not guarantee an execution price.','home-protection-note'));
      card.append(head,details,summary,extra,updated);list.append(card);
    }
  }
  window.HomeDemoPositions=Object.freeze({render});
})();

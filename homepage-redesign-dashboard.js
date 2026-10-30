'use strict';
// Compact observations from the existing position snapshot. No additional requests or polling.
(() => {
  const $=id=>document.getElementById(id),host=$('home-market-cards');
  if(!host)return;
  const num=v=>(typeof v==='number'||typeof v==='string'&&v.trim()&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim()))&&Number.isFinite(Number(v))?Number(v):null;
  const stamp=v=>typeof v==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
  const date=v=>stamp(v)===null?'unavailable':new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(v))+' AEST';
  const fmt=(v,d=2)=>new Intl.NumberFormat('en-AU',{maximumFractionDigits:d}).format(v);
  const pct=v=>num(v)===null?'Change unavailable':(num(v)>0?'+':'')+fmt(num(v))+'%';
  const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  let signature='';
  function viewState(v,retained){
    const source=stamp(v?.source_at),observed=stamp(v?.observed_at),expires=stamp(v?.expires_at);
    if(!v||!['CURRENT','STALE'].includes(v.state)||source===null||observed===null||expires===null||source>observed||observed>Date.now()+30000||expires<=source)return 'UNAVAILABLE';
    return retained||v.state==='STALE'||Date.now()>=expires?'STALE':'CURRENT';
  }
  function render(detail){
    const data=detail?.data,valid=data?.version==='paper-read-api-v1'&&data.mode==='paper';
    const overview=valid?data.overview||{}:{},retained=detail?.diagnostics?.display==='RETAINED';
    const rows=[];
    const add=(label,value,note,state,source)=>rows.push({label,value,note:state==='STALE'?'STALE · '+note:note,state,source});
    for(const symbol of ['BTC','ETH']){
      const item=valid?data.market_prices?.[symbol+'USDT']:null;
      const price=num(item?.price),change=num(item?.change_24h_pct),source=stamp(item?.source_at),observed=stamp(item?.observed_at),expires=stamp(item?.expires_at);
      const ok=item?.symbol===symbol+'USDT'&&item.source==='bybit'&&item.availability==='AVAILABLE'&&price!==null&&price>0&&change!==null&&change>-100&&source!==null&&observed!==null&&expires!==null&&source<=observed&&observed<=Date.now()&&expires>source&&Date.now()<expires;
      add(symbol,ok?'$'+fmt(price,price<1?8:2):'Unavailable',ok?pct(change)+' \u00b7 24h':'\u2014',ok?retained?'STALE':'CURRENT':'UNAVAILABLE',item?.source_at);
    }
    const breadth=overview.breadth,b=breadth?.values||{},bs=viewState(breadth,retained),up=num(b.rising_24h_pct),down=num(b.falling_24h_pct);
    const breadthOK=bs!=='UNAVAILABLE'&&['AVAILABLE','PARTIAL'].includes(breadth?.health)&&up!==null&&down!==null&&up>=0&&down>=0&&up+down<=100&&Number.isInteger(b.assets_included)&&b.assets_included>0;
    add('Crypto Breadth',breadthOK?fmt(up)+'% ↑ / '+fmt(down)+'% ↓':'Unavailable',breadthOK?'24h'+(breadth.health==='PARTIAL'?' · Partial coverage':''):'—',breadthOK?bs:'UNAVAILABLE',breadth?.source_at);
    const indexes=overview.cash_indexes||{};
    const index=[['NASDAQ100','Nasdaq-100'],['SP500','S&P 500']].map(([key,label])=>({label,item:indexes[key]})).filter(({item})=>item?.session_context==='DAILY_CASH_INDEX_CLOSE_NOT_LIVE_OR_FUTURES'&&num(item.value)>0&&viewState(item,retained)!=='UNAVAILABLE').sort((a,b)=>(viewState(a.item,retained)==='CURRENT'?0:1)-(viewState(b.item,retained)==='CURRENT'?0:1))[0];
    add(index?'US · '+index.label:'US Equities',index?fmt(num(index.item.value)):'Unavailable',index?pct(index.item.change_1d_pct)+' · last close':'—',index?viewState(index.item,retained):'UNAVAILABLE',index?.item.source_at);
    const fear=overview.fear_greed,f=fear?.values||{},fs=viewState(fear,retained),value=num(f.value),fearOK=fs!=='UNAVAILABLE'&&value!==null&&value>=0&&value<=100;
    const sentiment=['Extreme Fear','Fear','Neutral','Greed','Extreme Greed'].includes(f.classification)?f.classification:'Sentiment unavailable';
    add('Fear & Greed',fearOK?fmt(value,0)+' / 100':'Unavailable',fearOK?sentiment:'—',fearOK?fs:'UNAVAILABLE',fear?.source_at);
    const updated=valid?'Snapshot · '+date(data.served_at):'Snapshot unavailable',key=JSON.stringify([rows,updated]);
    if(key===signature)return;signature=key;
    host.replaceChildren(...rows.map(row=>{const card=node('article');card.className='home-market-card';card.dataset.state=row.state;card.title=row.state+' · Source: '+date(row.source);card.append(node('h3',row.label),node('strong',row.value),node('small',row.note));return card;}));
    $('home-market-updated').textContent=updated;
  }
  function setHeaderStatus(text){const headerDocument=window.parent!==window&&document.referrer.startsWith(location.origin+'/')&&window.parent.SiteNavigation?window.parent.document:document;const label=headerDocument.querySelector('.header-target-label');for(const selector of ['#header-assets','.header-commentary']){const obsolete=headerDocument.querySelector(selector);if(obsolete){obsolete.hidden=true;obsolete.style.display='none';}}if(label)label.textContent='TRADING STATUS:';let headerStatus=headerDocument.getElementById('header-system-status');if(!headerStatus){headerStatus=node('span');headerStatus.id='header-system-status';headerDocument.querySelector('.header-targets')?.append(headerStatus);}headerStatus.textContent=text;}
  window.addEventListener('rrr-v4-home-position-snapshot',event=>render(event.detail));
  setHeaderStatus('PAPER MODE · SAVED V4 OBSERVATIONS');
  render(null);
})();

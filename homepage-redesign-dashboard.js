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
  const expressions=[
    {key:'extreme-fear',label:'Extreme Fear',brows:'M32 35 Q39 25 46 28 M58 28 Q65 25 72 35',eye:8,mouth:'M41 66 C41 47 63 47 63 66 C63 78 41 78 41 66Z'},
    {key:'fear',label:'Fear',brows:'M31 38 Q40 37 46 29 M58 29 Q64 37 73 38',eye:7,mouth:'M39 68 Q52 53 65 68 Q52 61 39 68Z'},
    {key:'neutral',label:'Neutral',brows:'M32 33 Q39 31 46 33 M58 33 Q65 31 72 33',eye:5.5,mouth:'M40 65 Q52 65 64 65 Q52 67 40 65Z'},
    {key:'greed',label:'Greed',brows:'M32 33 Q39 28 46 33 M58 33 Q65 28 72 33',eye:6,mouth:'M37 60 Q52 67 67 60 C64 78 40 78 37 60Z'},
    {key:'extreme-greed',label:'Extreme Greed',brows:'M31 31 Q39 23 47 30 M57 30 Q65 23 73 31',eye:4.5,mouth:'M33 57 Q52 63 71 57 C68 83 36 83 33 57Z'}
  ];
  // Built once: cross-fades and blink timing survive shared snapshot refreshes.
  function fearVisual(){
    const svg=(tag,attrs={},parent)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(parent)parent.append(n);return n;};
    const face=svg('svg',{viewBox:'0 0 104 100',class:'home-fear-visual','aria-hidden':'true',focusable:'false'});
    const defs=svg('defs',{},face);
    const body=svg('radialGradient',{id:'home-fear-body',cx:'.32',cy:'.22',r:'.8'},defs);
    for(const [offset,cls] of [['0','shine'],['.48','colour'],['1','shade']])svg('stop',{offset,class:'home-fear-'+cls},body);
    const gloss=svg('radialGradient',{id:'home-fear-gloss',cx:'.35',cy:'.15',r:'.75'},defs);
    svg('stop',{offset:'0','stop-color':'#fff','stop-opacity':'.85'},gloss);svg('stop',{offset:'1','stop-color':'#fff','stop-opacity':'0'},gloss);
    const eye=svg('radialGradient',{id:'home-fear-eye',cx:'.35',cy:'.25',r:'.9'},defs);
    svg('stop',{offset:'0','stop-color':'#fff'},eye);svg('stop',{offset:'1','stop-color':'#acb9c9'},eye);
    const gauge=svg('g',{class:'home-fear-gauge',fill:'none','stroke-width':'5'},face),segments=[];
    const point=angle=>[52+46*Math.cos(angle),53-46*Math.sin(angle)].map(n=>n.toFixed(3)).join(' ');
    for(let i=0;i<20;i++){
      const start=Math.PI*(1-i/20)-.018,end=Math.PI*(1-(i+1)/20)+.018;
      segments.push(svg('path',{d:'M'+point(start)+' A46 46 0 0 1 '+point(end),pathLength:'1',class:'home-fear-segment'},gauge));
      segments.push(svg('path',{d:'M'+point(start)+' A46 46 0 0 1 '+point(end),pathLength:'1',class:'home-fear-fill','stroke-dasharray':'1','stroke-dashoffset':'1'},gauge));
    }
    svg('ellipse',{cx:'52',cy:'94',rx:'24',ry:'3',class:'home-fear-shadow'},face);
    const orb=svg('g',{class:'home-fear-orb'},face);
    svg('circle',{cx:'52',cy:'55',r:'34',fill:'url(#home-fear-body)',class:'home-fear-rim'},orb);
    svg('ellipse',{cx:'42',cy:'32',rx:'21',ry:'9',transform:'rotate(-24 42 32)',fill:'url(#home-fear-gloss)'},orb);
    const groups=expressions.map(expression=>{
      const group=svg('g',{class:'home-fear-expression','data-expression':expression.key},orb);
      svg('path',{d:expression.brows,fill:'none',stroke:'#211a23','stroke-width':'4','stroke-linecap':'round'},group);
      const eyes=svg('g',{class:'home-fear-eyes'},group);
      for(const cx of [39,65]){
        svg('ellipse',{cx,cy:'46',rx:'8',ry:expression.eye,fill:'url(#home-fear-eye)',stroke:'#36212a','stroke-width':'.7'},eyes);
        svg('ellipse',{cx,cy:'46',rx:'3.6',ry:Math.min(4.8,expression.eye-1),fill:'#13131b'},eyes);
        svg('circle',{cx:cx-1,cy:'44',r:'1.3',fill:'#fff'},eyes);
      }
      svg('path',{d:expression.mouth,fill:'#27131d',stroke:'#431c24','stroke-width':'1.4','stroke-linejoin':'round'},group);
      if(['greed','extreme-greed'].includes(expression.key))svg('path',{d:expression.key==='greed'?'M40 62 Q52 67 64 62 L62 66 Q52 70 42 66Z':'M36 59 Q52 64 68 59 L65 65 Q52 70 39 65Z',fill:'#fff6ed'},group);
      if(expression.key==='extreme-fear')svg('ellipse',{cx:'52',cy:'70',rx:'7',ry:'3',fill:'#c84860'},group);
      return group;
    });
    return {face,update(value){
      const expression=value===null?expressions[2]:expressions[value<25?0:value<45?1:value<55?2:value<75?3:4];
      face.setAttribute('data-sentiment',value===null?'unavailable':expression.key);
      groups.forEach((group,i)=>group.setAttribute('data-active',String(expressions[i]===expression)));
      // Fractional final segment keeps 0 and 100 exact; no implied reading when unavailable.
      segments.forEach((segment,i)=>{if(i%2)segment.setAttribute('stroke-dashoffset',String(value===null?1:1-Math.max(0,Math.min(1,value/5-Math.floor(i/2)))));});
    }};
  }
  const fearFace=fearVisual(),cardNodes=[];
  let signature='';
  const prices=new Map(); // Last validated observations, page memory only.
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
      const ok=item?.symbol===symbol+'USDT'&&item.source==='bybit'&&item.availability==='AVAILABLE'&&price!==null&&price>0&&change!==null&&change>-100&&source!==null&&observed!==null&&expires!==null&&source<=observed&&observed<=Date.now()&&expires>source;
      const previous=prices.get(symbol);
      if(ok && (!previous || source>stamp(previous.source_at) && observed>=stamp(previous.observed_at)))prices.set(symbol,{...item});
      const saved=prices.get(symbol),stale=retained||!ok||saved!==undefined&&(Date.now()>=stamp(saved.expires_at)||saved.source_at!==item?.source_at);
      add(symbol,saved?'$'+fmt(num(saved.price),num(saved.price)<1?8:2):'Unavailable',saved?pct(saved.change_24h_pct)+' · 24h · Source: '+date(saved.source_at)+' · Expires: '+date(saved.expires_at):'—',saved?stale?'STALE':'CURRENT':'UNAVAILABLE',saved?.source_at);
    }
    const breadth=overview.breadth,b=breadth?.values||{},bs=viewState(breadth,retained),up=num(b.rising_24h_pct),down=num(b.falling_24h_pct);
    const breadthOK=bs!=='UNAVAILABLE'&&['AVAILABLE','PARTIAL'].includes(breadth?.health)&&up!==null&&down!==null&&up>=0&&down>=0&&up+down<=100&&Number.isInteger(b.assets_included)&&b.assets_included>0;
    add('Crypto Breadth',breadthOK?fmt(up)+'% ↑ / '+fmt(down)+'% ↓':'Unavailable',breadthOK?'24h'+(breadth.health==='PARTIAL'?' · Partial coverage':''):'—',breadthOK?bs:'UNAVAILABLE',breadth?.source_at);
    const indexes=overview.cash_indexes||{};
    const index=[['NASDAQ100','Nasdaq-100'],['SP500','S&P 500']].map(([key,label])=>({label,item:indexes[key]})).filter(({item})=>item?.session_context==='DAILY_CASH_INDEX_CLOSE_NOT_LIVE_OR_FUTURES'&&num(item.value)>0&&viewState(item,retained)!=='UNAVAILABLE').sort((a,b)=>(viewState(a.item,retained)==='CURRENT'?0:1)-(viewState(b.item,retained)==='CURRENT'?0:1))[0];
    add(index?'US · '+index.label:'US Equities',index?fmt(num(index.item.value)):'Unavailable',index?pct(index.item.change_1d_pct)+' · last close':'—',index?viewState(index.item,retained):'UNAVAILABLE',index?.item.source_at);
    const fear=overview.fear_greed,f=fear?.values||{},fs=viewState(fear,retained),value=num(f.value),fearOK=fs!=='UNAVAILABLE'&&value!==null&&value>=0&&value<=100;
    const currentFear=fearOK&&fs==='CURRENT';
    const sentiment=fearOK&&expressions.some(item=>item.label===f.classification)?f.classification:'Classification unavailable';
    add('Fear & Greed',fearOK?fmt(value,0)+' / 100':'Unavailable',fearOK?sentiment+' · '+fs+' · Reading: '+date(fear.source_at):sentiment,fearOK?fs:'UNAVAILABLE',fear?.source_at);
    const updated=valid?'Snapshot · '+date(data.served_at):'Snapshot unavailable',key=JSON.stringify([rows,updated,currentFear?value:null]);
    if(key===signature)return;signature=key;
    if(!cardNodes.length){
      rows.forEach((row,i)=>{const card=node('article');card.className='home-market-card';card.append(node('h3'),node('strong'),node('small'));if(i===4){card.className+=' home-fear-card';card.append(fearFace.face);}cardNodes.push(card);});
      host.replaceChildren(...cardNodes);
    }
    rows.forEach((row,i)=>{const card=cardNodes[i];card.dataset.state=row.state;card.title=row.state+' · Source: '+date(row.source);[row.label,row.value,row.note].forEach((text,j)=>card.children[j].textContent=text);});
    fearFace.update(currentFear?value:null);
    $('home-market-updated').textContent=updated;
  }
  function setHeaderStatus(text){const headerDocument=window.parent!==window&&document.referrer.startsWith(location.origin+'/')&&window.parent.SiteNavigation?window.parent.document:document;const label=headerDocument.querySelector('.header-target-label');for(const selector of ['#header-assets','.header-commentary']){const obsolete=headerDocument.querySelector(selector);if(obsolete){obsolete.hidden=true;obsolete.style.display='none';}}if(label)label.textContent='TRADING STATUS:';let headerStatus=headerDocument.getElementById('header-system-status');if(!headerStatus){headerStatus=node('span');headerStatus.id='header-system-status';headerDocument.querySelector('.header-targets')?.append(headerStatus);}headerStatus.textContent=text;}
  window.addEventListener('rrr-v4-home-position-snapshot',event=>render(event.detail));
  setHeaderStatus('PAPER MODE · SAVED V4 OBSERVATIONS');
  render(null);
})();

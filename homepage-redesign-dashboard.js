'use strict';
// Market indicators and breadth use only the existing V4 homepage snapshot.
(() => {
  const $=id=>document.getElementById(id),host=$('home-market-cards');
  if(!host)return;
  const num=v=>(typeof v==='number'||typeof v==='string'&&v.trim()&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim()))&&Number.isFinite(Number(v))?Number(v):null;
  const stamp=v=>typeof v==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
  const date=v=>stamp(v)===null?'unavailable':new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(v))+' AEST';
  const fmt=(v,d=2)=>new Intl.NumberFormat('en-AU',{maximumFractionDigits:d}).format(v);
  const pct=v=>num(v)===null?'Change unavailable':(num(v)>0?'+':'')+fmt(num(v))+'%';
  const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const svgNode=(tag,attrs,parent)=>{
    const element=document.createElementNS('http://www.w3.org/2000/svg',tag);
    for(const [key,value] of Object.entries(attrs))element.setAttribute(key,value);
    if(parent)parent.append(element);
    return element;
  };
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
  const pulse=$('home-market-pulse');
  // Keep a reference when the header adopts the timestamp into the parent document.
  const timestampNode=$('home-market-updated');
  const timeframes=[['5m','5 Min'],['15m','15 Min'],['1h','1 Hour'],['4h','4 Hour']];
  let signature='';
  const prices=new Map(); // Last validated observations, page memory only.
  function viewState(v,now){
    const source=stamp(v?.source_at),observed=stamp(v?.observed_at),expires=stamp(v?.expires_at);
    if(!v||!['CURRENT','STALE'].includes(v.state)||source===null||observed===null||expires===null||source>observed||observed>now+30000||expires<=source)return 'UNAVAILABLE';
    return v.state==='STALE'||now>=expires?'STALE':'CURRENT';
  }
  function readTimeframes(intraday,now){
    const tracked=intraday?.tracked;
    const current=viewState(intraday&&{...intraday,state:'CURRENT'},now)==='CURRENT';
    return timeframes.map(([key,label])=>{
      const frame=current?intraday.frames?.[key]:null;
      const up=num(frame?.up_pct),down=num(frame?.down_pct),covered=frame?.covered;
      if(!Number.isInteger(tracked)||!Number.isInteger(covered)||covered<1||covered>tracked||
        up===null||down===null||up<0||down<0||up>100||down>100||up+down>100*covered/tracked+.01001){
        return {label};
      }
      // Both API percentages use the tracked pool, including assets without a reading.
      const missing=(tracked-covered)/tracked*100;
      const advancing=Math.round(up*tracked/100),declining=Math.round(down*tracked/100);
      const neutral=Math.max(0,covered-advancing-declining)/tracked*100;
      const tone=up>down?'positive':up<down?'negative':'neutral';
      return {label,up,down,neutral,missing,tracked,covered,tone,source:intraday.source_at};
    });
  }
  // A lead of 10 percentage points is directional. A strong 5m reading
  // requires a 60% share of the tracked pool and a lead of at least 25 points.
  function breadthDirection({up,down}){
    const lead=Math.round((up-down)*100)/100;
    return lead>=10?'positive':lead<=-10?'negative':'neutral';
  }
  function breadthCondition(daily,frames){
    if(!daily&&frames.every(frame=>!frame.tone)){
      return ['neutral','Breadth unavailable','Waiting for current breadth readings.'];
    }
    if(daily?.state!=='CURRENT'||daily.partial||frames.some(frame=>!frame.tone||frame.covered!==frame.tracked)){
      return ['neutral','Limited breadth coverage','Full alignment requires current readings with complete coverage.'];
    }
    const [five,...higher]=[...frames,daily].map(breadthDirection);
    const {up,down}=frames[0];
    const lead=Math.round((up-down)*100)/100;
    if(up>=60&&lead>=25&&higher.every(tone=>tone==='negative')){
      return ['mixed','Short-term bullish divergence','5m breadth is strongly bullish while higher timeframes remain bearish.','positive'];
    }
    if(down>=60&&lead<=-25&&higher.every(tone=>tone==='positive')){
      return ['mixed','Short-term bearish divergence','5m breadth is strongly bearish while higher timeframes remain bullish.','negative'];
    }
    if(higher.every(tone=>tone===five)){
      if(five==='positive')return ['positive','Bullish alignment','Advancers lead across all four timeframes and the 24h reading.'];
      if(five==='negative')return ['negative','Bearish alignment','Decliners lead across all four timeframes and the 24h reading.'];
      return ['neutral','Neutral','Advancing and declining shares are within 10 points across all readings.'];
    }
    return ['mixed','Mixed breadth','The current readings differ across timeframes without clear alignment.'];
  }
  function renderTimeframe(frame){
    const {label,up,down,neutral,missing,covered,tracked,tone,source}=frame;
    const card=node('article');
    card.className='home-pulse-frame';
    card.dataset.tone=tone||'neutral';
    const header=node('div');
    header.className='home-pulse-frame-heading';
    const title=node('h4',label);
    const clock=svgNode('svg',{viewBox:'0 0 20 20',width:16,height:16,'aria-hidden':'true'});
    svgNode('circle',{cx:10,cy:10,r:8,fill:'none',stroke:'currentColor','stroke-width':1.8},clock);
    svgNode('path',{d:'M10 5v5l3 2',fill:'none',stroke:'currentColor','stroke-width':1.8,'stroke-linecap':'round'},clock);
    title.prepend(clock);
    header.append(title);
    card.append(header);
    if(!tone){
      card.append(node('p','Breadth unavailable'));
      return card;
    }
    const badge=node('span',fmt(up)+'% / '+fmt(down)+'%');
    badge.className='home-pulse-badge';
    badge.setAttribute('aria-label',fmt(up)+'% advancing, '+fmt(down)+'% declining');
    header.append(badge);
    const bar=node('div');
    bar.className='home-pulse-bar';
    bar.setAttribute('aria-hidden','true');
    for(const [kind,value] of [['up',up],['neutral',neutral],['down',down],['missing',missing]]){
      const segment=node('span');
      segment.dataset.kind=kind;
      segment.style.flexBasis=value+'%';
      bar.append(segment);
    }
    const condition=node('strong',tone==='positive'?'Advancers lead':tone==='negative'?'Decliners lead':'Balanced');
    card.title='Covered / tracked Bybit research pool · '+covered+'/'+tracked+' · Closed '+date(source);
    card.append(bar,condition);
    if(missing>0)card.append(node('small',covered+'/'+tracked+' covered'));
    return card;
  }
  function renderPulse(daily,frames){
    const total=$('home-pulse-daily'),coverage=$('home-pulse-coverage');
    total.textContent='Unavailable';
    coverage.hidden=!daily||daily.state==='CURRENT'&&!daily.partial;
    if(daily){
      const up=node('span',fmt(daily.up)+'% Bullish'),down=node('span',fmt(daily.down)+'% Bearish');
      up.className='home-breadth-up';
      down.className='home-breadth-down';
      total.replaceChildren(up,document.createTextNode(' / '),down);
      total.title='Source · '+date(daily.source);
      coverage.textContent=[daily.state==='STALE'?'Stale':'',daily.partial?'Partial coverage':''].filter(Boolean).join(' · ');
    }else total.removeAttribute('title');
    const [tone,title,note,divergence]=breadthCondition(daily,frames);
    $('home-pulse-condition').dataset.tone=tone;
    $('home-pulse-condition-title').textContent=title;
    $('home-pulse-condition-note').textContent=note;
    $('home-pulse-frames').replaceChildren(...frames.map(renderTimeframe));
    const summaries=divergence?[
      ['5m',[frames[0]]],
      ['15m / 1h',frames.slice(1,3)],
      ['4h / 24h',[frames[3],daily]]
    ]:[
      ['5m / 15m',frames.slice(0,2)],
      ['1h',[frames[2]]],
      ['4h',[frames[3]]]
    ];
    $('home-pulse-summary').replaceChildren(...summaries.map(([label,group])=>{
      const tones=group.map(frame=>frame.up===undefined?undefined:breadthDirection(frame));
      const direction=tones.every(value=>value===tones[0])?tones[0]:'mixed';
      const text=tones.includes(undefined)?'reading unavailable':{
        positive:'advancers lead',negative:'decliners lead',neutral:'near balance',mixed:'mixed direction'
      }[direction];
      const item=node('li',label+' · '+(divergence&&label==='5m'
        ? divergence==='positive'?'strongly bullish':'strongly bearish'
        : text));
      item.dataset.tone=tones.includes(undefined)?'neutral':direction;
      if(group.some(frame=>frame.covered<frame.tracked))item.append(' (partial coverage)');
      return item;
    }));
  }
  function sparklinePoints(history,symbol,now){
    if(history?.symbol!==symbol+'USDT'||history.source!=='bybit'||history.state!=='CURRENT'||
      history.interval_seconds!==900)return null;
    const end=stamp(history.source_at),expires=stamp(history.expires_at);
    if(end===null||end>now||end%900000!==0||expires===null||expires<=now||expires<=end)return null;
    const points=history.points;
    if(!Array.isArray(points)||points.length!==96)return null;
    return points.every((point,index)=>Array.isArray(point)&&point.length===2&&
      point[0]===(end/1000)-(95-index)*900&&Number.isFinite(point[1])&&point[1]>0)?points:null;
  }
  function renderSparkline(target,row){
    target.hidden=!row.history;
    if(!row.history){
      target.replaceChildren();
      return;
    }
    const prices=row.history.map(point=>point[1]);
    const low=Math.min(...prices),high=Math.max(...prices);
    const line=prices.map((price,index)=>{
      const x=2+116*index/(prices.length-1);
      const y=high===low?24:44-40*(price-low)/(high-low);
      return (index?'L':'M')+x.toFixed(2)+' '+y.toFixed(2);
    }).join(' ');
    const svg=svgNode('svg',{viewBox:'0 0 120 48',width:120,height:48,role:'img',
      'aria-label':row.label+' 24-hour closing prices'});
    const id='home-sparkline-fill-'+row.label.toLowerCase();
    const gradient=svgNode('linearGradient',{id,x2:'0%',y2:'100%'},svgNode('defs',{},svg));
    svgNode('stop',{offset:'0%','stop-color':'currentColor','stop-opacity':'.26'},gradient);
    svgNode('stop',{offset:'100%','stop-color':'currentColor','stop-opacity':'0'},gradient);
    svgNode('path',{d:line+' L118 48 H2 Z',fill:'url(#'+id+')'},svg);
    svgNode('path',{d:line,fill:'none',stroke:'currentColor','stroke-width':1.5,
      'stroke-linejoin':'round','vector-effect':'non-scaling-stroke'},svg);
    target.replaceChildren(svg);
  }
  function render(detail){
    const data=detail?.data,valid=data?.version==='paper-read-api-v1'&&data.mode==='paper';
    const overview=valid?data.overview||{}:{},retained=detail?.diagnostics?.display==='RETAINED',now=detail?.diagnostics?.estimated_server_time_ms??Date.now();
    const rows=[];
    const add=(label,value,note,state,source)=>rows.push({label,value,note:state==='STALE'?'STALE · '+note:note,state,source});
    for(const symbol of ['BTC','ETH']){
      const item=valid?data.market_prices?.[symbol+'USDT']:null;
      const price=num(item?.price),change=num(item?.change_24h_pct),source=stamp(item?.source_at),observed=stamp(item?.observed_at),expires=stamp(item?.expires_at);
      const ok=item?.symbol===symbol+'USDT'&&item.source==='bybit'&&item.availability==='AVAILABLE'&&price!==null&&price>0&&change!==null&&change>-100&&source!==null&&observed!==null&&expires!==null&&source<=observed&&observed<=now&&expires>source;
      const previous=prices.get(symbol);
      if(ok && (!previous || source>stamp(previous.source_at) && observed>=stamp(previous.observed_at)))prices.set(symbol,{...item});
      const saved=prices.get(symbol),stale=!ok||saved!==undefined&&(now>=stamp(saved.expires_at)||saved.source_at!==item?.source_at);
      add(symbol,saved?'$'+fmt(Math.round(num(saved.price)),0):'Unavailable',saved?pct(saved.change_24h_pct)+' · 24h · Source: '+date(saved.source_at)+' · Expires: '+date(saved.expires_at):'—',saved?stale?'STALE':'CURRENT':'UNAVAILABLE',saved?.source_at);
      const move=saved?num(saved.change_24h_pct):null;
      Object.assign(rows[rows.length-1],{note:move===null?'Change unavailable':(stale?'STALE · ':'')+(move>0?'\u25b2 ':move<0?'\u25bc ':'')+pct(move)+' · 24h',tone:move>0?'positive':move<0?'negative':'neutral'});
      rows[rows.length-1].history=saved&&!stale?sparklinePoints(data.market_price_history?.[symbol+'USDT'],symbol,now):null;
    }
    const breadth=overview.breadth,b=breadth?.values||{},bs=viewState(breadth,now),up=num(b.rising_24h_pct),down=num(b.falling_24h_pct);
    const breadthOK=bs!=='UNAVAILABLE'&&['AVAILABLE','PARTIAL'].includes(breadth?.health)&&up!==null&&down!==null&&up>=0&&down>=0&&up+down<=100&&Number.isInteger(b.assets_included)&&b.assets_included>0;
    const daily=breadthOK?{up,down,state:bs,partial:breadth.health==='PARTIAL',source:breadth.source_at}:null;
    const intraday=readTimeframes(overview.crypto_breadth,now);
    const nq=overview.nasdaq;
    const usable=nq?.source==='BYBIT'&&nq.instrument==='QQQUSDT'&&nq.quote_currency==='USDT'&&viewState(nq,now)!=='UNAVAILABLE'&&num(nq.value)>0;
    const current=usable&&viewState(nq,now)==='CURRENT';
    const frames=['15m','1h'].map(tf=>{
      const f=nq?.frames?.[tf],move=num(f?.return_pct);
      const known=current&&f?.state==='AVAILABLE'&&move!==null&&f.direction===(move>0?'RISING':move<0?'FALLING':'SIDEWAYS');
      return {tf,move:known?move:null,tone:known&&move>0?'positive':known&&move<0?'negative':'neutral'};
    });
    const momentum=frames[0].move===null?'Momentum unavailable':nq.potential_reversal===true||nq.momentum==='DIRECTION_CHANGED'?'Reversing':({STRENGTHENING:'Strengthening',WEAKENING:'Weakening',UNCHANGED:'Momentum unchanged'})[nq.momentum]||'Momentum unavailable';
    add('QQQUSDT · ETF perp',usable?new Intl.NumberFormat('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(num(nq.value))+' USDT':'Unavailable','',''+(usable?current?'CURRENT':'STALE':'UNAVAILABLE'),nq?.source_at);
    rows[rows.length-1].nasdaq={frames,momentum,expires:nq?.expires_at,warning:'Bybit Nasdaq-100 ETF-linked perpetual; supporting market context.',current,age:usable?Math.max(0,Math.floor((now-stamp(nq.source_at))/60000)):null};
    const fear=overview.fear_greed,f=fear?.values||{},fs=viewState(fear,now),value=num(f.value),fearOK=fs!=='UNAVAILABLE'&&value!==null&&value>=0&&value<=100;
    const currentFear=fearOK&&fs==='CURRENT';
    const sentiment=fearOK&&expressions.some(item=>item.label===f.classification)?f.classification:'Classification unavailable';
    add('Fear & Greed',fearOK?fmt(value,0)+' / 100':'Unavailable',sentiment,fearOK?fs:'UNAVAILABLE',fear?.source_at);
    rows[rows.length-1].note=sentiment;
    const updated=valid&&stamp(data.served_at)!==null?date(data.served_at):'Date and time unavailable';
    const key=JSON.stringify([rows,updated,retained,currentFear?value:null,daily,intraday]);
    if(key===signature)return;signature=key;
    if(!cardNodes.length){
      rows.forEach((row,i)=>{const card=node('article');card.className='home-market-card';card.append(node('h3'),node('strong'),node('small'));if(i<2){
        card.className+=' home-coin-card';
        card.dataset.symbol=i===0?'BTC':'ETH';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',row.label+' price and asset analysis');
        const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 64 64');icon.setAttribute('class','home-coin-icon');icon.setAttribute('width','28');icon.setAttribute('height','28');icon.setAttribute('aria-hidden','true');
        icon.innerHTML=i===0?'<circle cx="32" cy="32" r="32" fill="#f7931a"/><path fill="#fff" transform="scale(2)" d="M23.189 14.02c.314-2.095-1.282-3.22-3.463-3.972l.707-2.835-1.726-.43-.689 2.76c-.454-.114-.92-.22-1.385-.326l.694-2.778-1.725-.43-.707 2.834c-.377-.086-.747-.17-1.106-.26l.002-.008-2.38-.594-.46 1.843s1.282.294 1.255.312c.7.175.826.638.805 1.006l-.805 3.23.18.057-.183-.046-1.129 4.525c-.085.212-.303.531-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.975 2.246.56c.418.105.828.215 1.231.318l-.714 2.867 1.724.43.708-2.837c.471.128.928.246 1.375.357l-.705 2.824 1.726.43.714-2.862c2.944.557 5.158.332 6.09-2.33.752-2.143-.037-3.38-1.588-4.188 1.13-.26 1.98-1.003 2.207-2.54zm-3.944 5.53c-.534 2.143-4.143.985-5.313.694l.949-3.8c1.17.292 4.922.87 4.364 3.106zm.534-5.56c-.486 1.95-3.49.96-4.465.717l.86-3.447c.975.243 4.111.696 3.605 2.73z"/>':'<circle cx="32" cy="32" r="32" fill="#627eea"/><path fill="#fff" d="M32 8 17 33l15 8 15-8zM17 36l15 20 15-20-15 9z"/><path fill="#b4bdf5" d="M32 8v33l15-8zM32 45v11l15-20z"/><path fill="#858fc9" d="m17 33 15 8V26z"/>';
        const chart=node('div');chart.className='home-coin-sparkline';chart.hidden=true;
        card.append(icon,chart);
      }else if(i===2){
        const icon=svgNode('svg',{viewBox:'0 0 40 40',width:40,height:40,class:'home-market-icon','aria-hidden':'true'},card);
        svgNode('circle',{cx:20,cy:20,r:20,fill:'#173747'},icon);
        svgNode('path',{d:'M11 27V18M20 27V12',stroke:'#39ee91','stroke-width':4,'stroke-linecap':'round'},icon);
        svgNode('path',{d:'M29 27V21',stroke:'#ff596b','stroke-width':4,'stroke-linecap':'round'},icon);
      }else{
        card.className+=' home-fear-card';
        card.append(fearFace.face);
      }
      cardNodes.push(card);});
      host.replaceChildren(...cardNodes);
    }
    rows.forEach((row,i)=>{
      const card=cardNodes[i];
      card.dataset.state=row.state;
      card.title=row.state+' · Source: '+date(row.source);
      if(i<2){
        card.dataset.tone=row.tone;
        renderSparkline(card.children[4],row);
      }
      [row.label,row.value,row.note].forEach((text,j)=>card.children[j].textContent=text);
    });
    const nasdaqCard=cardNodes[2],nqRow=rows[2].nasdaq;
    nasdaqCard.dataset.nasdaqMode='perpetual';
    nasdaqCard.querySelector('.home-nasdaq-footer')?.remove();
    if(nqRow){
      nasdaqCard.children[2].replaceChildren(...nqRow.frames.map(({tf,move,tone})=>{
        const span=node('span',move===null?'— '+tf:(move>0?'↗ ':move<0?'↘ ':'→ ')+(move>0?'+':'')+move.toFixed(2)+'% '+tf);
        span.className='home-nasdaq-change';span.dataset.tone=tone;
        span.title=move===null?tf+': INSUFFICIENT_DATA':tf+' source-based percentage change';return span;
      }));
      const footer=node('div');footer.className='home-nasdaq-footer';footer.append(node('span',nqRow.momentum+' · '+(nqRow.current?nqRow.age+'m old':nqRow.age===null?'Unavailable':'Stale '+nqRow.age+'m')+''));
      const credit=node('a','Bybit · Completed 5m close');credit.href='https://www.bybit.com/trade/usdt/QQQUSDT';credit.target='_blank';credit.rel='noopener noreferrer';footer.append(credit);nasdaqCard.append(footer);
      nasdaqCard.title+=' · Expires: '+date(nqRow.expires)+' · '+(nqRow.warning||'Contract continuity unverified');
    }
    fearFace.update(currentFear?value:null);
    if(timestampNode)timestampNode.textContent=updated+(retained?' · Refresh failed · Showing last received data':'');
    if(pulse)renderPulse(daily,intraday);
  }
  function setHeaderStatus(text){const headerDocument=document.documentElement.classList.contains('radio-framed')?window.parent.document:document;const label=headerDocument.querySelector('.header-target-label');for(const selector of ['#header-assets','.header-commentary']){const obsolete=headerDocument.querySelector(selector);if(obsolete){obsolete.hidden=true;obsolete.style.display='none';}}if(label)label.textContent='';let headerStatus=headerDocument.getElementById('header-system-status');if(!headerStatus){headerStatus=node('span');headerStatus.id='header-system-status';headerDocument.querySelector('.header-targets')?.append(headerStatus);}headerStatus.replaceChildren(Object.assign(node('span','●'),{style:'color:#ff365f'}),document.createTextNode(' '+text));const timestamp=timestampNode;if(timestamp&&!timestamp.classList.contains('header-market-updated')){timestamp.classList.add('header-market-updated');headerStatus.after(timestamp);}}
  window.addEventListener('rrr-v4-home-position-snapshot',event=>render(event.detail));
  setHeaderStatus('LIVE AI MONITORING 24/7');
  render(null);
})();

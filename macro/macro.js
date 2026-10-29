'use strict';
(() => {
  const endpoint='https://v4.rrr.trading/v4/paper';
  const $=id=>document.getElementById(id);
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
  const date=v=>stamp(v)!==null?new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'}).format(new Date(v))+' Brisbane':'Timestamp unavailable';
  const fmt=(v,digits=2)=>finite(v)?new Intl.NumberFormat('en-AU',{maximumFractionDigits:digits}).format(v):'Unavailable';
  const pct=v=>finite(v)?fmt(v)+'%':'Unavailable';
  const stateOf=view=>{if(!view||!['CURRENT','STALE'].includes(view.state)||(view.mode&&view.mode!=='paper'))return 'UNAVAILABLE';const s=stamp(view.source_at),o=stamp(view.observed_at),e=stamp(view.expires_at);if(s===null||o===null||e===null||s>o||o>Date.now()||e<=s)return 'UNAVAILABLE';return view.state==='STALE'||Date.now()>=e?'STALE':'CURRENT';};
  const set=(id,v)=>{if($(id))$(id).textContent=v;};
  const badge=(el,state)=>{if(!el)return;el.textContent=state;el.dataset.state=state;};
  const element=(tag,value,className)=>{const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;};
  const detailTime=item=>`Source: ${date(item?.source_at)} · Observed: ${date(item?.observed_at)} · Expires: ${date(item?.expires_at)}`;
  function cardState(id,state){badge($(id)?.querySelector('.macro-state'),state);}
  const intelligenceEndpoint='https://v4.rrr.trading/v4/intelligence';
  async function loadThemes(){
    const host=$('macro-themes');
    try{
      const response=await fetch(intelligenceEndpoint,{method:'GET',credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('unavailable');
      const data=await response.json();
      if(data.version!=='theme-intelligence-read-v1'||data.read_only!==true||data.mode!=='paper'||data.scope!=='SHARED')throw Error('contract');
      renderThemes(data);
    }catch{host.replaceChildren(element('p','UNAVAILABLE · Persistent macro themes could not be verified.','macro-muted'));}
  }
  function renderThemeSources(host,sources,omitted){
    if(!Array.isArray(sources)||!sources.length)return;
    const details=document.createElement('details');details.append(element('summary','Supporting evidence and sources'));
    for(const source of sources){
      const line=element('p',[source.source||'Source unavailable','Published: '+date(source.published_at),'Observed: '+date(source.observed_at)].join(' · '));
      try{const url=new URL(source.reference);if(url.protocol==='https:'&&!url.username&&!url.password){const link=element('a',' View source');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';line.append(link);}}catch{}
      details.append(line);
    }
    if(Number.isInteger(omitted)&&omitted>0)details.append(element('p',omitted+' additional sources retained.'));
    host.append(details);
  }
  function renderThemes(data){
    const host=$('macro-themes');host.replaceChildren();
    if(data.availability!=='AVAILABLE'){host.append(element('p','UNAVAILABLE · Persistent macro themes could not be read.','macro-muted'));return;}
    const themes=Array.isArray(data.themes)?data.themes.filter(theme=>theme&&['MACRO','CRYPTO'].includes(theme.scope)&&theme.status!=='RESOLVED'&&typeof theme.name==='string'&&theme.name.trim()):[];
    const freshness=theme=>theme.freshness==='CURRENT'&&stamp(theme.verified_until)!==null&&stamp(theme.verified_until)>Date.now()?'CURRENT':'STALE';
    const score=theme=>finite(theme.significance_score)?theme.significance_score:finite(theme.significance)?theme.significance:finite(theme.relevance_score)?theme.relevance_score:finite(theme.relevance)?theme.relevance:null;
    const ordered=themes.map((theme,index)=>({theme,index,state:freshness(theme)})).sort((a,b)=>{
      if(a.state!==b.state)return a.state==='CURRENT'?-1:1;
      const as=score(a.theme),bs=score(b.theme);if(as!==null||bs!==null)return (bs??-Infinity)-(as??-Infinity);
      if(finite(a.theme.rank)||finite(b.theme.rank))return (finite(a.theme.rank)?a.theme.rank:Infinity)-(finite(b.theme.rank)?b.theme.rank:Infinity);
      return a.index-b.index;
    }).slice(0,4);
    if(!ordered.length){host.append(element('p','No usable saved macro themes are available.','macro-muted'));return;}
    for(const {theme,state} of ordered){
      const card=document.createElement('article');card.className='macro-panel theme-card';card.append(element('div',state,'macro-state theme-state'));card.append(element('h3',theme.name));
      if(typeof theme.understanding==='string'&&theme.understanding.trim())card.append(element('p',theme.understanding,'saved-text'));
      if(typeof theme.latest_development==='string'&&theme.latest_development.trim())card.append(element('p','Latest development · '+theme.latest_development,'theme-development'));
      if(typeof theme.market_implications==='string'&&theme.market_implications.trim())card.append(element('p','Market implications · '+theme.market_implications,'theme-implications'));
      const cryptoImplications=theme.crypto_implications??theme.cryptocurrency_implications;
      if(typeof cryptoImplications==='string'&&cryptoImplications.trim())card.append(element('p','Cryptocurrency implications · '+cryptoImplications,'theme-implications'));
      const significance=theme.significance_label??theme.significance??theme.significance_score;
      if(significance!==undefined&&significance!==null&&String(significance).trim())card.append(element('p','Significance · '+String(significance),'theme-meta'));
      const updated=theme.last_assessed_at||theme.latest_development_at||theme.last_verified_at;
      if(updated)card.append(element('small','Updated · '+date(updated),'theme-updated'));
      renderThemeSources(card,theme.sources,theme.sources_omitted);
      host.append(card);
    }
    if(Number.isInteger(data.omitted)&&data.omitted>0)host.append(element('p',data.omitted+' additional saved themes are available on Macro News & Themes.','macro-muted'));
  }
  function validCatalogue(c){return c&&['CURRENT','STALE'].includes(c.state)&&stamp(c.observed_at)!==null&&Array.isArray(c.assets)&&c.assets.length<=100&&Number.isInteger(c.pool_asset_count)&&c.pool_asset_count===c.assets.length&&Number.isInteger(c.assessed_count)&&c.assessed_count>=0&&c.assessed_count<=c.pool_asset_count&&Number.isInteger(c.eligible_count)&&c.eligible_count>=c.pool_asset_count&&c.assets.every(a=>typeof a?.symbol==='string'&&/^[A-Z0-9]{1,30}USDT$/.test(a.symbol)&&a.pair===a.symbol+'/USDT:USDT'&&typeof a.technically_assessed==='boolean')&&new Set(c.assets.map(a=>a.symbol)).size===c.assets.length;}
  function renderCrypto(view){
    const host=$('crypto-grid');host.replaceChildren();const catalogue=view.research?.catalogue,catOK=validCatalogue(catalogue);
    for(const [symbol,name] of [['BTCUSDT','Bitcoin'],['ETHUSDT','Ethereum']]){
      const button=document.createElement('button');button.type='button';button.className='macro-panel crypto-card macro-asset-card candidate-portrait';button.dataset.symbol=symbol.replace('USDT','');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-label','Open '+name+' asset analysis');
      const heading=element('span',name+' ('+symbol.replace('USDT','')+')','crypto-card-title');button.append(heading,element('span','Open asset details →','crypto-open-link'));
      const asset=catOK?catalogue.assets.find(a=>a.symbol===symbol):null,catState=asset?catalogue.state:'UNAVAILABLE';
      const price=asset&&finite(asset.price)&&asset.price>0?asset.price:null,change=asset&&finite(asset.change_24h_pct)?asset.change_24h_pct:null;
      const metrics=document.createElement('dl');metrics.className='crypto-metrics';for(const [label,value] of [['Saved price',price===null?'Unavailable':'$'+fmt(price,price<1?8:2)],['24-hour change',change===null?'Unavailable':(change>0?'+':'')+pct(change)],['Catalogue freshness',catState]])metrics.append(element('dt',label),element('dd',value));button.append(metrics);
      const directions=[],windowDetails=[],windowStates=[];for(const frame of ['15m','1h','4h']){const item=view.crypto?.[symbol]?.frames?.[frame],state=stateOf(item),values=item?.values;windowStates.push(state);if(['CURRENT','STALE'].includes(state)&&['UP','DOWN','NEUTRAL'].includes(values?.direction)){directions.push(values.direction);windowDetails.push(frame+' '+values.direction+(finite(values.return_pct)?' '+(values.return_pct>0?'+':'')+pct(values.return_pct):''));}}
      const unique=[...new Set(directions)],techState=!directions.length?'UNAVAILABLE':windowStates.some(state=>state==='STALE')?'STALE':windowStates.some(state=>state==='UNAVAILABLE')?'PARTIAL':'CURRENT';
      button.append(element('p','Technical direction · '+(unique.length===1?unique[0]:unique.length>1?'Mixed across saved windows':'Unavailable')));
      button.append(element('p','Saved windows · '+(windowDetails.length?windowDetails.join(' · '):'Unavailable')));
      const momentum=[];for(const frame of ['15m','1h','4h']){const item=view.crypto?.[symbol]?.frames?.[frame],state=stateOf(item),v=item?.values;if(['CURRENT','STALE'].includes(state)&&finite(v?.momentum))momentum.push(frame+' '+fmt(v.momentum));}
      button.append(element('p','Saved momentum · '+(momentum.length?momentum.join(' · '):'Unavailable')));
      const freshness=element('small','Technical freshness · '+techState+(asset?' · Catalogue observed '+date(catalogue.observed_at):''),'crypto-freshness');button.append(freshness);host.append(button);
    }
  }
  function rowsForIndexes(view){
    const body=$('global-rows');body.replaceChildren();let count=0;
    for(const [key,title] of [['NASDAQ100','Nasdaq-100 cash index'],['SP500','S&P 500 cash index']]){const item=view.cash_indexes?.[key],state=stateOf(item),known=item?.session_context==='DAILY_CASH_INDEX_CLOSE_NOT_LIVE_OR_FUTURES'&&finite(item.value)&&['CURRENT','STALE'].includes(state);if(!known)continue;count++;const row=document.createElement('tr');const values=[title,fmt(item.value)+' index points',state,`FRED · Historical close · Observation date ${item.observation_date||'Unavailable'} · ${detailTime(item)}`];values.forEach((value,i)=>{const cell=element('td',value);if(i===2)cell.dataset.state=value;row.append(cell);});body.append(row);}
    if(!count){const row=document.createElement('tr'),cell=element('td','No validated cash-index observations are available.');cell.colSpan=4;row.append(cell);body.append(row);}
  }
  function render(view,snapshot){
    set('snapshot-time','API feed snapshot · '+date(snapshot.served_at));set('macro-feed-status','Saved public V4 observation feed');
    const breadth=view.breadth,b=breadth?.values||{},bs=stateOf(breadth),good=finite(b.rising_24h_pct)&&finite(b.falling_24h_pct)&&b.rising_24h_pct>=0&&b.falling_24h_pct>=0&&b.rising_24h_pct+b.falling_24h_pct<=100&&Number.isInteger(b.assets_included)&&b.assets_included>0&&['AVAILABLE','PARTIAL'].includes(breadth.health);cardState('breadth-card',good?bs:'UNAVAILABLE');set('breadth-value',good?pct(b.rising_24h_pct)+' rising · '+pct(b.falling_24h_pct)+' falling':'Unavailable');set('breadth-rising-label',good?'Rising '+pct(b.rising_24h_pct):'Rising unavailable');set('breadth-falling-label',good?'Falling '+pct(b.falling_24h_pct):'Falling unavailable');$('breadth-rising').style.width=good?b.rising_24h_pct+'%':'0%';$('breadth-falling').style.width=good?b.falling_24h_pct+'%':'0%';$('breadth-rising').setAttribute('aria-label',good?'Rising '+pct(b.rising_24h_pct):'Rising unavailable');$('breadth-falling').setAttribute('aria-label',good?'Falling '+pct(b.falling_24h_pct):'Falling unavailable');$('breadth-track').setAttribute('aria-label',good?`Market breadth: ${pct(b.rising_24h_pct)} rising, ${pct(b.falling_24h_pct)} falling`:'Market breadth unavailable');set('breadth-time',good?'Bybit · 24h · '+b.assets_included+' assets · '+date(breadth.source_at):'Observation timestamp unavailable');
    const fear=view.fear_greed,f=fear?.values||{},fs=stateOf(fear),fg=finite(f.value)&&f.value>=0&&f.value<=100;cardState('fear-card',fg?fs:'UNAVAILABLE');set('fear-value',fg?fmt(f.value,0)+' / 100':'Unavailable');set('fear-detail',fg&&typeof f.classification==='string'?f.classification:'Sentiment classification unavailable');set('fear-time',fg?'Observed · '+date(fear.source_at):'Observation timestamp unavailable');
    const indexes=view.cash_indexes||{},validIndex=k=>{const item=indexes[k];return item&&item.session_context==='DAILY_CASH_INDEX_CLOSE_NOT_LIVE_OR_FUTURES'&&finite(item.value)&&['CURRENT','STALE'].includes(stateOf(item));},ni=validIndex('NASDAQ100'),si=validIndex('SP500'),indexState=ni||si?(ni&&stateOf(indexes.NASDAQ100)==='STALE'||si&&stateOf(indexes.SP500)==='STALE'?'STALE':'CURRENT'):'UNAVAILABLE';cardState('conditions-card',indexState);
    const dailyChange=item=>finite(item?.change_1d_pct)?' ('+(item.change_1d_pct>0?'+':'')+pct(item.change_1d_pct)+')':'';
    set('conditions-value',[ni?'Nasdaq-100 '+fmt(indexes.NASDAQ100.value)+dailyChange(indexes.NASDAQ100):'',si?'S&P 500 '+fmt(indexes.SP500.value)+dailyChange(indexes.SP500):''].filter(Boolean).join(' · ')||'Cash closes unavailable');set('conditions-detail',(ni||si)?'Daily cash-index closing values · index points · not live prices or futures':'No validated daily cash-index observations available.');set('conditions-time',(ni||si)?'FRED · '+[ni?'Nasdaq-100 '+date(indexes.NASDAQ100.source_at):'',si?'S&P 500 '+date(indexes.SP500.source_at):''].filter(Boolean).join(' · '):'Observation timestamp unavailable');
    rowsForIndexes(view);renderCrypto(view);
  }
  async function refresh(){
    try{const response=await fetch(endpoint,{method:'GET',credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const data=await response.json();if(data?.version!=='paper-read-api-v1'||data.mode!=='paper'||data.overview?.version!=='paper-overview-v1'||data.overview.purpose!=='PUBLIC_SAVED_OBSERVATIONS_ONLY')throw Error();render(data.overview,data);}
    catch{set('macro-feed-status','V4 public feed unavailable · connection or response contract could not be verified.');for(const id of ['breadth-card','fear-card','conditions-card'])cardState(id,'UNAVAILABLE');for(const id of ['breadth-value','fear-value','conditions-value'])set(id,'Unavailable');$('global-rows').textContent='Saved index observations unavailable.';$('crypto-grid').textContent='Saved BTC and ETH observations unavailable.';}

  }
  loadThemes();refresh();setInterval(()=>{if(!document.hidden){loadThemes();refresh();}},30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){loadThemes();refresh();}});
})();

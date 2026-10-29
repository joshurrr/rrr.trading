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
  function validatedInterpretation(saved){
    if(!saved)return {usable:false,reason:'saved interpretation missing'};
    if(saved.validation!=='SAVED_SCHEMA_AND_ORIGINAL_EVIDENCE_VALIDATED')return {usable:false,reason:'validation: '+(saved.validation||'missing')};
    if(!['CURRENT','STALE'].includes(saved.state))return {usable:false,reason:'backend state: '+(saved.state||'missing')+' · '+(saved.reasons||saved.rejection_reasons||[]).join(', ')};
    for(const key of ['source_at','observed_at','expires_at'])if(stamp(saved[key])===null)return {usable:false,reason:key+' missing or invalid'};
    if(stamp(saved.source_at)>stamp(saved.observed_at))return {usable:false,reason:'source_at is after observed_at'};
    if(stamp(saved.observed_at)>Date.now())return {usable:false,reason:'observed_at is in the future relative to browser time'};
    if(stamp(saved.expires_at)<=stamp(saved.source_at))return {usable:false,reason:'expires_at is not after source_at'};
    if(typeof saved.assessment?.text!=='string')return {usable:false,reason:'assessment.text missing'};
    return {usable:true,state:saved.state==='STALE'||Date.now()>=stamp(saved.expires_at)?'STALE':'CURRENT',reason:''};
  }
  function renderTechnical(saved,ai,match,assessment,readerState){
    const host=$('luna-technical');host.replaceChildren();
    const rows=[
      ['Saved backend state',saved?.state||'UNKNOWN'],['Saved validation',saved?.validation||'UNKNOWN'],['Saved health',saved?.health||'UNKNOWN'],
      ['Luna reader status',ai?.status||'UNKNOWN'],['Luna context state',ai?.context_state||'UNKNOWN'],['Availability',ai?.availability||'UNKNOWN'],
      ['Risk regime status',match?(ai?.risk_regime_status||'UNKNOWN'):'UNKNOWN · generation mismatch'],['Assessment generation match',match?'YES':'NO / UNKNOWN'],
      ['Assessment freshness',assessment.usable?assessment.state:'UNAVAILABLE'],['Generation timestamp',date(ai?.assessment_timestamp)],
      ['Entry-age deadline',date(ai?.entry_expires_at)],['SOL consumption','Not verified · no per-request receipt is exposed']
    ];
    const list=document.createElement('dl');list.className='technical-grid';for(const [label,value] of rows){list.append(element('dt',label),element('dd',String(value)));}host.append(list);
    const reasons=saved?.reasons||saved?.rejection_reasons;if(Array.isArray(reasons)&&reasons.length)host.append(element('p','Saved assessment reasons: '+reasons.join(', ')));
    if(!assessment.usable)host.append(element('p','Validation detail: '+assessment.reason));
    host.append(element('p','Generation match: '+(match?'YES':'NO / UNKNOWN')+' · Luna reader: '+readerState));
    for(const [label,items] of [['Supporting evidence',saved?.drivers],['Conflicting evidence',saved?.contradictions],['Uncertainty and missing evidence',saved?.uncertainty]]){
      const values=(Array.isArray(items)?items:[]).map(v=>typeof v==='string'?v:v?.text).filter(v=>typeof v==='string'&&v.trim());
      if(values.length){host.append(element('h3',label));for(const value of values)host.append(element('p',value));}
    }
  }
  function renderCitations(saved,usable){
    const host=$('source-list');host.replaceChildren();const evidence=usable&&Array.isArray(saved.provenance?.evidence)?saved.provenance.evidence:[];
    if(!evidence.length){host.textContent='No citation metadata available.';return;}
    for(const item of evidence.slice(0,64)){const p=element('p',[item.id||'Unknown citation',item.source||'Unknown source',item.state==='CURRENT'&&stamp(item.expires_at)>Date.now()?'CURRENT':'HISTORICAL / UNAVAILABLE','Published: '+date(item.published_at),'Observed: '+date(item.observed_at),'Expires: '+date(item.expires_at)].join(' · '));try{const u=new URL(item.reference);if(u.protocol==='https:'&&['coindesk.com','www.coindesk.com','api.bybit.com','api.alternative.me','fred.stlouisfed.org'].includes(u.hostname)&&!u.username&&!u.password){const a=element('a',' View source');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';p.append(a);}}catch{}host.append(p);}
  }
  function renderThemes(saved){
    const news=saved?.news_and_themes,content=news?.content,host=$('macro-themes');host.replaceChildren();
    const valid=news?.validation==='SAVED_SCHEMA_AND_ORIGINAL_EVIDENCE_VALIDATED'&&content?.status==='AVAILABLE'&&typeof content.summary==='string'&&['CURRENT','STALE'].includes(news.state)&&stamp(news.source_at)!==null&&stamp(news.expires_at)!==null&&stamp(news.source_at)<=Date.now()&&stamp(news.expires_at)>stamp(news.source_at);
    const themeState=valid&&(news.state==='STALE'||Date.now()>=stamp(news.expires_at))?'STALE':'CURRENT';
    if(!valid){host.append(element('p',news?.validation&&news.validation!=='SAVED_SCHEMA_AND_ORIGINAL_EVIDENCE_VALIDATED'?'Saved macro themes could not be validated.':'No validated saved macro themes are available.','macro-muted'));return;}
    let themes=Array.isArray(content.themes)?content.themes.filter(t=>t&&typeof t.name==='string'):[];
    if(themes.some(t=>finite(t.significance)||finite(t.significance_score)||finite(t.rank)))themes=themes.slice().sort((a,b)=>{
      const score=t=>finite(t.significance_score)?t.significance_score:finite(t.significance)?t.significance:finite(t.rank)?-t.rank:0;return score(b)-score(a);
    });
    for(const theme of themes.slice(0,4)){
      const card=document.createElement('article');card.className='macro-panel theme-card';card.append(element('div',themeState,'macro-state theme-state'));card.append(element('h3',theme.name));
      if(typeof theme.description==='string'&&theme.description.trim())card.append(element('p',theme.description,'saved-text'));
      const significance=theme.significance_label??theme.significance??theme.significance_score;if(significance!==undefined&&significance!==null&&String(significance).trim())card.append(element('p','Significance · '+String(significance),'theme-meta'));
      const implication=theme.implication??theme.influence;if(typeof implication==='string'&&implication.trim()){const p=element('p','Influence · '+implication,'theme-implication');p.dataset.implication=implication.toUpperCase();card.append(p);}
      if(typeof theme.direction==='string'&&theme.direction.trim())card.append(element('p','Direction · '+theme.direction,'theme-meta'));
      if(typeof theme.market_implications==='string'&&theme.market_implications.trim())card.append(element('p',theme.market_implications,'theme-implications'));
      if(Array.isArray(theme.affected_markets)&&theme.affected_markets.length)card.append(element('p','Affected markets · '+theme.affected_markets.join(', '),'theme-meta'));
      card.append(element('small','Updated · '+date(news.observed_at),'theme-updated'));
      const refs=Array.isArray(theme.evidence_ids)?theme.evidence_ids:[];if(refs.length){const details=document.createElement('details');details.append(element('summary','Evidence and sources'));for(const id of refs){const citation=(news.provenance?.evidence||[]).find(e=>e.id===id);if(!citation){details.append(element('p','Citation metadata unavailable for '+id));continue;}const line=element('p',[citation.id||'Unknown citation',citation.source||'Unknown source','Published: '+date(citation.published_at),'Observed: '+date(citation.observed_at),'Saved state: '+(citation.state||'UNKNOWN')].join(' · '));try{const u=new URL(citation.reference);if(u.protocol==='https:'&&['coindesk.com','www.coindesk.com','api.bybit.com','api.alternative.me','fred.stlouisfed.org'].includes(u.hostname)&&!u.username&&!u.password){const a=element('a',' View source');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';line.append(a);}}catch{}details.append(line);}card.append(details);}
      host.append(card);
    }
    if(!themes.length)host.append(element('p','No themes recorded in this saved assessment.','macro-muted'));
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
    const saved=view.interpretation,assessment=validatedInterpretation(saved),usable=assessment.usable,current=usable&&assessment.state==='CURRENT'&&saved.historical===false,ai=snapshot.sentiment||view.sentiment;
    const generationMatch=stamp(ai?.assessment_timestamp)!==null&&stamp(ai.assessment_timestamp)===stamp(saved?.source_at),directionMap={UP:'UPWARD PRESSURE',DOWN:'DOWNWARD PRESSURE',NEUTRAL:'NEUTRAL'},direction=generationMatch?directionMap[ai?.market_direction]:null;
    set('snapshot-time','API feed snapshot · '+date(snapshot.served_at));set('macro-feed-status','Saved public V4 observation feed');
    const readerStatus=typeof ai?.status==='string'?ai.status:'UNKNOWN',readerContext=typeof ai?.context_state==='string'?ai.context_state:'UNKNOWN',readerState=readerStatus==='USABLE'&&readerContext==='CURRENT'&&ai?.availability==='AVAILABLE'?'CURRENT':readerContext==='CONTEXT_ONLY'||ai?.availability==='STALE'?'STALE':readerStatus==='BLOCKED'||ai?.availability==='UNAVAILABLE'?'UNAVAILABLE':'UNKNOWN';
    const pageState=usable?assessment.state:'UNAVAILABLE';badge($('luna-status'),pageState);$('luna-status').dataset.state=pageState;
    set('luna-commentary',usable?saved.assessment.text:'Assessment unavailable — saved intelligence could not be validated.');
    set('luna-direction',generationMatch?(direction||'Not recorded in saved assessment'):'Unavailable · generation mismatch');
    set('luna-risk',generationMatch?(ai?.risk_regime||'Not recorded'):'Unavailable · generation mismatch');
    set('luna-market-mood',usable&&typeof saved.market_mood?.text==='string'?saved.market_mood.text:'Not recorded in validated assessment');
    set('luna-pressure',usable&&typeof saved.directional_pressure?.text==='string'?saved.directional_pressure.text:'Not recorded in validated assessment');
    set('luna-confidence','Not supplied · no calibrated confidence is exposed');
    set('luna-time',usable?'Generated · '+date(ai?.assessment_timestamp)+' · Saved · '+date(saved.observed_at):'Assessment generation timestamp unavailable');
    set('luna-freshness','Freshness: '+pageState+(usable&&saved.health==='PARTIAL'?' · PARTIAL coverage':''));
    renderTechnical(saved,ai,generationMatch,assessment,readerState);renderCitations(saved,usable);renderThemes(saved);

    const directionState=current?'CURRENT':usable?'STALE':'UNAVAILABLE';cardState('direction-card',directionState);set('direction-value',usable&&generationMatch?(direction||'Direction unknown'):'Unavailable');set('direction-detail',usable&&generationMatch?(saved.directional_pressure?.text||'Validated saved market direction.'):'No matching validated saved direction is available.');set('direction-time',usable?'Luna · '+date(saved.source_at):'Assessment timestamp unavailable');
    const breadth=view.breadth,b=breadth?.values||{},bs=stateOf(breadth),good=finite(b.rising_24h_pct)&&finite(b.falling_24h_pct)&&b.rising_24h_pct>=0&&b.falling_24h_pct>=0&&b.rising_24h_pct+b.falling_24h_pct<=100&&Number.isInteger(b.assets_included)&&b.assets_included>0&&['AVAILABLE','PARTIAL'].includes(breadth.health);cardState('breadth-card',good?bs:'UNAVAILABLE');set('breadth-value',good?pct(b.rising_24h_pct)+' rising · '+pct(b.falling_24h_pct)+' falling':'Unavailable');set('breadth-rising-label',good?'Rising '+pct(b.rising_24h_pct):'Rising unavailable');set('breadth-falling-label',good?'Falling '+pct(b.falling_24h_pct):'Falling unavailable');$('breadth-rising').style.width=good?b.rising_24h_pct+'%':'0%';$('breadth-falling').style.width=good?b.falling_24h_pct+'%':'0%';$('breadth-rising').setAttribute('aria-label',good?'Rising '+pct(b.rising_24h_pct):'Rising unavailable');$('breadth-falling').setAttribute('aria-label',good?'Falling '+pct(b.falling_24h_pct):'Falling unavailable');$('breadth-track').setAttribute('aria-label',good?`Market breadth: ${pct(b.rising_24h_pct)} rising, ${pct(b.falling_24h_pct)} falling`:'Market breadth unavailable');set('breadth-time',good?'Bybit · 24h · '+b.assets_included+' assets · '+date(breadth.source_at):'Observation timestamp unavailable');
    const fear=view.fear_greed,f=fear?.values||{},fs=stateOf(fear),fg=finite(f.value)&&f.value>=0&&f.value<=100;cardState('fear-card',fg?fs:'UNAVAILABLE');set('fear-value',fg?fmt(f.value,0)+' / 100':'Unavailable');set('fear-detail',fg&&typeof f.classification==='string'?f.classification:'Sentiment classification unavailable');set('fear-time',fg?'Observed · '+date(fear.source_at):'Observation timestamp unavailable');
    const indexes=view.cash_indexes||{},validIndex=k=>{const item=indexes[k];return item&&item.session_context==='DAILY_CASH_INDEX_CLOSE_NOT_LIVE_OR_FUTURES'&&finite(item.value)&&['CURRENT','STALE'].includes(stateOf(item));},ni=validIndex('NASDAQ100'),si=validIndex('SP500'),indexState=ni||si?(ni&&stateOf(indexes.NASDAQ100)==='STALE'||si&&stateOf(indexes.SP500)==='STALE'?'STALE':'CURRENT'):'UNAVAILABLE';cardState('conditions-card',indexState);
    const dailyChange=item=>finite(item?.change_1d_pct)?' ('+(item.change_1d_pct>0?'+':'')+pct(item.change_1d_pct)+')':'';
    set('conditions-value',[ni?'Nasdaq-100 '+fmt(indexes.NASDAQ100.value)+dailyChange(indexes.NASDAQ100):'',si?'S&P 500 '+fmt(indexes.SP500.value)+dailyChange(indexes.SP500):''].filter(Boolean).join(' · ')||'Cash closes unavailable');set('conditions-detail',(ni||si)?'Daily cash-index closing values · index points · not live prices or futures':'No validated daily cash-index observations available.');set('conditions-time',(ni||si)?'FRED · '+[ni?'Nasdaq-100 '+date(indexes.NASDAQ100.source_at):'',si?'S&P 500 '+date(indexes.SP500.source_at):''].filter(Boolean).join(' · '):'Observation timestamp unavailable');
    rowsForIndexes(view);renderCrypto(view);
  }
  async function refresh(){
    try{const response=await fetch(endpoint,{method:'GET',credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const data=await response.json();if(data?.version!=='paper-read-api-v1'||data.mode!=='paper'||data.overview?.version!=='paper-overview-v1'||data.overview.purpose!=='PUBLIC_SAVED_OBSERVATIONS_ONLY')throw Error();render(data.overview,data);}
    catch{set('macro-feed-status','V4 public feed unavailable · connection or response contract could not be verified.');for(const id of ['direction-card','breadth-card','fear-card','conditions-card'])cardState(id,'UNAVAILABLE');for(const id of ['direction-value','breadth-value','fear-value','conditions-value'])set(id,'Unavailable');$('global-rows').textContent='Saved index observations unavailable.';$('crypto-grid').textContent='Saved BTC and ETH observations unavailable.';$('macro-themes').textContent='Saved macro themes unavailable.';badge($('luna-status'),'UNAVAILABLE');$('luna-status').dataset.state='UNAVAILABLE';set('luna-time','Assessment generation timestamp unavailable');set('luna-freshness','Assessment status unavailable');for(const id of ['luna-direction','luna-risk','luna-market-mood','luna-pressure','luna-confidence'])set(id,'Unavailable');set('luna-commentary','Assessment unavailable — saved intelligence could not be validated.');$('luna-technical').textContent='Saved validation and diagnostic details unavailable because the public feed could not be verified.';$('source-list').textContent='Citation metadata unavailable.';}
  }
  refresh();setInterval(()=>{if(!document.hidden)refresh();},30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();

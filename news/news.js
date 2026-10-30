'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const rows=v=>Array.isArray(v)?v:[];
  const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
  const stamp=v=>Number.isFinite(Date.parse(v))?Date.parse(v):0;
  const time=v=>stamp(v)?new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'}).format(new Date(v))+' Brisbane':'UNKNOWN';
  const current=t=>t.freshness==='CURRENT'&&stamp(t.verified_until)>Date.now();
  const levels={HIGH:3,MEDIUM:2,LOW:1};
  const label=t=>t.significance_label??t.significance;
  const score=t=>Number.isFinite(t.significance_score)?t.significance_score:Number.isFinite(t.significance)?t.significance:null;
  const status=t=>t.status==='ESCALATING'?2:t.status==='EMERGING'?1:0;
  const updated=t=>stamp(t.last_verified_at)||stamp(t.last_assessed_at)||stamp(t.latest_development_at);
  let themes=[],filter='ALL',visible=10;
  function sort(items){
    // Compare only saved, comparable values; otherwise preserve API priority.
    return items.map((theme,index)=>({theme,index})).sort((a,b)=>{
      const x=a.theme,y=b.theme,lx=levels[label(x)],ly=levels[label(y)];
      if((lx??0)!==(ly??0))return (ly??0)-(lx??0);
      const sx=score(x),sy=score(y);
      if(sx!==null&&sy!==null&&sx!==sy)return sy-sx;
      if((sx===null)!==(sy===null))return sx===null?1:-1;
      if(lx===undefined&&sx===null){const rx=Number.isFinite(x.rank)?x.rank:Infinity,ry=Number.isFinite(y.rank)?y.rank:Infinity;if(rx!==ry)return rx-ry;}
      return status(y)-status(x)||Number(current(y))-Number(current(x))||updated(y)-updated(x)||a.index-b.index;
    }).map(item=>item.theme);
  }
  function sourceRows(host,sources){
    for(const s of [...rows(sources)].sort((a,b)=>stamp(b.published_at)-stamp(a.published_at))){
      const article=el('article',undefined,'news-source');
      article.append(el('h4',s.headline||s.title||'Article headline unavailable'),el('p',`${s.source||'UNKNOWN'} · Published ${time(s.published_at)} · Observed ${time(s.observed_at)}`));
      try{const url=new URL(s.reference);if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password){const link=el('a','Read original source ↗');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';article.append(link);}}catch{}
      if(s.source_version||s.evidence_id)article.append(el('p',[s.source_version,s.evidence_id?'Evidence '+s.evidence_id:null].filter(Boolean).join(' / ')));
      host.append(article);
    }
  }
  function card(theme,rank){
    const box=el('details',undefined,'evolving-theme news-theme');box.dataset.themeId=theme.id;box.dataset.significance=label(theme)||'UNKNOWN';
    const summary=el('summary');
    const number=el('span',String(rank).padStart(2,'0'),'news-rank');
    const heading=el('div',undefined,'news-theme-heading');heading.append(el('h3',theme.name||'Unnamed saved theme'));
    const sig=label(theme)??score(theme);
    heading.append(el('p',[theme.scope,theme.status,sig!==null&&sig!==undefined?'Significance: '+sig:null,current(theme)?'CURRENT':'STALE'].filter(Boolean).join(' · '),'news-theme-meta'));
    heading.append(el('p',theme.understanding||theme.latest_development||'Understanding unavailable.','news-understanding'));
    heading.append(el('p',`Verified ${time(theme.last_verified_at)} · Luna assessment ${time(theme.last_assessed_at)}`,'news-theme-time'));
    heading.append(el('span',rows(theme.sources).length?`Supporting sources (${theme.sources.length})`:'Supporting evidence unavailable','news-expand'));
    summary.append(number,heading);box.append(summary);
    const content=el('div',undefined,'news-theme-content');
    for(const [title,key] of [['Latest material development','latest_development'],['Market implications','market_implications']])if(theme[key])content.append(el('h4',title),el('p',theme[key]));
    if(theme.latest_development_at)content.append(el('p','Development: '+time(theme.latest_development_at),'news-theme-time'));
    for(const [title,key] of [['Positive catalysts','positive_catalysts'],['Negative catalysts','negative_catalysts'],['Unresolved questions','unresolved_questions'],['Contradictions','contradictions'],['Uncertainty','uncertainty']])if(rows(theme[key]).length){const list=el('ul');rows(theme[key]).forEach(item=>list.append(el('li',typeof item==='string'?item:item.text)));content.append(el('h4',title),list);}
    if(theme.confidence)content.append(el('p','Confidence: '+theme.confidence));
    content.append(el('h4','Supporting sources · publication evidence'));
    sourceRows(content,theme.sources);
    if(!rows(theme.sources).length)content.append(el('p','No supporting article references are exposed for this theme.'));
    if(theme.sources_omitted)content.append(el('p',`${theme.sources_omitted} additional sources retained but not exposed in this response.`));
    for(const items of Object.values(theme.catalyst_support||{})){const support=el('details');support.append(el('summary','Original catalyst support · original assessed generation'));sourceRows(support,items);content.append(support);}
    box.append(content);return box;
  }
  function matches(t,key){return key==='ALL'||(key==='ESCALATING'?t.status==='ESCALATING':t.scope===key);}
  function render(){
    const active=themes.filter(t=>t.status!=='RESOLVED'),matching=active.filter(t=>matches(t,filter));
    const list=$('theme-list');list.replaceChildren(...matching.slice(0,visible).map(t=>card(t,active.indexOf(t)+1)));
    if(!matching.length)list.append(el('p','No saved themes match this filter.'));
    $('theme-count').textContent=`Showing ${Math.min(visible,matching.length)} of ${matching.length} themes`;
    $('show-more').hidden=visible>=matching.length;
    for(const button of $('theme-filters').children){const key=button.dataset.filter;button.textContent=`${{ALL:'All Themes',CRYPTO:'Crypto',MACRO:'Macro',ESCALATING:'Escalating'}[key]} (${active.filter(t=>matches(t,key)).length})`;button.setAttribute('aria-pressed',String(filter===key));}
    const history=$('theme-history');history.replaceChildren(el('summary','Historical and resolved intelligence'));
    themes.filter(t=>t.status==='RESOLVED').forEach((t,i)=>history.append(card(t,i+1)));
  }
  async function refresh(){
    const button=$('refresh-news');button.disabled=true;
    $('feed-status').textContent='Loading saved intelligence…';
    try{
      const response=await fetch('https://v4.rrr.trading/v4/intelligence',{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('unavailable');const data=await response.json();
      if(data.version!=='theme-intelligence-read-v1'||data.read_only!==true||data.mode!=='paper'||data.scope!=='SHARED')throw Error('contract');
      const seen=new Set();themes=sort(rows(data.themes).filter(t=>{if(!t||!['MACRO','CRYPTO'].includes(t.scope))return false;if(t.id&&seen.has(t.id))return false;if(t.id)seen.add(t.id);return true;}));
      const overview=$('news-overview'),s=data.theme_summary||{},d=data.discovery||{};overview.replaceChildren();
      for(const [title,value] of [['Active themes',s.active_count??themes.filter(t=>t.status!=='RESOLVED').length],['Current verification',s.current_verification_count??themes.filter(t=>t.status!=='RESOLVED'&&current(t)).length],['Last successful collection',time(d.last_successful_check)],['Pending interpretation',data.pending_status||'UNKNOWN']]){const metric=el('div');metric.append(el('dt',title),el('dd',value));overview.append(metric);}
      const latest=key=>themes.map(t=>t[key]).filter(v=>stamp(v)).sort((a,b)=>stamp(b)-stamp(a))[0];
      $('collection-status').textContent=`Discovery: ${d.status||'UNKNOWN'} · Latest attempt: ${time(d.checked_at)} · Latest Luna assessment: ${time(s.latest_assessment_at||latest('last_assessed_at'))} · Latest verification: ${time(s.latest_verification_at||latest('last_verified_at'))}`;
      $('feed-status').textContent=`${data.availability||'UNKNOWN'} · Saved Luna intelligence · Read-only paper trading context.`;
      $('theme-limits').textContent=data.omitted?`${data.omitted} additional themes retained beyond this API view; only returned themes can be displayed.`:'';
      visible=10;render();
      if(data.availability!=='AVAILABLE')$('theme-list').prepend(el('p','UNAVAILABLE · Persistent themes could not be read; any returned records retain their saved status.'));
    }catch{
      themes=[];$('news-overview').replaceChildren();$('collection-status').textContent='';$('theme-limits').textContent='';render();
      $('feed-status').textContent='UNAVAILABLE · Persistent intelligence could not be verified.';
    }finally{button.disabled=false;}
  }
  $('theme-filters').addEventListener('click',event=>{const key=event.target.dataset.filter;if(!key)return;filter=key;visible=10;render();});
  $('show-more').addEventListener('click',()=>{visible+=10;render();});
  $('refresh-news').addEventListener('click',refresh);refresh();
})();

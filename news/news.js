'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const rows=v=>Array.isArray(v)?v:[];
  const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
  const stamp=v=>Number.isFinite(Date.parse(v))?Date.parse(v):0;
  const time=v=>stamp(v)?new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'}).format(new Date(v))+' Brisbane':'UNKNOWN';
  const shortTime=v=>stamp(v)?new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(v)):'UNKNOWN';
  const clockTime=v=>stamp(v)?new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(v)):'UNKNOWN';
  const current=t=>t.freshness==='CURRENT'&&stamp(t.verified_until)>Date.now();
  const levels={HIGH:3,MEDIUM:2,LOW:1};
  const label=t=>t.significance_label??t.significance;
  const score=t=>Number.isFinite(t.significance_score)?t.significance_score:Number.isFinite(t.significance)?t.significance:null;
  const status=t=>t.status==='ESCALATING'?2:t.status==='EMERGING'?1:0;
  const updated=t=>stamp(t.last_verified_at)||stamp(t.last_assessed_at)||stamp(t.latest_development_at);
  let themes=[],filter='ALL',visible=10,tracked=null;
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
    const meta=el('p',undefined,'news-theme-meta');
    if(sig!==null&&sig!==undefined)meta.append(el('span',String(sig),levels[label(theme)]?'news-significance':''),el('span',' · '));
    meta.append(el('span',[theme.scope,theme.status,current(theme)?'CURRENT':'STALE'].filter(Boolean).join(' · ')));heading.append(meta);
    heading.append(el('p',theme.understanding||theme.latest_development||'Understanding unavailable.','news-understanding'));
    const timestamps=el('p',`Verified ${shortTime(theme.last_verified_at)} · AI analysis ${shortTime(theme.last_assessed_at)}`,'news-theme-time');
    timestamps.title=`Verified ${time(theme.last_verified_at)} · AI analysis ${time(theme.last_assessed_at)}`;heading.append(timestamps);
    heading.append(el('span',`Supporting News (${rows(theme.sources).length})`,'news-expand'));
    summary.setAttribute('aria-expanded','false');
    box.addEventListener('toggle',()=>summary.setAttribute('aria-expanded',String(box.open)));
    summary.append(number,heading);box.append(summary);
    const content=el('div',undefined,'news-theme-content');
    for(const [title,key] of [['Latest material development','latest_development'],['Market implications','market_implications']])if(theme[key])content.append(el('h4',title),el('p',theme[key]));
    if(theme.latest_development_at)content.append(el('p','Development: '+time(theme.latest_development_at),'news-theme-time'));
    for(const [title,key] of [['Positive catalysts','positive_catalysts'],['Negative catalysts','negative_catalysts'],['Unresolved questions','unresolved_questions'],['Contradictions','contradictions'],['Uncertainty','uncertainty']])if(rows(theme[key]).length){const list=el('ul');rows(theme[key]).forEach(item=>list.append(el('li',typeof item==='string'?item:item.text)));content.append(el('h4',title),list);}
    if(theme.confidence)content.append(el('p','Confidence: '+theme.confidence));
    content.append(el('h4','Supporting News · publication evidence'));
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
    if(!matching.length)list.append(el('p','No news themes match this filter.'));
    $('theme-count').textContent=`Showing ${Math.min(visible,matching.length)} of ${matching.length} available themes${filter!=='ALL'?' matching this filter':''}${tracked!==null?` · ${tracked} tracked`:''}`;
    $('show-more').hidden=visible>=matching.length;
    for(const button of $('theme-filters').children){const key=button.dataset.filter;button.textContent=`${{ALL:'All Themes',CRYPTO:'Crypto',MACRO:'Macro',ESCALATING:'Escalating'}[key]} (${active.filter(t=>matches(t,key)).length})`;button.setAttribute('aria-pressed',String(filter===key));}
    const history=$('theme-history');history.replaceChildren(el('summary','Historical and resolved intelligence'));
    themes.filter(t=>t.status==='RESOLVED').forEach((t,i)=>history.append(card(t,i+1)));
  }
  async function refresh(){
    const button=$('refresh-news');button.disabled=true;
    $('feed-status').textContent='Loading news themes…';
    try{
      const response=await fetch('https://v4.rrr.trading/v4/intelligence',{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('unavailable');const data=await response.json();
      if(data.version!=='theme-intelligence-read-v1'||data.read_only!==true||data.mode!=='paper'||data.scope!=='SHARED')throw Error('contract');
      const seen=new Set();themes=sort(rows(data.themes).filter(t=>{if(!t||!['MACRO','CRYPTO'].includes(t.scope))return false;if(t.id&&seen.has(t.id))return false;if(t.id)seen.add(t.id);return true;}));
      const overview=$('news-overview'),s=data.theme_summary||{},d=data.discovery||{};overview.replaceChildren();
      tracked=Number.isFinite(s.active_count)?s.active_count:Number.isFinite(data.omitted)?themes.length+data.omitted:null;
      const activeCount=themes.filter(t=>t.status!=='RESOLVED').length;
      const pending=data.pending_status==='PENDING_UNASSESSED'?'AI analysis pending':data.pending_status==='NONE'?'No AI analysis pending':'AI analysis status unknown';
      for(const value of [tracked!==null?`${tracked} themes tracked`:`${activeCount} themes available`,`${s.current_verification_count??themes.filter(t=>t.status!=='RESOLVED'&&current(t)).length} current`,`Updated ${clockTime(d.last_successful_check)}`,pending])overview.append(el('span',value));
      overview.title=`Updated: last successful collection ${time(d.last_successful_check)}. Verification and AI analysis times are in Collection details.`;
      const latest=key=>themes.map(t=>t[key]).filter(v=>stamp(v)).sort((a,b)=>stamp(b)-stamp(a))[0];
      $('collection-status').textContent=`Discovery: ${d.status||'UNKNOWN'} · Latest attempt: ${time(d.checked_at)} · Last successful collection: ${time(d.last_successful_check)} · Latest AI analysis: ${time(s.latest_assessment_at||latest('last_assessed_at'))} · Latest verification: ${time(s.latest_verification_at||latest('last_verified_at'))} · AI analysis status: ${data.pending_status||'UNKNOWN'}`;
      $('feed-status').textContent=data.availability==='AVAILABLE'?'':`${data.availability||'UNKNOWN'} · News themes could not be fully verified.`;
      $('theme-limits').textContent=data.omitted?`${data.omitted} additional themes are outside this API view; only returned themes can be displayed.`:'';
      visible=10;render();
      if(data.availability!=='AVAILABLE')$('theme-list').prepend(el('p','UNAVAILABLE · News themes could not be read; any returned records retain their saved status.'));
    }catch{
      themes=[];tracked=null;$('news-overview').replaceChildren();$('collection-status').textContent='';$('theme-limits').textContent='';render();
      $('feed-status').textContent='UNAVAILABLE · News themes could not be verified.';
    }finally{button.disabled=false;}
  }
  $('theme-filters').addEventListener('click',event=>{const key=event.target.dataset.filter;if(!key)return;filter=key;visible=10;render();});
  $('show-more').addEventListener('click',()=>{visible+=10;render();});
  $('refresh-news').addEventListener('click',refresh);refresh();
})();

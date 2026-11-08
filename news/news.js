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
  let themes=[],filter='ALL',visible=10,tracked=null,nextOffset=null,pageTotal=null,loadingMore=false,sourceSerial=0,generation=0;
  function canonical(reference){try{const u=new URL(reference);u.hash='';const query=[...u.searchParams].filter(([key])=>!/^utm_/i.test(key)&&!['ref','source','fbclid','gclid'].includes(key.toLowerCase())).sort(([a,av],[b,bv])=>a<b?-1:a>b?1:av<bv?-1:av>bv?1:0);u.search='';for(const [key,value] of query)u.searchParams.append(key,value);if(u.hostname==='blog.ethereum.org'&&/^\/20\d{2}\//.test(u.pathname))u.pathname='/en'+u.pathname;return u.href;}catch{return String(reference||'');}}
  const versions=s=>rows(s.source_versions).length?rows(s.source_versions):[s];
  const versionKey=s=>s.record_id||JSON.stringify([canonical(s.reference),s.content_key,s.published_at,s.observed_at]);
  function uniqueSources(items){const groups=new Map();for(const source of rows(items))for(const s of versions(source)){const key=canonical(s.reference);if(!groups.has(key))groups.set(key,new Map());groups.get(key).set(versionKey(s),s);}return [...groups].map(([key,value])=>({key,versions:[...value.values()].sort((a,b)=>stamp(b.observed_at)-stamp(a.observed_at))}));}
  function versionRows(host,items){for(const s of items){const p=el('p',`Published ${time(s.published_at)} · Observed ${time(s.observed_at)} · ${s.source_version||'Source version unknown'}${s.evidence_id?' · Evidence '+s.evidence_id:''}`);host.append(p);}}
  function sourceRows(host,sources){
    const references=new Map();
    for(const group of uniqueSources(sources).sort((a,b)=>stamp(b.versions[0].published_at)-stamp(a.versions[0].published_at))){
      const s=group.versions[0],headline=group.versions.find(v=>v.headline||v.title);
      const article=el('article',undefined,'news-source');
      article.id='news-source-'+(++sourceSerial);
      references.set(group.key,{id:article.id,headline:headline?.headline||headline?.title||'Article headline unavailable'});
      article.append(el('h4',headline?.headline||headline?.title||'Article headline unavailable'),el('p',`${s.source||'UNKNOWN'} · Published ${time(s.published_at)} · Observed ${time(s.observed_at)}`));
      try{const url=new URL(s.reference);if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password){const link=el('a','Read original source ↗');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';article.append(link);}}catch{}
      if(s.source_version||s.evidence_id)article.append(el('p',[s.source_version,s.evidence_id?'Evidence '+s.evidence_id:null].filter(Boolean).join(' / ')));
      if(group.versions.length>1){const saved=el('details');saved.append(el('summary',`${group.versions.length} saved source versions · one article`));versionRows(saved,group.versions);article.append(saved);}
      host.append(article);
    }
    return references;
  }
  function card(theme,rank){
    const box=el('details',undefined,'evolving-theme news-theme');box.dataset.themeId=theme.id;box.dataset.significance=label(theme)||'UNKNOWN';
    const summary=el('summary');
    const number=el('span',String(rank).padStart(2,'0'),'news-rank');
    const heading=el('div',undefined,'news-theme-heading');heading.append(el('h3',theme.name||'Unnamed saved theme'));
    const sig=label(theme)??score(theme);
    const meta=el('p',undefined,'news-theme-meta');
    meta.title=`${theme.status||'UNKNOWN'} is the saved lifecycle assessment from ${time(theme.last_assessed_at)}. CURRENT describes the verification window ending ${time(theme.verified_until)}, not a new article or market move.`;
    if(sig!==null&&sig!==undefined)meta.append(el('span',String(sig),levels[label(theme)]?'news-significance':''),el('span',' · '));
    meta.append(el('span',[theme.scope,theme.status,current(theme)?'CURRENT':'STALE'].filter(Boolean).join(' · ')));heading.append(meta);
    const narrative=el('div',undefined,'news-understanding');
    const text=theme.narrative||theme.understanding||theme.latest_development||'Understanding unavailable.';
    for(const paragraph of text.split(/\n\s*\n/).filter(p=>p.trim()))narrative.append(el('p',paragraph));
    heading.append(narrative);
    const timestamps=el('p',`Last source check ${shortTime(theme.last_checked_at)} · Last significant development ${shortTime(theme.latest_development_at)} · Last AI assessment ${shortTime(theme.last_assessed_at)}`,'news-theme-time');
    timestamps.title=`Exact supporting article reobserved: ${time(theme.last_checked_at)}; this does not establish a full story review. Development time is the first AI assessment of distinct support. Evidence verified ${time(theme.last_verified_at)}, verification expires ${time(theme.verified_until)}. Last AI assessment ${time(theme.last_assessed_at)}.`;heading.append(timestamps);
    heading.append(el('span',`Supporting News (${uniqueSources(theme.sources).length})`,'news-expand'));
    summary.setAttribute('aria-expanded','false');
    box.addEventListener('toggle',()=>summary.setAttribute('aria-expanded',String(box.open)));
    summary.append(number,heading);box.append(summary);
    const content=el('div',undefined,'news-theme-content');
    for(const [title,key] of [['Latest material development','latest_development'],['Market implications','market_implications']])if(theme[key])content.append(el('h4',title),el('p',theme[key]));
    if(theme.latest_development_at)content.append(el('p','Development: '+time(theme.latest_development_at),'news-theme-time'));
    for(const [title,key] of [['Positive catalysts','positive_catalysts'],['Negative catalysts','negative_catalysts'],['Unresolved questions','unresolved_questions'],['Contradictions','contradictions'],['Uncertainty','uncertainty']])if(rows(theme[key]).length){const list=el('ul');rows(theme[key]).forEach(item=>list.append(el('li',typeof item==='string'?item:item.text)));content.append(el('h4',title),list);}
    if(theme.confidence)content.append(el('p','Confidence: '+theme.confidence));
    content.append(el('h4','Supporting News · publication evidence'));
    const currentSources=sourceRows(content,theme.sources);
    if(!rows(theme.sources).length)content.append(el('p','No supporting article references are exposed for this theme.'));
    if(theme.sources_omitted)content.append(el('p',`${theme.sources_omitted} additional sources retained but not exposed in this response.`));
    const historical=uniqueSources(Object.values(theme.catalyst_support||{}).flat());
    if(historical.length){const support=el('details');support.className='news-historical-evidence';support.append(el('summary',`Historical catalyst evidence (${historical.length} article${historical.length===1?'':'s'}) · original assessed generations`));
      for(const group of historical){const existing=currentSources.get(group.key);if(existing){const p=el('p');const link=el('a',existing.headline);link.href='#'+existing.id;p.append(link,document.createTextNode(' · article listed above; original catalyst source versions below.'));support.append(p);const saved=el('details');saved.append(el('summary','Original assessed source versions'));versionRows(saved,group.versions);support.append(saved);}else sourceRows(support,group.versions);}
      content.append(support);
    }
    box.append(content);return box;
  }
  function matches(t,key){return key==='ALL'||(key==='ESCALATING'?t.status==='ESCALATING':t.scope===key);}
  function render(){
    const active=themes.filter(t=>t.status!=='RESOLVED'),matching=active.filter(t=>matches(t,filter));
    const list=$('theme-list');list.replaceChildren(...matching.slice(0,visible).map(t=>card(t,active.indexOf(t)+1)));
    if(!matching.length)list.append(el('p','No news themes match this filter.'));
    $('theme-count').textContent=`Showing ${Math.min(visible,matching.length)} of ${matching.length} available themes${filter!=='ALL'?' matching this filter':''}${tracked!==null?` · ${tracked} tracked`:''}`;
    $('show-more').hidden=visible>=matching.length&&nextOffset===null;
    $('show-more').textContent=visible<matching.length?'Show 10 More':'Load more themes';
    $('show-more').disabled=loadingMore;
    for(const button of $('theme-filters').children){const key=button.dataset.filter;button.textContent=`${{ALL:'All Themes',CRYPTO:'Crypto',MACRO:'Macro',ESCALATING:'Escalating'}[key]} (${active.filter(t=>matches(t,key)).length})`;button.setAttribute('aria-pressed',String(filter===key));}
    const history=$('theme-history');history.replaceChildren(el('summary','Historical and resolved intelligence'));
    themes.filter(t=>t.status==='RESOLVED').forEach((t,i)=>history.append(card(t,i+1)));
  }
  async function refresh(){
    generation++;loadingMore=false;
    const button=$('refresh-news');button.disabled=true;
    $('feed-status').textContent='Loading news themes…';
    try{
      const response=await fetch('https://v4.rrr.trading/v4/intelligence',{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('unavailable');const data=await response.json();
      if(data.version!=='theme-intelligence-read-v1'||data.read_only!==true||data.mode!=='paper'||data.scope!=='SHARED')throw Error('contract');
      const seen=new Set();themes=rows(data.themes).filter(t=>{if(!t||!['MACRO','CRYPTO'].includes(t.scope))return false;if(t.id&&seen.has(t.id))return false;if(t.id)seen.add(t.id);return true;});
      nextOffset=Number.isInteger(data.next_offset)&&data.next_offset>0?data.next_offset:null;pageTotal=Number.isInteger(data.total)?data.total:null;
      const overview=$('news-overview'),s=data.theme_summary||{},d=data.discovery||{};overview.replaceChildren();
      tracked=Number.isFinite(s.active_count)?s.active_count:Number.isFinite(data.omitted)?themes.length+data.omitted:null;
      const activeCount=themes.filter(t=>t.status!=='RESOLVED').length;
      const processing=rows(data.analysis?.scopes);
      const states={CLAIM_EXPIRED:'AI claim expired; retry eligible',RETRY_PENDING:'AI retry pending',IN_PROGRESS:'AI analysis in progress',DEFERRED:'AI analysis deferred',QUEUED:'AI analysis queued'};
      const state=Object.keys(states).find(key=>processing.some(row=>row.status===key));
      const reason=state?processing.find(row=>row.status===state)?.failure?.code:null;
      const pending=state?states[state]+(reason?' · '+reason:''):data.pending_status==='PENDING_UNASSESSED'?'AI analysis pending · work state unknown':data.pending_status==='NONE'?'No AI analysis pending':'AI analysis status unknown';
      for(const value of [tracked!==null?`${tracked} themes tracked`:`${activeCount} themes available`,`${s.current_verification_count??themes.filter(t=>t.status!=='RESOLVED'&&current(t)).length} within verification window`,`Collection checked ${clockTime(d.checked_at)} (${d.status||'UNKNOWN'})`,pending])overview.append(el('span',value));
      overview.title=`Collection: ${d.status||'UNKNOWN'} (${d.freshness||'UNKNOWN'}). Last successful collection ${time(d.last_successful_check)}. CURRENT uses the existing verification expiry; it does not mean the story changed or was reassessed today.`;
      const latest=key=>themes.map(t=>t[key]).filter(v=>stamp(v)).sort((a,b)=>stamp(b)-stamp(a))[0];
      $('collection-status').textContent=`Discovery: ${d.status||'UNKNOWN'} (${d.freshness||'UNKNOWN'}) · Latest attempt: ${time(d.checked_at)} · Last successful collection: ${time(d.last_successful_check)} · Latest AI assessment: ${time(s.latest_assessment_at||latest('last_assessed_at'))} · Latest verification: ${time(s.latest_verification_at||latest('last_verified_at'))} · AI analysis status: ${data.pending_status||'UNKNOWN'} · ${processing.map(row=>`${row.scope}: ${row.status}; last completed ${time(row.last_completed_at)}; last claimed ${time(row.last_claimed_at)}${row.failure?.code?'; '+row.failure.code:''}${row.failure?.provider_failure_reason?'; '+row.failure.provider_failure_reason:''}`).join(' · ')||'Processing details unavailable'}. Source checks cover exact cited article versions, not every possible development. Unchanged stories do not require new AI calls.`;
      $('feed-status').textContent=data.availability==='AVAILABLE'?'':`${data.availability||'UNKNOWN'} · News themes could not be fully verified.`;
      $('theme-limits').textContent=data.omitted?`${data.omitted} additional themes are outside this API view; only returned themes can be displayed.`:'';
      visible=10;render();
      if(data.availability!=='AVAILABLE')$('theme-list').prepend(el('p','UNAVAILABLE · News themes could not be read; any returned records retain their saved status.'));
    }catch{
      themes=[];tracked=null;nextOffset=null;pageTotal=null;$('news-overview').replaceChildren();$('collection-status').textContent='';$('theme-limits').textContent='';render();
      $('feed-status').textContent='UNAVAILABLE · News themes could not be verified.';
    }finally{button.disabled=false;}
  }
  $('theme-filters').addEventListener('click',event=>{const key=event.target.dataset.filter;if(!key)return;filter=key;visible=10;render();});
  $('show-more').addEventListener('click',async()=>{
    if(loadingMore)return;
    const matching=themes.filter(t=>t.status!=='RESOLVED'&&matches(t,filter));
    if(visible<matching.length||nextOffset===null){visible+=10;render();return;}
    loadingMore=true;const readingGeneration=generation;render();
    try{const offset=nextOffset,response=await fetch(`https://v4.rrr.trading/v4/intelligence?offset=${offset}`,{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();const data=await response.json();if(data.version!=='theme-intelligence-read-v1'||data.read_only!==true||data.mode!=='paper'||data.scope!=='SHARED'||data.availability!=='AVAILABLE'||data.offset!==offset)throw Error();
      if(readingGeneration!==generation)return;
      const saved=new Map(themes.map(t=>[t.id,t]));for(const t of rows(data.themes))if(t&&['MACRO','CRYPTO'].includes(t.scope))saved.set(t.id,t);themes=[...saved.values()];nextOffset=Number.isInteger(data.next_offset)&&data.next_offset>offset?data.next_offset:null;visible+=10;
      const omitted=pageTotal===null?data.omitted:Math.max(0,pageTotal-themes.length);$('theme-limits').textContent=omitted?`${omitted} additional themes remain available through Load more themes.`:'';$('feed-status').textContent='';
    }catch{if(readingGeneration===generation)$('feed-status').textContent='UNAVAILABLE · Additional themes could not be read; loaded themes retain their saved status.';}
    finally{if(readingGeneration===generation){loadingMore=false;render();}}
  });
  $('refresh-news').addEventListener('click',refresh);refresh();
})();

'use strict';
(() => {
  const rows=v=>Array.isArray(v)?v:[];
  const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;return n;};
  const time=v=>Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'}).format(new Date(v))+' Brisbane':'UNKNOWN';
  const group=(title,items)=>{const box=el('div');box.append(el('h4',title));const list=el('ul');for(const item of rows(items))list.append(el('li',typeof item==='string'?item:item.text));box.append(list.children.length?list:el('p','Not recorded.'));return box;};
  const same=(a,b)=>String(a||'').normalize('NFKC').replace(/[\u2018\u2019]/g,"'").replace(/\s+/g,' ').trim().toLowerCase()===String(b||'').normalize('NFKC').replace(/[\u2018\u2019]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
  function sources(host,items){for(const s of rows(items)){const row=el('p',`${s.source||'UNKNOWN'} · Published ${time(s.published_at)} · Observed ${time(s.observed_at)} `);try{const u=new URL(s.reference);if(u.protocol==='https:'&&!u.username&&!u.password){const link=el('a','Original source');link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';row.append(link);}}catch{}host.append(row);}}
  async function get(asset,theme){const u=new URL('https://v4.rrr.trading/v4/intelligence');if(asset)u.searchParams.set('asset',asset);if(theme)u.searchParams.set('theme_id',theme);const response=await fetch(u,{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('unavailable');const data=await response.json();if(data.version!=='theme-intelligence-read-v1'||data.read_only!==true||data.mode!=='paper'||data.scope!==(asset?'ASSET:'+asset.replace(/USDT$/,''):'SHARED'))throw Error('contract');return data;}
  function revision(change){
    const item=el('li');item.append(el('strong',time(change.latest_development_at)),el('p',change.latest_development),el('p',`${change.status} · ${change.resolution||'UNKNOWN'}`));
    const refs=el('details');refs.append(el('summary','Sources for this revision'));sources(refs,change.sources);item.append(refs);
    if(rows(change.related_revisions).length){const repeats=el('details');repeats.append(el('summary',`${change.related_revisions.length} repeated legacy assessments · original records`));const list=el('ol');for(const row of change.related_revisions)list.append(revision(row));repeats.append(list);item.append(repeats);}
    return item;
  }
  const age=v=>{const d=Date.now()-Date.parse(v);return !Number.isFinite(d)||d<0?'UNKNOWN':d<60000?'just now':d<3600000?`${Math.floor(d/60000)}m ago`:d<86400000?`${Math.floor(d/3600000)}h ago`:`${Math.floor(d/86400000)}d ago`;};
  function card(theme,asset,compact=false){
    const card=el('details');card.className='evolving-theme';card.dataset.themeId=theme.id;
    const summary=el('summary');summary.append(el('strong',theme.name),el('span',`${theme.status} · ${theme.freshness==='CURRENT'&&Date.parse(theme.verified_until)>Date.now()?'CURRENT': 'STALE'} · ${theme.scope}`));card.append(summary);
    if(compact){const meta=el('span');meta.className='ei-meta';const badge=el('span',theme.significance||'UNKNOWN');badge.className='ei-impact';badge.dataset.impact=theme.significance||'UNKNOWN';meta.append(badge);for(const value of [theme.scope||'UNKNOWN',theme.status||'UNKNOWN',theme.freshness==='CURRENT'&&Date.parse(theme.verified_until)>Date.now()?'CURRENT':'STALE',`Updated ${age(theme.latest_development_at)}`,`Verified ${age(theme.last_verified_at)}`])meta.append(el('span',value));summary.replaceChildren(el('strong',theme.name||'Unnamed theme'),meta);}
    const content=el('div');content.className='evolving-content';content.append(el('h4','Current understanding · Luna interpretation'),el('p',theme.understanding||theme.latest_development||'Not recorded.'),el('h4','Latest material development'),el('p',theme.latest_development||'Not recorded.'),el('p',time(theme.latest_development_at)),group('Positive catalysts',theme.positive_catalysts),group('Negative catalysts',theme.negative_catalysts),el('h4','Market implications'),el('p',theme.market_implications||'UNKNOWN'),group('Unresolved questions',theme.unresolved_questions),group('Contradictions',theme.contradictions),group('Uncertainty',theme.uncertainty),el('p',`Confidence: ${theme.confidence||'UNKNOWN'}`),el('p',`Last verification: ${time(theme.last_verified_at)} · Luna assessment: ${time(theme.last_assessed_at)}`));
    if(same(theme.understanding||theme.latest_development,theme.latest_development))content.children[1].textContent='A separate consolidated interpretation was not recorded. See the saved development below.';
    if(theme.narrative&&!same(theme.narrative,theme.understanding)&&!same(theme.narrative,theme.latest_development)){const briefing=el('div');briefing.append(el('h4','News summary'));for(const paragraph of theme.narrative.split(/\n\s*\n/).filter(p=>p.trim()))briefing.append(el('p',paragraph));content.prepend(briefing);}
    const timeline=el('details');timeline.append(el('summary','Development timeline'));let loaded=false;
    timeline.addEventListener('toggle',async()=>{if(!timeline.open||loaded)return;loaded=true;const body=el('div','Loading saved developments…');timeline.append(body);try{const data=await get(asset,theme.id);if(data.availability!=='AVAILABLE')throw Error();body.replaceChildren();const list=el('ol');for(const change of rows(data.history).sort((a,b)=>Date.parse(a.latest_development_at)-Date.parse(b.latest_development_at)))list.append(revision(change));body.append(list.children.length?list:el('p','No material revisions exposed.'));if(data.history_may_have_more)body.append(el('p','Showing up to 20 recent material revisions.'));}catch{body.textContent='UNAVAILABLE · Saved development history could not be read.';loaded=false;}});
    const refs=el('details');refs.append(el('summary','Supporting sources · publication evidence'));sources(refs,theme.sources);if(theme.sources_omitted)refs.append(el('p',`${theme.sources_omitted} additional sources retained.`));
    // Catalyst references belong to their original assessed generation.
    for(const [key,items] of Object.entries(theme.catalyst_support||{})){const support=el('details');support.append(el('summary','Original catalyst support'));sources(support,items);refs.append(support);}
    if(compact){for(const section of content.querySelectorAll(':scope > div')){if(section.querySelector('p')?.textContent==='Not recorded.')section.remove();}if(!theme.market_implications){const heading=[...content.querySelectorAll('h4')].find(h=>h.textContent==='Market implications');heading.nextElementSibling.remove();heading.remove();}const dates=el('div');dates.append(el('h4','Timeline'),el('p',`First detected: ${time(theme.first_seen_at)} · Material update: ${time(theme.latest_development_at)}`),el('p',`Verified: ${time(theme.last_verified_at)} · Luna assessment: ${time(theme.last_assessed_at)}`));if(theme.resolution)dates.append(el('p',`Resolution: ${theme.resolution}`));if(theme.relevance)dates.append(el('p',`Saved relevance: ${typeof theme.relevance==='string'?theme.relevance:JSON.stringify(theme.relevance)}`));content.append(dates);}
    content.append(timeline);if(!compact||rows(theme.sources).length||theme.sources_omitted||Object.keys(theme.catalyst_support||{}).length)content.append(refs);card.append(content);return card;
  }
  async function mount(host,{asset=null,discovery={},legacy=null,canonical=undefined}={}){
    const snapshotMode=canonical!==undefined;
    host.classList.add('evolving-intelligence');host.classList.toggle('ei-asset',!!asset);host.replaceChildren(el('p','Loading saved evolving intelligence…'));
    try{const data=snapshotMode?{...canonical,availability:canonical?.status||'UNAVAILABLE'}:await get(asset);host.replaceChildren();discovery=data.discovery||discovery;host.append(el('h3',asset?'Asset intelligence overview':'Market intelligence overview'),el('p',`${data.availability} · Pending interpretation: ${data.pending_status||'UNKNOWN'}`));
      host.append(el('p',`Discovery coverage: ${discovery.status||'UNKNOWN'} · Latest attempt: ${time(discovery.checked_at)} · Last successful collection: ${time(discovery.last_successful_check)}`));
      if(data.availability!=='AVAILABLE')host.append(el('p','UNAVAILABLE · Persistent themes could not be read.'));
      const themes=[...new Map(rows(data.availability==='AVAILABLE'?data.themes:[]).filter(t=>snapshotMode?
        ['HIGH','MEDIUM'].includes(t.significance)&&(['MACRO','CRYPTO'].includes(t.scope)||t.scope==='ASSET'&&rows(t.affected_assets).includes(asset.replace(/USDT$/,''))):
        asset?t.scope==='ASSET'&&rows(t.affected_assets).includes(asset.replace(/USDT$/,'')):['MACRO','CRYPTO'].includes(t.scope)).map(t=>[t.id,t])).values()];
      const summary=data.theme_summary||{};
      const latest=key=>themes.map(t=>t[key]).filter(v=>Number.isFinite(Date.parse(v))).sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
      host.append(el('p',`Latest Luna theme assessment: ${time(summary.latest_assessment_at||latest('last_assessed_at'))} · Latest theme verification: ${time(summary.latest_verification_at||latest('last_verified_at'))}`));
      for(const row of rows(data.analysis?.scopes))host.append(el('p',`${row.scope}: ${row.status||'UNKNOWN'} · Last completed analysis: ${time(row.last_completed_at)}${row.failure?.code?' · '+row.failure.code:''}${row.failure?.provider_failure_reason?' · '+row.failure.provider_failure_reason:''}`));
      const current=themes.filter(t=>t.status!=='RESOLVED'&&(snapshotMode||t.freshness==='CURRENT')&&Date.parse(t.verified_until)>Date.now());
      host.append(el('p',`${summary.active_count??themes.filter(t=>t.status!=='RESOLVED').length} active themes · ${summary.current_verification_count??current.length} with current verification · collection freshness is shown separately above`));
      let filters;
      if(asset){
        const stats=el('dl');stats.className='ei-stats';
        for(const [label,value] of [['Active themes',summary.active_count??themes.filter(t=>t.status!=='RESOLVED').length],['Currently verified',summary.current_verification_count??current.length],['High impact',themes.filter(t=>t.status!=='RESOLVED'&&t.significance==='HIGH').length],['Last verified',time(summary.latest_verification_at||latest('last_verified_at'))]]){
          const cell=el('div');cell.append(el('dt',label),el('dd',value));stats.append(cell);
        }
        host.insertBefore(stats,host.children[2]||null);
        // Replace the redundant count paragraph, preserving separate operational evidence.
        host.lastElementChild.remove();
        for(const p of host.querySelectorAll(':scope > p')){p.classList.add('ei-status');if(/STALE|PARTIAL|FAILED/.test(p.textContent))p.classList.add('ei-warning');}
        for(const warning of rows(discovery.warnings)){const p=el('p',typeof warning==='string'?warning:JSON.stringify(warning));p.className='ei-status ei-warning';host.append(p);}
        const controls=el('div');controls.className='ei-filters';
        const select=(label,values)=>{const wrap=el('label',label+' '),input=el('select');for(const value of values){const option=el('option',value);option.value=value;input.append(option);}wrap.append(input);controls.append(wrap);return input;};
        const impact=select('Impact',['All','HIGH','MEDIUM','LOW',...new Set(themes.map(t=>t.significance).filter(v=>v&&!['HIGH','MEDIUM','LOW'].includes(v)))]),category=select('Category',['All',...new Set(themes.map(t=>t.scope).filter(Boolean))]),count=el('span'),empty=el('p','No themes match these filters.');
        count.setAttribute('role','status');controls.append(count);host.append(controls,empty);
        filters=()=>{let matches=0;for(const row of host.querySelectorAll('.evolving-theme')){const theme=themes.find(t=>String(t.id)===row.dataset.themeId);row.hidden=!(theme&&(impact.value==='All'||theme.significance===impact.value)&&(category.value==='All'||theme.scope===category.value));if(!row.hidden)matches++;}count.textContent=matches+' matching themes';empty.hidden=matches>0;};
        impact.addEventListener('change',filters);category.addEventListener('change',filters);
      }
      const historic=el('details');historic.className='evolving-history';historic.append(el('summary','Historical and resolved intelligence'));
      for(const theme of themes){const stale=!(Date.parse(theme.verified_until)>Date.now())||(!snapshotMode&&theme.freshness!=='CURRENT');const rendered=card(snapshotMode?{...theme,freshness:stale?'STALE':'CURRENT'}:theme,theme.scope==='ASSET'?asset:null,!!asset);if(snapshotMode&&!asset)rendered.append(el('p',`Significance: ${theme.significance} · Relevance: ${typeof theme.relevance==='string'?theme.relevance:JSON.stringify(theme.relevance||'UNKNOWN')}`));(theme.status==='RESOLVED'||snapshotMode&&stale?historic:host).append(rendered);}
      if(snapshotMode){const current=themes.filter(t=>t.status!=='RESOLVED'&&Date.parse(t.verified_until)>Date.now());host.append(el('p',current.length?'Current validated themes · shared market and exact asset relevance, as available to SOL.':'MISSING / STALE · No current validated themes available to SOL. Legacy assessments are historical context only.'));}
      if(!themes.length)host.append(el('p','No saved persistent themes exposed. This does not establish absence of risk.'));
      if(data.omitted)host.append(el('p',`${data.omitted} additional themes retained beyond this bounded view.`));
      host.append(historic);if(filters)filters();
    }catch{host.replaceChildren(el('p','UNAVAILABLE · Persistent intelligence could not be verified.'));}
    if(legacy){const details=el('details');details.append(el('summary',snapshotMode?'Historical Intelligence · legacy assessments and article evidence':'Earlier saved assessments and article evidence'));details.append(legacy);host.append(details);}
  }
  window.EvolvingIntelligence=Object.freeze({mount});
})();

'use strict';
(() => {
  const rows=v=>Array.isArray(v)?v:[];
  const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;return n;};
  const time=v=>Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'}).format(new Date(v))+' Brisbane':'UNKNOWN';
  const group=(title,items)=>{const box=el('div');box.append(el('h4',title));const list=el('ul');for(const item of rows(items))list.append(el('li',typeof item==='string'?item:item.text));box.append(list.children.length?list:el('p','Not recorded.'));return box;};
  function sources(host,items){for(const s of rows(items)){const row=el('p',`${s.source||'UNKNOWN'} · Published ${time(s.published_at)} · Observed ${time(s.observed_at)} `);try{const u=new URL(s.reference);if(u.protocol==='https:'&&!u.username&&!u.password){const link=el('a','Original source');link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';row.append(link);}}catch{}host.append(row);}}
  async function get(asset,theme){const u=new URL('https://v4.rrr.trading/v4/intelligence');if(asset)u.searchParams.set('asset',asset);if(theme)u.searchParams.set('theme_id',theme);const response=await fetch(u,{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('unavailable');const data=await response.json();if(data.version!=='theme-intelligence-read-v1'||data.read_only!==true||data.mode!=='paper'||data.scope!==(asset?'ASSET:'+asset.replace(/USDT$/,''):'SHARED'))throw Error('contract');return data;}
  function card(theme,asset){
    const card=el('details');card.className='evolving-theme';card.dataset.themeId=theme.id;
    const summary=el('summary');summary.append(el('strong',theme.name),el('span',`${theme.status} · ${theme.freshness==='CURRENT'&&Date.parse(theme.verified_until)>Date.now()?'CURRENT': 'STALE'} · ${theme.scope}`));summary.append(el('p',(theme.understanding||theme.latest_development||'Understanding unavailable.').slice(0,240)));card.append(summary);
    const content=el('div');content.className='evolving-content';content.append(el('h4','Current understanding · Luna interpretation'),el('p',theme.understanding||theme.latest_development||'Not recorded.'),el('h4','Latest material development'),el('p',theme.latest_development||'Not recorded.'),el('p',time(theme.latest_development_at)),group('Positive catalysts',theme.positive_catalysts),group('Negative catalysts',theme.negative_catalysts),el('h4','Market implications'),el('p',theme.market_implications||'UNKNOWN'),group('Unresolved questions',theme.unresolved_questions),group('Contradictions',theme.contradictions),group('Uncertainty',theme.uncertainty),el('p',`Confidence: ${theme.confidence||'UNKNOWN'}`),el('p',`Last verification: ${time(theme.last_verified_at)} · Luna assessment: ${time(theme.last_assessed_at)}`));
    const timeline=el('details');timeline.append(el('summary','Development timeline'));let loaded=false;
    timeline.addEventListener('toggle',async()=>{if(!timeline.open||loaded)return;loaded=true;const body=el('div','Loading saved developments…');timeline.append(body);try{const data=await get(asset,theme.id);if(data.availability!=='AVAILABLE')throw Error();body.replaceChildren();const list=el('ol');for(const change of rows(data.history).sort((a,b)=>Date.parse(a.latest_development_at)-Date.parse(b.latest_development_at))){const item=el('li');item.append(el('strong',time(change.latest_development_at)),el('p',change.latest_development),el('p',`${change.status} · ${change.resolution||'UNKNOWN'}`));const refs=el('details');refs.append(el('summary','Sources for this revision'));sources(refs,change.sources);item.append(refs);list.append(item);}body.append(list.children.length?list:el('p','No material revisions exposed.'));if(data.history_may_have_more)body.append(el('p','Showing up to 20 recent material revisions.'));}catch{body.textContent='UNAVAILABLE · Saved development history could not be read.';loaded=false;}});
    const refs=el('details');refs.append(el('summary','Supporting sources · publication evidence'));sources(refs,theme.sources);if(theme.sources_omitted)refs.append(el('p',`${theme.sources_omitted} additional sources retained.`));
    // Catalyst references belong to their original assessed generation.
    for(const [key,items] of Object.entries(theme.catalyst_support||{})){const support=el('details');support.append(el('summary','Original catalyst support'));sources(support,items);refs.append(support);}
    content.append(timeline,refs);card.append(content);return card;
  }
  async function mount(host,{asset=null,discovery={},legacy=null}={}){
    host.classList.add('evolving-intelligence');host.replaceChildren(el('p','Loading saved evolving intelligence…'));
    try{const data=await get(asset);host.replaceChildren();discovery=data.discovery||discovery;host.append(el('h3',asset?'Asset intelligence overview':'Market intelligence overview'),el('p',`${data.availability} · Pending interpretation: ${data.pending_status||'UNKNOWN'}`));
      host.append(el('p',`Discovery coverage: ${discovery.status||'UNKNOWN'} · Latest attempt: ${time(discovery.checked_at)} · Last successful collection: ${time(discovery.last_successful_check)}`));
      if(data.availability!=='AVAILABLE')host.append(el('p','UNAVAILABLE · Persistent themes could not be read.'));
      const themes=[...new Map(rows(data.themes).filter(t=>asset?t.scope==='ASSET'&&rows(t.affected_assets).includes(asset.replace(/USDT$/,'')):['MACRO','CRYPTO'].includes(t.scope)).map(t=>[t.id,t])).values()];
      const latest=key=>themes.map(t=>t[key]).filter(v=>Number.isFinite(Date.parse(v))).sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
      host.append(el('p',`Latest Luna assessment: ${time(latest('last_assessed_at'))} · Latest relevant verification: ${time(latest('last_verified_at'))}`));
      const current=themes.filter(t=>t.status!=='RESOLVED'&&t.freshness==='CURRENT'&&Date.parse(t.verified_until)>Date.now());
      host.append(el('p',`${themes.filter(t=>t.status!=='RESOLVED').length} active themes · ${current.length} with current verification`));
      const historic=el('details');historic.className='evolving-history';historic.append(el('summary','Historical and resolved intelligence'));
      for(const theme of themes.sort((a,b)=>Date.parse(b.latest_development_at)-Date.parse(a.latest_development_at))){const stale=theme.freshness!=='CURRENT'||Date.parse(theme.verified_until)<=Date.now();(theme.status==='RESOLVED'?historic:host).append(card(theme,asset));}
      if(!themes.length)host.append(el('p','No saved persistent themes exposed. This does not establish absence of risk.'));
      if(data.omitted)host.append(el('p',`${data.omitted} additional themes retained beyond this bounded view.`));
      host.append(historic);
    }catch{host.replaceChildren(el('p','UNAVAILABLE · Persistent intelligence could not be verified.'));}
    if(legacy){const details=el('details');details.append(el('summary','Earlier saved assessments and article evidence'));details.append(legacy);host.append(details);}
  }
  window.EvolvingIntelligence=Object.freeze({mount});
})();

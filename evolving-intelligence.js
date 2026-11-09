'use strict';
(() => {
  const rows=v=>Array.isArray(v)?v:[];
  const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;return n;};
  const time=v=>Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'}).format(new Date(v))+' Brisbane':'UNKNOWN';
  const group=(title,items)=>{const box=el('div');box.append(el('h4',title));const list=el('ul');for(const item of rows(items))list.append(el('li',typeof item==='string'?item:item.text));box.append(list.children.length?list:el('p','Not recorded.'));return box;};
  const same=(a,b)=>String(a||'').normalize('NFKC').replace(/[\u2018\u2019]/g,"'").replace(/\s+/g,' ').trim().toLowerCase()===String(b||'').normalize('NFKC').replace(/[\u2018\u2019]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
  function sources(host,items){for(const s of rows(items)){const row=el('p',`${s.source||'UNKNOWN'} · Published ${time(s.published_at)} · Observed ${time(s.observed_at)} `);try{const u=new URL(s.reference);if(u.protocol==='https:'&&!u.username&&!u.password){const link=el('a',s.headline||'Original source');link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';row.append(link);}}catch{}host.append(row);}}
  async function get(asset,theme,offset=0){
    const url=new URL('https://v4.rrr.trading/v4/intelligence');
    url.searchParams.set('asset',asset);
    if(theme)url.searchParams.set('theme_id',theme);
    if(offset)url.searchParams.set('offset',offset);
    const response=await fetch(url,{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('unavailable');
    const data=await response.json();
    if(data.version!=='theme-intelligence-read-v1'||data.read_only!==true||data.mode!=='paper'||
       data.scope!=='ASSET:'+asset.replace(/USDT$/,'')||data.availability!=='AVAILABLE')throw Error('contract');
    return data;
  }
  function revision(change){
    const item=el('li');item.append(el('strong',time(change.latest_development_at)),el('p',change.latest_development),el('p',`${change.status} · ${change.resolution||'UNKNOWN'}`));
    const refs=el('details');refs.append(el('summary','Sources for this revision'));sources(refs,change.sources);item.append(refs);
    if(rows(change.related_revisions).length){const repeats=el('details');repeats.append(el('summary',`${change.related_revisions.length} repeated legacy assessments · original records`));const list=el('ol');for(const row of change.related_revisions)list.append(revision(row));repeats.append(list);item.append(repeats);}
    return item;
  }
  const age=v=>{const d=Date.now()-(typeof v==='number'?v:Date.parse(v));return !Number.isFinite(d)||d<0?'UNKNOWN':d<60000?'just now':d<3600000?`${Math.floor(d/60000)}m ago`:d<86400000?`${Math.floor(d/3600000)}h ago`:`${Math.floor(d/86400000)}d ago`;};
  function card(theme,asset){
    const card=el('details');card.className='evolving-theme';card.dataset.themeId=theme.id;
    const summary=el('summary');
    const meta=el('span');meta.className='ei-meta';
    const badge=el('span',theme.significance);badge.className='ei-impact';badge.dataset.impact=theme.significance;
    meta.append(badge,el('span',theme.status),el('span','Updated '+age(theme.latest_development_at)));
    const preview=el('span',theme.latest_development||theme.understanding);
    preview.className='ei-preview';
    summary.append(el('strong',theme.name),meta,preview);card.append(summary);
    const content=el('div');content.className='evolving-content';content.append(el('h4','Current understanding · Luna interpretation'),el('p',theme.understanding||theme.latest_development||'Not recorded.'),el('h4','Latest material development'),el('p',theme.latest_development||'Not recorded.'),el('p',time(theme.latest_development_at)),group('Positive catalysts',theme.positive_catalysts),group('Negative catalysts',theme.negative_catalysts),el('h4','Market implications'),el('p',theme.market_implications||'UNKNOWN'),group('Unresolved questions',theme.unresolved_questions),group('Contradictions',theme.contradictions),group('Uncertainty',theme.uncertainty),el('p',`Confidence: ${theme.confidence||'UNKNOWN'}`),el('p',`Last verification: ${time(theme.last_verified_at)} · Luna assessment: ${time(theme.last_assessed_at)}`));
    if(same(theme.understanding||theme.latest_development,theme.latest_development))content.children[1].textContent='A separate consolidated interpretation was not recorded. See the saved development below.';
    if(theme.narrative&&!same(theme.narrative,theme.understanding)&&!same(theme.narrative,theme.latest_development)){const briefing=el('div');briefing.append(el('h4','News summary'));for(const paragraph of theme.narrative.split(/\n\s*\n/).filter(p=>p.trim()))briefing.append(el('p',paragraph));content.prepend(briefing);}
    const timeline=el('details');timeline.append(el('summary','Development timeline'));let loaded=false;
    timeline.addEventListener('toggle',async()=>{if(!timeline.open||loaded)return;loaded=true;const body=el('div','Loading saved developments…');timeline.append(body);try{const data=await get(asset,theme.id);body.replaceChildren();const list=el('ol');for(const change of rows(data.history).sort((a,b)=>Date.parse(a.latest_development_at)-Date.parse(b.latest_development_at)))list.append(revision(change));body.append(list.children.length?list:el('p','No material revisions exposed.'));if(data.history_may_have_more)body.append(el('p','Showing up to 20 recent material revisions.'));}catch{body.textContent='UNAVAILABLE · Saved development history could not be read.';loaded=false;}});
    const refs=el('details');refs.append(el('summary','Supporting sources · publication evidence'));sources(refs,theme.sources);if(theme.sources_omitted)refs.append(el('p',`${theme.sources_omitted} additional sources retained.`));
    // Catalyst references belong to their original assessed generation.
    for(const items of Object.values(theme.catalyst_support||{})){const support=el('details');support.append(el('summary','Original catalyst support'));sources(support,items);refs.append(support);}
    for(const section of content.querySelectorAll(':scope > div')){
      if(section.querySelector('p')?.textContent==='Not recorded.')section.remove();
    }
    content.append(refs,timeline);card.append(content);return card;
  }

  async function mount(host,{asset}){
    host.classList.add('evolving-intelligence','ei-asset');
    host.setAttribute('aria-busy','true');
    host.replaceChildren(el('p','Loading saved news themes...'));
    try{
      const symbol=asset.replace(/USDT$/,'');
      const levels=['HIGH','MEDIUM','LOW'];
      const themes=new Map();
      let offset=0;
      do{
        const data=await get(asset,null,offset);
        if(!host.isConnected)return;
        for(const theme of rows(data.themes)){
          if(theme?.id&&theme.scope==='ASSET'&&rows(theme.affected_assets).length===1&&
             theme.affected_assets[0]===symbol&&levels.includes(theme.significance)&&
             rows(theme.sources).length&&!themes.has(theme.id))themes.set(theme.id,theme);
        }
        const next=data.next_offset;
        if(next!=null&&(!Number.isInteger(next)||next<=offset||next>1000))throw Error('invalid page');
        offset=next;
      }while(offset!=null);

      // Preserve the archive's canonical rank inside each significance group.
      const current=[...themes.values()].filter(theme=>theme.archived!==true&&
        theme.status!=='RESOLVED'&&theme.freshness==='CURRENT'&&Date.parse(theme.verified_until)>Date.now());
      let latest=null;
      let latestAt=0;
      for(const theme of current){
        const updated=Date.parse(theme.latest_development_at)||0;
        const verified=Date.parse(theme.last_verified_at)||0;
        const at=Math.max(updated,verified);
        if(at>latestAt){latest=theme;latestAt=at;}
      }

      const stats=el('dl');stats.className='ei-stats';
      for(const [label,value] of [
        ['Current '+symbol+' themes',current.length],
        ['High impact',current.filter(theme=>theme.significance==='HIGH').length],
        ['Latest update or verification',latest?latest.name+' / '+age(latestAt):'None']
      ]){
        const cell=el('div');cell.append(el('dt',label),el('dd',value));stats.append(cell);
      }
      host.replaceChildren(stats);
      for(const level of levels){
        for(const theme of current.filter(theme=>theme.significance===level))host.append(card(theme,asset));
      }
      if(!current.length)host.append(el('p','No current validated '+symbol+' news themes.'));
    }catch{
      host.replaceChildren(el('p','Saved news themes are unavailable.'));
    }finally{
      host.removeAttribute('aria-busy');
    }
  }
  window.EvolvingIntelligence=Object.freeze({mount});
})();

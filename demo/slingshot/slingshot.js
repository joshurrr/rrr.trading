'use strict';
(() => {
 const $=id=>document.getElementById(id), finite=v=>typeof v==='number'&&Number.isFinite(v), text=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n;};
 const money=v=>finite(v)?v.toFixed(2)+' USDT':'Unavailable', pct=v=>finite(v)?v.toFixed(2)+'%':'Unavailable', price=v=>finite(v)&&v>0?v.toLocaleString('en-US',{maximumSignificantDigits:10})+' USDT':'Unavailable';
 let native=null,report=null,received=0,busy=false,done=false;
 const metrics=[['starting_balance','Starting balance',money],['current_equity','Current equity',money],['profit_all_abs','Total P/L',money],['profit_all_pct','Total P/L %',pct],['max_drawdown','Maximum drawdown',v=>pct(finite(v)?v*100:null)],['winning_trades','Wins',v=>finite(v)?String(v):'Unavailable'],['losing_trades','Losses',v=>finite(v)?String(v):'Unavailable'],['win_rate','Win rate',pct],['open_positions','Open positions',v=>finite(v)?String(v):'Unavailable'],['closed_trades','Completed trades',v=>finite(v)?String(v):'Unavailable']];
 const fields={};for(const [key,label] of metrics){const card=text('article','');card.className='card';const value=text('strong','Loading…');fields[key]=value;card.append(text('span',label),value);$('slingshot-metrics').append(card);}
 function trades(host,rows,telemetry,closed){host.replaceChildren();host.dataset.state=rows.length?'current':'empty';if(!rows.length){host.append(text('p',closed?'No completed trades in this Slingshot run.':'No open positions reported by Slingshot.'));return;}
  for(const row of rows){const card=text('article','');card.className='slingshot-trade';const pair=typeof row.pair==='string'?row.pair:'Unavailable',symbol=pair.split('/')[0];const button=text('button',pair);if(/^[A-Z0-9]{1,30}$/.test(symbol))button.dataset.intelligenceSymbol=symbol;card.append(button);
   const saved=telemetry?.[String(row.id)]||{},entry=saved.entry||{},p=saved.protection||{},dl=text('dl','');
   const values=[['Direction',row.direction||'Unavailable'],['Entry price',price(row.open_rate)],[closed?'Exit price':'Current price',price(closed?row.close_rate:row.current_rate)],['Applied leverage',finite(row.leverage)?row.leverage+'×':'Unavailable'],[closed?'Realised P/L':'Unrealised P/L',money(row.profit_abs)],['P/L %',pct(row.profit_pct)],['Entry confidence',pct(finite(entry.confidence)?entry.confidence*100:null)],['Entry reason',entry.reason||'Saved entry evidence unavailable'],['Intelligence',entry.intelligence?Object.entries(entry.intelligence).map(([tf,f])=>`${tf}: ${f.direction||'Unavailable'} · score ${finite(f.score)?f.score:'Unavailable'} · ${f.reason_summary||'Evidence unavailable'}`).join(' | '):'Unavailable']];
   if(entry.context)values.push(['Context at entry',`News: ${entry.context.news||'Unavailable'} · macro score: ${finite(entry.context.macro)?entry.context.macro+' / 100':'Unavailable'} · volatility: ${pct(entry.context.volatility)} per 5m bar · sizing: ${entry.context.sizing||'Unavailable'} · forecast evidence: ${entry.context.edge_state||'Unavailable'}`]);
   if(!closed)values.push(['Initial protective stop',price(p.initial_stop||row.initial_stop_loss)],['Current protective stop',price(row.native_exit_status?.stop_loss_abs||row.stop_loss||p.stop)],['Trailing protection',p.trailing_active===true?'Active':p.trailing_active===false?'Not activated':'Unavailable'],['Current trailing distance (from best price)',pct(finite(p.trailing_distance)?p.trailing_distance*100:null)]);
   else values.push(['Exit reason',row.exit_reason||'Unavailable']);
   for(const [k,v] of values)dl.append(text('dt',k),text('dd',v));card.append(dl);host.append(card);
  }
 }
 function draw(){const now=Date.now(),age=finite(native?.generated_at)?now/1000-native.generated_at:Infinity;
  const n=native?.ok===true&&native.demo==='slingshot'&&native.bot?.mode==='PAPER'&&age>=-30&&age<30?native:null;
  const r=report?.bot==='slingshot'&&report.mode==='paper'&&/^slingshot-paper-/.test(report.run_id||'')?window.BotRegistry.currentReporting(report,received,report,now):null;
  const p=r?.portfolio||{},teleAge=now-Date.parse(n?.slingshot?.observed_at),s=n?.slingshot?.available===true&&teleAge>=0&&teleAge<30000?n.slingshot:null;
  $('slingshot-status').textContent=n?`Native process: ${n.bot.state||'UNKNOWN'} · PAPER only`:(done?'Owning paper runtime unavailable or stale. Deployment is not verified.':'Loading owning paper runtime…');
  $('slingshot-status').parentElement.dataset.state=n?'current':done?'unavailable':'loading';
  for(const [k,,format] of metrics){fields[k].textContent=r?format(p[k]):done?'Unavailable':'Loading…';fields[k].dataset.state=fields[k].textContent==='Unavailable'?'unavailable':r?'current':'loading';}
  $('slingshot-evaluation').textContent=s?`${s.entry_checks} entry checks · last check ${s.last_entry_check_at||'not yet observed'} · ${s.last_reason||'Reason unavailable'}`:'Current native entry evaluation evidence unavailable.';
  if(s?.policy)$('slingshot-settings').textContent=`Verified native settings: ${s.policy.max_leverage}× maximum leverage · ${pct(s.policy.initial_stop*100)} underlying initial stop. Stops never retreat.`;
  else $('slingshot-settings').textContent='Requested experiment: 2× leverage · 0.6% initial stop. Running settings unavailable until verified.';
  if(r){trades($('slingshot-open'),r.open_trades,s?.positions,false);trades($('slingshot-closed'),r.history,s?.positions,true);}
  else for(const id of ['slingshot-open','slingshot-closed']){$(id).textContent=done?'Independent trade reporting unavailable or stale. Missing data does not establish an empty account.':'Loading independent trade reporting…';$(id).dataset.state=done?'unavailable':'loading';}
  $('slingshot-freshness').textContent=r?`Run ${r.run_id} · updated ${new Date(r.observed_at).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})} Brisbane · native realized costs; no additional fee estimates deducted.`:'Current independent reporting unavailable.';
 }
 async function get(path){const r=await fetch('https://api.rrr.trading'+path,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Unavailable');return r.json();}
 async function refresh(){if(busy)return;busy=true;await Promise.allSettled([(async()=>{try{native=await get('/api/demos/slingshot/status');}catch{native=null;}})(),(async()=>{try{report=await get('/api/slingshot/reporting');received=Date.now();}catch{report=null;received=0;}})()]);done=true;busy=false;draw();}
 draw();refresh();setInterval(draw,1000);setInterval(()=>{if(!document.hidden)refresh();},15000);document.addEventListener('visibilitychange',()=>{draw();if(!document.hidden)refresh();});
})();

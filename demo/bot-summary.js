(() => {
  'use strict';
  const config = {short:['15 min Bot','Short-term','15-minute','15m'],medium:['1 hr Bot','Medium-term','1-hour','1h'],long:['4 hr Bot','Long-term','4-hour','4h']}[document.body.dataset.bot];
  const root = document.getElementById('bot-summary');
  if (!config || !root) return;
  const node = (tag, text, className) => { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; };
  const header = node('header', '', 'bot-summary-header'), title = node('h1',config[0]), subtitle = node('p',`${config[1]} paper trading · Bybit · ${config[2]} timeframe`,'bot-summary-subtitle');
  const status = node('p','Loading bot state…','bot-summary-status'); status.setAttribute('role','status');
  const scope = node('p','','bot-summary-scope');
  header.append(title,subtitle,status,scope); root.append(header);
  const fields = {};
  function section(id, name, cards) {
    const heading = node('h2',name,'section-label'); heading.id = id+'-title'; root.append(heading);
    const grid = node('section','','grid5'); grid.id=id; grid.setAttribute('aria-labelledby',heading.id);
    for (const [key,label,note] of cards) {
      const card=node('div','','card'), value=node('div','Loading…','v'); value.id=key; fields[key]=value;
      card.append(node('div',label,'k'),value);
      if (note) { const small=node('div',note,'note'); if(key==='runtime') small.id='run-start'; card.append(small); }
      grid.append(card);
    }
    root.append(grid);
  }
  section('settings','Bot settings',[['exchange','Exchange'],['starting','Starting balance'],['maxOpen','Max open positions'],['maxTrade','Max trade amount'],['runtime','Runtime','Started: loading…']]);
  const settingsNote=node('p','Loading settings…','feed-note');settingsNote.id='metrics-status';settingsNote.setAttribute('role','status');root.append(settingsNote);
  section('performance','Performance',[['winRate','Win / loss'],['profit','Total P/L','including open trades'],['profitPct','Total P/L %','including open trades'],['drawdown','Max drawdown','closed-trade equity only'],['completed','Completed trades']]);
  const performanceNote=node('p','Loading current-run reporting…','bot-summary-scope');performanceNote.id='performance-status';root.append(performanceNote);
  let raw=null, failure=null;
  const finite = v => typeof v==='number' && Number.isFinite(v);
  const count = v => Number.isSafeInteger(v) && v>=0;
  const money = v => finite(v) ? v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' USDT' : 'Unavailable';
  const pct = v => finite(v) ? (v>0?'+':'')+v.toFixed(2)+'%' : 'Unavailable';
  const date = v => Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString('en-AU',{timeZone:'Australia/Brisbane',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})+' Brisbane' : 'Unavailable';
  function metric(key,text,amount) { fields[key].textContent=text; fields[key].className='v '+(finite(amount)&&amount>0?'good':finite(amount)&&amount<0?'bad':''); }
  function refresh() {
    const now=Date.now(), age=finite(raw?.generated_at)?now/1000-raw.generated_at:null;
    const fresh=!failure && age!==null && age>=-30 && age<30 && raw?.bot?.timeframe===config[3] && raw?.bot?.mode==='PAPER';
    const b=fresh?raw.bot:{}, summary=window.V2Paper?.summary(), report=summary?.report, metadata=summary?.metadata;
    const loading=!raw&&!failure;
    const reason=loading?'Loading':failure || (raw?'Stale':'Unavailable');
    const state=fresh ? typeof b.state==='string' ? b.state.toUpperCase()==='RUNNING'?'Running':b.state : 'State unavailable' : reason;
    status.textContent=`${state} · ${fresh?'Paper trading':'Paper state unverified'}${metadata?.run_id?' · '+metadata.run_id:''}${fresh?' · Updated '+Math.max(0,Math.floor(age))+' sec ago':''}`;
    status.dataset.state=fresh&&b.state==='RUNNING'?'running':'neutral';
    scope.textContent=metadata?.run_id ? 'Reporting scope: current paper run only' : 'Current paper run metadata '+(summary?.loading?'loading':'unavailable');
    metric('exchange',typeof b.exchange==='string'&&b.exchange.trim()?b.exchange[0].toUpperCase()+b.exchange.slice(1):loading?'Loading…':'Unavailable');
    metric('maxOpen',b.max_open_trades===-1?'Unlimited':count(b.max_open_trades)?String(b.max_open_trades):loading?'Loading…':'Unavailable');
    const stake=typeof b.stake_amount==='string'&&b.stake_amount.trim()?Number(b.stake_amount):b.stake_amount;
    metric('maxTrade',b.stake_amount==='unlimited'?'Unlimited':finite(stake)&&stake>=0?money(stake):loading?'Loading…':'Unavailable');
    settingsNote.hidden=fresh; settingsNote.textContent=reason+' · native settings/state not current';
    document.getElementById('settings').classList.toggle('stale',!fresh&&!loading);
    const started=Date.parse(metadata?.started_at), validStart=Number.isFinite(started)&&started<=now;
    const minutes=validStart?Math.floor((now-started)/60000):null;
    metric('runtime',minutes===null?summary?.loading?'Loading…':'Unavailable':minutes>=1440?Math.floor(minutes/1440)+'d '+Math.floor(minutes/60)%24+'h '+minutes%60+'m':Math.floor(minutes/60)+'h '+minutes%60+'m');
    document.getElementById('run-start').textContent='Started: '+(validStart?date(metadata.started_at):'Unavailable');
    const p=report?.portfolio || {}, fallback=summary?.loading?'Loading…':'Unavailable';
    metric('starting',finite(p.starting_balance)?money(p.starting_balance):fallback);
    metric('winRate',count(p.winning_trades)&&count(p.losing_trades)?`${p.winning_trades} ${p.winning_trades===1?'win':'wins'} · ${p.losing_trades} ${p.losing_trades===1?'loss':'losses'}`:fallback);
    metric('profit',finite(p.profit_all_abs)?money(p.profit_all_abs):fallback,p.profit_all_abs);
    metric('profitPct',finite(p.profit_all_pct)?pct(p.profit_all_pct):fallback,p.profit_all_pct);
    const dd=finite(p.max_drawdown)&&p.max_drawdown>=0?-100*p.max_drawdown:null;
    metric('drawdown',dd===null?fallback:pct(dd),dd);
    metric('completed',count(p.closed_trades)?String(p.closed_trades):fallback);
    performanceNote.textContent=report?'Current paper run only · closed-trade drawdown excludes unrealized intratrade moves':summary?.loading?'Loading current-run reporting…':summary?.stale?'Stale current-run reporting · current performance unavailable':'Current-run reporting unavailable · legacy results are not substituted';
    document.getElementById('performance').classList.toggle('stale',!report&&!summary?.loading);
  }
  window.BotSummary=Object.freeze({status: d=>{raw=d;failure=null;refresh();},unavailable: reason=>{failure=reason==='STALE'?'Stale':'Unavailable';refresh();},refresh});
  window.addEventListener('v2-paper-update',refresh);setInterval(refresh,1000);
})();

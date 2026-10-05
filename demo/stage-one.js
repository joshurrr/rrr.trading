'use strict';
(() => {
  const grid=document.getElementById('stage-one-assets');
  if(!grid)return;
  const assets=[['BTC','Bitcoin'],['ETH','Ethereum'],['SOL','Solana'],['XRP','XRP'],['LINK','Chainlink'],['ONDO','Ondo'],['AAVE','Aave'],['UNI','Uniswap'],['HYPE','Hyperliquid'],['INJ','Injective']];
  let snapshot=null;
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const fresh=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&Date.now()-Date.parse(v)<=120000&&Date.parse(v)<=Date.now()+30000;
  const signed=v=>v>0?'+':v<0?'−':'';
  const el=(tag,text,className)=>{const node=document.createElement(tag);node.textContent=text;node.className=className;return node;};
  function render(){
    let available=0;
    grid.replaceChildren(...assets.map(([symbol,name])=>{
      const card=el('article','','stage-one-card');card.dataset.asset=symbol;card.dataset.tone='neutral';
      const heading=el('h3','','stage-one-name');heading.append(el('strong',symbol,''));
      if(name!==symbol)heading.append(el('span',name,''));
      const market=snapshot?.currency==='USD'&&Array.isArray(snapshot.markets)?snapshot.markets.find(m=>m?.symbol===symbol):null;
      let price='Unavailable',move=market?.updated_at&&!fresh(market.updated_at)?'Stale market data':'Market data unavailable';
      if(market&&fresh(market.updated_at)&&finite(market.price)&&market.price>0){
        available++;
        const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:market.price<10?4:2,maximumFractionDigits:market.price<10?4:2}).format(v);
        price=money(market.price);
        const trend=finite(market.change_24h)?market.change_24h:market.change;
        card.dataset.tone=trend>0?'up':trend<0?'down':'neutral';
        move=[trend>0?'▲':trend<0?'▼':'',finite(market.change)?signed(market.change)+money(Math.abs(market.change)):'Change unavailable',finite(market.change_24h)?signed(market.change_24h)+Math.abs(market.change_24h).toFixed(2)+'%':'24h unavailable'].filter(Boolean).join(' ');
        card.title='USD · '+(snapshot.source||'Public market feed')+' · observed '+new Date(market.updated_at).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' Brisbane';
      }
      card.append(heading,el('p',price,'stage-one-price'),el('p',move,'stage-one-move'));return card;
    }));
    document.getElementById('stage-one-market-status').textContent=available+'/10 current USD readings · '+(snapshot?.source||'Public market feed')+' · 24h changes · observation times on each card'+(available<10?' · missing or stale prices unavailable':'');
  }
  async function refresh(){
    try{
      const response=await fetch('https://api.rrr.trading/api/market-summary',{cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('Unavailable');
      const data=await response.json();if(data?.ok===false||!Array.isArray(data?.markets))throw new Error('Invalid market feed');
      snapshot=data;
    }catch{snapshot=null;}
    render();
  }
  render();refresh();
  setInterval(()=>{render();if(!document.hidden)refresh();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();refresh();}});
})();

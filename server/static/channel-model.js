const ChannelModel = (() => {
  const factors = [
    {id:'policy',name:'Monetary policy',icon:'◎',color:'#c8ec9b',description:'Rates, policy direction and the cost of capital.',signals:['Interest rates','Hawkish / dovish stance','Policy expectations'],weight:25},
    {id:'economy',name:'Economic health',icon:'▥',color:'#9dbfda',description:'Growth, inflation and the strength of employment.',signals:['Unemployment','Inflation','Economic growth'],weight:20},
    {id:'energy',name:'Energy & commodities',icon:'ϟ',color:'#e0bc86',description:'Energy prices, supply pressure and real assets.',signals:['Oil & gas prices','Supply constraints','Commodity prices'],weight:10},
    {id:'geopolitics',name:'Geopolitics',icon:'⊕',color:'#c1acde',description:'Conflict, policy uncertainty and global tensions.',signals:['War & conflict risk','Sanctions & trade','Political uncertainty'],weight:15},
    {id:'conditions',name:'Market conditions',icon:'≋',color:'#8dc6b8',description:'Volatility, liquidity and the health of markets.',signals:['Volatility','Liquidity','Credit stress'],weight:20},
    {id:'sentiment',name:'Sentiment & positioning',icon:'◉',color:'#d8a5b9',description:'Risk appetite and where investors are leaning.',signals:['Risk appetite','Investor positioning','Momentum'],weight:10}
  ];
  const choices = {scope:['Global','North America','Europe','Asia Pacific','United States','Australia','United Kingdom','China','Japan'],assets:['Multi-asset','Equities','Crypto','FX','Commodities'],timeframe:['Swing · days to weeks','Intraday','Position · weeks to months'],tolerance:['Conservative','Balanced','Higher risk']};
  const baseline = () => ({weights:factors.map(f=>f.weight),subweights:factors.map(()=>[1,1,1]),profile:{scope:choices.scope[0],assets:choices.assets[0],timeframe:choices.timeframe[0],tolerance:choices.tolerance[0],riskLimit:0.5}});
  const validWeights = (list,length) => Array.isArray(list) && list.length===length && list.every(n=>Number.isInteger(n)&&n>=0&&n<=100);
  const valid = config => !!config && validWeights(config.weights,6) && config.weights.some(Boolean) && Array.isArray(config.subweights) && config.subweights.length===6 && config.subweights.every((w,i)=>validWeights(w,3)&&(!config.weights[i]||w.some(Boolean))) && !!config.profile && Object.entries(choices).every(([key,items])=>items.includes(config.profile[key])) && Number.isFinite(config.profile.riskLimit) && config.profile.riskLimit>=0.1 && config.profile.riskLimit<=5;
  // Largest remainder rounding ensures the displayed shares add to exactly 100.
  function shares(weights) {
    const total=weights.reduce((a,b)=>a+b,0);
    if (!total) return weights.map(()=>0);
    const exact=weights.map(w=>w/total*100), rounded=exact.map(Math.floor);
    const order=exact.map((n,i)=>({i,remainder:n-rounded[i]})).sort((a,b)=>b.remainder-a.remainder);
    const remaining=100-rounded.reduce((a,b)=>a+b,0);
    for(let i=0;i<remaining;i++) rounded[order[i].i]++;
    return rounded;
  }
  return {factors,choices,baseline,valid,shares};
})();
if(typeof module!=='undefined') module.exports=ChannelModel;

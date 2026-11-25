// Synthetic position source labels rendered by the public homepage cards.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage();
    await page.setContent('<section id="home-demo-positions"><div class="home-positions-heading"><h2 id="home-positions-title"></h2><span id="home-positions-state"></span></div><p id="home-position-time"></p><div id="home-position-list"></div></section>');
    await page.addScriptTag({path:require('node:path').join(__dirname,'homepage-positions.js')});
    const at=new Date().toISOString(),expires=new Date(Date.now()+600000).toISOString();
    const positions=['STANDALONE_PAPER','PAIRED_PAPER','MANUAL_BYBIT_MIRROR'].map((position_type,i)=>({
      id:'fixture-'+i,symbol:['BTCUSDT','ETHUSDT','SOLUSDT'][i],side:'SHORT',position_type,
      quantity:'1',entry_price:'100',current_mark:'99',leverage:'2',entered_at:at,
      mark_observed_at:at,mark_expires_at:expires,unrealized_pnl:'1',
      financials:{position_notional_usdt:'99',margin_used_usdt:'49.5',estimated_net_pnl_usdt:'0.8',estimated_net_return_pct:'1.6'},
      protection:{status:'PROTECTED',active_stop:'101',original_stop:'101'}
    }));
    await page.evaluate(()=>{window.fetch=async()=>new Response(JSON.stringify({version:'paper-position-charts-v1',mode:'paper',items:[]}),{headers:{'Content-Type':'application/json'}})});
    await page.evaluate(data=>window.HomeDemoPositions.render(data),{version:'paper-read-api-v1',mode:'paper',served_at:at,open_positions:{availability:'AVAILABLE',items:positions},wallet:{availability:'UNAVAILABLE'}});
    assert.equal(await page.locator('.home-position').count(),3);
    assert.deepEqual(await page.locator('.home-position-type').allInnerTexts(),[
      'STANDALONE PAPER','PAIRED PAPER · BYBIT LINK','BYBIT LIVE · PAPER MIRROR'
    ]);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

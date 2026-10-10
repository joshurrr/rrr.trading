const assert = require('node:assert/strict');
const { calculate, positions } = require('./activity-performance.js');
const now = Date.parse('2026-10-10T09:00:00Z');
const date = offset => new Date(now + offset).toISOString();
const trade = (id, pnl, offset = -1000) => ({ id, pair:'BAT/USDT:USDT', direction:'LONG', open_date:date(-172800000), close_date:date(offset), profit_abs:pnl, profit_pct:pnl, current_rate:1 });
function fixture() {
  return Object.fromEntries(['short','medium','long'].map((key,i) => [key, {ok:true,generated_at:now/1000,status_observed_at:now/1000,bot:{mode:'PAPER',timeframe:['15m','1h','4h'][i],stake_currency:'USDT'},portfolio:{closed_trades:3},open_trades:[trade(10,i-1)],history:[trade(1,12),trade(2,-3,-86400000+1),trade(3,90,-86400000)]}]));
}
let data=fixture(), result=calculate(data,now);
assert.equal(result.end-result.start,86400000);
assert.equal(result.realized,27);assert.equal(result.count,6);assert.equal(result.winRate,50);assert.equal(result.openCount,3);assert.equal(result.complete,true);
data.short.open_trades.push(trade(11,4));assert.equal(calculate(data,now).openCount,4);
data=fixture();data.short.generated_at-=5;data.short.history[0].close_date=date(-6000);
assert.equal(calculate(data,now).end,now-5000,'latest common supported endpoint');
data=fixture();
assert.equal(calculate(data,now+44000).realized,27);
assert.equal(calculate(data,now+46000).realized,null);
data.short.open_trades.push({...data.short.open_trades[0]});
data.short.history.push({...data.short.history[2]});
assert.equal(calculate(data,now).openCount,3);assert.equal(calculate(data,now).count,6);
data.short.open_trades.push({...trade(10,1)});assert.equal(positions(data.short,'15m',now),null);
data=fixture();data.medium.bot.mode='LIVE';result=calculate(data,now);assert.equal(result.verified,2);assert.equal(result.complete,false);assert.equal(result.openCount,null);assert.equal(result.winRate,null);
data=fixture();data.short.history[0].profit_abs=null;assert.equal(calculate(data,now).realized,null);
data=fixture();data.short.history[0].profit_abs=0;assert.equal(calculate(data,now).realized,15);
data=fixture();data.short.history[0].close_date='bad';assert.equal(calculate(data,now).complete,false);assert.equal(calculate(data,now).realized,null);
data=fixture();data.short.history.reverse();assert.equal(calculate(data,now).complete,false);
data=fixture();data.short.portfolio.closed_trades=100;assert.equal(calculate(data,now).complete,false);
data.short.history=Array.from({length:25},(_,i)=>trade(i+100,1,-i*3600000));assert.equal(calculate(data,now).complete,true);
data.short.history=Array.from({length:25},(_,i)=>trade(i+100,1,-i*1000));assert.equal(calculate(data,now).complete,false);
data=fixture();data.short.status_observed_at-=46;assert.equal(calculate(data,now).verified,2);
data=fixture();data.short.generated_at+=31;assert.equal(calculate(data,now).verified,2);
data=fixture();data.short.bot.stake_currency='USD';assert.equal(calculate(data,now).verified,2);
data=fixture();data.short.history[0].id=10;assert.equal(calculate(data,now).realized,null);
data=fixture();data.short.history[0].close_date='2026-10-10 08:59:59';assert.equal(calculate(data,now).realized,27);
data=fixture();for(const d of Object.values(data)){d.history=[];d.portfolio.closed_trades=0;d.open_trades=[];}result=calculate(data,now);assert.equal(result.realized,0);assert.equal(result.count,0);assert.equal(result.winRate,null);assert.equal(result.openCount,0);
console.log('Accounting checks passed: exact boundary, bot-scoped IDs, duplicates/conflicts, old positions, zero, incomplete history, dates, costs preserved, stale/missing/live feeds.');

const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.join(__dirname,pathname==='/'?'index.html':pathname);if(!file.startsWith(__dirname+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,bytes)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(bytes);});});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage(),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://stream.radiorrr.com/**',r=>r.abort());
    await page.route('https://api.rrr.trading/**',r=>{requests.push(r.request().url());const p=new URL(r.request().url()).pathname;return r.fulfill(p.endsWith('/opportunities')?{json:{universe_sync:{selected_symbols:[]}}}:{status:503,json:{ok:false}});});
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(()=>window.ActivityPerformance&&document.querySelector('#homepage-position-warning').textContent.includes('0 of 3'));
    const push=async data=>page.evaluate(data=>{for(const d of Object.values(data)){d.generated_at=Date.now()/1000;d.status_observed_at=d.generated_at;for(const t of d.history)t.close_date=new Date(Date.now()-1000-t.id*1000).toISOString();}window.homepageBotStatus=data;window.dispatchEvent(new Event('homepage-bot-status'));},data);
    data=fixture();await push(data);
    assert.equal(await page.locator('[data-performance="net"]').innerText(),'Unavailable');
    assert.equal(await page.locator('[data-performance="realized"]').innerText(),'+297.00 USDT');
    assert.equal(await page.locator('[data-open-position]').count(),3);
    assert.match(await page.locator('[data-open-position]').first().innerText(),/Current unrealised P\/L/i);
    assert.equal(await page.locator('[data-open-position] [data-tone="down"]').count(),1);
    assert.equal(await page.locator('[data-open-position] [data-tone="up"]').count(),1);
    const original=await page.locator('[data-open-position]').first().elementHandle();
    data.short.open_trades[0].profit_abs=5;data.short.open_trades[0].profit_pct=5;await push(data);
    assert.ok(await original.evaluate(n=>n.isConnected),'P/L update retains the row DOM');
    assert.match(await page.locator('[data-open-position]').first().innerText(),/\+5.00 USDT/);
    const before=requests.length;await push(data);assert.equal(requests.length,before,'render performs no extra polling');
    fs.mkdirSync(path.join(__dirname,'.runtime'),{recursive:true});
    for(const width of [320,375,768,1440]){
      await page.setViewportSize({width,height:1000});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`no overflow ${width}`);
      await page.locator('#live-candidate-progress').screenshot({path:path.join(__dirname,'.runtime',`activity-performance-${width}.png`)});
    }
    data.short.open_trades=[];await push(data);assert.equal(await page.locator('[data-open-position]').count(),2);
    await page.evaluate(()=>{window.homepageBotStatus={};window.dispatchEvent(new Event('homepage-bot-status'));});
    assert.equal(await page.locator('[data-performance="realized"]').innerText(),'Unavailable');
    assert.equal(await page.locator('[data-open-position]').count(),0);
    assert.match(await page.locator('[data-performance-updated]').innerText(),/current feeds missing\/stale/);
    assert.deepEqual(errors,[]);
    console.log('Browser checks passed: all bots, P/L tones, preserved update DOM, close/outage, no render polling, 320/375/768/1440.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

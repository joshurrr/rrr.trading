'use strict';
const {test,expect}=require('@playwright/test');

test('Overview polls, separates request failure from source expiry, and recovers',async({page})=>{
  const initial=Date.parse('2026-11-14T06:00:00Z');
  await page.clock.install({time:initial});
  await page.clock.pauseAt(initial+1);
  let calls=0,source=initial,releaseTimeout;
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1')return route.continue();
    if(url.href!=='https://v4.rrr.trading/v4/paper')return route.abort();
    calls++;
    if(calls===2)return route.fulfill({status:503});
    if(calls===4)source=initial+90000;
    if(calls===5){
      await new Promise(resolve=>{releaseTimeout=resolve;});
      return route.abort().catch(()=>{});
    }
    if(calls===6)source=initial+150000;
    const iso=value=>new Date(value).toISOString();
    return route.fulfill({json:{version:'paper-read-api-v1',mode:'paper',served_at:iso(initial+(calls-1)*30000),
      market_prices:{BTCUSDT:{symbol:'BTCUSDT',source:'bybit',availability:'AVAILABLE',price:67000,change_24h_pct:1,
        source_at:iso(source),observed_at:iso(source),expires_at:iso(source+45000)}},overview:{}}});
  });
  await page.goto('/');
  const home=page.frameLocator('#page-content');
  const btc=home.locator('.home-market-card').first();
  await expect(btc).toHaveAttribute('data-state','CURRENT');
  await page.clock.fastForward(30000);
  await expect(home.locator('#home-market-updated')).toContainText('Refresh failed');
  await expect(btc).toHaveAttribute('data-state','CURRENT');
  await expect.poll(()=>home.locator('body').evaluate(()=>v4FinancialDiagnostics.consecutive_failures)).toBe(1);
  await page.clock.fastForward(30000);
  await expect(btc).toHaveAttribute('data-state','STALE');
  await expect(home.locator('#home-market-updated')).not.toContainText('Refresh failed');
  await expect.poll(()=>home.locator('body').evaluate(()=>v4FinancialDiagnostics.source_age_ms.btc)).toBeGreaterThanOrEqual(60000);
  await page.clock.fastForward(30000);
  await expect(btc).toHaveAttribute('data-state','CURRENT');
  const diagnostics=await home.locator('body').evaluate(()=>v4FinancialDiagnostics);
  expect(diagnostics.consecutive_failures).toBe(0);
  expect(diagnostics.actual_interval_ms).toBe(30000);
  expect(diagnostics.last_attempted_refresh).toBeTruthy();
  expect(diagnostics.last_successful_refresh).toBeTruthy();
  expect(diagnostics.request_duration_ms).toBeGreaterThanOrEqual(0);
  expect(calls).toBe(4);
  await page.clock.fastForward(30000);
  await expect.poll(()=>Boolean(releaseTimeout)).toBe(true);
  await home.locator('body').evaluate(()=>{void refreshV4Overview();});
  expect(calls).toBe(5);
  await page.clock.fastForward(10000);
  await expect.poll(()=>home.locator('body').evaluate(()=>v4FinancialDiagnostics.state)).toBe('API_TIMEOUT');
  releaseTimeout();
  await page.clock.fastForward(20000);
  await expect.poll(()=>home.locator('body').evaluate(()=>v4FinancialDiagnostics.consecutive_failures)).toBe(0);
  await expect(btc).toHaveAttribute('data-state','CURRENT');
  expect(calls).toBe(6);
});

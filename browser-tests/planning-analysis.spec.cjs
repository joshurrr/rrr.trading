'use strict';
const {test,expect}=require('@playwright/test');

for(const width of [1440,390])test(`planning cards reuse Asset Analysis and exact saved decisions at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:950});
  const now=new Date().toISOString(),old=new Date(Date.now()-3600000).toISOString(),expires=new Date(Date.now()+3600000).toISOString();
  const symbols=['NEAR','BEAM','HYPE','AKE','1000PEPE'];
  const rows=symbols.map((symbol,i)=>({symbol:symbol+'USDT',exchange:'bybit',instrument_type:'linear_perpetual',side:i===1?'LONG':'SHORT',rank:i+1,timeframe:'1h',observed_at:now,expires_at:i===3?old:expires,state:'CURRENT',provenance:{}}));
  const decision=(row,key,timestamp,reasoning)=>({symbol:row.symbol,request_key:key,timestamp,decision:row.side,reasoning,assessment_completed:true,execution:'OPENED',source:'retained_position'});
  const original=rows.map((r,i)=>decision(r,String(i+1).repeat(64),old,`${r.symbol} originating reasoning`));
  const assets=rows.map((r,i)=>({identity:{exchange:r.exchange,instrument_id:r.symbol,instrument_type:r.instrument_type},selection:r,technical:{},luna:{status:'NOT_ASSESSED'},sol:{records:[{...decision(r,'f'.repeat(64),now,`${r.symbol} newest unrelated reasoning`),decision:['SHORT','LONG','PROTECT','HOLD','WAIT'][i],decision_input:i===0?{snapshot:{evidence:{'technical.5m':{state:'AVAILABLE',data:{direction:'UP'}},'technical.1h':{state:'AVAILABLE',data:{direction:'DOWN'}}}}}:undefined},...([0,2].includes(i)?[original[i]]:[])]},positions:[],trades:[]}));
  const shortlists=Object.fromEntries(['LONG','SHORT'].map(side=>[side,{state:'CURRENT',observed_at:now,expires_at:expires,items:rows.filter(r=>r.side===side)}]));
  const plans=rows.map((r,i)=>({symbol:r.symbol,side:r.side,status:i===1?'CLAIMED':'PENDING',action:'WAIT_FOR_BREAKOUT',created_at:old,expires_at:expires,last_candle_at:now,...(i!==2?{request_key:original[i].request_key}:{}),...(i===1?{originating_decision:{...original[i],execution:null,source:'entry_plan'}}:{}),...(i===4?{originating_decision:{...original[i],symbol:'WRONGUSDT'}}:{})}));
  const paper={version:'paper-read-api-v1',mode:'paper',served_at:now,open_positions:{availability:'AVAILABLE',items:[{id:'fixture-position',symbol:'NEARUSDT',exchange:'bybit',side:'SHORT',availability:'AVAILABLE',quantity:'1',entry_price:'100',current_mark:'99',unrealized_pnl:'1',leverage:'1',entered_at:old,mark_observed_at:now,mark_expires_at:expires}]},completed_trades:{availability:'AVAILABLE',items:[]},overview:{shortlists},sol_activity:{version:'sol-activity-v1',mode:'paper',availability:'AVAILABLE',source_at:now,expires_at:expires,entries_enabled:true,active_count:5,items:plans}};
  const errors=[],api=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://v4.rrr.trading/**',route=>{api.push([route.request().method(),route.request().url()]);return route.fulfill({json:route.request().url().endsWith('/v4/asset-analysis')?{version:'asset-analysis-read-v1',mode:'paper',read_only:true,availability:'AVAILABLE',shortlists,assets}:paper});});
  await page.route('https://api.rrr.trading/**',r=>r.fulfill({json:{}}));
  await page.route('https://api.bybit.com/**',r=>r.fulfill({json:{retCode:0,result:{list:[]}}}));
  await page.route('https://stream.radiorrr.com/**',r=>r.fulfill({body:''}));
  await page.goto('/');
  const frame=page.frameLocator('#page-content'),modal=page.locator('#homepage-analysis-modal');
  for(let i=0;i<symbols.length;i++){
    const trigger=frame.locator('.sol-plan-card').filter({hasText:symbols[i]+' '});
    await expect(trigger).toBeVisible();await trigger.scrollIntoViewIfNeeded();await trigger.focus();
    const before=await trigger.evaluate(()=>({x:scrollX,y:scrollY}));
    if(i===0)await page.keyboard.press('Enter');else if(i===1)await page.keyboard.press('Space');else await trigger.click();
    await expect(modal).toBeVisible();await expect(modal.locator('.aa-identity-ticker')).toHaveText(symbols[i]);
    await expect(modal.locator('.aa-identity-subtitle')).toHaveText('Asset Analysis');
    await expect(modal.locator('[data-freshness]')).toHaveText(i===3?'STALE':'CURRENT');
    if(i===3){
      await expect(modal.locator('.aa-identity-name')).toHaveText('Akedo');
      const logo=modal.locator('.aa-identity-banner img');
      await expect(logo).toHaveAttribute('src','/assets/analysis-logos/akedo.png');
      await expect(logo).toBeVisible();
      await page.screenshot({path:`.runtime/akedo-analysis-${width}.png`});
    }else await expect(modal.locator('.aa-identity-banner .aa-logo-fallback')).toBeVisible();
    await expect(modal.getByRole('tab',{name:'AI Decisions',exact:true})).toHaveAttribute('aria-selected','true');
    await expect(modal.getByRole('heading',{name:'LATEST AI TRADING DECISION',exact:true})).toBeVisible();
    await expect(modal.locator('.aa-decision-card')).toContainText(symbols[i]+'USDT newest unrelated reasoning');
    const latest=modal.locator('.aa-decision-card');
    await expect(latest.locator('.aa-decision-heading > span').first()).toHaveText(['SHORT','LONG','PROTECT','HOLD','WAIT'][i]);
    await expect(latest.locator('.aa-decision-heading > span').first()).toHaveCSS('color',['rgb(255, 159, 159)','rgb(138, 227, 180)','rgb(255, 189, 115)','rgb(184, 199, 214)','rgb(184, 199, 214)'][i]);
    await expect(latest.locator('.aa-sol-timestamp')).toBeVisible();
    await expect(latest.locator('details[open]')).toHaveCount(0);
    await expect(latest.locator('.aa-sol-directions')).toHaveCount(i===0?1:0);
    if(i===0){
      for(const viewportWidth of [1440,768,390,320]){
        await page.setViewportSize({width:viewportWidth,height:950});
        for(const name of ['Overview','Technical Analysis','News & Intelligence','AI Decisions','Trade History']){
          const tab=modal.getByRole('tab',{name,exact:true});await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');
          await expect.poll(()=>modal.locator('.homepage-analysis-dialog').evaluate(d=>{
            const r=d.getBoundingClientRect(),b=d.querySelector('.homepage-analysis-body');
            return Math.abs(r.width-Math.min(800,innerWidth-32))<1&&Math.abs(r.left-(innerWidth-r.width)/2)<1&&Math.abs(r.top-(innerHeight-r.height)/2)<1&&Math.abs(r.height-innerHeight*(innerWidth>800?.95:.9))<1&&b.scrollWidth<=b.clientWidth+1&&getComputedStyle(document.body).overflow==='hidden';
          })).toBe(true);
        }
      }
      await page.setViewportSize({width,height:950});
      await modal.getByRole('tab',{name:'AI Decisions',exact:true}).click();
      await expect(latest.locator('.aa-sol-directions > span')).toHaveText(['5m ↑ UP','1h ↓ DOWN']);
      await latest.locator('.aa-evidence > summary').click();
      expect(JSON.parse(await latest.locator('.aa-evidence pre').textContent())).toEqual(assets[0].sol.records[0].decision_input);
      await latest.locator('.aa-evidence > summary').click();
    }

    await expect(modal.getByRole('heading',{name:'RESEARCH STATUS'})).toBeVisible();
    await expect(modal.locator('#asset-analysis-detail')).toContainText('OPENED records a paper position opening');
    if(i<2){
      const matched=modal.locator('.aa-decision-row.aa-plan-origin');await expect(matched).toHaveAttribute('open','');
      await expect(matched).toContainText(symbols[i]+'USDT originating reasoning');
      await matched.locator(':scope > summary').click();await expect(matched).not.toHaveAttribute('open','');
      await matched.locator(':scope > summary').click();await matched.locator('.aa-technical-details > summary').click();
      await expect(matched.locator('.aa-technical-details')).toHaveAttribute('open','');
    }else{
      await expect(modal.locator('.aa-plan-link-status')).toContainText(i===2?'no reliable saved decision reference':'unavailable in the returned records');
      await expect(modal.locator('.aa-plan-origin')).toHaveCount(0);
    }
    if(i===1)await expect(modal.locator('.aa-plan-context')).toContainText('fill');
    await modal.getByRole('tab',{name:'Trade History',exact:true}).click();
    await modal.getByRole('tab',{name:'AI Decisions',exact:true}).click();
    await expect(modal.locator('.aa-plan-context')).toBeVisible();
    if(i===0){
      await modal.locator('.homepage-analysis-body').evaluate(n=>n.scrollTop=0);
      await latest.scrollIntoViewIfNeeded();
      await page.screenshot({path:`.runtime/planning-analysis-${width}.png`});
      expect(await modal.locator('.homepage-analysis-body').evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
      await modal.getByRole('button',{name:'Close Asset Analysis'}).focus();await page.keyboard.press('Shift+Tab');await expect(modal.locator('.aa-decision-row .aa-evidence > summary').last()).toBeFocused();
      await page.keyboard.press('Tab');await expect(modal.getByRole('button',{name:'Close Asset Analysis'})).toBeFocused();
    }
    if(i%2)await modal.getByRole('button',{name:'Close Asset Analysis'}).click();else await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();await expect(trigger).toBeFocused();
    expect(await trigger.evaluate(()=>({x:scrollX,y:scrollY}))).toEqual(before);
  }
  // A normal entry point still starts on Overview and carries no plan state.
  const normal=frame.locator('#home-position-list .home-position').first();await normal.locator('.home-position-name h3').click();
  await expect(modal.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');
  await modal.getByRole('tab',{name:'AI Decisions',exact:true}).click();
  await expect(modal.locator('.aa-plan-context,.aa-plan-origin')).toHaveCount(0);
  expect(api.every(([method])=>method==='GET')).toBe(true);expect(errors).toEqual([]);
});

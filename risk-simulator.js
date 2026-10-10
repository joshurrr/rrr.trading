/* Homepage-only simulation. No network or trading configuration integration. */
(() => {
  'use strict';
  const key = 'rrr.trading.visitor.risk.v1';
  const defaults = Object.freeze({leverage: 1.5, margin: 500, positions: 4, lossLimit: 100});
  const bounds = {leverage: [1, 2, .1], margin: [100, 1000, 25], positions: [1, 4, 1], lossLimit: [25, 500, 25]};
  // This versioned DTO belongs only to the simulator. Future authenticated
  // configuration requires a separate account-specific, backend-validated contract.
  function valid(record) {
    return record && record.version === 1 && Object.entries(bounds).every(([name, [min, max, step]]) => {
      const v = record.settings?.[name];
      return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && Math.abs((v-min)/step-Math.round((v-min)/step)) < 1e-8;
    });
  }
  const open = document.getElementById('risk-open');
  if (!open) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'risk-dialog';
  dialog.setAttribute('aria-labelledby', 'risk-title');
  dialog.innerHTML = `<div class="risk-heading"><div><span class="risk-kicker">LOCAL SIMULATOR</span><h2 id="risk-title">CUSTOMISE YOUR TRADING RISK</h2></div><button type="button" id="risk-close" aria-label="Close risk simulator">×</button></div>
    <p>Explore how leverage and position sizing affect potential profits, losses and trading exposure.</p>
    <div class="risk-profiles" role="group" aria-label="Leverage presets"><button type="button" data-risk-preset="1">Conservative <strong>1×</strong><small>Lower exposure</small></button><button type="button" data-risk-preset="1.5">Balanced <strong>1.5×</strong><small>Moderate exposure</small></button><button type="button" data-risk-preset="2">Aggressive <strong>2×</strong><small>Higher exposure</small></button></div>
    <p id="risk-profile" class="risk-kicker"></p><div class="risk-controls"></div>
    <div class="risk-results" role="status" aria-live="polite" aria-atomic="true"></div>
    <h3>LONG POSITION · UNREALISED P/L SCENARIOS</h3><div class="risk-scenarios"></div>
    <p class="risk-note">One long position. Fees, funding, slippage, liquidation and exchange maintenance margin are excluded. Leverage does not change the probability of winning. Losses can exceed allocated margin under certain conditions.</p>
    <div class="risk-actions"><button type="button" id="risk-save">SAVE PREFERENCES</button><button type="button" id="risk-reset">RESET TO DEFAULTS</button></div><p id="risk-message" role="status"></p>
    <p class="risk-disclaimer">Simulation only. These settings do not affect live or paper trading. Leverage increases financial risk.</p>`;
  document.body.append(dialog);
  let settings = {...defaults}, storageMessage = '';
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const record = JSON.parse(raw);
      if (valid(record)) settings = {...record.settings};
      else storageMessage = 'Saved settings were invalid. Defaults restored.';
    }
  } catch { storageMessage = 'Saved preferences unavailable. Settings work for this visit.'; }
  const labels = {leverage: 'Leverage · 1×–2×', margin: 'Maximum trade margin allocation · USDT', positions: 'Maximum simultaneous positions', lossLimit: 'Daily loss limit · USDT'};
  Object.entries(bounds).forEach(([name, [min,max,step]]) => {
    const label = document.createElement('label');
    label.htmlFor = 'risk-'+name;
    label.textContent = labels[name];
    const output = document.createElement('output'); output.id = 'risk-value-'+name;
    output.htmlFor = 'risk-'+name; label.append(output);
    const input = document.createElement('input'); input.type = 'range'; input.id = 'risk-'+name;
    input.min = min; input.max = max; input.step = step;
    input.addEventListener('input', () => {settings[name] = Math.min(max,Math.max(min,Number(input.value))); render();});
    label.append(input);
    if (name === 'margin' || name === 'lossLimit') {
      const note = document.createElement('small');
      note.textContent = name === 'margin' ? 'Margin per position, before leverage; not total exposure.' : 'Hypothetical new-entry cutoff; no protection is enforced.';
      label.append(note);
    }
    dialog.querySelector('.risk-controls').append(label);
  });
  const money = v => v.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})+' USDT';
  function card(parent, label, value, note, className = '') {
    const el = document.createElement('div'); el.className = className;
    const caption = document.createElement('span'); caption.textContent = label;
    const strong = document.createElement('strong'); strong.textContent = value;
    el.append(caption,strong);
    if (note) {const small = document.createElement('small');small.textContent = note;el.append(small);}
    parent.append(el);
  }
  function render() {
    for (const name of Object.keys(bounds)) {
      dialog.querySelector('#risk-'+name).value = settings[name];
      dialog.querySelector('#risk-value-'+name).textContent = name === 'leverage' ? settings[name]+'×' : name === 'positions' ? settings[name] : money(settings[name]);
    }
    const profile = {1:'Conservative',1.5:'Balanced',2:'Aggressive'}[settings.leverage] || 'Custom';
    dialog.querySelector('#risk-profile').textContent = 'Selected profile: '+profile;
    dialog.querySelectorAll('[data-risk-preset]').forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.riskPreset) === settings.leverage));
    const exposure = settings.margin * settings.leverage;
    const results = dialog.querySelector('.risk-results');results.replaceChildren();
    card(results,'Selected leverage',settings.leverage+'×');
    card(results,'Maximum position exposure',money(exposure));
    card(results,'Maximum portfolio exposure',money(exposure*settings.positions));
    card(results,'Simulated daily loss limit',money(settings.lossLimit));
    const scenarios = dialog.querySelector('.risk-scenarios');scenarios.replaceChildren();
    [-5,-2,-1,1,2,5].forEach(move => card(scenarios,(move>0?'+':'')+move+'% price move',(move>0?'+':'')+money(exposure*move/100),(move>0?'+':'')+(move*settings.leverage).toFixed(2)+'% on margin',move>0?'risk-profit':'risk-loss'));
  }
  dialog.querySelectorAll('[data-risk-preset]').forEach(b => b.addEventListener('click',()=>{settings.leverage=Number(b.dataset.riskPreset);render();}));
  function persist() {
    try {localStorage.setItem(key,JSON.stringify({version:1,settings}));return true;}
    catch {return false;}
  }
  dialog.querySelector('#risk-save').addEventListener('click',()=>{
    dialog.querySelector('#risk-message').textContent = persist() ? 'Preferences saved in this browser. Simulator only.' : 'Cannot save in this browser. Settings work for this visit only.';
  });
  dialog.querySelector('#risk-reset').addEventListener('click',()=>{
    settings={...defaults};render();
    dialog.querySelector('#risk-message').textContent = persist() ? 'Defaults restored and saved.' : 'Defaults restored for this visit. Browser storage unavailable.';
  });
  let previousOverflow, outside = false;
  open.addEventListener('click',()=>{
    previousOverflow=document.body.style.overflow;
    dialog.showModal();document.body.style.overflow='hidden';open.setAttribute('aria-expanded','true');dialog.querySelector('#risk-close').focus();
  });
  dialog.querySelector('#risk-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{document.body.style.overflow=previousOverflow;open.setAttribute('aria-expanded','false');open.focus({preventScroll:true});});
  const isOutside = e => {const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
  dialog.addEventListener('pointerdown',e=>{outside=isOutside(e);});
  dialog.addEventListener('pointerup',e=>{if(outside&&isOutside(e))dialog.close();outside=false;});
  dialog.addEventListener('keydown',e=>{
    if(e.key!=='Tab')return;
    const nodes=[...dialog.querySelectorAll('button,input')];const first=nodes[0],last=nodes[nodes.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });
  render();dialog.querySelector('#risk-message').textContent=storageMessage;
})();

const field = (name, label, value, extra = '') => `<label>${label}<input name="${name}" type="number" min="0.00000001" step="any" value="${value}" required ${extra}></label>`;
function calculator(type) {
  const size = type === 'size';
  return `<span class="concept">PLANNING TOOL</span><h2 id="dialog-title">${size ? 'Position size calculator' : 'Risk / reward planner'}</h2><p>${size ? 'Estimate your position from your account value, risk limit and stop distance.' : 'Compare your potential loss at the stop with your potential gain at the target.'}</p><form id="calculator"><div class="field-grid">${size ? field('account','Account value ($)',10000) + field('risk','Account risk (%)',1,'max="100"') : '<label>Direction<select name="direction"><option value="long">Long</option><option value="short">Short</option></select></label>'}${field('entry','Entry price ($)',100)}${field('stop','Stop price ($)',95)}${size ? '' : field('target','Target price ($)',115)}</div><button class="button" type="submit">Calculate <span>↗</span></button><p class="error" id="calc-error" role="alert"></p><output class="result" id="calc-result" aria-live="polite" hidden></output></form><p><small>For linear, unit-based instruments in the same currency. Excludes fees, slippage, leverage and contract multipliers. Stops do not guarantee a maximum loss.</small></p>`;
}
function setupCalculator(type) {
  const form = document.querySelector('#calculator'), result = document.querySelector('#calc-result'), error = document.querySelector('#calc-error');
  form.addEventListener('input', () => { result.hidden = true; error.textContent = ''; });
  form.addEventListener('submit', event => {
    event.preventDefault(); result.hidden = true; error.textContent = '';
    const data = Object.fromEntries(new FormData(form)), entry = Number(data.entry), stop = Number(data.stop);
    if (!(entry > 0 && stop > 0) || !Number.isFinite(entry + stop) || entry === stop) { error.textContent = 'Enter positive prices with a stop different from entry.'; return; }
    const money = value => value.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
    if (type === 'size') {
      const account = Number(data.account), risk = Number(data.risk);
      if (!(account > 0 && risk > 0 && risk <= 100) || !Number.isFinite(account + risk)) { error.textContent = 'Enter a positive account value and risk above 0 and up to 100%.'; return; }
      const amount = account * risk / 100, units = amount / Math.abs(entry - stop), notional = units * entry;
      if (!Number.isFinite(units + notional)) { error.textContent = 'These inputs are too large. Please use smaller values.'; return; }
      result.innerHTML = `<span>Estimated position · ${stop < entry ? 'Long' : 'Short'}</span><strong>${units.toLocaleString('en-US',{maximumFractionDigits:8})} units</strong><small>Risk at stop: ${money(amount)} · Position value: ${money(notional)}</small>${notional > account ? '<small>Position value exceeds the account balance. Check available buying power or reduce risk.</small>' : ''}`;
    } else {
      const target = Number(data.target), long = data.direction === 'long';
      if (!(target > 0) || !Number.isFinite(target) || (long ? !(stop < entry && target > entry) : !(stop > entry && target < entry))) { error.textContent = long ? 'For a long, the stop must be below entry and target above entry.' : 'For a short, the stop must be above entry and target below entry.'; return; }
      const risk = Math.abs(entry - stop), reward = Math.abs(target - entry), ratio = reward / risk;
      if (!Number.isFinite(ratio)) { error.textContent = 'These inputs are too large. Please use smaller values.'; return; }
      result.innerHTML = `<span>Risk : potential reward</span><strong>1 : ${ratio.toLocaleString('en-US',{maximumFractionDigits:2})}</strong><small>Risk per unit: ${money(risk)} · Potential reward per unit: ${money(reward)}</small>`;
    }
    result.hidden = false;
  });
}

const dialog = document.querySelector('#tool-dialog');
const content = document.querySelector('#dialog-content');
document.querySelector('#year').textContent = new Date().getFullYear();
let macro = null;
let macroMessage = 'Waiting for the first analysis';
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-filter]').forEach(item => {
    item.classList.toggle('selected', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  });
  let count = 0;
  document.querySelectorAll('[data-category]').forEach(card => {
    card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter;
    if (!card.hidden) count++;
  });
  document.querySelector('#filter-status').textContent = `Showing ${count} tools`;
}));

function macroDetail() {
  if (!macro) return `<span class="concept">AWAITING ANALYSIS</span><h2 id="dialog-title">The macro picture, in focus.</h2><p>A snapshot of the wider environment, with a score, supporting signals and the time of the latest analysis.</p><div class="dialog-score">— <small>/ 100</small></div><p>${escapeHtml(macroMessage)}. No current market score is available.</p><ul class="detail-list"><li>Monetary policy <span>Rates &amp; central banks</span></li><li>Liquidity <span>Availability of capital</span></li><li>Growth &amp; inflation <span>Economic momentum</span></li><li>Market sentiment <span>Risk appetite</span></li></ul><p>These are proposed inputs. The scoring methodology and data sources will be defined before publishing analysis.</p>`;
  const stale = Date.now() > Date.parse(macro.validUntil);
  return `<span class="concept">${stale ? 'UPDATE OVERDUE' : 'PUBLISHED ANALYSIS'}</span><h2 id="dialog-title">Macro analysis</h2><div class="dialog-score">${macro.score} <small>/ 100</small></div><p>${escapeHtml(macro.label)}</p><p>${escapeHtml(macro.summary)}</p><ul class="detail-list">${macro.signals.map(signal => `<li>${escapeHtml(signal.name)}<span>${escapeHtml(signal.value)}</span></li>`).join('')}</ul><p>Updated ${escapeHtml(new Date(macro.updatedAt).toLocaleString())}. ${stale ? 'This analysis has passed its intended refresh time.' : ''}</p><p><small>${escapeHtml(macro.methodology)}</small></p>`;
}

async function loadMacro() {
  try {
    const response = await fetch('data/macro.json', {cache:'no-store'});
    if (!response.ok) throw new Error('Data unavailable');
    const data = await response.json();
    if (data.status === 'pending') { macro = null; macroMessage = 'Waiting for the first analysis'; }
    else {
      if (data.status !== 'published' || !Number.isFinite(data.score) || data.score < 0 || data.score > 100 || !Number.isFinite(Date.parse(data.updatedAt)) || !Number.isFinite(Date.parse(data.validUntil)) || Date.parse(data.validUntil) <= Date.parse(data.updatedAt) || Date.parse(data.updatedAt) > Date.now() + 60000 || !['label','summary','methodology'].every(key => typeof data[key] === 'string' && data[key].trim()) || !Array.isArray(data.signals) || !data.signals.every(signal => signal && typeof signal.name === 'string' && typeof signal.value === 'string')) throw new Error('Invalid analysis');
      macro = data;
    }
  } catch {
    macro = null;
    macroMessage = 'Analysis is temporarily unavailable';
  }
  const stale = macro && Date.now() > Date.parse(macro.validUntil);
  document.querySelector('#macro-score').textContent = macro ? macro.score : '—';
  document.querySelector('#macro-label').textContent = macro ? macro.label : macroMessage;
  document.querySelector('#macro-status').textContent = macro ? (stale ? 'UPDATE OVERDUE' : 'PUBLISHED') : 'AWAITING DATA';
  document.querySelector('#macro-mode').textContent = macro ? new Date(macro.updatedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : 'NOT CONNECTED';
  document.querySelector('#score-arc').style.strokeDasharray = `${macro ? macro.score / 100 * 236 : 0} 236`;
  if (dialog.open && dialog.dataset.tool === 'macro') content.innerHTML = macroDetail();
}
loadMacro();
setInterval(loadMacro, 300000);

const previews = {
  brief: `<span class="concept">TOOL PREVIEW</span><h2 id="dialog-title">Your daily market brief.</h2><p>A focused read to help you start with context, before getting into individual setups.</p><ul class="detail-list"><li>Market context <span>The wider picture</span></li><li>Key catalysts <span>Events to keep in view</span></li><li>What to watch <span>Questions for the day ahead</span></li></ul><p>No market brief has been published yet. This is a preview of the planned reading experience.</p>`,
  journal: `<span class="concept">IN DEVELOPMENT</span><h2 id="dialog-title">Turn trades into lessons.</h2><p>A planned home for your setups, decisions and reflections. This tool is not available yet.</p><ul class="detail-list"><li>Before the trade <span>Thesis &amp; invalidation</span></li><li>After the trade <span>Outcome &amp; execution</span></li><li>Over time <span>Patterns &amp; lessons</span></li></ul>`,
  performance: `<span class="concept">IN DEVELOPMENT</span><h2 id="dialog-title">Look beyond the last trade.</h2><p>A planned view of your trading history. No trading account is connected.</p><ul class="detail-list"><li>Performance over time <span>Returns &amp; drawdowns</span></li><li>Trade quality <span>Expectancy &amp; R multiples</span></li><li>Strategy breakdown <span>What works for you</span></li></ul><p>The homepage chart is a visual concept, not actual trading performance.</p>`
};
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
document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => {
  const type = button.dataset.tool; dialog.dataset.tool = type;
  content.innerHTML = type === 'macro' ? macroDetail() : (previews[type] || calculator(type));
  if (type === 'size' || type === 'reward') setupCalculator(type);
  dialog.showModal(); document.body.classList.add('modal-open');
}));
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});

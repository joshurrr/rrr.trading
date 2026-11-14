'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  children = [];
  dataset = {};
  attrs = {};
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attrs[key] = value; }
  querySelector() { return null; }
}

const nodes = new Map(['home-market-cards', 'home-market-updated'].map(id => [id, new Element()]));
const listeners = {};
const document = {
  documentElement: {classList: {contains: () => false}},
  getElementById: id => nodes.get(id),
  querySelector: () => null,
  createElement: () => new Element(),
  createElementNS: () => new Element(),
  createTextNode: textContent => ({textContent})
};
const window = {addEventListener: (event, listener) => { listeners[event] = listener; }};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'homepage-redesign-dashboard.js'), 'utf8'), {
  document, window,
  fetch: () => { throw new Error('Sparkline rendering must not fetch'); }
});

const at = new Date(Date.now() - 1000).toISOString();
const end = Math.floor(Date.now() / 900000) * 900;
const expires = new Date((end + 1020) * 1000).toISOString();
const points = Array.from({length: 96}, (_, index) => [end - (95 - index) * 900, 1900 + index % 9]);
const series = {
  symbol: 'ETHUSDT', source: 'bybit', state: 'CURRENT', interval_seconds: 900, points,
  source_at: new Date(end * 1000).toISOString(), expires_at: expires
};
const data = {
  version: 'paper-read-api-v1', mode: 'paper', served_at: at,
  market_prices: {ETHUSDT: {
    symbol: 'ETHUSDT', source: 'bybit', availability: 'AVAILABLE', price: 1961.79, change_24h_pct: -1.25,
    source_at: at, observed_at: at, expires_at: expires
  }}
};
const update = (history, display = 'CURRENT') => listeners['rrr-v4-home-position-snapshot']({
  detail: {data: {...data, market_price_history: history && {ETHUSDT: history}}, diagnostics: {display}}
});
const eth = nodes.get('home-market-cards').children[1];
const chart = eth.children[4];
update(series);
assert.equal(eth.children[1].textContent, '$1,962');
assert.equal(eth.dataset.tone, 'negative');
assert.equal(chart.hidden, false);
assert.match(chart.children[0].children[2].attrs.d, /^M2\.00 .* L118\.00 /);
assert.equal((chart.children[0].children[2].attrs.d.match(/L/g) || []).length, 95);

for (const history of [
  undefined, {...series, state: 'STALE'}, {...series, state: 'PARTIAL'},
  {...series, expires_at: at}, {...series, points: points.slice(1)},
  {...series, points: [points[1], ...points.slice(1)]},
  {...series, points: [points[1], points[0], ...points.slice(2)]}
]) {
  update(series);
  update(history);
  assert.equal(chart.hidden, true);
  assert.equal(chart.children.length, 0);
  assert.equal(eth.children[1].textContent, '$1,962');
}
update(series, 'RETAINED');
assert.equal(chart.hidden, false);
assert.equal(eth.dataset.state, 'CURRENT');
assert.match(nodes.get('home-market-updated').textContent,/Refresh failed/);

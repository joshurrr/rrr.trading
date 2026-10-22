'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.join(__dirname, 'tools/index.html'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, 'tools/tools.css'), 'utf8');
const header = fs.readFileSync(path.join(__dirname, 'site-header.js'), 'utf8');

assert.match(page, /<h1>TRADING TOOLS<\/h1>/);
for (const href of ['/asset-explorer/', '/market-conditions/', '/schedule/', 'https://v4.rrr.trading', '/research-news/']) {
  assert(page.includes(`href="${href}"`), `missing tool link: ${href}`);
}
for (const retained of ['/site-header.css', '/site-header.js', '/site-footer.css']) {
  assert(page.includes(retained), `missing shared site component: ${retained}`);
}
assert(header.includes('RadioRRR.com'), 'shared Radio RRR player is not available');
for (const obsolete of ['api/v2/system/health', 'calendar-health.js', 'tools.js', 'v3-generation.js',
  'SYSTEM SERVICES', 'TRADING INTELLIGENCE', 'EXECUTION PIPELINE', '15 MIN BOT', '1 HR BOT', '4 HR BOT']) {
  assert(!page.includes(obsolete), `obsolete monitoring reference remains: ${obsolete}`);
}
assert.match(styles, /\.tools-grid\s*\{[^}]*display:grid/s);
assert.match(styles, /@media\s*\(max-width:540px\)/);
console.log('PASS tools page links, shared shell, removed monitoring, and responsive card styles');

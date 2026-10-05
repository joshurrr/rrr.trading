const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.join(__dirname, pathname.endsWith('/') ? pathname + 'index.html' : pathname);
    try {
      res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'text/html');
      res.end(fs.readFileSync(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    const base = process.env.RRR_NAV_BASE_URL || `http://127.0.0.1:${server.address().port}`;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://api.rrr.trading/**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
    await page.route('https://stream.radiorrr.com/**', route => route.abort());
    const routes = ['/', '/demo/15minbot/', '/demo/1hrbot/', '/demo/4hrbot/'];
    const labels = ['LIVE ANALYSIS', '15 MIN BOT', '1 HR BOT', '4 HR BOT'];
    for (const route of routes) {
      await page.goto(base + route);
      const modes = page.getByRole('navigation', { name: 'Trading modes', exact: true });
      const links = modes.getByRole('link');
      assert.deepEqual(await links.allTextContents(), labels);
      assert.equal(await modes.locator('[aria-current="page"]').count(), 1);
      assert.equal(await modes.locator('[aria-current="page"]').getAttribute('href'), route);
      assert.equal(await page.locator('#navigation [aria-current="page"]').getAttribute('href'), route);
      for (const width of [1440, 1024, 901, 768, 601, 600, 390, 375, 320]) {
        await page.setViewportSize({ width, height: 950 });
        const layout = await links.evaluateAll(elements => elements.map(link => {
          const rect = link.getBoundingClientRect();
          const label = link.querySelector('span').getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, labelLeft: label.left, labelRight: label.right, right: rect.right, font: parseFloat(getComputedStyle(link).fontSize) };
        }));
        assert(layout.every(item => Math.abs(item.width - layout[0].width) < 1), `${route} unequal buttons at ${width}`);
        assert(layout.every(item => item.height >= 44 && item.font >= 13 && item.labelLeft >= item.x && item.labelRight <= item.right), `${route} clipped labels at ${width}: ${JSON.stringify(layout)}`);
        assert.equal(new Set(layout.map(item => item.y)).size, width > 600 ? 1 : 2, `${route} rows at ${width}`);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} overflow at ${width}`);
        assert(await modes.evaluate(nav => nav.getBoundingClientRect().top >= document.querySelector('.site-header').getBoundingClientRect().bottom));
        assert(await modes.evaluate(nav => nav.getBoundingClientRect().bottom <= document.querySelector('main').getBoundingClientRect().top));
        assert(await modes.isVisible());
      }
      const active = modes.locator('[aria-current="page"]');
      const inactive = modes.locator('a:not([aria-current])').first();
      assert.notEqual(await active.evaluate(link => getComputedStyle(link).backgroundImage), await inactive.evaluate(link => getComputedStyle(link).backgroundImage));
      await inactive.hover();
      await page.waitForFunction(() => {
        const style = getComputedStyle(document.querySelector('.mode-button:hover'));
        return style.borderTopColor === `rgb(${style.getPropertyValue('--neon').trim().split(',').map(value => value.trim()).join(', ')})`;
      });
      await links.first().focus();
      assert.equal(await links.first().evaluate(link => getComputedStyle(link).outlineStyle), 'solid');
      for (let index = 1; index < 4; index++) {
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.textContent), labels[index]);
      }
      await page.locator('.menu-toggle').click();
      assert(await page.locator('#navigation').isVisible());
      await page.locator('#navigation a').first().focus();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
      assert(await modes.isVisible());
      assert(await page.locator('#radio-audio').evaluate(audio => audio.paused && !audio.autoplay));
      await page.locator('#radio-audio').evaluate(audio => { audio.play = () => Promise.reject(new Error('Test stream failure')); });
      await page.locator('#radio-toggle').click();
      await page.waitForFunction(() => document.querySelector('#radio-status').textContent.includes('unavailable'));
      // Every operating mode can reach all four existing routes using its visible buttons.
      for (const destination of routes) {
        await page.getByRole('navigation', { name: 'Trading modes', exact: true }).locator(`a[href="${destination}"]`).click();
        assert.equal(new URL(page.url()).pathname, destination);
        assert.equal(await page.locator('.operating-modes [aria-current="page"]').getAttribute('href'), destination);
      }
    }
    // Explicit index URLs retain the same active mode.
    for (const route of routes) {
      await page.goto(base + route + 'index.html');
      assert.equal(await page.locator('.operating-modes [aria-current="page"]').getAttribute('href'), route);
    }
    await page.goto(base + '/');
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.screenshot({ path: path.join(require('node:os').tmpdir(), 'rrr-operating-modes-desktop.png') });
    await page.setViewportSize({ width: 375, height: 950 });
    await page.screenshot({ path: path.join(require('node:os').tmpdir(), 'rrr-operating-modes-mobile.png') });
    assert.deepEqual(errors, []);
    console.log('PASS: all four modes and 16 link combinations, active states and index URLs, nine widths, equal columns/mobile grid, readable labels, hover/focus/Tab, header menu/Escape, radio controls, no page errors.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

'use strict';
const { defineConfig } = require('@playwright/test');

const testPort = Number(process.env.RRR_TEST_PORT || 4173);

module.exports = defineConfig({
  testDir: './browser-tests',
  testMatch: '**/*.spec.cjs',
  fullyParallel: true,
  reporter: 'list',
  outputDir: '.runtime/playwright-results',
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    browserName: 'chromium',
    channel: 'msedge',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tools/playwright-static-server.cjs',
    url: `http://127.0.0.1:${testPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});

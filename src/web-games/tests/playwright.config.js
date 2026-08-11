const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  // demolition-ball has its own config (GL flags + long timeouts for the
  // from-scratch WebGL2 renderer) — running it under this one always times out.
  testIgnore: 'demolition-ball/**',
  outputDir: './screenshots',
  timeout: 30000,
  retries: 1,
  workers: 1,
  globalSetup: './globalSetup.js',
  globalTeardown: './globalTeardown.js',
  use: {
    browserName: 'chromium',
    baseURL: `http://localhost:${process.env.TEST_PORT || '8080'}`,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: process.env.AERO_RECORD_VIDEO === '1' ? 'on' : 'on-first-retry',
    headless: true,
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
});

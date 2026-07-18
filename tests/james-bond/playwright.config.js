const path = require('path');
const { defineConfig } = require('@playwright/test');

const outputRoot = path.resolve(__dirname, '../../../../.dadaia/tmp/root/20260718/james-bond-qa');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'smoke.spec.js',
  outputDir: path.join(outputRoot, 'results'),
  timeout: 180000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    baseURL: `http://127.0.0.1:${process.env.TEST_PORT || '3658'}`,
    viewport: { width: 640, height: 400 },
    headless: true,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
});

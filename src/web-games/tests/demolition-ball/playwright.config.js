const path = require('path');
const { defineConfig } = require('@playwright/test');

// Dedicated config: this game is a from-scratch WebGL2 renderer, so the browser
// must use a real GL backend. Playwright's default headless Chromium falls back
// to SwiftShader, where the fragment shader (GGX + PCF) runs at ~0.2 fps.
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'e2e.spec.js',
  outputDir: path.resolve(__dirname, '../screenshots'),
  timeout: 120000,
  retries: 0,
  workers: 1,
  globalSetup: path.resolve(__dirname, '../globalSetup.js'),
  globalTeardown: path.resolve(__dirname, '../globalTeardown.js'),
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    baseURL: `http://localhost:${process.env.TEST_PORT || '8080'}`,
    viewport: { width: 960, height: 600 },
    headless: true,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=gl',
        '--ignore-gpu-blocklist',
        '--enable-gpu-rasterization',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
});

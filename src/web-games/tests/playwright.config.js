const { defineConfig } = require('@playwright/test');

// v0.10.0 T-01: flags GL/ANGLE (as 5 de tests/demolition-ball-opus-5) atrás
// de env p/ o experimento A/B no CI. Default DESLIGADO nesta tarefa — T-05
// decide o default final com base no delta medido no CI.
const GL_ARGS = [
  '--use-gl=angle',
  '--use-angle=gl',
  '--ignore-gpu-blocklist',
  '--enable-gpu-rasterization',
  '--enable-unsafe-swiftshader',
];

module.exports = defineConfig({
  testDir: '.',
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
    ...(process.env.PW_GL_ARGS === '1' ? { launchOptions: { args: GL_ARGS } } : {}),
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
});

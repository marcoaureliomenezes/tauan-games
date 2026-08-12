const path = require('path');
const { defineConfig } = require('@playwright/test');

const outputRoot = path.resolve(__dirname, '../../../../../../.dadaia/tmp/root/20260718/james-bond-qa');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'smoke.spec.js',
  outputDir: path.join(outputRoot, 'results'),
  // 300 s: os mapas viraram quarteirões (693 células contra as 375 antigas) e o
  // teste de andares audita as 6 missões em sequência. Em máquina carregada o
  // limite de 180 s não cobria mais a auditoria completa.
  timeout: 300000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    // fallback para Chrome do sistema quando o cache de browsers do Playwright não existe
    ...(process.env.CHROME_PATH ? { launchOptions: { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] } } : {}),
    baseURL: `http://127.0.0.1:${process.env.TEST_PORT || '3658'}`,
    viewport: { width: 640, height: 400 },
    headless: true,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
});

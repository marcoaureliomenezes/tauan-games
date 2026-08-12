const path = require('path');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'smoke.spec.js',
  // T-04: era um caminho relativo de 6 níveis que escapava do repo para um
  // scratch datado fora de controle — gitignorado pelo padrão raiz
  // `test-results/` (qualquer profundidade), então nem precisa de exceção.
  outputDir: path.join(__dirname, 'test-results'),
  // v0.10.0 T-03: auto-suficiente (sobe/derruba o próprio servidor) — antes
  // dependia de um servidor já de pé em TEST_PORT||3658.
  globalSetup: './globalSetup.js',
  globalTeardown: './globalTeardown.js',
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

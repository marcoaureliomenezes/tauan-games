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
  // v0.10.0 T-03: dirs com config dedicado rodam em jobs de CI próprios
  // (james-bond-ci.yml, demolition-ball-ci.yml) — fora do run raiz.
  testIgnore: ['**/james-bond/**', '**/demolition-ball/**'],
  outputDir: './screenshots',
  // ── Política de retry/timeout (v0.10.0 T-08) ─────────────────────────────
  // retries: 1 — mantido: os flakes desta suíte são de relógio de parede sob
  // runner carregado e passam no retry (evidência: runs verdes 31548373788 e
  // a série de hoje); nenhum teste perde retry. Custo de pior caso: cada
  // teste paga no máximo 2× (trace+video só no retry), limitado pela própria
  // suíte — a fila de ~19 min do pior caso histórico (28,2 min) morre em
  // T-04 (cancel-in-progress), não aqui.
  // timeout: 30 s default cobre smoke/boot; auditorias longas declaram o
  // orçamento no próprio spec (test.setTimeout 60–90 s corrida, 300 s
  // james-bond) — orçamento fica ao lado do teste que precisa.
  // Artefatos: screenshot só em falha, trace+video só no retry — consumidor
  // único e definido: upload do CI em if: failure() (ci.yml) + debug local.
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

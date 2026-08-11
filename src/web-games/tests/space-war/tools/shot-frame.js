// shot-frame.js — captura da EXPERIÊNCIA do frame local-nível: decolagem →
// assistente de órbita → planeta como arco fixo embaixo da tela.
const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = process.argv[2] || '/tmp/space-war-frame';
const BASE = `http://localhost:${process.env.TEST_PORT || 8098}`;
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
  await page.goto(`${BASE}/space-war/index.html`);
  await page.waitForFunction(() => window.__spaceWarReady === true);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__spaceWar.ship.landed === false);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyO');
  await page.waitForFunction(() => window.__spaceWar.ship.inOrbit === true);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, 'frame-earth-orbit.png') });
  console.log('frameReport', await page.evaluate(() => JSON.stringify(window.__swDebug.frameReport())));
  // voo manual nivelado a caminho da Lua (a jornada de ~1 min da fase)
  await page.evaluate(() => window.__swDebug.target('lua'));
  await page.evaluate(() => window.__swDebug.goTo('lua', 6, 0.7));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, 'frame-earth-moon.png') });
  await browser.close();
  console.log('OK ->', OUT);
})().catch((e) => { console.error(e.message); process.exit(1); });

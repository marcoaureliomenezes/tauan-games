// shot-pbr.js — Capturas com PBR + postfx REAIS (webdriver desligado → o jogo
// roda o caminho visual completo, não o fallback HEADLESS dos testes).
// Uso: TEST_PORT=8094 node tests/space-war/tools/shot-pbr.js <outdir>
const { chromium } = require('@playwright/test');
const path = require('path');

const OUT = process.argv[2] || '/tmp/space-war-pbr';
const BASE = `http://localhost:${process.env.TEST_PORT || 8094}`;

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  const webdriver = await page.evaluate(() => navigator.webdriver);
  console.log('webdriver =', webdriver);
  await page.goto(`${BASE}/space-war/index.html`);
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 90000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 15000 });

  const shot = async (name, settle = 2500) => {
    await page.waitForTimeout(settle);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log(name, 'ok');
  };

  // Terra de órbita baixa (limbo + atmosfera + nuvens)
  await page.evaluate(() => window.__swDebug.goTo('earth', 1.6, 0.35));
  await shot('pbr-earth-low');
  // Terra + Lua no mesmo quadro (a visão das referências)
  await page.evaluate(() => window.__swDebug.goTo('earth', 2.4, 0.5));
  await page.evaluate(() => window.__swDebug.target('lua'));
  await page.evaluate(() => window.__swDebug.journeyWarp ? null : null);
  await shot('pbr-earth-moon');
  // Lua de perto (crateras)
  await page.evaluate(() => window.__swDebug.goTo('lua', 2.2, 0.4));
  await shot('pbr-moon');
  // EEI (estação) de perto
  await page.evaluate(() => window.__swDebug.goTo('iss', 30, 0.3));
  await shot('pbr-iss');
  // Marte com luas
  await page.evaluate(() => window.__swDebug.goTo('mars', 2.2, 0.45));
  await shot('pbr-mars');
  // Saturno com anéis
  await page.evaluate(() => window.__swDebug.goTo('saturn', 1.8, 0.5));
  await shot('pbr-saturn');
  // Júpiter com luas galileanas
  await page.evaluate(() => window.__swDebug.goTo('jupiter', 2.2, 0.4));
  await shot('pbr-jupiter');

  await browser.close();
  console.log('OK ->', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });

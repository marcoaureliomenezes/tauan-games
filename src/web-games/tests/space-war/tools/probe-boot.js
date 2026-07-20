// probe-boot.js — mede tempo de boot e captura erros de console.
const { chromium } = require('@playwright/test');
const BASE = `http://localhost:${process.env.TEST_PORT || 8090}`;
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  const t0 = Date.now();
  await page.goto(`${BASE}/space-war/index.html`);
  try {
    await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 60000 });
    console.log('READY in', ((Date.now() - t0) / 1000).toFixed(1), 's');
    const info = await page.evaluate(() => ({
      bodies: window.__spaceWar.bodies.length,
      systems: window.__spaceWar.planetarySystems?.length,
      mode: window.__spaceWar.mode,
    }));
    console.log(JSON.stringify(info));
  } catch {
    console.log('NOT READY after 60s');
  }
  console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
  await browser.close();
})();

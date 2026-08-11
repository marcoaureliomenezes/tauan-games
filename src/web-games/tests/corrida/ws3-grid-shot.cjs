const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');
const PORT = 8096;
(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: '/home/marco/workspace/dadaia/repos/tauan-games', stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => console.error('PAGEERROR:', e.message));
    await page.goto(`http://localhost:${PORT}/src/web-games/speed-run/`);
    await page.waitForFunction(() => window.__corridaReady === true, { timeout: 15000 });
    await page.evaluate(() => {
      const G = window.__corrida;
      G.camOverride = (cam) => {
        const S = G.world.track.samples, N = S.length;
        const at = (s) => S[((Math.floor(s * N) % N) + N) % N];
        const eye = at(0.984), tgt = at(0.998);
        cam.position.set(eye.pos.x + eye.side.x * -5, eye.pos.y + 3.4, eye.pos.z + eye.side.z * -5);
        cam.lookAt(tgt.pos.x + tgt.side.x * 6, tgt.pos.y + 2.2, tgt.pos.z + tgt.side.z * 6);
        cam.fov = 58; cam.updateProjectionMatrix();
      };
    });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => ['countdown', 'race'].includes(window.__corrida.phase), { timeout: 5000 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'tests/corrida/screenshots/ws3-city-grid.png' });
    console.log('OK');
  } finally { await browser.close(); server.kill(); }
})().catch((e) => { console.error(e); process.exit(1); });

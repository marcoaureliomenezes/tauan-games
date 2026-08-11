// ws3-probe.cjs — probe SCRATCH (não é teste de aceite): liga servidor estático,
// abre a corrida headless, larga numa pista e despeja renderer.info
// (draw calls / triângulos / texturas / geometrias) + screenshot opcional.
// Uso: node ws3-probe.cjs <trackArrows 0|1|2> [screenshotPath] [driveMs]
const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 8096;
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

(async () => {
  const arrows = parseInt(process.argv[2] || '0', 10);
  const shot = process.argv[3] || null;
  const driveMs = parseInt(process.argv[4] || '0', 10);
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: REPO_ROOT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => console.error('PAGEERROR:', e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE:', m.text()); });
    await page.goto(`http://localhost:${PORT}/src/web-games/speed-run/`);
    await page.waitForFunction(() => window.__corridaReady === true, { timeout: 15000 });
    for (let i = 0; i < arrows; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => ['countdown', 'race'].includes(window.__corrida.phase), { timeout: 5000 });
    // IA assume o jogador p/ a cena andar como numa corrida real
    await page.evaluate(() => {
      const G = window.__corrida;
      G.player.isPlayer = false;
      G.player.st.ai = { laneOffset: 0, skill: 0.85, lookAhead: 0.014 };
    });
    if (driveMs > 0) await page.waitForTimeout(driveMs);
    else await page.waitForTimeout(1200); // alguns frames renderizados
    const info = await page.evaluate(() => {
      const G = window.__corrida;
      const r = G.renderer.info;
      let meshes = 0;
      G.scene.traverse((o) => { if (o.isMesh || o.isSprite) meshes++; });
      return {
        calls: r.render.calls, triangles: r.render.triangles,
        geometries: r.memory.geometries, textures: r.memory.textures,
        programs: r.programs.length, meshesInScene: meshes,
        v: +G.player.st.v.toFixed(1), phase: G.phase,
      };
    });
    console.log('INFO', JSON.stringify(info));
    if (shot) { await page.screenshot({ path: shot }); console.log('SHOT', shot); }
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => { console.error(e); process.exit(1); });

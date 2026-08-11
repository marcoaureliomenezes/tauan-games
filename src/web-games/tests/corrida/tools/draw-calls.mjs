// draw-calls.mjs — renderer.info (draw calls/triângulos) por pista.
// Uso: TEST_PORT=8094 node tests/corrida/tools/draw-calls.mjs
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.TEST_PORT || '8094';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const URL = `http://localhost:${PORT}/src/web-games/speed-run/`;

function portUp() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}`, () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => { req.destroy(); resolve(false); });
  });
}
let server = null;
if (!(await portUp())) {
  server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: REPO_ROOT, stdio: 'ignore' });
  for (let i = 0; i < 20 && !(await portUp()); i++) await new Promise((r) => setTimeout(r, 200));
}

const browser = await chromium.launch({ headless: true });
try {
  for (let t = 0; t < 4; t++) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(URL);
    await page.waitForFunction(() => window.__corridaReady === true, { timeout: 15000 });
    for (let i = 0; i < t; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => ['countdown', 'race'].includes(window.__corrida.phase), { timeout: 8000 });
    await page.waitForTimeout(600);
    const info = await page.evaluate(() => {
      const r = window.__corrida.renderer.info;
      return { track: window.__corrida.world.def.key, calls: r.render.calls, tris: r.render.triangles, geoms: r.memory.geometries, tex: r.memory.textures };
    });
    console.log(`${info.track}: calls=${info.calls} tris=${info.tris} geometries=${info.geoms} textures=${info.tex}`);
    await page.close();
  }
} finally {
  await browser.close();
  if (server) server.kill();
}

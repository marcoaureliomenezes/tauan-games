// ws6-shots.mjs — screenshots 1280×720 da WS-6 (sinalização por dados + sol):
//   ws6-forest-chevrons.png  chevrons antes da curva mais fechada da floresta
//   ws6-lombada.png          placa LOMBADA antes da crista (forest, s≈0.42)
//   ws6-arizona-sun.png      sol + fantasmas de flare na reta do arizona
//   ws6-city-kerbs-dist.png  zebras + tábuas 300/200/100 na curva da cidade
//   node tests/corrida/tools/ws6-shots.mjs
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 8098;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const URL = `http://localhost:${PORT}/src/web-games/speed-run/`;
const OUT = 'tests/corrida/screenshots';

const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: REPO_ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();

// utilidades avaliadas NA PÁGINA (mesmos módulos do jogo)
const helpers = () => {
  const G = window.__corrida;
  const S = G.world.track.samples, N = S.length, M = G.world.track.M;
  const at = (s) => S[Math.max(0, Math.min(N - 1, Math.round(((s % 1) + 1) % 1 * M)))];
  window.__ws6 = {
    at,
    // câmera `back` metros ANTES de sEye olhando p/ sTgt
    cam(sEye, sTgt, back = 0, h = 3.2, side = 0) {
      const e = at(sEye), t = at(sTgt);
      const ex = e.pos.x - e.tan.x * back + e.side.x * side;
      const ez = e.pos.z - e.tan.z * back + e.side.z * side;
      G.camOverride = (cam) => {
        cam.position.set(ex, e.pos.y + h, ez);
        cam.lookAt(t.pos.x, t.pos.y + 1.6, t.pos.z);
        cam.fov = 60; cam.updateProjectionMatrix();
      };
    },
    camDir(sEye, dx, dy, dz, h = 3.2) {          // olhando uma DIREÇÃO (sol)
      const e = at(sEye);
      G.camOverride = (cam) => {
        cam.position.set(e.pos.x, e.pos.y + h, e.pos.z);
        cam.lookAt(e.pos.x + dx * 100, e.pos.y + h + dy * 100, e.pos.z + dz * 100);
        cam.fov = 60; cam.updateProjectionMatrix();
      };
    },
    signsBy(kind) { return G.world.signage.filter((x) => x.kind === kind).map((x) => x.s); },
  };
};

async function startTrack(page, t) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__corridaReady === true, { timeout: 15000 });
  for (let i = 0; i < t; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  try {
    await page.waitForFunction(() => ['countdown', 'race'].includes(window.__corrida.phase), { timeout: 8000 });
  } catch (e) {
    const st = await page.evaluate(() => ({ phase: window.__corrida.phase, trackIdx: window.__corrida.trackIdx, menuRow: window.__corrida.menuRow }));
    console.error('startTrack FALHOU:', JSON.stringify(st));
    throw e;
  }
  await page.evaluate(helpers);
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error('PAGEERROR:', e.message));

  // ── 1. FOREST: chevrons antes da curva mais fechada ──────────────────────
  await startTrack(page, 1);
  await page.evaluate(() => {
    const G = window.__corrida, L = G.world.trackLen;
    const d = window.__ws6.signsBy('dist');
    const s100 = Math.max(...d);                  // tábua 100 ≈ 100 m da entrada
    window.__ws6.cam(s100 - 35 / L, s100 + 85 / L, 0, 4.0, 0);
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/ws6-forest-chevrons.png` });
  console.log('OK ws6-forest-chevrons.png');

  // ── 2. FOREST: LOMBADA antes da crista s≈0.42 ────────────────────────────
  const lomS = await page.evaluate(() => Math.min(...window.__ws6.signsBy('lombada')));
  await page.evaluate((s) => window.__ws6.cam(s, s + 0.02, 32, 3.4, 1.5), lomS);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/ws6-lombada.png` });
  console.log('OK ws6-lombada.png (placa s≈' + lomS.toFixed(3) + ')');

  // ── 3. ARIZONA: sol + flare olhando p/ a direção assada no céu ───────────
  await startTrack(page, 2);
  await page.evaluate(() => {
    // amostra cuja tangente aponta p/ o sol (reta de frente p/ ele)
    const S = window.__corrida.world.track.samples;
    let bi = 0, bd = -2;
    for (let i = 0; i < S.length; i += 4) {
      const d = S[i].tan.x * -0.0545 + S[i].tan.z * -0.713;
      if (d > bd) { bd = d; bi = i; }
    }
    window.__ws6.camDir(S[bi].s, -0.0545, 0.30, -0.713);
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/ws6-arizona-sun.png` });
  console.log('OK ws6-arizona-sun.png');

  // ── 4. CITY: zebras + tábuas 300/200/100 na curva mais fechada ───────────
  await startTrack(page, 0);
  await page.evaluate(() => {
    const G = window.__corrida, L = G.world.trackLen;
    const s100 = Math.max(...window.__ws6.signsBy('dist'));
    window.__ws6.cam(s100 - 45 / L, s100 + 75 / L, 0, 4.4, 0);
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/ws6-city-kerbs-dist.png` });
  console.log('OK ws6-city-kerbs-dist.png');

  // ── relatório de clearance (auditoria do corredor dirigível) ─────────────
  for (let t = 0; t < 4; t++) {
    await startTrack(page, t);
    const rep = await page.evaluate(() => {
      const sg = window.__corrida.world.signage;
      return {
        track: window.__corrida.world.def.key, n: sg.length,
        minClear: Math.min(...sg.map((x) => x.clearance)),
        calls: window.__corrida.renderer.info.render.calls,
      };
    });
    await page.waitForTimeout(300);
    const rep2 = await page.evaluate(() => window.__corrida.renderer.info.render.calls);
    console.log(`${rep.track}: ${rep.n} placas, clearance mín=${rep.minClear} m, draw calls=${rep2}`);
  }
} finally {
  await browser.close();
  server.kill();
}

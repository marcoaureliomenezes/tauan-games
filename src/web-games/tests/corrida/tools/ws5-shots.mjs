// ws5-shots.mjs — screenshots 1280×720 da WS-5: largada em Tauan City, vado,
// Vila Serrana visível na aproximação, e modo Fuga (giroflex + spike strip).
//   node tests/corrida/tools/ws5-shots.mjs
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 8097;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const URL = `http://localhost:${PORT}/src/web-games/speed-run/`;
const OUT = 'tests/corrida/screenshots';

const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: REPO_ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error('PAGEERROR:', e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__corridaReady === true, { timeout: 15000 });

  const camAt = (sEye, sTgt, hEye = 4, hTgt = 2, sideEye = -6, sideTgt = 0) => `
    (() => {
      const G = window.__corrida;
      G.camOverride = (cam) => {
        const at = (s) => G.world.track.samples[Math.max(0, Math.min(G.world.track.samples.length - 1, Math.round(s * G.world.track.M)))];
        const eye = at(${sEye}), tgt = at(${sTgt});
        cam.position.set(eye.pos.x + eye.side.x * (${sideEye}), eye.pos.y + (${hEye}), eye.pos.z + eye.side.z * (${sideEye}));
        cam.lookAt(tgt.pos.x + tgt.side.x * (${sideTgt}), tgt.pos.y + (${hTgt}), tgt.pos.z + tgt.side.z * (${sideTgt}));
        cam.fov = 60; cam.updateProjectionMatrix();
      };
    })()`;

  // ── 1. largada em Tauan City (grid + pórtico + prédios pastel) ──────────
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => ['countdown', 'race'].includes(window.__corrida.phase), { timeout: 5000 });
  await page.evaluate(camAt(0.004, 0.035, 3.6, 2.4, -8, 4));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/ws5-sprint-start.png` });
  console.log('OK ws5-sprint-start.png');

  // ── 2. vado (lâmina d'água ~90 m sobre a pista, s≈0.645) ─────────────────
  await page.evaluate(camAt(0.615, 0.648, 5.5, 1.5, -14, 6));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/ws5-ford.png` });
  console.log('OK ws5-ford.png');

  // ── 3. Vila Serrana visível na aproximação da chegada ────────────────────
  await page.evaluate(camAt(0.90, 0.985, 5, 4, -8, 10));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/ws5-vila-serrana.png` });
  console.log('OK ws5-vila-serrana.png');

  // ── 4. Fuga: viatura com giroflex + spike strip à frente ─────────────────
  await page.goto(URL);                              // recarrega → menu limpo
  await page.waitForFunction(() => window.__corridaReady === true, { timeout: 15000 });
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');           // modo Fuga
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__corrida.phase === 'race', { timeout: 5000 });
  await page.evaluate(() => {
    const G = window.__corrida;
    G.player.isPlayer = false;
    G.player.st.ai = { laneOffset: 2.5, skill: 0.7, lookAhead: 0.014 };
    // viatura ao LADO do jogador (posição de PIT) — giroflex aparece no quadro
    const st = G.player.st;
    const cop = G.cars.find((c) => c.isPolice);
    const sm = G.world.surfaceAt(st.pos.x, st.pos.z, st.sHint);
    cop.st.pos.set(st.pos.x + sm.sm.side.x * -3.6, st.pos.y, st.pos.z + sm.sm.side.z * -3.6);
    cop.st.heading = st.heading;
    cop.st.v = st.v;
    G.spawnSpike(1);
  });
  // câmera: atrás do jogador, vendo viatura + tira amarela à frente
  await page.evaluate(() => {
    const G = window.__corrida;
    G.camOverride = (cam) => {
      const st = G.player.st;
      const fx = -Math.sin(st.heading), fz = -Math.cos(st.heading);
      cam.position.set(st.pos.x - fx * 13 + fz * 3, st.pos.y + 5, st.pos.z - fz * 13 - fx * 3);
      cam.lookAt(st.pos.x + fx * 22, st.pos.y + 1, st.pos.z + fz * 22);
      cam.fov = 62; cam.updateProjectionMatrix();
    };
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/ws5-chase.png` });
  console.log('OK ws5-chase.png');
} finally {
  await browser.close();
  server.kill();
}

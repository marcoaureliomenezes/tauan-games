// nitro-probe.mjs — Prova headless do NITRO (v0.8.0): kick de FOV (+6°
// composto sobre a lógica de velocidade) e TETO de velocidade +25%.
//
//   cd src/web-games && node tests/corrida/tools/nitro-probe.mjs
//
// PART A (FOV): com o carro em velocidade, o residual
//   fov − 68 − min(14, v·0,16) é ≈0 sem nitro e converge p/ +6 queimando.
// PART B (teto): na reta da Serra do Tauan, SEM nitro o carro assintota em
//   topSpeed (62 p/ o Idea); COM nitro o teto sobe p/ 77,5 — maxV tem que
//   passar de 62·1,08 (o teto macio de 1,15× sem nitro NUNCA é alcançado
//   pelo motor, que zera o empurrão em 62 — passar de 67 prova o novo teto).
// PART C (sanidade): a carga drena enquanto o boost está ativo.
// Tudo por teclado real (W/Shift + servo de direção por toques A/D);
// window.__corrida só em leitura/asserção.

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.TEST_PORT || '8094';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const URL = `http://localhost:${PORT}/src/web-games/speed-run/`;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}

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
  console.log(`server próprio na porta ${PORT} (pid ${server.pid})`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

// leitura atômica: velocidade, FOV e estado do nitro no mesmo instante
const readState = () => page.evaluate(() => {
  const G = window.__corrida;
  return {
    v: G.player.st.v, fov: G.camera.fov, topSpeed: G.player.st.def.topSpeed,
    active: G.nitro.active, charge: G.nitro.charge, phase: G.phase,
  };
});
// residual de FOV: o que sobrou depois da lógica de velocidade (68 + min(14, v·0,16))
const fovKick = (s) => s.fov - 68 - Math.min(14, s.v * 0.16);

// servo de direção por toques (mesmo padrão do input.spec) — retorna quando
// `stop(s)` for verdade na leitura mais recente ou no timeout
async function servoUntil(stop, timeoutMs) {
  const t0 = Date.now();
  let last = await readState();
  while (Date.now() - t0 < timeoutMs) {
    const steer = await page.evaluate(() => {
      const G = window.__corrida, p = G.player.st;
      const tr = G.world.track, N = tr.samples.length;
      const sm = tr.samples[Math.min(N - 1, Math.round(p.sHint * tr.M))];
      const want = Math.atan2(-sm.tan.x, -sm.tan.z);
      let err = want - p.heading;
      while (err > Math.PI) err -= 2 * Math.PI;
      while (err < -Math.PI) err += 2 * Math.PI;
      const lat = (p.pos.x - sm.pos.x) * sm.side.x + (p.pos.z - sm.pos.z) * sm.side.z;
      return err - Math.max(-0.15, Math.min(0.15, lat * 0.02));
    });
    last = await readState();
    if (stop(last)) return last;
    if (Math.abs(steer) > 0.06) {
      const key = steer > 0 ? 'KeyA' : 'KeyD';
      await page.keyboard.down(key);
      await page.waitForTimeout(Math.min(200, Math.abs(steer) * 450));
      await page.keyboard.up(key);
    } else {
      await page.waitForTimeout(50);
    }
  }
  return last;
}

try {
  await page.goto(URL);
  await page.waitForFunction(() => window.__corridaReady === true, undefined, { timeout: 15000 });
  // Serra do Tauan (pista 3): reta longa de ~700 m antes da 1ª crista
  for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__corrida.phase === 'race', undefined, { timeout: 10000 });

  // ── fase 1: W puro até v ≥ 55 (SEM nitro) — baseline de FOV ──────────────
  await page.keyboard.down('KeyW');
  const base = await servoUntil((s) => s.v >= 55, 30000);
  check('A1: residual de FOV ≈ 0 SEM nitro (baseline da câmera intacto)',
    Math.abs(fovKick(base)) < 1.0,
    `kick=${fovKick(base).toFixed(2)}° @ v=${base.v.toFixed(1)} fov=${base.fov.toFixed(1)}`);

  // ── fase 2: Shift segurado — FOV kick + teto novo ────────────────────────
  await page.keyboard.down('ShiftLeft');
  let maxV = 0, maxKick = 0, minCharge = 100, sawActive = false;
  const end = await servoUntil((s) => {
    maxV = Math.max(maxV, s.v);
    minCharge = Math.min(minCharge, s.charge);
    if (s.active) { sawActive = true; maxKick = Math.max(maxKick, fovKick(s)); }
    // para quando passar do teto normal com folga, ou se a carga secar
    return s.v > s.topSpeed * 1.12 || s.charge <= 0.5;
  }, 20000);
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyW');

  check('A2: kick de FOV converge p/ +6° com o nitro ATIVO',
    sawActive && maxKick > 5.0,
    `kick máx=${maxKick.toFixed(2)}° (alvo 6, suavizado 8/s) @ v=${end.v.toFixed(1)}`);
  check('B1: teto de velocidade +25% — maxV supera o teto normal do carro',
    maxV > end.topSpeed * 1.08,
    `maxV=${maxV.toFixed(1)} u/s vs teto normal ${end.topSpeed} (nitro: ${(end.topSpeed * 1.25).toFixed(1)})`);
  check('B2: boost visível na prática — nitro ativou durante a queima', sawActive,
    `active observado=${sawActive}`);
  check('C1: carga drenou enquanto o boost estava ativo', minCharge < 75,
    `carga mín=${minCharge.toFixed(1)} (início 100, dreno 33/s)`);
} finally {
  await browser.close();
  if (server) server.kill();
}

const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} checks passaram`);
process.exit(fails.length ? 1 : 0);

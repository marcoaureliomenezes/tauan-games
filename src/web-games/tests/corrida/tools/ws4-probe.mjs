// ws4-probe.mjs — Prova headless do WS-4: Idea Adventure 2013 PROCEDURAL
// (port das caixas do Godot, substituindo o SUV Quaternius recolorido).
//
//   cd src/web-games && node tests/corrida/tools/ws4-probe.mjs
//
// CHECKS:
//   P1: modelo procedural presente na cena (grupo "ideaAdventure", sem GLB)
//   P2: cápsula de colisão registra a carroceria nominal (colLen≈4.15, colWid≈1.75)
//   P3: 4 rodas rigadas com raio ≈0.335 e pivôs no cubo (±0.74, 0.335, ±1.256 —
//       bitola 1.469 / entre-eixos 2.511 reais, v2 fiel às fotos)
//   P4: rodas GIRAM ao dirigir (pivot.rotation.x avança com v>0)
//   P5: rodas dianteiras ESTERÇAM (pivot.rotation.y ≠ 0 em curva)
// Screenshots: tests/corrida/screenshots/ws4-menu-idea.png (menu c/ Idea) e
//   ws4-race-rear.png (3/4 traseira em corrida — estepe externo visível).

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.TEST_PORT || '8094';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..', '..');
const SHOTS = path.join(HERE, '..', 'screenshots');
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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

try {
  await page.goto(URL);
  await page.waitForFunction(() => window.__corridaReady === true, undefined, { timeout: 15000 });

  // ── screenshot do menu: Idea Adventure selecionado (1º do catálogo) ──────
  await page.keyboard.press('ArrowDown');        // foco na fileira de carros
  await page.screenshot({ path: path.join(SHOTS, 'ws4-menu-idea.png') });
  console.log(`screenshot: ${path.join(SHOTS, 'ws4-menu-idea.png')}`);

  // ── inicia a corrida com o Idea (carro 0) e deixa a IA dirigir ───────────
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__corrida.phase === 'race', undefined, { timeout: 10000 });
  await page.evaluate(() => {
    const G = window.__corrida;
    G.player.isPlayer = false;
    G.player.st.ai = { laneOffset: 0, skill: 0.9, lookAhead: 0.014 };
  });

  // ── P1/P2/P3: estrutura do modelo + colisor + rig das rodas ─────────────
  const info = await page.evaluate(() => {
    const G = window.__corrida;
    const mesh = G.player.mesh;
    const idea = mesh.getObjectByName('ideaAdventure');
    const wheels = mesh.userData.wheels.map((w) => ({
      front: w.front, radius: w.radius,
      x: w.pivot.position.x, y: w.pivot.position.y, z: w.pivot.position.z,
    }));
    let meshCount = 0;
    if (idea) idea.traverse((o) => { if (o.isMesh) meshCount++; });
    return {
      hasIdea: !!idea, meshCount,
      colLen: G.player.st.def.colLen, colWid: G.player.st.def.colWid,
      wheels,
    };
  });
  check('P1: modelo procedural "ideaAdventure" na cena (≤45 meshes)',
    info.hasIdea && info.meshCount > 0 && info.meshCount <= 45,
    `meshes=${info.meshCount}`);
  check('P2: colisor cápsula = carroceria nominal 4.15×1.75',
    Math.abs(info.colLen - 4.15) < 0.05 && Math.abs(info.colWid - 1.75) < 0.05,
    `colLen=${info.colLen} colWid=${info.colWid}`);
  check('P3: 4 rodas rigadas (raio ≈0.335, cubos ±0.74/0.335/±1.256, diant. front=true)',
    info.wheels.length === 4
      && info.wheels.every((w) => Math.abs(w.radius - 0.335) < 0.02)
      && info.wheels.every((w) => Math.abs(Math.abs(w.x) - 0.74) < 0.05 && Math.abs(w.y - 0.335) < 0.05)
      && info.wheels.every((w) => Math.abs(Math.abs(w.z) - 1.256) < 0.05)
      && info.wheels.filter((w) => w.front).length === 2
      && info.wheels.every((w) => w.front === w.z > 0),
    JSON.stringify(info.wheels.map((w) => ({ r: +w.radius.toFixed(3), x: +w.x.toFixed(2), y: +w.y.toFixed(2), z: +w.z.toFixed(2), f: w.front }))));

  // ── P4/P5: rodas giram e dianteiras esterçam ao dirigir ──────────────────
  await page.waitForFunction(() => window.__corrida.player.st.v > 15, undefined, { timeout: 15000 });
  const spin = await page.evaluate(async () => {
    const G = window.__corrida;
    const wheels = G.player.mesh.userData.wheels;
    const rx0 = wheels.map((w) => w.pivot.rotation.x);
    let maxSteer = 0;
    const t0 = performance.now();
    await new Promise((resolve) => {
      function sample() {
        for (const w of wheels) if (w.front) maxSteer = Math.max(maxSteer, Math.abs(w.pivot.rotation.y));
        if (performance.now() - t0 > 6000) return resolve();
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    const drx = wheels.map((w, i) => w.pivot.rotation.x - rx0[i]);
    return { drx, maxSteer, v: G.player.st.v };
  });
  check('P4: rodas GIRAM ao dirigir (Δrotation.x em ~6 s de corrida)',
    spin.drx.every((d) => Math.abs(d) > 5),
    `Δrx=[${spin.drx.map((d) => d.toFixed(1)).join(', ')}] rad, v=${spin.v.toFixed(1)}`);

  // P5: volta p/ controle do jogador e força esterço real (seta) — o pivô
  // dianteiro deve acompanhar input.steer × 0.42 (mesma via dos GLB).
  await page.evaluate(() => {
    const G = window.__corrida;
    G.player.isPlayer = true;
    delete G.player.st.ai;
  });
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(900);
  const steer = await page.evaluate(() => {
    const wheels = window.__corrida.player.mesh.userData.wheels;
    return Math.max(...wheels.filter((w) => w.front).map((w) => Math.abs(w.pivot.rotation.y)));
  });
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('ArrowUp');
  check('P5: rodas dianteiras ESTERÇAM (|rotation.y| > 0.1 com seta pressionada)',
    steer > 0.1, `|rotation.y|=${steer.toFixed(3)} rad`);

  // ── screenshot em corrida: 3/4 traseira via G.camOverride (hook de debug
  //    do updateCamera) — close no estepe externo, assinatura do Adventure ──
  await page.evaluate(() => {
    const G = window.__corrida;
    G.player.isPlayer = true;               // volta p/ input do jogador (sem teclas = para)
    G.player.st.v = 0;
    const st = G.player.st;
    const fx = -Math.sin(st.heading), fz = -Math.cos(st.heading);
    G.camOverride = (camera) => {
      camera.position.set(
        st.pos.x - fx * 4.6 - fz * 2.4,      // 4.6 atrás + 2.4 p/ o lado (3/4)
        st.pos.y + 1.9,
        st.pos.z - fz * 4.6 + fx * 2.4);
      camera.lookAt(st.pos.x, st.pos.y + 0.8, st.pos.z);
      camera.fov = 55;
      camera.updateProjectionMatrix();
    };
  });
  await page.waitForTimeout(700);            // alguns frames p/ câmera assentar
  await page.screenshot({ path: path.join(SHOTS, 'ws4-race-rear.png') });
  console.log(`screenshot: ${path.join(SHOTS, 'ws4-race-rear.png')}`);
} finally {
  await browser.close();
  if (server) server.kill();
}

const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} checks passaram`);
process.exit(fails.length ? 1 : 0);

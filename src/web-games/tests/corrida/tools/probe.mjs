// probe.mjs — Prova headless dos fixes M1 (captura de perna errada em hairpin)
// e do FALLOFF de direção em alta velocidade (operador 2026-08-10).
//
//   cd src/web-games && node tests/corrida/tools/probe.mjs
//
// PART A (M1, unit): ponto entre as pernas de um hairpin — surfaceAt com
//   sHint + maxDS DEVE rejeitar a perna errada e ancorar no segmento do sHint.
// PART B (M1, e2e): jogador teleportado antes do ápice, guiado pela IA através
//   dele — NENHUM ricochete de cerca pode disparar longe da cerca real e
//   nenhum salto de posição ("pedra invisível") pode ocorrer.
// PART C (steering): yaw rate no top speed deve ficar −25..−35% vs fórmula
//   antiga, para TODOS os carros do catálogo.
// PART D (salto, e2e): jogador teleportado na reta da cidade a 62 u/s passa na
//   lombada de s=0.02 — DEVE decolar, voar > 0,25 s, pousar limpo e seguir.
// PART E (design, dados): para TODA lombada de TODA pista — a crista dispara o
//   gatilho a 60 u/s e a zona de pouso (D no pior caso 76 u/s) NÃO tem curva
//   (κ < 0.002 rad/u ⇔ R > 500 u). Espelha a regra de physics.js.
// BÔNUS: raceT acompanha o tempo real (timestep fixo — sem câmera lenta).

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

try {
  await page.goto(URL);
  await page.waitForFunction(() => window.__corridaReady === true, { timeout: 30000 });

  // ── escolhe a pista com o hairpin mais APERTADO (pernas dentro da janela
  //    ±40 amostras e espacialmente próximas) — puro dado, sem buildar cena ──
  //    WS-5: só pistas FECHADAS — PART B mede raceT/tempo real e no sprint o
  //    jogador cruzaria a chegada (raceT congela) durante os 18 s de direção.
  const pick = await page.evaluate(async () => {
    const { TRACKS } = await import('/src/web-games/speed-run/src/tracks.js');
    const { sampleTrack } = await import('/src/web-games/speed-run/src/world.js');
    let best = null;
    TRACKS.forEach((def, ti) => {
      if (def.open) return;                          // sprint: ver PART E
      const S = sampleTrack(def).samples, N = S.length;
      for (let i = 0; i < N; i++) {
        for (let w = 15; w <= 40; w++) {                 // na janela, perna diferente
          const j = (i + w) % N;
          const d = Math.hypot(S[i].pos.x - S[j].pos.x, S[i].pos.z - S[j].pos.z);
          if (!best || d < best.d) best = { ti, i, j, d, N, width: def.width, name: def.name };
        }
      }
    });
    return best;
  });
  console.log(`hairpin alvo: pista "${pick.name}" (idx ${pick.ti}), amostras ${pick.i}/${pick.j}, pernas a ${pick.d.toFixed(1)} u`);

  // inicia a corrida nessa pista
  for (let k = 0; k < pick.ti; k++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__corrida.phase === 'race', { timeout: 30000 });

  // ── PART A: surfaceAt com maxDS rejeita a perna errada ────────────────────
  const partA = await page.evaluate((pick) => {
    const G = window.__corrida;
    const S = G.world.track.samples, N = S.length;
    const si = S[pick.i], sj = S[pick.j];
    // ponto colado na perna J (lado "errado" para quem está na perna I)
    const px = sj.pos.x + (si.pos.x - sj.pos.x) * 0.15;
    const pz = sj.pos.z + (si.pos.z - sj.pos.z) * 0.15;
    const sHint = si.s;
    const maxDS = 2.5 / N + 60 * (1 / 120) * 2 / G.world.trackLen;  // como o stepCar a 60 u/s
    const q = G.world.surfaceAt(px, pz, sHint, maxDS);
    let ds = Math.abs(q.s - sHint); ds = Math.min(ds, 1 - ds);
    const qFree = G.world.surfaceAt(px, pz, sHint);                  // sem validação (caminho antigo)
    let dsFree = Math.abs(qFree.s - sHint); dsFree = Math.min(dsFree, 1 - dsFree);
    const wrongLegWins = Math.hypot(px - sj.pos.x, pz - sj.pos.z) < Math.hypot(px - si.pos.x, pz - si.pos.z);
    return { rejected: q.rejected, ds, dsFree, maxDS, wrongLegWins, distToOwnLeg: q.dist, legGap: pick.d };
  }, pick);
  check('A1: captura de perna errada é REJEITADA', partA.rejected === true && partA.ds <= partA.maxDS + 2 / pick.N,
    `rejected=${partA.rejected} ds=${(partA.ds * pick.N).toFixed(1)} amostras (max ${(partA.maxDS * pick.N).toFixed(1)})`);
  check('A2: sem maxDS o caminho antigo ainda captura globalmente', !partA.wrongLegWins || partA.dsFree > partA.maxDS,
    `dsFree=${(partA.dsFree * pick.N).toFixed(1)} amostras, wrongLegMaisPerto=${partA.wrongLegWins}`);

  // ── PART B: dirigir através do ápice — zero ricochete fantasma ────────────
  await page.evaluate((pick) => {
    const G = window.__corrida;
    const S = G.world.track.samples, N = S.length;
    const st = G.player.st;
    // teleporta ~0,02 de volta ANTES do ápice, na centerline, a 40 u/s
    const sApex = ((pick.i + pick.j) / 2) / N;
    const s0 = ((sApex - 0.02) % 1 + 1) % 1;
    const q = G.world.surfaceAt(S[Math.floor(s0 * N)].pos.x, S[Math.floor(s0 * N)].pos.z);
    const sm = q.sm;
    st.pos.set(sm.pos.x, sm.pos.y, sm.pos.z);
    st.heading = Math.atan2(-sm.tan.x, -sm.tan.z);
    st.v = 40; st.lat = 0; st.sHint = q.s; st.lastS = q.s;
    // IA guia o jogador (mesma interface do smoke) — proxy p/ flagrar hitWall
    G.player.isPlayer = false;
    st.ai = { laneOffset: 0, skill: 0.9, lookAhead: 0.014 };
    const probe = { wallHits: [], jumps: [], minApexDs: 1, sApex, raceT0: null, wallT0: null, frames: 0 };
    const px = new Proxy(st, {
      set(t, k, v) {
        if (k === 'hitWall' && v === true) {
          const q2 = G.world.surfaceAt(t.pos.x, t.pos.z, t.sHint);
          probe.wallHits.push({ dist: q2.dist, s: t.sHint, rejected: !!q2.rejected });
        }
        t[k] = v; return true;
      },
    });
    G.player.st = px;
    let lastX = st.pos.x, lastZ = st.pos.z, lastT = performance.now();
    const FENCE = G.world.def.width / 2 + 2.55;
    probe.FENCE = FENCE;
    function sample() {
      const now = performance.now();
      const dtF = (now - lastT) / 1000; lastT = now;
      const jump = Math.hypot(px.pos.x - lastX, px.pos.z - lastZ);
      const plaus = (Math.abs(px.v) + Math.abs(px.lat)) * dtF + 4.0;
      if (probe.frames > 2 && jump > plaus) {
        probe.jumps.push({ jump, s: px.sHint, v: px.v });
      }
      let ds = Math.abs(px.sHint - sApex); ds = Math.min(ds, 1 - ds);
      probe.minApexDs = Math.min(probe.minApexDs, ds);
      lastX = px.pos.x; lastZ = px.pos.z;
      if (probe.raceT0 === null) { probe.raceT0 = G.raceT; probe.wallT0 = now; }
      probe.frames++;
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
    window.__probe = probe;
  }, pick);

  await page.waitForTimeout(18000);

  const partB = await page.evaluate(() => {
    const G = window.__corrida, p = window.__probe;
    const raceSpan = G.raceT - p.raceT0, wallSpan = (performance.now() - p.wallT0) / 1000;
    const ghost = p.wallHits.filter((h) => h.dist < p.FENCE - 0.7);
    return {
      wallHits: p.wallHits.length, ghostHits: ghost, jumps: p.jumps,
      minApexDs: p.minApexDs, v: G.player.st.v, sHint: G.player.st.sHint,
      raceRatio: raceSpan / wallSpan, frames: p.frames,
    };
  });
  check('B1: zero ricochete de cerca LONGE da cerca real (pedra invisível)',
    partB.ghostHits.length === 0,
    `hitWall=${partB.wallHits}, fantasmas=${JSON.stringify(partB.ghostHits)}`);
  check('B2: zero saltos de posição implausíveis', partB.jumps.length === 0,
    `jumps=${JSON.stringify(partB.jumps.slice(0, 3))}`);
  check('B3: carro ATRAVESSOU o ápice do hairpin', partB.minApexDs < 0.01,
    `aproximação mínima do ápice: ${(partB.minApexDs * pick.N).toFixed(1)} amostras, v=${partB.v.toFixed(1)}`);
  check('B4 (bônus): tempo de corrida acompanha o tempo real (timestep fixo)',
    partB.raceRatio > 0.8 && partB.raceRatio < 1.1,
    `raceT/real=${partB.raceRatio.toFixed(3)} em ${partB.frames} frames`);

  // ── PART C: yaw rate no top speed −25..−35% vs fórmula antiga ────────────
  const partC = await page.evaluate(async () => {
    const THREE = await import('/src/web-games/vendor/three.module.min.js');
    const P = await import('/src/web-games/speed-run/src/physics.js');
    const { CARS } = await import('/src/web-games/speed-run/src/cars.js');
    const worldStub = {
      def: { width: 14 }, trackLen: 3000, track: { samples: { length: 900 } },
      surfaceAt: () => ({
        sm: { surface: 'asphalt' }, dist: 0, surface: 'asphalt',
        phys: { grip: 1, drag: 1, rumble: 0 }, s: 0.5, roadY: 0, cx: 0, cz: 0, rejected: false,
      }),
    };
    const dt = 1 / 120;
    return CARS.map((def) => {
      const st = P.makeCarState(def, new THREE.Vector3(0, 0, 0), 0);
      st.v = def.topSpeed;
      let oldYaw = 0;
      const h0 = st.heading;
      for (let k = 0; k < 120; k++) {
        const grip = def.grip;                          // asfalto: grip × 1
        oldYaw += def.handling * (Math.abs(st.v) / (Math.abs(st.v) + 14)) * (0.45 + 0.55 * grip) * dt;
        P.stepCar(st, { throttle: 1, brake: 0, steer: 1 }, worldStub, dt);
      }
      const measured = st.heading - h0;
      return { name: def.name, topSpeed: def.topSpeed, ratio: measured / oldYaw };
    });
  });
  for (const r of partC) {
    check(`C: falloff de direção @ top speed (${r.name})`,
      r.ratio >= 0.65 && r.ratio <= 0.75,
      `yaw novo/antigo = ${(r.ratio * 100).toFixed(1)}% (−${(100 - r.ratio * 100).toFixed(1)}% @ ${r.topSpeed} u/s)`);
  }

  // ── PART D: salto na lombada (e2e) — reta da cidade, lombada s=0.02 ───────
  // corrida NOVA na cidade (grid parado atrás) e teleporte IMEDIATO p/ a reta:
  // o pelotão não alcança e o carro chega à lombada a 62 u/s em linha reta.
  await page.evaluate(() => { window.__corrida.trackIdx = 0; });
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => window.__corrida.phase === 'race', { timeout: 30000 });
  await page.evaluate(() => {
    const G = window.__corrida;
    const N = G.world.track.samples.length;
    const st = G.player.st;
    const sm = G.world.track.samples[Math.floor(0.013 * N)];   // reta ppal, ~18 u antes da lombada
    st.pos.set(sm.pos.x, sm.pos.y, sm.pos.z);
    st.heading = Math.atan2(-sm.tan.x, -sm.tan.z);
    st.v = 62; st.lat = 0; st.vy = 0; st.airborne = false;
    st.sHint = sm.s; st.lastS = sm.s;
    G.player.isPlayer = false;
    st.ai = { laneOffset: 0, skill: 0.9, lookAhead: 0.014 };
    const probe = { airs: [], airSince: null, vLaunch: 0, s0: sm.s, t0: performance.now() };
    function sample() {
      if (st.airborne && probe.airSince === null) {
        probe.airSince = performance.now(); probe.vLaunch = st.v;
      } else if (!st.airborne && probe.airSince !== null) {
        probe.airs.push({ t: (performance.now() - probe.airSince) / 1000, vLaunch: probe.vLaunch, vLand: st.v });
        probe.airSince = null;
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
    window.__probeD = probe;
  });
  await page.waitForTimeout(6000);
  const partD = await page.evaluate(() => {
    const G = window.__corrida, p = window.__probeD, st = G.player.st;
    // progresso relativo ao TELEPORTE (st.progress ainda era o do grid quando
    // o teleporte aconteceu — lap + s só re-sincroniza no próximo stepCar)
    return {
      airs: p.airs, airborne: st.airborne, v: st.v, roll: st.roll,
      progressGain: (st.lap + st.sHint) - p.s0,
    };
  });
  const bestAir = partD.airs.reduce((m, a) => Math.max(m, a.t), 0);
  const launchV = partD.airs.reduce((m, a) => Math.max(m, a.vLaunch), 0);
  check('D1: lombada a 62 u/s DECOLA o carro', partD.airs.length >= 1 && launchV >= 55,
    `episódios de voo=${partD.airs.length}, v no lançamento=${launchV.toFixed(1)} u/s`);
  check('D2: tempo de voo > 0,25 s (projeção visível)', bestAir > 0.25,
    `voo mais longo=${bestAir.toFixed(2)} s (${JSON.stringify(partD.airs.map((a) => +a.t.toFixed(2)))})`);
  check('D3: pouso limpo e o carro SEGUE correndo',
    partD.airs.length >= 1 && !partD.airborne && partD.v > 15 && Math.abs(partD.roll) < 0.6 && partD.progressGain > 0.02,
    `airborne=${partD.airborne} v=${partD.v.toFixed(1)} roll=${partD.roll.toFixed(2)} progresso=+${partD.progressGain.toFixed(3)} volta`);

  // ── PART E: TODA lombada dispara @60 e NÃO tem curva na zona de pouso ─────
  // Espelha a regra de physics.js (gatilho climbV<−9, vy=min(−climbV·1,1,
  // 3+v·0,16), GRAV=28) e o pior caso Velocità GT (76 u/s) com 10 u de margem.
  // WS-5: pistas ABERTAS (sprint) clamparam índices (sem wrap) e o
  // comprimento não inclui o retorno A→B — cobre as 3 cristas da Serra.
  const partE = await page.evaluate(async () => {
    const { TRACKS } = await import('/src/web-games/speed-run/src/tracks.js');
    const { sampleTrack } = await import('/src/web-games/speed-run/src/world.js');
    const GRAV = 28, VMAX = 76;
    const out = [];
    for (const def of TRACKS) {
      const track = sampleTrack(def);
      const S = track.samples, N = S.length;
      const open = track.open;
      const idx = (i) => open ? Math.max(0, Math.min(N - 1, i)) : ((i % N) + N) % N;
      let len = 0;
      const lastI = open ? N - 1 : N;
      for (let i = 0; i < lastI; i++) len += S[i].pos.distanceTo(S[idx(i + 1)].pos);
      const kap = S.map((sm, i) => {
        const a = S[idx(i - 3)], b = S[idx(i + 3)];
        const arc = a.pos.distanceTo(sm.pos) + sm.pos.distanceTo(b.pos);
        return a.tan.angleTo(b.tan) / Math.max(arc, 1e-6);
      });
      const slopeAt = (i) => (S[idx(i + 1)].pos.y - S[i].pos.y)
        / Math.max(S[i].pos.distanceTo(S[idx(i + 1)].pos), 1e-6);
      for (const b of def.bumps) {
        const ib = Math.round(b * (open ? N - 1 : N)) % N;
        let minSl = 0;
        for (let k = -20; k <= 20; k++) minSl = Math.min(minSl, slopeAt(idx(ib + k)));
        const vy = Math.min(Math.max(2.5, -minSl * VMAX * 1.1), 3 + VMAX * 0.16);
        const D = 2 * VMAX * vy / GRAV + 10;
        let kMax = 0, kMaxS = 0;
        for (let k = 0; k <= Math.ceil(D / len * N); k++) {
          const i = idx(ib + k);
          if (kap[i] > kMax) { kMax = kap[i]; kMaxS = S[i].s; }
        }
        out.push({ key: def.key, b, climb60: minSl * 60, vy, D, kMax, kMaxS });
      }
    }
    return out;
  });
  for (const r of partE) {
    check(`E1: ${r.key} lombada s=${r.b} DECOLA a 60 u/s`, r.climb60 < -9,
      `climbV@60=${r.climb60.toFixed(1)} u/s (gatilho −9), vy@76=${r.vy.toFixed(1)}`);
    check(`E2: ${r.key} lombada s=${r.b} — SEM curva antes do pouso (D=${r.D.toFixed(0)} u)`,
      r.kMax < 0.002,
      `κmáx na zona=${r.kMax.toFixed(5)} rad/u (R=${(1 / r.kMax).toFixed(0)} u) @ s=${r.kMaxS.toFixed(3)}`);
  }
} finally {
  await browser.close();
  if (server) server.kill();
}

const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} checks passaram`);
process.exit(fails.length ? 1 : 0);

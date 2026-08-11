// full-scan.mjs — FULL SCAN de defeitos de pista (operador 2026-08-11: "não
// podemos deixar de forma alguma defeitos de relevos invisíveis na pista").
// Vasculha TODAS as pistas (city, forest, arizona, serra) atrás de:
//
//   a. rejeições do surfaceAt (q.rejected) COM o carro sobre a pista — bug;
//   b. eventos de cerca fantasma (clamp/ricochete longe da cerca real);
//   c. continuidade do relevo (|Δh| > 0,35 m por 0,5 m) + zona de pouso de
//      TODA crista que dispara o gatilho de voo (κ < 0.002, regra do PART E
//      do probe.mjs — inclui as cristas do sprint E cristas não-desenhadas);
//   d. flicker de superfície (asfalto/terra/vado) a offset lateral constante,
//      estático (varredura) e dinâmico (dirigindo);
//   e. invasão de props (árvores, pedras, placas, torcida, pórticos, prédios,
//      cabines, postes, mesas) no corredor dirigível (estrada + 0,5 m) —
//      cenário NÃO tem colisor: prop sobre a pista = "pedra invisível" visual
//      (atravessar uma árvore também é defeito);
//   f. contenção: quem está DENTRO do corredor nunca atravessa a cerca num
//      substep (a cerca é barreira UNILATERAL: sair por trecho fenceless e
//      voltar pelo flanco é legal — o que é proibido é o teleporte); bordas
//      da spline ABERTA do sprint não deixam o carro cair no vazio/NaN;
//   g. clampToFence (pós-colisão carro-carro) não pode capturar a perna
//      errada de um hairpin (mesma regra do M1 do stepCar).
//
// USO:
//   cd src/web-games && node tests/corrida/tools/full-scan.mjs
//   TEST_PORT=8094 node tests/corrida/tools/full-scan.mjs   (porta custom)
//
// O scan roda DENTRO da página (mesmos módulos do jogo, sem render): builda o
// mundo real de cada pista (buildWorld) e DIRIGE um carro simulado (stepCar a
// 120 Hz, direção da IA + cruise control) sobre a spline INTEIRA a 30/50/76
// u/s, com excursões offroad deliberadas a cada 1/14 de volta. Exit code 1 se
// houver qualquer finding CRITICAL ou HIGH.

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
  console.log(`server próprio na porta ${PORT} (pid ${server.pid})`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

let scan;
try {
  await page.goto(URL);
  await page.waitForFunction(() => window.__corridaReady === true, undefined, { timeout: 15000 });

  scan = await page.evaluate(async () => {
    const THREE = await import('/src/web-games/vendor/three.module.min.js');
    const { TRACKS } = await import('/src/web-games/speed-run/src/tracks.js');
    const { buildWorld, sampleAt } = await import('/src/web-games/speed-run/src/world.js');
    const P = await import('/src/web-games/speed-run/src/physics.js');
    const { aiInput } = await import('/src/web-games/speed-run/src/ai.js');
    const { CARS } = await import('/src/web-games/speed-run/src/cars.js');

    const GRAV = 28, VMAX = 76, FENCE_OFF = 2.55;
    const findings = [];
    const info = [];
    const add = (sev, track, check, s, msg) =>
      findings.push({ sev, track, check, s: s === null || s === undefined ? null : +s.toFixed(4), msg });
    const seen = new Set();
    const addOnce = (sev, track, check, s, msg) => {
      const k = `${track}|${check}|${msg}`;
      if (seen.has(k)) return;
      seen.add(k); add(sev, track, check, s, msg);
    };

    // distância centerline rápida + amostra vencedora (varredura global)
    function nearSample(S, x, z, stride = 3) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < S.length; i += stride) {
        const dx = S[i].pos.x - x, dz = S[i].pos.z - z, d = dx * dx + dz * dz;
        if (d < bd) { bd = d; bi = i; }
      }
      for (let i = Math.max(0, bi - stride); i <= Math.min(S.length - 1, bi + stride); i++) {
        const dx = S[i].pos.x - x, dz = S[i].pos.z - z, d = dx * dx + dz * dz;
        if (d < bd) { bd = d; bi = i; }
      }
      return { i: bi, dist: Math.sqrt(bd) };
    }

    for (const def of TRACKS) {
      const scene = new THREE.Scene();
      const world = buildWorld(def, scene);
      const track = world.track, S = track.samples, N = S.length, M = track.M;
      const open = track.open, L = world.trackLen;
      const clampI = (i) => open ? Math.max(0, Math.min(N - 1, i)) : ((i % N) + N) % N;
      const lastI = open ? N - 1 : N;

      // ── C1: continuidade do relevo (|Δh| por 0,5 m > 0,35 ⇒ slope > 0,7) ──
      let maxSlope = 0, maxSlopeS = 0;
      for (let i = 0; i < lastI; i++) {
        const a = S[i], b = S[clampI(i + 1)];
        const ds = a.pos.distanceTo(b.pos);
        const sl = Math.abs(b.pos.y - a.pos.y) / Math.max(ds, 1e-6);
        if (sl > maxSlope) { maxSlope = sl; maxSlopeS = a.s; }
        if (sl > 0.7) add('HIGH', def.key, 'relief-step', a.s,
          `degrau de relevo: |Δh|=${Math.abs(b.pos.y - a.pos.y).toFixed(2)} m em ${ds.toFixed(2)} m (slope ${sl.toFixed(2)} > 0,70)`);
      }
      info.push(`${def.key}: slope máx ${maxSlope.toFixed(3)} @ s=${maxSlopeS.toFixed(3)} (${(maxSlope * 0.5).toFixed(2)} m por 0,5 m)`);

      // ── C2: TODA crista que dispara voo a 76 u/s (slope < −9/76) tem zona
      //    de pouso reta (κ < 0.002) — cobre lombadas desenhadas E cristas de
      //    morro não intencionais (regra do probe PART E, generalizada) ──────
      const kap = S.map((sm, i) => {
        const a = S[clampI(i - 3)], b = S[clampI(i + 3)];
        const arc = a.pos.distanceTo(sm.pos) + sm.pos.distanceTo(b.pos);
        return a.tan.angleTo(b.tan) / Math.max(arc, 1e-6);
      });
      const slopeAt = (i) => (S[clampI(i + 1)].pos.y - S[i].pos.y)
        / Math.max(S[i].pos.distanceTo(S[clampI(i + 1)].pos), 1e-6);
      const TRIG = -9 / VMAX;                       // slope que dispara a 76 u/s
      let crests = 0, kWorst = 0;
      for (let i = 0; i < lastI; i++) {
        if (slopeAt(i) >= TRIG) continue;
        // agrupa a crista: varre enquanto desce
        let j = i, minSl = slopeAt(i);
        while (j < lastI && slopeAt(j) < 0 && j - i < 200) { minSl = Math.min(minSl, slopeAt(j)); j++; }
        const vy = Math.min(Math.max(2.5, -minSl * VMAX * 1.1), 3 + VMAX * 0.16);
        const D = 2 * VMAX * vy / GRAV + 10;
        // âncora da zona de pouso = CRISTA (máx local de y junto ao início da
        // descida), não o ponto onde o slope cruza o gatilho — medir do ponto
        // de gatilho estica a janela além do pouso balístico real
        let apex = i;
        for (let k = 0; k <= 10; k++) {
          const ii = clampI(i - k);
          if (S[ii].pos.y >= S[apex].pos.y) apex = ii;
        }
        let kMax = 0, kMaxS = 0;
        for (let k = 0; k <= Math.ceil(D / L * N); k++) {
          const ii = clampI(apex + k);
          if (kap[ii] > kMax) { kMax = kap[ii]; kMaxS = S[ii].s; }
        }
        kWorst = Math.max(kWorst, kMax); crests++;
        const designed = def.bumps.some((b) => {
          let d = Math.abs(S[i].s - b); if (!open) d = Math.min(d, 1 - d);
          return d * L < 30;
        });
        if (kMax >= 0.002) add('HIGH', def.key, 'landing-zone', S[i].s,
          `crista ${designed ? '(lombada)' : '(NÃO desenhada!)'} s=${S[i].s.toFixed(3)}: κmáx=${kMax.toFixed(5)} na zona de pouso (D=${D.toFixed(0)} u) @ s=${kMaxS.toFixed(3)}`);
        else if (!designed) add('MEDIUM', def.key, 'undesigned-crest', S[i].s,
          `crista NÃO desenhada dispara voo a 76 u/s (slope ${minSl.toFixed(3)}, vy=${vy.toFixed(1)}) — pouso reto ok (κ=${kMax.toFixed(5)})`);
        i = j;
      }
      info.push(`${def.key}: ${crests} cristas que disparam voo @76; κmáx pior zona ${kWorst.toFixed(5)}`);

      // ── D1: flicker de superfície ESTÁTICO — 5 offsets laterais fixos ─────
      const bounds = [];
      for (const [a, b] of [...(def.dirt || []), ...(def.fords || [])]) bounds.push(a, b);
      const nearBound = (s) => bounds.some((bs) => {
        let d = Math.abs(s - bs); if (!open) d = Math.min(d, 1 - d);
        return d < 5 / M;
      });
      for (const f of [0, 0.25, -0.25, 0.44, -0.44]) {
        let hint = 0, prev = null, prevTrans = null;
        for (let i = 0; i <= lastI; i++) {
          const sm = S[open ? i : i % N];
          const off = f * sm.width;
          const q = world.surfaceAt(sm.pos.x + sm.side.x * off, sm.pos.z + sm.side.z * off, hint, 6 / M);
          hint = q.s;
          if (prev && q.surface !== prev.surf) {
            const t = { i, s: q.s, from: prev.surf, to: q.surface };
            // flicker REAL = A→B→A em poucas amostras (oscilação de grip);
            // uma transição única numa borda declarada é o desenho da pista
            if (prevTrans && prevTrans.from === t.to && t.i - prevTrans.i <= 4)
              add('MEDIUM', def.key, 'surface-flicker', t.s,
                `offset ${f}: ${prevTrans.from}→${prevTrans.to}→${t.to} em ${t.i - prevTrans.i} amostras (oscilação)`);
            else if (!nearBound(t.s))
              add('MEDIUM', def.key, 'surface-flicker', t.s,
                `offset ${f}: transição ${t.from}→${t.to} LONGE de borda declarada`);
            prevTrans = t;
          }
          prev = { surf: q.surface, i };
        }
      }

      // ── E: invasão de props no corredor dirigível (estrada + 0,5 m) ───────
      {
        const root = scene.getObjectByName('worldRoot');
        root.updateMatrixWorld(true);
        const m4 = new THREE.Matrix4(), corner = new THREE.Vector3();
        const checkObj = (matrixWorld, geo, tag) => {
          if (!geo.boundingBox) geo.computeBoundingBox();
          const bb = geo.boundingBox;
          let minPen = Infinity, bestY0 = 0, bestY1 = 0, bestI = 0;
          for (let cx = 0; cx < 2; cx++) for (let cy = 0; cy < 2; cy++) for (let cz = 0; cz < 2; cz++) {
            corner.set(cx ? bb.max.x : bb.min.x, cy ? bb.max.y : bb.min.y, cz ? bb.max.z : bb.min.z);
            corner.applyMatrix4(matrixWorld);
            const near = nearSample(S, corner.x, corner.z);
            const hw = S[near.i].width / 2;
            const pen = near.dist - hw;                 // >0: fora da estrada
            if (pen < minPen) {
              minPen = pen; bestI = near.i;
              bestY0 = Math.min(bestY0, corner.y); bestY1 = Math.max(bestY1, corner.y);
              if (cy === 0) bestY0 = corner.y; else bestY1 = corner.y;
            }
          }
          // zona do carro: roadY − 0,5 … roadY + 2,5 (pórtico a 8 m não conta)
          const roadY = S[bestI].pos.y;
          if (bestY0 > roadY + 2.5 || bestY1 < roadY - 0.5) return;
          if (minPen < 0) add('HIGH', def.key, 'prop-on-road', S[bestI].s,
            `${tag} SOBRE a pista: canto invade ${(-minPen).toFixed(2)} m para dentro da borda`);
          else if (minPen < 0.5) add('MEDIUM', def.key, 'prop-near-road', S[bestI].s,
            `${tag} a ${minPen.toFixed(2)} m da borda da estrada (< 0,5 m)`);
        };
        root.traverse((obj) => {
          if (obj.isInstancedMesh) {
            for (let k = 0; k < obj.count; k++) {
              obj.getMatrixAt(k, m4);
              m4.premultiply(obj.matrixWorld);
              checkObj(m4, obj.geometry, `${obj.geometry.type}[${k}]`);
            }
          } else if (obj.isMesh && /^(Plane|Cylinder|Box|Cone|Dodecahedron)Geometry$/.test(obj.geometry.type)) {
            checkObj(obj.matrixWorld, obj.geometry, obj.geometry.type);
          }
        });
      }

      // ── G: clampToFence (pós-colisão) não pode mover carro DENTRO da cerca
      //    (captura de perna errada no hairpin — mesma regra do M1) ──────────
      {
        let moved = 0;
        for (let i = 0; i < N; i += 5) {
          const sm = S[i];
          if (sm.fenceless) continue;
          const off = sm.width / 2 + 1.5;               // acostamento, dentro da cerca
          for (const sd of [-1, 1]) {
            const st = P.makeCarState(CARS[2],
              new THREE.Vector3(sm.pos.x + sm.side.x * off * sd, sm.pos.y, sm.pos.z + sm.side.z * off * sd),
              Math.atan2(-sm.tan.x, -sm.tan.z));
            st.sHint = sm.s;
            const x0 = st.pos.x, z0 = st.pos.z;
            P.clampToFence(st, world);
            const d = Math.hypot(st.pos.x - x0, st.pos.z - z0);
            if (d > 0.02) {
              moved++;
              if (moved <= 3) add('CRITICAL', def.key, 'clamp-inside-fence', sm.s,
                `clampToFence moveu carro DENTRO da cerca em ${d.toFixed(2)} m (perna errada?)`);
            }
          }
        }
        info.push(`${def.key}: clampToFence moveu carro dentro da cerca em ${moved}/${Math.ceil(N / 5) * 2} pontos`);
      }

      // ── A/B/D2/F: DIRIGIR a spline inteira a 30/50/76 u/s + excursões ─────
      for (const target of [30, 50, 76]) {
        const sm0 = S[0];
        const st = P.makeCarState(CARS[2], sm0.pos.clone(), Math.atan2(-sm0.tan.x, -sm0.tan.z));
        st.sHint = sm0.s; st.lastS = sm0.s;
        st.ai = { laneOffset: 0, skill: 1, lookAhead: 0.014 };
        const dt = 1 / 120;
        const maxSteps = Math.ceil(L / target * 120 * 3 + 24000);
        let total = 0, prevS = st.sHint, steps = 0;
        let prevX = st.pos.x, prevZ = st.pos.z;
        let excT = 0, excDir = 1, nextExc = 0.06;
        let prevSurf = null, flips = [], settle = 0, prevOver = -1, prevW = null;
        let walls = 0, rej = 0;
        while (steps++ < maxSteps) {
          const input = aiInput(st, world, 0);
          input.throttle = st.v < target ? 1 : 0;
          input.brake = st.v > target * 1.06 ? 0.6 : 0;
          if (excT > 0) { excT -= dt; input.steer = excDir; }
          else if (total >= nextExc && nextExc < (open ? 0.98 : 1.0)) {
            excT = 1.1; excDir = -excDir; nextExc += 1 / 14;
          }
          const q = P.stepCar(st, input, world, dt);
          if (!Number.isFinite(st.pos.x + st.pos.y + st.pos.z + st.v + st.heading)) {
            add('CRITICAL', def.key, 'nan', q.s, `estado NaN/Inf a ${target} u/s após ${steps} substeps`);
            break;
          }
          // (a) rejeição do surfaceAt — sobre a pista é BUG
          if (q.rejected) {
            rej++;
            if (q.dist <= q.w / 2) addOnce('CRITICAL', def.key, 'reject-on-road', q.s,
              `surfaceAt REJEITOU com carro SOBRE a pista (dist ${q.dist.toFixed(2)} ≤ ${(q.w / 2).toFixed(2)}) a ${target} u/s`);
            else if (q.dist <= q.w / 2 + FENCE_OFF) addOnce('MEDIUM', def.key, 'reject-in-corridor', q.s,
              `surfaceAt rejeitou no corredor da cerca (dist ${q.dist.toFixed(2)}) a ${target} u/s`);
          }
          // (b) cerca fantasma: hitWall longe da cerca REAL (busca global)
          if (st.hitWall) {
            walls++;
            const qF = world.surfaceAt(st.pos.x, st.pos.z);
            const fenceReal = qF.w / 2 + FENCE_OFF;
            if (qF.dist < fenceReal - 0.7) addOnce('CRITICAL', def.key, 'ghost-wall', q.s,
              `hitWall a ${qF.dist.toFixed(2)} m da centerline (cerca real a ${fenceReal.toFixed(2)}) a ${target} u/s`);
          }
          // (f) contenção: BRECHA = estava DENTRO (over ≤ 0,26) e apareceu
          // fora na zona em que o clamp DEVERIA agir (over ≤ travel + 1,46).
          // Fora disso é a saída unilateral legal (fenceless/estreitamento).
          // ESTREITAMENTO de largura local (sprint: dupla 18,4 → single 9,4
          // em s=0,30): a CERCA encolhe sob o carro — `over` cresce sem
          // movimento lateral; mesma exceção da BARREIRA UNILATERAL do
          // physics.js (não clampa; o carro retorna pelo flanco).
          {
            const FENCE = q.w / 2 + FENCE_OFF;
            const dPost = Math.hypot(st.pos.x - q.cx, st.pos.z - q.cz);
            const travel = (Math.abs(st.v) + Math.abs(st.lat)) * dt;
            const over = dPost - FENCE;
            const narrowed = prevW !== null && q.w < prevW - 0.5;
            if (!narrowed && !q.fenceless && prevOver <= 0.26 && over > 0.26 && over <= travel + 1.46)
              addOnce('CRITICAL', def.key, 'uncontained', q.s,
                `carro atravessou a cerca pós-step: ${dPost.toFixed(2)} > ${FENCE.toFixed(2)} a ${target} u/s`);
            prevOver = over;
            prevW = q.w;
          }
          // salto de posição implausível (teleporte)
          {
            const moved = Math.hypot(st.pos.x - prevX, st.pos.z - prevZ);
            const plaus = (Math.abs(st.v) + Math.abs(st.lat)) * dt + 3.0;
            if (moved > plaus) addOnce('CRITICAL', def.key, 'teleport', q.s,
              `salto de ${moved.toFixed(2)} m num substep (plausível ${plaus.toFixed(2)}) a ${target} u/s`);
          }
          // relevo: grudado no chão, Y segue roadY
          if (!st.airborne && Math.abs(st.pos.y - q.roadY) > 0.05) addOnce('HIGH', def.key, 'y-diverge', q.s,
            `carro grudado com Y ${(st.pos.y - q.roadY).toFixed(2)} m fora da estrada a ${target} u/s`);
          if (st.pos.y < -1.5) addOnce('CRITICAL', def.key, 'void', q.s,
            `carro abaixo do chão (y=${st.pos.y.toFixed(1)}) a ${target} u/s`);
          // (d) flicker de superfície DINÂMICO: só em CRUZEIRO (excursões
          // cruzam a borda da pista de propósito), totalmente sobre a estrada,
          // entre superfícies DA pista. Flicker = reversão sub-amostra (<0,15 s)
          // ou oscilação dupla (A→B→A→B) em 1 s. Uma travessia A→B→A lenta é
          // só um trecho estreito (vado) sendo cruzado — não é flicker.
          if (excT > 0) { settle = 120; flips = []; }
          else if (settle > 0) { settle--; flips = []; }
          else if (prevSurf && q.surface !== prevSurf
            && q.surface !== 'offroad' && prevSurf !== 'offroad'
            && q.dist < q.w / 2 - 0.3) {
            flips.push({ from: prevSurf, to: q.surface, step: steps });
            while (flips.length && steps - flips[0].step > 60) flips.shift();
            const n = flips.length;
            const fastRevert = n >= 2 && flips[n - 1].to === flips[n - 2].from
              && flips[n - 1].step - flips[n - 2].step < 18;
            const doubleOsc = n >= 3 && flips[n - 1].to === flips[n - 3].to
              && flips[n - 1].from === flips[n - 2].from && flips[n - 2].to === flips[n - 3].to;
            if (fastRevert || doubleOsc)
              addOnce('MEDIUM', def.key, 'surface-flicker-drive', q.s,
                `superfície oscilando (${flips.map((x) => x.from + '→' + x.to).join(', ')}) em ${((steps - flips[0].step) / 120).toFixed(2)} s a ${target} u/s`);
          }
          prevSurf = q.surface;
          prevX = st.pos.x; prevZ = st.pos.z;
          // progresso de arco (fecha a volta / chega ao fim do sprint)
          let ds = q.s - prevS;
          if (!open) { if (ds < -0.5) ds += 1; else if (ds > 0.5) ds -= 1; }
          total = Math.max(total, total + Math.max(0, ds));
          prevS = q.s;
          if (open ? st.sHint >= 0.995 : total >= 1.004) break;
        }
        info.push(`${def.key} @${target}: ${steps} substeps, arc=${total.toFixed(3)}, paredes=${walls}, rejeições=${rej}, fim s=${st.sHint.toFixed(3)}`);
        if (!(open ? st.sHint >= 0.99 : total >= 1.0)) add('HIGH', def.key, 'incomplete-lap', st.sHint,
          `scan a ${target} u/s NÃO completou a pista (arc=${total.toFixed(3)}, s=${st.sHint.toFixed(3)}) — carro preso?`);
      }

      // ── F2: bordas da spline ABERTA — dirigir além dos fins não pode NaN/
      //    cair no vazio (não há cerca transversal nas pontas) ───────────────
      if (open) {
        for (const dir of [1, -1]) {
          const sm = sampleAt(track, dir > 0 ? 0.999 : 0.001);
          const st = P.makeCarState(CARS[2], sm.pos.clone(),
            Math.atan2(-sm.tan.x * dir, -sm.tan.z * dir));
          st.sHint = sm.s; st.lastS = sm.s; st.v = 40 * dir;
          st.ai = null;
          let ok = true;
          for (let k = 0; k < 1200; k++) {
            P.stepCar(st, { throttle: dir > 0 ? 1 : 0, brake: dir > 0 ? 0 : 1, steer: 0 }, world, 1 / 120);
            if (!Number.isFinite(st.pos.x + st.pos.y + st.pos.z)) { ok = false; break; }
          }
          if (!ok || st.pos.y < -1.5) add('CRITICAL', def.key, 'open-edge', sm.s,
            `dirigir além da ponta ${dir > 0 ? 'final' : 'inicial'}: NaN=${!ok}, y=${st.pos.y.toFixed(1)}`);
        }
      }
    }
    return { findings, info };
  });
} finally {
  await browser.close();
  if (server) server.kill();
}

// ── relatório ───────────────────────────────────────────────────────────────
const SEV = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
scan.findings.sort((a, b) => SEV[a.sev] - SEV[b.sev] || a.track.localeCompare(b.track) || (a.s ?? 0) - (b.s ?? 0));
console.log('\n══ INFO ══');
for (const l of scan.info) console.log(`  ${l}`);
console.log('\n══ FINDINGS ══');
if (!scan.findings.length) console.log('  (nenhum)');
for (const f of scan.findings) console.log(`  [${f.sev}] ${f.track} ${f.check}${f.s !== null ? ` @s=${f.s}` : ''} — ${f.msg}`);
const nCrit = scan.findings.filter((f) => f.sev === 'CRITICAL').length;
const nHigh = scan.findings.filter((f) => f.sev === 'HIGH').length;
const nMed = scan.findings.filter((f) => f.sev === 'MEDIUM').length;
console.log(`\n${scan.findings.length} findings: ${nCrit} CRITICAL, ${nHigh} HIGH, ${nMed} MEDIUM`);
process.exit(nCrit + nHigh > 0 ? 1 : 0);

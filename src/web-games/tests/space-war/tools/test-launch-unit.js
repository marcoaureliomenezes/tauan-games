// test-launch-unit.js — Sequência de decolagem pilotada (backport do space-war
// Godot: LANDED → ASCENT → GRAVITY_TURN → INSERTED). Roda em node puro:
//   node --experimental-default-type=module tests/space-war/tools/test-launch-unit.js
//
// Prova, no controlador REAL (src/launch.js), integrando um planeta pinado com
// gravidade + arrasto atmosférico (o mesmo modelo do ship.js):
//  1. W mantido: a subida atravessa TODOS os estágios e INSERE em órbita.
//  2. A inserção respeita a janela: alt ∈ [0,8; 1,3]×altT, v_tan ≈ v_circ local
//     (±1%), |v_rad| ≤ 1% v_circ — órbita de entrada fecha redonda.
//  3. A órbita resultante FECHA: 2 períodos de coast puro mantêm r na banda.
//  4. Boosters separam na ordem e altitude certas (2 eventos, subida baixa).
//  5. W solto no meio: empuxo zero (coast) — a nave NÃO insere sozinha.
//  6. O perfil não é instantâneo: inserção nunca antes de MIN_T.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLaunch, launchTick, entryOrbitRadius, entrySpeed, LAUNCH, LAUNCH_STAGE,
} from '../../../space-war/src/launch.js';

// Terra na ESCALA DE RUNTIME do jogo (pós-scaling do build: R 3300, μ 4,29e7 —
// g_surf ≈ 3,94 u/s², a mesma escala do Godot) + atmosfera do jogo (0,28R).
const R_EARTH = 3300;
const EARTH = { def: { radius: R_EARTH }, mu: 42856709.28 };
const ATMO_THICK = R_EARTH * 0.28, ATMO_DRAG = 0.45;
const START_ALT = 6;

// Integra a subida no frame do planeta (pinado): empuxo do controlador +
// gravidade central + arrasto atmosférico co-móvel. Espelho do updateLaunch
// do ship.js. wFn(t) diz se W está pressionado no instante t.
function simulate(wFn, maxT = 240, dt = 1 / 60) {
  const L = createLaunch();
  L.stage = LAUNCH_STAGE.ASCENT;                    // liftoff já disparado
  const rel = {
    pos: { x: R_EARTH + START_ALT, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
  };
  const log = { events: [], insertedAt: null, minR: Infinity };
  for (let t = 0; t < maxT; t += dt) {
    const out = launchTick(L, rel, EARTH, wFn(t), dt);
    // física do frame pinado (como ship.js): empuxo + gravidade + arrasto
    const r = Math.hypot(rel.pos.x, rel.pos.y, rel.pos.z);
    log.minR = Math.min(log.minR, r);
    const g = EARTH.mu / (r * r);
    rel.vel.x += (out.ax - (rel.pos.x / r) * g) * dt;
    rel.vel.y += (out.ay - (rel.pos.y / r) * g) * dt;
    rel.vel.z += (out.az - (rel.pos.z / r) * g) * dt;
    const alt = r - R_EARTH;
    if (alt < ATMO_THICK) {
      const depth = Math.max(0, Math.min(1, 1 - alt / ATMO_THICK));
      const f = Math.max(0, 1 - ATMO_DRAG * depth * dt);
      rel.vel.x *= f; rel.vel.y *= f; rel.vel.z *= f;
    }
    rel.pos.x += rel.vel.x * dt; rel.pos.y += rel.vel.y * dt; rel.pos.z += rel.vel.z * dt;
    for (const e of L.events) log.events.push({ ...e, t });
    L.events.length = 0;
    if (L.stage === LAUNCH_STAGE.INSERTED) { log.insertedAt = t; break; }
    if (r < R_EARTH) { log.crashed = true; break; }
  }
  return { L, rel, log };
}

// Coast puro (sem empuxo) por `seconds` a partir do estado — a órbita fecha?
function coast(rel, seconds, dt = 1 / 60) {
  let rMin = Infinity, rMax = 0;
  for (let t = 0; t < seconds; t += dt) {
    const r = Math.hypot(rel.pos.x, rel.pos.y, rel.pos.z);
    rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
    const g = EARTH.mu / (r * r);
    rel.vel.x -= (rel.pos.x / r) * g * dt;
    rel.vel.y -= (rel.pos.y / r) * g * dt;
    rel.vel.z -= (rel.pos.z / r) * g * dt;
    rel.pos.x += rel.vel.x * dt; rel.pos.y += rel.vel.y * dt; rel.pos.z += rel.vel.z * dt;
  }
  return { rMin, rMax };
}

test('W mantido: ASCENT → GRAVITY_TURN → INSERTED, janela de inserção honrada', () => {
  const { L, rel, log } = simulate(() => true);
  assert.equal(log.crashed, undefined, 'não pode colidir com a superfície');
  assert.equal(L.stage, LAUNCH_STAGE.INSERTED, 'precisa inserir em órbita');
  assert.ok(log.events.some((e) => e.type === 'turn'), 'gravity turn anunciado');
  const r = Math.hypot(rel.pos.x, rel.pos.y, rel.pos.z);
  const alt = r - R_EARTH, altT = R_EARTH * LAUNCH.ENTRY_ALT_FRAC;
  assert.ok(alt >= altT * 0.8 && alt <= altT * 1.3, `altitude de entrada fora da banda: ${alt}`);
  const vCirc = Math.sqrt(EARTH.mu / r);
  const ur = { x: rel.pos.x / r, y: rel.pos.y / r, z: rel.pos.z / r };
  const vRad = rel.vel.x * ur.x + rel.vel.y * ur.y + rel.vel.z * ur.z;
  const sp = Math.hypot(rel.vel.x, rel.vel.y, rel.vel.z);
  const vTan = Math.sqrt(Math.max(0, sp * sp - vRad * vRad));
  assert.ok(Math.abs(vTan - vCirc) < vCirc * 0.011, `v_tan ${vTan} vs v_circ ${vCirc}`);
  assert.ok(Math.abs(vRad) < vCirc * 0.011, `v_rad residual: ${vRad}`);
});

test('a órbita de entrada FECHA: 2 períodos de coast mantêm r na banda', () => {
  const { rel } = simulate(() => true);
  const r0 = Math.hypot(rel.pos.x, rel.pos.y, rel.pos.z);
  const T = 2 * Math.PI * r0 / Math.sqrt(EARTH.mu / r0);
  const { rMin, rMax } = coast(rel, 2 * T);
  assert.ok(rMin > R_EARTH + ATMO_THICK * 0.5, `periastro caiu na atmosfera: ${rMin}`);
  assert.ok(rMax < r0 * 1.35, `apoastro aberto: ${rMax} (r0 ${r0})`);
});

test('boosters: 2 separações, em ordem, na subida baixa', () => {
  const { log } = simulate(() => true);
  const boosters = log.events.filter((e) => e.type === 'booster');
  assert.equal(boosters.length, 2);
  assert.deepEqual(boosters.map((b) => b.idx), [0, 1]);
  for (const b of boosters) assert.ok(b.t < 45, 'separação é evento da subida');
  assert.ok(boosters[0].t < boosters[1].t);
});

test('inserção nunca antes de MIN_T (não é cutscene instantânea)', () => {
  const { log } = simulate(() => true);
  assert.ok(log.insertedAt >= LAUNCH.MIN_T, `inseriu em ${log.insertedAt}s`);
});

test('W solto cedo na subida: coast, sem inserção mágica', () => {
  // cedo na subida a nave está longe de v_circ — soltar W deixa cair de volta
  // (soltar mais tarde, com v_tan ≈ v_circ, é órbita REAL e a inserção é honesta)
  const { L } = simulate((t) => t < 5, 60);
  assert.notEqual(L.stage, LAUNCH_STAGE.INSERTED, 'sem W não há inserção');
});

test('helpers de órbita de entrada (calibração do HUD)', () => {
  assert.ok(Math.abs(entryOrbitRadius(EARTH) - R_EARTH * (4 / 3)) < 1e-6);
  const v = entrySpeed(EARTH);
  assert.ok(Math.abs(v - Math.sqrt(EARTH.mu / (R_EARTH * 4 / 3))) < 1e-6);
});

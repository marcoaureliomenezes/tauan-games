// test-aero-defense-weapons.mjs — Validador Node da Onda D2 (T-D-04/T-D-05,
// release v0.3.5), adaptado ao contrato WEAPONS-V1
// (o modelo de mira do T-W-01 foi SUBSTITUÍDO pelo ciclo de fases do T-W-08 —
// guard de fonte abaixo; fases, roll 50%/80%, fila do X, tiers, retarget, rod,
// horda e nuke são cobertos por test-aero-defense-weapons-v1.mjs).
//
// Prova, sem browser (a lógica é PURA em src/defense/turret-weapons.js):
//   (a) calor da .50: só sobe atirando, trava em 100%, bloqueia o tiro
//       superaquecido e rearma ao esfriar até o threshold;
//   (b) balística da .50: NÃO hitscan (posição avança com dt), queda leve
//       presente, cap de alcance (~1200 m);
//   (c) lock: adquire dentro do cone ±12° após o tempo de tracking e perde
//       fora do cone / quebra de feixe;
//   (d) PN: converge num alvo reto em N s (sim) e ERRA um alvo que quebra
//       mais que o envelope de aceleração lateral (miss documentado);
//   (e) estoque/recarga do míssil AA (8 máx, 1 a cada 12 s);
//   (f) determinismo: rng injetado → resultados idênticos.
//   + guards de FONTE: módulo puro sem three/DOM, míssil no X (não RMB),
//     spawnBullet legado intacto (extensão aditiva de projectiles.js).
//
// Roda com: node --experimental-default-type=module tests/aero-fighters/tools/test-aero-defense-weapons.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { AA_DEFENSE } from '../../../aero-fighters/src/config.js';
import { createTurretPlayer } from '../../../aero-fighters/src/defense/turret-player.js';
import {
  mgFireTick, mgSpreadDir, mgStepBullet, angleOffAxis, pickLockTarget,
  stepLock, pnStep, stepAaRecharge, consumeAa,
  createDebugDrones, stepDrone, killDroneState,
} from '../../../aero-fighters/src/defense/turret-weapons.js';

const SRC = fileURLToPath(new URL('../../../aero-fighters/', import.meta.url));
const read = (rel) => readFileSync(SRC + rel, 'utf8');

/** rng determinístico (mulberry32) — requisito (f). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mkTurret = () =>
  createTurretPlayer({ x: -760, y: 100, z: -400, lookAt: { x: -250, y: 6, z: 250 } });

// ─── (a) Calor da .50 ────────────────────────────────────────────────────────

test('T-D-04: calor só sobe atirando; trava em 100%; bloqueia; rearma no threshold', () => {
  const t = mkTurret();
  // parado: não aquece nem atira
  assert.equal(mgFireTick(t.mg, 0.5, false), 0);
  assert.equal(t.mg.heat, 0);
  // cadência: ~MG_RPS tiros em 1 s (antes de aquecer demais)
  let shots1s = 0;
  for (let i = 0; i < 60; i++) shots1s += mgFireTick(t.mg, 1 / 60, true);
  assert.ok(Math.abs(shots1s - AA_DEFENSE.MG_RPS) <= 1, `cadência fora: ${shots1s}/s`);
  // Upgrade (operador 2026-07-19): overheat só após ~1 min CONTÍNUO (15 rps × 60 s
  // ≈ 900 tiros × MG_HEAT_PER_SHOT ≈ 100%) — guarda condizente com o novo contrato.
  const t2 = mkTurret();
  let guard = 0;
  while (!t2.mg.overheated && guard++ < 60 * 75) mgFireTick(t2.mg, 1 / 60, true);
  assert.ok(t2.mg.overheated, 'não superaqueceu segurando o gatilho por >1 min');
  assert.ok(guard > 60 * 50, `superaqueceu cedo demais (${(guard / 60).toFixed(1)}s — deveria passar de ~1 min)`);
  assert.ok(t2.mg.heat > 0.99 && t2.mg.heat <= 1, `calor não travou em ~100%: ${t2.mg.heat}`);
  // bloqueado enquanto superaquecido (mesmo com gatilho)
  assert.equal(mgFireTick(t2.mg, 1 / 60, true), 0, 'atirou superaquecido');
  // esfria até MG_RESUME e rearma (resfrio total ≈ 30 s parada — MG_COOL_RATE 1/30)
  let resumed = false;
  for (let i = 0; i < 60 * 35 && !resumed; i++) {
    if (mgFireTick(t2.mg, 1 / 60, true) > 0) resumed = true;
  }
  assert.ok(resumed, 'não rearmou após esfriar');
  assert.ok(t2.mg.heat <= AA_DEFENSE.MG_RESUME + AA_DEFENSE.MG_HEAT_PER_SHOT + 1e-9);
});

// ─── (b) Balística da .50 ────────────────────────────────────────────────────

test('T-D-04: projétil real — avança com dt, LINHA RETA (operador 2026-07-19), morre no cap', () => {
  const b = { x: 0, y: 100, z: 0, vx: 0, vy: 0, vz: -AA_DEFENSE.MG_SPEED, dist: 0 };
  const dt = 1 / 120;
  mgStepBullet(b, dt);
  // não hitscan: moveu só um passo (~3.75 m a 450 m/s)
  assert.ok(Math.abs(b.z) > 3 && Math.abs(b.z) < 4.5, `passo inesperado: ${b.z}`);
  // tracers em linha reta (MG_GRAVITY = 0): sem queda vertical
  assert.equal(b.vy, 0, 'gravidade atuou — o contrato novo é tracer reto');
  for (let i = 1; i < 120; i++) mgStepBullet(b, dt);
  assert.equal(b.y, 100, `caiu ${100 - b.y} m em 1 s — deveria ser reto`);
  // cap de alcance: distância percorrida cruza MG_RANGE perto de RANGE/SPEED s
  let t = 1;
  while (b.dist < AA_DEFENSE.MG_RANGE && t < 10) { mgStepBullet(b, dt); t += dt; }
  const expected = AA_DEFENSE.MG_RANGE / AA_DEFENSE.MG_SPEED;
  assert.ok(Math.abs(t - expected) / expected < 0.1, `tempo até o cap fora: ${t.toFixed(2)} vs ${expected.toFixed(2)}`);
});

test('T-D-04: dispersão é pequena e centrada na direção do cano', () => {
  const rng = mulberry32(42);
  const dir = { x: 0, y: 0, z: -1 };
  for (let i = 0; i < 200; i++) {
    const d = mgSpreadDir(dir, rng);
    const ang = angleOffAxis(dir, { x: 0, y: 0, z: 0 }, d);
    assert.ok(ang <= AA_DEFENSE.MG_SPREAD * Math.SQRT2 + 1e-9, `spread fora: ${ang}`);
    assert.ok(Math.abs(Math.hypot(d.x, d.y, d.z) - 1) < 1e-9, 'direção não normalizada');
  }
});

// ─── (c) Lock por cone ───────────────────────────────────────────────────────

test('T-D-05: lock adquire no cone após tracking e PERSISTE AA_LOCK_HOLD s sem feixe', () => {
  const drones = createDebugDrones();
  const eye = { x: AA_DEFENSE.SOLDIER_POS.x, y: 102, z: AA_DEFENSE.SOLDIER_POS.z };
  const d0 = drones[0];
  // mira exata no drone 0
  const len = Math.hypot(d0.x - eye.x, d0.y - eye.y, d0.z - eye.z);
  const fwd = { x: (d0.x - eye.x) / len, y: (d0.y - eye.y) / len, z: (d0.z - eye.z) / len };
  assert.equal(pickLockTarget(eye, fwd, drones), 0, 'não achou o drone no retículo');
  const lock = { idx: -1, track: 0, locked: false };
  // 1.2 s de tracking contínuo → travado
  for (let i = 0; i < 72; i++) stepLock(lock, pickLockTarget(eye, fwd, drones), 1 / 60);
  assert.ok(lock.locked, 'não travou após AA_LOCK_TIME');
  assert.ok(lock.track >= AA_DEFENSE.AA_LOCK_TIME);
  // Upgrade (operador 2026-07-19): quebra de feixe NÃO derruba o lock na hora —
  // a identificação persiste por AA_LOCK_HOLD s de carência...
  stepLock(lock, pickLockTarget(eye, { x: -fwd.x, y: 0, z: -fwd.z }, drones), 1 / 60);
  assert.ok(lock.locked, 'perdeu o lock instantaneamente (deveria persistir na carência)');
  assert.equal(lock.idx, 0, 'carência trocou o alvo');
  for (let i = 0; i < Math.floor(60 * (AA_DEFENSE.AA_LOCK_HOLD - 0.2)); i++) {
    stepLock(lock, -1, 1 / 60);
    assert.ok(lock.locked, `caiu antes de ${AA_DEFENSE.AA_LOCK_HOLD}s de carência`);
  }
  // ...e só cai DEPOIS da carência
  for (let i = 0; i < 60; i++) stepLock(lock, -1, 1 / 60);
  assert.equal(lock.locked, false, 'lock não caiu após a carência');
  assert.equal(lock.idx, -1);
  // fora do cone (>12°): sem candidato — inclina PARA BAIXO (cone+0.02): sai do
  // cone do drone 0 e se afasta dos demais (todos acima do olho). T-D-01
  // (nuke-firestorm-defense-v1): a sonda original inclinava para CIMA — com o
  // olho no novo morro ela caía dentro do cone do drone 2.
  const off = { x: fwd.x, y: fwd.y - Math.tan(AA_DEFENSE.AA_LOCK_CONE + 0.02), z: fwd.z };
  const ol = Math.hypot(off.x, off.y, off.z);
  assert.equal(pickLockTarget(eye, { x: off.x / ol, y: off.y / ol, z: off.z / ol }, drones), -1);
});

// ─── (d) PN: converge no alvo reto, erra na quebra fechada ──────────────────

/** Simula míssil × alvo com pnStep puro. @returns {hit, tHit, minD} */
function simPn(targetUpdate, maxT = AA_DEFENSE.AA_LIFE) {
  const m = { x: 0, y: 200, z: 0, vx: 0, vy: 0, vz: -AA_DEFENSE.AA_INITIAL_SPD };
  const t = { x: 0, y: 200, z: -600, vx: 40, vy: 0, vz: 0 };
  const dt = 1 / 120;
  let minD = Infinity;
  for (let time = 0; time < maxT; time += dt) {
    targetUpdate(t, dt, time, m);
    const d = pnStep(m, t, dt);
    if (d < minD) minD = d;
    if (d < AA_DEFENSE.AA_PROX_FUSE) return { hit: true, tHit: time, minD };
  }
  return { hit: false, tHit: maxT, minD };
}

test('T-D-05: PN converge num alvo em linha reta dentro da vida útil', () => {
  const r = simPn((t, dt) => { t.x += t.vx * dt; t.z += t.vz * dt; });
  assert.ok(r.hit, `não interceptou alvo reto (minD ${r.minD.toFixed(1)})`);
  assert.ok(r.tHit < AA_DEFENSE.AA_LIFE, `demorou demais: ${r.tHit.toFixed(2)}s`);
});

test('T-D-05: PN ERRA alvo que quebra mais que o envelope lateral (miss documentado)', () => {
  // Alvo voa reto até o míssil chegar a 130 m; então faz uma quebra sustentada
  // com aceleração lateral de 160 m/s² — muito além do cap AA_LAT_ACCEL (55).
  // O míssil não consegue curvar (seu raio mínimo de curva é v²/a ≈ 880 m) e
  // passa reto: miss. Vida finita garante a autodestruição.
  const BREAK_ACCEL = 160;
  const r = simPn((t, dt, _time, m) => {
    const dist = Math.hypot(t.x - m.x, t.y - m.y, t.z - m.z);
    if (dist < 130) {
      const v = Math.hypot(t.vx, t.vy, t.vz);
      const w = (BREAK_ACCEL / v) * dt; // rotação horizontal da velocidade
      const nx = t.vx * Math.cos(w) - t.vz * Math.sin(w);
      const nz = t.vx * Math.sin(w) + t.vz * Math.cos(w);
      t.vx = nx; t.vz = nz;
    }
    t.x += t.vx * dt; t.y += t.vy * dt; t.z += t.vz * dt;
  });
  assert.ok(!r.hit, `atingiu alvo fora do envelope (minD ${r.minD.toFixed(1)}) — miss deveria ocorrer`);
  assert.ok(r.minD > AA_DEFENSE.AA_PROX_FUSE, `passou perto demais: ${r.minD.toFixed(1)}`);
});

// ─── (e) Estoque/recarga ─────────────────────────────────────────────────────

test('T-D-05: estoque INFINITO + cadência AA_FIRE_INTERVAL (upgrade operador 2026-07-19)', () => {
  const t = mkTurret();
  assert.equal(t.ammo.aa, AA_DEFENSE.AA_MISSILES);
  assert.equal(t.ammo.aa, Infinity, 'estoque inicial não é infinito');
  // recarga é inerte com estoque ∞ (sempre cheio)
  stepAaRecharge(t, 30);
  assert.equal(t.ammo.aa, Infinity);
  // consome à vontade — nunca esvazia...
  for (let i = 0; i < 50; i++) { t.aaCooldown = 0; assert.ok(consumeAa(t), `recusou o tiro ${i}`); }
  assert.equal(t.ammo.aa, Infinity);
  // ...mas a cadência limita a 2 lançamentos/s (AA_FIRE_INTERVAL 0.5)
  const t2 = mkTurret();
  assert.ok(consumeAa(t2), 'primeiro lançamento bloqueado');
  assert.equal(consumeAa(t2), false, 'segundo lançamento imediato passou (cooldown falhou)');
  stepAaRecharge(t2, AA_DEFENSE.AA_FIRE_INTERVAL - 0.01);
  assert.equal(consumeAa(t2), false, 'cooldown expirou cedo demais');
  stepAaRecharge(t2, 0.02);
  assert.ok(consumeAa(t2), 'não liberou após AA_FIRE_INTERVAL');
});

// ─── (f) Determinismo via rng injetado ───────────────────────────────────────

test('T-D-04/05: mesma semente → mesmos tiros e mesma simulação', () => {
  const dir = { x: 0.2, y: 0.1, z: -1 };
  const a1 = mgSpreadDir(dir, mulberry32(7));
  const a2 = mgSpreadDir(dir, mulberry32(7));
  assert.deepEqual(a1, a2);
  const s1 = simPn((t, dt) => { t.x += t.vx * dt; });
  const s2 = simPn((t, dt) => { t.x += t.vx * dt; });
  assert.deepEqual(s1, s2);
});

// ─── Drones de debug: círculo, kill, queda, respawn ─────────────────────────

test('T-D-05: drone circula, cai ao morrer e respawna', () => {
  const drones = createDebugDrones();
  assert.equal(drones.length, AA_DEFENSE.DEBUG_DRONES);
  const d = drones[0];
  const x0 = d.x, z0 = d.z;
  stepDrone(d, 0.5, 0);
  assert.ok(d.x !== x0 || d.z !== z0, 'drone não se moveu');
  assert.equal(d.y, d.alt, 'drone fora da altitude do círculo');
  // velocidade tangencial ~= DRONE_SPEED (a PN precisa dela)
  assert.ok(Math.abs(Math.hypot(d.vx, d.vz) - AA_DEFENSE.DRONE_SPEED) < 1);
  // kill → queda até o chão → crash → respawn
  killDroneState(d);
  assert.ok(d.dead && d.falling);
  let ev = null, guard = 0;
  while (ev !== 'crashed' && guard++ < 4000) ev = stepDrone(d, 1 / 60, 4.6);
  assert.equal(ev, 'crashed', 'drone não chegou ao chão');
  ev = null; guard = 0;
  while (ev !== 'respawned' && guard++ < 4000) ev = stepDrone(d, 1 / 60, 4.6);
  assert.equal(ev, 'respawned', 'drone não respawnou');
  assert.ok(!d.dead && d.hp === AA_DEFENSE.DRONE_HP);
});

// ─── Guards de FONTE (integração sem clobber) ────────────────────────────────

test('Onda D2: turret-weapons é puro (sem three/DOM) e defense-mode usa X (não RMB)', () => {
  const tw = read('src/defense/turret-weapons.js');
  assert.ok(!/from\s+['"][^'"]*three/i.test(tw), 'turret-weapons.js não pode importar three');
  assert.ok(!/import\s*\*\s*as\s+THREE/.test(tw), 'turret-weapons.js não pode importar THREE');
  assert.ok(!/document\.|window\./.test(tw), 'turret-weapons.js não pode tocar DOM');
  const dm = read('src/defense/defense-mode.js');
  assert.match(dm, /onAction\('missile'/, 'míssil AA deveria estar no X (onAction missile)');
  assert.match(dm, /direito já é o ZOOM/i, 'decisão RMB→X não documentada');
  // WEAPONS-V1: o lock NÃO é gasto no 1º disparo — o handler conta o míssil
  // (noteLockShot); o modelo 3 s/3 tiros (T-W-01) foi SUBSTITUÍDO pelo ciclo
  // de fases do T-W-08 (stepLockPhase, weapons-v1.js — testado no arquivo v1).
  assert.match(dm, /noteLockShot/, 'handler do X deveria contar o disparo no lock');
  assert.match(dm, /stepLockPhase/, 'T-W-08: mira por fases ausente do defense-mode');
  assert.ok(!/gasta o lock ao disparar/.test(dm), 'lock ainda é gasto no 1º tiro');
  // drones só no modo: spawn dentro de defense-mode, não no map def
  const mapDef = read('src/maps/inhauma-defense.js');
  assert.ok(!/createDebugDrones/.test(mapDef), 'drone vazou para o map def (modo sempre-off violado)');
});

test('Onda D2: projectiles.js é extensão aditiva (callers legados intactos)', () => {
  const p = read('src/projectiles.js');
  assert.match(p, /export function spawnBullet\(orig, dir, isEnemy = false, opts = null\)/,
    'assinatura do spawnBullet mudou — clobber no caller legado');
  assert.match(p, /export function spawnMgBullet\(/, 'pool da .50 ausente');
  assert.match(p, /export function spawnAaMissile\(/, 'pool do míssil AA ausente');
  assert.match(p, /export function updateMgBullets\(/, 'update da .50 ausente');
  assert.match(p, /export function updateAaMissiles\(/, 'update do míssil AA ausente');
  // pools novos são arrays próprios — não dividem game.projectiles do voo
  assert.ok(!/game\.projectiles\.push\([\s\S]{0,80}MG_/.test(p), 'tracer da .50 no pool do voo');
});

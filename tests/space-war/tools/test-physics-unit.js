// test-physics-unit.js — Fidelidade física dos corpos compactos (release
// space-war-physics-fidelity-v1). Roda em node puro:
//   node --experimental-default-type=module tests/space-war/tools/test-physics-unit.js
//
// Prova as leis da literatura no código REAL do jogo:
//  1. Paczyński–Wiita: ISCO em 3·r_s — órbita a 3.5·r_s sobrevive, a 2.9·r_s mergulha.
//  2. Convergência newtoniana longe do horizonte (r ≫ r_s).
//  3. Gradiente de maré ∝ 1/r³.
//  4. Invariantes de massa do config: TOV, hierarquia SMBH, companheira ≥ 0.08 M☉.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pwAccel, pwCircularSpeed, tidalGradient, MU_SUN_GAME,
} from '../../../space-war/src/celestial/physics.js';

// Integra órbita 2D no potencial PW com semi-implícito Euler (mesma família de
// integração do jogo). Retorna r mínimo e máximo ao longo de nPeriods.
function integratePW(mu, rs, r0, vScale, nPeriods) {
  let x = r0, y = 0;
  const vCirc = pwCircularSpeed(mu, r0, rs);
  let vx = 0, vy = vCirc * vScale;
  const T = 2 * Math.PI * r0 / vCirc;
  const dt = T / 4000;
  let rMin = r0, rMax = r0;
  const steps = Math.ceil(nPeriods * T / dt);
  for (let i = 0; i < steps; i++) {
    const r = Math.hypot(x, y);
    rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
    if (r < rs * 1.02) return { rMin, rMax, plunged: true };
    const a = pwAccel(mu, r, rs);
    vx += (-x / r) * a * dt;
    vy += (-y / r) * a * dt;
    x += vx * dt; y += vy * dt;
  }
  return { rMin, rMax, plunged: false };
}

const MU = 5.0e12;   // BN estelar do jogo
const RS = 160;

test('PW: órbita circular a 3.5·r_s é ESTÁVEL (≥3 períodos, r nunca cai a 3·r_s)', () => {
  const { rMin, rMax, plunged } = integratePW(MU, RS, RS * 3.5, 0.995, 3);
  assert.equal(plunged, false);
  assert.ok(rMin > RS * 3.0, `rMin ${rMin.toFixed(0)} deve ficar acima da ISCO ${RS * 3}`);
  assert.ok(rMax < RS * 4.5, `rMax ${rMax.toFixed(0)} contido (órbita ligada)`);
});

test('PW: órbita a 2.9·r_s (abaixo da ISCO) com perturbação MERGULHA no horizonte', () => {
  const { plunged } = integratePW(MU, RS, RS * 2.9, 0.995, 6);
  assert.equal(plunged, true, 'abaixo da ISCO não existe órbita estável — mergulho');
});

test('PW: converge ao newtoniano longe do horizonte (r = 100·r_s → erro < 3%)', () => {
  const r = RS * 100;
  const newton = MU / (r * r);
  const pw = pwAccel(MU, r, RS);
  assert.ok(Math.abs(pw - newton) / newton < 0.03);
});

test('maré: gradiente ∝ 1/r³ (dobrar r divide o gradiente por 8)', () => {
  const g1 = tidalGradient(MU, 1000, 10);
  const g2 = tidalGradient(MU, 2000, 10);
  assert.ok(Math.abs(g1 / g2 - 8) < 1e-9);
});

test('config: massas respeitam a física (TOV, hierarquia SMBH, companheira)', async () => {
  const { BINARY, CORE, BETELGEUSE } = await import('../../../space-war/src/config.js');
  const nsSun = BINARY.neutronStar.mu / MU_SUN_GAME;
  assert.ok(nsSun <= 2.2, `NS ${nsSun} M☉ deve respeitar o limite TOV (~2.2)`);
  assert.ok(CORE.smbh.mu > BINARY.blackHole.mu,
    'SMBH deve ser mais massivo que qualquer BN estelar (hierarquia)');
  const compSun = BETELGEUSE.companion.mu / MU_SUN_GAME;
  assert.ok(compSun >= 0.08, `companheira ${compSun} M☉ ≥ limite de fusão de H (0.08)`);
  // Geometria EHT: anel na borda da sombra (2.6·r_s), disco interno na ISCO (3·r_s)
  assert.ok(Math.abs(BINARY.blackHole.photonRing / BINARY.blackHole.rs - 2.6) < 0.01);
  assert.ok(Math.abs(BINARY.blackHole.disk.inner / BINARY.blackHole.rs - 3.0) < 0.01);
  assert.ok(Math.abs(CORE.smbh.photonRing / CORE.smbh.rs - 2.6) < 0.01);
  assert.ok(Math.abs(CORE.smbh.disk.inner / CORE.smbh.rs - 3.0) < 0.01);
});

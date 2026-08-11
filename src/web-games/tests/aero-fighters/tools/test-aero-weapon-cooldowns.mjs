// test-aero-weapon-cooldowns.mjs — Validador Node do conceito de armas por
// CADÊNCIA (2026-08-11): munição infinita, cooldown por arma.
//
// Prova:
//   (a) valores canônicos — X 0.2 s (5/s), B 1.0 s, R 5.0 s, T (nuclear) 60 s;
//   (b) tryConsume arma o cooldown UMA vez e bloqueia até o relógio zerar;
//   (c) simulação de 1 s martelando X a 30 Hz → exatamente 5 disparos;
//       1 min martelando T → exatamente 1 disparo + 1 pronto no fim;
//   (d) shaveCooldown (recompensa de kills / pickups) e reset (serviço).
//
// Roda com: node --experimental-default-type=module tests/aero-fighters/tools/test-aero-weapon-cooldowns.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WEAPON_COOLDOWN_S,
  createWeaponCooldowns,
  tickWeaponCooldowns,
  weaponReady,
  tryConsume,
  cooldownFrac,
  shaveCooldown,
  resetWeaponCooldowns,
} from '../../../aero-fighters/src/weapon-cooldowns.js';

test('valores canônicos: X 5/s, B 1/s, R 1/5s, T 1/min', () => {
  assert.equal(WEAPON_COOLDOWN_S.light, 0.2);
  assert.equal(WEAPON_COOLDOWN_S.heavy, 1.0);
  assert.equal(WEAPON_COOLDOWN_S.rod, 5.0);
  assert.equal(WEAPON_COOLDOWN_S.nuclear, 60.0);
});

test('estado inicial: todas prontas; tryConsume arma e bloqueia', () => {
  const cd = createWeaponCooldowns();
  for (const k of ['light', 'heavy', 'rod', 'nuclear']) {
    assert.equal(weaponReady(cd, k), true, `${k} deve nascer pronta`);
  }
  assert.equal(tryConsume(cd, 'nuclear'), true);
  assert.equal(cd.nuclear, 60);
  assert.equal(tryConsume(cd, 'nuclear'), false, 'segundo disparo bloqueado');
  assert.equal(cd.nuclear, 60, 'tentativa bloqueada não re-arma o cooldown');
  // Outras armas seguem independentes
  assert.equal(tryConsume(cd, 'light'), true);
  assert.equal(cd.light, 0.2);
});

test('tick decrementa até o piso 0 e libera a arma', () => {
  const cd = createWeaponCooldowns();
  tryConsume(cd, 'heavy');
  tickWeaponCooldowns(cd, 0.5);
  assert.equal(weaponReady(cd, 'heavy'), false);
  assert.ok(Math.abs(cd.heavy - 0.5) < 1e-9);
  tickWeaponCooldowns(cd, 10);
  assert.equal(cd.heavy, 0, 'nunca fica negativo');
  assert.equal(weaponReady(cd, 'heavy'), true);
});

test('cadência real: martelar X a 30 Hz por 1 s → exatamente 5 disparos', () => {
  const cd = createWeaponCooldowns();
  const dt = 1 / 30;
  let shots = 0;
  for (let t = 0; t < 1.0 - 1e-9; t += dt) {
    if (tryConsume(cd, 'light')) shots += 1;
    tickWeaponCooldowns(cd, dt);
  }
  assert.equal(shots, 5, `esperado 5 disparos/s, obtido ${shots}`);
});

test('cadência real: martelar T por 60 s → 1 disparo, pronto de novo no fim', () => {
  const cd = createWeaponCooldowns();
  const dt = 1 / 30;
  let shots = 0;
  const steps = Math.round(60 / dt);
  for (let i = 0; i < steps; i++) {
    if (tryConsume(cd, 'nuclear')) shots += 1;
    tickWeaponCooldowns(cd, dt);
  }
  assert.equal(shots, 1, 'apenas 1 nuke por minuto');
  // Soma de 1800 × 1/30 carrega erro de float (~1e-13); o frame seguinte fecha.
  tickWeaponCooldowns(cd, dt);
  assert.equal(weaponReady(cd, 'nuclear'), true, 'após 60 s (+1 frame) a nuke recarregou');
});

test('cooldownFrac para HUD: 1 recém-armado → 0 pronto', () => {
  const cd = createWeaponCooldowns();
  assert.equal(cooldownFrac(cd, 'rod'), 0);
  tryConsume(cd, 'rod');
  assert.equal(cooldownFrac(cd, 'rod'), 1);
  tickWeaponCooldowns(cd, 2.5);
  assert.ok(Math.abs(cooldownFrac(cd, 'rod') - 0.5) < 1e-9);
});

test('shaveCooldown (recompensa 5 kills = −10 s na nuclear) e reset (serviço)', () => {
  const cd = createWeaponCooldowns();
  tryConsume(cd, 'nuclear');
  shaveCooldown(cd, 'nuclear', 10);
  assert.equal(cd.nuclear, 50);
  shaveCooldown(cd, 'nuclear', Infinity);
  assert.equal(cd.nuclear, 0, 'shave Infinity zera (pickup raro)');
  tryConsume(cd, 'nuclear');
  tryConsume(cd, 'rod');
  resetWeaponCooldowns(cd);
  assert.deepEqual(cd, { light: 0, heavy: 0, rod: 0, nuclear: 0 });
});

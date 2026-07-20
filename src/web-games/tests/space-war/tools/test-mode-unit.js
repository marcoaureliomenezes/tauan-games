// test-mode-unit.js — Máquina de estados de voo (release space-war-three-states-v1).
// Roda em node puro:
//   node --experimental-default-type=module tests/space-war/tools/test-mode-unit.js
//
// Prova as leis da rearquitetura em 3 estados no código REAL do jogo:
//  1. Raio do sistema planetário = 1.5 × órbita do satélite mais distante
//     (piso 2.5 × raio do planeta — pedido explícito do operador).
//  2. Registro deriva só de planetas do solar/Betelgeuse (luas, sóis, corpos
//     dinâmicos e outros sistemas excluídos).
//  3. Contenção/histerese: entra a 1.0×R_sys, continua a 1.1×, sai a 1.2×.
//  4. Regime ORBIT escala o cruzeiro ao sistema (raio/20, piso 120) e o blend
//     de transição interpola os parâmetros (gradual, sem chicote).

import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../../../space-war/src/state.js';
import {
  planetaryRadiusOf, buildPlanetarySystemsFrom, planetaryAt,
  modeParams, updateMode, couplingBrake, MODE,
} from '../../../space-war/src/mode.js';
import { SHIP } from '../../../space-war/src/config.js';

// Corpo falso duck-typed ({x,y,z} basta — mode.js é THREE-free de propósito).
function fakeBody({ key, name, radius, system = 'solar', moons = [], pos = { x: 0, y: 0, z: 0 }, flags = {}, kind = 'rock' }) {
  return {
    def: { key, name, radius, kind },
    system, moons, worldPos: { ...pos },
    isMoon: !!flags.isMoon, isSun: !!flags.isSun,
    binaryPair: !!flags.binaryPair, dynamic: !!flags.dynamic, ellipse: !!flags.ellipse,
  };
}

test('raio do sistema planetário: 1.5× satélite mais distante, piso 2.5×R', () => {
  // Terra: Lua a 5808 → sistema até 8712 (regra do operador)
  assert.equal(planetaryRadiusOf(2200, [5808]), 8712);
  // Mercúrio (sem luas): piso 2.5×R
  assert.equal(planetaryRadiusOf(836, []), 2090);
  // várias luas: manda a mais distante
  assert.equal(planetaryRadiusOf(6600, [6300, 15532]), 23298);
});

test('registro: só planetas do solar/betelgeuse, nunca luas/sóis/dinâmicos', () => {
  const earth = fakeBody({ key: 'earth', name: 'Terra', radius: 2200, moons: [{ orbit: 5808 }] });
  const moon = fakeBody({ key: 'moon', name: 'Lua', radius: 594, flags: { isMoon: true } });
  const sun = fakeBody({ key: 'sun', name: 'Sol', radius: 11000, flags: { isSun: true } });
  const vag = fakeBody({ key: 'vag1', name: 'Vagante', radius: 2420, system: 'chaotic', flags: { dynamic: true } });
  const siwarha = fakeBody({ key: 'siwarha', name: 'Siwarha', radius: 2200, system: 'betelgeuse', kind: 'star' });
  const cinza = fakeBody({ key: 'cinza', name: 'Cinza', radius: 1300, system: 'betelgeuse', moons: [{ orbit: 3522 }] });
  const systems = buildPlanetarySystemsFrom([earth, moon, sun, vag, siwarha, cinza]);
  assert.deepEqual(systems.map((s) => s.key).sort(), ['cinza', 'earth']);
  assert.equal(systems.find((s) => s.key === 'earth').radius, 8712);
  assert.equal(systems.find((s) => s.key === 'cinza').radius, 5283);   // 1.5×3522
});

test('contenção: dentro do raio acopla, fora não', () => {
  const earth = fakeBody({ key: 'earth', name: 'Terra', radius: 2200, moons: [{ orbit: 5808 }] });
  const systems = buildPlanetarySystemsFrom([earth]);
  assert.equal(planetaryAt({ x: 8000, y: 0, z: 0 }, systems)?.key, 'earth');
  assert.equal(planetaryAt({ x: 9000, y: 0, z: 0 }, systems), null);
});

// Reset da máquina entre testes (o `game` é um singleton real do jogo).
function resetMode() {
  game.mode = 'cruise';
  game.modeBlend = 1;
  game.modeFrom = null;
  game.planetary = null;
  game.planetarySystems = [];
  game.journey = null;
  game._modeInit = false;
  game.ship.pos = { x: 0, y: 0, z: 0 };
}

test('histerese: entra a 1.0×, segue a 1.1×, sai a 1.2× (sem flicker)', () => {
  resetMode();
  const earth = fakeBody({ key: 'earth', name: 'Terra', radius: 2200, moons: [{ orbit: 5808 }] });
  game.planetarySystems = buildPlanetarySystemsFrom([earth]);
  const R = 8712;

  game.ship.pos = { x: R * 0.5, y: 0, z: 0 };
  updateMode(0.016);                       // boot silencioso
  assert.equal(game.mode, MODE.ORBIT);
  assert.equal(game.planetary.key, 'earth');

  game.ship.pos = { x: R * 1.10, y: 0, z: 0 };
  updateMode(0.016);
  assert.equal(game.mode, MODE.ORBIT, '1.1× ainda dentro (histerese)');

  game.ship.pos = { x: R * 1.20, y: 0, z: 0 };
  updateMode(0.016);
  assert.equal(game.mode, MODE.CRUISE, '1.2× desacopla');
  assert.equal(game.planetary, null);
  assert.ok(game.modeBlend < 1, 'transição inicia o blend');

  game.ship.pos = { x: R * 0.9, y: 0, z: 0 };
  updateMode(0.016);
  assert.equal(game.mode, MODE.ORBIT, 're-acopla ao cruzar a borda para dentro');
});

test('journey domina a máquina enquanto a queima está ativa', () => {
  resetMode();
  game.planetarySystems = [];
  game.ship.pos = { x: 0, y: 0, z: 0 };
  updateMode(0.016);
  game.journey = { active: true };
  updateMode(0.016);
  assert.equal(game.mode, MODE.JOURNEY);
  game.journey.active = false;
  updateMode(0.016);
  assert.equal(game.mode, MODE.CRUISE);
});

test('regime ORBIT escala o cruzeiro ao sistema; CRUISE é o clássico', () => {
  resetMode();
  game.mode = MODE.ORBIT;
  game.planetary = { key: 'earth', name: 'Terra', radius: 11930, body: null };
  const p = modeParams();
  assert.ok(Math.abs(p.cruiseSpeed - 11930 / 90) < 1e-9, 'cruise = raio/90 (fase ~1-1:30 min)');
  assert.ok(p.camZ < 24, 'câmera orbital mais próxima');

  game.mode = MODE.CRUISE; game.planetary = null;
  assert.equal(modeParams().cruiseSpeed, SHIP.cruiseSpeed);
});

test('blend de transição: interpola do regime anterior ao novo (gradual)', () => {
  resetMode();
  game.mode = MODE.ORBIT;
  game.planetary = { key: 'earth', name: 'Terra', radius: 11930, body: null };
  game.modeFrom = { cruiseSpeed: SHIP.cruiseSpeed, camX: 0, camY: 6.5, camZ: 24 };
  game.modeBlend = 0;
  assert.equal(modeParams().cruiseSpeed, SHIP.cruiseSpeed, 'blend 0 = regime anterior');
  game.modeBlend = 1;
  assert.ok(Math.abs(modeParams().cruiseSpeed - 11930 / 90) < 1e-9, 'blend 1 = regime orbital');
  game.modeBlend = 0.5;
  const mid = modeParams().cruiseSpeed;
  assert.ok(mid < SHIP.cruiseSpeed && mid > 11930 / 90, 'meio do blend entre os dois regimes');
});

test('freio de acoplamento: freia a velocidade RELATIVA ao planeta até o teto', () => {
  const out = { x: 0, y: 0, z: 0 };
  // abaixo do teto: não freia
  assert.equal(couplingBrake({ x: 100, y: 0, z: 0 }, null, 100, 500, 0.016, out), false);
  // acima do teto: freia exponencialmente, convergindo ao teto (nunca abaixo)
  let vel = { x: 20000, y: 0, z: 0 };
  let bodyVel = { x: 0, y: 300, z: 0 };
  for (let i = 0; i < 60 * 5; i++) {   // 5s a 60fps
    const rel = Math.hypot(vel.x - bodyVel.x, vel.y - bodyVel.y, vel.z - bodyVel.z);
    couplingBrake(vel, bodyVel, rel, 500, 1 / 60, out);
    vel = { ...out };
  }
  const relEnd = Math.hypot(vel.x - bodyVel.x, vel.y - bodyVel.y, vel.z - bodyVel.z);
  assert.ok(relEnd <= 501, `convergiu ao teto (rel=${relEnd.toFixed(1)})`);
  // a DIREÇÃO da velocidade relativa é preservada (freio radial, sem torque)
  const ratio = (vel.x - bodyVel.x) / (vel.y - bodyVel.y);
  assert.ok(Math.abs(ratio - 20000 / -300) < 1, 'direção relativa preservada');
});

test('freio de acoplamento: passo único é GRADUAL (sem chicote)', () => {
  const out = { x: 0, y: 0, z: 0 };
  couplingBrake({ x: 10000, y: 0, z: 0 }, null, 10000, 500, 1 / 60, out);
  const drop = 10000 - out.x;
  assert.ok(out.x < 10000 && out.x > 9000, `um frame freia ~3% (drop=${drop.toFixed(0)})`);
});

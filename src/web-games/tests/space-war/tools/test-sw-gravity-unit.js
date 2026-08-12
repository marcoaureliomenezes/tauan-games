// test-sw-gravity-unit.js — Gravidade real do jogo (src/gravity.js) em node puro:
//   node --experimental-default-type=module tests/space-war/tools/test-sw-gravity-unit.js
//
// gravity.js importa LIMPO (só THREE + config.js + state.js + celestial/physics.js —
// nenhum toca scene.js) — computeGravity() é exercitado diretamente com corpos
// duck-typed em game.bodies, mesmo padrão de test-mode-unit.js#fakeBody.
//
// T-02 (demotion-map anexo §3): rebaixa 2 casos E2E do smoke/physics.spec.js
// que só chamavam computeGravity indiretamente via browser real:
//   1. AC-04b (smoke.spec.js): zona de não-retorno do Sol — mag > empuxo
//      máximo, noReturn liga, o Sol domina.
//   2. AC-05b (physics.spec.js): poço de Higgs — perturbação ADITIVA que sobe
//      o campo de verdade e expira quando game.time ultrapassa `until`
//      (o mesmo corte de linha que computeGravity aplica em produção).

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.min.js';
import { computeGravity } from '../../../space-war/src/gravity.js';
import { game } from '../../../space-war/src/state.js';
import { SUN } from '../../../space-war/src/config.js';

// Corpo falso duck-typed no formato que gravity.js consome de game.bodies
// (mesmo contrato de celestial/body.js#CelestialBody, sem precisar do visual).
function fakeSol() {
  return {
    def: { name: SUN.name, key: SUN.key, radius: SUN.radius, kind: 'star' },
    worldPos: new THREE.Vector3(0, 0, 0),
    mu: SUN.mu,
    soi: SUN.soi,
    system: 'solar',
    binaryPair: false,
  };
}

function resetGame() {
  game.bodies.length = 0;
  game.wells.length = 0;
  game.time = 0;
}

test('zona de não-retorno do Sol: computeGravity a r=600 satura o campo (mag>46, noReturn, dominante Sol)', () => {
  resetGame();
  game.bodies.push(fakeSol());
  const pos = new THREE.Vector3(600, 0, 0);   // mesmo teleporte do antigo smoke.spec.js AC-04b
  const out = new THREE.Vector3();
  const r = computeGravity(pos, out);
  assert.ok(r.gravMag > 46, `gravMag ${r.gravMag} deveria exceder o empuxo máximo (46)`);
  assert.equal(r.noReturn, true, 'dentro da zona de não-retorno, a fuga deve ser impossível');
  assert.equal(r.dominant.def.name, 'Sol', 'o Sol deve dominar o campo tão perto da superfície');
});

test('poço de Higgs: perturbação aditiva sobe o campo de verdade e expira quando game.time > until', () => {
  resetGame();
  game.bodies.push(fakeSol());
  // ponto de amostra longe o bastante do Sol p/ a gravidade base ser pequena
  // (mas ainda dentro da SOI, senão dominant vira null e o poço nunca é lido —
  // computeGravity só processa game.wells DEPOIS de resolver um dominante).
  const pos = new THREE.Vector3(200_000, 0, 0);
  const outBase = new THREE.Vector3();
  const base = computeGravity(pos, outBase);

  // poço nasce OFFSET do ponto de amostra (evita normalizar vetor nulo);
  // soft=1000 clampa a distância efetiva, então o offset pequeno não importa —
  // mesmo padrão de higgs.js#activateHiggs: {pos, mu, until, soft}.
  const wellPos = pos.clone().add(new THREE.Vector3(0, 300, 0));
  game.wells.push({ pos: wellPos, mu: 5e11, until: game.time + 8, soft: 1000 });   // μ≥1e11 ("very large pull")
  const outWell = new THREE.Vector3();
  const withWell = computeGravity(pos, outWell);

  // isola a contribuição do poço por subtração vetorial (mesmo corpo dominante,
  // mesma posição nas duas chamadas — a diferença é só o poço).
  const delta = outWell.clone().sub(outBase);
  assert.ok(delta.length() > 500, `o poço devia empurrar >500 u/s² (mediu ${delta.length().toFixed(1)})`);
  assert.ok(withWell.gravMag > base.gravMag, 'o campo total deve subir com o poço ativo');

  // expira ~8s (HIGGS_PULL_S do jogo, higgs.js): passado o `until`, computeGravity
  // PARA de contar o poço (o `continue` do laço de wells) — a mesma lei de
  // produção ("poços expirados saem da lista global (computeGravity só lê)").
  game.time = 9;
  const outAfter = new THREE.Vector3();
  const after = computeGravity(pos, outAfter);
  const deltaAfter = outAfter.clone().sub(outBase);
  assert.ok(deltaAfter.length() < 1, `poço expirado não deveria mais contribuir (mediu ${deltaAfter.length().toFixed(3)})`);
});

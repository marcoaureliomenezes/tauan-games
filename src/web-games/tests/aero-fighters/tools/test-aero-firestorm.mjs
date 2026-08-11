// test-aero-firestorm.mjs — Validador Node do firestorm pós-nuke (T-N-02/T-N-03,
// release v0.3.10 — SPEC §A).
//
// firestorm.js é Node-safe (sem scene.js/targets.js — hooks injetados, padrão
// city-war.js), então o ciclo REAL de produção é dirigido diretamente aqui:
//   (a) curvas puras: firestormPhaseAt (fire 60 s → smoke +120 s → charred) e
//       firestormCharAt (0→1 monotônico, preto total ao fim das chamas);
//   (b) ignição: só dentro de NUKE_FIRESTORM.RADIUS (260 m = 2× fireball),
//       cap MAX_EMITTERS priorizando os mais próximos do epicentro, cobrindo
//       árvores + estruturas + game.targets;
//   (c) dano de fogo: letal em leves (fTroops), pesado (0.8×hp) em blindados;
//   (d) carbonização: progressiva durante o fogo, preto total a partir de 60 s
//       e PERMANENTE após o fim do ciclo — InstancedMesh via setColorAt e
//       Groups via clone de material compartilhado (o material original do
//       cache NUNCA é tocado);
//   (e) fases: chamas durante FIRE_S, fumaça durante SMOKE_S, emissor removido
//       ao virar 'charred'.
//
// Roda com: node --experimental-default-type=module tests/aero-fighters/tools/test-aero-firestorm.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../../../vendor/three.module.min.js';
import { NUKE_FIRESTORM } from '../../../aero-fighters/src/config.js';
import { game } from '../../../aero-fighters/src/state.js';
import { inhaumaTrees, getInhaumaStructures } from '../../../aero-fighters/src/maps/inhauma-scene.js';
import {
  spawnFirestorm, updateFirestorm, clearFirestorm, setFirestormHooks,
  firestormDebug, firestormPhaseAt, firestormCharAt,
} from '../../../aero-fighters/src/firestorm.js';

// InstancedMesh real (geometria mínima) — getColorAt/setColorAt funcionam de
// verdade, sem stubs frágeis.
function fakeInstanced(color = 0x3a7a2a) {
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 1);
  m.setColorAt(0, new THREE.Color(color));
  return m;
}
const instanceColorOf = (m) => { const c = new THREE.Color(); m.getColorAt(0, c); return c; };

const damages = [];
setFirestormHooks({
  addMesh: () => {},
  damageTarget: (t, amt) => { damages.push({ type: t.type, amt }); t.hp -= amt; if (t.hp <= 0) t.dead = true; },
});
game.activeMap = 'inhauma'; // CONTRATO: writer de teste externo (processo isolado)

function makeTarget(type, x, z, hp) {
  const shared = new THREE.MeshLambertMaterial({ color: 0x55603c });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared)); // 2 meshes, 1 material
  g.position.set(x, 5, z);
  const t = { type, mesh: g, hp, dead: false };
  game.targets.push(t);
  return { t, shared };
}

// Devolve fixtures e os remove das coleções globais ao fim de cada teste.
function seedFixtures() {
  const crown = fakeInstanced(0x2e6b1e), trunk = fakeInstanced(0xffffff);
  const city = fakeInstanced(0xc8b89a);
  const treeNear = { x: 50, y: 10, z: 0, crown, trunk, ci: 0 };
  const treeFar = { x: 300, y: 10, z: 0, crown: fakeInstanced(), ci: 0 }; // fora do raio
  inhaumaTrees.push(treeNear, treeFar);
  const structures = getInhaumaStructures();
  const structCity = { id: 'test-predio', x: -60, z: 30, halfX: 6, halfZ: 5, topY: 12, block: { charRefs: [{ mesh: city, index: 0 }] } };
  const charRoot = new THREE.Group();
  const rootMat = new THREE.MeshLambertMaterial({ color: 0x8a3b2a });
  charRoot.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), rootMat));
  const structGroup = { id: 'test-chamine', x: 20, z: -80, halfX: 3, halfZ: 3, topY: 30, charRoot };
  structures.push(structCity, structGroup);
  const light = makeTarget('fTroops', 10, 10, 5);
  const armor = makeTarget('fTank', -30, -40, 40);
  return {
    crown, trunk, city, treeNear, treeFar, structCity, structGroup, charRoot, rootMat,
    light, armor,
    cleanup() {
      for (const k of ['crown', 'trunk', 'city']) this[k].dispose?.();
      inhaumaTrees.length -= 2;
      structures.length -= 2;
      game.targets.length -= 2;
      clearFirestorm();
      damages.length = 0;
    },
  };
}

test('(a) curvas puras: fases fire 60s → smoke +120s → charred e char 0→1 monotônico', () => {
  assert.equal(firestormPhaseAt(0), 'fire');
  assert.equal(firestormPhaseAt(59.9), 'fire');
  assert.equal(firestormPhaseAt(60), 'smoke');
  assert.equal(firestormPhaseAt(179.9), 'smoke');
  assert.equal(firestormPhaseAt(180), 'charred');
  assert.equal(firestormPhaseAt(600), 'charred');
  assert.equal(firestormCharAt(0), 0);
  assert.equal(firestormCharAt(60), 1);
  assert.equal(firestormCharAt(120), 1);
  let prev = -Infinity;
  for (let t = 0; t <= 60; t += 1) {
    const k = firestormCharAt(t);
    assert.ok(k >= prev - 1e-9, `firestormCharAt regrediu em t=${t}`);
    prev = k;
  }
});

test('(b) ignição cobre árvore+estruturas+alvos dentro de 260 m e ignora o que está fora', () => {
  const fx = seedFixtures();
  try {
    spawnFirestorm({ x: 0, y: 0, z: 0 });
    const kinds = firestormDebug().emitters.map((e) => e.kind).sort();
    assert.deepEqual(kinds, ['structure', 'structure', 'target', 'target', 'tree']);
    assert.ok(!firestormDebug().emitters.some((e) => e.ref === fx.treeFar),
      'árvore a 300 m (fora de RADIUS=260) não pode incendiar');
  } finally { fx.cleanup(); }
});

test('(b) cap MAX_EMITTERS prioriza os mais próximos do epicentro', () => {
  const extra = NUKE_FIRESTORM.MAX_EMITTERS + 40;
  for (let i = 0; i < extra; i++) {
    // distâncias crescentes: 1 m, 2 m, ... — todos dentro do raio
    inhaumaTrees.push({ x: i + 1, y: 0, z: 0, crown: fakeInstanced(), ci: 0 });
  }
  try {
    spawnFirestorm({ x: 0, y: 0, z: 0 });
    const ems = firestormDebug().emitters;
    assert.equal(ems.length, NUKE_FIRESTORM.MAX_EMITTERS);
    const maxD2 = Math.max(...ems.map((e) => e.d2));
    assert.ok(maxD2 <= (NUKE_FIRESTORM.MAX_EMITTERS) ** 2 + 1,
      `foco mais distante (${Math.sqrt(maxD2)} m) deveria estar entre os ${NUKE_FIRESTORM.MAX_EMITTERS} mais próximos`);
  } finally {
    inhaumaTrees.length -= extra;
    clearFirestorm();
  }
});

test('(c) dano de fogo: letal em infantaria/leve, pesado (0.8×hp) em blindado', () => {
  const fx = seedFixtures();
  try {
    spawnFirestorm({ x: 0, y: 0, z: 0 });
    const dLight = damages.find((d) => d.type === 'fTroops');
    const dArmor = damages.find((d) => d.type === 'fTank');
    assert.ok(dLight.amt >= 5, `infantaria deveria tomar dano letal, tomou ${dLight.amt}`);
    assert.ok(fx.light.t.dead, 'infantaria deveria morrer queimada na ignição');
    assert.equal(dArmor.amt, 40 * 0.8, 'blindado toma dano pesado (0.8×hp), não letal');
    assert.ok(!fx.armor.t.dead, 'blindado sobrevive à ignição (wreck carboniza depois)');
  } finally { fx.cleanup(); }
});

test('(d)+(e) ciclo completo: char progressivo → preto em 60 s → fumaça até 180 s → preto permanente', () => {
  const fx = seedFixtures();
  try {
    spawnFirestorm({ x: 0, y: 0, z: 0 });
    const origCrown = new THREE.Color(0x2e6b1e);
    const origCity = new THREE.Color(0xc8b89a);
    const dt = 0.5;

    // ── fase FOGO (0→60 s): carbonização progressiva, chamas ativas ──
    step(30, dt);
    const mid = instanceColorOf(fx.crown);
    assert.ok(mid.r < origCrown.r && mid.g < origCrown.g, 'coroa deveria ter escurecido aos 30 s');
    assert.ok(mid.g > 0.05, 'aos 30 s (metade do fogo) a coroa ainda não está preta');
    assert.ok(firestormDebug().flames > 0, 'fase de fogo deve emitir chamas');
    // material do Group foi CLONADO — o original compartilhado está intacto
    const clonedMat = fx.charRoot.children[0].material;
    assert.notEqual(clonedMat, fx.rootMat, 'material do Group deve ser clonado antes de escurecer');
    assert.equal(fx.rootMat.color.getHex(), 0x8a3b2a, 'material original do cache nunca é tocado');
    assert.equal(fx.charRoot.children[0].material, fx.charRoot.children[0].material);
    assert.equal(
      fx.light.t.mesh.children[0].material, fx.light.t.mesh.children[1].material,
      'meshes que compartilhavam material seguem compartilhando (1 clone por material)',
    );
    assert.notEqual(fx.light.t.mesh.children[0].material, fx.light.shared);

    // ── fim das chamas (60 s): preto total ──
    step(31, dt); // t ≈ 61
    const black = new THREE.Color(0x000000);
    for (const [name, c] of [['crown', instanceColorOf(fx.crown)], ['city', instanceColorOf(fx.city)]]) {
      assert.ok(Math.abs(c.r) < 1e-3 && Math.abs(c.g) < 1e-3 && Math.abs(c.b) < 1e-3,
        `${name} deveria estar preto total após as chamas, está #${c.getHexString()}`);
    }
    assert.ok(clonedMat.color.r < 1e-3 && clonedMat.color.g < 1e-3 && clonedMat.color.b < 1e-3,
      'Group clonado deveria estar preto total após as chamas');

    // ── fase FUMAÇA (60→180 s): sem chamas novas, fumaça aparece ──
    step(20, dt); // t ≈ 81 — deixa as chamas remanescentes expirarem
    assert.equal(firestormDebug().flames, 0, 'não pode nascer chama nova na fase de fumaça');
    assert.ok(firestormDebug().smokes > 0, 'fase de fumaça deve emitir fumaça');
    assert.ok(firestormDebug().emitters.length > 0, 'emissores seguem vivos na fase de fumaça');

    // ── CHARRED (≥180 s): emissores encerrados, preto permanente ──
    step(100, dt); // t ≈ 181
    assert.equal(firestormDebug().emitters.length, 0, 'emissores devem encerrar ao virar charred');
    step(30, dt); // tempo extra: nada mais acontece
    const after = instanceColorOf(fx.crown);
    assert.ok(after.equals(black), 'carbonização é permanente (preto para sempre)');
    assert.ok(instanceColorOf(fx.city).equals(black));
    assert.ok(clonedMat.color.r < 1e-3, 'wreck do alvo permanece carbonizado');
  } finally { fx.cleanup(); }
});

test('guarda de mapa: fora de Inhaúma nada incendeia', () => {
  game.activeMap = 'desert';
  try {
    spawnFirestorm({ x: 0, y: 0, z: 0 });
    assert.equal(firestormDebug().emitters.length, 0);
  } finally {
    game.activeMap = 'inhauma';
    clearFirestorm();
  }
});

function step(seconds, dt) {
  for (let t = 0; t < seconds - 1e-9; t += dt) updateFirestorm(dt);
}

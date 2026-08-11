// test-aero-visual.mjs — Validador Node do redesign visual (T-C-12/T-C-13,
// release v0.3.4 — ver SPEC.md §E).
//
// Prova:
//   (a) cada tipo de unidade de formação constrói ≥5 partes nomeadas com materiais
//       nomeados nos DOIS caminhos de render (makeUnit Group + makeUnitInstanced
//       merged), com vertex colors no merge;
//   (b) tri count da geometria mesclada por tipo ≤ 900 (budget do redesenho);
//   (c) bounding box de cada unidade dentro de ±25% das dimensões de REFERÊNCIA
//       pré-redesign (footprint preservado — espaçamento de formação, hr2 de
//       colisão e caixas de mira dependem delas);
//   (d) wingmen: de um início disperso, convergem para os slots de formação
//       (|pos - slot| < 5 m em 3 s, sem NaN); quebram formação quando um hostil
//       aéreo entra no raio do player e retornam quando ele morre.
//
// Dimensões de referência PRÉ-redesign (medidas com mergeUnitGeometry no
// units.js de HEAD antes da Onda 5 — script de medição: bbox do merge):
//   tank 4.10x2.30x6.60 · apc 3.20x2.75x6.09 · truck 2.65x2.70x6.40
//   troops 1.73x1.32x3.70 · artillery 5.60x4.01x8.60 · sam 2.60x3.28x5.32
//   aaGun 2.80x2.48x3.38 · helicopter 9.50x2.92x11.80 · zeppelin 8.40x8.40x21.65
//
// Roda com: node --experimental-default-type=module tests/aero-fighters/tools/test-aero-visual.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../../../vendor/three.module.min.js';
import { UNIT_TYPES, buildUnitParts, makeUnit, makeUnitInstanced, mergeUnitGeometry } from '../../../aero-fighters/src/formations/units.js';
import { game } from '../../../aero-fighters/src/state.js';
import { spawnWingmen, updateWingmen, wingmanSlotWorld, wingmenList } from '../../../aero-fighters/src/wingmen.js';
import { WINGMEN } from '../../../aero-fighters/src/config.js';

// Tabela de referência PRÉ-redesign (x, y, z — ver header). Tolerância ±25%.
const REF_DIMS = {
  tank: [4.10, 2.30, 6.60],
  apc: [3.20, 2.75, 6.09],
  truck: [2.65, 2.70, 6.40],
  troops: [1.73, 1.32, 3.70],
  artillery: [5.60, 4.01, 8.60],
  sam: [2.60, 3.28, 5.32],
  aaGun: [2.80, 2.48, 3.38],
  helicopter: [9.50, 2.92, 11.80],
  zeppelin: [8.40, 8.40, 21.65],
};
const TRI_BUDGET = 900;
const DIM_TOL = 0.25;

test('T-C-12(a): cada unidade tem ≥5 partes nomeadas com materiais nos dois caminhos', () => {
  for (const unit of UNIT_TYPES) {
    const parts = buildUnitParts(unit);
    assert.ok(parts.length >= 5, `${unit}: poucas partes (${parts.length})`);
    const names = new Set();
    for (const p of parts) {
      assert.ok(p.n && typeof p.n === 'string', `${unit}: parte sem nome`);
      assert.ok(!names.has(p.n), `${unit}: parte duplicada '${p.n}'`);
      names.add(p.n);
      assert.ok(p.m && typeof p.m === 'string', `${unit}.${p.n}: sem material nomeado`);
      assert.ok(['box', 'cyl', 'sph'].includes(p.g), `${unit}.${p.n}: geometria desconhecida '${p.g}'`);
    }
    // Caminho Group
    const group = makeUnit(unit);
    assert.ok(group.children.length >= 5, `${unit}: Group com poucas partes`);
    for (const mesh of group.children) {
      assert.ok(mesh.name.startsWith(`${unit}.`), `${unit}: mesh sem nome (${mesh.name})`);
      assert.ok(mesh.material && mesh.material.color, `${unit}: mesh sem material`);
    }
    // Caminho instanciado (merge)
    const batch = makeUnitInstanced(unit, 7);
    assert.ok(batch.mesh.isInstancedMesh && batch.count === 7, `${unit}: caminho instanciado quebrado`);
    assert.ok(batch.geometry.getAttribute('color'), `${unit}: merge sem vertex colors`);
    assert.ok(batch.geometry.getAttribute('position').count > 0, `${unit}: merge vazio`);
  }
});

test('T-C-12(b/c): tri count ≤ 900 e bounding box dentro de ±25% da referência', () => {
  for (const unit of UNIT_TYPES) {
    const geo = mergeUnitGeometry(unit);
    const tris = geo.getAttribute('position').count / 3;
    assert.ok(tris <= TRI_BUDGET, `${unit}: ${tris} tris > budget ${TRI_BUDGET}`);
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const dims = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
    const ref = REF_DIMS[unit];
    for (let i = 0; i < 3; i++) {
      const lo = ref[i] * (1 - DIM_TOL), hi = ref[i] * (1 + DIM_TOL);
      assert.ok(dims[i] >= lo && dims[i] <= hi,
        `${unit}: dim[${'xyz'[i]}]=${dims[i].toFixed(2)} fora de [${lo.toFixed(2)}, ${hi.toFixed(2)}] (ref ${ref[i]})`);
    }
    // Unidades de chão não afundam a origem (snap de altura pisa no y=0 do grupo).
    if (!['helicopter', 'zeppelin'].includes(unit)) {
      assert.ok(bb.min.y >= -0.05, `${unit}: minY=${bb.min.y.toFixed(2)} abaixo do solo`);
    }
  }
});

// ─── T-C-13: formação dos wingmen ─────────────────────────────────────────────
const _slot = new THREE.Vector3();

function setupSim() {
  game.targets.length = 0;
  game.allyEnemies.length = 0;
  game.wingmen.length = 0;
  game.time = 0;
  game.player.speed = 0;
  game.missionRealism.sortie.state = 'AIRBORNE';
  const scene = new THREE.Group();
  const jet = new THREE.Group();
  jet.position.set(0, 100, 0);
  jet.rotation.y = 0.6; // heading fora do eixo — prova a rotação do slot
  scene.add(jet);
  spawnWingmen(scene, jet);
  return { scene, jet };
}

test('T-C-13(d): wingmen convergem para os slots de formação em 3 s, sem NaN', () => {
  const { jet } = setupSim();
  // Início disperso: cada wingman a ~250-400 m do slot, alturas diferentes.
  wingmenList[0].mesh.position.set(280, 160, -220);
  wingmenList[1].mesh.position.set(-320, 60, 180);
  wingmenList[0]._vel.set(0, 0, 0);
  wingmenList[1]._vel.set(0, 0, 0);
  const dt = 1 / 60;
  for (let i = 0; i < 180; i++) updateWingmen(dt, jet);
  for (const wm of wingmenList) {
    const { x, y, z } = wm.mesh.position;
    assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z), `wingman ${wm.offsetIdx}: NaN`);
    wingmanSlotWorld(jet, wm.offsetIdx, _slot);
    const err = wm.mesh.position.distanceTo(_slot);
    assert.ok(err < 5, `wingman ${wm.offsetIdx}: erro ${err.toFixed(2)} m >= 5 m após 3 s`);
  }
});

test('T-C-13(d): wingman quebra formação p/ hostil aéreo perto do player e retorna após o kill', () => {
  const { jet } = setupSim();
  for (let i = 0; i < 120; i++) updateWingmen(1 / 60, jet);
  // Hostil aéreo (helicóptero de formação) a 200 m do player — dentro de ENGAGE_RADIUS.
  const hostile = {
    type: 'fHelicopter', dead: false, hp: 10, airborneAltitude: 46,
    mesh: new THREE.Group(),
  };
  hostile.mesh.position.set(200, 120, 0);
  game.targets.push(hostile);
  for (let i = 0; i < 120; i++) updateWingmen(1 / 60, jet); // 2 s de engajamento
  for (const wm of wingmenList) {
    assert.equal(wm.attackTarget, hostile, `wingman ${wm.offsetIdx} não engajou o hostil`);
    wingmanSlotWorld(jet, wm.offsetIdx, _slot);
    const err = wm.mesh.position.distanceTo(_slot);
    assert.ok(err > 10, `wingman ${wm.offsetIdx} não saiu da formação (erro ${err.toFixed(1)} m)`);
  }
  // Hostil destruído — wingmen voltam à formação.
  hostile.dead = true;
  for (let i = 0; i < 360; i++) updateWingmen(1 / 60, jet);
  for (const wm of wingmenList) {
    assert.equal(wm.attackTarget, null, `wingman ${wm.offsetIdx} não desengajou`);
    wingmanSlotWorld(jet, wm.offsetIdx, _slot);
    const err = wm.mesh.position.distanceTo(_slot);
    assert.ok(err < 5, `wingman ${wm.offsetIdx}: erro ${err.toFixed(2)} m >= 5 m no retorno`);
  }
});

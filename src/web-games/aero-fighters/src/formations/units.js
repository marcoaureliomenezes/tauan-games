// formations/units.js — builders reutilizáveis de unidades militares (mesh + stats)
// da campanha Inhaúma (T-C-01, release v0.3.4).
// Exporta: UNIT_TYPES, unitTargetType, unitStats, buildUnitParts, makeUnit,
//   makeUnitInstanced. Node-safe (sem DOM/scene); rng sempre injetado (sem Math.random).
// Para adicionar unidade nova: builder em PART_BUILDERS + entrada em TARGET_STATS (config.js).
// Para RESTILIZAR uma unidade (Onda 5): edite só o builder dela — partes agrupadas,
// nomeadas e com materiais nomeados (MAT_DEFS), sem cores aleatórias.
// T-C-12 (Onda 5): redesign visual — silhuetas mais ricas (glacis inclinado, freio
// de boca, saias de esteira, boom afunilado, janelas de gôndola, capacetes/mochas)
// e marcações de unidade via partes 'accent' (cáqui) — footprints preservados
// (±20% das dimensões de referência medidas no test-aero-visual.mjs).

import * as THREE from '../../../vendor/three.module.min.js';
import { TARGET_STATS } from '../config.js';

export const UNIT_TYPES = ['tank', 'apc', 'truck', 'troops', 'artillery', 'sam', 'aaGun', 'helicopter', 'zeppelin'];

/** Tipo usado no barramento de dano (game.targets) — prefixo `f` evita colisão com os
 *  tipos legados de targets.js (tank/helicopter/aaGun já existem lá). */
export const unitTargetType = (unit) => 'f' + unit[0].toUpperCase() + unit.slice(1);

/** Stats da unidade (hp/score/range/speed/fire) — fonte única em config.TARGET_STATS. */
export function unitStats(unit) {
  const stats = TARGET_STATS[unitTargetType(unit)];
  if (!stats) throw new Error(`units.js: tipo desconhecido '${unit}'`);
  return stats;
}

// ─── Materiais nomeados (paleta fixa — restyle = trocar aqui ou no builder) ───
const MAT_DEFS = {
  hull:   0x4b5133, // blindagem verde-oliva
  armor:  0x3d4029, // blindagem escura
  dark:   0x161613, // canos/esteiras/rotores
  tire:   0x101010,
  canvas: 0x6f7355, // lona de caminhão de suprimento
  glass:  0x7fd0ff, // cabine/janelas
  glassDark: 0x2a3742, // vidro fumê (canoplas militares, pontes)
  skin:   0x9c8468, // rosto dos soldados
  cloth:  0x55603c, // uniforme
  rail:   0x5c5f62, // trilhos do lançador SAM
  blimp:  0x9a9f88, // envelope do zepelim
  accent: 0x8f8a5e, // cáqui — marcações de unidade / detalhes (T-C-12)
};
const _mats = new Map();
function mat(name) {
  if (!_mats.has(name)) _mats.set(name, new THREE.MeshLambertMaterial({ color: MAT_DEFS[name] }));
  return _mats.get(name);
}

// ─── Descritores de parte (puros — sem THREE) ─────────────────────────────────
// part(nome, material, geometria, args, pos[x,y,z], rot[x,y,z], scale[x,y,z])
const part = (n, m, g, a, p, r = null, s = null) => ({ n, m, g, a, p, r, s });
const box = (n, m, w, h, d, p, r, s) => part(n, m, 'box', [w, h, d], p, r, s);
const cyl = (n, m, rTop, rBot, h, seg, p, r, s) => part(n, m, 'cyl', [rTop, rBot, h, seg], p, r, s);
const sph = (n, m, radius, w, h, p, r, s) => part(n, m, 'sph', [radius, w, h], p, r, s);
const RX90 = [Math.PI / 2, 0, 0];   // cilindro (eixo Y) deitado para frente (Z)
const RZ90 = [0, 0, Math.PI / 2];   // cilindro deitado para o lado (X) — rodas

/** Par de rodas laterais (eixo X) em posições z — usado por apc/truck. */
function wheelSet(prefix, xHalf, zs, r, w) {
  const out = [];
  for (const x of [-xHalf, xHalf]) for (const z of zs) {
    out.push(cyl(`${prefix}${x < 0 ? 'L' : 'R'}${z}`, 'tire', r, r, w, 8, [x, r, z], RZ90));
  }
  return out;
}

/** Marcações laterais de unidade (T-C-12) — faixas cáqui finas coladas no casco. */
function sideMarks(xHalf, y, z, h = 0.4, d = 1.0) {
  return [
    box('markL', 'accent', 0.02, h, d, [-xHalf, y, z]),
    box('markR', 'accent', 0.02, h, d, [xHalf, y, z]),
  ];
}

function tankParts() {
  return [
    box('trackL', 'dark', 0.7, 0.9, 5.4, [-1.7, 0.55, 0]),
    box('trackR', 'dark', 0.7, 0.9, 5.4, [1.7, 0.55, 0]),
    box('skirtL', 'armor', 0.78, 0.32, 5.2, [-1.7, 1.12, 0]), // saia sobre a esteira
    box('skirtR', 'armor', 0.78, 0.32, 5.2, [1.7, 1.12, 0]),
    box('hull', 'hull', 3.2, 0.75, 4.7, [0, 1.05, 0]),
    box('glacis', 'hull', 3.2, 0.7, 1.5, [0, 1.02, -2.55], [0.42, 0, 0]), // chapéu inclinado
    box('rearDeck', 'armor', 3.2, 0.35, 1.0, [0, 1.32, 2.1]), // convés do motor
    cyl('turret', 'armor', 0.95, 1.35, 0.8, 8, [0, 1.8, 0.3]), // torre cônica
    box('turretFace', 'armor', 1.5, 0.6, 0.9, [0, 1.8, -0.75]), // face angular
    box('turretBasket', 'dark', 1.3, 0.5, 0.8, [0, 1.75, 1.35]), // cesto traseiro
    cyl('barrel', 'dark', 0.13, 0.17, 3.5, 8, [0, 1.9, -2.55], RX90),
    cyl('muzzle', 'dark', 0.23, 0.23, 0.55, 8, [0, 1.9, -4.15], RX90), // freio de boca
    cyl('hatch', 'dark', 0.34, 0.34, 0.14, 8, [0.45, 2.25, 0.35]), // escotilha do comandante
    cyl('antenna', 'dark', 0.02, 0.03, 0.7, 4, [-0.7, 2.5, 1.2]),
    ...sideMarks(2.1, 1.35, -0.5),
  ];
}

function apcParts() {
  return [
    box('hull', 'hull', 2.8, 1.1, 5.4, [0, 1.2, 0]),
    box('glacis', 'armor', 2.6, 0.7, 1.2, [0, 1.5, -2.6], [0.4, 0, 0]),
    box('cabin', 'armor', 2.2, 0.8, 2.0, [0, 2.05, -0.6]),
    cyl('turret', 'dark', 0.5, 0.6, 0.5, 8, [0, 2.55, -0.6]),
    cyl('gun', 'dark', 0.07, 0.08, 1.4, 6, [0, 2.6, -1.5], RX90),
    cyl('muzzle', 'dark', 0.11, 0.11, 0.25, 6, [0, 2.6, -2.15], RX90),
    box('skirtL', 'armor', 0.15, 0.55, 4.6, [-1.42, 0.95, 0]),
    box('skirtR', 'armor', 0.15, 0.55, 4.6, [1.42, 0.95, 0]),
    cyl('hatch', 'dark', 0.3, 0.3, 0.1, 8, [0.5, 2.5, 0.6]),
    box('trimVane', 'accent', 2.4, 0.5, 0.08, [0, 1.1, -3.15], [-0.3, 0, 0]), // prancha dianteira
    ...wheelSet('wheel', 1.45, [-1.8, 0, 1.8], 0.45, 0.3),
    ...sideMarks(1.51, 1.6, 1.2, 0.35, 0.8),
  ];
}

function truckParts() {
  return [
    box('chassis', 'dark', 2.0, 0.5, 6.4, [0, 0.75, 0]),
    box('hood', 'hull', 1.9, 0.85, 1.3, [0, 1.35, -2.95]), // capô do motor
    box('cab', 'hull', 2.0, 1.5, 1.6, [0, 1.75, -1.95]),
    box('windshield', 'glass', 1.8, 0.6, 0.08, [0, 2.05, -2.72]),
    box('bumper', 'dark', 2.1, 0.25, 0.2, [0, 0.85, -3.6]),
    box('cargoCanvas', 'canvas', 2.2, 1.7, 3.8, [0, 1.85, 0.95]),
    box('rib0', 'accent', 2.3, 0.12, 0.12, [0, 2.72, -0.3]), // arcos da lona
    box('rib1', 'accent', 2.3, 0.12, 0.12, [0, 2.72, 0.95]),
    box('rib2', 'accent', 2.3, 0.12, 0.12, [0, 2.72, 2.2]),
    cyl('fuelTank', 'dark', 0.3, 0.3, 1.1, 8, [1.05, 0.85, -0.6], RX90),
    ...wheelSet('wheel', 1.15, [-2.3, 0.7, 2.1], 0.5, 0.35),
    ...sideMarks(1.01, 1.7, -1.95, 0.5, 0.5), // porta da cabine
  ];
}

/** Pelotão de ~6 soldados — um lote de partes por squad (vira UMA geometria no merge).
 *  T-C-12: capacete + mochila por soldado (silhueta de infantaria, não "pininhos"). */
function troopsParts() {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const x = (i % 2 === 0 ? -0.6 : 0.6);
    const z = (Math.floor(i / 2) - 1) * 1.4;
    out.push(cyl(`body${i}`, 'cloth', 0.22, 0.28, 0.95, 6, [x, 0.75, z]));
    out.push(sph(`head${i}`, 'skin', 0.17, 6, 5, [x, 1.42, z]));
    out.push(sph(`helmet${i}`, 'armor', 0.19, 6, 3, [x, 1.5, z], null, [1, 0.75, 1]));
    out.push(box(`pack${i}`, 'canvas', 0.3, 0.4, 0.15, [x, 1.0, z + 0.22]));
    out.push(box(`rifle${i}`, 'dark', 0.08, 0.08, 0.9, [x + 0.25, 1.0, z - 0.1]));
  }
  return out;
}

function artilleryParts() {
  return [
    cyl('basePlate', 'dark', 2.4, 2.8, 0.35, 8, [0, 0.18, 0]),
    box('cradle', 'armor', 1.2, 0.8, 1.6, [0, 1.0, 0]),
    cyl('barrel', 'dark', 0.22, 0.3, 6.5, 8, [0, 2.2, -2.4], [-Math.PI / 3, 0, 0]),
    cyl('muzzle', 'dark', 0.34, 0.34, 0.5, 8, [0, 3.68, -4.99], [-Math.PI / 3, 0, 0]), // freio de boca
    cyl('recoil', 'armor', 0.35, 0.35, 1.2, 8, [0, 1.55, -0.9], [-Math.PI / 3, 0, 0]), // recuperador
    box('gunShield', 'armor', 2.2, 1.4, 0.12, [0, 1.6, -0.9], [-0.15, 0, 0]), // escudo do artilheiro
    cyl('wheelL', 'tire', 0.7, 0.7, 0.35, 10, [-1.5, 0.7, 0.6], RZ90),
    cyl('wheelR', 'tire', 0.7, 0.7, 0.35, 10, [1.5, 0.7, 0.6], RZ90),
    box('trailL', 'armor', 0.25, 0.25, 2.6, [-0.9, 0.4, 2.0], [0, 0.3, 0]),
    box('trailR', 'armor', 0.25, 0.25, 2.6, [0.9, 0.4, 2.0], [0, -0.3, 0]),
    box('spadeL', 'dark', 0.5, 0.35, 0.3, [-1.23, 0.2, 3.15], [0, 0.3, 0]), // sapatas das alavancas
    box('spadeR', 'dark', 0.5, 0.35, 0.3, [1.23, 0.2, 3.15], [0, -0.3, 0]),
    box('ammoCrate', 'accent', 0.9, 0.6, 0.6, [1.6, 0.5, 1.8], [0, 0.4, 0]),
  ];
}

function samParts() {
  const rails = [];
  for (const x of [-0.55, 0.55]) for (const y of [1.9, 2.4]) {
    rails.push(cyl(`rail${x < 0 ? 'L' : 'R'}${y}`, 'rail', 0.2, 0.2, 3.4, 8, [x, y, -0.2], [-Math.PI / 3, 0, 0]));
    // Ogiva do míssil na ponta do trilho (mesma inclinação de -60°)
    rails.push(cyl(`nose${x < 0 ? 'L' : 'R'}${y}`, 'accent', 0.02, 0.2, 0.6, 6, [x, y + 1.0, -1.93], [-Math.PI / 3, 0, 0]));
  }
  return [
    box('base', 'hull', 2.6, 0.9, 4.6, [0, 0.85, 0]),
    box('cab', 'armor', 2.0, 0.8, 1.2, [0, 1.55, -1.6]), // cabine de controle
    box('cabGlass', 'glassDark', 1.6, 0.4, 0.08, [0, 1.7, -2.18]),
    ...rails,
    cyl('mast', 'dark', 0.15, 0.2, 2.2, 6, [0, 1.6, 1.8]),
    cyl('radarDish', 'armor', 1.3, 0.15, 0.35, 12, [0, 2.9, 1.8], [0.5, 0, 0]),
    cyl('antenna', 'dark', 0.02, 0.02, 1.2, 4, [1.0, 2.0, 2.1]),
    box('jackL', 'dark', 0.3, 0.3, 0.8, [-1.25, 0.3, 1.5]), // macacos de nivelamento
    box('jackR', 'dark', 0.3, 0.3, 0.8, [1.25, 0.3, 1.5]),
    ...sideMarks(1.31, 1.0, 0.3, 0.35, 0.9),
  ];
}

function aaGunParts() {
  return [
    cyl('base', 'armor', 1.2, 1.4, 0.8, 8, [0, 0.4, 0]),
    box('platform', 'dark', 2.2, 0.18, 2.2, [0, 0.09, 0]),
    box('shield', 'hull', 1.6, 1.0, 0.15, [0, 1.3, 0.3], [-0.2, 0, 0]),
    cyl('barrelL', 'dark', 0.09, 0.09, 2.6, 6, [-0.28, 1.5, -1.0], [-Math.PI / 4, 0, 0]),
    cyl('barrelR', 'dark', 0.09, 0.09, 2.6, 6, [0.28, 1.5, -1.0], [-Math.PI / 4, 0, 0]),
    cyl('muzzleL', 'dark', 0.12, 0.12, 0.3, 6, [-0.28, 2.31, -1.81], [-Math.PI / 4, 0, 0]),
    cyl('muzzleR', 'dark', 0.12, 0.12, 0.3, 6, [0.28, 2.31, -1.81], [-Math.PI / 4, 0, 0]),
    box('seat', 'dark', 0.5, 0.4, 0.5, [0, 0.9, 0.9]),
    box('ammoBox', 'accent', 0.6, 0.5, 0.5, [-0.9, 0.55, 0.7]),
    cyl('wheelL', 'tire', 0.45, 0.45, 0.25, 8, [-1.35, 0.45, 0], RZ90),
    cyl('wheelR', 'tire', 0.45, 0.45, 0.25, 8, [1.35, 0.45, 0], RZ90),
    cyl('sight', 'dark', 0.05, 0.05, 0.4, 4, [0, 1.7, -0.1], RX90), // mira
  ];
}

function helicopterParts() {
  return [
    box('body', 'hull', 3.0, 1.7, 6.2, [0, 1.6, 0]),
    sph('canopy', 'glass', 1.1, 10, 8, [0, 1.7, -3.2], null, [1.2, 0.7, 1.1]), // bolha da cabine
    box('engineDeck', 'armor', 2.2, 0.6, 2.6, [0, 2.6, 0.3]), // dorso do motor
    cyl('exhaustL', 'dark', 0.22, 0.26, 0.9, 6, [-0.9, 2.45, 1.9], [1.2, 0, 0]),
    cyl('exhaustR', 'dark', 0.22, 0.26, 0.9, 6, [0.9, 2.45, 1.9], [1.2, 0, 0]),
    box('tailBoom', 'hull', 0.7, 0.7, 3.0, [0, 1.85, 4.0]), // boom grosso
    box('tailTip', 'hull', 0.4, 0.45, 2.2, [0, 1.95, 6.4]), // afunilamento da cauda
    box('fin', 'dark', 0.2, 1.4, 0.9, [0, 2.5, 7.3]),
    box('stabilizer', 'hull', 1.8, 0.12, 0.6, [0, 2.0, 5.6]), // estabilizador horizontal
    cyl('rotorHub', 'dark', 0.3, 0.35, 0.5, 8, [0, 2.75, 0]),
    box('rotorA', 'dark', 0.28, 0.07, 9.5, [0, 3.0, 0]),
    box('rotorB', 'dark', 0.28, 0.07, 9.5, [0, 3.0, 0], [0, Math.PI / 2, 0]),
    box('tailRotor', 'dark', 0.1, 1.6, 0.15, [0.35, 2.0, 7.5]),
    box('skidL', 'dark', 0.18, 0.15, 4.5, [-1.3, 0.25, 0]),
    box('skidR', 'dark', 0.18, 0.15, 4.5, [1.3, 0.25, 0]),
    box('podL', 'armor', 0.5, 0.5, 1.6, [-1.7, 1.2, -0.8]), // pods de foguetes
    box('podR', 'armor', 0.5, 0.5, 1.6, [1.7, 1.2, -0.8]),
    ...sideMarks(1.51, 1.7, 0.5, 0.4, 1.4),
  ];
}

function zeppelinParts() {
  const fins = [];
  for (let i = 0; i < 4; i++) {
    fins.push(box(`fin${i}`, 'armor', 0.25, 2.6, 1.6, [0, 4.5, 10.2], [0, 0, (i * Math.PI) / 2]));
  }
  const windows = [];
  for (let i = 0; i < 3; i++) {
    windows.push(box(`winL${i}`, 'glass', 0.06, 0.35, 0.5, [-1.01, 1.05, -1.0 + i * 1.0]));
    windows.push(box(`winR${i}`, 'glass', 0.06, 0.35, 0.5, [1.01, 1.05, -1.0 + i * 1.0]));
  }
  return [
    sph('envelope', 'blimp', 4.2, 14, 10, [0, 4.5, 0], null, [1, 1, 2.6]),
    sph('noseCap', 'accent', 1.2, 8, 6, [0, 4.5, -10.6]), // cone de proa
    box('stripe', 'accent', 0.1, 0.5, 8.0, [0, 8.55, -2]), // faixa de espinhaço
    box('gondola', 'armor', 2.0, 1.1, 3.6, [0, 1.0, 0]),
    box('bridge', 'glassDark', 1.6, 0.5, 0.8, [0, 1.2, -2.0]), // ponte de comando
    ...windows,
    ...fins,
    box('podL', 'dark', 0.6, 0.6, 1.4, [-2.2, 1.6, 1.8]), // naceles dos motores
    box('podR', 'dark', 0.6, 0.6, 1.4, [2.2, 1.6, 1.8]),
    box('propL', 'dark', 0.08, 1.2, 0.12, [-2.2, 1.6, 2.55]),
    box('propR', 'dark', 0.08, 1.2, 0.12, [2.2, 1.6, 2.55]),
  ];
}

const PART_BUILDERS = {
  tank: tankParts, apc: apcParts, truck: truckParts, troops: troopsParts,
  artillery: artilleryParts, sam: samParts, aaGun: aaGunParts,
  helicopter: helicopterParts, zeppelin: zeppelinParts,
};

/** Descritores de parte da unidade (puros, sem THREE) — base dos dois caminhos de render. */
export function buildUnitParts(unit) {
  const builder = PART_BUILDERS[unit];
  if (!builder) throw new Error(`units.js: builder desconhecido '${unit}'`);
  return builder();
}

const GEO = {
  box: (a) => new THREE.BoxGeometry(...a),
  cyl: (a) => new THREE.CylinderGeometry(...a),
  sph: (a) => new THREE.SphereGeometry(...a),
};

/** Caminho small-Group: THREE.Group com uma mesh nomeada por parte, materiais nomeados. */
export function makeUnit(unit) {
  const g = new THREE.Group();
  g.name = `unit-${unit}`;
  for (const p of buildUnitParts(unit)) {
    const mesh = new THREE.Mesh(GEO[p.g](p.a), mat(p.m));
    mesh.name = `${unit}.${p.n}`;
    mesh.position.set(...p.p);
    if (p.r) mesh.rotation.set(...p.r);
    if (p.s) mesh.scale.set(...p.s);
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _pv = new THREE.Vector3();
const _sv = new THREE.Vector3();
const _c = new THREE.Color();

/** Mescla as partes em UMA geometria com vertex colors (cor do material nomeado por
 *  vértice) — base do caminho instanciado de material compartilhado. */
export function mergeUnitGeometry(unit) {
  const pos = [], nrm = [], col = [];
  for (const p of buildUnitParts(unit)) {
    const g = GEO[p.g](p.a).toNonIndexed();
    _e.set(...(p.r || [0, 0, 0])); _q.setFromEuler(_e);
    _pv.set(...p.p); _sv.set(...(p.s || [1, 1, 1]));
    _m4.compose(_pv, _q, _sv);
    g.applyMatrix4(_m4);
    const pa = g.getAttribute('position'), na = g.getAttribute('normal');
    _c.setHex(MAT_DEFS[p.m]);
    for (let i = 0; i < pa.count; i++) {
      pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
      nrm.push(na.getX(i), na.getY(i), na.getZ(i));
      col.push(_c.r, _c.g, _c.b);
    }
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

let _instancedMat = null;
/** Material branco compartilhado (vertexColors) — 1 só para TODAS as batches instanciadas. */
export function instancedUnitMaterial() {
  if (!_instancedMat) _instancedMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return _instancedMat;
}

/** Caminho instanciado (lotes >5 unidades iguais, template inhauma-traffic):
 *  uma InstancedMesh de geometria mesclada + material compartilhado; o transform de
 *  cada instância é escrito pelo caller (padrão _dummy.updateMatrix do tráfego). */
export function makeUnitInstanced(unit, count) {
  const geometry = mergeUnitGeometry(unit);
  const mesh = new THREE.InstancedMesh(geometry, instancedUnitMaterial(), count);
  mesh.name = `unit-${unit}-instanced`;
  return { mesh, geometry, material: mesh.material, count };
}

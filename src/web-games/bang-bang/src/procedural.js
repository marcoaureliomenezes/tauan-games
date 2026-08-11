// procedural.js — Low-poly procedural fallback models for every semantic asset
// key. Used whenever a GLB is absent, so the game is fully playable with zero
// models vendored. Exports: makeFallback(key). To improve a fallback, edit its
// makeX builder here.

import * as THREE from '../../vendor/three.module.min.js';

function mat(hex) {
  return new THREE.MeshLambertMaterial({ color: hex });
}

function box(w, h, d, hex, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

function cyl(rt, rb, h, hex, x, y, z, seg = 6, rx = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(hex));
  m.position.set(x, y, z);
  m.rotation.x = rx; m.rotation.z = rz;
  return m;
}

function finish(group) {
  group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return group;
}

// ─── Animals / people ────────────────────────────────────────────────────────

function makeHorse() {
  const g = new THREE.Group();
  const brown = 0x6b4a2a, dark = 0x4a3018;
  g.add(box(1.5, 0.62, 0.5, brown, 0, 1.15, 0));                 // body
  g.add(box(0.55, 0.62, 0.26, brown, 0.82, 1.5, 0, 0, 0, -0.5)); // neck
  g.add(box(0.5, 0.24, 0.22, brown, 1.12, 1.78, 0));             // head
  g.add(box(0.3, 0.1, 0.05, dark, 0.7, 1.62, 0));                // mane
  g.add(box(0.5, 0.12, 0.06, dark, -0.85, 1.05, 0, 0, 0, 0.5));  // tail
  for (const [lx, lz] of [[0.55, 0.18], [0.55, -0.18], [-0.55, 0.18], [-0.55, -0.18]]) {
    g.add(cyl(0.07, 0.06, 0.9, dark, lx, 0.45, lz));             // legs
  }
  return finish(g);
}

function makeDeer() {
  const g = new THREE.Group();
  const tan = 0x9a7a4a, dark = 0x6a5230;
  g.add(box(1.0, 0.45, 0.34, tan, 0, 0.95, 0));
  g.add(box(0.4, 0.45, 0.18, tan, 0.58, 1.25, 0, 0, 0, -0.5));
  g.add(box(0.32, 0.16, 0.15, tan, 0.82, 1.5, 0));
  for (const s of [-1, 1]) { // antlers
    g.add(box(0.04, 0.3, 0.04, dark, 0.78, 1.72, s * 0.07));
    g.add(box(0.2, 0.04, 0.04, dark, 0.72, 1.8, s * 0.12, 0, 0, 0.4));
  }
  for (const [lx, lz] of [[0.38, 0.12], [0.38, -0.12], [-0.38, 0.12], [-0.38, -0.12]]) {
    g.add(cyl(0.05, 0.04, 0.75, dark, lx, 0.38, lz));
  }
  return finish(g);
}

function makePerson(key) {
  const g = new THREE.Group();
  const bandit = key.includes('bandit');
  const native = key.includes('native');
  const shirt = bandit ? 0x3a3a3a : native ? 0x8a4a2a : 0x7a5a30;
  g.add(cyl(0.16, 0.2, 0.62, shirt, 0, 0.95, 0));                // torso
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat(0xd9a06a));
  head.position.set(0, 1.42, 0);
  g.add(head);                                                   // head
  g.add(cyl(0.07, 0.08, 0.62, 0x3a3a4a, 0.08, 0.31, 0));         // leg R
  g.add(cyl(0.07, 0.08, 0.62, 0x3a3a4a, -0.08, 0.31, 0));        // leg L
  g.add(cyl(0.05, 0.05, 0.5, shirt, 0.26, 1.0, 0, 6, 0, 0.35));  // arm R
  g.add(cyl(0.05, 0.05, 0.5, shirt, -0.26, 1.0, 0, 6, 0, -0.35));// arm L
  if (native) {                                                  // feather
    g.add(box(0.04, 0.22, 0.02, 0xcc3333, 0, 1.62, -0.1, 0.3));
  } else {                                                       // cowboy hat
    g.add(cyl(0.24, 0.24, 0.03, 0x4a3018, 0, 1.53, 0, 8));
    g.add(cyl(0.12, 0.13, 0.14, 0x4a3018, 0, 1.6, 0, 8));
  }
  return finish(g);
}

function makeSnake() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 5, 10, Math.PI * 1.4), mat(0x7a7a3a));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.06;
  g.add(m);
  g.add(box(0.14, 0.06, 0.1, 0x7a7a3a, 0.32, 0.1, 0.08)); // head
  return finish(g);
}

function makeEagle() {
  const g = new THREE.Group();
  g.add(box(0.35, 0.12, 0.16, 0x4a3a20, 0, 0, 0));
  g.add(box(0.9, 0.04, 0.28, 0x4a3a20, 0, 0.04, 0));
  g.add(box(0.12, 0.1, 0.1, 0xe8e0d0, 0.22, 0.04, 0)); // white head
  return finish(g);
}

// ─── Props / vehicles ────────────────────────────────────────────────────────

function makeWagon() {
  const g = new THREE.Group();
  g.add(box(1.6, 0.5, 0.9, 0x7a5a30, 0, 0.75, 0));
  g.add(box(1.5, 0.5, 0.8, 0xd8cfb8, 0, 1.2, 0)); // canvas cover
  for (const [wx, wz] of [[0.55, 0.5], [0.55, -0.5], [-0.55, 0.5], [-0.55, -0.5]]) {
    g.add(cyl(0.28, 0.28, 0.08, 0x4a3018, wx, 0.28, wz, 8, Math.PI / 2));
  }
  return finish(g);
}

function makeTrain() {
  const g = new THREE.Group();
  g.add(box(2.6, 1.1, 1.0, 0x2a2a2a, 0, 0.9, 0));          // boiler/cab
  g.add(cyl(0.12, 0.16, 0.5, 0x1a1a1a, 0.9, 1.7, 0));      // chimney
  g.add(box(0.8, 0.7, 1.0, 0x3a2a1a, -1.0, 1.4, 0));       // cab
  for (const [wx, wz] of [[0.8, 0.45], [0.8, -0.45], [-0.8, 0.45], [-0.8, -0.45]]) {
    g.add(cyl(0.3, 0.3, 0.1, 0x555555, wx, 0.3, wz, 10, Math.PI / 2));
  }
  return finish(g);
}

// ─── Vegetation / rocks (single-object fallbacks; vegetation.js has instanced
//     versions of its own — these serve spawn('treePine') style callers) ──────

function makePine() {
  const g = new THREE.Group();
  g.add(cyl(0.14, 0.2, 1.6, 0x5a4028, 0, 0.8, 0));
  g.add(cyl(0.02, 1.5, 3.2, 0x2e5527, 0, 3.0, 0));
  g.add(cyl(0.02, 1.0, 2.2, 0x2e5527, 0, 4.6, 0));
  return finish(g);
}

function makeLeafTree() {
  const g = new THREE.Group();
  g.add(cyl(0.14, 0.2, 1.8, 0x5a4028, 0, 0.9, 0));
  const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 0), mat(0x4f7d2e));
  blob.position.y = 3.0;
  g.add(blob);
  return finish(g);
}

function makeRock() {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), mat(0x6f6a63));
  m.scale.set(1, 0.7, 1);
  m.position.y = 0.4;
  return finish(new THREE.Group().add(m));
}

function makeBush() {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), mat(0x4a6a2a));
  m.scale.set(1, 0.7, 1);
  m.position.y = 0.35;
  return finish(new THREE.Group().add(m));
}

/**
 * Procedural fallback for a semantic key. Unknown keys get a neutral marker box
 * (still non-breaking). @param {string} key @returns {THREE.Object3D}
 */
export function makeFallback(key) {
  const k = String(key).toLowerCase();
  if (k.includes('horse')) return makeHorse();
  if (k.includes('deer')) return makeDeer();
  if (k.includes('snake')) return makeSnake();
  if (k.includes('eagle')) return makeEagle();
  if (k.includes('wagon')) return makeWagon();
  if (k.includes('train')) return makeTrain();
  if (k.includes('pine')) return makePine();
  if (k.includes('tree') || k.includes('leaf')) return makeLeafTree();
  if (k.includes('rock')) return makeRock();
  if (k.includes('bush')) return makeBush();
  if (k.includes('cowboy') || k.includes('npc') || k.includes('native') || k.includes('bandit') || k.includes('person')) {
    return makePerson(k);
  }
  return finish(new THREE.Group().add(box(0.5, 0.5, 0.5, 0x888888, 0, 0.25, 0)));
}

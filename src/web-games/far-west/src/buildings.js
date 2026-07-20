// buildings.js — Procedural western prop builders: false-front buildings,
// teepees, tents, campfire, totem, crates, rail crossing sign. Pure geometry,
// terrain placement is the caller's job. Exports: makeBuilding, makeTeepee,
// makeTent, makeCampfire, makeTotem, makeCrates, makeCrossingSign.

import * as THREE from '../../vendor/three.module.min.js';

function mat(hex) {
  return new THREE.MeshLambertMaterial({ color: hex });
}

function box(w, h, d, hex, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

function cyl(rt, rb, h, hex, x, y, z, seg = 6, rx = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(hex));
  m.position.set(x, y, z);
  m.rotation.x = rx; m.rotation.z = rz;
  m.castShadow = true;
  return m;
}

/**
 * Western false-front building: body, gabled roof (two slanted slabs),
 * taller front facade, porch with posts. Local origin at the front-center base.
 * @param {object} o {w, h, d, color, roofColor}
 */
export function makeBuilding(o) {
  const g = new THREE.Group();
  const w = o.w || 6, h = o.h || 3.6, d = o.d || 8;
  const color = o.color || 0x8a6a42;
  const roofColor = o.roofColor || 0x5a4632;
  g.add(box(w, h, d, color, 0, h / 2, -d / 2));
  // False front: taller flat facade
  g.add(box(w + 0.3, h * 1.35, 0.24, color, 0, h * 0.67, 0.1));
  // Gabled roof: two slanted slabs
  const slope = Math.hypot(w / 2, 1.4) + 0.4;
  const ang = Math.atan2(1.4, w / 2);
  g.add(box(slope, 0.12, d + 0.6, roofColor, -w / 4 - 0.1, h + 0.6, -d / 2, 0, 0, -ang));
  g.add(box(slope, 0.12, d + 0.6, roofColor, w / 4 + 0.1, h + 0.6, -d / 2, 0, 0, ang));
  // Porch
  g.add(box(w + 1, 0.16, 2, 0x7a5c38, 0, 0.15, 1));
  for (const px of [-w / 2 + 0.3, w / 2 - 0.3]) {
    g.add(cyl(0.08, 0.08, 2.4, 0x6b4a2a, px, 1.3, 1.7));
  }
  g.add(box(w + 1, 0.12, 2.2, roofColor, 0, 2.55, 1));
  // Door + window hints (dark inset boxes)
  g.add(box(0.9, 1.9, 0.06, 0x2a2018, 0, 1.05, 0.24));
  for (const px of [-w / 3, w / 3]) {
    g.add(box(0.8, 0.9, 0.06, 0x1c2830, px, 1.9, 0.24));
  }
  return g;
}

/** Cone teepee with pole tips. */
export function makeTeepee() {
  const g = new THREE.Group();
  g.add(cyl(0.1, 2.2, 4.2, 0xb89a70, 0, 2.1, 0, 8));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(cyl(0.05, 0.05, 5, 0x6b4a2a, Math.cos(a) * 0.7, 2.4, Math.sin(a) * 0.7, 5, Math.cos(a + 1) * 0.25, Math.sin(a + 1) * 0.25));
  }
  return g;
}

/** Small canvas tent (two slanted slabs + back panel). */
export function makeTent() {
  const g = new THREE.Group();
  const c = 0xcfc0a0;
  g.add(box(3.2, 0.12, 3, c, -0.75, 1.15, 0, 0, 0, -0.72));
  g.add(box(3.2, 0.12, 3, c, 0.75, 1.15, 0, 0, 0, 0.72));
  g.add(box(2.2, 2.2, 0.12, c, 0, 0.95, -1.5));
  return g;
}

/** Stone fire ring + logs + emissive flame cone (caller adds the PointLight). */
export function makeCampfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), mat(0x6f6a63));
    s.position.set(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55);
    g.add(s);
  }
  for (let i = 0; i < 3; i++) {
    g.add(cyl(0.07, 0.07, 0.8, 0x4a3018, 0, 0.16, 0, 5, Math.PI / 2.2, (i / 3) * Math.PI));
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff9030 }),
  );
  flame.position.y = 0.6;
  flame.name = 'flame';
  g.add(flame);
  return g;
}

/** Stacked totem pole. */
export function makeTotem() {
  const g = new THREE.Group();
  const colors = [0x8a4a2a, 0xb85a30, 0x3a6a8a];
  for (let i = 0; i < 3; i++) {
    g.add(box(0.7 - i * 0.1, 0.9, 0.7 - i * 0.1, colors[i], 0, 0.45 + i * 0.9, 0));
  }
  g.add(box(1.5, 0.18, 0.3, 0xb85a30, 0, 2.6, 0));
  return g;
}

/** A few supply crates. */
export function makeCrates() {
  const g = new THREE.Group();
  g.add(box(0.8, 0.8, 0.8, 0x8a6a42, 0, 0.4, 0));
  g.add(box(0.7, 0.7, 0.7, 0x7a5c38, 0.9, 0.35, 0.2, 0, 0.4));
  g.add(box(0.6, 0.6, 0.6, 0x8a6a42, 0.4, 1.1, 0.1, 0, 0.2));
  return g;
}

/** Rail crossing sign (X boards on a post). */
export function makeCrossingSign() {
  const g = new THREE.Group();
  g.add(cyl(0.06, 0.06, 3, 0x8a8a8a, 0, 1.5, 0));
  g.add(box(1.4, 0.22, 0.05, 0xd8d0c0, 0, 2.6, 0, 0, 0, 0.6));
  g.add(box(1.4, 0.22, 0.05, 0xd8d0c0, 0, 2.6, 0, 0, 0, -0.6));
  return g;
}

// vegetation.js — Biome scatter with InstancedMesh: pines high, broadleaf in
// moist valleys, bushes on mild slopes, rocks on steep/high ground; nothing in
// riverbeds. Geometry comes from the GLB registry when available (treePine/
// treeLeaf), else procedural vertex-colored fallbacks. Also exports biomeAt, the
// shared biome classification. To tune densities/rules, edit BIOME in config.js.

import * as THREE from '../../vendor/three.module.min.js';
import { mergeGeometries } from '../../vendor/jsm/utils/BufferGeometryUtils.js';
import { WORLD, TERRAIN, BIOME, COLORS, COLLISION } from './config.js';
import { game } from './state.js';
import { heightAt, slopeAt, moistureAt } from './heightfield.js';
import { distToRiver, waterInfoAt } from './rivers.js';
import { mulberry32 } from './noise.js';
import { getModelGeometry } from './assets.js';
import { registerCollider } from './collision.js';

/**
 * Shared biome classification used by scatter, the map and gameplay.
 * @returns {'water'|'snow'|'rock'|'pine'|'forest'|'grass'}
 */
export function biomeAt(x, z) {
  if (waterInfoAt(x, z)) return 'water';
  const h = heightAt(x, z);
  if (h > TERRAIN.SNOW_LINE) return 'snow';
  const s = slopeAt(x, z);
  if (s > TERRAIN.ROCK_SLOPE * 1.2) return 'rock';
  if (h > BIOME.PINE_MIN_H) return 'pine';
  if (moistureAt(x, z) > 0.45) return 'forest';
  return 'grass';
}

// ─── Procedural instanced geometries (vertex-colored, merged) ───────────────

function colored(geom, hex, y) {
  const g = geom.translate(0, y, 0);
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g; // polyhedron geometries are already non-indexed
}

function pineGeometry() {
  return mergeGeometries([
    colored(new THREE.CylinderGeometry(0.14, 0.22, 1.6, 5), COLORS.trunk, 0.8),
    colored(new THREE.ConeGeometry(1.6, 3.4, 6), COLORS.pineGreen, 3.2),
    colored(new THREE.ConeGeometry(1.1, 2.4, 6), COLORS.pineGreen, 5.0),
  ], false);
}

function leafGeometry() {
  return mergeGeometries([
    colored(new THREE.CylinderGeometry(0.14, 0.22, 1.8, 5), COLORS.trunk, 0.9),
    colored(new THREE.IcosahedronGeometry(1.8, 0), COLORS.leafGreen, 3.2),
  ], false);
}

function bushGeometry() {
  const g = new THREE.IcosahedronGeometry(0.65, 0);
  g.scale(1, 0.7, 1);
  return colored(g, COLORS.leafGreen, 0.4);
}

function rockGeometry() {
  const g = new THREE.DodecahedronGeometry(0.95, 0);
  g.scale(1, 0.7, 1);
  return colored(g, COLORS.rock, 0.35);
}

// ─── Scatter ─────────────────────────────────────────────────────────────────

/**
 * Scatters one InstancedMesh type over the world following its biome rule.
 * When collideR > 0, every instance registers a cylinder collider.
 * @returns {number} instances actually placed
 */
function scatterType(scene, rng, geom, count, rule, castShadow, collideR = 0, collideH = 0) {
  const mesh = new THREE.InstancedMesh(geom, new THREE.MeshLambertMaterial({ vertexColors: true }), count);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  let placed = 0;
  const half = WORLD.HALF - 8;
  for (let tries = 0; tries < count * BIOME.MAX_TRIES && placed < count; tries++) {
    const x = (rng() * 2 - 1) * half;
    const z = (rng() * 2 - 1) * half;
    const h = heightAt(x, z);
    const s = slopeAt(x, z);
    const m = moistureAt(x, z);
    const dR = distToRiver(x, z);
    if (!rule(h, s, m, dR)) continue;
    q.setFromAxisAngle(up, rng() * Math.PI * 2);
    const sc = 0.75 + rng() * 0.6;
    scl.set(sc, sc * (0.9 + rng() * 0.25), sc);
    pos.set(x, h - 0.05, z);
    m4.compose(pos, q, scl);
    mesh.setMatrixAt(placed++, m4);
    if (collideR > 0) {
      const col = registerCollider(x, z, collideR * sc, collideH > 0 ? h + collideH * sc : Infinity);
      if (collideH > 0 && !game.world.testRock) game.world.testRock = { x, z, radius: col.r, topY: col.topY };
    }
  }
  mesh.count = placed;
  mesh.castShadow = castShadow;
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  return placed;
}

/**
 * GLB geometry for scatter, but only under the triangle budget — hero-pack GLBs
 * (32k-tri trees) would kill the frame rate when instanced thousands of times.
 */
function scatterGeometry(key, targetHeight, fallbackGeom) {
  const g = getModelGeometry(key, targetHeight);
  if (g && g.attributes.position.count / 3 <= BIOME.SCATTER_MAX_TRIS) return g;
  return fallbackGeom;
}

/**
 * Builds all vegetation/rock InstancedMeshes. GLB tree geometry is used when the
 * manifest delivered treePine/treeLeaf AND it fits the scatter triangle budget;
 * otherwise procedural cones/blobs.
 * @param {THREE.Scene} scene
 * @returns {object} placed counts per type (for diagnostics/tests)
 */
export function buildVegetation(scene) {
  const rng = mulberry32(WORLD.SEED + 99);
  const pineGeom = scatterGeometry('treePine', BIOME.PINE_HEIGHT, pineGeometry());
  const leafGeom = scatterGeometry('treeLeaf', BIOME.LEAF_HEIGHT, leafGeometry());
  const excl = BIOME.RIVER_EXCLUDE;
  const counts = {
    pines: scatterType(scene, rng, pineGeom, BIOME.PINES,
      (h, s, m, dR) => h > BIOME.PINE_MIN_H && h < TERRAIN.SNOW_LINE && s < BIOME.TREE_MAX_SLOPE && dR > excl, true,
      COLLISION.TRUNK_RADIUS, 0),
    leafTrees: scatterType(scene, rng, leafGeom, BIOME.LEAF_TREES,
      (h, s, m, dR) => h <= BIOME.LEAF_MAX_H && s < BIOME.TREE_MAX_SLOPE && m > 0.42 && dR > excl, true,
      COLLISION.TRUNK_RADIUS, 0),
    bushes: scatterType(scene, rng, bushGeometry(), BIOME.BUSHES,
      (h, s, m, dR) => h < TERRAIN.SNOW_LINE && s < BIOME.BUSH_MAX_SLOPE && dR > excl * 0.6, false),
    rocks: scatterType(scene, rng, rockGeometry(), BIOME.ROCKS,
      (h, s, m, dR) => (s > TERRAIN.ROCK_SLOPE * 0.8 || h > TERRAIN.SNOW_LINE * 0.7) && dR > excl * 0.5, false,
      COLLISION.ROCK_RADIUS, COLLISION.ROCK_HEIGHT),
  };
  initTufts(scene);
  return counts;
}

// ─── Near-camera grass tufts (detail ring, follows the camera) ──────────────

const TUFT_COUNT = 700;
const TUFT_RADIUS = 60;   // m — detail ring around the camera
const TUFT_REANCHOR = 15; // m — re-scatter when the camera moved this far
let tuftMesh = null;
let tuftAnchor = { x: Infinity, z: Infinity };

function tuftGeometry() {
  // Three thin tapered blades per tuft (reads as grass, not slabs)
  const blades = [];
  for (let i = 0; i < 3; i++) {
    const b = new THREE.ConeGeometry(0.035, 0.42, 3);
    b.translate(Math.cos(i * 2.1) * 0.07, 0.21, Math.sin(i * 2.1) * 0.07);
    b.rotateY(i * 1.1);
    blades.push(b);
  }
  const g = mergeGeometries(blades, false);
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  const c = new THREE.Color(0x5a8a38);
  for (let i = 0; i < n; i++) {
    const k = 0.85 + Math.random() * 0.4;
    colors[i * 3] = c.r * k; colors[i * 3 + 1] = c.g * k; colors[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function initTufts(scene) {
  if (game.flags.testMode) return; // detail ring skipped in software GL
  tuftMesh = new THREE.InstancedMesh(
    tuftGeometry(),
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    TUFT_COUNT,
  );
  tuftMesh.frustumCulled = false;
  scene.add(tuftMesh);
}

/**
 * Re-scatters grass tufts around the camera when it has moved far enough.
 * Call every frame (cheap early-out). @param {THREE.Vector3} camPos
 */
export function updateVegetation(camPos) {
  if (!tuftMesh) return;
  if (Math.hypot(camPos.x - tuftAnchor.x, camPos.z - tuftAnchor.z) < TUFT_REANCHOR) return;
  tuftAnchor = { x: camPos.x, z: camPos.z };
  const rng = mulberry32((camPos.x * 73856093) ^ (camPos.z * 19349663));
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  let placed = 0;
  for (let t = 0; t < TUFT_COUNT * 4 && placed < TUFT_COUNT; t++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * TUFT_RADIUS;
    const x = tuftAnchor.x + Math.cos(a) * r;
    const z = tuftAnchor.z + Math.sin(a) * r;
    const h = heightAt(x, z);
    if (h > TERRAIN.SNOW_LINE || slopeAt(x, z) > 0.6 || waterInfoAt(x, z)) continue;
    q.setFromAxisAngle(up, rng() * Math.PI);
    const sc = 0.7 + rng() * 0.8;
    scl.set(sc, sc, sc);
    pos.set(x, h, z);
    m4.compose(pos, q, scl);
    tuftMesh.setMatrixAt(placed++, m4);
  }
  tuftMesh.count = placed;
  tuftMesh.instanceMatrix.needsUpdate = true;
}

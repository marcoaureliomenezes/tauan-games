// water.js — Animated river ribbons + lake surface + wooden bridges over deep
// segments. Exports: buildWater, updateWater, bridgeAt, getBridges.
// To change bridge count/position, edit RIVER.BRIDGE_T in config.js.

import * as THREE from '../../vendor/three.module.min.js';
import { Water } from '../../vendor/jsm/objects/Water.js';
import { RIVER, COLORS } from './config.js';
import { game } from './state.js';
import { getRivers, getLake } from './rivers.js';
import { heightAt } from './heightfield.js';

const waterMats = [];
const bridges = []; // { cx, cz, yaw, halfL, halfW, deckY }
let lakeWater = null; // reflective Water.js surface (uniform time)

/** Small procedural streak texture so the water can scroll (fully offline). */
function makeWaterTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(160,210,235,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    const y = i * 7 + 2;
    ctx.beginPath();
    for (let x = 0; x <= 64; x += 8) {
      ctx.lineTo(x, y + Math.sin(x * 0.4 + i * 1.7) * 2.5);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6);
  return tex;
}

function makeWaterMaterial() {
  const mat = new THREE.MeshPhongMaterial({
    color: COLORS.water,
    map: makeWaterTexture(),
    transparent: true,
    opacity: 0.78,
    shininess: 140,
    specular: 0x9ecfe8,
    depthWrite: false,
  });
  waterMats.push(mat);
  return mat;
}

/** Ribbon mesh following a river polyline at its (descending) water level. */
function makeRiverRibbon(rv) {
  const pts = rv.points;
  const n = pts.length;
  const positions = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  for (let i = 0; i < n; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    let dx = next.x - prev.x, dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const px = -dz, pz = dx; // perpendicular
    const w = RIVER.HALF_WIDTH * 1.15;
    const y = rv.water[i];
    const vi = i * 6;
    positions[vi] = pts[i].x + px * w;
    positions[vi + 1] = y;
    positions[vi + 2] = pts[i].z + pz * w;
    positions[vi + 3] = pts[i].x - px * w;
    positions[vi + 4] = y;
    positions[vi + 5] = pts[i].z - pz * w;
    const ui = i * 4;
    uvs[ui] = 0; uvs[ui + 1] = i * RIVER.STEP / 16;
    uvs[ui + 2] = 1; uvs[ui + 3] = i * RIVER.STEP / 16;
  }
  const indices = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, makeWaterMaterial());
}

function makeLakeMesh(lake) {
  // Reflective water (vendored Water.js); falls back to the simple material on
  // error or in test mode (reflection = a second scene render, too costly for
  // software GL)
  try {
    if (game.flags.testMode) throw new Error('test mode');
    const normals = new THREE.TextureLoader().load('../vendor/textures/waternormals.jpg', (t) => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
    });
    const geo = new THREE.PlaneGeometry(lake.radius * 2, lake.radius * 2);
    lakeWater = new Water(geo, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normals,
      sunDirection: new THREE.Vector3(0.4, 0.8, 0.3).normalize(),
      sunColor: 0xffffff,
      waterColor: 0x0e3a4a,
      distortionScale: 2.2,
      fog: true,
    });
    lakeWater.rotation.x = -Math.PI / 2;
    lakeWater.position.set(lake.x, lake.level, lake.z);
    return lakeWater;
  } catch (e) {
    const geo = new THREE.CircleGeometry(lake.radius, 48);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, makeWaterMaterial());
    mesh.position.set(lake.x, lake.level, lake.z);
    return mesh;
  }
}

/** Procedural wooden bridge (plank deck + rails + posts) at a deep river point. */
function makeBridge(scene, rv, tNorm) {
  const pts = rv.points;
  // Walk to the requested normalized position, skipping ford stretches
  let i = Math.floor(pts.length * tNorm);
  for (let k = 0; k < pts.length && rv.ford[i]; k++) i = (i + 1) % pts.length;
  const p = pts[i];
  const q = pts[Math.min(pts.length - 1, i + 1)];
  const riverYaw = Math.atan2(q.z - p.z, q.x - p.x);
  const yaw = riverYaw + Math.PI / 2; // deck crosses the river
  const px = -Math.sin(riverYaw), pz = Math.cos(riverYaw); // across-river direction
  const bankA = { x: p.x + px * (RIVER.HALF_WIDTH + 3), z: p.z + pz * (RIVER.HALF_WIDTH + 3) };
  const bankB = { x: p.x - px * (RIVER.HALF_WIDTH + 3), z: p.z - pz * (RIVER.HALF_WIDTH + 3) };
  const deckY = Math.max(heightAt(bankA.x, bankA.z), heightAt(bankB.x, bankB.z)) + 0.9;
  const length = (RIVER.HALF_WIDTH + RIVER.BRIDGE_EXTRA) * 2;
  const width = RIVER.BRIDGE_WIDTH;

  const group = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: COLORS.wood });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(length, 0.35, width), wood);
  deck.position.y = -0.18;
  group.add(deck);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.12, 0.12), wood);
    rail.position.set(0, 0.85, side * (width / 2 - 0.08));
    group.add(rail);
    for (const end of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.05, 0.22), wood);
      post.position.set(end * (length / 2 - 0.3), 0.45, side * (width / 2 - 0.08));
      group.add(post);
    }
  }
  group.position.set(p.x, deckY, p.z);
  group.rotation.y = -yaw; // local +X -> (cos yaw, 0, sin yaw)
  group.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(group);

  bridges.push({ cx: p.x, cz: p.z, yaw, halfL: length / 2, halfW: width / 2, deckY });
}

/**
 * Builds river ribbons, the lake and the bridges.
 * @param {THREE.Scene} scene
 */
export function buildWater(scene) {
  waterMats.length = 0;
  bridges.length = 0;
  const rivers = getRivers();
  for (let r = 0; r < rivers.length; r++) {
    scene.add(makeRiverRibbon(rivers[r]));
    makeBridge(scene, rivers[r], RIVER.BRIDGE_T[r % RIVER.BRIDGE_T.length]);
  }
  scene.add(makeLakeMesh(getLake()));
}

/** Scrolls the water textures (river flow) + lake reflection time. @param {number} dt */
export function updateWater(dt) {
  for (const mat of waterMats) {
    if (mat.map) mat.map.offset.y -= dt * 0.08;
  }
  if (lakeWater) lakeWater.material.uniforms.time.value += dt * 0.6;
}

/**
 * Walkable bridge deck query used by ground movement.
 * @returns {number|null} deck height (m) if (x,z) is on a bridge deck, else null
 */
export function bridgeAt(x, z) {
  for (const b of bridges) {
    const dx = x - b.cx, dz = z - b.cz;
    const u = dx * Math.cos(b.yaw) + dz * Math.sin(b.yaw);
    const v = -dx * Math.sin(b.yaw) + dz * Math.cos(b.yaw);
    if (Math.abs(u) <= b.halfL && Math.abs(v) <= b.halfW) return b.deckY;
  }
  return null;
}

export function getBridges() {
  return bridges;
}

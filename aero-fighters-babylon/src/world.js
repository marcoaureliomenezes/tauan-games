// world.js — Oceano, ilhas procedurais, nuvens, foam rings.
// Exporta: ocean, clouds, createIslands, islandHeightAt, checkTerrainCollision, updateWorld.

/* global BABYLON */

import { scene } from './scene.js';
import { game } from './state.js';
import { ISLAND_DEFS, WORLD } from './config.js';

// ─── Oceano ───────────────────────────────────────────────────────────────────
const OCEAN_SEGS = 64;
export let ocean = null;
let _oceanPositions = null;
let _oceanBaseY = null;
let _oceanFrame = 0;

function createOcean() {
  ocean = BABYLON.MeshBuilder.CreateGround('ocean', {
    width: WORLD.OCEAN_SIZE,
    height: WORLD.OCEAN_SIZE,
    subdivisions: OCEAN_SEGS,
    updatable: true,
  }, scene);

  const mat = new BABYLON.StandardMaterial('oceanMat', scene);
  mat.diffuseColor = new BABYLON.Color3(0.0, 0.31, 0.48);
  mat.specularColor = new BABYLON.Color3(0.3, 0.5, 0.6);
  mat.specularPower = 30;
  ocean.material = mat;
  ocean.receiveShadows = false;

  // Salvar posicoes base
  _oceanPositions = ocean.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  _oceanBaseY = new Float32Array(_oceanPositions.length / 3);
  for (let i = 0; i < _oceanBaseY.length; i++) {
    _oceanBaseY[i] = _oceanPositions[i * 3 + 1];
  }
}

function updateOceanWaves() {
  if ((_oceanFrame++ & 1) !== 0) return;
  if (!ocean || !_oceanPositions) return;

  const t = performance.now() * 0.0008;
  const positions = ocean.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const count = positions.length / 3;

  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const z = positions[i * 3 + 2];
    const wave =
      Math.sin(x * 0.04 + t * 1.8) * 0.55 +
      Math.cos(z * 0.05 + t * 1.5) * 0.45 +
      Math.sin((x + z) * 0.07 + t * 2.4) * 0.30;
    positions[i * 3 + 1] = wave;
  }

  ocean.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions, false, false);
}

// ─── Ilhas ────────────────────────────────────────────────────────────────────
function createIsland(cx, cz, radius, peakHeight) {
  const seg = 40;
  const mesh = BABYLON.MeshBuilder.CreateGround('island_' + cx + '_' + cz, {
    width: radius * 2,
    height: radius * 2,
    subdivisions: seg,
    updatable: false,
  }, scene);
  mesh.position.x = cx;
  mesh.position.z = cz;

  const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const colors = [];
  const count = positions.length / 3;

  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const z = positions[i * 3 + 2];
    const dist = Math.sqrt(x * x + z * z) / radius;
    const noise =
      Math.sin(x * 0.18) * Math.cos(z * 0.14) * 5 +
      Math.sin(x * 0.36 + 1.5) * Math.cos(z * 0.29 + 0.8) * 2.5 +
      Math.sin(x * 0.72) * Math.cos(z * 0.63) * 1.2 +
      Math.sin(x * 1.42 + 0.4) * Math.cos(z * 1.18 - 0.6) * 0.6;
    const h = Math.max(0, (1 - dist * dist * 1.35) * peakHeight + noise);
    positions[i * 3 + 1] = h;

    let r, g, b;
    if (h < 2.0) {
      r = 0.91; g = 0.85; b = 0.62;
    } else if (h < 4.5) {
      const k = (h - 2.0) / 2.5;
      r = 0.91 + k * (0.55 - 0.91);
      g = 0.85 + k * (0.72 - 0.85);
      b = 0.62 + k * (0.36 - 0.62);
    } else {
      const tv = h / peakHeight;
      if (tv < 0.30) { r = 0.55; g = 0.72; b = 0.36; }
      else if (tv < 0.58) { r = 0.22; g = 0.52; b = 0.16; }
      else if (tv < 0.80) { r = 0.50; g = 0.40; b = 0.28; }
      else { r = 0.93; g = 0.93; b = 0.97; }
    }
    colors.push(r, g, b, 1.0);
  }

  mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions, false, false);
  mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors, false);
  mesh.refreshBoundingInfo();

  const mat = new BABYLON.StandardMaterial('islandMat_' + cx, scene);
  mat.vertexColorsEnabled = true;
  mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
  mat.specularColor = new BABYLON.Color3(0, 0, 0);
  mesh.material = mat;
  return mesh;
}

function createFoamRing(cx, cz, radius) {
  const ring = BABYLON.MeshBuilder.CreateTorus('foam_' + cx + '_' + cz, {
    diameter: radius * 2.0,
    thickness: radius * 0.12,
    tessellation: 48,
  }, scene);
  ring.position.set(cx, 0.6, cz);
  const mat = new BABYLON.StandardMaterial('foamMat', scene);
  mat.diffuseColor = new BABYLON.Color3(0.93, 0.96, 1.0);
  mat.alpha = 0.55;
  mat.specularColor = new BABYLON.Color3(0, 0, 0);
  ring.material = mat;
  return ring;
}

export function createIslands() {
  for (const [cx, cz, r, h] of ISLAND_DEFS) {
    const mesh = createIsland(cx, cz, r, h);
    createFoamRing(cx, cz, r);
    game.islands.push({ cx, cz, radius: r, peakHeight: h, mesh });
  }
}

export function islandHeightAt(isl, dx, dz) {
  const r2 = dx * dx + dz * dz;
  if (r2 >= isl.radius * isl.radius) return 0;
  const t = Math.sqrt(r2) / isl.radius;
  return isl.peakHeight * Math.max(0, 1 - t * t * 1.35);
}

export function checkTerrainCollision(jetPosition) {
  if (jetPosition.y < 3) return 'SEA';
  for (const isl of game.islands) {
    const dx = jetPosition.x - isl.cx;
    const dz = jetPosition.z - isl.cz;
    const r2 = dx * dx + dz * dz;
    if (r2 < isl.radius * isl.radius) {
      const localH = islandHeightAt(isl, dx, dz);
      if (jetPosition.y < localH + 2.5) return 'MOUNTAIN';
    }
  }
  return null;
}

// ─── Nuvens ───────────────────────────────────────────────────────────────────
export const clouds = [];
const cloudMats = [];

const CLOUD_LAYERS = [
  [80,  130, 20,  8, 18, 15, 25],
  [220, 380, 25, 12, 25, 15, 28],
  [500, 750, 15, 20, 40, 12, 20],
];

for (const [altMin, altMax, count, rMin, rMax, sMin, sMax] of CLOUD_LAYERS) {
  for (let i = 0; i < count; i++) {
    const root = new BABYLON.TransformNode('cloud_' + i + '_' + altMin, scene);
    const n = sMin + Math.floor(Math.random() * (sMax - sMin + 1));
    const spread = rMax * 2.5;
    const mat = new BABYLON.StandardMaterial('cloudMat_' + i, scene);
    mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    mat.specularColor = new BABYLON.Color3(0, 0, 0);
    mat.alpha = 0.85;
    cloudMats.push(mat);
    for (let j = 0; j < n; j++) {
      const r = rMin + Math.random() * (rMax - rMin);
      const s = BABYLON.MeshBuilder.CreateSphere('cs_' + i + '_' + j, { diameter: r * 2, segments: 6 }, scene);
      s.material = mat;
      s.position.set(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * (rMax * 0.5),
        (Math.random() - 0.5) * spread,
      );
      s.parent = root;
    }
    root.position.set(
      (Math.random() - 0.5) * 4000,
      altMin + Math.random() * (altMax - altMin),
      (Math.random() - 0.5) * 4000,
    );
    clouds.push(root);
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────
export function updateWorld(dt, playerPosition) {
  // Recentraliza oceano no player
  if (ocean) {
    ocean.position.x = playerPosition.x;
    ocean.position.z = playerPosition.z;
  }
  updateOceanWaves();

  // Drift de nuvens
  for (const c of clouds) {
    c.position.x += dt * 4;
    if (c.position.x > playerPosition.x + 2000) c.position.x -= 4000;
  }
}

export function updateCloudColors(tod) {
  const isDawn = tod > 0.15 && tod < 0.28;
  const isDusk = tod > 0.72 && tod < 0.86;
  const isNight = tod < 0.18 || tod > 0.82;
  let cr, cg, cb;
  if (isNight) { cr = 0.102; cg = 0.125; cb = 0.188; }
  else if (isDawn || isDusk) { cr = 1.0; cg = 0.69; cb = 0.54; }
  else { cr = 1.0; cg = 1.0; cb = 1.0; }
  for (const m of cloudMats) m.diffuseColor.set(cr, cg, cb);
}

// Iniciar oceano
createOcean();

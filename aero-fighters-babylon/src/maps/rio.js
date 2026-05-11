// maps/rio.js — Mapa 3: Rio de Janeiro (Babylon.js port).
// Exporta: createRioWorld, updateRioWorld, rioHeightAt.

/* global BABYLON */

import { scene } from '../scene.js';
import { game } from '../state.js';

const HILL_DEFS = [
  [  80, -120,  45, 120, 'rock',   'paodeacucar'],
  [-200,  100,  70, 150, 'forest', 'corcovado'],
  [ 300,  250,  55,  90, 'twin',   'doisirmaos'],
  [-300,  300,  60,  80, 'mesa',   'pedradagavea'],
  [-100,  500, 120, 110, 'forest', 'tijuca'],
  [ 450, -200,  35,  55, 'urban',  'morro1'],
  [-400, -300,  40,  50, 'urban',  'morro2'],
  [ 200,  600,  30,  45, 'urban',  'morro3'],
];

function createMorro(hDef) {
  const [cx, cz, radius, height, type] = hDef;
  const segs = 44;

  const mesh = BABYLON.MeshBuilder.CreateGround('morro_' + cx + '_' + cz, {
    width:        radius * 2.4,
    height:       radius * 2.4,
    subdivisions: segs,
    updatable:    false,
  }, scene);
  mesh.position.x = cx;
  mesh.position.z = cz;

  const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const colors    = [];
  const count     = positions.length / 3;

  for (let i = 0; i < count; i++) {
    const x    = positions[i * 3];
    const z    = positions[i * 3 + 2];
    const dist = Math.sqrt(x * x + z * z);
    const t    = dist / radius;

    let h = 0;
    if (type === 'rock') {
      h = height * Math.max(0, 1 - t * t * 2.0);
    } else if (type === 'mesa') {
      h = t < 0.65 ? height : height * Math.max(0, 1 - (t - 0.65) / 0.25);
    } else if (type === 'twin') {
      const d1 = Math.sqrt((x - 0.3 * radius) ** 2 + z * z);
      const d2 = Math.sqrt((x + 0.3 * radius) ** 2 + z * z);
      h = height * Math.max(
        Math.max(0, 1 - (d1 / radius * 1.8) ** 2),
        Math.max(0, 1 - (d2 / radius * 1.8) ** 2),
      );
    } else {
      h = height * Math.max(0, 1 - t * t * 1.6);
    }

    h += Math.sin(x * 0.2) * 2 + Math.cos(z * 0.18) * 2;
    h  = Math.max(0, h);
    positions[i * 3 + 1] = h;

    const fh = h / height;
    let r, g, b;
    if (type === 'rock' || type === 'mesa') {
      if (fh > 0.7)      { r = 0.38; g = 0.35; b = 0.32; }
      else if (fh > 0.15){ r = 0.22; g = 0.52; b = 0.16; }
      else               { r = 0.75; g = 0.70; b = 0.65; }
    } else if (type === 'urban') {
      if (fh > 0.4)      { r = 0.55; g = 0.45; b = 0.35; }
      else if (fh > 0.1) { r = 0.80; g = 0.58; b = 0.42; }
      else               { r = 0.75; g = 0.70; b = 0.65; }
    } else {
      if (fh > 0.6)      { r = 0.45; g = 0.40; b = 0.30; }
      else if (fh > 0.05){ r = 0.22; g = 0.52; b = 0.16; }
      else               { r = 0.75; g = 0.70; b = 0.65; }
    }
    colors.push(r, g, b, 1.0);
  }

  mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions, false, false);
  mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors, false);
  mesh.refreshBoundingInfo();

  const mat = new BABYLON.StandardMaterial('morroMat_' + cx, scene);
  mat.vertexColorsEnabled = true;
  mat.diffuseColor  = new BABYLON.Color3(1, 1, 1);
  mat.specularColor = new BABYLON.Color3(0, 0, 0);
  mesh.material = mat;

  return { cx, cz, radius, peakHeight: height, mesh, type };
}

export function createRioWorld() {
  // Oceano da baía
  const ocean = BABYLON.MeshBuilder.CreateGround('rioOcean', {
    width: 10000, height: 10000, subdivisions: 1,
  }, scene);
  ocean.position.y = 0;
  const oceanMat = new BABYLON.StandardMaterial('rioOceanMat', scene);
  oceanMat.diffuseColor  = new BABYLON.Color3(0.102, 0.310, 0.431);
  oceanMat.specularColor = new BABYLON.Color3(0.2, 0.4, 0.5);
  ocean.material = oceanMat;

  // Fog bruma marítima
  scene.fogMode  = BABYLON.Scene.FOGMODE_LINEAR;
  scene.fogStart = 250;
  scene.fogEnd   = 600;
  scene.fogColor = new BABYLON.Color3(0.529, 0.808, 0.922);
  scene.clearColor = new BABYLON.Color4(0.529, 0.808, 0.922, 1.0);

  // Morros
  game.islands.length = 0;
  for (const def of HILL_DEFS) {
    game.islands.push(createMorro(def));
  }
}

export function updateRioWorld(_dt, _playerPos) {
  // Oceano estático neste mapa
}

export function rioHeightAt(isl, dx, dz) {
  const t = Math.sqrt(dx * dx + dz * dz) / isl.radius;
  if (isl.type === 'mesa') {
    return t < 0.65 ? isl.peakHeight : isl.peakHeight * Math.max(0, 1 - (t - 0.65) / 0.25);
  }
  return isl.peakHeight * Math.max(0, 1 - t * t * 1.6);
}

// maps/desert.js — Mapa 2: Deserto/Cânions (Babylon.js port).
// Exporta: createDesertWorld, updateDesertWorld, desertHeightAt.

/* global BABYLON */

import { scene } from '../scene.js';
import { game } from '../state.js';

const MESA_DEFS = [
  [   0,   0, 200, 45, 'mesa'],
  [ 400,-300, 120, 38, 'mesa'],
  [-350, 200, 150, 52, 'mesa'],
  [ 200, 500,  90, 30, 'mesa'],
  [-500,-400, 100, 42, 'mesa'],
  [   0,-600, 180, 35, 'mesa'],
  [ 600, 100,  80, 25, 'mesa'],
  [-200, 700, 110, 48, 'mesa'],
  [ 150, 200,  80, 35, 'canyon'],
  [-250,-150,  60, 28, 'canyon'],
];

function createMesa(mDef) {
  const [cx, cz, radius, height, type] = mDef;
  const segs = 36;

  const mesh = BABYLON.MeshBuilder.CreateGround('mesa_' + cx + '_' + cz, {
    width:        radius * 2.2,
    height:       radius * 2.2,
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
    if (type === 'mesa') {
      if (t < 0.7)       h = height;
      else if (t < 1.0)  h = height * (1 - (t - 0.7) / 0.3);
    } else {
      if (t < 0.7)       h = -height * 0.6;
      else if (t < 1.0)  h = -height * 0.6 * (1 - (t - 0.7) / 0.3);
    }

    h += Math.sin(x * 0.15) * 1.5 + Math.cos(z * 0.12) * 1.5;
    h  = Math.max(-10, h);
    positions[i * 3 + 1] = h;

    const fh = height > 0 ? h / height : 0;
    let r, g, b;
    if (fh > 0.8)      { r = 0.72; g = 0.38; b = 0.22; }
    else if (fh > 0.3) { r = 0.65; g = 0.45; b = 0.28; }
    else               { r = 0.88; g = 0.72; b = 0.38; }
    colors.push(r, g, b, 1.0);
  }

  mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions, false, false);
  mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors, false);
  mesh.refreshBoundingInfo();

  const mat = new BABYLON.StandardMaterial('mesaMat_' + cx, scene);
  mat.vertexColorsEnabled = true;
  mat.diffuseColor  = new BABYLON.Color3(1, 1, 1);
  mat.specularColor = new BABYLON.Color3(0, 0, 0);
  mesh.material = mat;

  return { cx, cz, radius, peakHeight: height, mesh, type };
}

export function createDesertWorld() {
  // Piso do deserto
  const floor = BABYLON.MeshBuilder.CreateGround('desertFloor', {
    width: 12000, height: 12000, subdivisions: 1,
  }, scene);
  floor.position.y = -0.1;
  const floorMat = new BABYLON.StandardMaterial('desertFloorMat', scene);
  floorMat.diffuseColor  = new BABYLON.Color3(0.831, 0.643, 0.290);
  floorMat.specularColor = new BABYLON.Color3(0, 0, 0);
  floor.material = floorMat;

  // Fog cor areia
  scene.fogMode  = BABYLON.Scene.FOGMODE_LINEAR;
  scene.fogStart = 500;
  scene.fogEnd   = 1000;
  scene.fogColor = new BABYLON.Color3(0.831, 0.643, 0.290);
  scene.clearColor = new BABYLON.Color4(0.831, 0.643, 0.290, 1.0);

  // Mesas e cânions
  game.islands.length = 0;
  for (const def of MESA_DEFS) {
    game.islands.push(createMesa(def));
  }
}

export function updateDesertWorld(_dt, _playerPos) {
  // Estático — sem ondas
}

export function desertHeightAt(isl, dx, dz) {
  const t = Math.sqrt(dx * dx + dz * dz) / isl.radius;
  if (isl.type === 'mesa') {
    if (t < 0.7)  return isl.peakHeight;
    if (t < 1.0)  return isl.peakHeight * (1 - (t - 0.7) / 0.3);
    return 0;
  }
  if (t < 0.7) return -isl.peakHeight * 0.6;
  return 0;
}

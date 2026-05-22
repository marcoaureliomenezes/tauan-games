// maps/desert.js — Mapa 2: Deserto/Cânions.
// Exporta: createDesertWorld, updateDesertWorld, desertHeightAt.
// Interface compatível com world.js (game.islands aponta para mesas).

import * as THREE from '../../../vendor/three.module.min.js';
import { game } from '../state.js';
import { airportSurface } from '../landing-zones.js';
import { desertAirport } from '../airport.js';

// HEADLESS guard: cena injetada via parâmetro
let _scene = null;

/** Definição das mesas e cânions: [cx, cz, radius, height, type] */
const MESA_DEFS = [
  [   0,   0, 200, 45, 'mesa'],    // mesa central grande
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

function createMesa(mDef, scene) {
  const [cx, cz, radius, height, type] = mDef;
  const segs = 36;
  const geo = new THREE.PlaneGeometry(radius * 2.2, radius * 2.2, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position;
  const colArr = new Float32Array(posAttr.count * 3);

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);

    // Airport flatten: qualquer vértice sobre superfície do aeroporto vai a y=0
    const worldX = cx + x;
    const worldZ = cz + z;
    if (airportSurface({ x: worldX, z: worldZ }) !== 'none') {
      posAttr.setY(i, desertAirport.elevation);
      // Cor de areia neutra na área do aeroporto (sem argila/rocha)
      colArr[i * 3] = 0.88; colArr[i * 3 + 1] = 0.72; colArr[i * 3 + 2] = 0.38;
      continue;
    }

    const dist = Math.sqrt(x * x + z * z);
    const t = dist / radius;

    let h = 0;
    if (type === 'mesa') {
      if (t < 0.7) h = height;
      else if (t < 1.0) h = height * (1 - (t - 0.7) / 0.3);
    } else {
      // Canyon (vale invertido)
      if (t < 0.7) h = -height * 0.6;
      else if (t < 1.0) h = -height * 0.6 * (1 - (t - 0.7) / 0.3);
    }

    // Ruído leve para naturalidade
    h += Math.sin(x * 0.15) * 1.5 + Math.cos(z * 0.12) * 1.5;
    const hClamped = Math.max(-10, h);
    posAttr.setY(i, hClamped);

    // Vertex colors
    const fh = height > 0 ? hClamped / height : 0;
    if (fh > 0.8) {
      colArr[i * 3] = 0.72; colArr[i * 3 + 1] = 0.38; colArr[i * 3 + 2] = 0.22; // argila topo
    } else if (fh > 0.3) {
      colArr[i * 3] = 0.65; colArr[i * 3 + 1] = 0.45; colArr[i * 3 + 2] = 0.28; // rocha
    } else {
      colArr[i * 3] = 0.88; colArr[i * 3 + 1] = 0.72; colArr[i * 3 + 2] = 0.38; // areia
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, 0, cz);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  scene.add(mesh);

  return { cx, cz, radius, peakHeight: height, mesh, type };
}

/** Cria o mundo deserto: piso plano + mesas/cânions + fog areia. */
export function createDesertWorld(scene, skyRef) {
  _scene = scene;

  // Piso do deserto (substitui oceano)
  const floorMat = new THREE.MeshLambertMaterial({ color: 0xd4a44a });
  const desertFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(12000, 12000, 1, 1),
    floorMat,
  );
  desertFloor.rotation.x = -Math.PI / 2;
  desertFloor.position.y = -0.1;
  desertFloor.receiveShadow = true;
  scene.add(desertFloor);

  // Fog areia
  scene.fog = new THREE.Fog(0xd4a44a, 500, 1000);

  // Mesas e cânions — populam game.islands para compatibilidade
  game.islands.length = 0;
  for (const def of MESA_DEFS) {
    const isl = createMesa(def, scene);
    game.islands.push(isl);
  }
}

/** Update frame do deserto (sem animação de ondas — estático). */
export function updateDesertWorld(dt, playerPos) {
  // Sem oceano animado. Nuvens são geridas pelo sky.js existente.
}

/** Altura de uma mesa/cânion em (dx, dz) relativos ao centro.
 *  Inclui o mesmo noise senoidal de createMesa() para evitar divergência de colisão.
 *  Airport-flatten: se o ponto cai sobre a superfície do aeroporto, retorna elevation=0. */
export function desertHeightAt(isl, dx, dz) {
  const worldX = isl.cx + dx;
  const worldZ = isl.cz + dz;
  if (airportSurface({ x: worldX, z: worldZ }) !== 'none') {
    return desertAirport.elevation;
  }
  const noise = Math.sin(dx * 0.15) * 1.5 + Math.cos(dz * 0.12) * 1.5;
  const t = Math.sqrt(dx * dx + dz * dz) / isl.radius;
  if (isl.type === 'mesa') {
    let h = 0;
    if (t < 0.7) h = isl.peakHeight;
    else if (t < 1.0) h = isl.peakHeight * (1 - (t - 0.7) / 0.3);
    return Math.max(0, h + noise);
  } else {
    // canyon — pode ser negativo (vale)
    if (t < 0.7) return Math.max(-10, -isl.peakHeight * 0.6 + noise);
    if (t < 1.0) return Math.max(-10, -isl.peakHeight * 0.6 * (1 - (t - 0.7) / 0.3) + noise);
    return 0;
  }
}

// maps/desert.js — Mapa 2: Deserto/Cânions.
// Exporta: createDesertWorld, updateDesertWorld, desertHeightAt.
// Interface compatível com world.js (game.islands aponta para mesas).

import * as THREE from '../../../vendor/three.module.min.js';
import { game } from '../state.js';
import { airportSurface, applyAirportClearing } from '../landing-zones.js';
import { desertAirport } from '../airport.js';

/** Textura procedural do piso: bandas de duna + speckle (WS-7). */
function makeDesertTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d4a44a'; ctx.fillRect(0, 0, 512, 512);
  // bandas de duna suaves
  for (let i = 0; i < 18; i++) {
    const y = Math.random() * 512, h = 14 + Math.random() * 40;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(190,140,60,0)');
    g.addColorStop(0.5, `rgba(190,140,60,${0.10 + Math.random() * 0.12})`);
    g.addColorStop(1, 'rgba(190,140,60,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y, 512, h);
  }
  // speckle de pedrisco
  for (let i = 0; i < 900; i++) {
    const a = 0.05 + Math.random() * 0.12;
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(120,84,40,${a})` : `rgba(236,205,140,${a})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(46, 46);
  return tex;
}

/** Pedras + cactos espalhados no piso (WS-7) — InstancedMesh, fora do aeroporto/mesas. */
function scatterDesertProps(scene) {
  const rocks = [], cacti = [];
  for (let i = 0; i < 320; i++) {
    const x = game.rng.range(-2400, 2400);
    const z = game.rng.range(-2400, 2400);
    if (airportSurface({ x, z }) !== 'none') continue;
    const onMesa = MESA_DEFS.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r * 1.1);
    if (onMesa) continue;
    if (game.rng.random() < 0.62) rocks.push({ x, z, s: game.rng.range(0.6, 2.6) });
    else cacti.push({ x, z, s: game.rng.range(0.7, 1.5) });
  }
  const dummy = new THREE.Object3D();
  if (rocks.length) {
    const m = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ color: 0x9a7848 }), rocks.length);
    m.frustumCulled = false;
    rocks.forEach((r, i) => {
      dummy.position.set(r.x, r.s * 0.4, r.z);
      dummy.scale.set(r.s, r.s * 0.7, r.s);
      dummy.rotation.y = r.x * 0.31;
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    scene.add(m);
  }
  if (cacti.length) {
    const m = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.28, 0.34, 3.2, 6),
      new THREE.MeshLambertMaterial({ color: 0x3f7a3a }), cacti.length);
    m.frustumCulled = false;
    cacti.forEach((c2, i) => {
      dummy.position.set(c2.x, 1.6 * c2.s, c2.z);
      dummy.scale.setScalar(c2.s);
      dummy.rotation.y = 0;
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    scene.add(m);
  }
}

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

    const worldX = cx + x;
    const worldZ = cz + z;

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
    // Clareira do aeroporto: achata o relevo (com rampa suave) numa área ampla ao
    // redor da pista — nenhuma mesa fica no meio/beira da pista de pouso.
    const hClamped = applyAirportClearing(Math.max(-10, h), worldX, worldZ, 'desert');
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

  // Piso do deserto (substitui oceano) — texturizado (WS-7)
  const isHeadless = typeof navigator !== 'undefined' && navigator.webdriver === true;
  const floorMat = isHeadless
    ? new THREE.MeshLambertMaterial({ color: 0xd4a44a })
    : new THREE.MeshLambertMaterial({ map: makeDesertTexture() });
  const desertFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(12000, 12000, 1, 1),
    floorMat,
  );
  desertFloor.rotation.x = -Math.PI / 2;
  desertFloor.position.y = -0.1;
  desertFloor.receiveShadow = true;
  scene.add(desertFloor);
  if (!isHeadless) scatterDesertProps(scene);

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
  const noise = Math.sin(dx * 0.15) * 1.5 + Math.cos(dz * 0.12) * 1.5;
  const t = Math.sqrt(dx * dx + dz * dz) / isl.radius;
  let natural;
  if (isl.type === 'mesa') {
    let h = 0;
    if (t < 0.7) h = isl.peakHeight;
    else if (t < 1.0) h = isl.peakHeight * (1 - (t - 0.7) / 0.3);
    natural = Math.max(0, h + noise);
  } else {
    // canyon — pode ser negativo (vale)
    if (t < 0.7) natural = Math.max(-10, -isl.peakHeight * 0.6 + noise);
    else if (t < 1.0) natural = Math.max(-10, -isl.peakHeight * 0.6 * (1 - (t - 0.7) / 0.3) + noise);
    else natural = 0;
  }
  // Mesma clareira do aeroporto aplicada na malha (colisão == visual).
  return applyAirportClearing(natural, worldX, worldZ, 'desert');
}

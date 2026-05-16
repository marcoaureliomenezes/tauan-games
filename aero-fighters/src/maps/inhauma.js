// maps/inhauma.js — Mapa 4: Inhauma-MG e entorno regional.
// Exporta: createInhaumaWorld, updateInhaumaWorld, inhaumaHeightAt.

import * as THREE from '../../../vendor/three.module.min.js';
import { game } from '../state.js';
import { airportSurface } from '../landing-zones.js';
import { inhaumaAirport } from '../airport.js';

export const INHAUMA_CITIES = [
  { id: 'inhauma', x: 0, z: 0, radius: 260, role: 'focus' },
  { id: 'cachoeira-da-prata', x: -900, z: 520, radius: 170, role: 'west-town' },
  { id: 'sete-lagoas', x: 1250, z: -420, radius: 360, role: 'regional-city' },
];

export const INHAUMA_TERRAIN_DEFS = [
  { id: 'urban-rise-inhauma', cx: 0, cz: 0, radius: 360, peakHeight: 10, type: 'urbanRise' },
  { id: 'morros-oeste-inhauma', cx: -380, cz: 40, radius: 270, peakHeight: 52, type: 'roundedHill' },
  { id: 'morro-norte-inhauma', cx: -40, cz: -330, radius: 230, peakHeight: 44, type: 'roundedHill' },
  { id: 'serra-sete-lagoas', cx: 760, cz: -300, radius: 430, peakHeight: 76, type: 'ridge' },
  { id: 'vale-cachoeira-prata', cx: -940, cz: 520, radius: 260, peakHeight: 16, type: 'valley' },
  { id: 'morros-sudeste-inhauma', cx: 330, cz: 330, radius: 240, peakHeight: 40, type: 'roundedHill' },
].map((def, index) => ({ ...def, index }));

export const INHAUMA_ROADS = [
  { id: 'mg-238', kind: 'highway', width: 18, points: [
    { x: -1080, z: 560 }, { x: -760, z: 430 }, { x: -260, z: 270 },
    { x: 80, z: 170 }, { x: 500, z: 40 }, { x: 900, z: -220 }, { x: 1320, z: -430 },
  ] },
  { id: 'amg-0360', kind: 'collector', width: 12, points: [
    { x: -120, z: 80 }, { x: -210, z: 260 }, { x: -260, z: 520 }, { x: -310, z: 760 },
  ] },
  { id: 'rod-mun-inhauma', kind: 'collector', width: 11, points: [
    { x: 60, z: -60 }, { x: 120, z: -250 }, { x: 180, z: -520 }, { x: 240, z: -780 },
  ] },
];

export const INHAUMA_LANDMARKS = [
  { id: 'igreja-inhauma', kind: 'church', x: 20, z: -40, radius: 34, height: 30 },
  { id: 'campo-inhauma', kind: 'football-field', x: -170, z: -90, radius: 58, height: 1 },
  { id: 'area-lazer-manga', kind: 'park', x: 170, z: 50, radius: 64, height: 1 },
  { id: 'praca-central-inhauma', kind: 'square', x: 45, z: 40, radius: 42, height: 1 },
  { id: 'aerodromo-inhauma', kind: 'airfield', x: inhaumaAirport.runway.center.x, z: inhaumaAirport.runway.center.z, radius: 340, height: 0 },
  { id: 'cachoeira-da-prata', kind: 'town', x: -900, z: 520, radius: 170, height: 0 },
  { id: 'sete-lagoas', kind: 'city', x: 1250, z: -420, radius: 360, height: 0 },
];

const _matCache = new Map();

function mat(color) {
  if (!_matCache.has(color)) _matCache.set(color, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  return _matCache.get(color);
}

function addPlane(scene, x, z, w, d, color, y = 0.06, name = '') {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  scene.add(mesh);
  return mesh;
}

function addBox(scene, x, y, z, sx, sy, sz, color, name = '') {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(color));
  mesh.position.set(x, y + sy / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  scene.add(mesh);
  return mesh;
}

function terrainHeight(def, dx, dz) {
  const d = Math.hypot(dx, dz);
  const t = d / def.radius;
  if (t >= 1) return 0;
  const noise = Math.sin(dx * 0.036) * 1.8 + Math.cos(dz * 0.031) * 1.5;
  if (def.type === 'urbanRise') return Math.max(0, def.peakHeight * (1 - t * t * 1.4) + noise * 0.35);
  if (def.type === 'ridge') {
    const ridgeBand = Math.max(0, 1 - Math.abs(dz) / (def.radius * 0.55));
    const falloff = Math.max(0, 1 - Math.abs(dx) / def.radius);
    return Math.max(0, def.peakHeight * ridgeBand * falloff + noise);
  }
  if (def.type === 'valley') {
    return Math.max(0, def.peakHeight * 0.35 * (1 - t) + noise * 0.25);
  }
  return Math.max(0, def.peakHeight * Math.max(0, 1 - t * t * 1.35) + noise);
}

function createTerrainRegion(def, scene) {
  const geo = new THREE.PlaneGeometry(def.radius * 2.4, def.radius * 2.4, 44, 44);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const worldX = def.cx + x;
    const worldZ = def.cz + z;
    let h = terrainHeight(def, x, z);
    if (airportSurface({ x: worldX, z: worldZ }, 'inhauma') !== 'none') h = inhaumaAirport.elevation;
    pos.setY(i, h);
    const ratio = def.peakHeight ? h / def.peakHeight : 0;
    if (def.type === 'valley') {
      colors[i * 3] = 0.34; colors[i * 3 + 1] = 0.55; colors[i * 3 + 2] = 0.34;
    } else if (ratio > 0.65) {
      colors[i * 3] = 0.30; colors[i * 3 + 1] = 0.40; colors[i * 3 + 2] = 0.25;
    } else if (ratio > 0.25) {
      colors[i * 3] = 0.24; colors[i * 3 + 1] = 0.48; colors[i * 3 + 2] = 0.20;
    } else {
      colors[i * 3] = 0.58; colors[i * 3 + 1] = 0.55; colors[i * 3 + 2] = 0.34;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.position.set(def.cx, 0, def.cz);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return { ...def, mesh, cx: def.cx, cz: def.cz, radius: def.radius, peakHeight: def.peakHeight, type: def.type };
}

function addRoadPolyline(scene, road) {
  for (let i = 0; i < road.points.length - 1; i++) {
    const a = road.points[i], b = road.points[i + 1];
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const mesh = addPlane(scene, mx, mz, road.width, len, road.kind === 'highway' ? 0x8e8c84 : 0x8a7b61, 0.12, road.id);
    mesh.rotation.z = -Math.atan2(b.x - a.x, b.z - a.z);
  }
}

function addLandmarks(scene) {
  addPlane(scene, -170, -90, 120, 72, 0x2f8c42, 0.16, 'campo-inhauma');
  addPlane(scene, 170, 50, 105, 88, 0x4f9a54, 0.16, 'area-lazer-manga');
  addPlane(scene, 45, 40, 70, 58, 0x6f8d62, 0.17, 'praca-central-inhauma');
  addBox(scene, 20, 0, -40, 32, 12, 46, 0xe6dfc5, 'igreja-inhauma');
  addBox(scene, 20, 12, -70, 12, 18, 12, 0xd9d1b8, 'igreja-inhauma-torre');
  const spire = new THREE.Mesh(new THREE.ConeGeometry(8, 28, 4), mat(0xd65a3a));
  spire.position.set(20, 44, -70);
  spire.rotation.y = Math.PI / 4;
  spire.castShadow = true;
  scene.add(spire);
}

function addUrbanBlocks(scene) {
  const houseGeo = new THREE.BoxGeometry(1, 1, 1);
  const houseMat = new THREE.MeshLambertMaterial({ color: 0xc98561 });
  const houses = [];
  for (let x = -230; x <= 230; x += 32) {
    for (let z = -230; z <= 230; z += 28) {
      if (Math.hypot(x, z) > 270) continue;
      if (Math.hypot(x - 20, z + 40) < 65) continue;
      if (Math.abs(x + 170) < 70 && Math.abs(z + 90) < 50) continue;
      if (Math.abs(x - 170) < 75 && Math.abs(z - 50) < 65) continue;
      if ((x + z) % 5 === 0) continue;
      houses.push({ x, z, h: 5 + ((x * 13 + z * 7) % 5), w: 12 + Math.abs(x % 7), d: 10 + Math.abs(z % 6) });
    }
  }
  const mesh = new THREE.InstancedMesh(houseGeo, houseMat, houses.length);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  houses.forEach((h, i) => {
    dummy.position.set(h.x, h.h / 2, h.z);
    dummy.scale.set(h.w, h.h, h.d);
    dummy.rotation.y = ((h.x + h.z) % 9) * 0.08;
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function addPeripheralCities(scene) {
  addPlane(scene, -900, 520, 260, 190, 0x9c9585, 0.09, 'cachoeira-da-prata');
  addPlane(scene, -960, 610, 180, 30, 0x2c6f83, 0.13, 'corrego-cachoeira-prata');
  addPlane(scene, 1250, -420, 520, 430, 0x777672, 0.09, 'sete-lagoas');
  for (let i = 0; i < 5; i++) {
    addPlane(scene, 1130 + i * 58, -540 + (i % 2) * 90, 48, 36, 0x1d5268, 0.14, `lagoa-sete-lagoas-${i}`);
  }
  addPlane(scene, -620, 280, 180, 120, 0x7f8d4d, 0.08, 'fazenda-aerodromo');
  addPlane(scene, -1280, 80, 140, 140, 0x6d8b42, 0.08, 'pivo-agricola');
}

export function createInhaumaWorld(scene) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(5200, 4200), mat(0x8d8a52));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  scene.add(ground);
  scene.fog = new THREE.Fog(0xb8d2b2, 650, 1600);

  game.islands.length = 0;
  for (const def of INHAUMA_TERRAIN_DEFS) game.islands.push(createTerrainRegion(def, scene));
  for (const road of INHAUMA_ROADS) addRoadPolyline(scene, road);
  addPeripheralCities(scene);
  addUrbanBlocks(scene);
  addLandmarks(scene);

  game.missionRealism.inhaumaMap = {
    cities: INHAUMA_CITIES,
    roads: INHAUMA_ROADS,
    landmarks: INHAUMA_LANDMARKS,
    terrainRegions: INHAUMA_TERRAIN_DEFS,
  };
}

export function updateInhaumaWorld() {}

export function inhaumaHeightAt(region, dx, dz) {
  const worldX = region.cx + dx;
  const worldZ = region.cz + dz;
  if (airportSurface({ x: worldX, z: worldZ }, 'inhauma') !== 'none') return inhaumaAirport.elevation;
  return terrainHeight(region, dx, dz);
}

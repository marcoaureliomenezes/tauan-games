import * as THREE from '../../../vendor/three.module.min.js';
import { getInhaumaRoads, nearAnyRoad } from './inhauma-roads.js';
import { inhaumaAirportExclusionZoneAt, isInhaumaAirportSurface } from './inhauma-road-airport.js';
import { routeLength, samplePolyline } from './inhauma-road-utils.js';

// Tráfego v0.2.0: carros circulam nas POUCAS estradas autorais (sem walk de grafo OSM).
// Cada estrada é uma rota; carros percorrem a polilinha em laço (anel fechado circula
// pra sempre; estrada aberta dá a volta pelas pontas, longe da vista do jogador).
const CAR_COUNT = 30;
const CAR_COLORS = [0xd03020, 0x2040d0, 0xf0f0f0, 0x202020, 0xf0c020, 0x20a040];
const CAR_PITCH_SAMPLE = 5.5;
// T-V-16 (inhauma-visual-uplift-v1): na pista dupla cada sentido roda no CENTRO da
// sua pista (canteiro/2 + pista/2 = 2 + 3,75 = 5,75 m do eixo) — ESPELHO de
// DUAL_CARRIAGEWAY em inhauma-road-render.js; mudou lá, muda aqui.
const DUAL_LANE_OFFSET_M = 5.75;
const _dummy = new THREE.Object3D();
let _routeCache = null;

function classRankFor(kind) { return kind === 'highway' ? 4 : kind === 'regional' ? 3 : kind === 'street' ? 2 : 1; }
function speedForRoute(route, truck, variant) {
  const base = route.classRank >= 4 ? 30 : route.classRank === 3 ? 24 : route.classRank === 2 ? 19 : 15;
  return (truck ? base * 0.78 : base) + (variant % 5) * 1.3;
}

/** Rotas = as próprias estradas autorais. Sem grafo, sem seeds, sem walk. */
export function createTrafficRoutes() {
  if (_routeCache) return _routeCache;
  _routeCache = getInhaumaRoads().map((road) => ({
    id: road.id,
    points: road.points,
    width: road.width,
    closed: !!road.closed,
    dual: !!road.dual, // T-V-16: pista dupla → uma mão por pista
    classRank: classRankFor(road.kind),
    graphEdgeCount: road.points.length - 1,
    length: routeLength(road.points),
  })).filter((r) => r.length > 120);
  return _routeCache;
}

export function buildInhaumaTraffic(scene, roadGroup) {
  const bodyMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 1.35, 7), new THREE.MeshLambertMaterial({ color: 0xffffff }), CAR_COUNT);
  const cabinMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(3.2, 1.25, 2.4), new THREE.MeshLambertMaterial({ color: 0xd0d5d8 }), CAR_COUNT);
  const windowMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(3.35, 0.55, 0.18), new THREE.MeshLambertMaterial({ color: 0x9fd3ff }), CAR_COUNT);
  const wheelMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.7, 0.32), new THREE.MeshLambertMaterial({ color: 0x101010 }), CAR_COUNT * 4);
  for (const mesh of [bodyMesh, cabinMesh, windowMesh, wheelMesh]) mesh.frustumCulled = false;

  const routes = createTrafficRoutes();
  bodyMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAR_COUNT * 3), 3);
  const cars = [];
  for (let i = 0; i < CAR_COUNT; i++) {
    const route = routes[i % routes.length];
    const truck = i % 7 === 0 || i % 11 === 0;
    const dir = i % 2 === 0 ? 1 : -1; // mão dupla: metade em cada sentido
    cars.push({
      route,
      distance: (route.length * ((i * 37) % 101)) / 101,
      speed: speedForRoute(route, truck, i) * dir,
      dir,
      laneSide: dir, // cada sentido na sua faixa (mão direita)
      truck,
    });
    const c = new THREE.Color(CAR_COLORS[i % CAR_COLORS.length]);
    bodyMesh.instanceColor.setXYZ(i, c.r, c.g, c.b);
  }
  scene.add(bodyMesh); scene.add(cabinMesh); scene.add(windowMesh); scene.add(wheelMesh);
  return { bodyMesh, cabinMesh, windowMesh, wheelMesh, cars, roadGroup, routes, diagnostics: { samples: [] } };
}

export function updateRoadTraffic(dt, refs, heightAt) {
  const samples = [];
  let airportSurfaceSamples = 0;
  let airportExclusionSamples = 0;
  let offRoadSamples = 0;
  let wheelHeightViolations = 0;
  let maxClearanceError = 0;
  let maxBodyPitchDeg = 0;
  refs.cars.forEach((c, i) => {
    c.distance = ((c.distance + c.speed * dt) % c.route.length + c.route.length) % c.route.length;
    const p = samplePolyline(c.route.points, c.distance, c.route.length);
    const lane = c.laneSide * (c.route.dual ? DUAL_LANE_OFFSET_M : Math.min(4.2, c.route.width * 0.23));
    const x = p.x + Math.cos(p.ang) * lane;
    const z = p.z - Math.sin(p.ang) * lane;
    const groundY = heightAt(x, z);
    const pitch = roadPitchAt(c.route, c.distance, lane, heightAt) * c.dir;
    const yaw = p.ang + (c.dir < 0 ? Math.PI : 0); // carro em contramão aponta pra trás
    maxBodyPitchDeg = Math.max(maxBodyPitchDeg, Math.abs(pitch * 180 / Math.PI));
    const onAirportSurface = isInhaumaAirportSurface(x, z);
    if (onAirportSurface) airportSurfaceSamples++;
    const airportExclusionZone = inhaumaAirportExclusionZoneAt(x, z);
    if (airportExclusionZone) airportExclusionSamples++;
    const bodyY = groundY + 0.88;
    const wheelCenterY = groundY + 0.34;
    const clearanceError = Math.abs((bodyY - groundY) - 0.88);
    maxClearanceError = Math.max(maxClearanceError, clearanceError);
    if (wheelCenterY < groundY + 0.25 || wheelCenterY > groundY + 0.45 || clearanceError > 0.02) wheelHeightViolations++;
    if (!nearAnyRoad(x, z, Math.max(2, c.route.width * 0.5))) offRoadSamples++;
    if (i < 10) {
      samples.push({
        i, route: c.route.id,
        x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10,
        groundY: Math.round(groundY * 100) / 100,
        bodyY: Math.round(bodyY * 100) / 100,
        wheelCenterY: Math.round(wheelCenterY * 100) / 100,
        clearance: Math.round((bodyY - groundY) * 100) / 100,
        bodyPitchDeg: Math.round((pitch * 180 / Math.PI) * 10) / 10,
        onAirportSurface,
        airportExclusionZone: airportExclusionZone?.id || null,
      });
    }
    updateCarMeshes(refs, i, c, x, z, yaw, pitch, bodyY, wheelCenterY);
  });
  refs.bodyMesh.instanceMatrix.needsUpdate = true;
  refs.cabinMesh.instanceMatrix.needsUpdate = true;
  refs.windowMesh.instanceMatrix.needsUpdate = true;
  refs.wheelMesh.instanceMatrix.needsUpdate = true;
  refs.diagnostics = {
    samples,
    airportSurfaceSamples,
    airportExclusionSamples,
    offRoadSamples,
    wheelHeightViolations,
    maxClearanceError: Math.round(maxClearanceError * 1000) / 1000,
    maxBodyPitchDeg: Math.round(maxBodyPitchDeg * 10) / 10,
    pitchAlignedCars: refs.cars.length,
    checkedCars: refs.cars.length,
    graphRouteSegments: refs.routes.reduce((sum, route) => sum + (route.graphEdgeCount || 0), 0),
    classSpeedBands: refs.routes.reduce((bands, route) => ((bands[route.classRank] = (bands[route.classRank] || 0) + 1), bands), {}),
  };
}

function laneHeightAt(route, distance, lane, heightAt) {
  const p = samplePolyline(route.points, distance, route.length);
  return heightAt(p.x + Math.cos(p.ang) * lane, p.z - Math.sin(p.ang) * lane);
}

function roadPitchAt(route, distance, lane, heightAt) {
  const back = laneHeightAt(route, distance - CAR_PITCH_SAMPLE, lane, heightAt);
  const front = laneHeightAt(route, distance + CAR_PITCH_SAMPLE, lane, heightAt);
  return Math.max(-0.32, Math.min(0.32, Math.atan2(front - back, CAR_PITCH_SAMPLE * 2)));
}

function updateCarMeshes(refs, i, c, x, z, yaw, pitch, bodyY, wheelCenterY) {
  _dummy.position.set(x, bodyY, z);
  _dummy.rotation.set(pitch, yaw, 0);
  _dummy.scale.set(c.truck ? 1.25 : 1, c.truck ? 1.12 : 1, c.truck ? 1.55 : 1);
  _dummy.updateMatrix();
  refs.bodyMesh.setMatrixAt(i, _dummy.matrix);

  _dummy.position.set(x, bodyY + 0.95, z);
  _dummy.rotation.set(pitch, yaw, 0);
  _dummy.translateZ(c.truck ? -0.8 : -0.55);
  _dummy.scale.set(c.truck ? 1.1 : 0.9, 1, c.truck ? 0.95 : 0.8);
  _dummy.updateMatrix();
  refs.cabinMesh.setMatrixAt(i, _dummy.matrix);

  _dummy.position.set(x, bodyY + 1.05, z);
  _dummy.rotation.set(pitch, yaw, 0);
  _dummy.translateZ(c.truck ? -1.85 : -1.6);
  _dummy.scale.set(c.truck ? 1.0 : 0.85, 1, 1);
  _dummy.updateMatrix();
  refs.windowMesh.setMatrixAt(i, _dummy.matrix);

  const wheelZ = c.truck ? [-4.5, -1.4, 2.8, 4.8] : [-2.6, 2.6, -2.6, 2.6];
  const wheelX = [-2.25, -2.25, 2.25, 2.25];
  for (let w = 0; w < 4; w++) {
    _dummy.position.set(x, wheelCenterY, z);
    _dummy.rotation.set(pitch, yaw, 0);
    _dummy.translateX(wheelX[w]);
    _dummy.translateZ(wheelZ[w]);
    _dummy.scale.set(c.truck ? 1.15 : 1, c.truck ? 1.15 : 1, 1);
    _dummy.updateMatrix();
    refs.wheelMesh.setMatrixAt(i * 4 + w, _dummy.matrix);
  }
}

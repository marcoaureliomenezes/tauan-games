import * as THREE from '../../../vendor/three.module.min.js';
import { getInhaumaRoads, INHAUMA_ROAD_GRAPH, nearAnyRoad } from './inhauma-roads.js';
import { inhaumaAirportExclusionZoneAt, isInhaumaAirportSurface } from './inhauma-road-airport.js';
import { routeLength, samplePolyline } from './inhauma-road-utils.js';

const CAR_COUNT = 34;
const CAR_COLORS = [0xd03020, 0x2040d0, 0xf0f0f0, 0x202020, 0xf0c020, 0x20a040];
const ROUTE_TARGET_LENGTH = 1800;
const CAR_PITCH_SAMPLE = 5.5;
const _dummy = new THREE.Object3D();
let _graphRouteCache = null;

function roadRank(road) { return road.kind === 'highway' ? 4 : road.kind === 'regional' ? 3 : road.kind === 'street' ? 2 : 1; }
function speedForRoute(route, truck, variant) {
  const base = route.classRank >= 4 ? 31 : route.classRank === 3 ? 26 : route.classRank === 2 ? 21 : 16;
  return (truck ? base * 0.76 : base) + (variant % 5) * 1.4;
}

function buildTrafficGraph() {
  const nodes = new Map(INHAUMA_ROAD_GRAPH.nodes.map((node) => [node.id, node]));
  const roads = new Map(getInhaumaRoads().map((road) => [road.id, road]));
  const adjacency = new Map(INHAUMA_ROAD_GRAPH.nodes.map((node) => [node.id, []]));
  for (const edge of INHAUMA_ROAD_GRAPH.edges) {
    const road = roads.get(edge.id);
    if (!road || road.width < 8) continue;
    for (let i = 1; i < edge.nodes.length; i++) {
      const a = nodes.get(edge.nodes[i - 1]), b = nodes.get(edge.nodes[i]);
      if (!a || !b) continue;
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length <= 0) continue;
      const segment = { road, length };
      adjacency.get(a.id).push({ ...segment, from: a, to: b });
      adjacency.get(b.id).push({ ...segment, from: b, to: a });
    }
  }
  return { nodes, adjacency };
}

function routeNodeScore(id, adjacency, nodes) {
  const node = nodes.get(id);
  const degree = adjacency.get(id)?.length ?? 0;
  if (!node || degree < 2 || inhaumaAirportExclusionZoneAt(node.x, node.z)) return -Infinity;
  const bestRoad = adjacency.get(id).reduce((best, link) => Math.max(best, roadRank(link.road)), 0);
  return degree * 20 + bestRoad * 12 + Math.hypot(node.x, node.z) * 0.002;
}

function pickNextLink(links, prevNodeId, heading, variant) {
  let best = null;
  let bestScore = -Infinity;
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    if (link.to.id === prevNodeId && links.length > 1) continue;
    if (inhaumaAirportExclusionZoneAt(link.to.x, link.to.z)) continue;
    const dx = link.to.x - link.from.x;
    const dz = link.to.z - link.from.z;
    const len = Math.hypot(dx, dz) || 1;
    const continuity = heading ? ((dx / len) * heading.x + (dz / len) * heading.z) : ((variant % 3) - 1) * 0.08;
    const score = roadRank(link.road) * 26 + link.road.width * 1.7 + continuity * 18 +
      ((link.to.id.charCodeAt(link.to.id.length - 1) + variant * 13 + i * 7) % 17);
    if (score > bestScore) {
      best = link;
      bestScore = score;
    }
  }
  return best;
}

function buildGraphRoute(seedId, graph, variant) {
  const { nodes, adjacency } = graph;
  const points = [];
  let currentId = seedId, prevId = null, total = 0, minWidth = Infinity, graphEdgeCount = 0, classRank = 0, heading = null;
  for (let guard = 0; guard < 360 && total < ROUTE_TARGET_LENGTH; guard++) {
    const current = nodes.get(currentId);
    if (!current) break;
    if (!points.length) points.push({ x: current.x, z: current.z });
    const links = adjacency.get(currentId) || [];
    const next = pickNextLink(links, prevId, heading, variant + guard);
    if (!next) break;
    points.push({ x: next.to.x, z: next.to.z });
    total += next.length;
    minWidth = Math.min(minWidth, next.road.width);
    classRank = Math.max(classRank, roadRank(next.road));
    graphEdgeCount++;
    heading = { x: (next.to.x - next.from.x) / next.length, z: (next.to.z - next.from.z) / next.length };
    prevId = currentId;
    currentId = next.to.id;
  }
  if (points.length < 4 || total < 220) return null;
  return { id: `graph-${variant}-${seedId}`, points, width: Number.isFinite(minWidth) ? minWidth : 10, graphEdgeCount, classRank };
}

export function createTrafficRoutes() {
  if (_graphRouteCache) return _graphRouteCache;
  const graph = buildTrafficGraph();
  const seeds = [...graph.adjacency.keys()]
    .map((id) => ({ id, score: routeNodeScore(id, graph.adjacency, graph.nodes) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => (b.score - a.score) || (a.id < b.id ? -1 : 1))
    .slice(0, 12);
  const routes = [];
  for (let i = 0; i < seeds.length; i++) {
    const route = buildGraphRoute(seeds[i].id, graph, i);
    if (!route) continue;
    routes.push(route);
    routes.push({ id: `${route.id}-reverse`, points: [...route.points].reverse(), width: route.width, graphEdgeCount: route.graphEdgeCount, classRank: route.classRank });
  }
  _graphRouteCache = routes
    .map((route) => ({ ...route, length: routeLength(route.points) }))
    .filter((route) => route.length > 220 && route.graphEdgeCount >= 3)
    .slice(0, 20);
  return _graphRouteCache;
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
    cars.push({
      route,
      distance: (route.length * ((i * 37) % 101)) / 101,
      speed: speedForRoute(route, truck, i),
      laneSide: i % 2 === 0 ? -1 : 1,
      truck,
    });
    const c = new THREE.Color(CAR_COLORS[i % CAR_COLORS.length]);
    bodyMesh.instanceColor.setXYZ(i, c.r, c.g, c.b);
  }
  scene.add(bodyMesh);
  scene.add(cabinMesh);
  scene.add(windowMesh);
  scene.add(wheelMesh);
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
    c.distance = (c.distance + c.speed * dt) % c.route.length;
    const p = samplePolyline(c.route.points, c.distance, c.route.length);
    const lane = c.laneSide * Math.min(4.2, c.route.width * 0.23);
    const x = p.x + Math.cos(p.ang) * lane;
    const z = p.z - Math.sin(p.ang) * lane;
    const groundY = heightAt(x, z);
    const pitch = roadPitchAt(c.route, c.distance, lane, heightAt);
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
        i,
        route: c.route.id,
        x: Math.round(x * 10) / 10,
        z: Math.round(z * 10) / 10,
        groundY: Math.round(groundY * 100) / 100,
        bodyY: Math.round(bodyY * 100) / 100,
        wheelCenterY: Math.round(wheelCenterY * 100) / 100,
        clearance: Math.round((bodyY - groundY) * 100) / 100,
        bodyPitchDeg: Math.round((pitch * 180 / Math.PI) * 10) / 10,
        onAirportSurface,
        airportExclusionZone: airportExclusionZone?.id || null,
      });
    }
    updateCarMeshes(refs, i, c, x, z, p.ang, pitch, bodyY, wheelCenterY);
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

import * as THREE from '../../../vendor/three.module.min.js';
import { INHAUMA_NAMED_ROUTES } from './inhauma-roads.js';
import { getInhaumaRoads } from './inhauma-roads.js';

const INHAUMA_OSM_NAMED_ROUTES = INHAUMA_NAMED_ROUTES;
import { routeLength, samplePolyline } from './inhauma-road-utils.js';

const DETAIL_ROAD_KINDS = new Set(['highway', 'regional']);
const STRIPE_Y = 0.43;

function propCounts(roads) {
  let centerDashCount = 0, edgeMarkerCount = 0, roadsidePostCount = 0, roadSignCount = 0;
  for (const road of roads) {
    if (!DETAIL_ROAD_KINDS.has(road.kind)) continue;
    const len = routeLength(road.points);
    centerDashCount += Math.max(0, Math.floor((len - 36) / 44));
    edgeMarkerCount += Math.max(0, Math.floor((len - 28) / 56)) * 2;
    roadsidePostCount += Math.max(0, Math.floor((len - 40) / 90)) * 2;
    roadSignCount += Math.max(0, Math.floor((len - 120) / 180));
  }
  return { centerDashCount, edgeMarkerCount, roadsidePostCount, roadSignCount, routeLabelSignCount: ROUTE_LABEL_SIGNS.length };
}

export function getRoadRenderDetailDiagnostics() {
  return propCounts(getInhaumaRoads());
}

export function buildDashInstances(roads, heightAt, mat) {
  const dashes = [];
  for (const road of roads) {
    if (!DETAIL_ROAD_KINDS.has(road.kind)) continue;
    for (let d = 24; d < routeLength(road.points) - 12; d += 44) dashes.push({ road, ...samplePolyline(road.points, d) });
  }
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.75, 14), mat, dashes.length);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  dashes.forEach((p, i) => {
    dummy.position.set(p.x, heightAt(p.x, p.z) + STRIPE_Y, p.z);
    dummy.rotation.set(-Math.PI / 2, 0, -p.ang);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  return mesh;
}

function buildEdgeMarkers(roads, heightAt, mat) {
  const marks = [];
  for (const road of roads) {
    if (!DETAIL_ROAD_KINDS.has(road.kind)) continue;
    for (let d = 18; d < routeLength(road.points) - 10; d += 56) {
      const p = samplePolyline(road.points, d);
      const edge = road.width * 0.5 - 0.45;
      marks.push({ ...p, lane: -edge });
      marks.push({ ...p, lane: edge });
    }
  }
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.42, 8), mat, marks.length);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  marks.forEach((p, i) => {
    const x = p.x + Math.cos(p.ang) * p.lane, z = p.z - Math.sin(p.ang) * p.lane;
    dummy.position.set(x, heightAt(x, z) + STRIPE_Y + 0.01, z);
    dummy.rotation.set(-Math.PI / 2, 0, -p.ang);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  return mesh;
}

function buildRoadsidePosts(roads, heightAt, mat) {
  const posts = [];
  for (const road of roads) {
    if (!DETAIL_ROAD_KINDS.has(road.kind)) continue;
    for (let d = 40; d < routeLength(road.points) - 20; d += 90) {
      const p = samplePolyline(road.points, d);
      const edge = road.width * 0.5 + 2.8;
      posts.push({ ...p, lane: -edge });
      posts.push({ ...p, lane: edge });
    }
  }
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 2.2, 0.6), mat, posts.length);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  posts.forEach((p, i) => {
    const x = p.x + Math.cos(p.ang) * p.lane, z = p.z - Math.sin(p.ang) * p.lane;
    dummy.position.set(x, heightAt(x, z) + 1.1, z);
    dummy.rotation.set(0, p.ang, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  return mesh;
}

function addRoadSigns(group, roads, heightAt) {
  const signs = roads.filter((road) => DETAIL_ROAD_KINDS.has(road.kind)).flatMap((road) => {
    const items = [];
    for (let d = 120; d < routeLength(road.points) - 80; d += 180) items.push({ road, ...samplePolyline(road.points, d) });
    return items;
  });
  const pole = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 4, 0.35), new THREE.MeshLambertMaterial({ color: 0xc9c4a8 }), signs.length);
  const plate = new THREE.InstancedMesh(new THREE.BoxGeometry(5.2, 2.5, 0.25), new THREE.MeshLambertMaterial({ color: 0x2d6b55 }), signs.length);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < signs.length; i++) {
    const p = signs[i], lane = p.road.width * 0.5 + 5.5;
    const x = p.x + Math.cos(p.ang) * lane, z = p.z - Math.sin(p.ang) * lane;
    dummy.position.set(x, heightAt(x, z) + 2, z); dummy.rotation.set(0, p.ang, 0); dummy.updateMatrix(); pole.setMatrixAt(i, dummy.matrix);
    dummy.position.y += 2.5; dummy.updateMatrix(); plate.setMatrixAt(i, dummy.matrix);
  }
  pole.frustumCulled = false; plate.frustumCulled = false;
  group.add(pole); group.add(plate);
}

const ROUTE_LABEL_SIGNS = [
  { route: 'mg-238', distance: 300, label: 'MG-238', sub: 'Inhaúma' },
  { route: 'mg-238', distance: 1600, label: 'MG-238', sub: 'Sete Lagoas' },
  { route: 'mg-424', distance: 400, label: 'MG-424', sub: 'Represa' },
  { route: 'mg-060', distance: 300, label: 'MG-060', sub: 'Cachoeira' },
  { route: 'amg-0360', distance: 400, label: 'AMG-0360', sub: 'Rural' },
  { route: 'anel-inhauma', distance: 600, label: 'Anel', sub: 'Centro' },
];

function signTexture(label, sub) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#285a46'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#e8ead8'; ctx.lineWidth = 10; ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.fillStyle = '#f5f6df'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 34px sans-serif'; ctx.fillText(label, canvas.width / 2, 48);
  ctx.font = '24px sans-serif'; ctx.fillText(sub, canvas.width / 2, 88);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addRouteLabelSigns(group, heightAt) {
  if (typeof document === 'undefined') return;
  const materials = new Map();
  const poleMat = new THREE.MeshLambertMaterial({ color: 0xc9c4a8 });
  for (const spec of ROUTE_LABEL_SIGNS) {
    const points = INHAUMA_OSM_NAMED_ROUTES[spec.route];
    if (!points?.length) continue;
    const p = samplePolyline(points, Math.min(spec.distance, routeLength(points) - 10));
    const x = p.x + Math.cos(p.ang) * 12;
    const z = p.z - Math.sin(p.ang) * 12;
    const y = heightAt(x, z);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.45, 5.2, 0.45), poleMat);
    pole.position.set(x, y + 2.6, z);
    group.add(pole);
    const key = `${spec.label}|${spec.sub}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshBasicMaterial({ map: signTexture(spec.label, spec.sub), side: THREE.DoubleSide }));
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), materials.get(key));
    plate.position.set(x, y + 5.7, z);
    plate.rotation.y = p.ang + Math.PI / 2;
    group.add(plate);
  }
}

// WS-2: portal de túnel na ponta de uma estrada marcada com endcap/startcap:'tunnel'.
// A ponta assenta numa encosta REAL (serra/morro) ou numa colina de portal sintética
// (getPortalMounds), então o túnel fura relevo de verdade — nenhuma estrada para no ar.
// A garganta escura recua SEMPRE para DENTRO da encosta (sentido "para fora" da estrada),
// coerente tanto na ponta inicial quanto na final.
function buildTunnelPortals(group, roads, heightAt, material) {
  const concrete = material(0xb9b9b3);
  const dark = new THREE.MeshBasicMaterial({ color: 0x07070a });
  for (const road of roads) {
    const pts = road.points;
    const total = routeLength(pts);
    const ends = [];
    // p.ang aponta no SENTIDO DE TRÁFEGO; "para fora" (para dentro da encosta) é o oposto
    // no início e o próprio sentido no fim.
    if (road.startcap === 'tunnel') {
      const p = samplePolyline(pts, 1, total);
      ends.push({ x: p.x, z: p.z, ox: -Math.sin(p.ang), oz: -Math.cos(p.ang), w: road.width });
    }
    if (road.endcap === 'tunnel') {
      const p = samplePolyline(pts, Math.max(1, total - 1), total);
      ends.push({ x: p.x, z: p.z, ox: Math.sin(p.ang), oz: Math.cos(p.ang), w: road.width });
    }
    for (const e of ends) {
      const halfW = e.w * 0.5 + 2.5;
      const pillarH = 9, pillarW = 2.6, lintelH = 2.4;
      const ang = Math.atan2(e.ox, e.oz); // +Z local = "para fora" = para dentro da encosta
      const portal = new THREE.Group();
      portal.position.set(e.x, heightAt(e.x, e.z), e.z);
      portal.rotation.y = ang;
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(pillarW, pillarH, 3.0), concrete);
        pillar.position.set(side * halfW, pillarH * 0.5, 0);
        portal.add(pillar);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + pillarW, lintelH, 3.2), concrete);
      lintel.position.set(0, pillarH + lintelH * 0.5, 0);
      portal.add(lintel);
      // Garganta escura funda recuando para DENTRO da encosta (+Z local) — boca de túnel.
      const throat = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 - 0.5, pillarH, 20.0), dark);
      throat.position.set(0, pillarH * 0.5, 10.5);
      portal.add(throat);
      group.add(portal);
    }
  }
}

export function addRoadDetailProps(group, roads, heightAt, material) {
  group.add(buildDashInstances(roads, heightAt, material(0xf4e7a0)));
  group.add(buildEdgeMarkers(roads, heightAt, material(0xe8e7d6)));
  group.add(buildRoadsidePosts(roads, heightAt, material(0xd8d4bd)));
  addRoadSigns(group, roads, heightAt);
  addRouteLabelSigns(group, heightAt);
  buildTunnelPortals(group, roads, heightAt, material);
}

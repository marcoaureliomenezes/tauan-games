import * as THREE from '../../../vendor/three.module.min.js';
import {
  getInhaumaRoads,
  getRoadContinuityPatches,
} from './inhauma-roads.js';
import { buildInhaumaTraffic } from './inhauma-traffic.js';
import { addRoadDetailProps } from './inhauma-road-props.js';

// Render de estradas v0.2.0: poucas fitas CONTÍNUAS e suaves via THREE.CatmullRomCurve3.
// Asfalto claro o suficiente pra ler como estrada (não o smear preto do dump OSM).
const ROAD_Y = 0.34;
const SHOULDER_Y = 0.22;
const INTERSECTION_Y = 0.38;
const RIBBON_STEP = 8; // m entre seções da fita (curva suave, arc-length uniforme)
const ROAD_RENDER_LAYERS = [
  { key: 'street',   color: 0x53565c, y: ROAD_Y - 0.01 },
  { key: 'regional', color: 0x494c52, y: ROAD_Y + 0.01 },
  { key: 'highway',  color: 0x40434a, y: ROAD_Y + 0.03 },
];

function material(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

/** Amostra a linha de centro por uma Catmull-Rom da THREE (arc-length uniforme). */
function centerlineSamples(road, heightAt) {
  const pts = road.points.map((p) => new THREE.Vector3(p.x, 0, p.z));
  const curve = new THREE.CatmullRomCurve3(pts, !!road.closed, 'centripetal');
  const n = Math.max(2, Math.ceil(curve.getLength() / RIBBON_STEP));
  const spaced = curve.getSpacedPoints(n);
  return spaced.map((v) => ({ x: v.x, z: v.z, y: heightAt(v.x, v.z) }));
}

/** Constrói a geometria de fita (2 vértices por seção) seguindo a curva + o terreno. */
function buildRibbonGeometry(roads, widthOffset, yOffset, heightAt) {
  const positions = [];
  const uvs = [];
  const indices = [];
  let vertexBase = 0;
  for (const road of roads) {
    const samples = centerlineSamples(road, heightAt);
    const halfWidth = road.width * 0.5 + widthOffset;
    for (let i = 0; i < samples.length; i++) {
      const prev = samples[Math.max(0, i - 1)];
      const next = samples[Math.min(samples.length - 1, i + 1)];
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = dz / len;
      const nz = -dx / len;
      const cur = samples[i];
      positions.push(cur.x + nx * halfWidth, cur.y + yOffset, cur.z + nz * halfWidth);
      positions.push(cur.x - nx * halfWidth, cur.y + yOffset, cur.z - nz * halfWidth);
      uvs.push(0, i / 8, 1, i / 8);
      if (i > 0) {
        const a = vertexBase + (i - 1) * 2;
        const b = vertexBase + i * 2;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    vertexBase += samples.length * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function addContinuityPatches(group, heightAt) {
  const centers = getRoadContinuityPatches();
  if (!centers.length) return;
  const mat = material(0x44474d, { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const patches = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 16), mat, centers.length);
  patches.frustumCulled = false;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < centers.length; i++) {
    const node = centers[i];
    dummy.position.set(node.x, heightAt(node.x, node.z) + INTERSECTION_Y, node.z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(node.radius, node.radius, 1);
    dummy.updateMatrix();
    patches.setMatrixAt(i, dummy.matrix);
  }
  patches.receiveShadow = true;
  group.add(patches);
}

export function buildInhaumaRoadGraphAndTraffic(scene, heightAt) {
  const roads = getInhaumaRoads();
  const roadGroup = new THREE.Group();
  roadGroup.name = 'inhauma-road-graph';

  // Acostamento (terra clara) levemente mais largo, por baixo do asfalto.
  const shoulder = new THREE.Mesh(
    buildRibbonGeometry(roads, 3.5, SHOULDER_Y, heightAt),
    material(0x8a7d5f, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  );
  shoulder.receiveShadow = true;
  roadGroup.add(shoulder);

  // Asfalto por classe.
  for (let i = 0; i < ROAD_RENDER_LAYERS.length; i++) {
    const layer = ROAD_RENDER_LAYERS[i];
    const layerRoads = roads.filter((road) => road.kind === layer.key);
    if (!layerRoads.length) continue;
    const asphalt = new THREE.Mesh(
      buildRibbonGeometry(layerRoads, 0, layer.y, heightAt),
      material(layer.color, { polygonOffset: true, polygonOffsetFactor: -2 - i * 0.1, polygonOffsetUnits: -2 }),
    );
    asphalt.name = `inhauma-road-${layer.key}`;
    asphalt.receiveShadow = true;
    roadGroup.add(asphalt);
  }
  addRoadDetailProps(roadGroup, roads, heightAt, material);
  addContinuityPatches(roadGroup, heightAt);
  scene.add(roadGroup);

  return buildInhaumaTraffic(scene, roadGroup);
}

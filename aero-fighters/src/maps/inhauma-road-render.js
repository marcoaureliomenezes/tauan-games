import * as THREE from '../../../vendor/three.module.min.js';
import {
  getInhaumaRoads,
  getRoadContinuityPatches,
} from './inhauma-roads.js';
import { buildInhaumaTraffic } from './inhauma-traffic.js';
import { segmentLength } from './inhauma-road-utils.js';
import { addRoadDetailProps } from './inhauma-road-props.js';

const ROAD_SAMPLE_STEP = 24;
const ROAD_Y = 0.34;
const SHOULDER_Y = 0.22;
const INTERSECTION_Y = 0.38;
const ROAD_RENDER_LAYERS = [
  { key: 'service', color: 0x4f493d, y: ROAD_Y - 0.03 },
  { key: 'street', color: 0x46433e, y: ROAD_Y - 0.01 },
  { key: 'regional', color: 0x3a3834, y: ROAD_Y + 0.01 },
  { key: 'highway', color: 0x302f2d, y: ROAD_Y + 0.03 },
];

function material(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

function resampleRoad(road, heightAt) {
  const samples = [];
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i];
    const steps = Math.max(1, Math.ceil(segmentLength(a, b) / ROAD_SAMPLE_STEP));
    for (let s = 0; s < steps; s++) {
      if (i > 1 && s === 0) continue;
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      samples.push({ x, z, y: heightAt(x, z) });
    }
  }
  const last = road.points[road.points.length - 1];
  samples.push({ x: last.x, z: last.z, y: heightAt(last.x, last.z) });
  return samples;
}

function buildStripGeometry(roads, widthOffset, yOffset, heightAt) {
  const positions = [];
  const uvs = [];
  const indices = [];
  let vertexBase = 0;
  for (const road of roads) {
    const samples = resampleRoad(road, heightAt);
    const halfWidth = road.width * 0.5 + widthOffset;
    for (let i = 0; i < samples.length; i++) {
      const prev = samples[Math.max(0, i - 1)];
      const cur = samples[i];
      const next = samples[Math.min(samples.length - 1, i + 1)];
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = dz / len;
      const nz = -dx / len;
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
  const mat = material(0x3b3935, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const patches = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14), mat, centers.length);
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

  const shoulder = new THREE.Mesh(
    buildStripGeometry(roads, 5, SHOULDER_Y, heightAt),
    material(0x7a6f55, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  );
  shoulder.receiveShadow = true;
  roadGroup.add(shoulder);

  for (let i = 0; i < ROAD_RENDER_LAYERS.length; i++) {
    const layer = ROAD_RENDER_LAYERS[i];
    const layerRoads = roads.filter((road) => road.kind === layer.key);
    if (!layerRoads.length) continue;
    const asphalt = new THREE.Mesh(
      buildStripGeometry(layerRoads, 0, layer.y, heightAt),
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

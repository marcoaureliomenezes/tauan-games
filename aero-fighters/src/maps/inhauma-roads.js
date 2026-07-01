import { INHAUMA_OSM_ROAD_GRAPH } from './inhauma-data/roads.js';

export const INHAUMA_ROAD_GRAPH = INHAUMA_OSM_ROAD_GRAPH;

const ROAD_INDEX_CELL = 96;
const ROAD_BED_MARGIN = 18;
const MAX_INTERSECTION_PATCHES = 3200;

const _nodeById = new Map(INHAUMA_ROAD_GRAPH.nodes.map((n) => [n.id, n]));
const _roadById = new Map();
let _adjacency = null;
let _segmentIndex = null;
let _segmentIndexStats = null;
let _intersectionStats = null;
let _roadsByNode = null;
const _closest = { distance: Infinity, x: 0, z: 0, road: null };

function roadKind(edge) {
  if (edge.kind === 'motorway' || edge.kind === 'trunk' || edge.kind === 'primary') return 'highway';
  if (edge.kind === 'secondary' || edge.kind === 'tertiary') return 'regional';
  if (edge.kind === 'service' || edge.kind === 'track') return 'service';
  return 'street';
}

export function getInhaumaRoads() {
  if (_roadById.size === 0) {
    for (const edge of INHAUMA_ROAD_GRAPH.edges) {
      const points = edge.nodes.map((id) => {
        const n = _nodeById.get(id);
        return { x: n.x, z: n.z };
      }).filter(Boolean);
      if (points.length < 2) continue;
      _roadById.set(edge.id, {
        id: edge.id,
        kind: roadKind(edge),
        sourceKind: edge.kind,
        ref: edge.ref,
        name: edge.name,
        osmId: edge.osmId,
        w: edge.width,
        width: edge.width,
        lanes: edge.lanes,
        points,
      });
    }
  }
  return [..._roadById.values()];
}

export const INHAUMA_ROADS = getInhaumaRoads();

function indexKey(cx, cz) { return `${cx},${cz}`; }

function cellCoord(v) { return Math.floor(v / ROAD_INDEX_CELL); }

function addSegmentToIndex(index, segment) {
  const minX = Math.min(segment.ax, segment.bx) - segment.radius;
  const maxX = Math.max(segment.ax, segment.bx) + segment.radius;
  const minZ = Math.min(segment.az, segment.bz) - segment.radius;
  const maxZ = Math.max(segment.az, segment.bz) + segment.radius;
  for (let cx = cellCoord(minX); cx <= cellCoord(maxX); cx++) {
    for (let cz = cellCoord(minZ); cz <= cellCoord(maxZ); cz++) {
      const key = indexKey(cx, cz);
      let bucket = index.get(key);
      if (!bucket) {
        bucket = [];
        index.set(key, bucket);
      }
      bucket.push(segment);
    }
  }
}

function buildSegmentIndex() {
  if (_segmentIndex) return _segmentIndex;
  const index = new Map();
  let segmentCount = 0;
  for (const road of INHAUMA_ROADS) {
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1];
      const b = road.points[i];
      if (a.x === b.x && a.z === b.z) continue;
      addSegmentToIndex(index, {
        road,
        ax: a.x,
        az: a.z,
        bx: b.x,
        bz: b.z,
        radius: road.width * 0.5 + ROAD_BED_MARGIN,
      });
      segmentCount++;
    }
  }
  _segmentIndex = index;
  _segmentIndexStats = { cellSize: ROAD_INDEX_CELL, bucketCount: index.size, segmentCount, margin: ROAD_BED_MARGIN };
  return index;
}

function closestRoadSegment(x, z, margin = 0) {
  const index = buildSegmentIndex();
  const cx = cellCoord(x);
  const cz = cellCoord(z);
  const span = Math.max(1, Math.ceil((margin + 28) / ROAD_INDEX_CELL));
  let bestDistSq = Infinity;
  let bestX = x;
  let bestZ = z;
  let bestRoad = null;
  for (let ix = cx - span; ix <= cx + span; ix++) {
    for (let iz = cz - span; iz <= cz + span; iz++) {
      const bucket = index.get(indexKey(ix, iz));
      if (!bucket) continue;
      for (const seg of bucket) {
        const dx = seg.bx - seg.ax;
        const dz = seg.bz - seg.az;
        const lenSq = dx * dx + dz * dz;
        const t = lenSq > 0 ? Math.max(0, Math.min(1, ((x - seg.ax) * dx + (z - seg.az) * dz) / lenSq)) : 0;
        const px = seg.ax + dx * t;
        const pz = seg.az + dz * t;
        const rx = x - px;
        const rz = z - pz;
        const distSq = rx * rx + rz * rz;
        const limit = seg.road.width * 0.5 + margin;
        if (distSq <= limit * limit && distSq < bestDistSq) {
          bestDistSq = distSq;
          bestX = px;
          bestZ = pz;
          bestRoad = seg.road;
        }
      }
    }
  }
  _closest.distance = Math.sqrt(bestDistSq);
  _closest.x = bestX;
  _closest.z = bestZ;
  _closest.road = bestRoad;
  return bestRoad ? _closest : null;
}

function buildAdjacency() {
  if (_adjacency) return _adjacency;
  const adjacency = new Map(INHAUMA_ROAD_GRAPH.nodes.map((n) => [n.id, new Set()]));
  for (const edge of INHAUMA_ROAD_GRAPH.edges) {
    for (let i = 1; i < edge.nodes.length; i++) {
      adjacency.get(edge.nodes[i - 1]).add(edge.nodes[i]);
      adjacency.get(edge.nodes[i]).add(edge.nodes[i - 1]);
    }
  }
  _adjacency = adjacency;
  return adjacency;
}

function buildRoadsByNode() {
  if (_roadsByNode) return _roadsByNode;
  const roadsById = new Map(INHAUMA_ROADS.map((road) => [road.id, road]));
  const byNode = new Map();
  for (const edge of INHAUMA_ROAD_GRAPH.edges) {
    const road = roadsById.get(edge.id);
    if (!road) continue;
    for (const nodeId of edge.nodes) {
      let roads = byNode.get(nodeId);
      if (!roads) {
        roads = [];
        byNode.set(nodeId, roads);
      }
      roads.push(road);
    }
  }
  _roadsByNode = byNode;
  return byNode;
}

export function getRoadContinuityPatches() {
  if (_intersectionStats?.patches) {
    getRoadContinuityPatches.stats = _intersectionStats;
    return _intersectionStats.patches;
  }
  const adjacency = buildAdjacency();
  const roadsByNode = buildRoadsByNode();
  const candidates = [];
  const degreeBuckets = {};
  let seamCandidateCount = 0;
  let trueIntersectionCount = 0;
  for (const node of INHAUMA_ROAD_GRAPH.nodes) {
    const degree = adjacency.get(node.id)?.size ?? 0;
    const roads = roadsByNode.get(node.id) || [];
    const uniqueRoadCount = new Set(roads.map((road) => road.id)).size;
    const isTrueIntersection = degree >= 3;
    const isRoadSeam = degree === 2 && uniqueRoadCount > 1;
    if (!isTrueIntersection && !isRoadSeam) continue;
    const maxWidth = roads.reduce((max, road) => Math.max(max, road.width), 8);
    const radius = isTrueIntersection
      ? Math.max(14, Math.min(38, maxWidth * (degree >= 5 ? 1.7 : 1.35)))
      : Math.max(9, Math.min(22, maxWidth * 1.05));
    candidates.push({
      id: node.id,
      x: node.x,
      z: node.z,
      degree,
      radius,
      maxWidth,
      type: isTrueIntersection ? 'intersection' : 'seam',
    });
    if (isTrueIntersection) trueIntersectionCount++;
    else seamCandidateCount++;
    degreeBuckets[degree] = (degreeBuckets[degree] || 0) + 1;
  }
  candidates.sort((a, b) => (b.degree - a.degree) || (b.maxWidth - a.maxWidth) || (a.id < b.id ? -1 : 1));
  const patches = candidates.slice(0, MAX_INTERSECTION_PATCHES);
  _intersectionStats = {
    candidateCount: candidates.length,
    renderedCount: patches.length,
    omittedCount: Math.max(0, candidates.length - patches.length),
    coverageRatio: candidates.length ? Math.round((patches.length / candidates.length) * 1000) / 1000 : 1,
    patchLimit: MAX_INTERSECTION_PATCHES,
    trueIntersectionCount,
    seamCandidateCount,
    degreeBuckets,
    patches,
  };
  getRoadContinuityPatches.stats = _intersectionStats;
  return patches;
}

export function getRoadBedDiagnostics() {
  buildSegmentIndex();
  return { ..._segmentIndexStats };
}

export function nearAnyRoad(x, z, margin = 0) {
  return closestRoadSegment(x, z, margin) !== null;
}

export function roadBedInfoAt(x, z, margin = ROAD_BED_MARGIN) {
  return closestRoadSegment(x, z, margin);
}

export function applyInhaumaRoadBed(x, z, height, baseHeightAt) {
  const hit = roadBedInfoAt(x, z, ROAD_BED_MARGIN);
  if (!hit) return height;
  const half = hit.road.width * 0.5;
  const fadeEnd = half + ROAD_BED_MARGIN;
  if (hit.distance >= fadeEnd) return height;
  const centerHeight = baseHeightAt(hit.x, hit.z);
  const shoulderT = hit.distance <= half ? 1 : 1 - ((hit.distance - half) / ROAD_BED_MARGIN);
  const k = shoulderT * shoulderT * (3 - 2 * shoulderT);
  const target = Math.max(0, centerHeight - (hit.road.kind === 'highway' ? 0.35 : 0.18));
  return height * (1 - k) + target * k;
}

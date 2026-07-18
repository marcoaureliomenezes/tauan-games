// maps/inhauma-roads.js — Fonte de estradas do mapa Inhaúma (v0.2.0 course-correction).
//
// ANTES: importava o dump OSM (2169 vias) → spiderweb preto. AGORA: constrói poucas
// estradas contínuas a partir de inhauma-road-defs.js (splines Catmull-Rom autorais)
// MAIS (T-V-16, inhauma-visual-uplift-v1) um reimport seletivo e CURADO do OSM —
// inhauma-osm-roads.js, vendorizado offline por tools/extract-osm-roads.mjs: só
// corredores maiores limpos (motorway/trunk/primary/secondary), nunca a teia.
// A API pública é a MESMA de antes (INHAUMA_ROADS, nearAnyRoad, applyInhaumaRoadBed,
// road-bed carve, INHAUMA_ROAD_GRAPH, continuity patches, diagnostics) — assim
// terreno, cidade, floresta, alvos, tráfego e render continuam funcionando.
// Sem THREE aqui: mantém importável no Node (validador/sim).

import { buildRoadsFromDefs, buildNamedRoutes } from './inhauma-road-defs.js';
import { INHAUMA_OSM_MAJOR_CORRIDORS } from './inhauma-osm-roads.js';

const ROAD_INDEX_CELL = 96;
const ROAD_BED_MARGIN = 18;
const INTERSECTION_MERGE_DIST = 26; // m — cruzamentos mais próximos que isso viram um patch só

const OSM_LANES_BY_KIND = { highway: 2, regional: 2, street: 1 };

// T-V-16: corredores OSM vendorizados → mesma forma de objeto de estrada dos
// corredores autorais (buildRoadsFromDefs). Polilinha JÁ densa (≤20 m) — sem spline.
function buildOsmRoads() {
  return INHAUMA_OSM_MAJOR_CORRIDORS.map((c) => ({
    id: c.id,
    kind: c.kind,
    sourceKind: c.kind,
    ref: c.ref,
    name: c.name,
    osmId: c.ref,
    w: c.width,
    width: c.width,
    lanes: OSM_LANES_BY_KIND[c.kind] ?? 2,
    closed: false,
    endcap: null,
    startcap: null,
    dual: false,
    points: c.points,
  }));
}

// ── Estradas (poucas, contínuas) ──────────────────────────────────────────────
export const INHAUMA_ROADS = [...buildRoadsFromDefs(), ...buildOsmRoads()];

export function getInhaumaRoads() {
  return INHAUMA_ROADS;
}

// Rotas nomeadas (placas de rodovia) — reusam as próprias polilinhas das estradas
// (autorais + OSM, T-V-16).
export const INHAUMA_NAMED_ROUTES = {
  ...buildNamedRoutes(),
  ...Object.fromEntries(INHAUMA_OSM_MAJOR_CORRIDORS.map((c) => [c.id, c.points])),
};

// Grafo sintético (nós = pontos das polilinhas, arestas = 1 por estrada) para os
// diagnósticos e o render de adjacência. Não é mais um grafo OSM gigante.
export const INHAUMA_ROAD_GRAPH = (() => {
  const nodes = [];
  const edges = [];
  for (const road of INHAUMA_ROADS) {
    const nodeIds = road.points.map((p, i) => {
      const id = `${road.id}:${i}`;
      nodes.push({ id, x: p.x, z: p.z });
      return id;
    });
    edges.push({ id: road.id, kind: road.kind, width: road.width, ref: road.ref, name: road.name, nodes: nodeIds });
  }
  return { nodes, edges };
})();

// ── Índice espacial dos segmentos (carve de terreno + nearAnyRoad) ────────────
let _segmentIndex = null;
let _segmentIndexStats = null;
let _intersectionStats = null;
const _closest = { distance: Infinity, x: 0, z: 0, road: null };

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
      if (!bucket) { bucket = []; index.set(key, bucket); }
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
        road, ax: a.x, az: a.z, bx: b.x, bz: b.z,
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
  let bestX = x, bestZ = z, bestRoad = null;
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
        const rx = x - px, rz = z - pz;
        const distSq = rx * rx + rz * rz;
        const limit = seg.road.width * 0.5 + margin;
        if (distSq <= limit * limit && distSq < bestDistSq) {
          bestDistSq = distSq; bestX = px; bestZ = pz; bestRoad = seg.road;
        }
      }
    }
  }
  _closest.distance = Math.sqrt(bestDistSq);
  _closest.x = bestX; _closest.z = bestZ; _closest.road = bestRoad;
  return bestRoad ? _closest : null;
}

export function nearAnyRoad(x, z, margin = 0) {
  return closestRoadSegment(x, z, margin) !== null;
}

export function roadBedInfoAt(x, z, margin = ROAD_BED_MARGIN) {
  return closestRoadSegment(x, z, margin);
}

/** Assenta o terreno na faixa da estrada (evita fita flutuando sobre morro). */
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

export function getRoadBedDiagnostics() {
  buildSegmentIndex();
  return { ..._segmentIndexStats };
}

// ── Patches de continuidade nos cruzamentos reais entre estradas ──────────────
// Com poucas estradas, calculamos os cruzamentos de verdade (segmentos de estradas
// diferentes que se aproximam) e fundimos em poucos discos.
function computeIntersections() {
  const raw = [];
  for (let a = 0; a < INHAUMA_ROADS.length; a++) {
    for (let b = a + 1; b < INHAUMA_ROADS.length; b++) {
      const ra = INHAUMA_ROADS[a], rb = INHAUMA_ROADS[b];
      const thresh = (ra.width + rb.width) * 0.5;
      for (let i = 0; i < ra.points.length; i += 2) {
        const pa = ra.points[i];
        for (let j = 0; j < rb.points.length; j += 2) {
          const pb = rb.points[j];
          const d = Math.hypot(pa.x - pb.x, pa.z - pb.z);
          if (d <= thresh) {
            raw.push({ x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2, maxWidth: Math.max(ra.width, rb.width) });
          }
        }
      }
    }
  }
  // Funde pontos próximos num só patch.
  const merged = [];
  for (const p of raw) {
    const near = merged.find((m) => Math.hypot(m.x - p.x, m.z - p.z) < INTERSECTION_MERGE_DIST);
    if (near) { near.maxWidth = Math.max(near.maxWidth, p.maxWidth); continue; }
    merged.push({ ...p });
  }
  return merged.map((m, i) => ({
    id: `xr-${i}`, x: m.x, z: m.z, degree: 4,
    radius: Math.max(9, Math.min(20, m.maxWidth * 1.15)),
    maxWidth: m.maxWidth, type: 'intersection',
  }));
}

export function getRoadContinuityPatches() {
  if (_intersectionStats?.patches) {
    getRoadContinuityPatches.stats = _intersectionStats;
    return _intersectionStats.patches;
  }
  const patches = computeIntersections();
  _intersectionStats = {
    candidateCount: patches.length,
    renderedCount: patches.length,
    omittedCount: 0,
    coverageRatio: 1,
    patchLimit: patches.length,
    trueIntersectionCount: patches.length,
    seamCandidateCount: 0,
    degreeBuckets: { 4: patches.length },
    patches,
  };
  getRoadContinuityPatches.stats = _intersectionStats;
  return patches;
}

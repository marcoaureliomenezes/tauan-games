import { INHAUMA_WEB_MAP_METADATA } from './inhauma-data/metadata.js';
import { INHAUMA_OSM_NAMED_ROUTES } from './inhauma-data/roads.js';
import {
  getInhaumaRoads,
  getRoadBedDiagnostics,
  getRoadContinuityPatches,
  INHAUMA_ROAD_GRAPH,
  INHAUMA_ROADS,
} from './inhauma-roads.js';
import { INHAUMA_AIRPORT_EXCLUSION_ZONES } from './inhauma-road-airport.js';
import { routeLength, segmentLength } from './inhauma-road-utils.js';
import { createTrafficRoutes } from './inhauma-traffic.js';
import { getRoadRenderDetailDiagnostics } from './inhauma-road-props.js';

const ROAD_RENDER_LAYERS = [
  { key: 'service', dashed: false },
  { key: 'street', dashed: false },
  { key: 'regional', dashed: true },
  { key: 'highway', dashed: true },
];

function buildAdjacency() {
  const adjacency = new Map(INHAUMA_ROAD_GRAPH.nodes.map((n) => [n.id, new Set()]));
  for (const edge of INHAUMA_ROAD_GRAPH.edges) {
    for (let i = 1; i < edge.nodes.length; i++) {
      adjacency.get(edge.nodes[i - 1]).add(edge.nodes[i]);
      adjacency.get(edge.nodes[i]).add(edge.nodes[i - 1]);
    }
  }
  return adjacency;
}

function getIntersectionDiagnostics() {
  getRoadContinuityPatches();
  const { patches, ...stats } = getRoadContinuityPatches.stats;
  return stats;
}

function getRoadGeometryDiagnostics(heightAt = null) {
  const lengths = [];
  const heightDeltas = [];
  let zeroLengthSegments = 0;
  let maxAdjacentHeightDelta = 0;
  let heightSampleCount = 0;
  const byClass = {};
  for (const road of INHAUMA_ROADS) {
    const klass = byClass[road.kind] || { roadCount: 0, segmentCount: 0, length: 0 };
    klass.roadCount++;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1];
      const b = road.points[i];
      const len = segmentLength(a, b);
      if (len <= 0) {
        zeroLengthSegments++;
        continue;
      }
      lengths.push(len);
      klass.segmentCount++;
      klass.length += len;
      if (heightAt) sampleRoadHeightDeltas(a, b, len, heightAt, heightDeltas, (delta) => {
        maxAdjacentHeightDelta = Math.max(maxAdjacentHeightDelta, delta);
        heightSampleCount++;
      });
    }
    byClass[road.kind] = klass;
  }
  lengths.sort((a, b) => a - b);
  heightDeltas.sort((a, b) => a - b);
  const percentile = (items, p) => items.length ? items[Math.floor((items.length - 1) * p)] : 0;
  return {
    segmentCount: lengths.length,
    zeroLengthSegments,
    maxSegmentLength: Math.round(percentile(lengths, 1) * 10) / 10,
    p95SegmentLength: Math.round(percentile(lengths, 0.95) * 10) / 10,
    p99SegmentLength: Math.round(percentile(lengths, 0.99) * 10) / 10,
    over120mSegments: lengths.filter((len) => len > 120).length,
    byClass: Object.fromEntries(Object.entries(byClass).map(([key, value]) => [key, {
      roadCount: value.roadCount,
      segmentCount: value.segmentCount,
      length: Math.round(value.length),
    }])),
    roadBedSmoothness: heightAt ? {
      sampleCount: heightSampleCount,
      maxAdjacentHeightDelta: Math.round(maxAdjacentHeightDelta * 100) / 100,
      p95AdjacentHeightDelta: Math.round(percentile(heightDeltas, 0.95) * 100) / 100,
      p99AdjacentHeightDelta: Math.round(percentile(heightDeltas, 0.99) * 100) / 100,
    } : null,
  };
}

function sampleRoadHeightDeltas(a, b, len, heightAt, heightDeltas, onDelta) {
  const steps = Math.max(1, Math.ceil(len / 30));
  let prevH = null;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    const h = heightAt(x, z);
    if (prevH !== null) {
      const delta = Math.abs(h - prevH);
      heightDeltas.push(delta);
      onDelta(delta);
    }
    prevH = h;
  }
}

function getRouteDiagnostics() {
  return createTrafficRoutes().map((route) => ({
    id: route.id,
    length: Math.round(routeLength(route.points)),
    width: route.width,
    graphEdgeCount: route.graphEdgeCount || 0,
    classRank: route.classRank || 0,
  }));
}

function getComponents(adjacency) {
  const seen = new Set();
  const components = [];
  for (const node of INHAUMA_ROAD_GRAPH.nodes) {
    if (seen.has(node.id)) continue;
    const stack = [node.id];
    const component = [];
    seen.add(node.id);
    while (stack.length) {
      const id = stack.pop();
      component.push(id);
      for (const next of adjacency.get(id)) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    components.push(component);
  }
  return components.sort((a, b) => b.length - a.length);
}

export function getRoadGraphDiagnostics(heightAt = null) {
  const adjacency = buildAdjacency();
  const components = getComponents(adjacency);
  const edgesByKind = {};
  for (const edge of INHAUMA_ROAD_GRAPH.edges) {
    edgesByKind[edge.kind] = (edgesByKind[edge.kind] || 0) + 1;
  }
  const renderClasses = {};
  for (const road of INHAUMA_ROADS) {
    renderClasses[road.kind] = (renderClasses[road.kind] || 0) + 1;
  }
  return {
    source: INHAUMA_WEB_MAP_METADATA.source,
    inputSha256: INHAUMA_WEB_MAP_METADATA.inputSha256,
    generatedAt: INHAUMA_WEB_MAP_METADATA.generatedAt,
    projection: {
      origin: INHAUMA_WEB_MAP_METADATA.origin,
      worldScale: INHAUMA_WEB_MAP_METADATA.worldScale,
      axis: INHAUMA_WEB_MAP_METADATA.axis,
    },
    nodeCount: INHAUMA_ROAD_GRAPH.nodes.length,
    edgeCount: INHAUMA_ROAD_GRAPH.edges.length,
    rawRoadFeatureCount: INHAUMA_WEB_MAP_METADATA.rawRoadFeatureCount,
    airportClippedSegmentCount: INHAUMA_WEB_MAP_METADATA.airportClippedSegmentCount,
    airportExclusionZones: INHAUMA_AIRPORT_EXCLUSION_ZONES.map((zone) => ({ ...zone })),
    edgesByKind,
    renderClasses,
    renderLayers: ROAD_RENDER_LAYERS,
    renderDetails: getRoadRenderDetailDiagnostics(),
    intersections: getIntersectionDiagnostics(),
    geometry: getRoadGeometryDiagnostics(heightAt),
    componentCount: components.length,
    largestComponentNodeCount: components[0]?.length ?? 0,
    components: components.slice(0, 12).map((nodes) => ({ nodeCount: nodes.length, nodes: nodes.slice(0, 24) })),
    namedRoutes: Object.fromEntries(Object.entries(INHAUMA_OSM_NAMED_ROUTES).map(([id, points]) => [id, { pointCount: points.length }])),
    roadBed: getRoadBedDiagnostics(),
    routes: getRouteDiagnostics(),
  };
}

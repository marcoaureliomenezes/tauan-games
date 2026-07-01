import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { materializeLayout, validateMap, validateTargets, desertHeightAt, rioHeightAt, inhaumaHeightAt, MAP_VALIDATION_DEFS } from '../../../aero-fighters/src/map-validation.js';
import { INHAUMA_ROADS } from '../../../aero-fighters/src/maps/inhauma-roads.js';
import { getRoadGraphDiagnostics } from '../../../aero-fighters/src/maps/inhauma-road-diagnostics.js';
import { INHAUMA_WEB_MAP_METADATA } from '../../../aero-fighters/src/maps/inhauma-data/metadata.js';
import { inhaumaContinuousHeight } from '../../../aero-fighters/src/maps/inhauma-scene.js';
import { invalidMapCases } from '../fixtures/invalid-map-cases.js';

function cloneTargets(targets) {
  return targets.map((t) => ({ ...t, region: t.region ? { ...t.region } : t.region }));
}

function formatError(error) {
  const target = error.target ?? error.a;
  const coord = target ? ` target=${target.id}:${target.type} (${target.x}, ${target.y}, ${target.z})` : '';
  return `${error.code}: ${error.message}${coord}`;
}

// ─── Airport geometry constants (mirrors airport.js, no THREE dependency) ───
const AIRPORT_FOOTPRINTS = {
  desert: {
    elevation: 0,
    runway:      { cx: -160, cz: 120,  halfW: 29, halfL: 380 },
    taxiway:     { cx: -160, cz: 260,  halfW: 17, halfL: 90  },
    serviceZone: { cx: -160, cz: 350,  halfW: 35, halfL: 43  },
  },
  inhauma: {
    elevation: 0,
    runway:      { cx: -560, cz: 320, halfW: 26, halfL: 310 },
    taxiway:     { cx: -560, cz: 430, halfW: 15, halfL: 80  },
    serviceZone: { cx: -560, cz: 475, halfW: 42, halfL: 38  },
  },
};

function inAirportRect(x, z, rect) {
  return Math.abs(x - rect.cx) <= rect.halfW && Math.abs(z - rect.cz) <= rect.halfL;
}

function isOnAirportSurface(mapId, x, z) {
  const footprint = AIRPORT_FOOTPRINTS[mapId];
  if (!footprint) return false;
  return inAirportRect(x, z, footprint.runway) ||
    inAirportRect(x, z, footprint.taxiway) ||
    inAirportRect(x, z, footprint.serviceZone);
}

// ─── Runway-obstacle sweep ────────────────────────────────────────────────────
// For each map, sample heightAt over the full airport footprint at 1 m resolution.
// Every sample must equal desertAirport.elevation (0). Failure = RUNWAY_NOT_FLAT.

function buildHeightFnForMap(mapId) {
  const def = MAP_VALIDATION_DEFS[mapId];
  if (!def) return null;
  return function heightAt(x, z) {
    let maxH = 0;
    for (const region of def.regions) {
      const dx = x - region.cx;
      const dz = z - region.cz;
      if (mapId === 'desert') {
        const h = desertHeightAt(region, dx, dz);
        if (h > maxH) maxH = h;
      } else if (mapId === 'rio') {
        const h = rioHeightAt(region, dx, dz);
        if (h > maxH) maxH = h;
      } else if (mapId === 'inhauma') {
        const h = inhaumaHeightAt(region, dx, dz);
        if (h > maxH) maxH = h;
      }
    }
    return maxH;
  };
}

function runwayObstacleSweep(mapId) {
  const heightAt = buildHeightFnForMap(mapId);
  if (!heightAt) return [];
  const errors = [];
  const footprint = AIRPORT_FOOTPRINTS[mapId];
  if (!footprint) return [];
  const { runway, taxiway, serviceZone, elevation } = footprint;
  const zones = [runway, taxiway, serviceZone];
  for (const zone of zones) {
    const xMin = zone.cx - zone.halfW;
    const xMax = zone.cx + zone.halfW;
    const zMin = zone.cz - zone.halfL;
    const zMax = zone.cz + zone.halfL;
    for (let x = xMin; x <= xMax; x += 1) {
      for (let z = zMin; z <= zMax; z += 1) {
        const h = heightAt(x, z);
        if (h > elevation) {
          errors.push({ code: 'RUNWAY_NOT_FLAT', target: `runway:${mapId}`, x, z, height: h });
        }
      }
    }
  }
  return errors;
}

function roadAirportSurfaceConflicts() {
  const conflicts = [];
  for (const road of INHAUMA_ROADS) {
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1];
      const b = road.points[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const steps = Math.max(1, Math.ceil(len / 10));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        const zone = INHAUMA_WEB_MAP_METADATA.airportExclusionZones.find((candidate) => inAirportRect(x, z, candidate));
        if (zone) {
          conflicts.push({ road: road.id, zone: zone.id, x, z });
          break;
        }
      }
    }
  }
  return conflicts;
}

function collectJsFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) collectJsFiles(full, out);
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

function staleRoadAuthorityMatches() {
  const mapsDir = path.join(process.cwd(), 'aero-fighters', 'src', 'maps');
  const forbidden = [
    { token: 'INHAUMA_ROAD_DEFS', code: 'ROAD_STALE_INHAUMA_ROAD_DEFS' },
    { token: 'buildRoadsAndCars', code: 'ROAD_STALE_BUILD_ROADS_AND_CARS' },
  ];
  const matches = [];
  for (const file of collectJsFiles(mapsDir)) {
    const rel = path.relative(process.cwd(), file);
    const text = readFileSync(file, 'utf8');
    for (const item of forbidden) {
      if (text.includes(item.token)) matches.push(`${item.code}: ${rel}`);
    }
  }
  return matches;
}

function validateInhaumaRoadGraph() {
  // v0.2.0 course-correction contract: FEW continuous authored spline roads with
  // circulating traffic — NOT the 2169-edge OSM spiderweb. (Prior thresholds enforced
  // the dump: edgeCount>=500, nodeCount>=10000, intersections>=2500. Replaced.)
  const errors = [];
  const diag = getRoadGraphDiagnostics(inhaumaContinuousHeight);
  errors.push(...staleRoadAuthorityMatches());

  if (diag.source !== 'inhauma-authored-continuous-v2') {
    errors.push(`ROAD_SOURCE: expected authored splines, got ${diag.source}`);
  }
  if (diag.edgeCount !== INHAUMA_ROADS.length) {
    errors.push(`ROAD_EDGE_COUNT: diagnostics edgeCount=${diag.edgeCount} roads=${INHAUMA_ROADS.length}`);
  }
  if (INHAUMA_ROADS.length < 3 || INHAUMA_ROADS.length > 12) {
    errors.push(`ROAD_COUNT_OUT_OF_RANGE: ${INHAUMA_ROADS.length} (want 3..12 continuous roads)`);
  }
  // Anti-spiderweb guard: the whole network is a few hundred points, not ~18k.
  const totalPoints = INHAUMA_ROADS.reduce((sum, road) => sum + road.points.length, 0);
  if (totalPoints > 2000) errors.push(`ROAD_TOTAL_POINTS_HIGH (spiderweb?): ${totalPoints}`);

  // Airport exclusion metadata still present + consistent.
  if ((INHAUMA_WEB_MAP_METADATA.airportExclusionZones?.length ?? 0) < 5) {
    errors.push(`ROAD_AIRPORT_EXCLUSION_ZONES_LOW: ${INHAUMA_WEB_MAP_METADATA.airportExclusionZones?.length ?? 0}`);
  }
  if (JSON.stringify(diag.airportExclusionZones) !== JSON.stringify(INHAUMA_WEB_MAP_METADATA.airportExclusionZones)) {
    errors.push('ROAD_AIRPORT_EXCLUSION_METADATA_DRIFT');
  }

  // Named spine route present + continuous; traffic runs a route per road.
  if ((diag.namedRoutes?.['mg-238']?.pointCount ?? 0) < 30) errors.push('ROAD_MG238_ROUTE_MISSING');
  if ((diag.routes?.length ?? 0) < 3) errors.push(`ROAD_ROUTE_COUNT_LOW: ${diag.routes?.length ?? 0}`);
  if (!diag.routes?.some((route) => (route.classRank || 0) >= 3)) {
    errors.push('ROAD_TRAFFIC_ROUTE_CLASS_RANK_MISSING');
  }

  // Road classes for material variety + basic road furniture / signage.
  for (const key of ['highway', 'regional', 'street']) {
    if ((diag.renderClasses?.[key] ?? 0) <= 0) errors.push(`ROAD_RENDER_CLASS_MISSING: ${key}`);
  }
  if ((diag.renderDetails?.routeLabelSignCount ?? 0) < 4) errors.push(`ROAD_LABEL_SIGNS_LOW: ${diag.renderDetails?.routeLabelSignCount ?? 0}`);

  // A HANDFUL of intersections — not thousands of OSM junction patches.
  if ((diag.intersections?.candidateCount ?? Infinity) > 20) {
    errors.push(`ROAD_INTERSECTIONS_TOO_MANY (spiderweb?): ${diag.intersections?.candidateCount}`);
  }
  if (diag.intersections?.renderedCount !== diag.intersections?.candidateCount) {
    errors.push(`ROAD_INTERSECTION_COVERAGE_PARTIAL: ${diag.intersections?.renderedCount}/${diag.intersections?.candidateCount}`);
  }

  // Road-bed spatial index built (used by terrain carve + nearAnyRoad).
  if (!diag.roadBed || diag.roadBed.segmentCount <= diag.edgeCount) {
    errors.push(`ROAD_BED_INDEX_INVALID: ${JSON.stringify(diag.roadBed ?? null)}`);
  }
  if ((diag.roadBed?.bucketCount ?? 0) < 20) errors.push(`ROAD_BED_BUCKET_COUNT_LOW: ${diag.roadBed?.bucketCount ?? 0}`);

  // Clean geometry that follows the terrain smoothly (no cliffs / water dives).
  if (!diag.geometry || diag.geometry.zeroLengthSegments !== 0) {
    errors.push(`ROAD_GEOMETRY_ZERO_SEGMENTS: ${diag.geometry?.zeroLengthSegments ?? 'missing'}`);
  }
  if ((diag.geometry?.maxSegmentLength ?? Infinity) > 30) errors.push(`ROAD_GEOMETRY_MAX_TOO_LONG: ${diag.geometry?.maxSegmentLength}`);
  const smoothness = diag.geometry?.roadBedSmoothness;
  if (!smoothness || smoothness.sampleCount < 100) {
    errors.push(`ROAD_BED_SMOOTHNESS_MISSING: ${JSON.stringify(smoothness ?? null)}`);
  } else if (smoothness.p99AdjacentHeightDelta > 8) {
    errors.push(`ROAD_BED_P99_TOO_STEEP: ${smoothness.p99AdjacentHeightDelta}`);
  }

  for (const road of INHAUMA_ROADS) {
    if (!Number.isFinite(road.width) || road.width <= 0) errors.push(`ROAD_WIDTH_INVALID: ${road.id}`);
    if (!Array.isArray(road.points) || road.points.length < 10) errors.push(`ROAD_POINTS_INVALID: ${road.id}`);
    for (const p of road.points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) errors.push(`ROAD_POINT_NONFINITE: ${road.id}`);
    }
  }

  const airportConflicts = roadAirportSurfaceConflicts();
  if (airportConflicts.length) {
    const first = airportConflicts[0];
    errors.push(`ROAD_AIRPORT_CONFLICT: ${airportConflicts.length} samples, first=${first.road} ${first.zone} (${first.x.toFixed(1)},${first.z.toFixed(1)})`);
  }
  return { errors, diag };
}

let failed = false;

for (const mapId of ['rio', 'desert', 'inhauma']) {
  const errors = validateMap(mapId);
  if (errors.length) {
    failed = true;
    console.error(`\n${mapId} validation failed:`);
    for (const error of errors) console.error(`  - ${formatError(error)}`);
  } else {
    console.log(`${mapId}: OK`);
  }
}

// ─── Runway-obstacle sweep for each map ──────────────────────────────────────
for (const mapId of ['rio', 'desert', 'inhauma']) {
  const sweepErrors = runwayObstacleSweep(mapId);
  if (sweepErrors.length) {
    failed = true;
    console.error(`\n${mapId} runway-obstacle sweep FAILED (${sweepErrors.length} samples above elevation):`);
    // Print first 5 samples to avoid flooding output
    for (const err of sweepErrors.slice(0, 5)) {
      console.error(`  - RUNWAY_NOT_FLAT target=${err.target} x=${err.x} z=${err.z} height=${err.height.toFixed(3)}`);
    }
    if (sweepErrors.length > 5) console.error(`  ... and ${sweepErrors.length - 5} more`);
  } else {
    console.log(`${mapId} runway-obstacle sweep: OK`);
  }
}

for (const fixture of invalidMapCases) {
  const targets = cloneTargets(materializeLayout(fixture.mapId));
  fixture.mutate(targets);
  const errors = validateTargets(fixture.mapId, targets);
  if (!errors.some((error) => error.code === fixture.expectedCode)) {
    failed = true;
    console.error(`\nInvalid fixture did not fail as expected: ${fixture.name}`);
    console.error(`Expected: ${fixture.expectedCode}`);
    console.error(`Actual: ${errors.map((e) => e.code).join(', ') || '(none)'}`);
  }
}

const roadGraphResult = validateInhaumaRoadGraph();
if (roadGraphResult.errors.length) {
  failed = true;
  console.error('\ninhauma road graph validation failed:');
  for (const error of roadGraphResult.errors) console.error(`  - ${error}`);
} else {
  const d = roadGraphResult.diag;
  console.log(`inhauma road graph: OK (${d.edgeCount} edges, ${d.nodeCount} nodes, largest=${d.largestComponentNodeCount}, clipped=${d.airportClippedSegmentCount}, roadbed=${d.roadBed.segmentCount} segments)`);
}

if (failed) process.exit(1);
console.log('invalid fixtures: OK');

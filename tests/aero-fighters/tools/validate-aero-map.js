import { materializeLayout, validateMap, validateTargets, desertHeightAt, rioHeightAt, inhaumaHeightAt, MAP_VALIDATION_DEFS } from '../../../aero-fighters/src/map-validation.js';
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

if (failed) process.exit(1);
console.log('invalid fixtures: OK');

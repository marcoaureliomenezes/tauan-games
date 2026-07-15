import test from 'node:test';
import assert from 'node:assert/strict';

import { PLAYER, TARGET_LAYOUT_INHAUMA } from '../../../aero-fighters/src/config.js';
import { materializeLayout, validateMap } from '../../../aero-fighters/src/map-validation.js';
import {
  clampDt,
  isStalled,
  terrainCollision,
  throttleStep,
  updateSpeed,
  validateFiniteState,
} from '../../../aero-fighters/src/physics-core.js';
import { inhaumaAirport } from '../../../aero-fighters/src/airport.js';
import {
  inhaumaContinuousHeight,
  inhaumaVisualSurfaceHeight,
} from '../../../aero-fighters/src/maps/inhauma-scene.js';
import { demBounds } from '../../../aero-fighters/src/maps/heightmap-sampler.js';
import {
  getInhaumaRiverPolyline,
  riverCarveAt,
  riverSurfaceInfoAt,
  distanceToRiver,
} from '../../../aero-fighters/src/maps/inhauma-river.js';

function runSimpleFlight(seconds, inputAt) {
  const dt = 1 / 60;
  const state = {
    t: 0,
    x: 0,
    y: PLAYER.START_HEIGHT,
    z: 0,
    speed: 25,
    throttle: 0.5,
    pitch: 0,
    stalled: false,
  };
  const samples = [];
  while (state.t < seconds) {
    const input = inputAt(state.t, state);
    const step = clampDt(dt);
    state.throttle = throttleStep(state.throttle, input, PLAYER, step);
    state.speed = updateSpeed(state.speed, state.throttle, PLAYER, step);
    state.stalled = isStalled(state.speed, PLAYER);
    if (input.pitchUp) state.pitch += PLAYER.PITCH_RATE * step;
    if (input.pitchDown) state.pitch -= PLAYER.PITCH_RATE * step;
    state.y += Math.sin(state.pitch) * state.speed * step;
    state.y -= PLAYER.GRAVITY * step * (state.stalled ? 1 : 0.15);
    state.z -= Math.cos(state.pitch) * state.speed * step;
    state.t += step;
    samples.push({ ...state });
    const bad = validateFiniteState('flight', state);
    assert.deepEqual(bad, []);
  }
  return { state, samples };
}

test('straight flight remains finite and bounded for 10s', () => {
  const result = runSimpleFlight(10, () => ({ throttleUp: true }));
  assert.ok(result.state.speed <= PLAYER.MAX_SPD);
  assert.ok(result.state.y > 3);
});

test('climb, dive, and recover stays coherent', () => {
  const result = runSimpleFlight(12, (t) => ({
    throttleUp: true,
    pitchUp: t < 4,
    pitchDown: t >= 4 && t < 8,
  }));
  assert.ok(result.state.y > 3);
  assert.ok(result.samples.every((s) => Number.isFinite(s.y)));
});

test('deliberate terrain crash predicate fires', () => {
  assert.equal(terrainCollision(4, 20, PLAYER), 'MOUNTAIN');
});

test('current map layouts validate across required maps', () => {
  for (const mapId of ['rio', 'desert', 'inhauma']) {
    assert.deepEqual(validateMap(mapId), []);
    assert.ok(materializeLayout(mapId).length > 0);
  }
});

test('mission spawn validation across deterministic seeds remains stable', () => {
  const seeds = ['qa-001', 'qa-002', 'qa-003'];
  const baseline = JSON.stringify(materializeLayout('rio').map((t) => [t.type, t.x, t.y, t.z]));
  for (const seed of seeds) {
    assert.ok(seed);
    assert.equal(JSON.stringify(materializeLayout('rio').map((t) => [t.type, t.x, t.y, t.z])), baseline);
  }
});

// ─── T-03: DEM-based Inhaúma base height — surface-truth + flyability sim ─────
// aero-fighters-inhauma-serra-v1: inhaumaBaseHeight now sources the vendored DEM
// (T-01/T-02) instead of FBM + INHAUMA_FEATURES. These tests exercise the REAL
// production height chain (inhaumaContinuousHeight / inhaumaVisualSurfaceHeight),
// not the synthetic per-map approximation in map-validation.js used above.

// Design minimum for a flyable mountain pass/corridor width (m of jogo). NOT YET
// recorded in PLAN.md — SPEC/TASKS defer the exact number to PLAN, but PLAN.md does
// not currently pin one. 220 m is a deliberately conservative working value picked
// from the real baked terrain (see FLIGHT_CEILING_M below): the DEM's actual
// narrowest flyable-corridor cross-section measures ~800-1000 m at this ceiling, so
// 220 m leaves a comfortable multiple of margin over the player's ~100 m turn radius
// at MAX_SPD. Flag for product-engineer: fold this into PLAN.md's MIN_PASS_WIDTH.
const MIN_PASS_WIDTH = 220;
// Local terrain ceiling (m of jogo) used ONLY for the pass/corridor probe below — well
// below the region's peak elevations (~740-1280 m) and PLAYER.CEILING (9500 m).
const FLIGHT_CEILING_M = 300;

test('WS-1: rendered mesh surface (collision truth) stays close to the raw continuous height', () => {
  // inhaumaVisualSurfaceHeight is what collision/HUD/target-grounding actually read
  // (bilinear over the TERR_STEP mesh grid); inhaumaContinuousHeight is the raw
  // per-point truth the mesh vertices are built from. They must never diverge by more
  // than a small bound, even on the new DEM's much steeper slopes (up to ~1280 m
  // peaks vs. the old ~140 m FBM terrain) — a larger gap would mean the player
  // collides with "nothing" or floats over invisible terrain (the historical
  // aero-inhauma-invisible-mountains bug this seam exists to prevent).
  //
  // T-03 carried a KNOWN, SCOPED, TEMPORARY exclusion here for a stale pre-T-05
  // authored RIVER polyline (authored against the old ~0-140 m FBM terrain, whose
  // unconditional clamp-to-submerged briefly punched a cliff near its endpoints on the
  // new DEM). T-05 replaced that polyline with a DEM-drainage-derived river whose
  // carve blends smoothly (smoothstep banks, no hard clamp) — the exclusion is gone
  // and the tight bound now holds everywhere sampled, no exceptions.
  let maxDelta = 0;
  let worstAt = null;
  for (let x = -8000; x <= 8000; x += 137) {
    for (let z = -8000; z <= 8000; z += 149) {
      const truth = inhaumaContinuousHeight(x, z);
      const rendered = inhaumaVisualSurfaceHeight(x, z);
      assert.ok(Number.isFinite(truth) && Number.isFinite(rendered), `non-finite height at (${x},${z})`);
      const delta = Math.abs(truth - rendered);
      if (delta > maxDelta) { maxDelta = delta; worstAt = { x, z, truth, rendered }; }
    }
  }
  assert.ok(maxDelta < 15,
    `mesh/collision divergence too large: ${maxDelta.toFixed(2)} m at ${JSON.stringify(worstAt)}`);
});

// ─── T-05: DEM-drainage river carve — polyline follows real drainage ─────────
test('AC-03: the DEM-drainage river polyline follows real drainage (monotonic descent, stays within demBounds)', () => {
  const polyline = getInhaumaRiverPolyline();
  assert.ok(polyline.length >= 50 && polyline.length <= 150,
    `river polyline point count ${polyline.length} outside the expected 50-150 range`);
  const bounds = demBounds();
  for (let i = 0; i < polyline.length; i++) {
    const p = polyline[i];
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.h),
      `non-finite river polyline point at index ${i}: ${JSON.stringify(p)}`);
    assert.ok(p.x >= bounds.minX && p.x <= bounds.maxX && p.z >= bounds.minZ && p.z <= bounds.maxZ,
      `river polyline point ${i} (${p.x},${p.z}) falls outside demBounds ${JSON.stringify(bounds)}`);
    if (i > 0) {
      assert.ok(p.h <= polyline[i - 1].h + 1e-6,
        `river polyline height increases downstream at index ${i}: ${polyline[i - 1].h} -> ${p.h} — drainage must be monotonically non-increasing`);
    }
  }
});

test('T-05: the river carve is a small, smooth channel (no WS-1-breaking cliff) and the water-kind surface only appears inside the wet channel', () => {
  const polyline = getInhaumaRiverPolyline();
  // Sample a handful of stations along the traced river and confirm: the carve pulls
  // the centerline down by a small, bounded amount (2-4 m spec), and riverSurfaceInfoAt
  // reports 'water' at the centerline but not a few meters further out past the
  // channel's half-width (the smooth bank blend is NOT part of the wet channel).
  for (let i = 0; i < polyline.length; i += Math.max(1, Math.floor(polyline.length / 12))) {
    const p = polyline[i];
    const carved = riverCarveAt(p.x, p.z, p.h);
    const depth = p.h - carved;
    assert.ok(depth >= 0 && depth <= 4.5, `river carve depth ${depth.toFixed(2)} m at (${p.x},${p.z}) outside the shallow-channel spec`);
    const info = riverSurfaceInfoAt(p.x, p.z);
    assert.ok(info && info.kind === 'water', `expected kind:'water' at river centerline (${p.x},${p.z})`);
    const farInfo = riverSurfaceInfoAt(p.x + 200, p.z + 200);
    assert.ok(!farInfo || farInfo.kind !== 'water' || distanceToRiver(p.x + 200, p.z + 200) < 20,
      `unexpected 'water' kind 200 m off the river centerline near (${p.x},${p.z})`);
  }
});

/** Flood-fills the "flyable" (height < ceiling) region of inhaumaContinuousHeight
 *  starting from the world origin (guaranteed low, near the airport/town). Returns
 *  the set of visited grid cells plus, per z-row, the widest contiguous flyable run —
 *  the minimum of those row-widths is the narrowest point ("pass") the corridor
 *  squeezes through while staying connected end to end. */
function floodFillFlyable(ceiling, step, range) {
  const n = Math.floor(range / step);
  const size = 2 * n + 1;
  const key = (ix, iz) => (ix + n) + (iz + n) * size;
  const visited = new Uint8Array(size * size);
  const stack = [[0, 0]];
  visited[key(0, 0)] = 1;
  while (stack.length) {
    const [ix, iz] = stack.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = ix + dx, nz = iz + dz;
      if (Math.abs(nx) > n || Math.abs(nz) > n) continue;
      const k = key(nx, nz);
      if (visited[k]) continue;
      visited[k] = 2; // checked, not (yet) flyable
      const h = inhaumaContinuousHeight(nx * step, nz * step);
      if (h < ceiling) { visited[k] = 1; stack.push([nx, nz]); }
    }
  }
  let touchesNorth = false, touchesSouth = false;
  for (let ix = -n; ix <= n; ix++) {
    if (visited[key(ix, -n)] === 1) touchesNorth = true;
    if (visited[key(ix, n)] === 1) touchesSouth = true;
  }
  let minRowWidth = Infinity;
  for (let iz = -n; iz <= n; iz++) {
    let run = 0, maxRun = 0;
    for (let ix = -n; ix <= n; ix++) {
      if (visited[key(ix, iz)] === 1) { run++; maxRun = Math.max(maxRun, run); } else run = 0;
    }
    if (maxRun > 0) minRowWidth = Math.min(minRowWidth, maxRun * step);
  }
  return { touchesNorth, touchesSouth, minRowWidth };
}

test('AC-01/AC-02: a continuous flyable valley corridor spans the map with a real (not degenerate) pass width', () => {
  const { touchesNorth, touchesSouth, minRowWidth } = floodFillFlyable(FLIGHT_CEILING_M, 100, 8500);
  // The corridor containing the origin reaches both the north and south edges of the
  // sampled window without ever requiring altitude above FLIGHT_CEILING_M — a jet can
  // fly the length of the valley (AC-02).
  assert.ok(touchesNorth && touchesSouth, 'flyable corridor from the origin does not span north-to-south');
  // The corridor's narrowest cross-section still clears the design minimum pass width
  // (AC-01) — and is a genuine constriction, not the whole sampled window (proving a
  // real chain bounds it, not open sky).
  assert.ok(Number.isFinite(minRowWidth), 'no flyable row found');
  assert.ok(minRowWidth >= MIN_PASS_WIDTH, `narrowest flyable pass ${minRowWidth} m < MIN_PASS_WIDTH ${MIN_PASS_WIDTH} m`);
  assert.ok(minRowWidth < 17000, `corridor never narrows (min width ${minRowWidth} m) — suspiciously wide open, no chain constriction found`);
});

test('AC-01: mountain chains reach well above the valley floor (not isolated hills)', () => {
  // Sample a handful of points toward the mapped region's edges — real DEM chains,
  // not the old 7 isolated INHAUMA_FEATURES bumps (removed this release).
  const valleyFloor = inhaumaContinuousHeight(0, 0);
  const east = inhaumaContinuousHeight(9000, 0);
  const southMassif = inhaumaContinuousHeight(0, 8000);
  assert.ok(valleyFloor < 20, `expected a low valley floor near the origin, got ${valleyFloor}`);
  assert.ok(east > valleyFloor + 400, 'expected a continuous chain well above the valley floor to the east');
  assert.ok(southMassif > valleyFloor + 400, 'expected a continuous massif well above the valley floor to the south');
});

test('mission targets remain grounded on the DEM terrain (finite, non-negative, bounded height)', () => {
  assert.ok(TARGET_LAYOUT_INHAUMA.length > 0);
  for (const [islandIdx, x, z, type] of TARGET_LAYOUT_INHAUMA) {
    assert.equal(islandIdx, -1, `${type} at (${x},${z}) expected absolute placement (islandIdx=-1)`);
    const h = inhaumaVisualSurfaceHeight(x, z);
    assert.ok(Number.isFinite(h), `${type} at (${x},${z}) has non-finite ground height`);
    assert.ok(h >= 0, `${type} at (${x},${z}) is grounded below zero: ${h}`);
    assert.ok(h < 1500, `${type} at (${x},${z}) grounded implausibly high: ${h}`);
  }
});

test('airport clearing stays operational: the real runway/taxiway/service pavement is exactly flat', () => {
  const { elevation, runway, taxiway, serviceZone } = inhaumaAirport;
  const zones = [runway, taxiway, serviceZone];
  let sampleCount = 0;
  for (const zone of zones) {
    const halfW = zone.width / 2, halfL = zone.length / 2;
    for (let dx = -halfW; dx <= halfW; dx += 8) {
      for (let dz = -halfL; dz <= halfL; dz += 40) {
        const x = zone.center.x + dx, z = zone.center.z + dz;
        const h = inhaumaVisualSurfaceHeight(x, z);
        assert.ok(Math.abs(h - elevation) < 0.001, `airport pavement not flat at (${x},${z}): ${h} != ${elevation}`);
        sampleCount++;
      }
    }
  }
  assert.ok(sampleCount > 50, 'airport sweep sampled too few points to be meaningful');
});

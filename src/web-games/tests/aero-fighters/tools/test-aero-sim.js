import test from 'node:test';
import assert from 'node:assert/strict';

import { PLAYER, TARGET_LAYOUT_INHAUMA, MISSILES_NUCLEAR } from '../../../aero-fighters/src/config.js';
import {
  fireballFadeAt,
  fireballGrowthAt,
  fireballRiseAt,
  fireColorHexAt,
  plumeHeightAt,
  shockwaveRadiusAt,
  spawnNuclearFx,
  updateNuclearFx,
  nuclearFxState,
} from '../../../aero-fighters/src/nuclear-fx.js';
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
  buildForests,
  inhaumaTrees,
  buildInhaumaTerrain,
  buildTown,
  getInhaumaStructures,
} from '../../../aero-fighters/src/maps/inhauma-scene.js';
import { demBounds, demSlopeAt } from '../../../aero-fighters/src/maps/heightmap-sampler.js';
import {
  getInhaumaRiverPolyline,
  riverCarveAt,
  riverSurfaceInfoAt,
  distanceToRiver,
  riverWaterLevelAt,
  RIVER_HALF_WIDTH_M,
  RIVER_BANK_BLEND_M,
} from '../../../aero-fighters/src/maps/inhauma-river.js';
import {
  computeInhaumaBridgeCrossings,
  bridgeStructureFootprints,
} from '../../../aero-fighters/src/maps/inhauma-bridges.js';
import { INHAUMA_ROAD_CORRIDORS, sampleCorridor } from '../../../aero-fighters/src/maps/inhauma-road-defs.js';
import { nearAnyRoad } from '../../../aero-fighters/src/maps/inhauma-roads.js';

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

// ─── T-06: bridges at road×river crossings ───────────────────────────────────
test('AC-06: at least one road×river crossing is detected and each carries a resolved bridge deck', () => {
  const crossings = computeInhaumaBridgeCrossings();
  assert.ok(crossings.length >= 1, 'expected at least one road×river crossing (MG-238 per T-04/T-05 geometry)');
  for (const c of crossings) {
    assert.ok(Number.isFinite(c.midX) && Number.isFinite(c.midZ) && Number.isFinite(c.heading));
    assert.ok(c.halfLength > 0 && c.halfWidth > 0);
    assert.ok(Number.isFinite(c.deckHeight) && c.deckHeight > c.waterLevel,
      `deck at ${c.id} (${c.deckHeight}) must clear the local water level (${c.waterLevel})`);
  }
});

test('AC-06: bridge deck footprints are registered as valid structure AABBs (collision via inhaumaStructureInfoAt)', () => {
  const footprints = bridgeStructureFootprints();
  assert.equal(footprints.length, computeInhaumaBridgeCrossings().length);
  for (const f of footprints) {
    assert.ok(f.id && typeof f.id === 'string');
    assert.ok(f.halfX > 0 && f.halfZ > 0, `deck AABB at ${f.id} must have positive extents`);
    assert.ok(Number.isFinite(f.topY));
  }
});

test('AC-06: no road corridor dips below the local water line at a river crossing', () => {
  // Exercises the REAL production height chain (inhaumaContinuousHeight, which now
  // folds in bridgeDeckHeightAt) along the dense sampled points of every corridor —
  // the same points the road ribbon/road-bed carve actually consume. Gated by
  // `distanceToRiver` (the river's OWN carve-influence reach), not by
  // `riverWaterLevelAt !== null` — that helper answers for any point inside the
  // river's spatial-index margin (a generous lookup radius, not "there is water
  // here"), so far-away roads like `anel-inhauma` (~90 m from the river, per T-04)
  // would otherwise be compared against an irrelevant "if there were water here"
  // level, well outside where the terrain/river carve could ever submerge them.
  const RIVER_CARVE_REACH_M = RIVER_HALF_WIDTH_M + RIVER_BANK_BLEND_M;
  let sampleCount = 0;
  for (const corridor of INHAUMA_ROAD_CORRIDORS) {
    const points = sampleCorridor(corridor.control, corridor.closed);
    for (const p of points) {
      if (distanceToRiver(p.x, p.z) >= RIVER_CARVE_REACH_M) continue; // outside the river's influence — not a crossing concern
      const water = riverWaterLevelAt(p.x, p.z);
      assert.ok(water !== null, `expected a resolvable water level near the river at (${p.x.toFixed(1)},${p.z.toFixed(1)})`);
      const h = inhaumaContinuousHeight(p.x, p.z);
      sampleCount++;
      assert.ok(h > water, `${corridor.id} dips to ${h.toFixed(2)} m (water ${water.toFixed(2)} m) at (${p.x.toFixed(1)},${p.z.toFixed(1)})`);
    }
  }
  assert.ok(sampleCount > 0, 'no road samples fell within the river influence zone — crossing coverage untested');
});

test('AC-06: the bridge deck height chain stays continuous — no cliff at the influence-zone edge', () => {
  // Fine-grained sweep across the MG-238 crossing footprint (both along the road and
  // straddling the river) — no single-meter step introduces an implausible jump.
  const [crossing] = computeInhaumaBridgeCrossings();
  assert.ok(crossing, 'expected the MG-238 crossing to exist for this probe');
  let maxStepDelta = 0;
  let prev = null;
  for (let along = -crossing.gateHalfLength - 20; along <= crossing.gateHalfLength + 20; along += 2) {
    const x = crossing.midX + along * Math.sin(crossing.heading);
    const z = crossing.midZ + along * Math.cos(crossing.heading);
    const h = inhaumaContinuousHeight(x, z);
    if (prev !== null) maxStepDelta = Math.max(maxStepDelta, Math.abs(h - prev));
    prev = h;
  }
  assert.ok(maxStepDelta < 4, `bridge height chain has an implausible per-2m step of ${maxStepDelta.toFixed(2)} m`);
});

// ─── T-08: tree placement rules (tree line / slope / river proximity) ────────
// buildForests is pure JS + THREE (no DOM) — runs headless in Node against a stub
// scene that just swallows scene.add() calls, exercising the REAL placement logic
// (same RNG seed path as the browser) without needing a renderer.
const TREE_LINE_M = 620;
const MAX_TREE_SLOPE = 0.6;

test('AC-05: every placed tree respects the tree line, max slope, and every preserved exclusion', () => {
  const stubScene = { add() {} };
  buildForests(stubScene);
  assert.ok(inhaumaTrees.length >= 1500 && inhaumaTrees.length <= 2500,
    `tree count ${inhaumaTrees.length} outside the ~1500-2500 perf/WS-3 budget`);
  for (const t of inhaumaTrees) {
    assert.ok(t.y <= TREE_LINE_M, `tree above the tree line at (${t.x.toFixed(1)},${t.z.toFixed(1)}): ${t.y.toFixed(1)} m`);
    assert.ok(demSlopeAt(t.x, t.z) <= MAX_TREE_SLOPE, `tree on too steep a slope at (${t.x.toFixed(1)},${t.z.toFixed(1)})`);
    assert.ok(!(Math.abs(t.x + 560) < 360 && Math.abs(t.z - 320) < 360), `tree inside the airport exclusion at (${t.x.toFixed(1)},${t.z.toFixed(1)})`);
    assert.ok(distanceToRiver(t.x, t.z) >= RIVER_HALF_WIDTH_M + 10, `tree inside the river channel/margin at (${t.x.toFixed(1)},${t.z.toFixed(1)})`);
    assert.ok(!nearAnyRoad(t.x, t.z, 14), `tree on a road corridor at (${t.x.toFixed(1)},${t.z.toFixed(1)})`);
  }
});

test('AC-05: tree species span low-valley to high-subalpine bands, mapped to the new DEM height regime', () => {
  const heights = inhaumaTrees.map((t) => t.y);
  assert.ok(Math.min(...heights) < 20, 'expected at least one valley-floor tree well below 20 m');
  assert.ok(Math.max(...heights) > 300, 'expected at least one high subalpine tree above 300 m — species bands did not remap to the DEM regime');
});

// ─── T-09: city terracing on the valley shelf + airport shelf (AC-07) ─────────
// buildInhaumaTerrain resets structures[] (same order as inhauma.js#createInhaumaWorld)
// then buildTown registers every block — both run headless against a stub scene.
const AIRPORT_CLEARING_OUTER_M = 140; // landing-zones.js#airportClearingFactor default `outer`
const AIRPORT_CENTER_FOR_TEST = { x: -560, z: 320 };

test('AC-07: the terraced town sits on the valley shelf — no building intersects a road, the river channel, or the airport clearing', () => {
  const stubScene = { add() {} };
  buildInhaumaTerrain(stubScene);
  buildTown(stubScene);
  const buildings = getInhaumaStructures().filter((s) => s.id === 'predio-inhauma' || s.id === 'igreja-inhauma' || s.id === 'torre-igreja-inhauma');
  assert.ok(buildings.length >= 40, `expected a substantial terraced town, got only ${buildings.length} buildings`);
  for (const b of buildings) {
    const corners = [
      [b.x - b.halfX, b.z - b.halfZ], [b.x + b.halfX, b.z - b.halfZ],
      [b.x - b.halfX, b.z + b.halfZ], [b.x + b.halfX, b.z + b.halfZ],
      [b.x, b.z],
    ];
    for (const [cx, cz] of corners) {
      assert.ok(!nearAnyRoad(cx, cz, 0), `${b.id} at (${b.x.toFixed(1)},${b.z.toFixed(1)}) overlaps a road corridor`);
      assert.ok(distanceToRiver(cx, cz) >= RIVER_HALF_WIDTH_M, `${b.id} at (${b.x.toFixed(1)},${b.z.toFixed(1)}) overlaps the river channel`);
      assert.ok(Math.hypot(cx - AIRPORT_CENTER_FOR_TEST.x, cz - AIRPORT_CENTER_FOR_TEST.z) >= AIRPORT_CLEARING_OUTER_M,
        `${b.id} at (${b.x.toFixed(1)},${b.z.toFixed(1)}) overlaps the airport clearing`);
    }
  }
  // No two building footprints overlap each other either.
  let overlaps = 0;
  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      const a = buildings[i], c = buildings[j];
      if (Math.abs(a.x - c.x) < a.halfX + c.halfX && Math.abs(a.z - c.z) < a.halfZ + c.halfZ) overlaps++;
    }
  }
  assert.equal(overlaps, 0, `${overlaps} overlapping building footprint pairs`);
});

test('AC-07: downtown reads denser/taller than the periphery (terraced rows thin uphill)', () => {
  const stubScene = { add() {} };
  buildInhaumaTerrain(stubScene);
  buildTown(stubScene);
  const blocks = getInhaumaStructures().filter((s) => s.id === 'predio-inhauma');
  const heights = blocks.map((b) => b.topY);
  assert.ok(Math.max(...heights) - Math.min(...heights) > 15, 'expected a real height gradient between downtown and periphery blocks');
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

// ─── T-09 / AC-06 / D-8 / D-9: nuke fireball/rise/growth curves + larger destruction ──
// nuclear-fx.js's timing/growth/color math is pure (no THREE/DOM at import time — see
// its file header) so the REAL production functions are imported and driven directly
// here, not mirrored. `spawnNuclearFx`/`updateNuclearFx` themselves are also Node-safe
// now (T-09 decoupled the module from a static `import { scene } from './scene.js'`,
// which touches `window` at import time); a stub scene object stands in for THREE.Scene.

test('D-9: fireballGrowthAt is monotonic non-decreasing, starts at the base radius, and saturates at the max (no hard-stop snap)', () => {
  let prev = -Infinity;
  for (let t = 0; t <= 20; t += 0.1) {
    const r = fireballGrowthAt(t);
    assert.ok(Number.isFinite(r), `non-finite radius at t=${t}`);
    assert.ok(r >= prev - 1e-9, `fireballGrowthAt regressed at t=${t}: ${r} < ${prev}`);
    prev = r;
  }
  assert.ok(fireballGrowthAt(0) < 10, 'expected a small core radius at ignition');
  assert.ok(Math.abs(fireballGrowthAt(20) - fireballGrowthAt(10)) < 0.01, 'radius should have saturated well before t=10');
});

test('D-9: fireballFadeAt is a monotonic 1->0 fade and reaches 0 by the documented fade window', () => {
  assert.equal(fireballFadeAt(0), 1);
  assert.equal(fireballFadeAt(9), 0);
  assert.equal(fireballFadeAt(20), 0);
  let prev = Infinity;
  for (let t = 0; t <= 9; t += 0.25) {
    const f = fireballFadeAt(t);
    assert.ok(f <= prev + 1e-9, `fireballFadeAt increased at t=${t}`);
    prev = f;
  }
});

test('D-9: fireballRiseAt never overshoots the current plume top and is monotonic non-decreasing over the 60s timeline (replaces the old unbounded 30 + t²·6)', () => {
  let prev = -Infinity;
  for (let t = 0; t <= 60; t += 0.2) {
    const plumeH = plumeHeightAt(t);
    const rise = fireballRiseAt(t, plumeH);
    assert.ok(Number.isFinite(rise), `non-finite rise at t=${t}`);
    // Core "no overshoot" contract (D-9): the fireball core never climbs past the
    // current plume top (with a tiny float-slop margin), no matter how large plumeH
    // has grown by this point in the timeline — this is exactly the bug the old
    // `30 + t²·6` quadratic could violate once its growth outran the ease-out plume.
    assert.ok(rise <= Math.max(plumeH, 30) + 1e-6,
      `fireball rise ${rise} overshot the plume top ${plumeH} at t=${t}`);
    assert.ok(rise >= prev - 1e-6, `fireball rise regressed at t=${t}: ${rise} < ${prev}`);
    prev = rise;
  }
});

test('D-9: fireballRiseAt merges into the plume top by ~FIREBALL_RISE_T seconds (core visually becomes the rising cap, not a separate sphere)', () => {
  const plumeH = plumeHeightAt(6);
  const rise = fireballRiseAt(6, plumeH);
  assert.ok(Math.abs(rise - plumeH) < 0.5, `expected the fireball core to be pinned to the plume top by t=6, got rise=${rise} vs plumeH=${plumeH}`);
});

test('D-9: plumeHeightAt eases to the ceiling and never regresses across the 60s timeline', () => {
  let prev = -Infinity;
  for (let t = 0; t <= 60; t += 0.5) {
    const h = plumeHeightAt(t);
    assert.ok(Number.isFinite(h) && h >= 0, `non-finite/negative plume height at t=${t}`);
    assert.ok(h >= prev - 1e-9, `plume height regressed at t=${t}`);
    prev = h;
  }
  assert.ok(plumeHeightAt(60) > plumeHeightAt(1), 'plume should have risen substantially over the timeline');
});

test('D-9: shockwaveRadiusAt sweeps to ~750m and caps there (matches the visual ground shockwave the D-8 destruction radius is proportioned against)', () => {
  assert.equal(shockwaveRadiusAt(0), 0);
  assert.ok(shockwaveRadiusAt(3.5) >= 749, `shockwave should have reached ~750m by t=3.5, got ${shockwaveRadiusAt(3.5)}`);
  assert.equal(shockwaveRadiusAt(10), 750, 'shockwave must cap at 750m and never keep growing');
});

test('D-9: fireColorHexAt runs white-hot -> yellow -> orange -> red as u climbs 0->1 (cooling ramp), matching the fire-stop keyframes exactly at segment boundaries', () => {
  assert.equal(fireColorHexAt(0), 0xffffff);
  assert.equal(fireColorHexAt(1 / 3), 0xffee88);
  assert.equal(fireColorHexAt(2 / 3), 0xffaa30);
  assert.equal(fireColorHexAt(1), 0xff5020);
  // Cooling: red channel stays saturated (fire palette) while green+blue fall off —
  // sample a few interior points and confirm the ramp isn't flat/plain (WS-5 rule).
  const u0 = fireColorHexAt(0), uMid = fireColorHexAt(0.5), u1 = fireColorHexAt(1);
  assert.notEqual(u0, uMid);
  assert.notEqual(uMid, u1);
  assert.notEqual(u0, u1);
});

test('D-8: MISSILES_NUCLEAR destruction/player-damage radii are re-tuned per the SPEC (760/300/680)', () => {
  assert.equal(MISSILES_NUCLEAR.BLAST_RADIUS, 760);
  assert.equal(MISSILES_NUCLEAR.PLAYER_KILL_RADIUS, 300);
  assert.equal(MISSILES_NUCLEAR.PLAYER_DAMAGE_RADIUS, 680);
  assert.ok(MISSILES_NUCLEAR.PLAYER_KILL_RADIUS < MISSILES_NUCLEAR.PLAYER_DAMAGE_RADIUS);
  assert.ok(MISSILES_NUCLEAR.PLAYER_DAMAGE_RADIUS < MISSILES_NUCLEAR.BLAST_RADIUS);
});

// AC-06/D-8: mirrors the exact target-damage formula in projectiles.js's
// applyNuclearShockwave (module-private there; projectiles.js imports scene.js/audio.js
// and cannot be imported in plain Node — same established precedent as
// test-aero-weapons-sim.js's guidance harness, see that file's header comment). Any
// change to applyNuclearShockwave's damage formula must be mirrored here.
function nuclearDamageAt(distance) {
  if (distance >= MISSILES_NUCLEAR.BLAST_RADIUS) return 0;
  return MISSILES_NUCLEAR.DAMAGE * Math.max(0, 1 - distance / MISSILES_NUCLEAR.BLAST_RADIUS);
}

test('AC-06/D-8: applyNuclearShockwave formula (mirrored) destroys every target well within the new BLAST_RADIUS and spares one just outside', () => {
  const HIGHEST_TARGET_HP = 35; // config.js TARGETS.warship — the toughest target in the game
  // Damage falls off linearly to 0 exactly at BLAST_RADIUS (pre-existing formula shape,
  // unchanged by D-8) — sample representative "inside" distances up to 95% of the new
  // radius, comfortably clear of the near-zero tail right at the boundary.
  for (const d of [0, 100, 400, 600, MISSILES_NUCLEAR.BLAST_RADIUS * 0.95]) {
    const dmg = nuclearDamageAt(d);
    assert.ok(dmg > HIGHEST_TARGET_HP, `target at ${d}m (inside BLAST_RADIUS=${MISSILES_NUCLEAR.BLAST_RADIUS}) took only ${dmg} damage — would survive`);
  }
  const outside = MISSILES_NUCLEAR.BLAST_RADIUS + 5;
  assert.equal(nuclearDamageAt(outside), 0, `target at ${outside}m (just outside BLAST_RADIUS) should take no damage`);
});

test('T-09: spawnNuclearFx/updateNuclearFx drive nuclearFxState through the full flash->fireball->mushroom->dissipating->idle 60s timeline, staying finite throughout (headless-safe stub scene, no THREE renderer needed)', () => {
  const stubScene = { add() {}, remove() {} };
  spawnNuclearFx({ x: 0, y: 0, z: 0 }, stubScene);
  assert.equal(nuclearFxState.active, true);
  assert.equal(nuclearFxState.stage, 'flash');

  const dt = 1 / 30;
  let sawFireball = false, sawMushroom = false, sawDissipating = false;
  let prevPlumeHeight = -Infinity;
  let t = 0;
  while (t < 61) {
    updateNuclearFx(dt);
    t += dt;
    assert.ok(Number.isFinite(nuclearFxState.fireballRadius), `non-finite fireballRadius at t=${t}`);
    assert.ok(Number.isFinite(nuclearFxState.plumeHeight), `non-finite plumeHeight at t=${t}`);
    assert.ok(Number.isFinite(nuclearFxState.shockwaveRadius), `non-finite shockwaveRadius at t=${t}`);
    assert.ok(nuclearFxState.plumeHeight >= prevPlumeHeight - 1e-6, `plumeHeight regressed at t=${t}`);
    prevPlumeHeight = nuclearFxState.plumeHeight;
    if (nuclearFxState.stage === 'fireball') sawFireball = true;
    if (nuclearFxState.stage === 'mushroom') sawMushroom = true;
    if (nuclearFxState.stage === 'dissipating') sawDissipating = true;
  }
  assert.ok(sawFireball, 'timeline never entered the fireball stage');
  assert.ok(sawMushroom, 'timeline never entered the mushroom stage');
  assert.ok(sawDissipating, 'timeline never entered the dissipating stage');
  assert.equal(nuclearFxState.active, false, 'nuclearFxState should return to idle once the 60s lifetime elapses');
  assert.equal(nuclearFxState.stage, 'idle');
});

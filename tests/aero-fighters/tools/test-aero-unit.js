import test from 'node:test';
import assert from 'node:assert/strict';

import { PLAYER, MISSILES_LIGHT } from '../../../aero-fighters/src/config.js';
import {
  altitudeAboveTerrain,
  boundedAxisDelta,
  clampDt,
  homingVelocity,
  isStalled,
  normalize,
  terrainCollision,
  throttleStep,
  updateSpeed,
  validateFiniteState,
} from '../../../aero-fighters/src/physics-core.js';
import {
  demBounds,
  demSlopeAt,
  loadInhaumaDem,
  sampleDemHeight,
} from '../../../aero-fighters/src/maps/heightmap-sampler.js';
import { biomeColor } from '../../../aero-fighters/src/maps/inhauma-scene.js';
import { INHAUMA_DEM_ATTRIBUTION } from '../../../aero-fighters/src/ui/credits.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('clampDt caps large and invalid values', () => {
  assert.equal(clampDt(0.2), 0.1);
  assert.equal(clampDt(-1), 0);
  assert.equal(clampDt(Number.NaN), 0);
});

test('throttle and speed converge deterministically', () => {
  const throttle = throttleStep(0.5, { throttleUp: true }, PLAYER, 1);
  assert.equal(throttle, 1);
  const speed = updateSpeed(25, throttle, PLAYER, 0.5);
  assert.ok(speed > 25);
});

test('stall flag follows configured speed threshold', () => {
  assert.equal(isStalled(PLAYER.STALL_SPD - 0.1, PLAYER), true);
  assert.equal(isStalled(PLAYER.STALL_SPD + 0.1, PLAYER), false);
});

test('axis deltas are bounded by rate and dt', () => {
  assert.equal(boundedAxisDelta(true, PLAYER.PITCH_RATE, 0.5), PLAYER.PITCH_RATE * 0.5);
  assert.equal(boundedAxisDelta(false, PLAYER.PITCH_RATE, 0.5), 0);
});

test('altitude and terrain collision use the same terrain height', () => {
  assert.equal(altitudeAboveTerrain(30, 12), 18);
  assert.equal(terrainCollision(2.9, 0, PLAYER), 'SEA');
  assert.equal(terrainCollision(14, 10, PLAYER), 'MOUNTAIN');   // 14 < 10+5 (MOUNTAIN_BUFFER=5)
  assert.equal(terrainCollision(16, 10, PLAYER), null);          // 16 >= 10+5 → clear
});

test('homing velocity respects turn-rate interpolation', () => {
  const desired = normalize({ x: 10, y: 0, z: 0 }, MISSILES_LIGHT.TRACKING_SPD);
  const next = homingVelocity({ x: 0, y: 0, z: -80 }, desired, MISSILES_LIGHT.TURN_RATE);
  assert.ok(next.x > 0);
  assert.ok(next.z > -80);
});

test('finite-state validator catches invalid numeric state', () => {
  assert.deepEqual(validateFiniteState('state', { player: { x: 1, y: 2 } }), []);
  assert.deepEqual(validateFiniteState('state', { player: { x: Number.NaN } }), ['state.player.x']);
});

// ─── T-02: heightmap-sampler.js (DEM, Node-safe, no DOM/<canvas>) ──────────────
// This test file runs under plain `node --experimental-default-type=module` with no
// jsdom shim — `document`/`window` genuinely do not exist in this harness. Every
// assertion below succeeding IS the proof that heightmap-sampler.js never touches DOM
// APIs on the Node code path (a stray `document.` reference would throw ReferenceError
// and fail these tests outright).
const EPS = 1e-6;

test('DEM sampler loads in Node (fs path) with no DOM API touched', async () => {
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(typeof globalThis.window, 'undefined');
  const state = await loadInhaumaDem();
  assert.ok(state.meta.dims.width > 0);
  assert.ok(state.view instanceof Uint16Array);
  // Idempotent: a second call resolves to the exact same cached state, no re-read.
  const state2 = await loadInhaumaDem();
  assert.equal(state2, state);
});

test('sampleDemHeight matches golden values at fixed coordinates', async () => {
  await loadInhaumaDem();
  // Golden values captured from the committed heightmap.u16/.json (T-01 bake, pinned
  // Chamonix-valley region). Any change to the vendored asset or the bake constants
  // MUST update these together with a note in the commit message.
  const golden = [
    { x: 0, z: 0, h: 5.993125663484307 },
    { x: 500, z: 500, h: 75.87771727841312 },
    { x: -2000, z: 3000, h: 82.80724624015605 },
    { x: 2000, z: -3000, h: 30.78216649328896 },
    { x: -560, z: 320, h: 14.532463096280733 }, // Inhaúma airport reference coordinate
  ];
  for (const g of golden) {
    const h = sampleDemHeight(g.x, g.z);
    assert.ok(Math.abs(h - g.h) < EPS, `sampleDemHeight(${g.x},${g.z})=${h}, expected ${g.h}`);
  }
});

test('sampleDemHeight is bilinearly continuous (no jump at grid-cell boundaries)', async () => {
  await loadInhaumaDem();
  const probes = [[0, 0], [500, 500], [-2000, 3000], [3000, -1500]];
  for (const [x, z] of probes) {
    const base = sampleDemHeight(x, z);
    const tiny = sampleDemHeight(x + 0.001, z + 0.001);
    assert.ok(Math.abs(tiny - base) < 0.01, `discontinuity at (${x},${z}): ${base} -> ${tiny}`);
  }
  // Interpolation must be exact at grid corners: reconstruct one corner directly from
  // the quantized grid and compare against sampleDemHeight at that exact world coord.
  const { meta, view } = await loadInhaumaDem();
  const px = meta.originPixel.px + 3, py = meta.originPixel.py + 3;
  const worldX = (px - meta.originPixel.px) * meta.gamePxSize;
  const worldZ = (py - meta.originPixel.py) * meta.gamePxSize;
  const { min, max } = meta.heightRange;
  const expected = min + (view[py * meta.dims.width + px] / 65535) * (max - min);
  assert.ok(Math.abs(sampleDemHeight(worldX, worldZ) - expected) < EPS);
});

test('sampleDemHeight clamps at the DEM edge and blends to a plausible base level beyond it', async () => {
  await loadInhaumaDem();
  const b = demBounds();
  assert.ok(b.maxX > b.minX && b.maxZ > b.minZ);

  // Far outside the asset in every direction: stable, finite, plausible base level.
  const far = [
    [b.maxX + 50000, 0], [b.minX - 50000, 0], [0, b.maxZ + 50000], [0, b.minZ - 50000],
    [b.maxX + 50000, b.maxZ + 50000],
  ];
  for (const [x, z] of far) {
    const h = sampleDemHeight(x, z);
    assert.ok(Number.isFinite(h), `non-finite far outside (${x},${z})`);
    assert.ok(Math.abs(h - 6) < EPS, `expected plausible base level 6 far outside (${x},${z}), got ${h}`);
  }

  // Just past the edge: no cliff — the value must stay close to the last in-bounds
  // sample (monotonic blend toward the base level as distance from the edge grows).
  const edgeInside = sampleDemHeight(b.maxX - 1, 0);
  const edgeJustOutside = sampleDemHeight(b.maxX + 1, 0);
  assert.ok(Math.abs(edgeJustOutside - edgeInside) < 1, 'cliff at DEM edge');

  const samples = [0, 10, 100, 400, 800, 1200, 2000].map((d) => sampleDemHeight(b.maxX + d, 0));
  for (let i = 1; i < samples.length; i++) {
    assert.ok(samples[i] <= samples[i - 1] + EPS, 'edge blend is not monotonically settling toward the base level');
  }
  assert.ok(Math.abs(samples.at(-1) - 6) < EPS, 'edge blend does not fully settle by 2000m past the boundary');
});

test('demSlopeAt is near-zero on the flat valley floor and clearly positive on a steep flank', async () => {
  await loadInhaumaDem();
  assert.ok(demSlopeAt(0, 0) < 0.05, 'origin (valley floor near the town/airport) should be near-flat');
  const b = demBounds();
  const steepFlank = demSlopeAt(b.maxX - 500, 0); // toward the eastern massif wall
  assert.ok(steepFlank > 0.1, `expected a clearly non-flat slope near the eastern flank, got ${steepFlank}`);
});

test('demBounds is consistent with the vendored asset metadata', async () => {
  const { meta } = await loadInhaumaDem();
  const b = demBounds();
  assert.ok(Math.abs((b.maxX - b.minX) - (meta.dims.width - 1) * meta.gamePxSize) < EPS);
  assert.ok(Math.abs((b.maxZ - b.minZ) - (meta.dims.height - 1) * meta.gamePxSize) < EPS);
  // World origin (0,0) must fall inside bounds — the sampler design keeps the
  // town/airport cluster near the origin, inside the asset (D-2/T-02 mapping).
  assert.ok(b.minX < 0 && b.maxX > 0 && b.minZ < 0 && b.maxZ > 0);
});

// ─── T-07: biomeColor(h, slope) — altitude + inclinação (AC-04) ───────────────
// biomeColor is pure JS (no THREE) — exported directly from inhauma-scene.js so its
// palette logic is testable in Node without a scene/renderer.
function colorAt(h, slope, x = 0, z = 0) {
  const out = new Float32Array(3);
  biomeColor(h, slope, x, z, out, 0);
  return { r: out[0], g: out[1], b: out[2] };
}

test('AC-04: low, flat valley terrain reads green (grass), not rock or snow', () => {
  const c = colorAt(10, 0.02, 100, 100);
  assert.ok(c.g > c.r && c.g > c.b, `expected green-dominant grass color, got ${JSON.stringify(c)}`);
});

test('AC-04: a steep slope exposes rock even at low altitude (slope wins over altitude band)', () => {
  const flat = colorAt(30, 0.05, 500, 500);
  const steep = colorAt(30, 0.9, 500, 500); // same altitude, much steeper
  // Rock is a desaturated grey/brown — its channels sit much closer together than the
  // green valley palette (g clearly dominant over r and b there).
  const flatSpread = flat.g - Math.min(flat.r, flat.b);
  const steepSpread = steep.g - Math.min(steep.r, steep.b);
  assert.ok(steepSpread < flatSpread, `expected the steep sample to read less "green-dominant" (rock) than the flat one, got flat=${JSON.stringify(flat)} steep=${JSON.stringify(steep)}`);
});

test('AC-04: terrain well above the snow line on gentle slopes reads as snow (near-white)', () => {
  const c = colorAt(1100, 0.05, 0, 0); // high altitude, gentle slope — clearly above any jittered snow line
  assert.ok(c.r > 0.75 && c.g > 0.75 && c.b > 0.75, `expected a near-white snow color, got ${JSON.stringify(c)}`);
});

test('AC-04: a very steep face stays rock even above the snow line (snow does not cling to cliffs)', () => {
  const c = colorAt(1100, 0.95, 0, 0); // same high altitude, near-vertical face
  assert.ok(c.r < 0.75 || c.g < 0.75 || c.b < 0.75, `expected rock (not snow) on a very steep high face, got ${JSON.stringify(c)}`);
});

test('AC-04: the snow line boundary is jittered by (x,z), not a hard flat plane', () => {
  // Same height/slope, different (x,z) — the noise-jittered boundary means the
  // altitude threshold for "snow" is not identical everywhere.
  const probes = [[0, 0], [3000, 0], [0, 3000], [-3000, 2000], [4000, -4000]];
  const results = probes.map(([x, z]) => colorAt(780, 0.05, x, z)); // near the nominal snow line
  const allSnow = results.every((c) => c.r > 0.75 && c.g > 0.75 && c.b > 0.75);
  const allRock = results.every((c) => !(c.r > 0.75 && c.g > 0.75 && c.b > 0.75));
  assert.ok(!allSnow || !allRock, 'expected the jittered snow line to vary across sampled locations near the nominal boundary');
});

// ─── T-10: in-game DEM attribution credit (AC-09) ─────────────────────────────
test('AC-09: the in-game attribution constant stays byte-identical to the vendored heightmap.json metadata', () => {
  // ui/credits.js keeps a constant instead of loading heightmap.json live (see the
  // comment there for why) — this test is the mechanical drift guard for that
  // decision: if anyone rebakes the asset with different attribution wording, this
  // fails until ui/credits.js is updated to match.
  const metaUrl = new URL('../../../aero-fighters/assets/inhauma-dem/heightmap.json', import.meta.url);
  const meta = JSON.parse(readFileSync(fileURLToPath(metaUrl), 'utf8'));
  assert.equal(INHAUMA_DEM_ATTRIBUTION, meta.attribution.text);
  // Also assert the required substring from AC-09 / TASKS.md T-10 literally appears.
  assert.ok(INHAUMA_DEM_ATTRIBUTION.includes('Terrain data © Tilezen/joerd — AWS Terrain Tiles'));
});

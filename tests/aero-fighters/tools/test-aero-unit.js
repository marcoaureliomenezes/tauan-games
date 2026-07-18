import test from 'node:test';
import assert from 'node:assert/strict';

import { PLAYER, MISSILES_LIGHT } from '../../../src/web-games/aero-fighters/src/config.js';
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
} from '../../../src/web-games/aero-fighters/src/physics-core.js';
import {
  demBounds,
  demSlopeAt,
  loadInhaumaDem,
  sampleDemHeight,
} from '../../../src/web-games/aero-fighters/src/maps/heightmap-sampler.js';
import { biomeColor } from '../../../src/web-games/aero-fighters/src/maps/inhauma-scene.js';
import { INHAUMA_DEM_ATTRIBUTION } from '../../../src/web-games/aero-fighters/src/ui/credits.js';
import {
  afterburnerIntensity,
  isAfterburnerStage,
  isMilitaryOrAbove,
  throttleStage,
  ThrottleStage,
} from '../../../src/web-games/aero-fighters/src/throttle-stage.js';
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

test('sampleDemHeight extends relief procedurally beyond the DEM edge (T-V-10)', async () => {
  await loadInhaumaDem();
  const b = demBounds();
  assert.ok(b.maxX > b.minX && b.maxZ > b.minZ);

  // T-V-10 (aero-fighters-inhauma-visual-uplift-v1): o fallback plano de 6 m foi
  // substituído por continuação procedural (ridged+fbm ancorada na cota da borda) —
  // fim da "panqueca" na borda do mundo (audit shot 15). Novo contrato:
  // finito e plausível em qualquer distância, sem cliff na borda, NÃO-plano além
  // do blend de 800 m, e ancorado na cota da borda (não numa constante).
  const far = [
    [b.maxX + 50000, 0], [b.minX - 50000, 0], [0, b.maxZ + 50000], [0, b.minZ - 50000],
    [b.maxX + 50000, b.maxZ + 50000],
  ];
  for (const [x, z] of far) {
    const h = sampleDemHeight(x, z);
    assert.ok(Number.isFinite(h), `non-finite far outside (${x},${z})`);
    assert.ok(h >= 0 && h < 2000, `implausible height far outside (${x},${z}): ${h}`);
  }

  // Just past the edge: no cliff — the value must stay close to the last in-bounds sample.
  const edgeInside = sampleDemHeight(b.maxX - 1, 0);
  const edgeJustOutside = sampleDemHeight(b.maxX + 1, 0);
  assert.ok(Math.abs(edgeJustOutside - edgeInside) < 1, 'cliff at DEM edge');

  // Beyond the 800 m blend band the extension must NOT be flat: real relief variance.
  const samples = [0, 10, 100, 400, 800, 1200, 2000].map((d) => sampleDemHeight(b.maxX + d, 0));
  for (const h of samples) assert.ok(Number.isFinite(h), 'non-finite in blend band');
  const tail = samples.slice(4); // 800..2000 m — fora do blend
  const spread = Math.max(...tail) - Math.min(...tail);
  assert.ok(spread > 1, `procedural extension is still flat past the blend band (spread ${spread})`);
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
  const metaUrl = new URL('../../../src/web-games/aero-fighters/assets/inhauma-dem/heightmap.json', import.meta.url);
  const meta = JSON.parse(readFileSync(fileURLToPath(metaUrl), 'utf8'));
  assert.equal(INHAUMA_DEM_ATTRIBUTION, meta.attribution.text);
  // Also assert the required substring from AC-09 / TASKS.md T-10 literally appears.
  assert.ok(INHAUMA_DEM_ATTRIBUTION.includes('Terrain data © Tilezen/joerd — AWS Terrain Tiles'));
});

// ─── T-07: throttleStage(t) — D-6 named detents (AC-02) ───────────────────────
test('throttleStage boundary values map to the 4 D-6 detents (idle/taxi/military/afterburner)', () => {
  assert.equal(throttleStage(0), ThrottleStage.IDLE);
  assert.equal(throttleStage(PLAYER.THROTTLE_IDLE_MAX), ThrottleStage.IDLE); // boundary inclusive low side
  assert.equal(throttleStage(PLAYER.THROTTLE_IDLE_MAX + 0.001), ThrottleStage.TAXI);
  assert.equal(throttleStage(PLAYER.THROTTLE_TAXI_MAX), ThrottleStage.TAXI);
  assert.equal(throttleStage(PLAYER.THROTTLE_TAXI_MAX + 0.001), ThrottleStage.MILITARY);
  assert.equal(throttleStage(PLAYER.THROTTLE_MILITARY_MAX), ThrottleStage.MILITARY);
  assert.equal(throttleStage(PLAYER.THROTTLE_MILITARY_MAX + 0.001), ThrottleStage.AFTERBURNER);
  assert.equal(throttleStage(1), ThrottleStage.AFTERBURNER);
});

test('throttleStage covers the full [0,1] domain with no gaps', () => {
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const stage = throttleStage(Math.min(1, t));
    assert.ok(Object.values(ThrottleStage).includes(stage), `t=${t} produced invalid stage ${stage}`);
  }
});

test('isMilitaryOrAbove / isAfterburnerStage gate correctly at the D-6 boundaries', () => {
  assert.equal(isMilitaryOrAbove(PLAYER.THROTTLE_TAXI_MAX), false); // still taxi
  assert.equal(isMilitaryOrAbove(PLAYER.THROTTLE_TAXI_MAX + 0.001), true); // entered military
  assert.equal(isMilitaryOrAbove(1), true);
  assert.equal(isAfterburnerStage(PLAYER.THROTTLE_MILITARY_MAX), false); // still military
  assert.equal(isAfterburnerStage(PLAYER.THROTTLE_MILITARY_MAX + 0.001), true);
});

test('afterburnerIntensity is 0 below military, grows monotonically, largest (1) at full throttle', () => {
  assert.equal(afterburnerIntensity(0), 0);
  assert.equal(afterburnerIntensity(PLAYER.THROTTLE_IDLE_MAX), 0);
  assert.equal(afterburnerIntensity(PLAYER.THROTTLE_TAXI_MAX), 0); // just below military: still 0
  const atMilitaryEntry = afterburnerIntensity(PLAYER.THROTTLE_TAXI_MAX + 0.001);
  const atMilitaryMax = afterburnerIntensity(PLAYER.THROTTLE_MILITARY_MAX);
  const atAfterburner = afterburnerIntensity(1);
  assert.ok(atMilitaryEntry > 0, 'plume should already be visible (intensity > 0) right at military entry');
  assert.ok(atMilitaryMax > atMilitaryEntry, 'intensity should keep growing through the military band');
  assert.ok(atAfterburner > atMilitaryMax, 'afterburner (full throttle) must be the largest — AC-02');
  assert.equal(atAfterburner, 1);
});

test('AC-02: afterburner plume scale factor at afterburner is strictly greater than at idle', () => {
  // Mirrors the exact scale formula in player.js#updateAfterburnerFX (base 0.35,
  // range 1.3 * intensity) without re-deriving the constants — this is the pure,
  // Node-testable half of the "afterburner plume scale at afterburner > idle" AC;
  // the e2e visual smoke (tests/aero-fighters/) asserts the live mesh scale.
  const plumeScale = (t) => 0.35 + afterburnerIntensity(t) * 1.3;
  assert.ok(plumeScale(1) > plumeScale(PLAYER.THROTTLE_IDLE_MAX));
  assert.equal(isMilitaryOrAbove(PLAYER.THROTTLE_IDLE_MAX), false, 'idle throttle must NOT show the plume at all');
  assert.equal(isMilitaryOrAbove(1), true, 'afterburner throttle must show the plume');
});

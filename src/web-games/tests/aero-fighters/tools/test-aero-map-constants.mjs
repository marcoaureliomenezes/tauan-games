// test-aero-map-constants.mjs — Node validators for pure map metadata that
// smoke.spec.js / map.spec.js / sortie.spec.js / inhauma-fidelity.spec.js used to
// re-check per-boot in the browser (T-01 demotion, release v0.11.0 — see the
// demotion map: 2026-08-12T160030Z-agent-test-lifecycle-doctrine-annex-demotion-map.html
// §2.3/§2.4).
//
// Two of maps/index.js's MAP_KEYS and maps/inhauma.js's INHAUMA_CITIES/
// INHAUMA_LANDMARKS are NOT directly Node-importable: both modules transitively
// import scene.js (world.js -> scene.js; inhauma.js -> factory-fx.js/city-war.js
// -> scene.js), which touches `window.innerWidth`/creates a WebGLRenderer at
// module-scope top level and throws in plain Node. Where the value is a genuine
// hardcoded literal not derivable from any importable source, this file mirrors
// it with a citation (same convention as test-aero-sim.js's nuclearDamageAt /
// test-aero-weapons-sim.js's guidance-formula mirrors) or reads the source text
// directly (same convention already established by test-aero-defense-mode.mjs's
// MAP_KEYS regex-match) — never a fabricated/duplicated number with no tie back
// to the committed source. Real imports (CACHOEIRA_TOWN_CENTER, desertAirport,
// inhaumaAirport) are used wherever the value IS reachable.
//
// Roda com: node --experimental-default-type=module tests/aero-fighters/tools/test-aero-map-constants.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { desertAirport, inhaumaAirport } from '../../../aero-fighters/src/airport.js';
import { CACHOEIRA_TOWN_CENTER } from '../../../aero-fighters/src/maps/inhauma-scene.js';

const SRC = fileURLToPath(new URL('../../../aero-fighters/', import.meta.url));
const read = (rel) => readFileSync(SRC + rel, 'utf8');

// ─── map.spec.js "map diagnostics identify current map" (×3 boots, deleted) ──
// maps/index.js is not Node-importable (poisoned by world.js -> scene.js) — the
// committed MAP_KEYS array is read from source text instead of imported, the
// same technique test-aero-defense-mode.mjs already uses for this exact module.
//
// CORRECTION to the demotion map's own sketch: it claimed MAP_KEYS.sort() ===
// ['desert','inhauma','islands','rio'] (4 entries). The real committed array
// (maps/index.js) has 5 entries — 'inhauma-defense' is a real, shipped map key
// (T-D-01, the ground-defense mode) the map's author missed. This test asserts
// the REAL committed set, not the demotion map's guess.
test('MAP_KEYS inventory: maps/index.js exports exactly the 5 committed map keys', () => {
  const src = read('src/maps/index.js');
  const m = src.match(/export const MAP_KEYS = \[([^\]]*)\]/);
  assert.ok(m, 'MAP_KEYS literal not found in maps/index.js');
  const keys = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  assert.deepEqual(
    [...keys].sort(),
    ['desert', 'inhauma', 'inhauma-defense', 'islands', 'rio'],
    'maps/index.js#MAP_KEYS drifted from the committed 5-key inventory',
  );
  // debug.js#getMapDiagnostics mirrors this array minus 'islands' as mapsCovered
  // (see debug.js:187) — the legacy default map is intentionally excluded there.
  assert.ok(keys.includes('rio') && keys.includes('desert') && keys.includes('inhauma'));
});

// ─── inhauma-fidelity.spec.js "keeps regional city orientation faithful to the
// reference route" (:115, deleted) ─────────────────────────────────────────────
// maps/inhauma.js is not Node-importable (poisoned by factory-fx.js/city-war.js
// -> scene.js — same reason documented in test-aero-cachoeira.mjs T-C-04(e)).
// 'inhauma' is fixed at the world origin (inhauma.js#INHAUMA_CITIES literal) and
// 'sete-lagoas' is a hardcoded literal there too (never derived from any
// importable source) — both mirrored below with a citation; 'cachoeira-da-prata'
// uses the REAL imported CACHOEIRA_TOWN_CENTER (inhauma.js derives its own entry
// from the exact same constant, per inhauma.js:40).
test('city orientation: cachoeira and sete-lagoas sit in the correct quadrants relative to inhauma (origin)', () => {
  const src = read('src/maps/inhauma.js');
  assert.match(src, /id: 'inhauma', x: 0, z: 0/, 'inhauma city anchor drifted from the mirrored (0,0) origin');
  assert.match(src, /id: 'sete-lagoas', x: 1250, z: -420/, 'sete-lagoas literal drifted from the mirrored coordinates');

  const inhaumaXZ = { x: 0, z: 0 };
  const seteXZ = { x: 1250, z: -420 };

  // Cachoeira: west + south of inhauma (real import — genuine drift guard).
  assert.ok(CACHOEIRA_TOWN_CENTER.x < inhaumaXZ.x - 350, 'cachoeira not west of inhauma');
  assert.ok(CACHOEIRA_TOWN_CENTER.z > inhaumaXZ.z + 150, 'cachoeira not south of inhauma');
  // Sete Lagoas: east + north of inhauma (mirrored literal).
  assert.ok(seteXZ.x > inhaumaXZ.x + 600, 'sete-lagoas not east of inhauma');
  assert.ok(seteXZ.z < inhaumaXZ.z - 150, 'sete-lagoas not north of inhauma');
});

// ─── inhauma-fidelity.spec.js "contains the required Inhauma landmarks inside
// the central city area" (:153, deleted) ───────────────────────────────────────
// The 4 civil landmark coordinates are hardcoded literals in maps/inhauma.js
// (INHAUMA_LANDMARKS) — mirrored below with a citation (inhauma-scene.js's own
// PLAZA/FIELDS constants that produce the matching paved ground are
// module-private, not exported — see the note at inhauma-fidelity.spec.js:137-146
// this test replaces). The airport landmark uses the REAL imported
// inhaumaAirport.runway.center (inhauma.js:68 derives its own entry from the
// exact same source).
test('landmarks clustering: the 4 civil landmarks cluster into a walkable downtown, clear of the airport', () => {
  const src = read('src/maps/inhauma.js');
  assert.match(src, /id: 'igreja-inhauma'.*x: -330, z: -40/, 'igreja-inhauma literal drifted');
  assert.match(src, /id: 'campo-inhauma'.*x: -410, z: -60/, 'campo-inhauma literal drifted');
  assert.match(src, /id: 'area-lazer-manga'.*x: -250, z: -40/, 'area-lazer-manga literal drifted');
  assert.match(src, /id: 'praca-central-inhauma'.*x: -390, z: 0/, 'praca-central-inhauma literal drifted');

  const civil = [
    { id: 'igreja-inhauma', x: -330, z: -40 },
    { id: 'campo-inhauma', x: -410, z: -60 },
    { id: 'area-lazer-manga', x: -250, z: -40 },
    { id: 'praca-central-inhauma', x: -390, z: 0 },
  ];
  const centroid = {
    x: civil.reduce((sum, l) => sum + l.x, 0) / civil.length,
    z: civil.reduce((sum, l) => sum + l.z, 0) / civil.length,
  };
  for (const landmark of civil) {
    const d = Math.hypot(landmark.x - centroid.x, landmark.z - centroid.z);
    assert.ok(d < 160, `${landmark.id} not clustered with the rest of downtown (${d.toFixed(1)} m from centroid)`);
  }

  // The airport (real import) stays well clear of the civilian downtown cluster.
  const airport = inhaumaAirport.runway.center;
  const airportDistance = Math.hypot(airport.x - centroid.x, airport.z - centroid.z);
  assert.ok(airportDistance > 300, `airport too close to the civilian downtown cluster (${airportDistance.toFixed(1)} m)`);
});

// ─── sortie.spec.js "MR sortie debug contract starts at Tauan desert airport"
// (:21, deleted) ────────────────────────────────────────────────────────────────
// desertAirport is a real, directly importable export (Object.freeze, no THREE
// dependency at read-time) — no mirroring needed.
test('desert airport contract: label text and runway length exceed the D-4 handoff-geometry minimum', () => {
  assert.equal(desertAirport.text.value, 'AEROPORTO DO TAUAN E DO PAPAI');
  assert.ok(desertAirport.runway.length > 700, `runway length ${desertAirport.runway.length} <= 700`);
});

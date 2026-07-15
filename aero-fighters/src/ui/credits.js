// ui/credits.js — In-game attribution credit for the DEM-derived Inhaúma terrain
// (AC-09, release aero-fighters-inhauma-serra-v1).
//
// The vendored DEM asset (aero-fighters/assets/inhauma-dem/heightmap.json) carries
// this exact string in its `attribution.text` field — Tilezen/joerd's AWS Terrain
// Tiles (Terrarium) are attribution-only licensed (no restriction on use beyond
// credit; see attribution.url in that same JSON). Kept here as a constant rather than
// read live from heightmap.json at UI-build time: the JSON is already loaded once by
// maps/heightmap-sampler.js#loadInhaumaDem() for terrain math (top-level await in
// maps/inhauma-scene.js), and this small standalone UI module has no reason to depend
// on that terrain-math module or duplicate its async load path just to render one line
// of static text. A Node unit test (tests/aero-fighters/tools/test-aero-unit.js) reads
// heightmap.json directly and asserts this constant stays byte-identical to the
// vendored metadata, so drift between the two is caught mechanically.
export const INHAUMA_DEM_ATTRIBUTION =
  'Terrain data © Tilezen/joerd — AWS Terrain Tiles (Terrarium)';

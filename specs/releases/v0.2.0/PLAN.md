# PLAN: Aero Fighters - Inhauma GIS Map Replacement

> **Status:** Aprovado
> **Aprovação:** 2026-06-30 — aprovado pelo operador junto com a estratégia GIS/local-data para substituir o mapa Inhauma procedural.
> **SPEC:** `specs/releases/v0.2.0/SPEC.md`
> **Created:** 2026-06-30

---

## 1. Goal

Replace the stale hand-authored Inhauma map with a deterministic GIS-baked map while
preserving the static Three.js web-game runtime.

The implementation must not produce two competing Inhauma map systems. Each old
authoritative procedural layer must be replaced by one new authoritative generated/data
layer, then deleted or demoted to explicit fixtures/tests.

## 2. Architecture

### 2.1 Offline Generator

Create/extend an offline generator based on the existing v2 data fetcher.

Input sources:

- `aero-fighters-v2/Content/World/inhauma-osm.pbf`;
- `aero-fighters-v2/Content/World/inhauma-heightmap.tif` or `.png`;
- source metadata from `aero-fighters-v2/Content/World/SOURCES.md`;
- optional fresh Geofabrik/SRTM refresh when explicitly run.

Output target:

- `aero-fighters/src/maps/inhauma-data/` or equivalent static local module directory.

Output artifacts:

- `projection.js` or `projection.json`;
- `terrain.js` or `terrain.json`;
- `roads.js` or `roads.json`;
- `buildings.js` or `buildings.json`;
- `landuse.js` or `landuse.json`;
- `water.js` or `water.json`;
- `metadata.js` or `metadata.json`.

Generated output must be compact enough for static runtime and deterministic enough for
tests.

### 2.2 Runtime Modules

Proposed runtime modules:

| Module | Responsibility |
|---|---|
| `maps/inhauma-data/*` | Generated local map data and source metadata. |
| `maps/inhauma-projection.js` | WGS84/local-meter conversion and map bounds. |
| `maps/inhauma-terrain.js` | Height grid sampling, terrain mesh chunks, terrain collision. |
| `maps/inhauma-roads.js` | Road graph, road ribbons, intersections, airport clipping. |
| `maps/inhauma-traffic.js` | Graph-based car routing and instanced vehicles. |
| `maps/inhauma-buildings.js` | OSM footprint extrusion/merging/LOD. |
| `maps/inhauma-foliage.js` | Landuse-based deterministic vegetation. |
| `maps/inhauma-water.js` | OSM water/waterway geometry. |
| `maps/inhauma-airport-zones.js` | Airport polygons, safety/exclusion zones, validators. |
| `maps/inhauma.js` | Composition/orchestration only. |

`maps/inhauma-scene.js` must not remain the authoritative scene implementation at the
end of the release.

## 3. Replacement Rules

### R-01 Roads

Delete or replace:

- `INHAUMA_ROAD_DEFS` as road authority;
- segmented road plane rendering;
- road cars with `t` loops over isolated polylines.

Replace with:

- generated road graph;
- continuous `BufferGeometry` road ribbons;
- intersection patches;
- lane centerlines;
- graph-based traffic.

### R-02 Terrain

Delete or demote:

- FBM/named-feature terrain as authoritative Inhauma height source.

Replace with:

- SRTM-derived height grid;
- optional secondary procedural detail;
- same sampler for visual mesh and collision;
- airport and road flattening/cut-fill passes.

### R-03 Buildings

Delete or replace:

- procedural circular city grid as authoritative city geometry.

Replace with:

- OSM footprint geometry;
- height/level interpretation;
- LOD/merge/instancing performance strategy.

### R-04 Foliage

Delete or replace:

- random height-only tree scatter as authoritative foliage.

Replace with:

- landuse/natural polygon sampling;
- multiple prototypes;
- exclusion masks.

### R-05 Airport Safety

Replace terrain-only protection with feature-generation authority:

- no-road;
- no-building;
- no-tree;
- no-target;
- no-traffic;
- approach clear zones.

## 4. Work Sequence

### Phase 1 - Data Contract And Validators

Owner: `product-engineer` + `qa-engineer`

- Define generated data schema.
- Add pure validators for:
  - road graph connectivity;
  - airport/road intersections;
  - traffic exclusion;
  - building/foliage exclusion;
  - terrain finite samples.
- Add tests that fail against the current procedural map.

### Phase 2 - Generator V1

Owner: `game-developer`

- Extend `inhauma-data-fetch.py` or create a web-specific generator.
- Export roads from OSM `highway=*`.
- Export water/waterway features.
- Convert existing building and landuse output to local-meter game coordinates.
- Emit metadata with hashes and source timestamps.

### Phase 3 - Terrain Runtime Replacement

Owner: `game-developer`

- Implement height grid loader/sampler.
- Render chunked SRTM terrain.
- Apply airport flattening and road bed carving.
- Wire collision to the same sampler.
- Remove FBM-only terrain authority.

### Phase 4 - Airport Safety Layer

Owner: `game-developer`

- Model runway/taxiway/service/safety/approach polygons.
- Expose reusable exclusion predicates.
- Integrate predicates into generator and runtime diagnostics.
- Add validator proving zero illegal conflicts.

### Phase 5 - Road Graph And Traffic

Owner: `game-developer`

- Replace hard-coded road definitions.
- Build continuous ribbons and intersections.
- Build lane centerlines and graph edges.
- Implement route-based cars.
- Delete old decorative traffic loop authority.

### Phase 6 - Buildings, Foliage, Water

Owner: `game-developer`

- Replace grid buildings with OSM footprints.
- Replace random trees with landuse sampling and variants.
- Replace approximate water with OSM water/waterway plus documented curated patches.
- Keep draw calls under budget through merge/instancing/LOD.

### Phase 7 - Diagnostics And Visual QA

Owner: `qa-engineer`

- Update `window.__aeroDebug.getMapDiagnostics()`.
- Add visual smoke and renderer budget checks.
- Capture Playwright screenshot evidence.
- Confirm map is realistic enough to review manually.

### Phase 8 - Stale Content Removal Pass

Owner: `game-developer` + `code-reviewer`

- Search for stale authoritative procedural map systems.
- Delete unused modules/functions/data.
- Ensure `inhauma.js` composes the new modules only.
- Keep historical specs untouched; production runtime must reflect latest state only.

## 5. File Plan

Likely production files:

- `aero-fighters/src/maps/inhauma.js`
- `aero-fighters/src/maps/inhauma-scene.js` (delete or replace)
- `aero-fighters/src/maps/inhauma-data/**`
- `aero-fighters/src/maps/inhauma-projection.js`
- `aero-fighters/src/maps/inhauma-terrain.js`
- `aero-fighters/src/maps/inhauma-roads.js`
- `aero-fighters/src/maps/inhauma-traffic.js`
- `aero-fighters/src/maps/inhauma-buildings.js`
- `aero-fighters/src/maps/inhauma-foliage.js`
- `aero-fighters/src/maps/inhauma-water.js`
- `aero-fighters/src/maps/inhauma-airport-zones.js`
- `aero-fighters/src/airport.js`
- `aero-fighters/src/landing-zones.js`
- `aero-fighters/src/map-validation.js`
- `aero-fighters/src/debug.js`

Likely tools/data files:

- `aero-fighters-v2/Tools/inhauma-data-fetch.py`
- optional new generator under `aero-fighters/tools/` if the web game needs a separate
  export step.

Likely tests:

- `tests/aero-fighters/inhauma-fidelity.spec.js`
- `tests/aero-fighters/map.spec.js`
- `tests/aero-fighters/tools/validate-aero-map.js`
- new pure validator tests for generated data.

## 6. Test Matrix

| Command | Purpose |
|---|---|
| `npm run validate:aero-map` | Pure map and target validation. |
| `npm run test:aero:unit` | Unit checks for geometry/projection/validators where applicable. |
| `npm run test:aero:sim` | Simulation checks for targets/terrain/sortie behavior. |
| `npm run test:aero:e2e` | Playwright browser validation. |
| `npm run test:aero:qa` | Required final gate. |

Additional required checks:

- code search for removed stale systems;
- generated data source-hash check;
- road graph connected-component report;
- airport conflict report;
- screenshot/renderer stats evidence.

## 7. Risks And Controls

| Risk | Control |
|---|---|
| Generated data is too heavy for static runtime. | Simplify during generation, emit compact arrays, use chunking/LOD. |
| OSM data is incomplete around Inhauma. | Allow documented curated patches only after source gaps are recorded. |
| Roads still conflict with airport. | Airport exclusion predicates run before geometry emit and again in tests. |
| Complex building footprints hurt FPS. | Merge by material/LOD; instance simple repeatables; cap distant detail. |
| Runtime becomes dependent on tooling. | Tooling is offline-only; generated data is committed or JS-exported. |
| Old procedural content survives and conflicts with new map. | Dedicated stale-removal task and code-search acceptance criterion. |

## 8. Definition Of Done

- SPEC/PLAN/TASKS approved and release activated.
- No production edits before an approved task is reserved.
- GIS generator produces deterministic local data.
- Inhauma runtime consumes local generated data only.
- Roads are graph-connected and airport-safe.
- Traffic uses road graph and airport exclusions.
- Buildings/foliage/water are generated from GIS/landuse data with exclusions.
- SRTM-derived terrain is authoritative for visual mesh and collision.
- Stale procedural authoritative Inhauma systems are deleted/replaced.
- `npm run test:aero:qa` passes.

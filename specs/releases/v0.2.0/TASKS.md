# TASKS: Aero Fighters - Inhauma GIS Map Replacement

> **Status:** Aprovado
> **Aprovação:** 2026-06-30 — aprovado pelo operador junto com SPEC/PLAN.
> **SPEC:** `specs/releases/v0.2.0/SPEC.md`
> **PLAN:** `specs/releases/v0.2.0/PLAN.md`
> **Created:** 2026-06-30

---

## Pre-implementation Checklist

- [x] SPEC.md aprovado
- [x] PLAN.md aprovado
- [x] TASKS.md aprovado
- [x] Release activated in `specs/releases/ACTIVE.md`
- [x] Nenhuma task em progresso duplicada neste arquivo

## Write Set

Allowed once approved and active:

- `aero-fighters/src/maps/inhauma*.js`
- `aero-fighters/src/maps/inhauma-data/**`
- `aero-fighters/src/airport.js`
- `aero-fighters/src/landing-zones.js`
- `aero-fighters/src/map-validation.js`
- `aero-fighters/src/debug.js`
- `aero-fighters-v2/Tools/inhauma-data-fetch.py`
- optional web-map generator under `aero-fighters/tools/**`
- `tests/aero-fighters/**`
- this release directory

## Tasks

### [ ] T-GIS-01 - QA/data contract for generated Inhauma map

**Owner:** `qa-engineer`

Define tests and pure validators before replacement work:

- generated data schema validation;
- projection sanity checks;
- road graph connected components;
- airport exclusion intersection checks;
- building/foliage/water exclusion checks;
- diagnostics contract for source hashes and graph stats.

**Verify:**

```bash
npm run validate:aero-map
npm run test:aero:unit
```

Expected initial state: new GIS-specific checks fail against the current procedural map.

### [ ] T-GIS-02 - Generator: export web-ready GIS data

**Owner:** `game-developer`

Extend the existing Inhauma data pipeline or create a web-specific generator:

- read existing OSM/SRTM sources;
- export roads from `highway=*`;
- export water/waterway features;
- convert buildings/landuse to local game coordinates;
- emit compact deterministic local data;
- emit source metadata and hashes.

**Verify:**

```bash
python3 aero-fighters-v2/Tools/inhauma-data-fetch.py --help
npm run test:aero:unit
```

Final verify must include source-hash evidence in the implementation report.

### [ ] T-GIS-03 - Projection and generated data loader

**Owner:** `game-developer`

Implement the canonical local coordinate system and runtime data loading:

- WGS84 -> local meters;
- consistent x/z convention;
- generated data module import/fetch strategy;
- diagnostics exposing projection origin and data version.

**Verify:**

```bash
npm run test:aero:unit
```

### [ ] T-GIS-04 - Replace terrain with SRTM-derived height grid

**Owner:** `game-developer`

Replace FBM-only terrain authority:

- height grid sampler;
- chunked terrain mesh;
- visual/collision parity;
- airport flattening;
- road bed carve/flatten support.

Delete or demote stale procedural terrain so it is no longer the authoritative Inhauma
height source.

**Verify:**

```bash
npm run validate:aero-map
npx playwright test tests/aero-fighters/inhauma-fidelity.spec.js --config=tests/playwright.config.js --grep "terrain|airport"
```

### [ ] T-GIS-05 - Airport exclusion authority

**Owner:** `game-developer`

Implement airport safety geometry:

- runway/taxiway/service polygons;
- runway safety area;
- approach clear zones;
- no-road/no-building/no-tree/no-target/no-traffic zones;
- reusable predicates for generator/runtime/tests.

**Verify:**

```bash
npm run validate:aero-map
```

Validator output must prove zero illegal airport conflicts.

### [-] T-GIS-06 - Replace roads with OSM road graph

**Owner:** `game-developer`

Replace the current hard-coded road source:

- remove `INHAUMA_ROAD_DEFS` as authoritative road data;
- build road graph from generated roads;
- render continuous road ribbons;
- render intersection patches;
- apply road terrain adjustment;
- expose graph diagnostics.

**Verify:**

```bash
npm run validate:aero-map
npx playwright test tests/aero-fighters/inhauma-fidelity.spec.js --config=tests/playwright.config.js --grep "road|orientation"
```

### [ ] T-GIS-07 - Replace decorative cars with graph traffic

**Owner:** `game-developer`

Implement functional traffic:

- route selection across graph edges;
- lane centerline movement;
- road-class speeds;
- no airport exclusion entry;
- diagnostics for active routes.

Delete old traffic loops over isolated polylines.

**Verify:**

```bash
npm run test:aero:sim
npx playwright test tests/aero-fighters/inhauma-fidelity.spec.js --config=tests/playwright.config.js --grep "traffic|road"
```

### [ ] T-GIS-08 - Replace city boxes with OSM buildings

**Owner:** `game-developer`

Replace procedural circular city grid:

- OSM footprint extrusion or pre-triangulated geometry;
- height/level interpretation;
- roof/material variation;
- merge/instance/LOD budget;
- airport/road exclusion enforcement.

**Verify:**

```bash
npm run validate:aero-map
npx playwright test tests/aero-fighters/inhauma-fidelity.spec.js --config=tests/playwright.config.js --grep "building|landmark|Inhauma"
```

### [ ] T-GIS-09 - Replace random trees with landuse foliage

**Owner:** `game-developer`

Replace height-only random tree scatter:

- landuse/natural polygon sampling;
- forest/orchard/farmland/grass/residential density profiles;
- at least four vegetation prototypes;
- deterministic placement;
- exclusion masks.

**Verify:**

```bash
npm run validate:aero-map
npx playwright test tests/aero-fighters/inhauma-fidelity.spec.js --config=tests/playwright.config.js --grep "visual|foliage"
```

### [ ] T-GIS-10 - Replace approximate water/rural features

**Owner:** `game-developer`

Use generated water/waterway and rural landuse data:

- water polygons/ribbons;
- farms/pastures/fields from landuse;
- documented curated patches only where GIS source is incomplete.

**Verify:**

```bash
npm run validate:aero-map
```

### [ ] T-GIS-11 - Diagnostics and Playwright fidelity update

**Owner:** `qa-engineer`

Update diagnostics/tests to verify the new map:

- data version/source hashes;
- road graph stats and disconnected components;
- airport conflict counts;
- building/foliage counts;
- traffic routes;
- visual smoke screenshot and renderer budget.

**Verify:**

```bash
npm run test:aero:e2e
```

### [ ] T-GIS-12 - Stale content deletion and final QA

**Owner:** `game-developer` + `code-reviewer`

Remove stale authoritative map content and prove it is gone:

- no old `INHAUMA_ROAD_DEFS` authority;
- no procedural circular city grid authority;
- no old decorative traffic authority;
- no FBM-only terrain authority;
- no random height-only foliage authority;
- `inhauma-scene.js` deleted or reduced to non-authoritative reusable helpers.

**Verify:**

```bash
rg "INHAUMA_ROAD_DEFS|buildTown|buildForests|buildRoadsAndCars|inhaumaContinuousHeight" aero-fighters/src/maps
npm run test:aero:qa
```

The search command must either return no stale authoritative production paths or be
explained line-by-line in the closure evidence.

## Completion Criteria

- [ ] `npm run validate:aero-map` passes.
- [ ] `npm run test:aero:qa` passes.
- [ ] Road graph validator proves connected main component.
- [ ] Airport conflict validator proves zero illegal road/building/tree/target/traffic conflicts.
- [ ] Traffic routes over graph edges.
- [ ] Buildings use OSM footprints.
- [ ] Foliage uses landuse/natural data and multiple prototypes.
- [ ] Terrain uses SRTM-derived height source for visual and collision.
- [ ] Stale authoritative procedural Inhauma map content is deleted/replaced.
- [ ] Final screenshot evidence exists for manual review.

# TASKS — Release: aero-fighters-inhauma-serra-v1

**Status:** Aprovado
**Release ID:** aero-fighters-inhauma-serra-v1
**Owner:** product-engineer
**Depends on:** SPEC.md + PLAN.md `**Status:** Aprovado`

Markers: `[ ]` OPEN → `[-]` IN PROGRESS → `[x]` DONE. At most one `[-]` per owner at a
time unless a disjoint write-set is declared. Implementer role: `software-engineer`;
`qa-engineer` owns the test gate (T-10) and co-owns the Node unit tests in T-02.

Ordering: T-01 → T-02 → T-03 gate the rest. T-04..T-09 may proceed once T-03 is green;
**T-06 depends on T-04 (roads) and T-05 (river).** T-10 is last.

---

### [x] T-01 — Offline DEM bake tool + vendored asset + attribution metadata
- **Owner:** software-engineer
- **Write-set:** `aero-fighters/tools/bake-inhauma-dem.mjs` (new),
  `aero-fighters/assets/inhauma-dem/heightmap.u16` (new, vendored),
  `aero-fighters/assets/inhauma-dem/heightmap.json` (new, vendored)
- **Preconditions:** none (dev-only tool; no runtime coupling)
- **Acceptance:**
  - Node tool fetches + stitches AWS Terrarium tiles (`s3://elevation-tiles-prod`,
    anonymous) for the pinned dramatic alpine valley region (Chamonix-style U-valley;
    exact tile region pinned in the tool + recorded in metadata), rescales to game units.
  - Emits a quantized `Uint16` raw binary heightmap (1024²–2048²) + a JSON metadata file
    with `dims`, `worldSize`, `heightRange`, `sourceTiles`, and `attribution`
    (Tilezen/joerd). Raw asset ≤ ~8 MB (measured; downscale/crop if over).
  - The tool is never imported by any runtime module. Re-running reproduces the asset.

### [x] T-02 — Node-safe bilinear heightmap sampler + unit tests
- **Owner:** software-engineer (unit tests co-owned by qa-engineer)
- **Write-set:** `aero-fighters/src/maps/heightmap-sampler.js` (new),
  `tests/aero-fighters/tools/test-aero-unit.js` (extend)
- **Preconditions:** T-01 asset committed
- **Acceptance:**
  - `sampleDemHeight(x,z)` (bilinear), `demSlopeAt(x,z)`, `demBounds()` exposed; pure JS,
    no DOM, no `<canvas>`. Loads the raw binary via `fetch`/ArrayBuffer (browser) or `fs`
    (Node), decoding **identically**.
  - Module imports cleanly in Node (`validate:aero-map`/sim harness).
  - Unit tests assert byte-identical sample values at fixed coordinates in Node and
    boundary/clamp behavior at the asset edges.

### [x] T-03 — Base-height integration behind the surface-truth seam + sim validation
- **Owner:** software-engineer
- **Write-set:** `aero-fighters/src/maps/inhauma-scene.js` (base swap only),
  `tests/aero-fighters/tools/test-aero-sim.js` (extend)
- **Preconditions:** T-02 sampler green
- **Acceptance:**
  - `inhaumaBaseHeight` sources `sampleDemHeight` (+ optional small detail noise);
    `INHAUMA_FEATURES` contribution removed; pipeline order preserved (DEM → road-bed
    carve → airport clearing; river/portal added in later tasks). `inhaumaContinuousHeight`
    contract unchanged.
  - Sim confirms mesh = collision everywhere sampled (WS-1), at least one flyable pass
    through a chain with width ≥ `MIN_PASS_WIDTH`, mission targets grounded, airport
    clearing operational.
  - `npm run validate:aero-map` green.

### [ ] T-04 — Re-author the 4 road corridors along the new valley
- **Owner:** software-engineer
- **Write-set:** `aero-fighters/src/maps/inhauma-road-defs.js`
- **Preconditions:** T-03 green
- **Acceptance:**
  - MG-238 / Anel de Inhaúma / AMG-0360 / MG-060 control points re-positioned along the
    new valley (highway follows the valley; tunnels/portals pierce spurs). Module stays
    Node-importable (pure-JS Catmull sampler + `getPortalMounds` intact).
  - `inhauma-fidelity.spec.js` invariants hold: nothing submerged, no corridor over a
    peak, no airport-exclusion intrusion, closed ring stays closed, open ends enter a
    tunnel (real slope or portal mound).

### [ ] T-05 — DEM-drainage river carve + water render
- **Owner:** software-engineer
- **Write-set:** `aero-fighters/src/maps/inhauma-river.js` (new),
  `aero-fighters/src/maps/inhauma-scene.js` (wire river carve + water)
- **Preconditions:** T-03 green
- **Acceptance:**
  - River polyline derived from the DEM lowest-path (drainage), carved slightly into the
    valley floor via the height chain (not a separate collision path).
  - Rendered with `createFlowingWater` (lake, if any, `createReflectiveWater`); flying
    into the river reads `kind:'water'` (splash/sink). River drawn along its whole
    polyline (WS-3).

### [ ] T-06 — Bridges at road × river crossings
- **Owner:** software-engineer
- **Write-set:** `aero-fighters/src/maps/inhauma-bridges.js` (new),
  `aero-fighters/src/maps/inhauma-scene.js` (register bridge structures)
- **Preconditions:** T-04 (roads) **and** T-05 (river) green
- **Acceptance:**
  - Each road × river crossing gets a bridge: deck aligned to the road + instanced piers,
    registered as `structure` AABBs (collision via `inhaumaStructureInfoAt`).
  - No road corridor dips below the water line at a crossing; the deck spans the channel.

### [ ] T-07 — Biome colors (rock/snow) + conditional `TERR.seg` bump
- **Owner:** software-engineer
- **Write-set:** `aero-fighters/src/maps/inhauma-scene.js` (`biomeColor`, `TERR`)
- **Preconditions:** T-03 green
- **Acceptance:**
  - `biomeColor(h)` → `biomeColor(h, slope)`: valley grass → forest band → exposed rock
    on steep/high → snow above a noise-jittered snow line. Vertex-color Lambert preserved
    (no PBR).
  - `TERR.seg` bumped above 54 **only if** the 1-chunk-per-frame rebuild budget and warmup
    FPS hold (D-6); otherwise left at 54. Documented in the commit.

### [ ] T-08 — Tree placement rules (tree line / slope / river proximity)
- **Owner:** software-engineer
- **Write-set:** `aero-fighters/src/maps/inhauma-scene.js` (`buildForests`)
- **Preconditions:** T-05 (river) + T-07 (biome) green
- **Acceptance:**
  - Placement filtered by altitude < tree line, a max slope, and a river-proximity density
    boost; airport/urban/road/river exclusions preserved.
  - 3–5 visually distinct instanced species with per-instance color jitter kept (WS-3).

### [ ] T-09 — City terracing on the valley shelf + airport shelf
- **Owner:** software-engineer
- **Write-set:** `aero-fighters/src/maps/inhauma-scene.js` (`buildTown`)
- **Preconditions:** T-03 green
- **Acceptance:**
  - `buildTown` relocated from the origin grid onto a flattened valley shelf near the
    airport, with terraced rows following the lower slopes. Structures stay collision-
    registered. Airport remains operational.

### [ ] T-10 — Tests green + in-game DEM attribution credit
- **Owner:** qa-engineer (implementation fixes routed to software-engineer)
- **Write-set:** in-game credits surface (HUD/menu overlay module),
  `tests/aero-fighters/*.spec.js` (Inhaúma smoke + attribution assertion),
  `tests/aero-fighters/inhauma-fidelity.spec.js` (update expectations for the new terrain)
- **Preconditions:** T-04..T-09 green
- **Acceptance:**
  - `npm run test:aero:qa` green (chains `validate:aero-map` + `test:aero:unit` +
    `test:aero:sim` + `test:aero:e2e`); sampler unit tests + Playwright Inhaúma smoke
    pass; `desert`, `rio`, `islands` show no regression.
  - Tilezen/joerd (AWS Terrain Tiles) attribution is visible in-game and a Playwright
    assertion checks the credit text (AC-09).
  - Closure evidence captured: screenshot/Playwright of the rugged Inhaúma scene (chains,
    valley river, snow line, bridges, terraced city).

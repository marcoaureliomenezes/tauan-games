# PLAN — Release: aero-fighters-inhauma-serra-v1

**Status:** Aprovado
**Release ID:** aero-fighters-inhauma-serra-v1
**Owner:** product-engineer
**Depends on:** SPEC.md `**Status:** Aprovado` (this release)

---

## 1. Strategy

Rebuild Inhaúma from one DEM-derived surface-truth model **without breaking the single
`inhaumaContinuousHeight` seam** that feeds both the visual mesh and collision. The base
height source is swapped (FBM + `INHAUMA_FEATURES` → baked DEM sample); every layer above
it (roads, river, biomes, trees, bridges, city) is re-derived from the new terrain. The
work is strictly additive to the runtime pipeline order and never introduces a second
collision-height path (WS-1 golden rule).

Sequencing principle: **terrain first, layers after.** Nothing downstream (roads, river,
biomes, trees, bridges, city) is authored until the DEM base is sampling correctly behind
the seam and the sim confirms mesh = collision. This avoids re-authoring layers twice.

---

## 2. The single surface-truth seam (must not change contract)

Today (`inhauma-scene.js`):

```
inhaumaContinuousHeight(x,z)
  = applyInhaumaRoadBed(x, z, inhaumaBaseHeight(x,z), inhaumaBaseHeight)

inhaumaBaseHeight(x,z)
  = FBM + ridgedFBM                    ← REPLACED THIS RELEASE
  + Σ featureContribution(INHAUMA_FEATURES)  ← REMOVED THIS RELEASE
  + portalMoundContribution
  − river carve (authored RIVER polyline)   ← REPLACED (DEM-drainage river)
  − reservoir basin
  clamp(≥0) → applyAirportClearing
```

After this release `inhaumaBaseHeight` becomes:

```
inhaumaBaseHeight(x,z)
  = sampleDemHeight(x,z)               ← NEW (bilinear DEM sample, world-scaled)
  + smallDetailNoise(x,z)              ← optional micro-relief on top of DEM
  + portalMoundContribution            ← kept if still needed for road ends
  − riverCarve(x,z, DEM-drainage polyline)   ← NEW river source
  clamp(≥0) → applyAirportClearing
```

`inhaumaContinuousHeight` and its caller contract are unchanged. Collision keeps reading
this one function via the giant `game.islands[]` region. No layer computes its own height.

---

## 3. Module list & layers affected

| Module (new / changed) | Layer | Change |
|---|---|---|
| `aero-fighters/tools/bake-inhauma-dem.mjs` **(new, dev-only)** | asset bake | Fetch + stitch AWS Terrarium tiles for the pinned alpine valley region; rescale to game units; emit vendored `Uint16` raw heightmap + JSON metadata (dims, world size, height range, source tiles, attribution). Never imported by runtime. |
| `aero-fighters/assets/inhauma-dem/heightmap.u16` + `heightmap.json` **(new, vendored)** | asset | The baked DEM output committed to the repo, like `waternormals.jpg`. |
| `aero-fighters/src/maps/heightmap-sampler.js` **(new)** | terrain base | Pure-JS, Node-safe, bilinear sampler. Loads the raw binary via `fetch`/ArrayBuffer (browser) or `fs` (Node); exposes `sampleDemHeight(x,z)`, `demSlopeAt(x,z)`, `demBounds()`. No DOM, no canvas. |
| `aero-fighters/src/maps/inhauma-scene.js` **(changed)** | terrain / biome / trees / city | Swap `inhaumaBaseHeight` base to `sampleDemHeight` + optional detail noise; remove `INHAUMA_FEATURES` contribution; extend `biomeColor(h)` → `biomeColor(h, slope)` (rock/snow); re-gate `buildForests`; relocate `buildTown` to the valley shelf; wire bridges. |
| `aero-fighters/src/maps/inhauma-road-defs.js` **(changed)** | roads | Re-author the 4 corridors' control points along the new valley; keep the pure-JS Catmull sampler and portal-mound machinery Node-importable. |
| `aero-fighters/src/maps/inhauma-river.js` **(new)** | river | Derive the river polyline from the DEM lowest-path (drainage); expose the carve function + the polyline for render/collision. |
| `aero-fighters/src/maps/inhauma-bridges.js` **(new)** | bridges | Detect road × river crossings; emit deck + instanced piers; register structure AABBs (collision) via the existing `structures[]` / `inhaumaStructureInfoAt` path. |
| `aero-fighters/src/environment/water-surface.js` **(reused, no API change)** | water | River rendered with `createFlowingWater`; any lake with `createReflectiveWater`. |
| `aero-fighters/src/landing-zones.js` **(reused)** | airport | `applyAirportClearing` still last in the height chain; airport shelf clearing preserved. |
| In-game credits (HUD/menu overlay) **(changed)** | attribution | Show Tilezen/joerd (AWS Terrain Tiles) attribution (AC-09). |
| `tests/aero-fighters/tools/*` + `tests/aero-fighters/*.spec.js` **(changed/new)** | tests | Sampler unit tests (Node); sim validation of mesh=collision + flyable pass + grounded targets; Playwright Inhaúma smoke; keep `inhauma-fidelity.spec.js` invariants. |

---

## 4. Execution order (maps to TASKS)

1. **T-01 Bake tool + vendored asset + attribution metadata.** Pin the tile region; produce
   the `Uint16` raw + JSON; commit under `assets/`. Zero runtime coupling.
2. **T-02 Sampler module + Node unit tests.** Bilinear sample, slope, bounds; identical
   decode in Node and browser proven by unit tests.
3. **T-03 Base-height integration behind the seam + sim validation.** Swap
   `inhaumaBaseHeight` to the DEM; remove `INHAUMA_FEATURES`; keep the pipeline order;
   sim confirms mesh = collision, flyable pass ≥ `MIN_PASS_WIDTH`, targets grounded,
   airport operational.
4. **T-04 Road re-authoring on the new valley.** Re-position corridor control points; keep
   dry-terrain / non-peak / airport-exclusion invariants (`inhauma-fidelity.spec.js`).
5. **T-05 River carve + water.** DEM-drainage polyline, slight carve, `createFlowingWater`
   render; flying into it reads `kind:'water'`.
6. **T-06 Bridges at crossings.** Deck + instanced piers at road × river; structure-
   registered collision; no road dips into water.
7. **T-07 Biome colors (rock/snow) + optional `seg` bump (conditional per D-6).**
8. **T-08 Tree placement rules.** Tree line + slope limit + river-proximity boost; keep
   3–5 species + jitter; exclusions preserved.
9. **T-09 City terracing + airport shelf.** Relocate `buildTown` to the valley shelf,
   terraced rows.
10. **T-10 Tests green + in-game attribution credit.** `test:aero:qa` + sampler units +
    Playwright smoke; no regression to the other 3 maps; attribution visible in-game.

Layers 4–9 may proceed once T-03 is green; T-06 depends on T-04 (roads) and T-05 (river).

---

## 5. Technical risks & mitigations (impl-level; SPEC §6 has the release risk table)

- **Asset size (R-1):** measure `heightmap.u16` before commit; if > ~8 MB raw, reduce
  resolution to 1024² or crop the region. Keep it a single vendored file.
- **Node/browser decode parity (R-5):** the sampler is the ONLY decode path; unit tests
  assert `sampleDemHeight` returns byte-identical values for fixed coordinates in Node.
  No `<canvas>`/`ImageData` anywhere in the runtime path.
- **Mesh/collision divergence (R-6):** no code outside `inhaumaContinuousHeight` computes
  height; the sim's collision-vs-surface assertion is the gate.
- **Road invariants (R-2):** re-author against sampled DEM heights; reuse `getPortalMounds`
  for open ends on flat rural terrain; the fidelity spec (nothing submerged, no peak, no
  airport exclusion, closed ring stays closed) must stay green.
- **Chunk budget (R-3, D-6):** only bump `TERR.seg` if the 1-chunk-per-frame rebuild budget
  and warmup FPS hold; otherwise leave `seg=54`. Keep the 3×3 streamed chunk window.
- **Airport/mission (R-7):** `applyAirportClearing` stays last in the chain; valley shelf
  hosts the city near the airport; sim asserts takeoff/landing playable and targets
  grounded.

---

## 6. Validation plan

| What | Command | Gate |
|---|---|---|
| Terrain math importable in Node; map invariants | `npm run validate:aero-map` | AC-08, AC-02 |
| Sampler + unit assertions (Node decode parity) | `npm run test:aero:unit` | AC-08, R-5 |
| Flight/collision sim (mesh=collision, flyable pass, grounded targets, airport ok) | `npm run test:aero:sim` | AC-01, AC-02, AC-08, R-6, R-7 |
| Inhaúma scene smoke + fidelity + no regression to desert/rio/islands | `npm run test:aero:e2e` | AC-04..AC-07, AC-10 |
| Full chained gate | `npm run test:aero:qa` | AC-10 |
| Attribution visible in-game | Playwright smoke asserts credit text | AC-09 |

Closure requires all of the above green plus screenshot/Playwright evidence of the new
Inhaúma scene (rugged chains, valley river, snow line, bridges, terraced city).

---

## 7. Rollback

The DEM base swap is contained in `inhaumaBaseHeight` and the vendored asset. If a hard
blocker appears (asset budget, decode parity, FPS regression that D-6 cannot resolve),
revert `inhauma-scene.js` to the FBM base and drop the new modules — the seam contract is
unchanged, so the other maps and the flight/collision core are never at risk.

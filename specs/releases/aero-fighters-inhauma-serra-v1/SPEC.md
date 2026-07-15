# SPEC — Release: aero-fighters-inhauma-serra-v1

**Status:** Aprovado
**Aprovação:** 2026-07-14 — operator research + approval session (see Decision D-0). The
operator mandated full autonomous execution today: "go ahead through release definition
and implementation full." The DEM-based pipeline, the zero-cost source path, and the
stylized snow on a Brazilian-named map were all approved in that session.
**Release ID:** aero-fighters-inhauma-serra-v1
**Owner:** product-engineer
**Opened:** 2026-07-14
**Consumes:** `specs/backlog/aero-fighters-inhauma-serra-v1.md`
**Supersedes:** the FBM + `INHAUMA_FEATURES` base-terrain approach of Inhaúma (v0.2.0
kept the hand-authored FBM base; this release replaces the base with a DEM sample)

---

## 1. Problem and context

The Inhaúma map (`aero-fighters/`, map key `inhauma`) today reads as **"a plain with a
few isolated hills"**: a value-noise FBM base plus 7 hand-authored radial features in
`INHAUMA_FEATURES` (`inhauma-scene.js`), tops out at ~140 m, and the named hills are
disconnected bumps rather than a mountain system. There are no ridgelines, no flyable
passes, no carved valleys, no exposed rock, no snow line, and the city is a flat
InstancedMesh grid around the origin. The river is an authored polyline (`RIVER`) that
carves the heightfield but does not follow real drainage, and the 4 authored road
corridors run over gentle terrain.

The operator wants a **change of concept**, not incremental detail: Inhaúma should become
*terreno acidentado* — a realistic, beautiful mountain-chain scenario where connected
chains, carved valleys, a river along the valley floor, rock/snow biomes, styled trees
with a tree line, bridges, and a terraced city all derive from **one coherent terrain
model**.

A verified deep-research session (2026-07-14) established that pure procedural noise
cannot produce believable valley networks, and that a real Digital Elevation Model (DEM)
gives the "acidentado" character. **AWS Terrain Tiles** (Terrarium PNG on
`s3://elevation-tiles-prod`, anonymous, attribution-only Tilezen/joerd license) were
verified fetchable today (HTTP 200). The approved path bakes a dramatic alpine valley DEM
**offline** into a vendored local asset, then samples it behind the existing single
surface-truth seam — keeping every current invariant (no build step, no runtime external
fetch, vertex-color Lambert look, Node-importable terrain math, chunk streaming, mesh =
collision truth).

The current implementation facts this release must preserve or replace are recorded in
`specs/memory/product/aero-strike-world.md` (surface-truth contract, chunk streaming,
road/water/tree layers) and `specs/memory/tech-stack.md` (vendored Three.js, no build,
no runtime external assets).

---

## 2. Objective

Rebuild the Inhaúma map from **one DEM-derived surface-truth model** so that connected
mountain chains, carved valleys, a drainage-following river, rock/snow biomes, an
altitude/slope/river-aware forest with a tree line, road-over-river bridges, and a
terraced valley-shelf city all fall out of the same terrain — at zero tooling cost, with
no runtime external fetch and no regression to the other 3 maps.

---

## 3. Scope

All Inhaúma layers derive from ONE coherent terrain model. The 7 concept points from the
operator demand become the acceptance criteria below. Each is a hard gate for closure.

### AC-01 — Mountain chains, not isolated hills
The Inhaúma base height comes from a baked real-DEM alpine valley (connected ridgelines
with crests, spurs, and flyable passes), **replacing** the FBM + `INHAUMA_FEATURES` base.
There is at least one continuous chain on each side of the main valley, and at least one
flyable pass through a chain at or below the flight ceiling with a pass width ≥ the design
minimum (recorded in PLAN as `MIN_PASS_WIDTH`).

### AC-02 — Carved valleys as flight corridors
The main valley floor forms a continuous low corridor a jet can fly along between the two
chains. Valley floor and pass widths let the player's aircraft transit without clipping
terrain (validated by the sim, since collision = rendered surface truth).

### AC-03 — River threading the valley floor by drainage
A river polyline is derived from the DEM's lowest-path (drainage), not painted
arbitrarily, carved slightly into the valley floor and rendered with the existing water
module (`createFlowingWater` / `createReflectiveWater`). Flying into the river behaves as
water (`kind:'water'`), same as today.

### AC-04 — Rocky terrain + snow above a snow line
`biomeColor` extends from an altitude-only palette to **(altitude, slope)**: valley grass
→ forest band → exposed rock on steep/high slopes → snow above a noise-jittered snow line.
Snow is stylized (a Brazilian-named map with snow is an accepted artistic choice —
D-3). The vertex-color Lambert look is preserved (no PBR).

### AC-05 — Styled trees positioned by altitude / slope / river proximity, with a tree line
Tree placement (`buildForests`) is filtered by: altitude below a tree line, a maximum
slope, and a river-proximity density boost; excluded from airport/urban/road/river as
today. The 3–5 distinct instanced species and per-instance color jitter are preserved
(WS-3, `aero-strike-world.md`).

### AC-06 — Bridges where roads cross the river
At each road × river crossing a bridge structure is generated: a deck aligned to the road
plus instanced piers, registered for collision as a `structure` (via
`inhaumaStructureInfoAt` / structure AABBs). Roads no longer dip into the water at
crossings.

### AC-07 — City rebuilt terraced on a valley shelf / lower slopes
`buildTown` is relocated from the origin grid onto a flattened valley shelf near the
airport, with terraced rows following the lower slopes rather than a flat grid on a plain.
Structures stay collision-registered.

### AC-08 — Single coherent model + invariants preserved
- One surface-truth function feeds BOTH the visual mesh AND collision
  (`inhaumaContinuousHeight` seam unchanged in contract): DEM base → road-bed carve →
  airport clearing → river carve → portal mounds (if still needed). Mesh and collision
  never diverge (WS-1, golden rule in `aero-strike-world.md`).
- Terrain math modules (`noise.js`, the new sampler, `inhauma-road-defs.js`,
  `inhauma-scene.js`) stay importable in **Node** (no DOM): `validate:aero-map` and the
  sim tests import them.
- The vendored heightmap asset decodes **identically** in browser (fetch/ArrayBuffer) and
  Node (fs) — raw binary, no canvas-only path.
- No runtime external fetch: the DEM is vendored like `waternormals.jpg`; all AWS access
  happens in the offline bake tool only.
- Airport stays operational (clearing preserved); mission targets remain placeable and
  grounded.

### AC-09 — DEM attribution ships in-game
The Tilezen/joerd (AWS Terrain Tiles) attribution is displayed in-game (credits/overlay)
and recorded in the vendored asset's JSON metadata, per the attribution-only license.

### AC-10 — Tests green
`npm run test:aero:qa` (which chains `validate:aero-map` + `test:aero:unit` +
`test:aero:sim` + `test:aero:e2e`) passes, plus the new sampler unit tests and a
Playwright smoke of the Inhaúma scene. No regression to `desert`, `rio`, `islands`.

---

## 4. Out of scope

- **The other 3 maps** (`islands`, `desert`, `rio`) are unchanged. This is Inhaúma-only.
- **No PBR materials** — the vertex-colored `MeshLambertMaterial` look stays (warmup-FPS
  constraint: PBR shader compilation stalls takeoff FPS).
- **No LOD system** — none exists today and none is introduced. Chunk streaming stays the
  only budget mechanism.
- **No runtime external fetch / no live tiles** — the game never contacts AWS, OSM, or any
  tile server at runtime. Only the offline dev bake tool touches the network.
- **No build step, no bundler, no TypeScript** — plain ES modules, opened directly.
- **No erosion simulation / no paid tools** — zero-cost DEM bake only.
- **No new engine work** — Godot/UE5 ladder untouched.
- **Mission/combat system** unchanged beyond target placement staying valid on the new
  terrain.

---

## 5. Decisions (ADRs)

### D-0 — Mandatory grill satisfied by the operator research + approval session
The `dadaia-release-definition` mandatory `dadaia-grill-me` was conducted on **2026-07-14**
as an operator research + approval session on the picked scope (this single backlog entry;
no open bugs or audits contend for this release). Outcome: the DEM-based bake pipeline is
approved, the zero-cost source path is approved, stylized snow on a Brazilian-named map is
approved, and the concept change to *terreno acidentado* is the release goal. No open
question remained unresolved before this SPEC was written.

### D-1 — Source terrain from AWS Terrain Tiles (Terrarium), baked offline, vendored local
Use AWS Terrain Tiles (`s3://elevation-tiles-prod`, anonymous, attribution-only). A Node
bake tool under the game's `tools/` dir (dev-run, never runtime) fetches + stitches tiles
for a chosen dramatic alpine valley region (recommendation: a Chamonix-style deep U-valley
between two chains; the exact tile region is pinned during implementation), rescales to
game units, and emits a **vendored** asset: a quantized `Uint16` raw binary heightmap
(1024²–2048²) + JSON metadata (dims, world size, height range, source tiles, attribution).
Raw binary (not PNG) so browser and Node decode identically. Target ≤ ~8 MB raw, small on
gzip transfer. Rationale: real DEM gives the "acidentado" valley character procedural
noise cannot; vendoring keeps the "no runtime external loads" principle intact.

### D-2 — New heightmap sampler becomes the base of `inhaumaBaseHeight`
A new pure-JS, Node-safe, bilinear heightmap-sampler module replaces the FBM +
`INHAUMA_FEATURES` base inside `inhaumaBaseHeight`. Kept on top of the DEM sample, in
order: road-bed carve (`applyInhaumaRoadBed`), airport clearing (`applyAirportClearing`),
river carve, and portal mounds if still needed. Small high-frequency procedural detail
noise may be layered on the DEM sample for micro-relief. The `inhaumaContinuousHeight`
seam (mesh + collision) is contract-unchanged.

### D-3 — Stylized snow accepted on a Brazilian-named map
Snow above a noise-jittered snow line is an accepted artistic choice for Inhaúma; realism
of the biome yields to the game's alpine concept. Recorded so it is not later flagged as
a geography error.

### D-4 — Roads re-authored along the new valley; river by DEM lowest-path; bridges at crossings
The 4 corridors (`INHAUMA_ROAD_CORRIDORS`: MG-238, Anel de Inhaúma, AMG-0360, MG-060)
keep their identity but their control points are re-positioned along the new valley (the
highway follows the river valley; tunnels/portals pierce spurs where needed). The river is
a polyline along the valley floor derived from the DEM lowest-path, carved slightly.
Bridges are generated at road × river crossings (deck + instanced piers, collision-
registered). The shared pure-JS Catmull sampler and portal-mound machinery are reused.

### D-5 — Biome extended to (altitude, slope); trees gated by tree line + slope + river proximity
`biomeColor(h)` becomes `biomeColor(h, slope)`: grass → forest → rock on steep/high →
snow above the snow line. Tree placement is filtered by altitude < tree line, a slope
limit, and a river-proximity density boost. Vertex-color Lambert preserved.

### D-6 — Chunk budget: `TERR.seg` bump allowed only if the 1-chunk/frame rebuild holds
Raising `TERR.seg` (currently 54; grid ~48 m over chunkSize 2600) to sharpen ridgelines is
permitted **only if** the "max 1 chunk rebuild per frame" budget still holds and warmup FPS
on target hardware does not regress. Otherwise `seg` stays 54. Keep the 3×3 streamed chunk
window.

### D-7 — City on a flattened valley shelf; other maps deferred
`buildTown` relocates to a terraced valley shelf near the airport. The concept change is
scoped to Inhaúma this release; applying it to the other maps is explicitly **deferred** to
future backlog.

---

## 6. Dependencies and risks

### Dependencies
- Dev-machine network access to `s3://elevation-tiles-prod` **at bake time only** (verified
  reachable 2026-07-14, HTTP 200). Runtime has no such dependency.
- The existing single surface-truth seam (`inhaumaContinuousHeight`), road machinery
  (`inhauma-road-defs.js`, `inhauma-roads.js`, portal mounds), water module
  (`environment/water-surface.js`), airport clearing (`landing-zones.js`), and the Node
  test harness (`validate:aero-map`, `test:aero:sim`, `test:aero:unit`).

### Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R-1 | Vendored asset too large (load time / repo bloat) | Med | Med | Quantize to Uint16, pick 1024²–2048², target ≤ ~8 MB raw / small gzip; measure before commit; downscale region if over budget. |
| R-2 | Road re-authoring effort — 4 corridors must land on dry, non-peak terrain over the new DEM (WS-2 tunnel/portal invariant, airport exclusion) | High | Med | Re-derive control points against the sampled DEM; reuse portal-mound generator; keep `inhauma-fidelity.spec.js` as the gate (nothing submerged, no peak, no airport exclusion). |
| R-3 | Chunk rebuild cost at higher `seg` regresses warmup FPS | Med | High | D-6: `seg` bump is conditional; fall back to 54; keep 1-chunk/frame budget; validate with Playwright fidelity thresholds. |
| R-4 | DEM licensing — attribution must ship | Low | High | AC-09: in-game credit + metadata attribution; attribution-only license honored; no relicensing of tiles. |
| R-5 | Browser/Node decode divergence of the asset | Med | High | D-1 raw binary (no canvas); one sampler module used by both; sampler unit tests assert identical samples in Node. |
| R-6 | Mesh/collision divergence after base swap (WS-1) | Med | Critical | Keep the single `inhaumaContinuousHeight` seam; sim validates collision against rendered surface; no separate collision height path. |
| R-7 | Airport/mission playability breaks on rugged terrain | Med | High | Keep airport clearing + valley-shelf placement; sim asserts targets grounded and takeoff/landing playable. |

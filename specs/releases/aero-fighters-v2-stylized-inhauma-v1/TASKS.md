# TASKS: Aero Fighters v2 — Stylized Inhaúma (MVP-2)

> **Status:** Aprovado — 2026-05-17 (SPEC + PLAN both approved; ready for Wave 1)
> **Author:** product-engineer (dadaia Labs)
> **Created:** 2026-05-17
> **SPEC:** `specs/releases/aero-fighters-v2-stylized-inhauma-v1/SPEC.md`
> **PLAN:** `specs/releases/aero-fighters-v2-stylized-inhauma-v1/PLAN.md`
> **Release id:** `aero-fighters-v2-stylized-inhauma-v1`
> **Supersedes:** `aero-fighters-v2-photorealistic-inhauma-v1` (cancelled 2026-05-17)
> **Grill input:** `.dadaia/reports/tauan-games/product-engineer/2026-05-17T210822Z-stylized-pivot.html`

---

## Status note

This is a **scaffold + carryover ledger only**. The full task list is composed
after both the SPEC and the PLAN reach `**Status:** Aprovado`. The seed
tasks below preview the first-wave dependencies after the carryover ledger
is honored.

## Marker convention (from `dadaia-task-manager` skill)

| Marker | State | Meaning |
|---|---|---|
| `[ ]` | OPEN | task declared, no agent reserved it |
| `[-]` | IN PROGRESS | reserved by an agent; only one allowed per file |
| `[x]` | DONE | implemented, verified, committed |

---

## Carryover from cancelled aero-fighters-v2-photorealistic-inhauma-v1

| Old task | Carryover decision | New task (if any) |
|---|---|---|
| T-001 (Cesium plugin pin) | CANCELLED — Cesium gone | — |
| T-002 (self-hosted runner) | CANCELLED — replaced by S1 lint-only CI | — |
| T-003 (HandModeled.md) | SURVIVES CLEAN | New T-S-03 |
| T-004 (5-module UE5 layout w/ Georef seam) | REWRITE — 4 modules now (no Georef isolation) | New T-S-04 |
| T-005 (DA_AeroFightersV2Config) | REWRITE — new origin model + mission config | New T-S-05 |
| T-006 (lint-cesium-isolation.sh) | DELETE — Cesium gone | — |
| T-007 (AcceptanceCriteria.md) | REWRITE | New T-S-07 |
| T-008 (screenshot-diff-harness.py) | ALGORITHM SURVIVES; baselines rewrite | New T-S-08 |
| T-009 (perf-harness.py) | ALGORITHM SURVIVES; thresholds repin | New T-S-09 |
| T-010 (tile-cache-populate.py) | DELETE — Cesium API gone | — |
| T-011 (.env.local.example) | REWRITE | New T-S-11 |
| T-012 (README.md) | REWRITE | New T-S-12 |
| T-013 (.gitignore) | SURVIVES CLEAN | New T-S-13 |
| T-014 (.gitattributes) | SURVIVES CLEAN | New T-S-14 |

Surviving clean: 4 (T-003, T-008 algo, T-009 algo, T-013, T-014 — counted as 4 by the
audit, with T-008/T-009 partial under "algorithm survives").
Rewrite: 5 (T-004, T-005, T-007, T-011, T-012).
Cancelled / deleted: 5 (T-001, T-002, T-006, T-010 + cancelled-release-only artifacts).

---

## Seed tasks (ordered by dependency)

- **T-S-01 [ ] OPEN — Pin UE 5.5 release for stylized profile.**
  Owner: `game-developer`. Install UE 5.5 (latest stable point release at impl
  start) configured for **Forward Shading** project template (not Mobile, not
  Deferred). Lumen OFF, Nanite OFF at project-create time. No Cesium plugin
  installed. Record exact UE version string in `aero-fighters-v2/docs/ue-version.md`.
  Blocks all subsequent work.

- **T-S-02 [ ] OPEN — Create lint-only GH-hosted CI workflow for stylized
  release.** Owner: `devops-engineer`. Path: `.github/workflows/aero-v2-stylized-ci.yml`.
  Runs on `ubuntu-latest`: clang-format check, `Build.cs` module-dependency check,
  Git LFS verify, headless FTF run via `xvfb-run` + software Vulkan (subject to
  RR-V2-S-10 mitigation in PLAN). No self-hosted runner. Replaces cancelled T-002.

- **T-S-03 [x] DONE — Survives carry: `Content/Aircraft/HandModeled.md` is
  present in new release dir.** Owner: `game-developer`. Verify the file
  authored under cancelled T-003 (`aero-fighters-v2/Content/Aircraft/HandModeled.md`)
  is still in place under the new release's working tree. The file is engine-
  agnostic and cel-friendly geometry already; no edits needed. Closure: confirmed
  in pivot commit chore(specs): pivot v2 to stylized.

- **T-S-04 [ ] OPEN — Stand up 4-module UE5 layout (no Georef module).**
  Owner: `game-developer`. Create modules `AeroFightersCore`,
  `AeroFightersTerrain`, `AeroFightersGameplay`, `AeroFightersCombat` with
  Build.cs dependency rules from SPEC §10. Land `UInhaumaWorldGeoref` utility
  in Core. No Cesium-isolation lint (Cesium gone). Implement round-trip
  cm-equality test for `FGeoCoord ↔ FVector` (AC-V2-S-17). Blocks all
  gameplay work.

- **T-S-05 [ ] OPEN — Create `DA_AeroFightersV2StylizedConfig` + `DA_AeroFightersV2StylizedMissionConfig`.**
  Owner: `game-developer`. Data Assets storing:
  - World origin: WGS84 `(-19.47, -44.46)` (Landscape centroid).
  - Pawn spawn: WGS84 `(-19.47, -44.46, 2095.0 m)` (≈ 500 m AGL).
  - Inhaúma bbox: ±0.20° around origin (for FR-V2-S-01 fetch).
  - Mission config: factory WGS84, base WGS84, AA cluster WGS84 (carries
    `(-19.490, -44.387)` from cancelled FR-V2-07).
  - Target HPs (factory 20, base 28, AA gun 6 ×3) + difficulty scaling
    coefficients (HP ×1.15/cycle, AA fire interval ×0.92/cycle).
  Wire into FTF assertions for AC-V2-S-02, AC-V2-S-03, AC-V2-S-06,
  AC-V2-S-07, AC-V2-S-08.

- **T-S-06 [ ] OPEN — OSM + SRTM fetch tool (`Tools/inhauma-data-fetch.py`).**
  Owner: `game-developer` (ops hat). Python tool that:
  - Downloads Brazil-southeast `.osm.pbf` from Geofabrik (or equivalent
    CC-mirror).
  - Clips to Inhaúma bbox via `osmconvert` or `osmium-tool`.
  - Exports building polygons + landuse polygons to JSON (since UE5 PCG
    cannot read PBF natively).
  - Downloads NASA SRTM 30 m tiles via NASA EarthData credentials.
  - Assembles tiles into a single GeoTIFF via `gdal_merge.py`.
  - Reprojects to UTM zone 23S.
  - Outputs `Content/World/inhauma-osm.pbf`, `inhauma-buildings.json`,
    `inhauma-landuse.json`, `inhauma-heightmap.tif`.
  - Idempotent + deterministic for fixed bbox + fixed source revisions.
  Replaces cancelled T-010 (`tile-cache-populate.py`). Records exact source
  revisions in `Content/World/SOURCES.md`.

- **T-S-07 [ ] OPEN — New AC-V2-S traceability matrix.**
  Owner: `game-developer` (tester hat). Path: `aero-fighters-v2/Tests/AcceptanceCriteria.md`.
  Rewrite the matrix for AC-V2-S-01..23 derived from SPEC §9. Maps each
  AC to test path + method (FTF / Python harness / manual) + owning wave.
  Replaces cancelled T-007 content (the old file is "REWRITE PENDING"
  tagged in the working tree pending this task).

- **T-S-08 [ ] OPEN — Update screenshot-diff harness baselines for cel-shaded poses.**
  Owner: `game-developer` (tester hat) + `game-designer` (hat). Path:
  `aero-fighters-v2/Tools/screenshot-diff-harness.py`. The SSIM + pHash
  algorithm survives from cancelled T-008 unchanged; only the per-pose
  baseline images and the thresholds change. Re-capture 4 fixed WGS84
  poses with cel-shader + Forward Shading active; commit cel-shaded
  baselines to `aero-fighters-v2/Tests/baselines/linux/` (LFS). Update
  thresholds to AC-V2-S-19 values (SSIM ≥ 0.78 per cam, mean ≥ 0.84,
  pHash ≤ 16). Drop Windows baselines (out of scope).

- **T-S-09 [ ] OPEN — Retune perf harness thresholds for Iris Xe.**
  Owner: `game-developer` (tester hat). Path:
  `aero-fighters-v2/Tools/perf-harness.py`. The frame-time series +
  percentile assertion algorithm survives from cancelled T-009 unchanged.
  Update the AC reference from `AC-V2-17` to `AC-V2-S-18`. The thresholds
  remain mean ≥ 60 FPS + p99 ≤ 18.5 ms — same numbers, different baseline
  hardware (Iris Xe replaces RTX 3060). Update the docstring + assertion
  message to cite the Iris Xe baseline.

- **T-S-10 [ ] OPEN — Cel-shader PostProcess Material + outline pass.**
  Owner: `game-developer`. Path: `aero-fighters-v2/Content/PostProcess/M_PP_CelShader.uasset`.
  Build the Material per FR-V2-S-12: diffuse step-quantization (3 bands),
  Sobel-edge outline on depth + normal, ×1.15 saturation lift. Cost target
  ≤ 0.8 ms on Iris Xe @ 720p (verified in T-S-09 perf harness).
  Calibration thresholds (depth-edge, normal-edge) tuned over ≥ 3
  calibration runs per PLAN; final values recorded in
  `aero-fighters-v2/docs/cel-shader-calibration.md`.

- **T-S-11 [ ] OPEN — Rewrite `.env.local.example`.**
  Owner: `game-developer` (ops hat). Path: `aero-fighters-v2/.env.local.example`.
  Strip `GOOGLE_MAPS_TILES_API_KEY` + `CESIUM_OFFLINE_TILES` + `CESIUM_TILE_CACHE_DIR`.
  Add `NASA_EARTHDATA_USERNAME` + `NASA_EARTHDATA_PASSWORD` + `OSM_BBOX_NORTH/SOUTH/EAST/WEST`
  (default: ±0.20° around Inhaúma). Reference 1Password item
  `aero-fighters-v2/nasa-earthdata`. Replaces cancelled T-011. File
  currently tagged `# REWRITE PENDING` in the working tree.

- **T-S-12 [ ] OPEN — Rewrite `README.md` for stylized scope.**
  Owner: `game-developer` (ops hat). Path: `aero-fighters-v2/README.md`.
  Update title + description to "Stylized cel-shaded flight game over
  Inhaúma MG, UE 5.5 + OSM + SRTM". Strip Cesium prereqs, Google Maps
  Tiles API, GCP cost-governance section. Add NASA EarthData setup,
  OSM ODbL attribution requirement, Linux-only build instructions. List
  CI as GH-hosted lint-only. Replaces cancelled T-012. File currently
  tagged `# REWRITE PENDING` in the working tree.

- **T-S-13 [x] DONE — Survives carry: `.gitignore` is engine-agnostic.**
  Owner: `game-developer` (ops hat). Verify `aero-fighters-v2/.gitignore`
  carried from cancelled T-013 is still valid. UE5 ignore list is render-
  agnostic; only the `.env.local` + `*-tile-cache` patterns survive
  (tile-cache pattern becomes a no-op since there's no tile cache, but
  is harmless). Closure: confirmed in pivot commit.

- **T-S-14 [x] DONE — Survives carry: repo `.gitattributes` is engine-agnostic.**
  Owner: `game-developer` (ops hat). Verify the repo-root `.gitattributes`
  (LFS patterns scoped to `aero-fighters-v2/**`) carried from cancelled
  T-014 is still valid. Patterns are engine + render-agnostic. Closure:
  confirmed in pivot commit.

- **T-S-15 [ ] OPEN — Hand-modeled aircraft → cel-friendly material rework.**
  Owner: `game-developer` + `game-designer` (hat). Depends on T-S-10. The
  hand-modeled delta-wing geometry from T-S-03 is already cel-friendly
  (low-poly). Swap its Material to a cel-friendly base Material that pairs
  with `M_PP_CelShader`. License unchanged (own-work).

- **T-S-16 [ ] OPEN — UE5 Landscape heightmap import workflow.**
  Owner: `game-developer`. Convert `Content/World/inhauma-heightmap.tif`
  (from T-S-06) to a UE5-importable PNG heightmap; import via UE5
  Landscape import; place in MVP map at origin. Verify Landscape height
  at WGS84 `(-19.47, -44.46)` within 5 m of source SRTM sample (AC-V2-S-02).
  Document workflow in `aero-fighters-v2/docs/landscape-import.md`.
  Depends on T-S-04 + T-S-06.

- **T-S-17 [ ] OPEN — OSM building extrusion via PCG.**
  Owner: `game-developer`. Build `PCG_InhaumaBuildings` graph that reads
  `Content/World/inhauma-buildings.json` (from T-S-06) and extrudes each
  polygon at `building:levels × 3.0 m` (default 3 levels). Apply
  `M_CelBuilding` Material. Verify ≥ 90% of OSM downtown buildings
  present (AC-V2-S-15). Depends on T-S-04 + T-S-06 + T-S-16 (Landscape
  must be in place for buildings to anchor to).

- **T-S-18 [ ] OPEN — Foliage scatter via UE5 PCG on OSM landuse polygons.**
  Owner: `game-developer`. Build `PCG_InhaumaFoliage` graph that reads
  `Content/World/inhauma-landuse.json` (from T-S-06) and scatters HISM
  instances per FR-V2-S-14 (≤ 12,000 instances, ~50 trees/ha forest,
  ~10 trees/ha grass). Hand-modeled own-work tree + bush low-poly meshes.
  Depends on T-S-17.

- **T-S-19 [ ] OPEN — Mission system (1-cycle loop, 3 target types, win-condition, +1 difficulty).**
  Owner: `game-developer`. Implement `UMissionSubsystem` (GameInstance
  subsystem) per FR-V2-S-08. State: current cycle counter, alive-target
  list, difficulty multipliers. On all 3 destroyed → "MISSION COMPLETE"
  HUD widget → 3 s pause → spawn next cycle with HP ×1.15 + AA interval
  ×0.92. Depends on T-S-04 + T-S-05.

- **T-S-20 [ ] OPEN — Three target actors (factory, base, AA cluster).**
  Owner: `game-developer`. `AFactoryActor` (HP 20, mega-explosion),
  `ABaseActor` (HP 28, multi-stage destruction: radar sub-event then
  building), `AAAGunClusterActor` (3 guns @ HP 6 each, fires back range
  220 m / interval 1.7 s base). All BP-first, C++ promotion per
  NFR-V2-S-05 triggers. Depends on T-S-04 + T-S-05.

- **T-S-21 [ ] OPEN — Determinism harness rewrite (cel + Forward Shading defaults).**
  Owner: `game-developer` (tester hat). Path:
  `aero-fighters-v2/Source/AeroFightersGameplay/HarnessTestMode.cpp`.
  Implements `aero.testMode 1` cvar per FR-V2-S-16. Replaces the
  cancelled SPEC's Lumen-based override set with cel-friendly + Forward
  Shading override set: `r.TemporalAASamples 1`, `r.MotionBlur.Amount 0`,
  cel-shader force-applied (PostProcess override), fixed Directional
  Light yaw 45° pitch -45°, fixed wind vector, fixed camera pose,
  Landscape-streaming gate (replaces tile-load gate; 10 s hard timeout).
  Depends on T-S-04 + T-S-10.

---

## Conventions

- One `[-]` IN PROGRESS at a time per this file. Pick a task with `[ ] →
  [-]` + commit `chore(tasks): start <task-id>` before any production edit.
- Close with `[-] → [x]` + commit `feat|fix|chore(scope): <message>
  (<task-id>)`.
- Production work in this release is rooted at `repos/tauan-games/aero-fighters-v2/`
  (shared working tree with the cancelled release; pivot retagged surviving
  files and removed Cesium-dependent ones).
- T-S-03 / T-S-13 / T-S-14 already `[x]` DONE — they are pure-carryover
  verification tasks whose evidence is the pivot commit itself.

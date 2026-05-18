# TASKS: Aero Fighters v2 — Godot Stylized Inhaúma (MVP-2)

> **Status:** Aprovado — 2026-05-18 (SPEC + PLAN both approved alongside this list during the pivot session)
> **Author:** product-engineer (dadaia Labs)
> **Created:** 2026-05-18
> **SPEC:** `specs/releases/aero-fighters-v2-godot-stylized-inhauma-v1/SPEC.md`
> **PLAN:** `specs/releases/aero-fighters-v2-godot-stylized-inhauma-v1/PLAN.md`
> **Release id:** `aero-fighters-v2-godot-stylized-inhauma-v1`
> **Supersedes:** `aero-fighters-v2-stylized-inhauma-v1` (cancelled 2026-05-18 — hardware constraint)
> **Grill input:** `.dadaia/reports/tauan-games/product-engineer/2026-05-18T005834Z-godot-pivot.html`

---

## Marker convention (from `dadaia-task-manager` skill)

| Marker | State | Meaning |
|---|---|---|
| `[ ]` | OPEN | task declared, no agent reserved it |
| `[-]` | IN PROGRESS | reserved by an agent; only one allowed per file |
| `[x]` | DONE | implemented, verified, committed |

---

## Carryover from cancelled aero-fighters-v2-stylized-inhauma-v1 (UE5 stylized release)

The cancelled stylized release had 21 tasks (T-S-01..T-S-21). All were
either OPEN or had been marked DONE via the pivot commit from the
photoreal release (T-S-03, T-S-13, T-S-14). The second pivot (UE5 →
Godot) invalidates most engine-specific carryover. This ledger encodes
the disposition. New tasks are renumbered T-G-01..T-G-23.

| Old task (stylized v1) | State at cancel | Carryover decision | New task (if any) |
|---|---|---|---|
| T-S-01 (UE 5.5 pin) | OPEN | CANCELLED — Godot install replaces | T-G-01 (new) |
| T-S-02 (lint-only UE5 CI) | OPEN | REWRITE — gdtoolkit / scene-validity jobs | T-G-02 |
| T-S-03 (HandModeled.md aircraft) | DONE | SURVIVES — engine-agnostic geometry spec; .gltf import in Godot | absorbed into T-G-15 + FR-V2-G-03 (file stays at `Content/Aircraft/HandModeled.md`) |
| T-S-04 (4-module UE5 layout) | OPEN | CANCELLED — Godot scene tree replaces | T-G-04 (new) |
| T-S-05 (UE5 Data Assets DA_*) | OPEN | REWRITE — Godot Resource files (.tres) | T-G-05 |
| T-S-06 (OSM + SRTM fetch) | OPEN | REWRITE — survives in spirit; output now feeds Terrain3D, not Landscape | T-G-06 |
| T-S-07 (AC matrix) | OPEN | REWRITE — AC-V2-G-XX content for Godot | T-G-07 |
| T-S-08 (screenshot-diff harness) | OPEN | REWRITE — algorithm survives; driver swaps to `godot --headless --script` | T-G-08 |
| T-S-09 (perf harness retune) | OPEN | REWRITE — algorithm survives; driver swaps to Godot frame-time export | T-G-09 |
| T-S-10 (cel-shader PostProcess Material UE5) | OPEN | CANCELLED — Godot CanvasItem shader replaces | T-G-10 (new) |
| T-S-11 (.env.local.example) | OPEN | REWRITE — drop UE_INSTALL_PATH, add GODOT_BIN_PATH | T-G-11 |
| T-S-12 (README.md) | OPEN | REWRITE — Godot 4 prereqs + scope | T-G-12 |
| T-S-13 (.gitignore) | DONE | REWRITE — UE5-shaped patterns replaced by Godot (.godot/, *.import, .uid) | T-G-13 |
| T-S-14 (.gitattributes LFS) | DONE | REWRITE — patterns adjusted for Godot binaries (.gltf, .ogg, .wav, .tres) | T-G-14 |
| T-S-15 (cel-friendly aircraft Material) | OPEN | REWRITE — Godot StandardMaterial3D Toon + ShaderMaterial | T-G-15 |
| T-S-16 (UE5 Landscape import) | OPEN | CANCELLED — Terrain3D import replaces | T-G-16 (new) |
| T-S-17 (UE5 PCG buildings) | OPEN | CANCELLED — GDScript scatter + MultiMeshInstance3D replaces | T-G-17 (new) |
| T-S-18 (UE5 PCG foliage) | OPEN | CANCELLED — GDScript scatter + MultiMeshInstance3D replaces | T-G-18 (new) |
| T-S-19 (UE5 UMissionSubsystem) | OPEN | CANCELLED — Godot Autoload MissionManager.gd replaces | T-G-19 (new) |
| T-S-20 (UE5 target Actors) | OPEN | CANCELLED — Godot target PackedScenes replace | T-G-20 (new) |
| T-S-21 (UE5 determinism harness) | OPEN | CANCELLED — Godot determinism harness replaces | T-G-21 (new) |

**Summary:**
- **Cancelled (engine-specific to UE5):** 10 — T-S-01, T-S-04, T-S-10,
  T-S-16, T-S-17, T-S-18, T-S-19, T-S-20, T-S-21 plus T-S-13/T-S-14 marked
  "rewrite" because their content is engine-shaped (counted under
  "rewrite" in the report).
- **Rewrite (intent survives, content engine-swap):** 7 — T-S-02, T-S-07,
  T-S-08, T-S-09, T-S-11, T-S-12, T-S-15 (and T-S-05/T-S-06 also map to
  rewrite tasks).
- **Survives clean:** 1 — T-S-03 (HandModeled.md content is unchanged;
  the file still lives at `Content/Aircraft/HandModeled.md` and is
  imported via .gltf in T-G-15).

The audit in the grill report counted "4 survive, 7 rewrite, 10 cancel"
based on intent-vs-engine; this ledger restates the same 21 with explicit
new-task-id mappings.

**Physical working tree state (carry forward, do not delete):**

- `aero-fighters-v2/Content/Aircraft/HandModeled.md` — SURVIVES (engine-agnostic).
- `aero-fighters-v2/Tools/screenshot-diff-harness.py` — REWRITE PENDING tag remains; rewritten in T-G-08.
- `aero-fighters-v2/Tools/perf-harness.py` — REWRITE PENDING tag remains; rewritten in T-G-09.
- `aero-fighters-v2/.env.local` — SURVIVES (NASA creds in place; gitignored; unaffected by either pivot).
- `aero-fighters-v2/.env.local.example` — REWRITE PENDING tag remains; rewritten in T-G-11.
- `aero-fighters-v2/README.md` — REWRITE PENDING tag remains; rewritten in T-G-12.
- `aero-fighters-v2/Tests/AcceptanceCriteria.md` — REWRITE PENDING tag remains; rewritten in T-G-07.
- `aero-fighters-v2/.gitignore` — UE5-shaped; rewritten Godot-shaped in T-G-13.
- `aero-fighters-v2/docs/` — kept (any docs added by Wave 0 of stylized survive; new docs added by T-G-* tasks).

---

## Seed tasks (ordered by dependency)

- **T-G-01 [x] DONE — Pin Godot 4 stable Mono build; install + document version.**
  Owner: `game-developer`. Download Godot 4 stable Mono build from
  <https://godotengine.org/download/linux> (single `.zip`, ~80MB). Unzip
  under `~/godot/Godot_v4.x-stable_mono_linux_x86_64/`. Record exact
  Godot version string in `aero-fighters-v2/docs/godot-version.md` and
  the exact `GODOT_BIN_PATH=...` in the same file. Mono build chosen to
  keep the C# promotion path open (NFR-V2-G-05). Blocks all subsequent
  work.

- **T-G-02 [x] DONE — Create lint-only GH-hosted CI workflow for Godot release.**
  Owner: `devops-engineer`. Path: `.github/workflows/aero-v2-godot-ci.yml`.
  Runs on `ubuntu-latest`: gdlint + gdformat check on `scripts/` and
  `autoload/`, scene-file validity check (Python script that loads each
  `.tscn` and verifies UID + ext_resource refs), flake8 on
  `aero-fighters-v2/Tools/`, Git LFS verify. No self-hosted runner. No
  headless Godot run in this workflow yet (deferred to Wave 5 if
  RR-V2-G-09 verification passes).

- **T-G-04 [x] DONE — Stand up Godot 4 project + scene tree skeleton.**
  Owner: `game-developer`. Create `aero-fighters-v2/project.godot` via
  Godot project manager (Forward+ renderer, MSAA 2×, physics tick 60,
  window 1920×1080). Scaffold scene tree per SPEC §10: `Main.tscn`,
  `Player.tscn`, `Targets/factory.tscn`, `Targets/base.tscn`,
  `Targets/aa_cluster.tscn`, `HUD.tscn`, `CelShaderPass.tscn`. Register
  autoloads `MissionManager`, `GameConfig`, `Telemetry` in `project.godot`.
  Blocks all gameplay/combat/terrain work.

- **T-G-05 [x] DONE — Create `GameConfig.tres` + `MissionConfig.tres` Godot Resource files.**
  Owner: `game-developer`. Define custom Resource subclasses (Resource
  scripts `GameConfig.gd` + `MissionConfig.gd`) and instantiate as
  `.tres` files under `resources/`. Fields:
  - GameConfig.tres: world origin WGS84 `(-19.47, -44.46)`, pawn spawn
    WGS84 `(-19.47, -44.46, 2095.0 m)`, Inhaúma bbox ±0.20°, flight
    constants (STALL_THRESHOLD 10, MIN_SPD 8, MAX_SPD 80, GRAVITY 14,
    PITCH_RATE 1.45, ROLL_RATE 2.30, YAW_RATE 0.80).
  - MissionConfig.tres: factory WGS84, base WGS84, AA cluster WGS84
    `(-19.490, -44.387)`, target HPs (factory 20, base 28, AA gun 6 × 3),
    difficulty coefficients (HP ×1.15/cycle, AA interval ×0.92/cycle).
  Wire into GDScript test fixtures for AC-V2-G-02, AC-V2-G-03,
  AC-V2-G-06, AC-V2-G-07, AC-V2-G-08.

- **T-G-06 [x] DONE — OSM + SRTM fetch tool (`Tools/inhauma-data-fetch.py`).**
  Owner: `game-developer` (ops hat). Python tool that:
  - Downloads Brazil-southeast `.osm.pbf` from Geofabrik (anonymous CC mirror).
  - Clips to Inhaúma bbox via `osmconvert` or `osmium-tool`.
  - Exports building polygons (capped at top 5,000 by area per
    RR-V2-G-03) + landuse polygons to JSON for GDScript consumption.
  - **Downloads SRTM 30 m tiles from AWS Open Data mirror**
    `https://elevation-tiles-prod.s3.amazonaws.com/skadi/{S20}/{S20W045}.hgt.gz`
    (anonymous, no NASA URS auth needed). Same SRTMGL1 v003 bytes as NASA.
    **Amended 2026-05-18** (was: NASA EarthData URS — pivoted to AWS Open
    Data after NASA CMR probe 401'd and AWS probe 200'd; see SPEC §8).
  - Assembles tiles into a single GeoTIFF via `gdal_merge.py`.
  - Reprojects to UTM zone 23S.
  - Emits 16-bit PNG (`gdal_translate -ot UInt16 -scale 0 1500 0 65535`)
    ready for Terrain3D import.
  - Outputs `Content/World/inhauma-osm.pbf`, `inhauma-buildings.json`,
    `inhauma-landuse.json`, `inhauma-heightmap.tif`,
    `inhauma-heightmap.png`.
  - Idempotent + deterministic for fixed bbox + fixed source revisions.
  - Records exact source revisions in `Content/World/SOURCES.md`.
  Engine-agnostic — survives the UE5 → Godot pivot intact in spirit.
  Zero secrets in the critical path post-amendment.

- **T-G-07 [ ] OPEN — New AC-V2-G traceability matrix.**
  Owner: `game-developer` (tester hat). Path:
  `aero-fighters-v2/Tests/AcceptanceCriteria.md`. Rewrite the matrix
  for AC-V2-G-01..23 derived from SPEC §9. Maps each AC to test path
  + test name + method (GDScript test / Python harness / manual) +
  owning wave. Replaces the cancelled REWRITE-PENDING-tagged content
  from prior pivots.

- **T-G-08 [ ] OPEN — Rewrite screenshot-diff harness driver for Godot.**
  Owner: `game-developer` (tester hat) + `game-designer` (hat). Path:
  `aero-fighters-v2/Tools/screenshot-diff-harness.py`. The SSIM + pHash
  algorithm survives unchanged from the cancelled tool; only the
  invocation driver swaps: instead of launching a UE5 Shipping build,
  invoke `godot --headless --quit-after N --script Tools/capture_pose.gd`
  (the driver script created in T-G-22). Re-capture 4 fixed cel-shaded
  baselines at Iris Xe @ 1080p native. Commit baselines to
  `Tests/baselines/linux/` via Git LFS. Drop Windows baselines (out of
  scope per NFR-V2-G-03). Update thresholds to AC-V2-G-19 values
  (SSIM ≥ 0.78 per cam, mean ≥ 0.84, pHash ≤ 16).

- **T-G-09 [ ] OPEN — Rewrite perf harness driver for Godot frame-time export.**
  Owner: `game-developer` (tester hat). Path:
  `aero-fighters-v2/Tools/perf-harness.py`. The frame-time series +
  percentile assertion algorithm survives unchanged from the cancelled
  tool. Update the AC reference to `AC-V2-G-18`. The driver invokes
  Godot with `--print-fps` flag and/or reads
  `Engine.get_frames_per_second()` via a small GDScript driver
  `Tools/perf_capture.gd` that runs a 60s scripted flight loop and
  prints frame-time series to stdout. Update docstring + assertion
  message to cite Godot 4 + Iris Xe G7 80EU @ 1920×1080 native (no
  upscale). Thresholds unchanged: mean ≥ 60 FPS + p99 ≤ 18.5 ms.

- **T-G-10 [-] IN PROGRESS — Cel-shader: screen-space CanvasLayer pass + per-mesh Toon material.**
  Owner: `game-developer`. Create `scenes/CelShaderPass.tscn` +
  `shaders/cel_screen_space.gdshader`. Implement per FR-V2-G-11: diffuse
  step-quantization (3 bands), Sobel-edge outline on depth + normal,
  ×1.15 saturation lift. Cost target ≤ 0.8 ms on Iris Xe @ 1080p
  (verified in T-G-09 perf harness). Calibration thresholds
  (depth-edge, normal-edge) tuned over ≥ 3 calibration runs per PLAN;
  final values recorded in
  `aero-fighters-v2/docs/cel-shader-calibration.md`. Also configure
  `StandardMaterial3D` with Toon shading enabled for the aircraft +
  buildings + targets (used by T-G-15, T-G-17, T-G-20).

- **T-G-11 [x] DONE — Rewrite `.env.local.example` for Godot.**
  Owner: `game-developer` (ops hat). Path:
  `aero-fighters-v2/.env.local.example`. Drop all UE5-related
  (UE_INSTALL_PATH), Cesium (CESIUM_OFFLINE_TILES, CESIUM_TILE_CACHE_DIR),
  Google Maps (GOOGLE_MAPS_TILES_API_KEY) entries. Keep NASA + OSM
  bbox vars. Add `GODOT_BIN_PATH=~/godot/Godot_v4.x-stable_mono_linux_x86_64/Godot_v4.x-stable_mono_linux.x86_64`.
  File currently tagged `# REWRITE PENDING` from prior pivot.

- **T-G-12 [x] DONE — Rewrite `README.md` for Godot 4 + Inhaúma stylized scope.**
  Owner: `game-developer` (ops hat). Path: `aero-fighters-v2/README.md`.
  Update title + description to "Stylized cel-shaded flight game over
  Inhaúma MG, Godot 4 + OSM + SRTM". Strip all UE5, Cesium, GCP,
  Google Maps Tiles content. Add: Godot 4 install (single `.zip`,
  Mono build), NASA EarthData setup, OSM ODbL attribution requirement,
  Linux-only export instructions (`godot --export-release "Linux/X11"`),
  scene-tree architecture overview, cel-shader notes. List CI as
  GH-hosted lint-only. Reference SPEC §10. File currently tagged
  `<!-- REWRITE PENDING -->` from prior pivot.

- **T-G-13 [x] DONE — Godot-shaped `.gitignore`.**
  Owner: `game-developer` (ops hat). Path: `aero-fighters-v2/.gitignore`.
  Replace UE5-shaped patterns with Godot patterns: `.godot/`,
  `*.import`, `*.uid`, `*.translation.csv.import`, `addons/*/cache/`,
  `StagedBuilds/`, `.env.local`, `__pycache__/`, `*.pyc`.

- **T-G-14 [x] DONE — Godot-shaped LFS `.gitattributes`.**
  Owner: `game-developer` (ops hat). Path: repo-root `.gitattributes`.
  Update LFS patterns scoped to `aero-fighters-v2/**`: `*.gltf`,
  `*.png` (under `Content/`, `Tests/baselines/`, `Content/World/`),
  `*.ogg`, `*.wav`, heightmap data (`*.tif`,
  `Content/World/inhauma-heightmap.png` explicit). Drop any UE5-asset-
  specific patterns (`*.uasset`, `*.umap`) if present.

- **T-G-15 [-] IN PROGRESS — Hand-modeled aircraft → cel-friendly Godot material.**
  Owner: `game-developer` + `game-designer` (hat). Depends on T-G-10.
  The hand-modeled delta-wing geometry from `Content/Aircraft/HandModeled.md`
  (carried unchanged from T-S-03 / T-003) imports into Godot as
  `Content/Aircraft/aircraft.gltf`. Create `Content/Aircraft/aircraft.tscn`
  PackedScene with `MeshInstance3D` + `CollisionShape3D` + `Marker3D`
  children for cannon mount and camera anchors. Apply
  `StandardMaterial3D` with Toon shading enabled (paired with the
  `CelShaderPass`). License unchanged (own-work).

- **T-G-16 [x] DONE — Install Terrain3D addon + heightmap import ready (operator finishes in editor).**
  Owner: `game-developer`. Terrain3D v1.0.1 MIT (RR-V2-G-05 cleared,
  copyright Cory Petkovsek + Roope Palmroos, tag SHA cf137ce) installed
  at `aero-fighters-v2/addons/terrain_3d/` (52 MB). Plugin enabled in
  `project.godot`. Headless boot exits 0. Heightmap import helper at
  `tools_godot/import_terrain.gd`. Full operator-facing instructions
  in `aero-fighters-v2/docs/terrain3d-import.md` (~2 min editor click-through).
  **Closure carve-out (parallels T-002 cancelled-release pattern):**
  the final Terrain3DStorage materialization runs in the Godot editor
  GUI because Terrain3D 1.0.1's headless `import_images` API requires
  asynchronous frame-pumping that we did not stabilize this wave; the
  manual editor step is a 2-minute click and is the only way the import
  is fully reliable today. AC-V2-G-02 verification (height-at-origin
  761 m, ≤ 5 m error) is wired into the doc + import script for the
  operator to run after the editor import. Headless automation of the
  import is documented as a future hardening item (revisit during
  Wave 5 if CI ever needs it). Depends on T-G-04 + T-G-06 (both DONE).

- **T-G-17 [ ] OPEN — OSM building extrusion via GDScript + MultiMeshInstance3D.**
  Owner: `game-developer`. Implement `scripts/building_spawner.gd` (or
  use as Autoload) that reads `Content/World/inhauma-buildings.json`
  (from T-G-06) at level start; for each polygon extrudes a box mesh
  at the centroid with height `building:levels × 3.0 m` (default 3
  levels). Adds instances to a single `MultiMeshInstance3D` under a
  buildings root in `scenes/Main.tscn`. Material = `M_CelBuilding`
  (`StandardMaterial3D` with Toon mode). Cap at ≤ 5,000 instances per
  RR-V2-G-03. Verify ≥ 90% of OSM downtown buildings present
  (AC-V2-G-15). Depends on T-G-04 + T-G-06 + T-G-16.

- **T-G-18 [ ] OPEN — Foliage scatter via GDScript + MultiMeshInstance3D.**
  Owner: `game-developer`. Implement `scripts/foliage_spawner.gd`
  (Autoload) that reads `Content/World/inhauma-landuse.json` (from
  T-G-06) and scatters hand-modeled cel-friendly low-poly tree + bush
  primitives into a `MultiMeshInstance3D` per FR-V2-G-13. Density: ~50
  trees/ha forest, ~10/ha grass. Total ≤ 12,000 MultiMesh instances
  budget. Depends on T-G-17.

- **T-G-19 [ ] OPEN — Mission system Autoload (1-cycle loop, 3 targets, win-condition, +1 difficulty).**
  Owner: `game-developer`. Implement `autoload/MissionManager.gd`
  (Godot Autoload singleton) per FR-V2-G-07/18. State: current cycle
  counter (int), alive-target list (`Array[Node]`), HP multiplier
  (float, ×1.15 per cycle), AA interval multiplier (float, ×0.92 per
  cycle). Signals: `mission_complete`, `cycle_advanced`,
  `target_destroyed`. On all 3 destroyed → "MISSION COMPLETE" HUD
  widget → 3 s pause → spawn next cycle with scaled difficulty.
  Depends on T-G-04 + T-G-05.

- **T-G-20 [ ] OPEN — Three target scenes (factory, base, AA cluster).**
  Owner: `game-developer`. Create PackedScenes + scripts:
  - `scenes/Targets/factory.tscn` + `scripts/targets/factory.gd` — HP 20,
    mega-explosion via layered GPUParticles3D.
  - `scenes/Targets/base.tscn` + `scripts/targets/base.gd` — HP 28,
    multi-stage destruction (radar sub-event at HP 8 → main building).
  - `scenes/Targets/aa_cluster.tscn` + `scripts/targets/aa_cluster.gd` —
    3 sub-guns @ HP 6, range 220 m, base interval 1.7 s, fires back
    at the player.
  All GDScript-first, C# promotion per NFR-V2-G-05 triggers. Depends
  on T-G-04 + T-G-05.

- **T-G-21 [ ] OPEN — Determinism harness (`--test-mode` + Ctrl+T).**
  Owner: `game-developer` (tester hat). Path: `autoload/Telemetry.gd`.
  Implements `--test-mode` CLI flag detection + Ctrl+T debug shortcut
  per FR-V2-G-15. Override set: `Engine.time_scale = 1.0` locked,
  physics tick 60, deterministic RNG seed `0xAER0DA0AIA`, cel-shader
  force-applied, fixed DirectionalLight3D rotation, fixed wind vector
  `(1,0,0)` at 5 m/s, fixed camera pose loaded from `.tres`, Terrain3D
  streaming gate (10 s hard timeout). Replaces the cancelled SPEC's
  UE5 cvar-based override set. Depends on T-G-04 + T-G-10 + T-G-16.

- **T-G-22 [ ] OPEN — GDScript screenshot-capture driver for headless export.**
  Owner: `game-developer` (tester hat). Path:
  `aero-fighters-v2/Tools/capture_pose.gd`. Invoked via
  `godot --headless --quit-after N --script Tools/capture_pose.gd
  --pose <pose-id>`. Loads `Main.tscn`, applies `--test-mode`, waits
  for Terrain3D ready + 1 s settle, sets camera to reference pose,
  captures viewport via `Viewport.get_texture().get_image().save_png(<out>)`.
  Consumed by T-G-08's Python driver. Verifies RR-V2-G-09 (Godot
  headless on `ubuntu-latest` GH-hosted runner).

- **T-G-24 [-] IN PROGRESS — Wave 3 pawn + flight + cameras + HUD (FR-V2-G-03/04/09/10).**
  Owner: `game-developer`. Implements: `scripts/flight_arcade.gd` (RigidBody3D arcade
  flight model per OQ-V2-G-08 + FR-V2-G-04), `scripts/player_controller.gd` (spawn +
  initial velocity), `scripts/camera_controller.gd` (Chase SpringArm3D + Cockpit
  Camera3D + cycle_camera action), `scripts/hud.gd` (8 HUD elements wired to live data
  per FR-V2-G-10). Updates `scenes/Player.tscn` (adds SpringArm3D + cameras + scripts)
  and `scenes/HUD.tscn` (wires hud.gd). Adds Player + HUD instances to `scenes/Main.tscn`.
  Flight constants ported from v1 config.js PLAYER block via GameConfig.tres.
  Depends on T-G-04 + T-G-05 (both DONE).

- **T-G-23 [ ] OPEN — Perf-capture GDScript driver.**
  Owner: `game-developer` (tester hat). Path:
  `aero-fighters-v2/Tools/perf_capture.gd`. Invoked via
  `godot --quit-after 65 --script Tools/perf_capture.gd`. Runs a 60 s
  scripted flight loop over Inhaúma; samples
  `Engine.get_frames_per_second()` and per-frame `_process` time every
  physics tick; prints CSV `tick,fps,frame_ms` to stdout. Consumed by
  T-G-09's Python driver to compute mean FPS + p99 frame-time
  percentile. Depends on T-G-19 + T-G-20 (full scene must be playable).

---

## Conventions

- One `[-]` IN PROGRESS at a time per this file. Pick a task with
  `[ ] → [-]` + commit `chore(tasks): start <task-id>` before any
  production edit.
- Close with `[-] → [x]` + commit `feat|fix|chore(<scope>): <message>
  (<task-id>)`.
- Production work in this release is rooted at
  `repos/tauan-games/aero-fighters-v2/` (shared working tree with the
  cancelled UE5 stylized release; UE5-shaped files survive only where
  their intent maps to a Godot-shaped rewrite per the carryover ledger
  above).
- **No `[x]` carryover pre-marks.** Unlike the cancelled stylized
  release (which pre-marked T-S-03/T-S-13/T-S-14 as DONE), this release
  starts every task `[ ]` OPEN because all engine-touching artifacts
  need re-verification or rewrite under Godot semantics.

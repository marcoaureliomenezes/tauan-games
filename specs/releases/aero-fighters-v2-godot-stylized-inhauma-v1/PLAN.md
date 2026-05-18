# PLAN: Aero Fighters v2 — Godot Stylized Inhaúma (MVP-2)

> **Status:** Aprovado — 2026-05-18 (composed alongside approved SPEC after second grill-me pivot session; operator pre-approved during grill)
> **Author:** product-engineer (dadaia Labs)
> **Created:** 2026-05-18
> **SPEC:** `specs/releases/aero-fighters-v2-godot-stylized-inhauma-v1/SPEC.md`
> **TASKS:** `specs/releases/aero-fighters-v2-godot-stylized-inhauma-v1/TASKS.md`
> **Release id:** `aero-fighters-v2-godot-stylized-inhauma-v1`
> **Supersedes:** `aero-fighters-v2-stylized-inhauma-v1` (cancelled 2026-05-18 — hardware constraint on UE5 source build)
> **Grill input:** `.dadaia/reports/tauan-games/product-engineer/2026-05-18T005834Z-godot-pivot.html`

---

## 1. Strategy

Wave-based execution on a **single shared working tree**. Each wave fires
multiple game-specialized agents in parallel (fresh context per wave) that
write to non-overlapping file sets. Verification runs between waves; on
green the next wave fires. The Inspiron 15-3511 (Iris Xe G7) is the only
dev box and the only test box. No self-hosted runner, no cloud GPU.

Total **5 implementation waves + Wave 0 (operator bootstrap)** covering
~20 seed tasks across 5–6 weeks (NFR-V2-G-04). Wave count is unchanged
from the cancelled stylized SPEC because the scope is unchanged — only
the engine is swapped. Godot dev velocity matches UE5 for this scope:

- Wave 0 simpler (Godot is single-`.zip` install vs UE5 source build).
- Wave 1 simpler (Godot scene tree vs 4-module C++ layout).
- Waves 2–5 comparable (terrain pipeline, gameplay, combat, harness).

No tasks are pre-`[x]` DONE because the cancelled stylized release's
"DONE via carryover" tasks (T-S-03, T-S-13, T-S-14) need re-verification
against the Godot project shape: HandModeled.md survives intact but the
.gitignore and .gitattributes need Godot-shaped rewrites (T-G-13, T-G-14).
Wave 1 starts with all tasks `[ ]` OPEN.

---

## 2. Wave Roster

| Wave | Phase | Tasks | Calendar |
|---|---|---|---|
| 0 | Operator bootstrap | Godot 4 install + NASA EarthData verify + git lfs verify | week 0 |
| 1 | Project skeleton + config + CI | T-G-01, T-G-02, T-G-04, T-G-05, T-G-11, T-G-13, T-G-14 | week 1 |
| 2 | Inhaúma data pipeline + Terrain3D | T-G-06, T-G-16, T-G-12 | week 2 |
| 3 | Pawn + flight + cel-shader | T-G-10, T-G-15 + FR-V2-G-03/04/09/10 | week 3 |
| 4 | Combat + mission system + targets | T-G-17, T-G-18, T-G-19, T-G-20 + FR-V2-G-05/06/08 | week 4 |
| 5 | Harness + perf + closure | T-G-07, T-G-08 (rewrite for Godot), T-G-09 (rewrite for Godot), T-G-21, T-G-22, T-G-23 | weeks 5–6 |

---

## 3. Wave 0 — Operator Bootstrap (BLOCKING)

Operator-driven; no agents fire until every line below is green.

- [ ] Godot 4 stable installed on Inspiron 15-3511. Download single
  `.zip` (~80MB) from <https://godotengine.org/download/linux> — pick
  the **Mono** build for C# compatibility (keeps the C# promotion path
  open without re-pinning later). Unzip to `~/godot/Godot_v4.x-stable_mono_linux_x86_64/`.
  Verification: `~/godot/Godot_v4.x-stable_mono_linux_x86_64/Godot_v4.x-stable_mono_linux.x86_64 --version`
  exits 0 and prints the engine version string.
- [ ] NASA EarthData credentials verified in `.env.local`.
  Operator confirmed creds were placed pre-pivot (2026-05-17); verify
  the file is still present and contains both vars:
  ```
  grep -E "^NASA_EARTHDATA_(USERNAME|PASSWORD)=" \
    repos/tauan-games/aero-fighters-v2/.env.local | wc -l   # expect 2
  ```
- [ ] (Pending from prior pivot) NASA EarthData email confirmation — if
  not yet confirmed, operator confirms via the email link before T-G-06.
  T-G-06 first run is the real validator regardless.
- [ ] OSM data source pinned: Geofabrik Brazil-southeast extract date
  will be documented in `aero-fighters-v2/Content/World/SOURCES.md`
  (created by T-G-06).
- [ ] Git LFS installed locally + on GH-hosted runner: `git lfs version`
  exits 0; `aero-fighters-v2/.gitattributes` patterns match SPEC §10
  (rewritten in T-G-14 to Godot-shaped patterns).

Verification commands run before Wave 1 fires:

```bash
~/godot/Godot_v4.x-stable_mono_linux_x86_64/Godot_v4.x-stable_mono_linux.x86_64 --version
grep -E "^NASA_EARTHDATA_(USERNAME|PASSWORD)=" \
  repos/tauan-games/aero-fighters-v2/.env.local | wc -l   # expect 2
git lfs version
```

All green → Wave 1 spawns.

---

## 4. Wave 1 — Project Skeleton + Config + CI

**Tasks:** T-G-01, T-G-02, T-G-04, T-G-05, T-G-11, T-G-13, T-G-14.
**Calendar:** week 1.

### Parallel agents

**`game-developer`** — owns T-G-01, T-G-04, T-G-05.
- T-G-01: Document the pinned Godot version string in
  `aero-fighters-v2/docs/godot-version.md`. Record exact binary path:
  `GODOT_BIN_PATH=~/godot/Godot_v4.x-stable_mono_linux_x86_64/Godot_v4.x-stable_mono_linux.x86_64`.
- T-G-04: Create `aero-fighters-v2/project.godot` (Godot project file
  via UI: `godot --project-manager`, New Project → Forward+ renderer).
  Scaffold scene tree:
  - `scenes/Main.tscn` — root Node3D with placeholders for player,
    terrain, mission manager refs, HUD CanvasLayer.
  - `scenes/Player.tscn` — `CharacterBody3D` (or `RigidBody3D` placeholder;
    Wave 3 decides per OQ-V2-G-08) with `Camera3D` chase + cockpit children
    and `Marker3D` cannon nozzle.
  - `scenes/Targets/factory.tscn`, `base.tscn`, `aa_cluster.tscn`
    (stubs only — Wave 4 fills).
  - `scenes/HUD.tscn` (stub Control nodes — Wave 3 fills).
  - `scenes/CelShaderPass.tscn` (stub CanvasLayer — Wave 3 fills).
  - Configure `project.godot`: rendering/renderer = "forward_plus";
    physics_ticks_per_second = 60; window size 1920×1080;
    register autoloads (MissionManager, GameConfig, Telemetry).
- T-G-05: Create `resources/GameConfig.tres` + `resources/MissionConfig.tres`
  Godot Resource files (custom `Resource` subclasses GameConfig.gd /
  MissionConfig.gd). Fields:
  - GameConfig.tres: world origin WGS84 `(-19.47, -44.46)`, pawn spawn
    WGS84 `(-19.47, -44.46, 2095.0 m)`, Inhaúma bbox ±0.20°, flight
    constants (STALL_THRESHOLD, MIN_SPD, etc.).
  - MissionConfig.tres: factory WGS84, base WGS84, AA cluster WGS84
    `(-19.490, -44.387)`, target HPs (factory 20, base 28, AA gun 6 × 3),
    difficulty coefficients (HP ×1.15/cycle, AA interval ×0.92/cycle).
  Wire into GDScript test fixtures for AC-V2-G-02, AC-V2-G-03,
  AC-V2-G-06, AC-V2-G-07, AC-V2-G-08.

**`devops-engineer`** — owns T-G-02.
- T-G-02: Author `.github/workflows/aero-v2-godot-ci.yml`. Jobs
  (GH-hosted `ubuntu-latest`):
  - (1) `gdscript-lint` — install `gdtoolkit` via pip; run
    `gdlint scripts/ autoload/` and `gdformat --check scripts/ autoload/`.
  - (2) `scene-file-validity` — small Python script that loads each
    `.tscn` and checks UID + ext_resource references are non-broken.
  - (3) `python-lint` — flake8 on `aero-fighters-v2/Tools/`.
  - (4) `lfs-verify` — `git lfs ls-files` non-empty + LFS patterns from
    .gitattributes resolve to actual files.
- Do NOT add headless Godot run in Wave 1 — defer to Wave 5 once tests
  exist (RR-V2-G-09 verifies Godot `--headless` works on `ubuntu-latest`).

**`game-developer` (ops hat)** — owns T-G-11, T-G-13, T-G-14.
- T-G-11: Rewrite `aero-fighters-v2/.env.local.example`. Drop all
  UE5/Cesium/Google entries. Add `NASA_EARTHDATA_USERNAME`,
  `NASA_EARTHDATA_PASSWORD`, `OSM_BBOX_NORTH/SOUTH/EAST/WEST` defaults
  (±0.20° around Inhaúma WGS84 `(-19.47, -44.46)`), and
  `GODOT_BIN_PATH=~/godot/Godot_v4.x-stable_mono_linux_x86_64/Godot_v4.x-stable_mono_linux.x86_64`.
- T-G-13: Rewrite `aero-fighters-v2/.gitignore` for Godot patterns:
  `.godot/`, `*.import`, `*.uid`, `*.translation.csv.import`,
  `addons/*/cache/`, `StagedBuilds/`, `.env.local`,
  `__pycache__/`, `*.pyc`.
- T-G-14: Update repo-root `.gitattributes` LFS patterns for the v2
  Godot tree: `aero-fighters-v2/**/*.gltf filter=lfs diff=lfs merge=lfs -text`,
  same for `*.png`, `*.ogg`, `*.wav`, and heightmap data (`*.tif`,
  `inhauma-heightmap.png`).

### Wave 1 verification

```bash
RELEASE=repos/tauan-games/aero-fighters-v2
test -f $RELEASE/project.godot
test -f $RELEASE/scenes/Main.tscn
test -f $RELEASE/scenes/Player.tscn
test -f $RELEASE/resources/GameConfig.tres
test -f $RELEASE/resources/MissionConfig.tres
test -f $RELEASE/.env.local.example && ! grep -q "UE_INSTALL_PATH" $RELEASE/.env.local.example
test -f .github/workflows/aero-v2-godot-ci.yml
grep -q "GODOT_BIN_PATH" $RELEASE/.env.local.example
# Godot opens project cleanly
$GODOT_BIN_PATH --headless --quit-after 2 --path $RELEASE 2>&1 | grep -v "ERROR"
```

All green → Wave 2 fires.

---

## 5. Wave 2 — Inhaúma Data Pipeline + Terrain3D

**Tasks:** T-G-06, T-G-16, T-G-12. **Calendar:** week 2.

### Parallel agents

**`game-developer` (ops hat)** — owns T-G-06.
- T-G-06: Author/rewrite `aero-fighters-v2/Tools/inhauma-data-fetch.py`.
  CLI flags: `--center-lat -19.47 --center-lon -44.46 --radius-km 22
  --srtm-tiles AUTO --output-dir Content/World/ --yes --dry-run`. Steps:
  1. `osmconvert` Brazil-southeast PBF clip → `inhauma-osm.pbf`.
  2. Parse + emit `inhauma-buildings.json` + `inhauma-landuse.json`
     (filter buildings to top 5,000 by polygon area for RR-V2-G-03).
  3. NASA SRTM tile list + download via EarthData (HTTP Basic Auth).
  4. `gdal_merge.py` → single GeoTIFF; reproject to UTM 23S.
  5. `gdal_translate -ot UInt16 -scale 0 1500 0 65535` → 16-bit PNG
     (Terrain3D-ready format).
  6. Append source revisions to `Content/World/SOURCES.md`.
  The tool reads NASA creds from `aero-fighters-v2/.env.local`.

**`game-developer`** — owns T-G-16.
- T-G-16: After T-G-06 completes, install the Terrain3D addon (download
  from godot-asset-library or GitHub release; verify CC0/MIT license
  per RR-V2-G-05 before commit). Place under `addons/terrain_3d/`.
  Enable in `project.godot` → AutoLoad/Plugins. Add a `Terrain3D` node
  to `scenes/Main.tscn`. Import `inhauma-heightmap.png` via the
  Terrain3D import workflow. Verify Terrain3D height at WGS84
  `(-19.47, -44.46)` within 5 m of source SRTM sample (AC-V2-G-02 —
  test added in T-G-07 wave 5). Document workflow in
  `aero-fighters-v2/docs/terrain3d-import.md`.
  **Fallback if Terrain3D license incompatible (RR-V2-G-05):** import
  PNG heightmap as a single tiled `MeshInstance3D` via a small GDScript
  that reads the PNG and builds a vertex grid (4 km × 4 km tiles × 5×5
  grid = 20 km × 20 km). Documented in the same file.

**`game-developer` (ops hat)** — owns T-G-12.
- T-G-12: Rewrite `aero-fighters-v2/README.md`. New sections: prereqs
  (Godot 4 Linux Mono build, NASA EarthData free login, osmconvert,
  GDAL), first-time setup (6 steps), running (Linux only), testing
  (GDScript unit tests + Python harnesses), architecture overview (scene
  tree + autoloads), cel-shader notes, OSM ODbL attribution block,
  Inhaúma personal-anchor disclosure, license notice. **Drop all UE5,
  Cesium, GCP, Google Maps Tiles content.**

### Wave 2 verification

```bash
RELEASE=repos/tauan-games/aero-fighters-v2
python3 $RELEASE/Tools/inhauma-data-fetch.py --dry-run
test -f $RELEASE/Content/World/inhauma-heightmap.tif
test -f $RELEASE/Content/World/inhauma-heightmap.png
test -f $RELEASE/Content/World/inhauma-buildings.json
test -d $RELEASE/addons/terrain_3d
grep -q "Godot 4" $RELEASE/README.md
grep -q "ODbL" $RELEASE/README.md  # attribution present
```

All green → Wave 3 fires.

---

## 6. Wave 3 — Pawn + Flight + Cel-Shader

**Tasks:** T-G-10, T-G-15 + FR-V2-G-03/04/09/10. **Calendar:** week 3.

### Parallel agents

**`game-developer`** — owns pawn + flight + cameras + HUD.
- Implement `scripts/flight_arcade.gd` (GDScript) on the player root
  node. Spawn at `GameConfig.tres` spawn coords. Constants from
  FR-V2-G-04 ported from v1 `config.js`.
- Decide CharacterBody3D vs RigidBody3D per OQ-V2-G-08 — recommended
  RigidBody3D for arcade flight (lets us apply impulses for the boundary
  spring without manual integration).
- Implement `scripts/camera_controller.gd`: cycle Chase ↔ Cockpit via
  `cycle_camera` action. Chase uses `SpringArm3D`; Cockpit is a direct
  `Camera3D` child of the aircraft.
- InputMap registered in `project.godot` (8 actions per FR-V2-G-09).
- Implement `scenes/HUD.tscn` Control tree (8 elements per FR-V2-G-10).
  Use Godot default font; procedural rectangles for crosshair + warning
  flash; Label text bindings to MissionManager + Telemetry signals.

**`game-developer`** — owns T-G-10 (cel-shader).
- T-G-10: Build `scenes/CelShaderPass.tscn` as a `CanvasLayer` with a
  fullscreen `ColorRect` wearing a `ShaderMaterial` using
  `shaders/cel_screen_space.gdshader`. Shader sources `SCREEN_TEXTURE`,
  `DEPTH_TEXTURE`, and a normal buffer (Godot 4 normal-output via
  `NORMAL_TEXTURE` in canvas_item shaders). Implement:
  - Diffuse step-quantization (3 bands).
  - Sobel-edge outline on depth + normal (depth threshold 0.04, normal
    threshold 0.55 — provisional, calibrated in PLAN).
  - ×1.15 saturation lift.
  - Cost target ≤ 0.8 ms on Iris Xe @ 1080p (verified in T-G-09 perf
    harness wave 5).
- Calibrate thresholds over ≥ 3 runs; document final values in
  `aero-fighters-v2/docs/cel-shader-calibration.md`.

**`game-designer` (hat)** — owns T-G-15.
- T-G-15: Apply `StandardMaterial3D` with Toon shading enabled to the
  hand-modeled aircraft mesh in `Content/Aircraft/`. Create
  `Content/Aircraft/aircraft.tscn` PackedScene with `MeshInstance3D` +
  `CollisionShape3D`. License unchanged (own-work).

### Wave 3 verification

```bash
RELEASE=repos/tauan-games/aero-fighters-v2
test -f $RELEASE/scripts/flight_arcade.gd
test -f $RELEASE/scenes/CelShaderPass.tscn
test -f $RELEASE/shaders/cel_screen_space.gdshader
test -f $RELEASE/docs/cel-shader-calibration.md
# Operator runs the editor and verifies PIE: aircraft spawns, throttle works,
# cel-shader visible. Records screenshot evidence in commit message.
```

All green → Wave 4 fires.

---

## 7. Wave 4 — Combat + Mission System + Targets

**Tasks:** T-G-17, T-G-18, T-G-19, T-G-20 + FR-V2-G-05/06/08.
**Calendar:** week 4.

### Parallel agents

**`game-developer`** — owns T-G-19, T-G-20 + combat + crash.
- T-G-19: Implement `autoload/MissionManager.gd` (Autoload singleton)
  per FR-V2-G-07/18. State: current cycle counter, alive-target list,
  HP multiplier, AA interval multiplier. Signals: `mission_complete`,
  `cycle_advanced`, `target_destroyed`.
- T-G-20: Three target PackedScenes + scripts:
  - `scenes/Targets/factory.tscn` + `scripts/targets/factory.gd` — HP
    20, mega-explosion via GPUParticles3D.
  - `scenes/Targets/base.tscn` + `scripts/targets/base.gd` — HP 28,
    multi-stage destruction (radar at HP 8 → main building).
  - `scenes/Targets/aa_cluster.tscn` + `scripts/targets/aa_cluster.gd` —
    3 sub-guns @ HP 6, range 220 m, base interval 1.7 s.
- `scripts/cannon.gd` — 12.5 r/s, projectile pool 30, Area3D hit
  detection.
- `scripts/crash_detector.gd` — samples Terrain3D ground each
  physics tick; crashes on `altitudeDelta < 5 m`.

**`game-developer`** — owns T-G-17, T-G-18.
- T-G-17: Implement `scripts/building_spawner.gd` (Autoload) loading
  `inhauma-buildings.json` and populating
  `MultiMeshInstance3D` per FR-V2-G-12. Material = `M_CelBuilding`
  (`StandardMaterial3D` with Toon mode). Cap at ≤ 5,000 instances.
- T-G-18: Implement `scripts/foliage_spawner.gd` (Autoload) scattering
  low-poly trees on `inhauma-landuse.json` per FR-V2-G-13 (≤ 12,000
  MultiMesh instances).

**`game-designer` (hat)** — supports targets.
- Hand-author cel-friendly Toon materials for factory/base/AA cluster
  meshes (own-work, no external assets). Save under
  `Content/Targets/Materials/`.

### Wave 4 verification

```bash
RELEASE=repos/tauan-games/aero-fighters-v2
test -f $RELEASE/scenes/Targets/factory.tscn
test -f $RELEASE/scenes/Targets/base.tscn
test -f $RELEASE/scenes/Targets/aa_cluster.tscn
test -f $RELEASE/autoload/MissionManager.gd
# PIE: destroy 3 targets → MISSION COMPLETE → next mission spawns
# operator records PIE screenshot evidence
```

All green → Wave 5 fires.

---

## 8. Wave 5 — Harness + Perf + Closure

**Tasks:** T-G-07, T-G-08, T-G-09, T-G-21, T-G-22, T-G-23.
**Calendar:** weeks 5–6.

### Parallel agents

**`game-developer` (tester hat)** — owns T-G-07, T-G-08, T-G-09, T-G-21,
T-G-22, T-G-23.
- T-G-21: Determinism harness — `--test-mode` CLI flag + Ctrl+T debug
  shortcut implementing FR-V2-G-15 override set in
  `autoload/Telemetry.gd` (Engine.time_scale lock, physics tick lock,
  RNG seed, cel pass force-apply, fixed light, fixed wind, fixed
  camera pose, Terrain3D streaming gate).
- T-G-22: GDScript driver `Tools/capture_pose.gd`. Run via
  `godot --headless --quit-after N --script Tools/capture_pose.gd`.
  Loads MVP scene, applies test-mode, waits for Terrain3D ready,
  captures viewport via `Viewport.get_texture().get_image().save_png()`.
- T-G-08 (rewrite for Godot): rewrite the screenshot-diff Python driver
  to invoke Godot via `--headless --script Tools/capture_pose.gd`.
  Re-capture 4 fixed cel-shaded baselines at Iris Xe @ 1080p native;
  commit baselines to `Tests/baselines/linux/` (LFS). The SSIM + pHash
  algorithm from the cancelled SPEC's Python tool survives unchanged.
  Thresholds: SSIM ≥ 0.78 per cam, mean ≥ 0.84, pHash ≤ 16
  (AC-V2-G-19).
- T-G-23: Hook perf harness Python driver to Godot output via
  `--print-fps` flag or by reading `Engine.get_frames_per_second()`
  from a small GDScript driver `Tools/perf_capture.gd` that runs a
  60 s scripted flight loop and prints frame-time series to stdout.
- T-G-09 (rewrite for Godot): rewrite perf harness Python driver to
  parse the new stdout format. Assertion logic survives unchanged (mean
  FPS + p99 frame-time percentile math). Update docstring + assertion
  message to cite Godot 4 + Iris Xe @ 1080p native (no upscale).
  Numbers unchanged: mean ≥ 60 FPS, p99 ≤ 18.5 ms.
- T-G-07: Author full AC-V2-G-01..23 traceability matrix in
  `aero-fighters-v2/Tests/AcceptanceCriteria.md`. Each AC maps to test
  path + method (GDScript test / Python harness / manual) + owning wave.
  Replaces cancelled T-S-07 content (file currently tagged
  `# REWRITE PENDING` from prior pivot).

**Closure phase (after all Wave 5 green):** `product-engineer` invokes
`dadaia-release-closure` skill — writes `CLOSURE.md` with evidence
triples per AC + flips ACTIVE.md to `phase: CLOSURE` then `ARCHIVED` +
updates `specs/memory/architecture.html`, `specs/memory/tech-stack.html`,
and the relevant product memory pages if `specs/memory/product/` is
present (foundation-already-amended portions don't need re-amendment).

### Wave 5 verification

```bash
RELEASE=repos/tauan-games/aero-fighters-v2
python3 $RELEASE/Tools/screenshot-diff-harness.py --self-check
python3 $RELEASE/Tools/perf-harness.py --assert-only  # mean ≥ 60, p99 ≤ 18.5
grep -E '^- AC-V2-G-.*\[x\]' $RELEASE/Tests/AcceptanceCriteria.md | wc -l  # all 23
test -f repos/tauan-games/specs/releases/aero-fighters-v2-godot-stylized-inhauma-v1/CLOSURE.md
```

All green → release CLOSURE complete.

---

## 9. Cross-Wave Invariants

1. **Marker hygiene** — agents flip `[ ] → [-]` before any production
   write and `[-] → [x]` after committing. One `[-]` at a time per
   TASKS.md.
2. **No UE5, no Cesium, no Google Maps Tiles** — any reference to UE5
   classes (`UCesium*`, `ALandscape`, `UMissionSubsystem`, `Build.cs`,
   etc.) in the working tree is a CI fail. UE5 is the deferred Degrau 4
   slot per the amended foundation; it has no place in this Degrau 3
   release.
3. **v1 untouched** — no agent in any wave modifies
   `repos/tauan-games/aero-fighters/`.
4. **CC0 only** — no Fab, no Quixel, no Sketchfab non-CC0. Designer
   audits each asset's license in `Content/Aircraft/LICENSE.md` and
   `Content/Audio/LICENSE.md`. Terrain3D plugin license verified
   CC0 or MIT before commit (T-G-16).
5. **Operator-only distribution** — no `godot --export-release` for
   Windows or macOS, no GitHub Releases, no itch.io, no Steam during
   v2 (deferred to a future release).
6. **Scope errors** — any agent receiving a task outside its scope
   replies `[SCOPE ERROR]` per the workspace rule and refuses.
7. **Commit format** — `feat(<scope>): <message> (<task-id>)` for code;
   `chore(tasks): start|finish <task-id>` for marker flips.
8. **Auto-advance gate** — every wave's verification block must exit 0
   before the next wave fires.

---

## 10. Risk Register Actuals (vs SPEC §12)

| Risk | SPEC severity | Wave that closes |
|---|---|---|
| RR-V2-G-01 — Godot 4 + Terrain3D install on Ubuntu 24.04 / Iris Xe | LOW | 0 (operator verifies before Wave 1) |
| RR-V2-G-02 — Cel-shader fidelity in Godot vs UE5 | LOW | 3 (T-G-10 calibration) |
| RR-V2-G-03 — GDScript MultiMesh slower than UE5 PCG for large counts | MEDIUM | 4 (cap at 5,000 buildings); 5 (perf harness validates) |
| RR-V2-G-04 — NASA EarthData email confirmation | LOW | 2 (T-G-06 first run is the real validator) |
| RR-V2-G-05 — Terrain3D plugin license incompatibility | MEDIUM | 2 (T-G-16 verifies CC0/MIT before commit; fallback to PNG → MeshInstance3D documented) |
| RR-V2-G-06 — OSM data quality (sparse Inhaúma coverage) | MEDIUM | 4 (MultiMesh filter rejects degenerate polys) |
| RR-V2-G-07 — Mission state churn drops FPS | LOW | 4 (Autoload profiling) |
| RR-V2-G-08 — OSM ODbL attribution missing | LOW | 2 (T-G-12 README + Wave 3 boot splash) |
| RR-V2-G-09 — Godot headless on GH-hosted runner | LOW | 5 (T-G-22 driver run on CI verifies) |
| RR-V2-G-10 — Hand-modeled aircraft cel material rework | LOW | 3 (T-G-15 trivial swap) |
| RR-V2-G-11 — Iris Xe headroom too thin for 60 FPS p99 @ 1080p | MEDIUM | 5 (final perf gate; fallback = 1600×900 internal) |

---

## 11. Open Questions (deferred until execution)

- **OQ-V2-G-01** — Exact Godot 4.x point release (4.3 stable vs 4.4
  stable) — pinned in T-G-01 once operator runs the editor for the
  first time.
- **OQ-V2-G-05** — Final cel-shader edge thresholds (depth + normal)
  — resolved during T-G-10 calibration; ≥ 3 runs document final values.
- **OQ-V2-G-08** — CharacterBody3D vs RigidBody3D for player pawn —
  decided in Wave 3 after first prototype tick.
- **OQ-V2-G-11** — Fallback render resolution if Iris Xe misses 60 FPS
  p99 — 1600×900 candidate; gate fires in Wave 5.

---

## 12. Sizing

| Wave | Parallel agents | Sessions est. |
|---|---:|---:|
| 0 (operator) | 0 | 0 |
| 1 | 3 | 1 |
| 2 | 3 | 1 |
| 3 | 3 | 1–2 |
| 4 | 3 | 1–2 |
| 5 | 1 | 1 |
| **Total** | | **5–7 orchestrator sessions** |

Unchanged from the cancelled stylized SPEC's session estimate — Godot
dev velocity matches UE5 for this scope. The engine swap is a
rectilinear replacement, not a re-architecting.

---

## 13. Final Verification (end-to-end, post-CLOSURE)

```bash
RELEASE=repos/tauan-games/aero-fighters-v2
SPECS=repos/tauan-games/specs

# All ACs marked done
grep -c '^- AC-V2-G-.*\[x\]' $RELEASE/Tests/AcceptanceCriteria.md

# Perf gate green on Iris Xe @ 1080p native
python3 $RELEASE/Tools/perf-harness.py --assert-only

# Screenshot-diff green on Godot cel-shaded baselines
python3 $RELEASE/Tools/screenshot-diff-harness.py --compare

# v1 still green (parallel evolution)
gh run list --workflow=ci-v1.yml --limit 1 --json conclusion --jq '.[0].conclusion'

# ACTIVE.md flipped to ARCHIVED (after CLOSURE write + git mv to _archive/)
grep -E 'phase:\s*ARCHIVED' $SPECS/releases/ACTIVE.md
```

All green → MVP-2 shipped on Godot 4 Degrau 3. v2.1 release opens with
either further stylized iteration on Godot (operator's call) or with
the deferred UE5 photoreal scope if hardware allows by then.

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
multiple game-specialized agents in parallel that write to non-overlapping
file sets. Verification runs between waves; on green the next wave fires.
The Inspiron 15-3511 (Iris Xe G7) is the only dev and test box. No
self-hosted runner, no cloud GPU.

Total **5 implementation waves + Wave 0 (operator bootstrap)** covering 22
seed tasks across 5–6 weeks (NFR-V2-G-04). Wave count unchanged from the
cancelled stylized SPEC because scope is unchanged — only the engine is
swapped. Wave 0 is simpler (Godot is single-`.zip` install vs UE5 source
build), Wave 1 simpler (scene tree vs 4-module C++ layout), Waves 2–5
comparable.

All tasks start `[ ]` OPEN. No `[x]` carryover pre-marks: every
engine-touching artifact needs Godot-shaped rewrite per the carryover
ledger in TASKS.md.

---

## 2. Wave Roster

| Wave | Phase | Tasks | Calendar |
|---|---|---|---|
| 0 | Operator bootstrap | Godot 4 install + git lfs verify (no secrets needed post-AWS-pivot) | week 0 |
| 1 | Project skeleton + config + CI | T-G-01, T-G-02, T-G-04, T-G-05, T-G-11, T-G-13, T-G-14 | week 1 |
| 2 | Inhaúma data pipeline + Terrain3D | T-G-06, T-G-16, T-G-12 | week 2 |
| 3 | Pawn + flight + cel-shader | T-G-10, T-G-15 + FR-V2-G-03/04/09/10 | week 3 |
| 4 | Combat + mission system + targets | T-G-17, T-G-18, T-G-19, T-G-20 + FR-V2-G-05/06/08 | week 4 |
| 5 | Harness + perf + closure | T-G-07, T-G-08, T-G-09, T-G-21, T-G-22, T-G-23 | weeks 5–6 |

---

## 3. Wave 0 — Operator Bootstrap (BLOCKING)

Operator-driven; no agents fire until all green.

- [ ] Godot 4 stable installed (Mono build) — download `.zip` from
  <https://godotengine.org/download/linux>, unzip to
  `~/godot/Godot_v4.x-stable_mono_linux_x86_64/`. Verify
  `<bin> --version` exits 0.
- [x] **SRTM source: AWS Open Data mirror (no auth needed)** — amended
  2026-05-18. NASA EarthData creds remain in `.env.local` but are
  optional and not in MVP-2 critical path; reserved for future
  MODIS/Landsat workflows.
- [ ] `git lfs version` exits 0.

All green → Wave 1 spawns.

---

## 4. Wave 1 — Project Skeleton + Config + CI

**Tasks:** T-G-01, T-G-02, T-G-04, T-G-05, T-G-11, T-G-13, T-G-14.
**Calendar:** week 1.

**`game-developer`** — T-G-01 (pin Godot, document version),
T-G-04 (project.godot Forward+ + scene tree skeleton + autoloads),
T-G-05 (GameConfig.tres + MissionConfig.tres with origin/spawn coords +
flight constants + mission HPs/coefficients).

**`devops-engineer`** — T-G-02 (`.github/workflows/aero-v2-godot-ci.yml`:
gdtoolkit lint + scene-file validity + flake8 Tools/ + lfs verify; no
self-hosted runner; defer headless Godot CI run to Wave 5).

**`game-developer` (ops hat)** — T-G-11 (`.env.local.example`: drop UE/
Cesium/Google, add NASA + GODOT_BIN_PATH), T-G-13 (Godot-shaped
`.gitignore`: `.godot/`, `*.import`, `*.uid`, `addons/*/cache/`,
`StagedBuilds/`), T-G-14 (LFS `.gitattributes` for `*.gltf`, `*.png`,
`*.ogg`, `*.wav`, `*.tif`).

**Verification:** `project.godot` boots headless; scene files present;
Resource files present; CI workflow present; `.env.local.example` strips
UE5 vars and adds GODOT_BIN_PATH. All green → Wave 2.

---

## 5. Wave 2 — Inhaúma Data Pipeline + Terrain3D

**Tasks:** T-G-06, T-G-16, T-G-12. **Calendar:** week 2.

**`game-developer` (ops hat)** — T-G-06: rewrite
`Tools/inhauma-data-fetch.py`. Clip Brazil-southeast PBF (Geofabrik) to
Inhaúma bbox; export buildings JSON (cap top 5,000 by area per RR-V2-G-03)
+ landuse JSON; download SRTM tiles from AWS Open Data mirror
(`elevation-tiles-prod.s3.amazonaws.com/skadi/`, no auth, amended
2026-05-18 per SPEC §8); merge + reproject UTM 23S;
emit 16-bit PNG ready for Terrain3D import; record source revisions in
`Content/World/SOURCES.md`.

**`game-developer`** — T-G-16: install Terrain3D addon under
`addons/terrain_3d/` (verify CC0/MIT license per RR-V2-G-05). Enable
plugin. Add `Terrain3D` node to `Main.tscn`. Import the 16-bit PNG
heightmap. Verify Terrain3D height at origin within 5 m of source SRTM
(AC-V2-G-02). Document workflow. Fallback if license incompatible:
tiled `MeshInstance3D` 5×5 grid (4 km × 4 km each).

**`game-developer` (ops hat)** — T-G-12: rewrite `README.md` for Godot 4.
Drop all UE5/Cesium/GCP/Google/NASA-EarthData-as-required content. Add
Godot 4 install, OSM ODbL attribution, AWS Open Data SRTM attribution
(no auth needed), Linux-only export instructions, scene-tree
architecture overview, cel-shader notes.

**Verification:** fetch script runs; heightmap PNG + TIF + buildings JSON
present; Terrain3D directory present; README mentions Godot 4 and
"ODbL". All green → Wave 3.

---

## 6. Wave 3 — Pawn + Flight + Cel-Shader

**Tasks:** T-G-10, T-G-15 + FR-V2-G-03/04/09/10. **Calendar:** week 3.

**`game-developer`** — pawn, flight, cameras, HUD:
- `scripts/flight_arcade.gd` per FR-V2-G-04. Decide
  `CharacterBody3D` vs `RigidBody3D` (recommend RigidBody3D for boundary-
  spring impulse; OQ-V2-G-08).
- `scripts/camera_controller.gd`: Chase (SpringArm3D) ↔ Cockpit
  (direct child `Camera3D`); `cycle_camera` action.
- 8 actions in InputMap (`throttle_up/down`, `pitch_up/down`, `roll_l/r`,
  `yaw_l/r`, `fire_cannon`, `barrel_roll`, `cycle_camera`, `pause`).
- `scenes/HUD.tscn` Control tree: 8 elements per FR-V2-G-10.

**`game-developer`** — T-G-10 cel-shader: build
`scenes/CelShaderPass.tscn` (CanvasLayer + fullscreen ColorRect +
`shaders/cel_screen_space.gdshader`). Diffuse 3-band quantization,
Sobel outline on depth + normal (provisional thresholds depth 0.04
normal 0.55; calibrate ≥ 3 runs). Cost target ≤ 0.8 ms on Iris Xe @
1080p. Document calibration in `docs/cel-shader-calibration.md`.

**`game-designer` (hat)** — T-G-15: import HandModeled.md as
`Content/Aircraft/aircraft.gltf`; create `aircraft.tscn` PackedScene
with `MeshInstance3D` + `CollisionShape3D` + `Marker3D` mounts. Apply
`StandardMaterial3D` with Toon shading enabled.

**Verification:** flight_arcade.gd present; CelShaderPass.tscn present;
cel-shader cost ≤ 0.8 ms (operator PIE smoke verifies). All green → Wave 4.

---

## 7. Wave 4 — Combat + Mission System + Targets

**Tasks:** T-G-17, T-G-18, T-G-19, T-G-20 + FR-V2-G-05/06/08.
**Calendar:** week 4.

**`game-developer`** — T-G-19 + T-G-20 + combat + crash:
- T-G-19: `autoload/MissionManager.gd` (Godot Autoload singleton).
  State: cycle counter, alive targets, HP × 1.15/cycle, AA interval
  × 0.92/cycle. Signals: `mission_complete`, `cycle_advanced`,
  `target_destroyed`.
- T-G-20: three target PackedScenes + scripts: factory (HP 20, mega-
  explosion GPUParticles3D), base (HP 28, multi-stage radar-then-building
  destruction), aa_cluster (3 sub-guns @ HP 6, range 220 m, interval 1.7 s).
- `scripts/cannon.gd`: 12.5 r/s, pool 30, Area3D `body_entered` hit
  detection.
- `scripts/crash_detector.gd`: samples Terrain3D ground each physics
  tick; crash on `altitudeDelta < 5 m`.

**`game-developer`** — T-G-17 (`scripts/building_spawner.gd` Autoload:
read buildings JSON; MultiMeshInstance3D ≤ 5,000 instances;
`M_CelBuilding` Toon material), T-G-18 (`scripts/foliage_spawner.gd`
Autoload: scatter trees/bushes on landuse polygons; ≤ 12,000 instances).

**`game-designer` (hat)** — own-work cel-friendly Toon materials for
factory/base/AA cluster meshes.

**Verification:** three target scenes present; MissionManager autoload
present; operator PIE: 3 targets → MISSION COMPLETE → next cycle spawns.
All green → Wave 4.5.

---

## 7b. Wave 4.5 — Map Fidelity Amendment (2026-05-19)

**Tasks:** T-G-25, T-G-26, T-G-27, T-G-28, T-G-29, T-G-30. **Calendar:**
mid-week 5 (inserted between Wave 4 closure and Wave 5 harness work).
Within-release amendment per approved plan
`.claude/plans/we-need-to-evolve-tranquil-dragon.md` §Phase B. ACTIVE.md
phase unchanged (release stays IMPLEMENTATION); CLOSURE happens once Wave 5
also closes.

**3-agent parallel structure (single wave) with strict file-set walls:**

- **`game-designer`** — T-G-25. Writes only `Tools/inhauma-data-fetch.py`
  (extend with 3 new `osmium tags-filter` passes) and emits
  `Content/World/inhauma-{roads,places,hydro}.json`. Commits JSON via LFS.
- **`game-developer` (dev-A)** — T-G-26. Writes only
  `scripts/road_spawner.gd` and the road MultiMeshInstance3D node added to
  `scenes/Main.tscn`. No POI / hydro touch.
- **`game-developer` (dev-B)** — T-G-27 + T-G-28. Writes only
  `scripts/poi_spawner.gd`, `scripts/hydro_spawner.gd`, and the POI + hydro
  nodes in `scenes/Main.tscn` (different node names from dev-A's road
  node, no collision).

After the 3-agent wave: `game-tester` runs T-G-29 (visual verification
screenshots committed to `Reports/map-fidelity/`); `product-engineer`
runs T-G-30 (final amendment evidence appended to SPEC §16 with commits).
Closes FR-V2-G-21..24 and AC-V2-G-24..27.

**Verification:** headless boot grep matches `[(terrain|road|poi|hydro)_spawner]`
prints; AC counts hit floors (roads ≥ 200, places ≥ 5, hydro ≥ 1). All
green → Wave 5.

---

## 8. Wave 5 — Harness + Perf + Closure

**Tasks:** T-G-07, T-G-08, T-G-09, T-G-21, T-G-22, T-G-23.
**Calendar:** weeks 5–6.

**`game-developer` (tester hat)** — all Wave 5 tasks:
- T-G-21: determinism harness (`--test-mode` + Ctrl+T) in
  `autoload/Telemetry.gd` (time_scale lock, physics tick 60, RNG seed
  `0xAER0DA0AIA`, cel-shader force-apply, fixed light/wind/camera,
  Terrain3D streaming gate).
- T-G-22: `Tools/capture_pose.gd` (Godot driver for headless screenshot
  capture: `godot --headless --quit-after N --script ... --pose <id>`).
- T-G-08: rewrite `Tools/screenshot-diff-harness.py` Python driver to
  invoke T-G-22's GDScript driver. SSIM + pHash algorithm survives;
  re-capture 4 cel-shaded baselines at Iris Xe @ 1080p native; commit
  to `Tests/baselines/linux/` (LFS). Thresholds: SSIM ≥ 0.78/cam, mean
  ≥ 0.84, pHash ≤ 16.
- T-G-23: `Tools/perf_capture.gd` (Godot driver: 60 s scripted flight
  loop, CSV `tick,fps,frame_ms` to stdout).
- T-G-09: rewrite `Tools/perf-harness.py` Python driver for new stdout
  format. Algorithm unchanged. Update docstring + assertion message to
  cite Godot 4 + Iris Xe @ 1080p native. Numbers unchanged
  (mean ≥ 60, p99 ≤ 18.5 ms).
- T-G-07: author full AC-V2-G-01..23 traceability matrix in
  `Tests/AcceptanceCriteria.md`.

**Closure phase:** product-engineer invokes `dadaia-release-closure` skill —
writes `CLOSURE.md`, flips ACTIVE.md to `phase: CLOSURE`, updates
`specs/memory/architecture.html` + `specs/memory/tech-stack.html`
(foundation already amended pre-release; closure rev confirms state),
then flips ACTIVE.md to `phase: ARCHIVED` and `git mv` release dir
to `specs/_archive/releases/`.

**Verification:** screenshot-diff self-check OK; perf-harness assert
mean ≥ 60 + p99 ≤ 18.5; AC matrix has all 23 marked DONE; CLOSURE.md
written. All green → release CLOSURE complete.

---

## 9. Cross-Wave Invariants

1. **Marker hygiene** — flip `[ ]` → `[-]` before any production write;
   `[-]` → `[x]` after committing. One `[-]` per TASKS.md.
2. **No UE5, no Cesium, no Google Maps Tiles** — any reference to UE5
   classes/files in the working tree is a CI fail. UE5 is the deferred
   Degrau 4 slot.
3. **v1 untouched** — no agent modifies `repos/tauan-games/aero-fighters/`.
4. **CC0 only** — Terrain3D plugin license verified CC0/MIT before
   commit (T-G-16); audio in `Content/Audio/LICENSE.md`.
5. **Operator-only distribution** — no Windows/macOS export, no Releases,
   no itch.io, no Steam.
6. **Scope errors** — agent outside scope replies `[SCOPE ERROR]`.
7. **Commit format** — `feat|fix|chore(<scope>): <message> (<task-id>)`
   for code; `chore(tasks): start|finish <task-id>` for marker flips.
8. **Auto-advance gate** — every wave's verification must exit 0 before
   the next wave fires.

---

## 10. Risk Closure Map (vs SPEC §12)

| Risk | Severity | Wave that closes |
|---|---|---|
| RR-V2-G-01 — Godot + Terrain3D install on Iris Xe | LOW | 0 |
| RR-V2-G-02 — Cel-shader fidelity vs UE5 | LOW | 3 (T-G-10 calibration) |
| RR-V2-G-03 — GDScript MultiMesh slower than UE5 PCG | MEDIUM | 4 (cap 5,000); 5 (perf validates) |
| RR-V2-G-04 — NASA EarthData email confirmation | LOW | 2 (T-G-06 first run) |
| RR-V2-G-05 — Terrain3D plugin license | MEDIUM | 2 (T-G-16 verifies) |
| RR-V2-G-06 — OSM data quality sparse | MEDIUM | 4 (MultiMesh filter) |
| RR-V2-G-07 — Mission state churn | LOW | 4 (Autoload profiling) |
| RR-V2-G-08 — OSM ODbL attribution | LOW | 2 (T-G-12 + boot splash) |
| RR-V2-G-09 — Godot headless on GH-hosted | LOW | 5 (T-G-22 verifies) |
| RR-V2-G-10 — Aircraft cel material rework | LOW | 3 (T-G-15) |
| RR-V2-G-11 — Iris Xe 60 FPS p99 @ 1080p | MEDIUM | 5 (fallback 1600×900) |

---

## 11. Sizing

| Wave | Parallel agents | Sessions est. |
|---|---:|---:|
| 0 (operator) | 0 | 0 |
| 1 | 3 | 1 |
| 2 | 3 | 1 |
| 3 | 3 | 1–2 |
| 4 | 3 | 1–2 |
| 5 | 1 | 1 |
| **Total** | | **5–7 orchestrator sessions** |

Unchanged from the cancelled stylized SPEC. Engine swap is rectilinear,
not re-architecting.

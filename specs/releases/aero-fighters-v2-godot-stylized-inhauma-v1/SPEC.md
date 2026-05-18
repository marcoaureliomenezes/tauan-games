# SPEC: Aero Fighters v2 — Godot Stylized Inhaúma (MVP-2)

> **Status:** Aprovado — 2026-05-18 (operator pre-approved during grill session; substitui aero-fighters-v2-stylized-inhauma-v1)
> **Release id:** aero-fighters-v2-godot-stylized-inhauma-v1
> **Engine ladder slot:** Degrau 3 (Godot 4) — foundation amended 2026-05-18 per ADR-V2-G-02
> **Supersedes:** aero-fighters-v2-stylized-inhauma-v1 (cancelled 2026-05-18 — hardware constraint on UE5 source build)
> **Grill input:** .dadaia/reports/tauan-games/product-engineer/2026-05-18T005834Z-godot-pivot.html
> **Author:** product-engineer (dadaia Labs)
> **Created:** 2026-05-18
> **Depends-on:** `specs/foundation/SPEC.md` (amended 2026-05-18 for 4-degrau ladder),
> `specs/memory/architecture.html`, `specs/memory/tech-stack.html`

---

## 1. Overview

This release executes the **Degrau 3 (Godot 4)** slot of the newly-amended
foundation engine ladder by standing up **`aero-fighters-v2/`** as a native
Godot 4 project rendering a **stylized cel-shaded** depiction of Inhaúma MG
over a 20 km radius, built from **OpenStreetMap building footprints and NASA
SRTM 30 m heightmaps**. Photorealistic 3D Tiles, Cesium, UE5 Lumen/Nanite,
and any UE5-specific tooling are all out of scope. The Godot 4 Forward+
renderer is the rendering profile; no upscaling is needed at 1920×1080
native on Iris Xe.

The pivot was forced at the start of Wave 0 of the cancelled
`aero-fighters-v2-stylized-inhauma-v1` release by a fundamental hardware
incompatibility: UE 5.5 source build on the operator's Ubuntu 24.04 + Iris
Xe environment is hostile (clang-18/libicu74 mismatches in the bundled
toolchain; broken bundled DotNet that requires `libicudata.so.64.1` EOL'd in
Ubuntu ≥24.04; GitDependencies tool systematically dropping Linux x86_64
binaries for libpng, libcurl, libnghttp2, libfreetype, OpenEXR, uejpeg).
After 2h of stacked fixes (dotnet wrapper, `Library.props` stub, Oodle
stubs, Ionic symlink, manual toolchain install, `GitDependencies --force
--all`), the editor still failed to build. Operator decision via
`dadaia-grill-me`: pivot v2 to Godot 4 and amend the foundation ladder
from 3 to 4 degraus (ADR-V2-G-01 + ADR-V2-G-02).

Scope of MVP-2 gameplay is unchanged from the cancelled stylized-v1
release: spawn-in-air over Inhaúma, arcade flight (throttle / pitch / roll
/ yaw / stall), cannon at 12.5 rounds/sec, **three target types in one
mission cycle** (factory, base, AA cluster), mission win-condition that
advances to the next cycle with +1 difficulty, hit detection, crash
detection via Terrain3D ray queries, two cameras (chase + cockpit), a HUD,
fixed-midday sun, cel-shader CanvasItem screen-space pass + StandardMaterial3D
cel-mix on aircraft and buildings, and a determinism + screenshot-diff
harness re-baselined for cel-shaded poses on Iris Xe @ 1080p native.

The release is **operator-only local runs on Linux x64**. Windows and macOS
exports are deferred. Public distribution is deferred. The MVP-2 timeline
is **5–6 weeks** (Godot dev velocity is comparable to UE5 for this scope;
the engine swap does not change calendar).

The v1 (Three.js) game continues to evolve on its own ladder slot —
parallel-evolution per the foundation. No v1 changes are in scope here.

---

## 2. Problem Statement

The previously-approved release `aero-fighters-v2-stylized-inhauma-v1`
pinned UE 5.5 as the engine for the stylized Inhaúma MVP. Wave 0 of its
PLAN required a working UE5 source build on the operator's Inspiron 15-3511
+ Iris Xe + Ubuntu 24.04. Mid-Wave-0, 2h of build attempts confirmed the
UE 5.5 source build is fundamentally hostile to that environment:

1. UE 5.5 official Linux support targets Ubuntu 22.04; Ubuntu 24.04
   introduces clang-18.1 + libicu74 incompatibilities with what UE5 expects.
2. The bundled DotNet binary distributed via UE5's `Setup.sh` requires
   `libicudata.so.64.1`, which is EOL'd on Ubuntu ≥24.04. A wrapper script
   workaround is overwritten by `Setup.sh --force`.
3. GitDependencies has reproducible gaps in fetched Linux x86_64 blobs for
   libpng, libcurl, libnghttp2, libfreetype, OpenEXR, uejpeg — not a
   transient network failure.
4. `Setup.sh --force` is non-idempotent: it overwrites manual fixes (e.g.
   our dotnet wrapper, `Library.props` stub, Oodle stubs, Ionic symlink),
   making the path unrecoverable without re-applying the stack each time.

The operator chose, via a structured grill-me session (two ADRs locked in
`.dadaia/reports/tauan-games/product-engineer/2026-05-18T005834Z-godot-pivot.html`):

- **ADR-V2-G-01:** Engine for `aero-fighters-v2/` changes from UE 5.5 to
  Godot 4 (latest stable point release at implementation start, currently
  4.3 or 4.4). UE5 deferred to a future game/release when hardware allows.
- **ADR-V2-G-02:** Foundation engine ladder amended from 3 to 4 degraus.
  Phaser (1) → Three.js (2) → Godot 4 (3, NEW) → UE5 (4, reserved for
  future). UE5 is not removed from the ladder; it is deferred.

Godot 4 is Iris-Xe-viable because:

1. The Forward+ renderer is designed for indie-class GPUs and fits Iris Xe
   at 1080p native without upscaling (no TSR needed; cancelled SPEC's
   720p → TSR 1080p path becomes a 1080p native path).
2. Godot installs from a single ~80MB `.zip` from `godotengine.org` — no
   source build, no toolchain stack, no DotNet dependency.
3. The Terrain3D plugin imports SRTM heightmaps directly (no Landscape
   import workflow).
4. Godot's cel-shading community + documentation are mature — multiple
   production games ship cel-shaders via screen-space CanvasItem shaders +
   StandardMaterial3D cel-mix.
5. GDScript-first development matches the Blueprints-first velocity of
   the cancelled SPEC; C# is the C++ promotion equivalent.

The aesthetic (cel-shaded toon), setting (Inhaúma MG, 20 km, OSM + SRTM
topology-faithful), scope (MVP-2: 1 mission cycle, 3 target types, win
condition + next mission with +1 difficulty), perf target (mean ≥ 60 FPS,
p99 ≤ 18.5 ms on Iris Xe G7), CI strategy (lint-only GH-hosted, no
self-hosted runner), license posture (CC0 only), and distribution
(operator-only local runs) all carry over from the cancelled SPEC
unchanged.

---

## 3. Goals

1. Stand up `aero-fighters-v2/` as a Godot 4 stable project with **GDScript-first**
   policy and explicit C# promotion triggers documented in NFR-V2-G-05.
2. Build a topology-faithful stylized world over the 20 km radius around
   Inhaúma MG from **OpenStreetMap building footprints + NASA SRTM 30 m
   heightmap**. No live tile streaming, no Cesium, no UE5 Landscape.
3. Deliver MVP-2 combat: arcade flight + cannon @ 12.5 r/s + **three target
   types in one mission cycle** (factory, base, AA cluster) + win-condition
   that advances to next cycle with +1 difficulty.
4. Render in **Godot 4 Forward+ at 1920×1080 native** at **mean ≥ 60 FPS,
   p99 ≤ 18.5 ms on Intel Iris Xe G7 80EU**. No TSR, no upscaling — Godot
   Forward+ fits Iris Xe directly at 1080p.
5. Apply the "**Inhaúma in Toon**" art direction: screen-space cel-shader
   shader (CanvasLayer fullscreen pass) + StandardMaterial3D cel-mix on
   aircraft, buildings, and targets; outline detection on depth+normal
   edges via Sobel kernel; fixed midday sun.
6. Ship a deterministic screenshot-diff harness (SSIM + pHash) re-baselined
   for cel-shaded poses captured via `godot --headless --quit-after N
   --script capture_pose.gd`. Runs on git tags + nightly cron on
   GH-hosted runner.
7. Keep the v1 Three.js Playwright suite green throughout the cycle
   (parallel evolution).
8. Hold MVP-2 duration to **5–6 weeks** (no engine-swap penalty — Godot dev
   velocity comparable to UE5 for this scope) with a 3-gate if-slip rule
   wired into the schedule.

---

## 4. Non-Goals

- **No public distribution in MVP-2.** No GitHub Releases zip, no Windows
  installer, no Linux `.deb`/`.AppImage`, no itch.io, no Steam.
  Operator-only local runs.
- **No Windows, no macOS exports in MVP-2.** Linux x64 native only.
  Windows + Mac deferred to a future release contingent on user demand or
  hardware change.
- **No Unreal Engine 5 in this release.** UE5 is the reserved Degrau 4
  slot per ADR-V2-G-02 amendment; will be revived in a future
  game/release when hardware allows.
- **No Cesium for Unreal plugin, no UE5 Landscape, no UE5 PCG.** Replaced
  by Godot Terrain3D + GDScript scatter + MultiMeshInstance3D.
- **No Google Map Tiles API, no GCP project, no paid tile source.** OSM
  and NASA EarthData are free and CC-licensed.
- **No Photorealistic 3D Tiles.** Stylized cel-shaded only.
- **No TSR / FidelityFX / DLSS / FSR upscaling.** Godot Forward+ at 1080p
  native fits Iris Xe directly.
- **No JSBSim or any aerodynamic-surface flight model.** Arcade flight
  only.
- **No real-world aircraft IP likeness.** Generic delta-wing fighter only;
  hand-modeled mesh carried over from cancelled T-S-03 / T-003.
- **No full v1 sortie state machine.** No takeoff, landing, taxi, service
  scene, ejection, or refuel/rearm in v2 MVP-2. Spawn airborne.
- **No nuclear FX, missiles, bombs, multiplayer.** Deferred to v2.1+.
- **No mission system beyond 1-cycle loop with +1 difficulty.** Full v1
  sortie campaign deferred.
- **No screenshot-diff on per-PR CI.** Tag + nightly cron only.
- **No self-hosted GitHub Actions runner.** GH-hosted `ubuntu-latest`
  only; visual + perf gates are operator-local pre-commit.
- **No Fab / Quixel / external FBX assets.** Foundation's "no external
  assets" rule applies. CC0 audio + own-work geometry only.

---

## 5. Functional Requirements

### FR-V2-G-01 — OSM + SRTM Inhaúma terrain fetch pipeline (carryover from cancelled FR-V2-S-01)

A Python tool `aero-fighters-v2/Tools/inhauma-data-fetch.py` fetches and
prepares the world-data assets for the 20 km radius around Inhaúma MG:

1. **OSM extract:** download the Brazil-southeast `.osm.pbf` regional file
   from a CC-licensed mirror (Geofabrik or equivalent); clip to a bounding
   box around `(-19.47, -44.46)` ± ~0.20° via `osmconvert` or `osmium-tool`;
   output `Content/World/inhauma-osm.pbf` + flat JSON exports for
   buildings and landuse polygons.
2. **SRTM extract:** download NASA SRTM 30 m (SRTMGL1) tiles covering the
   bbox via NASA EarthData credentials (free account); assemble into a
   single GeoTIFF via `gdal_merge.py`; reproject to UTM zone 23S; output
   `Content/World/inhauma-heightmap.tif` plus a 16-bit PNG ready for
   Terrain3D import.

The tool is **deterministic** for a fixed bbox + fixed source revisions:
re-running on the same input produces byte-identical outputs. Both outputs
land in `Content/World/` and are tracked via Git LFS. This requirement is
engine-agnostic and survives the UE5 → Godot pivot intact.

### FR-V2-G-02 — Godot 4 Terrain3D heightmap import + georef

The Inhaúma heightmap from FR-V2-G-01 is imported into a Godot 4
Terrain3D addon node via the Terrain3D heightmap import workflow. Terrain
extent matches the 20 km × 20 km bbox in UTM zone 23S meters. World origin
is fixed at the Terrain3D centroid, which corresponds to WGS84
`(-19.47, -44.46)`. A small GDScript utility `inhauma_world_georef.gd`
exposes WGS84 ↔ Vector3 (world-local meters) conversions. The georef is
contained in this single autoload — no module isolation seam (Godot does
not require module-level enforcement; convention + review suffice).

### FR-V2-G-03 — Generic delta-wing player pawn (hand-modeled, carryover)

The MVP-2 aircraft is the **hand-modeled generic delta-wing fighter**
carried from cancelled T-S-03 (see `aero-fighters-v2/Content/Aircraft/HandModeled.md`).
The geometry is engine-agnostic primitive assembly; imported into Godot 4
via `.gltf` (preferred) or `.obj`. No real-world aircraft likeness (no
F-35, no MiG, no Su-27). License: own-work. The mesh is shipped as a
PackedScene `aircraft.tscn` with `MeshInstance3D` + `CollisionShape3D` +
camera mount points exposed as `Marker3D` children.

### FR-V2-G-04 — Arcade flight model (constants ported from v1, GDScript-first)

A `flight_arcade.gd` script attached to the player `CharacterBody3D` (or
`RigidBody3D` if CharacterBody3D proves insufficient — decided in PLAN)
implements throttle / pitch / roll / yaw with v1's constants ported from
`aero-fighters/src/config.js`:

| Constant | Value | Source |
|---|---:|---|
| `STALL_THRESHOLD` | 10 m/s | v1 `config.js` |
| `MIN_SPD` | 8 m/s | v1 `config.js` |
| `MAX_SPD` | 80 m/s | v1 `config.js` |
| `GRAVITY` | 14 m/s² | v1 `config.js` |
| `PITCH_RATE` | 1.45 rad/s | v1 `config.js` |
| `ROLL_RATE` | 2.30 rad/s | v1 `config.js` |
| `YAW_RATE` | 0.80 rad/s | v1 `config.js` |

Stall produces auto-recovery dive (v1 parity). No fuel, no atmospheric
density, no aerodynamic surfaces. JSBSim out of scope.

### FR-V2-G-05 — Cannon at 12.5 rounds/sec

`cannon.gd` script attached to the cannon `Marker3D` fires bullets at
12.5 rounds/sec ± 2% with a 30-`Bullet`-PackedScene pool (object pooling
via GDScript array). Bullet speed 110 m/s, lifetime 2.0 s, muzzle position
parented to the nose `Marker3D`. Hit detection via Godot Area3D signal
`body_entered`.

### FR-V2-G-06 — Three target scenes (factory + base + AA cluster)

Each target type is a PackedScene with health, hit reaction, destruction
visual + audio, and post-destruction state:

| Target type | Scene | HP | Behavior | Destruction visual |
|---|---|---:|---|---|
| **Factory** | `scenes/Targets/factory.tscn` | 20 | Static; smokestacks emit GPUParticles3D smoke pre-hit | Mega-explosion: layered GPUParticles3D (fireball + smoke column + ground debris), 4 s sustained, camera shake on cockpit camera via tween |
| **Base** | `scenes/Targets/base.tscn` | 28 | Static; radar dish rotation via AnimationPlayer + barracks geometry | Multi-stage detonation: radar destroyed first (sub-hit at HP 8), then main building; 3 s explosion sequence |
| **AA cluster** | `scenes/Targets/aa_cluster.tscn` | 6 per gun, 3 guns | 3-gun emplacement; each gun fires back at the pawn (dumb-fire, base interval 1.7 s, range 220 m) | Per-gun destruction; cluster fully destroyed when all 3 guns gone |

Placement: 1 factory, 1 base, 1 AA cluster per mission cycle. All anchored
to WGS84 via `inhauma_world_georef.gd`; positions stored in
`mission_config.tres` (Godot Resource). AA cluster spawns near WGS84
`(-19.490, -44.387)` (carried from cancelled FR-V2-07/FR-V2-S-07
placement).

### FR-V2-G-07 — Mission win-condition + next mission with +1 difficulty

Mission cycle completes when **all three target types are destroyed**.
Upon completion: HUD displays "MISSION COMPLETE", 3 s pause, then advances
to the next mission cycle with:

- Same Inhaúma world, same player pawn state preserved
- Target HPs scaled ×1.15 per cycle
- AA cluster base fire interval scaled ×0.92 per cycle (faster fire-back)
- Cycle counter incremented in HUD (displayed as "Mission N")

No mission-end cutscene, no scoreboard screen, no save-state — endless
cycle loop until the player crashes or quits. Mission state lives in
Autoload `MissionManager.gd` (singleton autoloaded at project start).

### FR-V2-G-08 — Crash detection via Terrain3D ray queries

`crash_detector.gd` script samples the Terrain3D ground under the pawn each
physics tick via `Terrain3D.get_height(global_position)` (or
`PhysicsDirectSpaceState3D.intersect_ray()` downward as fallback). Crash
when altitude delta < `MOUNTAIN_BUFFER = 5 m`. Sea / out-of-world crash
when pawn altitude < 0 m MSL.

### FR-V2-G-09 — Two cameras + Godot Input map

A single InputMap (defined in `project.godot`) with actions:
`throttle_up`, `throttle_down`, `pitch_up`, `pitch_down`, `roll_left`,
`roll_right`, `yaw_left`, `yaw_right`, `fire_cannon`, `barrel_roll`,
`cycle_camera`, `pause`. Two camera modes: **Chase** (default,
`SpringArm3D` behind + above the aircraft) and **Cockpit / Nose** (forward-
looking `Camera3D` child of aircraft for cannon aim). Wide-chase, flyby,
and orbit cameras deferred to v2.1.

### FR-V2-G-10 — HUD (Control nodes): airspeed, altitude AGL, throttle, ammo, crosshair, score, mission progress, boundary warning

Godot Control + Label + TextureRect nodes under a `CanvasLayer` root.
No external font assets (use Godot default font or single bundled OFL
font); no external sprite assets (procedural rectangles + lines).
HUD shows:

- Airspeed (m/s)
- Altitude AGL (computed from FR-V2-G-08 Terrain3D sample)
- Throttle %
- Cannon ammo
- Crosshair (cel-friendly vector style consistent with art direction)
- Score (cumulative across mission cycles)
- **Mission progress: 3 target icons that flip from "alive" to "destroyed"
  glyph as targets die; "Mission N" counter in upper right**
- Boundary state warning at 18 km (per FR-V2-G-19)

### FR-V2-G-11 — Cel-shader: screen-space pass + per-mesh cel-mix

Two-layer cel-shading approach (carryover intent from cancelled FR-V2-S-12,
rewritten for Godot pipeline):

1. **Screen-space cel pass:** a fullscreen `CanvasLayer` with a `ColorRect`
   wearing a `ShaderMaterial` that reads the viewport screen texture.
   The shader does:
   - **Diffuse step-quantization:** sample scene color, divide luminance
     into 3 bands (shadow / midtone / highlight), output flat color per
     band.
   - **Outline detection:** sample depth via `DEPTH_TEXTURE` and normal
     via a custom normal-output buffer (Godot 4 supports normal output via
     a depth-prepass + normal-encode in alpha); compute Sobel edge over a
     3×3 kernel; emit black outline pixel where edge magnitude exceeds
     threshold (depth-edge threshold 0.04, normal-edge threshold 0.55,
     tuned in PLAN).
   - **Saturation lift:** ×1.15 saturation on quantized output.
2. **Per-mesh StandardMaterial3D cel-mix:** aircraft, buildings, and target
   meshes use `StandardMaterial3D` with `Toon Shading` enabled (Godot 4's
   built-in shading_mode = TOON) for the bulk of their look; the
   screen-space pass adds outlines + global saturation.

Sun direction fixed: `DirectionalLight3D` with rotation set in PLAN
(midday sun, ~45° elevation, ~45° azimuth). Sky = Godot's procedural sky
shader. **No HDRI environment.** Outline pass cost target: ≤ 0.8 ms on
Iris Xe @ 1080p native.

### FR-V2-G-12 — OSM building extrusion via GDScript + MultiMeshInstance3D

Building footprints from FR-V2-G-01's `inhauma-buildings.json` are loaded
at level start by a `building_spawner.gd` Autoload that:

1. Reads the JSON via Godot's built-in JSON parser.
2. For each building polygon, computes the centroid + footprint bounding
   box, generates a box mesh with height `building:levels × 3.0 m`
   (default 3 levels = 9 m when `building:levels` is absent), and adds
   it as a `MultiMeshInstance3D` instance under the buildings root.
3. The buildings root holds a single `MultiMesh` with all instances —
   one draw call for the entire building set.
4. Applies the `M_CelBuilding` `StandardMaterial3D` with Toon shading
   enabled (paired with the cel-shader screen-space pass).

Buildings are static (no runtime spawning). Built once on level open
(cached in a `.tres` resource on first run; reused on subsequent runs).
Topology-faithful: Inhaúma's downtown rectangular grid + church +
scattered outlying buildings must be recognizable from the air. **Cap at
≤ 5,000 building instances per RR-V2-G-03 (MEDIUM risk on MultiMesh
throughput on Iris Xe vs UE5 PCG).**

### FR-V2-G-13 — Foliage scatter via GDScript + MultiMeshInstance3D

OSM `landuse=forest`, `landuse=grass`, `natural=tree` polygons drive
`foliage_spawner.gd` Autoload that scatters tree + bush meshes into a
`MultiMeshInstance3D`. Hand-modeled cel-friendly tree + bush primitives
(own-work, low-poly). Density: ~50 trees per hectare for forest,
~10 per hectare for grass-scatter. **Total foliage instance count budget:
≤ 12,000 across the 20 km × 20 km world** (target Iris Xe budget; same
number as cancelled SPEC, since Godot MultiMesh and UE5 HISM have
comparable throughput).

### FR-V2-G-14 — Audio palette (CC0)

CC0 SFX (freesound.org filter) for cannon, hit, factory-explosion,
base-explosion, AA-cluster-explosion, AA-fire-back WAVs/OGGs. Played via
`AudioStreamPlayer3D` for spatialized sounds (explosions, cannon fire) and
`AudioStreamPlayer` for non-spatial (HUD beeps, mission alert).
Jet-engine drone modulated by throttle % via an AudioStreamPlayer3D with
pitch_scale bound to throttle. No external music. Attributions recorded
in `Content/Audio/LICENSE.md`.

### FR-V2-G-15 — Determinism harness (replaces cancelled FR-V2-S-16)

A debug shortcut (Ctrl+T) or CLI flag `--test-mode` enables:

- `Engine.time_scale = 1.0` locked (no slow-mo / speed-up affecting tests)
- Fixed physics tick: `Engine.physics_ticks_per_second = 60`
- Deterministic RNG seed: `seed(0xAER0DA0AIA)` on all `RandomNumberGenerator`
  instances at boot
- Cel-shader screen-space pass force-applied (override any volume blend)
- Fixed DirectionalLight3D rotation (no time-of-day animation — there
  isn't one in MVP-2 anyway; this is a no-op safety override)
- Fixed wind vector `(1, 0, 0)` at 5 m/s (used by foliage wind animation
  shader if present)
- Fixed camera pose (loaded from a reference-pose `.tres` Resource)
- Terrain3D streaming gate: poll until `Terrain3D.is_ready()` (or
  equivalent signal) — hard timeout 10 s

Replaces the cancelled SPEC's UE5 cvar-based override set. Godot Forward+
has no temporal accumulation surface to discipline.

### FR-V2-G-16 — Screenshot-diff harness (re-baselined for Godot cel-shaded poses)

Python harness `aero-fighters-v2/Tools/screenshot-diff-harness.py` launches
a packaged Godot Linux x64 export with `--test-mode`, loads 4 **re-captured
cel-shaded reference poses** at the same WGS84 coordinates as the
cancelled SPEC's poses, applies the Terrain3D streaming gate + 1 s settle,
captures a screenshot via a small GDScript driver `capture_pose.gd`
(invoked through `godot --headless --quit-after N --script capture_pose.gd`),
computes SSIM + pHash against the new per-platform baseline set.

Thresholds (provisional, calibrated in PLAN over ≥ 3 sample runs on
Iris Xe):

- **SSIM ≥ 0.78 per camera** (carried from cancelled stylized SPEC;
  cel-shading remains flat and deterministic regardless of engine)
- **Mean SSIM ≥ 0.84** (carried)
- **pHash distance ≤ 16** (carried)

Linux baseline set only (Windows + macOS out of scope per NFR-V2-G-03).
Runs only on git tags + nightly cron on GH-hosted runner; visual gate is
operator-local on Iris Xe pre-commit.

### FR-V2-G-17 — Hit detection latency

Cannon-projectile hits a target Area3D within 100 ms of intersection.
Implemented via Godot Area3D `body_entered` signal (zero physics-tick
delay; signal fires next tick after intersection). Tested via FTF
deterministic projectile spawn 1 m from target.

### FR-V2-G-18 — Mission state machine + difficulty scaling

`MissionManager.gd` Autoload holds state: current cycle counter (int),
alive-target list (`Array[Node]`), HP multiplier (float, ×1.15 per
cycle), AA interval multiplier (float, ×0.92 per cycle). Emits signals
`mission_complete`, `cycle_advanced`, `target_destroyed`. HUD subscribes
to update mission-progress widget.

### FR-V2-G-19 — Boundary behavior at 20 km edge

3-tier soft boundary, carried unchanged from cancelled FR-V2-S-18:

1. 18 km — HUD "RESTRICTED ZONE" warning (red flashing Control fade).
2. 19.5 km — `WorldEnvironment` fog density ×10 (white-grey haze).
3. 20 km — invisible spring force pushing back proportional to overshoot
   (impulse applied in `flight_arcade.gd` based on distance from origin).

No game-over.

### FR-V2-G-20 — Local-only Linux x64 export configuration

The project exports release binaries for **Linux x64 only** via Godot CLI:

```bash
godot --headless --export-release "Linux/X11" \
  StagedBuilds/aero-fighters-v2-linux-x64
```

Single binary output. The operator runs locally. No `.exe`, no signing,
no installer, no Releases packaging. Build outputs land in
`aero-fighters-v2/StagedBuilds/` and are run directly. Windows and macOS
exports are out of scope.

---

## 6. Non-Functional Requirements

### NFR-V2-G-01 — Performance floor (Iris Xe baseline, 1080p native)

Intel Iris Xe G7 80EU sustains **mean ≥ 60 FPS averaged over a 60 s flight
loop above Inhaúma, frame-time 99th-percentile ≤ 18.5 ms** at:

- Render resolution: **1920×1080 native** (no upscaling)
- Renderer: **Godot 4 Forward+**
- MSAA: 2× (Godot Forward+ default)
- Shadow quality: PSSM 4-split, soft shadows OFF
- VRR / VSync: VSync ON, Adaptive

Per-frame budget on Iris Xe @ 1080p:

| Subsystem | Budget (ms) | Notes |
|---|---:|---|
| Terrain3D rendering | 4–6 | clipmap shader at 1080p |
| MultiMesh buildings | 2–3 | ≤ 5,000 instances, single draw call |
| MultiMesh foliage | 2–3 | ≤ 12,000 instances |
| Cel-shader screen-space pass | 0.8 | outline + quantization |
| GPUParticles3D FX | 1–2 | bullet trails + hit FX + explosions |
| GDScript tick aggregate | ≤ 2.0 | C# promotion trigger |
| Per-script tick | < 0.30 / script | C# promotion trigger |
| Headroom | 1.5–4.0 | adequate worst case at 1080p native (more than cancelled's 720p budget had) |

Two-tier perf gate: lint + headless smoke lane in PR CI; full windowed
run on tag CI on GH-hosted runner (acknowledging GH-hosted runner ≠ Iris
Xe — the tag CI run is a directional canary, not a perf floor proof;
operator runs the perf harness locally pre-commit).

### NFR-V2-G-02 — No external paid API costs

Zero monthly external API spend. NASA EarthData is free (account-gated,
no billing). OSM data is free. No Google Maps Tiles API. No Cesium Ion.
The operator's GCP project from the cancelled photoreal SPEC is unused
in this release.

### NFR-V2-G-03 — Platform: Linux x64 only

Linux x64 native local export only. No Windows native, no macOS, no
Proton/Wine. Future-release Windows + Mac contingent on user demand.
Godot 4 supports cross-export easily (single click), but we lock to
Linux x64 here to constrain scope.

### NFR-V2-G-04 — Timeline: 5–6 weeks

**5–6 weeks** from kickoff to MVP-2 closure (unchanged from cancelled
stylized SPEC; Godot dev velocity is comparable to UE5 for this scope).
3-gate if-slip rule active:

- **Gate-1 (end of Week 1):** Godot 4 installed, project boots, lint-only
  CI green on GH-hosted `ubuntu-latest`. If not, scope-cut: drop
  FR-V2-G-13 foliage scatter; ship buildings + terrain only.
- **Gate-2 (end of Week 3):** aircraft visible above Inhaúma Terrain3D
  with basic flight + cannon working. If not, scope-cut: drop one target
  type (base) → ship factory + AA cluster only.
- **Gate-3 (end of Week 5):** cel-shader + all 3 target types working at
  60 FPS on Iris Xe @ 1080p native. If not, AC drops to "shipped at 45
  FPS p99 ≤ 25 ms" and perf re-baseline becomes a v2.0.1 follow-up.

### NFR-V2-G-05 — GDScript-first with documented C# promotion

GDScript-first prototyping is the working policy. Godot 4 supports both
GDScript and C# in the same project; C# is the Godot equivalent of the
cancelled SPEC's C++ promotion path. Promotion to C# when any of:

- **Hard:** per-script `_physics_process` tick > 0.30 ms (operator-local
  profile gate).
- **Hard:** aggregate GDScript tick > 2.0 ms / frame (operator-local
  profile gate).
- **Soft:** any GDScript file > 600 lines (weekly review).
- **Trigger:** if frame budget breached in Week 2, promote
  `flight_arcade.gd` to C# immediately.

C# requires Godot Mono build (`Godot_v4.x-stable_mono_linux_x86_64.zip`).
Operator should install the Mono build from day 1 to keep the promotion
path open without re-pinning the engine binary later.

---

## 7. Stack Pinning

| Item | Pin | Notes |
|---|---|---|
| Engine | **Godot 4.x stable** (latest 4.3 or 4.4 point release at impl start; Mono build) | foundation Degrau 3 per ADR-V2-G-02 amendment; supports GDScript + C# |
| Renderer | **Forward+** | Project Settings; fits Iris Xe at 1080p native |
| Anti-alias | **MSAA 2×** | Godot Forward+ default |
| Render resolution | **1920×1080 native** | no upscaling |
| Terrain plugin | **Terrain3D** (latest stable from godot-asset-library; verify CC0 or MIT license) | replaces UE5 Landscape |
| Tile source | **NONE — static Terrain3D + GDScript-spawned MultiMesh buildings** | OSM + SRTM, prepared by FR-V2-G-01 |
| Heightmap source | **NASA SRTM 30 m (SRTMGL1)** via NASA EarthData (free account) | CC-compatible |
| Building footprints | **OpenStreetMap** Brazil-southeast `.osm.pbf` (Geofabrik) | ODbL — attribution required |
| Aircraft mesh | Hand-modeled own-work; imported via `.gltf` | carried from cancelled T-S-03 / T-003 |
| Target meshes (factory / base / AA cluster) | Own-work primitive assembly; PackedScenes | no external assets |
| Audio | CC0 freesound.org WAV/OGG + Godot AudioStreamPlayer3D | attribution in `Content/Audio/LICENSE.md` |
| Linter | **gdtoolkit** (`gdlint`, `gdformat`, `gdscript --check-only`) + GH-hosted CI lint | replaces clang-format |
| Build target | **Linux x64 only** via `godot --export-release "Linux/X11"` | no Windows, no macOS |
| CI runner | **GH-hosted `ubuntu-latest`** (lint + scene-file validity check + lfs verify) | no self-hosted runner |

---

## 8. Secret & Key Management

- **No secrets required for MVP-2.** SRTM tiles are fetched from the
  **AWS Open Data SRTM mirror** at
  `https://elevation-tiles-prod.s3.amazonaws.com/skadi/` — same
  SRTMGL1 v003 data NASA distributes, pre-packaged as `.hgt.gz` by
  Mapzen, hosted on S3 with anonymous public read. OSM extracts are
  fetched from Geofabrik (also anonymous). No URS account, no LP DAAC
  app authorization, no Google Maps Tiles API key, no GCP project, no
  UE5 license key.
  - **Amendment 2026-05-18:** SRTM source pivoted from NASA EarthData
    URS to AWS Open Data mirror after the auth probe to NASA CMR
    returned 401 (likely email-confirmation pending) while the AWS
    mirror returned 200 with no auth. AWS path is friction-free and
    serves identical SRTMGL1 v003 bytes.
- **NASA EarthData credentials (optional, kept for future workflows):**
  `aero-fighters-v2/.env.local` (gitignored) still holds
  `NASA_EARTHDATA_USERNAME` + `NASA_EARTHDATA_PASSWORD` from the prior
  setup. They are **not required** for MVP-2 — MODIS/Landsat or other
  NASA-restricted datasets in a future v2.X may use them.
- **OSM bounding box configuration:** `OSM_BBOX_NORTH/SOUTH/EAST/WEST`
  in `aero-fighters-v2/.env.local` defaults to ±0.20° around Inhaúma
  origin. Not secret — just configuration.
- **CI consumption:** zero secrets needed. The OSM + SRTM extract runs
  once on the operator's machine; outputs commit via Git LFS to
  `Content/World/`. CI just lints.
- **Rotation cadence:** N/A (no secrets in critical path).

---

## 9. Acceptance Criteria

| ID | Description | Pass condition | Method |
|---|---|---|---|
| AC-V2-G-01 | OSM + SRTM fetch tool produces deterministic outputs | Re-run `Tools/inhauma-data-fetch.py --bbox <fixed>` on same OS + same NASA/Geofabrik revisions → byte-identical `inhauma-heightmap.tif` + `inhauma-buildings.json` + `inhauma-osm.pbf`. | Python harness + diff |
| AC-V2-G-02 | Terrain3D import preserves heightmap fidelity | Terrain height at WGS84 `(-19.47, -44.46)` within 5 m of source SRTM sample. | GDScript test |
| AC-V2-G-03 | Pawn spawns ≥ 500 m AGL above Inhaúma Terrain3D | First physics tick after `_ready`: pawn altitude above Terrain3D ground in (500 m, 3000 m AGL); WGS84 z ≈ 2095 m ± 5 m. | GDScript test |
| AC-V2-G-04 | Arcade flight responds ≤ 1 frame input-to-effect | Apply full throttle 3 s; monotonic speed 0 → ≥ 24 m/s; pitch/roll/yaw deltas match FR-V2-G-04 constants. | GDScript test |
| AC-V2-G-05 | Cannon fires at 12.5 r/s ± 2% | Hold fire 10 s deterministic; count `bullet_spawned` signal emissions = 125 ± 3. | GDScript test |
| AC-V2-G-06 | Factory placed at known WGS84; HP=20; destroyed by cumulative cannon hits | Load Main scene; assert exactly one Factory node at config WGS84; deal 20 damage → destruction. | GDScript test |
| AC-V2-G-07 | Base placed at known WGS84; HP=28; multi-stage destruction (radar first, building second) | Load Main scene; deal 8 damage → radar destroyed sub-event; deal 20 more → main destroyed. | GDScript test |
| AC-V2-G-08 | AA cluster: 3 guns, HP=6 each, fires back at pawn | Load Main scene; assert 3 guns at config WGS84; observe gun fires within 1.7 s ± 0.05 s of pawn entering range. | GDScript test |
| AC-V2-G-09 | Cannon → AA gun hit detection fires within 100 ms | Position projectile 1 m from AA gun; fire with deterministic velocity; `body_entered` signal fires within 100 ms. | GDScript test |
| AC-V2-G-10 | Mission win-condition triggers next mission with +1 difficulty | Destroy all 3 target types; verify HUD "MISSION COMPLETE"; verify next-cycle target HPs scaled ×1.15 + AA fire interval scaled ×0.92. | GDScript test |
| AC-V2-G-11 | Crash via Terrain3D ground triggers within 200 ms | Teleport pawn 4 m above Terrain3D; pawn state == CRASHED within 200 ms. | GDScript test |
| AC-V2-G-12 | Two cameras + Input map — cycle works | `cycle_camera` action → Chase → Cockpit → Chase; both render valid scene. | GDScript test |
| AC-V2-G-13 | HUD shows all 8 elements (airspeed, alt AGL, throttle, ammo, crosshair, score, mission progress, boundary warning) | Manual smoke: visual confirm in editor + runtime. | Manual |
| AC-V2-G-14 | Cel-shader: outline pass active on depth+normal edges | Sample screenshot: assert black pixels along Sobel-edge regions; cost ≤ 0.8 ms on Iris Xe @ 1080p. | Manual + Godot profiler |
| AC-V2-G-15 | OSM building extrusion: ≥ 90% of OSM-mapped Inhaúma downtown buildings present (capped at 5,000) | Manual aerial check: downtown rectangular grid + church visible; count OSM polygons (filtered to top 5,000 by area) vs MultiMesh instances ≥ 90%. | Manual |
| AC-V2-G-16 | Foliage scatter: ≤ 12,000 MultiMesh instances; topology-faithful forest distribution | Godot monitor: MultiMesh instance count ≤ 12,000; visual: OSM forest polygons populated. | Manual + monitor |
| AC-V2-G-17 | Determinism harness: `--test-mode` produces deterministic cel-shaded rendering + georef round-trip | Execute `--test-mode`; assert each setting from FR-V2-G-15; round-trip `WGS84 → Vector3 → WGS84` ≤ 1 m error over 100 random points. | GDScript test |
| AC-V2-G-18 | Performance floor: Iris Xe G7 80EU sustains mean ≥ 60 FPS, p99 ≤ 18.5 ms at 1080p native | Python perf harness on operator's Iris Xe laptop; 60 s scripted flight loop; mean FPS ≥ 60, p99 frame ≤ 18.5 ms. | Perf harness (operator-local) |
| AC-V2-G-19 | Screenshot-diff vs Godot cel-shaded baselines passes thresholds | 4 cel-shaded reference poses; SSIM ≥ 0.78 per camera, mean ≥ 0.84, pHash distance ≤ 16. | Python harness |
| AC-V2-G-20 | GDScript-to-C# migration trigger documented at closure | At MVP-2 closure: Godot profiler attached for any script crossing 0.30 ms/tick or 2.0 ms aggregate; promotion decision + rationale recorded. | Manual (closure) |
| AC-V2-G-21 | v1 Three.js Playwright suite remains entirely green | `ci-v1.yml` runs the full v1 spec set on every commit affecting `aero-fighters/`; all existing v1 ACs pass. | Playwright CI |
| AC-V2-G-22 | Linux x64 export runs on operator hardware | `godot --export-release "Linux/X11" …` produces a launchable Linux binary on Iris Xe Inspiron; manual smoke: launches, reaches MENU, transitions to AIRBORNE, exits clean. | Manual |
| AC-V2-G-23 | GH-hosted lint-only CI is green | `aero-v2-godot-ci.yml` on `ubuntu-latest`: gdlint check, scene-file validity script, Python flake8 on Tools/, LFS verify. | GH Actions |

---

## 10. Architecture Direction

Godot 4 scene tree + Autoload singletons replace the cancelled SPEC's
4-module C++ layout. Scene tree:

```
aero-fighters-v2/
├── project.godot                       ← Godot 4 project file (engine version, autoloads, input map)
├── scenes/
│   ├── Main.tscn                       ← root scene: player, terrain, mission manager refs, HUD CanvasLayer
│   ├── Player.tscn                     ← player aircraft pawn with cameras (chase + cockpit) as children
│   ├── HUD.tscn                        ← Control nodes for airspeed/alt/throttle/ammo/etc.
│   ├── CelShaderPass.tscn              ← CanvasLayer with fullscreen ColorRect + cel-shader ShaderMaterial
│   └── Targets/
│       ├── factory.tscn
│       ├── base.tscn
│       └── aa_cluster.tscn
├── scripts/
│   ├── flight_arcade.gd
│   ├── cannon.gd
│   ├── bullet.gd
│   ├── crash_detector.gd
│   ├── camera_controller.gd
│   ├── building_spawner.gd
│   ├── foliage_spawner.gd
│   ├── inhauma_world_georef.gd
│   └── targets/
│       ├── factory.gd
│       ├── base.gd
│       └── aa_cluster.gd
├── autoload/
│   ├── MissionManager.gd               ← Autoload singleton: cycle counter, alive targets, difficulty
│   ├── GameConfig.gd                   ← Autoload singleton: loads GameConfig.tres on boot
│   └── Telemetry.gd                    ← Autoload singleton: optional frame-time / event sampling for tests
├── resources/
│   ├── GameConfig.tres                 ← Resource: origin/spawn coords, flight constants
│   └── MissionConfig.tres              ← Resource: target WGS84 coords, HPs, difficulty coefficients
├── shaders/
│   ├── cel_screen_space.gdshader       ← screen-space pass shader
│   └── cel_material.gdshader           ← per-mesh cel-mix shader (if StandardMaterial3D Toon insufficient)
├── addons/
│   └── terrain_3d/                     ← third-party plugin from godot-asset-library; CC0 or MIT
├── Content/
│   ├── World/                          ← LFS: inhauma-heightmap.tif, inhauma-buildings.json, inhauma-landuse.json, inhauma-osm.pbf, SOURCES.md
│   ├── Aircraft/                       ← HandModeled.md + .gltf import
│   ├── Audio/                          ← CC0 WAV/OGG + LICENSE.md
│   └── PostProcess/                    ← cel-shader assets
├── Tools/
│   ├── inhauma-data-fetch.py
│   ├── screenshot-diff-harness.py
│   ├── perf-harness.py
│   ├── capture_pose.gd                 ← driver for screenshot-diff (invoked via `godot --headless --script`)
│   └── requirements.txt
├── Tests/
│   ├── AcceptanceCriteria.md           ← AC-V2-G-XX traceability matrix
│   ├── unit/                           ← GUT-style GDScript unit tests
│   └── baselines/linux/                ← LFS: cel-shaded screenshot baselines
└── StagedBuilds/                       ← gitignored; output of `godot --export-release`
```

Dependency rules (convention, not enforced by build system since Godot
does not have module boundaries):

- Autoloads (`MissionManager`, `GameConfig`, `Telemetry`) are global and
  may be referenced from anywhere.
- Scenes consume autoloads via their global name; do not push state back
  into autoloads from arbitrary scripts other than through signals.
- `inhauma_world_georef.gd` is the only source of WGS84 ↔ Vector3
  conversion logic; all other scripts consume it. No module isolation
  CI lint (convention + review suffice for a single-script seam).

**C# promotion triggers (NFR-V2-G-05):**

- 0.30 ms / script (operator-local profile gate via Godot built-in
  profiler).
- 2.0 ms aggregate GDScript tick (operator-local profile gate).
- 600 lines / GDScript file (soft weekly review).
- Week-2 frame-budget breach → promote `flight_arcade.gd` to C# at that
  moment.

---

## 11. Build & Local-Run Targets

**MVP-2 (this release):**

- `godot --export-release "Linux/X11" StagedBuilds/aero-fighters-v2-linux-x64` →
  single Linux x64 binary in `aero-fighters-v2/StagedBuilds/` — operator
  launches via shell.
- No Windows export, no macOS export, no installer, no signing, no
  packaging, no public distribution channel.
- `godot --headless --quit-after 5 --script Tests/unit/run_all.gd` →
  headless GDScript unit tests (run on Iris Xe + GH-hosted CI).
- `python3 Tools/perf-harness.py` → operator-local perf harness
  (Iris Xe required).
- `python3 Tools/screenshot-diff-harness.py` → operator-local screenshot-
  diff harness (Iris Xe required for baseline parity).

**Path forward to public distribution (deferred to v2.1+):**

If the operator acquires RTX 3060-class hardware later (or cloud GPU
rental), the cancelled UE5 photoreal release can be revived from
`_archive/releases/` as a `…-photorealistic-inhauma-v2` release at the
new Degrau 4 slot. Cancellation is not extinction — the cancelled SPEC's
content survives in git history and the archived release dir. Equally,
this Godot 4 release stays at Degrau 3 indefinitely; Godot is a
permanent ladder rung, not a stepping stone.

---

## 12. Risk Register

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| RR-V2-G-01 | Godot 4 + Terrain3D plugin install on Ubuntu 24.04 / Iris Xe | LOW | Godot is single-binary; expected to work. Wave 0 verifies `godot --version` exits 0 before any other work. |
| RR-V2-G-02 | Cel-shader fidelity in Godot vs UE5 PostProcess | LOW | Godot's screen-space shader pipeline is mature; multiple production games ship cel-shaders. StandardMaterial3D Toon mode is built-in. |
| RR-V2-G-03 | OSM building extrusion via GDScript MultiMeshInstance3D might be slower than UE5 PCG for large counts | MEDIUM | Cap at ≤ 5,000 buildings to stay in budget; single MultiMesh = single draw call; filter by polygon area to keep the 5,000 most prominent buildings. |
| RR-V2-G-04 | NASA EarthData credentials still pending email-confirmation | LOW | Already in `.env.local` per operator setup 2026-05-17; T-G-06 first run is the real validator. |
| RR-V2-G-05 | Terrain3D plugin not on CC0/MIT — license incompatibility | MEDIUM | Plugin license verified in T-G-16 before commit; if non-permissive, fall back to a custom heightmap mesh import via `gdal_translate` → PNG → MeshInstance3D. |
| RR-V2-G-06 | OSM data quality in Inhaúma is sparse (building coverage may be < 50%) | MEDIUM | Manual sanity-check in PLAN before commit to MultiMesh approach; if coverage too sparse, supplement with hand-placed primitive buildings for downtown landmarks (church, town hall). |
| RR-V2-G-07 | Mission state preservation across cycles introduces save-state complexity | LOW | `MissionManager.gd` Autoload keeps in-memory state only; no disk save in MVP-2; quitting resets cycle. |
| RR-V2-G-08 | OSM ODbL attribution requirement not displayed prominently | LOW | Boot splash + in-game pause menu show "Map data © OpenStreetMap contributors" + SRTM/NASA attribution; documented in `Content/World/LICENSE.md`. |
| RR-V2-G-09 | GH-hosted `ubuntu-latest` runner cannot run Godot headless (display server requirement) | LOW | Godot 4 supports `--headless` natively for tests + exports; no `xvfb-run` typically needed. PLAN verifies in Wave 1. |
| RR-V2-G-10 | Hand-modeled aircraft mesh needs cel-friendly material rework for Godot StandardMaterial3D | LOW | Material swap in T-G-15 dependent on T-G-10; trivial change. |
| RR-V2-G-11 | Iris Xe headroom too thin for 60 FPS p99 at 1080p native | MEDIUM | Final perf gate fires in Wave 5; fallback = 1600×900 internal at no upscale (Godot Forward+ scales down well). Gate-3 documents the decision. |

---

## 13. Required Planning Sequence

After this SPEC reaches `**Status:** Aprovado`, the product-engineer
composes the PLAN. The PLAN must detail:

1. Week-by-week milestone plan honoring NFR-V2-G-04's 5–6 week envelope
   and the 3-gate if-slip rule.
2. Godot 4 install from `godotengine.org` (single `.zip`, Mono build) +
   Iris Xe driver verification.
3. NASA EarthData credential verification (already in `.env.local`;
   first `inhauma-data-fetch.py` run validates).
4. Asset-license audit table (own-work attestation for hand-modeled
   aircraft + targets + foliage; CC0 audio attribution; OSM ODbL
   attribution; NASA SRTM attribution; Terrain3D plugin CC0/MIT
   verification).
5. Demo flight script for MVP-2 showcase (which path showcases
   recognizable Inhaúma topology — downtown grid + church + AA cluster
   engagement).
6. Empirical calibration runs for cel-shader thresholds (depth-edge,
   normal-edge, saturation) over ≥ 3 sample runs on Iris Xe.
7. Empirical calibration runs for screenshot-diff SSIM + pHash thresholds
   (≥ 3 samples on Iris Xe).
8. Carryover migration of surviving tools from the cancelled stylized
   release (REWRITE PENDING-tagged Python tools + README + AC matrix +
   .env.local.example + .gitignore).

Cross-references for the PLAN author:

- `.dadaia/reports/tauan-games/product-engineer/2026-05-18T005834Z-godot-pivot.html` (2 ADRs + carryover audit)
- `.dadaia/reports/tauan-games/product-engineer/2026-05-17T210822Z-stylized-pivot.html` (prior pivot context)
- `aero-fighters-v2-stylized-inhauma-v1/SPEC.md` (cancelled, archived; carryover ledger in this release's TASKS.md)
- `specs/foundation/SPEC.md` (Degrau 3 amended to Godot 4 per ADR-V2-G-02)

---

## 14. Open Questions (deferred to PLAN)

| # | Question | Owner |
|---|---|---|
| OQ-V2-G-01 | Exact Godot 4 point release (4.3 vs 4.4 stable) — pinned in T-G-01 once operator installs. | operator + game-developer |
| OQ-V2-G-02 | Terrain3D plugin license verification (CC0 or MIT) — recorded in T-G-16. | game-developer |
| OQ-V2-G-03 | Exact OSM Brazil-southeast PBF revision + Geofabrik mirror URL — recorded in T-G-06 once first fetch run completes. | game-developer |
| OQ-V2-G-04 | Exact SRTM tile-set ID(s) for the Inhaúma bbox — recorded in T-G-06. | game-developer |
| OQ-V2-G-05 | Cel-shader threshold calibration (depth-edge / normal-edge / saturation) — final values locked after ≥ 3 calibration runs in PLAN. | game-developer + game-designer hat |
| OQ-V2-G-06 | Hand-modeled target meshes (factory / base / AA cluster) license attestation — own-work declaration recorded in PLAN asset-license table. | game-developer + game-designer hat |
| OQ-V2-G-07 | Empirically-calibrated SSIM + pHash thresholds (provisional thresholds in FR-V2-G-16 stand until PLAN's 3+ calibration runs lock final values). | game-tester hat + game-designer hat |
| OQ-V2-G-08 | CharacterBody3D vs RigidBody3D for the player pawn — decided in PLAN after Wave 1 prototype. | game-developer |
| OQ-V2-G-09 | Path-forward decision document for Windows + macOS exports (out of scope here; future-release input). | product-engineer (future release) |
| OQ-V2-G-10 | Inhaúma personal-anchor narrative: operator did not state connection. SPEC treats it as "operator's chosen anchor" without sentiment attribution. If meaningful, operator may amend. | operator |
| OQ-V2-G-11 | Future UE5 revival: when (if) hardware allows (RTX 3060 or cloud GPU rental at ~$0.20/hr RunPod / Vast.ai / Hyperstack). Streaming-based workflow: code locally on Inspiron, run UE5 editor + builds on rented box via Parsec/Moonlight. Decision deferred to a future v2.X release at Degrau 4. | product-engineer (future release) |

---

## 15. Approval

- [x] **Status:** Aprovado — 2026-05-18 (operator pre-approved during grill session 2026-05-18T005834Z)

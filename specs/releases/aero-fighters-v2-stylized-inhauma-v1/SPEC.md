# SPEC: Aero Fighters v2 — Stylized Inhaúma (MVP-2)

> **Status:** Aprovado — 2026-05-17 (aprovado pelo operador após dadaia-grill-me session; substitui aero-fighters-v2-photorealistic-inhauma-v1)
> **Release id:** aero-fighters-v2-stylized-inhauma-v1
> **Engine ladder slot:** Degrau 3 (Unreal Engine 5) — foundation-immutable
> **Supersedes:** aero-fighters-v2-photorealistic-inhauma-v1 (cancelled 2026-05-17 — hardware constraint)
> **Grill input:** .dadaia/reports/tauan-games/product-engineer/2026-05-17T210822Z-stylized-pivot.html
> **Author:** product-engineer (dadaia Labs)
> **Created:** 2026-05-17
> **Depends-on:** `specs/foundation/SPEC.md` (immutable), `specs/memory/architecture.html`,
> `specs/memory/tech-stack.html`

---

## 1. Overview

This release executes the Degrau 3 slot of the engine ladder by standing up
**`aero-fighters-v2/`** as a native Unreal Engine 5.5 project rendering a
**stylized cel-shaded** depiction of Inhaúma MG over a 20 km radius, built
from **OpenStreetMap building footprints and NASA SRTM 30 m heightmaps**.
Photorealistic 3D Tiles, Cesium for Unreal, Lumen, and Nanite are all out of
scope.

The pivot was forced mid-Wave-1 of the cancelled photorealistic release by a
hardware audit: the operator's only dev machine is a Dell Inspiron 15-3511
with Intel Iris Xe G7 80EU integrated graphics (~1.7 TFLOPS FP32), roughly 7×
below the RTX 3060 the cancelled SPEC assumed. UE5 Forward Shading + 720p
internal render + TSR upscale to 1080p is the rendering profile that fits the
iGPU envelope while preserving UE5's feature surface (Niagara, decals,
PostProcess Materials, MetaSounds).

Scope of MVP-2 gameplay: spawn-in-air over Inhaúma, arcade flight (throttle /
pitch / roll / yaw / stall), cannon at 12.5 rounds/sec, **three target types
in one mission cycle** (factory, base, AA cluster), mission win-condition
that advances to the next cycle with +1 difficulty, hit detection, crash
detection via SRTM-sampled analytic ground, two cameras (chase + cockpit), a
HUD, fixed-midday sun, cel-shader PostProcess Material with depth+normal
outline pass, and a determinism + screenshot-diff harness re-baselined for
cel-shaded poses on Iris Xe.

The release is **operator-only local runs on Linux x64**. Windows and macOS
builds are deferred. Public distribution is deferred. The MVP-2 timeline is
**5–6 weeks**, freed from the photoreal cost-budget.

The v1 (Three.js) game continues to evolve on its own ladder slot —
parallel-evolution per the foundation. No v1 changes are in scope here.

---

## 2. Problem Statement

The previously-approved release `aero-fighters-v2-photorealistic-inhauma-v1`
mandated 60 FPS / p99 ≤ 18.5 ms on RTX 3060 rendering Cesium Photorealistic
3D Tiles with screen-space Lumen GI. Mid-Wave-1, a hardware audit confirmed
the operator's only dev box is an Intel Iris Xe G7 iGPU laptop (≈1.7 TFLOPS,
~7× below RTX 3060). The photoreal target is unbuildable on that hardware.

The operator chose, via a structured grill-me session (six ADRs locked in
`.dadaia/reports/tauan-games/product-engineer/2026-05-17T210822Z-stylized-pivot.html`),
to **stay on UE5** (preserving foundation Degrau 3) and **pivot the visual
direction to stylized**. The Engine ladder is untouched — only the rendering
profile and the world-data strategy change.

A stylized cel-shaded direction over OSM + SRTM topology has three
properties that make it Iris-Xe-viable:

1. Cel-shading collapses lighting to step-quantized values — Lumen and Nanite
   are unnecessary.
2. OSM building footprints + SRTM heightmap are free, CC-licensed, and ship
   as static UE5 Landscape + PCG'd extrusions — no live tile streaming, no
   Cesium plugin, no per-frame tile-decode hitches.
3. Topology-faithful Inhaúma (recognizable morros, road network, river
   layout from the air) preserves the personal-anchor identity that the
   cancelled SPEC also carried, without the photoreal cost.

The georef-seam architecture of the cancelled SPEC is not needed because
there is no proprietary tile source to isolate. The new architecture is
simpler.

---

## 3. Goals

1. Stand up `aero-fighters-v2/` as a UE 5.5 Blueprints-first project with C++
   migration triggers explicitly documented (NFR-V2-S-05).
2. Build a topology-faithful stylized world over the 20 km radius around
   Inhaúma MG from **OpenStreetMap building footprints + NASA SRTM 30 m
   heightmap**. No live tile streaming, no Cesium plugin.
3. Deliver MVP-2 combat: arcade flight + cannon @ 12.5 r/s + **three target
   types in one mission cycle** (factory, base, AA cluster) + win-condition
   that advances to next cycle with +1 difficulty.
4. Render in **UE5 Forward Shading + 1280×720 internal + TSR upscale to
   1920×1080** at **mean ≥ 60 FPS, p99 ≤ 18.5 ms on Intel Iris Xe G7 80EU**.
   **Lumen OFF, Nanite OFF.**
5. Apply the "**Inhaúma in Toon**" art direction: cel-shaded PostProcess
   Material with outline detection on depth+normal edges, step-quantized
   diffuse lighting, fixed midday sun.
6. Ship a deterministic screenshot-diff harness (SSIM + pHash) re-baselined
   for cel-shaded poses; runs on git tags + nightly cron on GH-hosted runner.
7. Keep the v1 Three.js Playwright suite green throughout the cycle (parallel
   evolution).
8. Hold MVP-2 duration to **5–6 weeks** (freed from photoreal dev-budget) with
   a 3-gate if-slip rule wired into the schedule.

---

## 4. Non-Goals

- **No public distribution in MVP-2.** No GitHub Releases zip, no Windows
  installer signing, no Linux `.deb`/`.AppImage`, no itch.io, no Steam.
  Operator-only local runs.
- **No Windows, no macOS in MVP-2.** Linux x64 native only. Windows + Mac
  deferred to a future release contingent on user demand or hardware change.
- **No Cesium for Unreal plugin.** No `#include "Cesium*"` anywhere in the
  source tree. The georef-seam architecture of the cancelled SPEC is gone;
  no module isolation needed.
- **No Google Map Tiles API, no GCP project, no paid tile source.** OSM and
  NASA EarthData are free and CC-licensed.
- **No Photorealistic 3D Tiles.** Stylized cel-shaded only.
- **No Lumen, no Nanite, no hardware ray tracing.** Forward Shading only.
- **No JSBSim or any aerodynamic-surface flight model.** Arcade flight only.
- **No real-world aircraft IP likeness.** Generic delta-wing fighter only;
  no F-35, no other named airframe. Hand-modeled BP primitive assembly
  carried over from cancelled T-003.
- **No full v1 sortie state machine.** No takeoff, landing, taxi, service
  scene, ejection, or refuel/rearm in v2 MVP-2. Spawn airborne.
- **No nuclear FX, missiles, bombs, multiplayer.** Deferred to v2.1+.
- **No mission system beyond 1-cycle loop with +1 difficulty.** Full v1 sortie
  campaign deferred.
- **No screenshot-diff on per-PR CI.** Tag + nightly cron only.
- **No self-hosted GitHub Actions runner.** GH-hosted `ubuntu-latest` only;
  visual + perf gates are operator-local pre-commit.
- **No Fab / Quixel / external FBX assets.** Foundation's "no external
  assets" rule applies. CC0 audio + own-work geometry only.

---

## 5. Functional Requirements

### FR-V2-S-01 — OSM + SRTM Inhaúma terrain fetch pipeline (replaces cancelled FR-V2-01)

A Python tool `aero-fighters-v2/Tools/inhauma-data-fetch.py` fetches and
prepares the world-data assets for the 20 km radius around Inhaúma MG:

1. **OSM extract:** download the Brazil-southeast `.osm.pbf` regional file
   from a CC-licensed mirror (Geofabrik or equivalent); clip to a bounding
   box around `(-19.47, -44.46)` ± ~0.20° via `osmconvert` or
   `osmium-tool`; output `Content/World/inhauma-osm.pbf`.
2. **SRTM extract:** download NASA SRTM 30 m (SRTMGL1) tiles covering the
   bbox via NASA EarthData credentials (free account); assemble into a
   single GeoTIFF via `gdal_merge.py`; reproject to UTM zone 23S; output
   `Content/World/inhauma-heightmap.tif`.

The tool is **deterministic** for a fixed bbox + fixed source revisions: re-running
on the same input produces byte-identical outputs. Both outputs land in
`Content/World/` and are tracked via Git LFS.

### FR-V2-S-02 — UE5 Landscape heightmap import + georef

The Inhaúma heightmap from FR-V2-S-01 is imported into a UE5 Landscape actor
via the Landscape import workflow (heightmap PNG converted from GeoTIFF).
Landscape extent matches the 20 km × 20 km bbox in UTM zone 23S meters.
World origin is fixed at the Landscape centroid, which corresponds to WGS84
`(-19.47, -44.46)`. The georef logic is contained in a single utility
class `UInhaumaWorldGeoref` that maps WGS84 ↔ Landscape-local cm. No hexagonal
module seam — there is no proprietary tile source to isolate.

### FR-V2-S-03 — Hexagonal terrain seam (lighter than cancelled)

The `UInhaumaWorldGeoref` utility is the **only** place in the source tree
that knows about WGS84. All gameplay, combat, AI, HUD, and FX consume
`FGeoCoord` ↔ `FVector` conversions only through this utility. No module
isolation is enforced via CI lint (unlike the cancelled SPEC's
Cesium-isolation lint) — the seam is enforced by code convention and review
since the dependency surface is trivial.

### FR-V2-S-04 — Generic delta-wing player pawn (hand-modeled — carried)

The MVP-2 aircraft is the **hand-modeled generic delta-wing fighter** carried
from cancelled T-003 (see `aero-fighters-v2/Content/Aircraft/HandModeled.md`).
Built as a UE5 BP primitive Static Mesh assembly. No real-world aircraft
likeness (no F-35, no MiG, no Su-27). License: own-work. Hand-modeled path
was already elected after exhaustive CC0 search in the cancelled release
returned no acceptable sources.

### FR-V2-S-05 — Arcade flight model (constants ported from v1)

A `UFlightArcadeComponent` (BP first, C++ promotion under NFR-V2-S-05
triggers) implements throttle / pitch / roll / yaw with v1's constants
ported from `aero-fighters/src/config.js` to cm-scale UE5 units:

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

### FR-V2-S-06 — Cannon at 12.5 rounds/sec

`UCannonComponent` fires bullets at 12.5 rounds/sec ± 2% with a 30-projectile
pool. Bullet speed 110 m/s, lifetime 2.0 s, muzzle position parented to the
nose socket. Hit detection via UE5 hit events (no per-frame raycast loop).

### FR-V2-S-07 — Three target types (factory + base + AA cluster)

Each target type is a placed actor with health, hit reaction, destruction
visual + audio, and post-destruction state:

| Target type | HP | Behavior | Destruction visual |
|---|---:|---|---|
| **Factory** | 20 | Static; smokestacks emit Niagara smoke pre-hit | Mega-explosion: layered Niagara FX (fireball + smoke column + ground debris), 4 s sustained, screen shake on cockpit camera |
| **Base** | 28 | Static; radar dish rotation BP timer + barracks geometry | Multi-stage detonation: radar destroyed first (sub-hit), then main building; 3 s explosion sequence |
| **AA cluster** | 6 per gun, 3 guns | 3-gun emplacement; each gun fires back at the pawn (dumb-fire, base interval 1.7 s, range 220 m); fires back same as cancelled FR-V2-07 | Per-gun destruction; cluster fully destroyed when all 3 guns gone |

Placement: 1 factory, 1 base, 1 AA cluster per mission cycle. All anchored to
WGS84 via `UInhaumaWorldGeoref`; positions stored in
`DA_AeroFightersV2StylizedMissionConfig`. AA cluster spawns near WGS84
`(-19.490, -44.387)` (carried from cancelled FR-V2-07 placement).

### FR-V2-S-08 — Mission win-condition + next mission with +1 difficulty

Mission cycle completes when **all three target types are destroyed**. Upon
completion: HUD displays "MISSION COMPLETE", 3 s pause, then advances to the
next mission cycle with:

- Same Inhaúma world, same player pawn state preserved
- Target HPs scaled ×1.15 per cycle
- AA cluster base fire interval scaled ×0.92 per cycle (faster fire-back)
- Cycle counter incremented in HUD (displayed as "Mission N")

No mission-end cutscene, no scoreboard screen, no save-state — endless cycle
loop until the player crashes or quits. Mission state lives in
`UMissionSubsystem` (GameInstance subsystem).

### FR-V2-S-09 — Crash detection via SRTM-sampled analytic ground

`UCrashDetectorComponent` samples the SRTM heightmap (imported as a UE5
Landscape) under the pawn each tick via `Landscape::GetHeightAtLocation`.
Crash when altitude delta < `MOUNTAIN_BUFFER = 5 m`. No Cesium analytic
ground query, no full mesh collision. Sea / out-of-world crash when pawn
altitude < 0 m MSL.

### FR-V2-S-10 — Two cameras + Enhanced Input

Enhanced Input plugin enabled. Single `IMC_AeroFightersMVP` mapping context
with InputActions: `IA_Throttle`, `IA_Pitch` (negated for sim-style
inversion), `IA_Roll`, `IA_Yaw`, `IA_FireCannon`, `IA_BarrelRoll`,
`IA_CycleCamera`, `IA_Pause`. Two camera modes: **Chase** (default, Spring
Arm behind + above) and **Cockpit / Nose** (forward-looking for cannon aim).
Wide-chase, flyby, and orbit cameras deferred to v2.1.

### FR-V2-S-11 — HUD: airspeed, altitude AGL, throttle, ammo, crosshair, score, mission progress, boundary warning

UMG widgets, no external font assets, no external sprite assets. HUD shows:

- Airspeed (m/s)
- Altitude AGL (computed from FR-V2-S-09 Landscape sample)
- Throttle %
- Cannon ammo
- Crosshair (cel-shaded vector style consistent with art direction)
- Score (cumulative across mission cycles)
- **Mission progress: 3 target icons that flip from "alive" to "destroyed"
  glyph as targets die; "Mission N" counter in upper right**
- Boundary state warning at 18 km (per FR-V2-S-18)

### FR-V2-S-12 — Cel-shader PostProcess Material

A PostProcess Material `M_PP_CelShader` is applied via a PostProcessVolume
on the MVP map. The material does:

1. **Diffuse step-quantization:** sample scene color, divide luminance into 3
   bands (shadow / midtone / highlight), output flat color per band.
2. **Outline detection:** sample depth (`SceneTexture:CustomDepth` or
   `PixelDepth`) and normal (`SceneTexture:WorldNormal`); compute Sobel
   edge over a 3×3 kernel; emit black outline pixel where edge magnitude
   exceeds threshold (depth-edge threshold 0.04, normal-edge threshold
   0.55, tuned in PLAN).
3. **Saturation lift:** ×1.15 saturation on quantized output for the
   "in toon" look.

Sun direction fixed (Directional Light, Yaw 45°, Pitch -45°). Sky =
`Atmosphere + ExponentialHeightFog`; **no SkyLight from photoreal HDRI**.
Outline pass cost target: ≤ 0.8 ms on Iris Xe @ 720p.

### FR-V2-S-13 — OSM building extrusion via PCG

Building footprints from FR-V2-S-01's `inhauma-osm.pbf` are imported into UE5
as a single PCG (Procedural Content Generation framework) graph asset
`PCG_InhaumaBuildings`. The graph:

1. Reads the OSM PBF (via a Python pre-export to flat JSON, since UE5's PCG
   does not natively read PBF) → produces `Content/World/inhauma-buildings.json`
   in FR-V2-S-01.
2. For each building polygon, extrudes a Static Mesh at the polygon's
   centroid with height `building:levels × 3.0 m` (default 3 levels = 9 m
   when `building:levels` is absent).
3. Applies the `M_CelBuilding` Material (a simple cel-friendly Material
   that pairs with the PostProcess outline pass).

Buildings are static (no runtime spawning). Cooked once at the level open.
Topology-faithful: Inhaúma's downtown rectangular grid + church + scattered
outlying buildings must be recognizable from the air.

### FR-V2-S-14 — Foliage scatter via UE5 PCG on OSM land-use polygons

OSM `landuse=forest`, `landuse=grass`, `natural=tree` polygons drive UE5 PCG
foliage scatter. Static Meshes are hand-modeled cel-friendly tree + bush
primitives (own-work, low-poly). Density: ~50 trees per hectare for forest,
~10 per hectare for grass-scatter. Foliage Static Mesh instances use UE5's
Hierarchical ISM (HISM) for batching. Total foliage instance count budget:
≤ 12,000 across the 20 km × 20 km world (target Iris Xe budget).

### FR-V2-S-15 — Audio palette (CC0)

CC0 SFX (freesound.org filter) for cannon, hit, factory-explosion,
base-explosion, AA-cluster-explosion, AA-fire-back WAVs. MetaSound patch for
jet-engine drone modulated by throttle %. No external music. Attributions
recorded in `Content/Audio/LICENSE.md`.

### FR-V2-S-16 — Determinism harness (replaces cancelled FR-V2-13)

Console variable `aero.testMode 1` enables:

- `r.TemporalAASamples 1`
- `r.MotionBlur.Amount 0`
- Cel-shader PostProcess Material force-applied (override any volume blend)
- Fixed Directional Light yaw 45°, pitch -45° (no time-of-day animation —
  there isn't one in MVP-2 anyway; this is a no-op safety override)
- Fixed wind vector `(1, 0, 0)` at 5 m/s (used by foliage wind animation)
- Fixed camera pose (loaded from a reference-pose Data Asset)
- Landscape streaming gate: poll until all Landscape components are streamed
  in (hard timeout 10 s; analogue of cancelled SPEC's Cesium tile-load gate)

Replaces the cancelled SPEC's Lumen-based override set. Forward Shading +
cel-shader has no temporal accumulation surface to discipline.

### FR-V2-S-17 — Screenshot-diff harness (re-baselined for cel-shaded poses)

Python harness (`aero-fighters-v2/Tools/screenshot-diff-harness.py`)
launches a packaged Shipping build with `aero.testMode 1`, loads 4
**re-captured cel-shaded reference poses** at the same WGS84 coordinates as
the cancelled SPEC's poses, applies the Landscape-streaming gate + 1 s
settle (down from 2 s — no Lumen probe filter to settle), captures
screenshot, computes SSIM + pHash against the new per-platform baseline set.

Thresholds (provisional, calibrated in PLAN over ≥ 3 sample runs on Iris Xe):

- **SSIM ≥ 0.78 per camera** (raised from cancelled 0.72 — cel-shading is
  flatter and more deterministic than photoreal)
- **Mean SSIM ≥ 0.84** (raised from 0.78)
- **pHash distance ≤ 16** (tightened from 20)

Linux baseline set only (Windows + macOS out of scope per NFR-V2-S-03).
Runs only on git tags + nightly cron on GH-hosted runner; visual gate is
operator-local on Iris Xe pre-commit.

### FR-V2-S-18 — Boundary behavior at 20 km edge

3-tier soft boundary, carried unchanged from cancelled FR-V2-15:

1. 18 km — HUD "RESTRICTED ZONE" warning (red flashing).
2. 19.5 km — Exponential Height Fog density ×10 (white-grey haze).
3. 20 km — invisible spring force pushing back proportional to overshoot.

No game-over.

### FR-V2-S-19 — Local-only Linux x64 launch configuration

The project builds Shipping binaries for **Linux x64 only**. The operator
runs locally. No `.exe`, no signing, no installer, no Releases packaging.
Build outputs land in `aero-fighters-v2/Saved/StagedBuilds/Linux/` and are
run directly. Windows and macOS builds are out of scope.

---

## 6. Non-Functional Requirements

### NFR-V2-S-01 — Performance floor (Iris Xe baseline)

Intel Iris Xe G7 80EU sustains **mean ≥ 60 FPS averaged over a 60 s flight
loop above Inhaúma, frame-time 99th-percentile ≤ 18.5 ms** at:

- Internal render resolution: **1280×720**
- Output: TSR upscale to **1920×1080**
- Render mode: **UE5 Forward Shading**
- **Lumen OFF, Nanite OFF, Hardware Ray Tracing OFF**
- Anti-alias: **TSR** (Temporal Super Resolution) low quality
- Shadow quality: Medium (cascaded shadow maps)

Per-frame budget on Iris Xe @ 720p:

| Subsystem | Budget (ms) | Notes |
|---|---:|---|
| Landscape rendering | 3–5 | Iris Xe vertex throughput limit |
| Foliage HISM | 2–3 | ≤ 12,000 instances |
| Cel-shader PostProcess | 0.8 | outline + quantization |
| Niagara FX | 1–2 | bullet trails + hit FX + explosions |
| BP flight tick | < 0.30 / class | C++ promotion trigger |
| BP VM aggregate | ≤ 2.0 | C++ promotion trigger |
| TSR upscale | 0.6–1.0 | low quality preset |
| Headroom | 1.0–4.5 | tight worst case |

Two-tier perf gate: lint + headless FTF lane in PR CI; full windowed run on
tag CI on GH-hosted runner (acknowledging GH-hosted runner != Iris Xe — the
tag CI run is a directional canary, not a perf floor proof; operator runs
the perf harness locally pre-commit).

### NFR-V2-S-02 — No external paid API costs

Zero monthly external API spend. NASA EarthData is free (account-gated, no
billing). OSM data is free. No Google Maps Tiles API. No Cesium Ion. The
operator's GCP project from the cancelled SPEC is unused in this release.

### NFR-V2-S-03 — Platform: Linux x64 only

Linux x64 native local Shipping build only. No Windows native, no macOS, no
Proton/Wine. Future-release Windows + Mac contingent on user demand.

### NFR-V2-S-04 — Timeline: 5–6 weeks

**5–6 weeks** from kickoff to MVP-2 closure (was 6–8 with photoreal,
trimmed by the cost-budget freed). 3-gate if-slip rule active:

- **Gate-1 (end of Week 1):** UE 5.5 installed, project boots, lint-only CI
  green on GH-hosted `ubuntu-latest`. If not, scope-cut: drop FR-V2-S-13
  PCG foliage; ship buildings + landscape only.
- **Gate-2 (end of Week 3):** aircraft visible above Inhaúma Landscape with
  basic flight + cannon working. If not, scope-cut: drop one target type
  (base) → ship factory + AA cluster only.
- **Gate-3 (end of Week 5):** cel-shader + all 3 target types working at 60
  FPS on Iris Xe. If not, AC drops to "shipped at 45 FPS p99 ≤ 25 ms" and
  perf re-baseline becomes a v2.0.1 follow-up.

### NFR-V2-S-05 — Blueprints-first with documented C++ promotion (unchanged from cancelled NFR-V2-05)

BP-first prototyping is the working policy. Promotion to C++ when any of:

- **Hard:** per-class BP tick > 0.30 ms (operator-local profile gate).
- **Hard:** aggregate BP VM > 2.0 ms / frame (operator-local profile gate).
- **Soft:** any BP graph > 150 nodes (weekly review).
- **Trigger:** if frame budget breached in Week 2, promote
  `UFlightArcadeComponent` to C++ immediately.

---

## 7. Stack Pinning

| Item | Pin | Notes |
|---|---|---|
| Engine | **Unreal Engine 5.5** (latest 5.5.x stable at impl start) | foundation Degrau 3; unchanged from cancelled |
| Render mode | **Forward Shading** | Project Settings; not Mobile, not Deferred |
| Anti-alias | **TSR** (Temporal Super Resolution) low quality | UE5 default upscaler |
| Render resolution | **1280×720 internal → 1920×1080 output** | TSR upscale |
| Cesium for Unreal | **NOT INSTALLED** | gone; no tile streaming |
| Tile source | **NONE — static UE5 Landscape + PCG buildings** | OSM + SRTM, prepared by FR-V2-S-01 |
| Heightmap source | **NASA SRTM 30 m (SRTMGL1)** via NASA EarthData (free account) | CC-compatible |
| Building footprints | **OpenStreetMap** Brazil-southeast `.osm.pbf` (Geofabrik) | ODbL — attribution required |
| Aircraft mesh | Hand-modeled UE5 BP primitive (own-work) | carried from cancelled T-003 |
| Target meshes (factory / base / AA cluster) | UE5 BP primitive own-work | own-work; no external assets |
| Audio | CC0 freesound.org WAV + MetaSound | attribution in `Content/Audio/LICENSE.md` |
| Linter | `clang-format` (UE5 style) + GH-hosted CI lint | no Cesium-isolation lint (Cesium gone) |
| Build target | **Linux x64 only** (`make build-linux-shipping`) | no Windows, no macOS |
| CI runner | **GH-hosted `ubuntu-latest`** (lint + headless FTF only) | no self-hosted runner |

---

## 8. Secret & Key Management

- **NASA EarthData credentials:** free account creds for the SRTM tile
  download in FR-V2-S-01.
  - **Canonical storage (simple path, default):** plaintext in
    `aero-fighters-v2/.env.local` (gitignored) as
    `NASA_EARTHDATA_USERNAME=…` + `NASA_EARTHDATA_PASSWORD=…`. The file
    is read by the Python fetch tool directly. This matches the
    Foundation's "Simplicidade primeiro" principle and fits the
    single-operator threat model for a free read-only-public-dataset
    credential.
  - **Optional upgrade path (defer until paranoid):** 1Password item
    `aero-fighters-v2/nasa-earthdata` with a small wrapper script that
    materializes `.env.local` from `op item get …` on demand. Not
    required for MVP-2; documented for future-release adoption.
- **Risk envelope:** NASA EarthData creds are equivalent in stakes to a
  free newsletter signup — no payment data, no PII beyond email, scope is
  read-only public datasets. The gitignored `.env.local` storage matches
  the actual risk.
- **CI consumption:** not required for MVP-2. The OSM + SRTM extract is run
  by the operator once; outputs are committed via Git LFS to
  `Content/World/`.
- **No Google Map Tiles API key, no GCP project.** The cancelled SPEC's
  GCP-key management section is moot in this release.
- **Rotation cadence:** NASA EarthData creds rotated annually or on
  suspected leak (low-risk: scope is read-only public datasets).

---

## 9. Acceptance Criteria

| ID | Description | Pass condition | Method |
|---|---|---|---|
| AC-V2-S-01 | OSM + SRTM fetch tool produces deterministic outputs | Re-run `Tools/inhauma-data-fetch.py --bbox <fixed>` on same OS + same NASA/Geofabrik revisions → byte-identical `inhauma-heightmap.tif` + `inhauma-buildings.json` + `inhauma-osm.pbf`. | Python harness + diff |
| AC-V2-S-02 | UE5 Landscape import preserves heightmap fidelity | Landscape height at WGS84 `(-19.47, -44.46)` within 5 m of source SRTM sample. | FTF |
| AC-V2-S-03 | Pawn spawns ≥ 500 m AGL above Inhaúma Landscape | First tick after `BeginPlay`: pawn altitude above analytic ground in (500 m, 3000 m AGL); WGS84 z ≈ 2095 m ± 5 m. | FTF |
| AC-V2-S-04 | Arcade flight responds ≤ 1 frame input-to-effect | Apply full throttle 3 s; monotonic speed 0 → ≥ 24 m/s; pitch/roll/yaw deltas match FR-V2-S-05 constants. | FTF |
| AC-V2-S-05 | Cannon fires at 12.5 r/s ± 2% | Hold fire 10 s deterministic; count `OnProjectileSpawned` events = 125 ± 3. | FTF |
| AC-V2-S-06 | Factory placed at known WGS84; HP=20; destroyed by cumulative cannon hits | Load MVP map; assert exactly one factory at config WGS84; deal 20 damage → destruction. | FTF |
| AC-V2-S-07 | Base placed at known WGS84; HP=28; multi-stage destruction (radar first, building second) | Load MVP map; deal 8 damage → radar destroyed sub-event; deal 20 more → main destroyed. | FTF |
| AC-V2-S-08 | AA cluster: 3 guns, HP=6 each, fires back at pawn | Load MVP map; assert 3 guns at config WGS84; observe gun fires within 1.7 s ± 0.05 s of pawn entering range. | FTF |
| AC-V2-S-09 | Cannon → AA gun hit detection fires within 100 ms | Position projectile 1 m from AA gun; fire with deterministic velocity; `OnHit` fires within 100 ms. | FTF |
| AC-V2-S-10 | Mission win-condition triggers next mission with +1 difficulty | Destroy all 3 target types; verify HUD "MISSION COMPLETE"; verify next-cycle target HPs scaled ×1.15 + AA fire interval scaled ×0.92. | FTF |
| AC-V2-S-11 | Crash via SRTM analytic ground triggers within 200 ms | Teleport pawn 4 m above Landscape; `APlayerPawn.State == CRASHED` within 200 ms. | FTF |
| AC-V2-S-12 | Two cameras + Enhanced Input — cycle works | `IA_CycleCamera` → Chase → Cockpit → Chase; both render valid scene. | FTF |
| AC-V2-S-13 | HUD shows all 8 elements (airspeed, alt AGL, throttle, ammo, crosshair, score, mission progress, boundary warning) | Manual smoke: visual confirm in UMG editor + runtime. | Manual |
| AC-V2-S-14 | Cel-shader PostProcess: outline pass active on depth+normal edges | Sample screenshot: assert black pixels along Sobel-edge regions; cost ≤ 0.8 ms on Iris Xe @ 720p. | Manual + RenderDoc |
| AC-V2-S-15 | OSM building extrusion: ≥ 90% of OSM-mapped Inhaúma downtown buildings present | Manual aerial check: downtown rectangular grid + church visible; count OSM polygons vs PCG-extruded meshes ≥ 90%. | Manual |
| AC-V2-S-16 | Foliage scatter: ≤ 12,000 HISM instances; topology-faithful forest distribution | UE5 stats: `stat foliage` shows ≤ 12,000 instances; visual: OSM forest polygons populated. | Manual + stat |
| AC-V2-S-17 | Determinism harness: `aero.testMode 1` produces deterministic cel-shaded rendering + georef cm round-trip | Execute `aero.testMode 1`; assert each cvar from FR-V2-S-16; round-trip `FGeoCoord → FVector → FGeoCoord` ≤ 1 cm error over 100 random points. | FTF |
| AC-V2-S-18 | Performance floor: Iris Xe G7 80EU sustains mean ≥ 60 FPS, p99 ≤ 18.5 ms | Python perf harness on operator's Iris Xe laptop; 60 s scripted flight loop; mean FPS ≥ 60, p99 frame ≤ 18.5 ms. | Perf harness (operator-local) |
| AC-V2-S-19 | Screenshot-diff vs cel-shaded baselines passes thresholds | 4 cel-shaded reference poses; SSIM ≥ 0.78 per camera, mean ≥ 0.84, pHash distance ≤ 16. | Python harness |
| AC-V2-S-20 | BP-to-C++ migration trigger documented at closure | At MVP-2 closure: UE5 Insights profile attached for any BP class crossing 0.30 ms/tick or 2.0 ms aggregate; promotion decision + rationale recorded. | Manual (closure) |
| AC-V2-S-21 | v1 Three.js Playwright suite remains entirely green | `ci-v1.yml` runs the full v1 spec set on every commit affecting `aero-fighters/`; all existing v1 ACs pass. | Playwright CI |
| AC-V2-S-22 | Linux x64 native local Shipping build runs on operator hardware | `make build-linux-shipping` produces a launchable Shipping ELF on Iris Xe Inspiron; manual smoke: launches, reaches MENU, transitions to AIRBORNE, exits clean. | Manual |
| AC-V2-S-23 | GH-hosted lint-only CI is green | `aero-v2-stylized-ci.yml` on `ubuntu-latest`: clang-format check, Build.cs module-deps check, LFS verify, headless FTF run. | GH Actions |

---

## 10. Architecture Direction

4-module UE5 layout (one module fewer than the cancelled SPEC — no Georef
isolation module needed since Cesium is gone):

```
aero-fighters-v2/Source/
├── AeroFightersCore/        ← FGeoCoord, UInhaumaWorldGeoref utility,
│                              Data Asset config (DA_AeroFightersV2StylizedConfig,
│                              DA_AeroFightersV2StylizedMissionConfig),
│                              math helpers, no engine deps beyond Core
├── AeroFightersTerrain/     ← Landscape import glue, PCG_InhaumaBuildings,
│                              PCG_InhaumaFoliage; reads
│                              Content/World/inhauma-buildings.json
│                              + Content/World/inhauma-heightmap.tif
├── AeroFightersGameplay/    ← APlayerPawn, UFlightArcadeComponent, UMG HUD,
│                              UCrashDetectorComponent, UMissionSubsystem,
│                              Niagara hooks, MetaSound bindings
└── AeroFightersCombat/      ← UCannonComponent, AFactoryActor, ABaseActor,
                              AAAGunClusterActor, projectile pool, hit
                              detection delegates
```

Module dependency rules (Build.cs):

- `Core` depends on nothing UE5-game beyond `Core` + `CoreUObject` + `Engine`.
- `Terrain` depends on `Core` + UE5 `Landscape` + `PCG`.
- `Gameplay` depends on `Core` + `Terrain` (for Landscape sample utility).
- `Combat` depends on `Core` + `Gameplay`.

No Cesium symbols anywhere; no module-isolation CI lint needed.

**C++ promotion triggers (NFR-V2-S-05):**

- 0.30 ms / class (operator-local profile gate).
- 2.0 ms aggregate BP VM (operator-local profile gate).
- 150 BP nodes / graph (soft weekly review).
- Week-2 frame-budget breach → promote `UFlightArcadeComponent` to C++ at
  that moment.

---

## 11. Build & Local-Run Targets

**MVP-2 (this release):**

- `make build-linux-shipping` → Linux x64 Shipping ELF in
  `aero-fighters-v2/Saved/StagedBuilds/Linux/` — operator launches via
  shell.
- No Windows build, no macOS build, no installer, no signing, no packaging,
  no public distribution channel.
- `make ftf` → headless UE5 Functional Tests (run on Iris Xe + GH-hosted CI).
- `make perf` → operator-local perf harness (Iris Xe required).
- `make screenshot-diff` → operator-local screenshot-diff harness (Iris Xe
  required for baseline parity).

**Path forward to public distribution (deferred to v2.1+):**

If the operator acquires RTX 3060-class hardware later, the photoreal release
(`aero-fighters-v2-photorealistic-inhauma-v1`) can be revived from
`_archive/releases/` as a `…-photorealistic-inhauma-v2` release.
Cancellation is not extinction — the cancelled SPEC's content survives in
git history and the archived release dir.

---

## 12. Risk Register

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| RR-V2-S-01 | Iris Xe driver instability on Linux when rendering UE5 Forward Shading. | MEDIUM | Pin Mesa version in PLAN; document fallback to `vkmark` smoke test before each commit; if instability persists, soft-cut to Mesa LLVMpipe software path (drops perf but unblocks dev). |
| RR-V2-S-02 | OSM data quality in Inhaúma is sparse (building coverage may be < 50%). | MEDIUM | Manual sanity-check in PLAN before commit to PCG approach; if coverage too sparse, supplement with hand-placed BP primitive buildings for downtown landmarks (church, town hall). |
| RR-V2-S-03 | NASA EarthData free-tier rate limit blocks fetch. | LOW | One-shot fetch; outputs committed via Git LFS; re-fetch only on bbox change. |
| RR-V2-S-04 | UE5 Landscape memory footprint exceeds Iris Xe shared-RAM budget. | MEDIUM | World composition with 4×4 streaming tiles; tile distance LOD aggressive (≤ 5 km full detail); foliage HISM batching mandatory. |
| RR-V2-S-05 | Cel-shader PostProcess outline cost exceeds 0.8 ms on Iris Xe. | MEDIUM | Sobel kernel optimization in PLAN; outline-pass cost gate in `aero.testMode 1` via UE5 GPU stat capture; if > 0.8 ms, reduce kernel to 2×2 or drop outline saturation. |
| RR-V2-S-06 | Mission state preservation across cycles introduces save-state complexity. | LOW | GameInstance subsystem keeps in-memory state only; no disk save in MVP-2; quitting resets cycle. |
| RR-V2-S-07 | TSR upscale quality degrades cel-shaded outlines (outline aliasing). | MEDIUM | Tune TSR low-quality history weighting in PLAN; if outline aliasing severe, drop to spatial-only FidelityFX upscale at perf cost. |
| RR-V2-S-08 | OSM ODbL attribution requirement not displayed prominently. | LOW | Boot splash + in-game pause menu show "Map data © OpenStreetMap contributors" + SRTM/NASA attribution; documented in `Content/World/LICENSE.md`. |
| RR-V2-S-09 | PCG foliage scatter exceeds 12,000 instance budget when OSM landuse coverage is dense. | MEDIUM | PCG graph caps total instance count; density auto-scales down via PCG point-decimation node when instance budget approached. |
| RR-V2-S-10 | GH-hosted `ubuntu-latest` runner cannot run UE5 headless FTF (missing OpenGL/Vulkan). | MEDIUM | PLAN evaluates `xvfb-run` + `swiftshader` software-Vulkan path; if not viable, FTF runs locally only and CI lint-only. |
| RR-V2-S-11 | Hand-modeled aircraft from carried T-003 needs cel-friendly material rework. | LOW | Material swap in T-S-15 dependent on T-S-10; trivial change. |

---

## 13. Required Planning Sequence

After this SPEC reaches `**Status:** Aprovado`, the product-engineer composes
the PLAN. The PLAN must detail:

1. Week-by-week milestone plan honoring NFR-V2-S-04's 5–6 week envelope and
   the 3-gate if-slip rule.
2. UE 5.5 setup with Forward Shading project template + Iris Xe driver
   pinning (Mesa version).
3. NASA EarthData credential acquisition + first `inhauma-data-fetch.py` run.
4. Asset-license audit table (own-work attestation for hand-modeled
   aircraft + targets + foliage; CC0 audio attribution; OSM ODbL attribution;
   NASA SRTM attribution).
5. Demo flight script for MVP-2 showcase (which path showcases recognizable
   Inhaúma topology — downtown grid + church + AA cluster engagement).
6. Empirical calibration runs for cel-shader thresholds (depth-edge,
   normal-edge, saturation) over ≥ 3 sample runs on Iris Xe.
7. Empirical calibration runs for screenshot-diff SSIM + pHash thresholds
   (≥ 3 samples on Iris Xe).
8. Carryover migration of surviving tools (T-S-03 / T-S-08 / T-S-09 /
   T-S-13 / T-S-14 per TASKS ledger).

Cross-references for the PLAN author:

- `.dadaia/reports/tauan-games/product-engineer/2026-05-17T210822Z-stylized-pivot.html` (six ADRs)
- `aero-fighters-v2-photorealistic-inhauma-v1/SPEC.md` (cancelled, archived; carryover ledger in TASKS.md)
- `specs/foundation/SPEC.md` (Degrau 3 immutable)

---

## 14. Open Questions (deferred to PLAN)

| # | Question | Owner |
|---|---|---|
| OQ-V2-S-01 | NASA EarthData account: operator creates `aero-fighters-v2/nasa-earthdata` in 1Password before T-S-06 lands. | operator |
| OQ-V2-S-02 | Exact OSM Brazil-southeast PBF revision + Geofabrik mirror URL — recorded in TASKS T-S-06 once first fetch run completes. | game-developer |
| OQ-V2-S-03 | Exact SRTM tile-set ID(s) for the Inhaúma bbox — recorded in TASKS T-S-06. | game-developer |
| OQ-V2-S-04 | Cel-shader threshold calibration (depth-edge / normal-edge / saturation) — final values locked after ≥ 3 calibration runs in PLAN. | game-developer + game-designer hat |
| OQ-V2-S-05 | Hand-modeled target meshes (factory / base / AA cluster) license attestation — own-work declaration recorded in PLAN asset-license table. | game-developer + game-designer hat |
| OQ-V2-S-06 | Empirically-calibrated SSIM + pHash thresholds (provisional thresholds in FR-V2-S-17 stand until PLAN's 3+ calibration runs lock final values). | game-tester hat + game-designer hat |
| OQ-V2-S-07 | MVP-2 demo-script: which Inhaúma flight path showcases the topology for the operator showcase? Pass over downtown grid + church + AA cluster engagement is the candidate. | game-designer hat + operator |
| OQ-V2-S-08 | Path-forward decision document for Windows + macOS builds (out of scope here; future-release input). | product-engineer (future release) |
| OQ-V2-S-09 | Inhaúma personal-anchor narrative: operator did not state connection. SPEC treats it as "operator's chosen anchor" without sentiment attribution. If meaningful, operator may amend. | operator |
| OQ-V2-S-10 | Future Cesium-for-Unreal transition path documented 2026-05-17. Order: (1) Scenario A — Cesium for georef math only (no tile streaming, $0, anytime); (2) Scenario B — Cesium World Terrain mesh + own buildings (Cesium ion free tier, anytime); (3) Scenario D — Full Cesium Photoreal + Lumen (only when RTX 3060 or cloud GPU is in play). Scenario C (Photoreal at low LOD + cel-shader) explicitly skipped due to aesthetic mix. Decision deferred to a future v2.X release. | product-engineer (future release) |
| OQ-V2-S-11 | Cloud GPU rental (RunPod / Vast.ai / Hyperstack at ~$0.20/hr for RTX 3060 class) is a documented option to unblock Cesium photoreal in the future. Streaming-based workflow: code locally on Inspiron, run UE5 editor + builds on rented box via Parsec/Moonlight. ~$5/mo (CI-only) to ~$30/mo (daily dev) range. Operator deferred 2026-05-17 in favor of "start simple, transition later". Capture in v2.1 planning if Cesium revival is desired. | product-engineer (future release) |

---

## 15. Approval

- [ ] **Status:** Drafting — 2026-05-17 (awaiting operator approval)

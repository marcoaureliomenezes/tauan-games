# SPEC: Aero Fighters v2 — Photorealistic Inhaúma (MVP v1)

> **Status:** Aprovado — 2026-05-17 (aprovado pelo operador via workflow operator-approval gate)
> **Author:** product-engineer (dadaia Labs)
> **Created:** 2026-05-17
> **Release id:** `aero-fighters-v2-photorealistic-inhauma-v1`
> **Engine ladder slot:** Degrau 3 (Unreal Engine 5) — pre-authorized by `specs/foundation/SPEC.md`
> **Depends-on:** `specs/foundation/SPEC.md` (immutable), `specs/memory/architecture.html`,
> `specs/memory/tech-stack.html`
> **Related (workflow inputs):**
> - Discovery: `.dadaia/reports/product-engineer/2026-05-17T060824Z-game-discovery.html`
> - Synthesis: `.dadaia/reports/product-engineer/2026-05-17T063246Z-synthesis-aero-v2.html`
> - software-architect: `.dadaia/reports/software-architect/2026-05-17T061546Z-game-arch.html`
> - devops-engineer: `.dadaia/reports/devops-engineer/2026-05-17T061638Z-game-devops.html`
> - game-developer: `.dadaia/reports/game-developer/2026-05-17T061730Z-gameplay-analysis.html`
> - game-designer (hat): `.dadaia/reports/game-designer/2026-05-17T062026Z-design-analysis.html`
> - game-tester (hat): `.dadaia/reports/game-tester/2026-05-17T062053Z-acceptance-criteria.html`

---

## 1. Overview

This release executes the Degrau 3 slot of the engine ladder by standing up
**`aero-fighters-v2/`** as a native Unreal Engine 5.5 project. The MVP delivers
the *minimum-viable-combat slice* of the long-term arcade-combat identity, set
over a **photorealistic 20 km radius around Inhaúma, MG** streamed live from
Google Photorealistic 3D Tiles via Cesium for Unreal.

The MVP runs on the operator's hardware only — there is no public distribution
in this release. Public distribution (GitHub Releases, itch.io, Steam) is
explicitly deferred to a future v2.1 release contingent on either a written
Google ToS authorization for game distribution of Photoreal 3D Tiles, or a
swap to a permissively-licensed tile source. The georef seam architected in
this release is the contract that makes that swap a configuration change
rather than a rewrite.

Scope of MVP gameplay: spawn-in-air over Inhaúma, arcade flight (throttle /
pitch / roll / yaw / stall), cannon at 12.5 rounds/sec, exactly one static AA
gun enemy, hit detection, crash detection, two cameras (chase + cockpit), a
basic HUD, fixed-midday lighting, and an automated screenshot-diff harness
that runs on git tags + nightly cron (never on PR) to guard photoreal
acceptance.

---

## 2. Problem Statement

`aero-fighters/` (Degrau 2, Three.js) cannot satisfy the photoreal vision:
its procedural sky, terrain, and lighting are arcade by construction. The
foundation reserves the Degrau 3 slot for exactly this jump: a project where
the rendering substrate (UE5 Lumen + Niagara) and the world-data substrate
(Cesium for Unreal + Google Photorealistic 3D Tiles) make the photoreal MVP
possible without external static assets. v1 will keep evolving on its own
ladder; v2 lives in parallel with its own CI lane.

The release must close the foundation's open distribution policy gap for UE5
games — and it does so, for this MVP, by explicitly choosing **operator-only
local runs**. Public distribution becomes a v2.1 scoping decision rather than
a v2 blocker.

---

## 3. Goals

1. Stand up `aero-fighters-v2/` as a UE 5.5 Blueprints-first project with C++
   migration triggers explicitly documented.
2. Stream live photorealistic terrain over a 20 km radius around Inhaúma MG
   via Cesium for Unreal + Google Photorealistic 3D Tiles, isolated behind a
   single `AeroFightersGeoref` module (CV-07 / LD-15 — non-negotiable).
3. Deliver minimum-viable-combat: arcade flight + cannon @ 12.5 r/s + one
   static AA gun, all ported from v1 design constants with cm-scale conversion.
4. Sustain 60 FPS at 1080p on RTX 3060 with screen-space Lumen and a 3 GB
   Cesium tile cache cap.
5. Ship a deterministic screenshot-diff harness (SSIM + pHash, per-platform
   baselines) that gates photoreal acceptance on git tags and a nightly cron.
6. Keep the v1 Three.js Playwright suite green throughout the cycle (parallel
   evolution per D9).
7. Local builds for **both Windows x64 and Linux x64** are MVP scope (no
   public packaging).
8. Hold MVP duration to **6–8 weeks** (operator decision O3) with the 3-gate
   if-slip rule wired into the schedule.

---

## 4. Non-Goals

- **No public distribution in MVP.** No GitHub Releases zip, no Windows
  installer signing, no Linux `.deb`/`.AppImage`, no itch.io, no Steam.
  Operator-only local runs. (Operator decision O2.)
- **No JSBSim or any aerodynamic-surface flight model.** Arcade flight only.
  (Discovery D4.)
- **No real-world aircraft IP likeness.** Generic delta-wing fighter only;
  no F-35, no other named airframe. (Operator decision O4.)
- **No full v1 sortie state machine.** No takeoff, landing, taxi, service
  scene, ejection, or refuel/rearm in v2 MVP. v1 keeps that ladder; v2 starts
  airborne.
- **No nuclear FX, missiles, bombs, multiple enemy types, mission system,
  multiplayer.** Deferred to v2.1+.
- **No full tile-mesh collision.** Analytic ground plane via Cesium's built-in
  altitude query is the MVP crash-detection mechanism. (LD-12.)
- **No screenshot-diff on per-PR CI.** Tag + nightly cron only with a GCP
  spend gate. (LD-10.)
- **No Hermes Telegram billing integration in MVP.** Email alerts from GCP
  billing are sufficient for AC-V2-12. (LD-11.)
- **No Fab / Quixel / external FBX assets.** Foundation's "no external assets"
  rule is extended to the UE5 game per CV-08. (LD-09.)

---

## 5. Functional Requirements

### FR-V2-01 — Cesium photoreal tile streaming (LD-15, CV-07, AC-V2-01)

The project streams Google Photorealistic 3D Tiles over the playable region
(20 km radius around Inhaúma MG). Cesium for Unreal is the only mechanism;
no custom WGS84-to-UE5 converters are written. The Cesium plugin and any
`#include "Cesium*"` directives are confined to the `AeroFightersGeoref`
module — a CI lint check fails the build if Cesium symbols leak outside.

### FR-V2-02 — Georeferenced origin and spawn (LD-04)

`CesiumGeoreference` actor is placed once in the level with origin set to
`(-19.47, -44.46, 800.0 m WGS84 ellipsoidal height)`. The origin is the
*chart anchor* only — not a spawn coordinate. The pawn spawns at
`(-19.47, -44.46, 2095.0 m WGS84 ellipsoidal height)`, which sits roughly
**500 m AGL** above Inhaúma's ~795 m terrain (with ~12 m geoid correction).
Spawn coords are stored in `DA_AeroFightersV2Config` (UE5 Data Asset) for
test assertion.

### FR-V2-03 — Hexagonal georef seam (LD-15, RR-04)

`AeroFightersGeoref` exposes a domain interface `IWorldGeoreferenceProvider`
with a Cesium-backed implementation `UCesiumGeorefAdapter`. All gameplay,
combat, AI, HUD, and FX code consumes `FGeoCoord` ↔ `FVector` conversions
only through this interface. The conversions delegate to Cesium's built-in
`TransformLongitudeLatitudeHeightToUnreal` / `TransformUnrealToLongitudeLatitudeHeight`.
Round-trip cm-equality is asserted in CI as AC-V2-14.

### FR-V2-04 — Generic delta-wing player pawn (O4, LD-09)

The MVP aircraft is a **generic delta-wing fighter** modeled either by hand
(UE5 BP primitive Static Mesh assembly) or sourced from a permissive CC0
asset library. No real-world aircraft likeness (no F-35, no MiG, no Su-27,
etc.). Mesh source and license are recorded in the asset-license table
(PLAN deliverable).

### FR-V2-05 — Arcade flight model (LD-06, AC-V2-04, AC-V2-15)

A `UFlightArcadeComponent` (BP first, C++ promotion under LD-02 trigger)
implements throttle / pitch / roll / yaw with v1's constants ported to
cm-scale UE5 units:

| Constant | Value | Source |
|---|---:|---|
| `STALL_THRESHOLD` | 10 m/s | v1 |
| `MIN_SPD` | 8 m/s | v1 |
| `MAX_SPD` | 80 m/s | v1 |
| `GRAVITY` | 14 m/s² | v1 |
| `PITCH_RATE` | 1.45 rad/s | v1 |
| `ROLL_RATE` | 2.30 rad/s | v1 |
| `YAW_RATE` | 0.80 rad/s | v1 |

Stall produces auto-recovery dive (v1 parity). No fuel, no atmospheric
density, no aerodynamic surfaces. JSBSim is **out of scope** in MVP.

### FR-V2-06 — Cannon at 12.5 rounds/sec (LD-06, AC-V2-05)

`UCannonComponent` fires bullets at 12.5 rounds/sec ± 2% with a 30-projectile
pool. Bullet speed 110 m/s, lifetime 2.0 s, muzzle position parented to the
nose socket. Hit detection via UE5 hit events (no per-frame raycast loop).

### FR-V2-07 — One static AA gun enemy (LD-06, AC-V2-06, AC-V2-07, AC-V2-16)

Exactly one `AAAGunActor` is placed via `UCesiumGlobeAnchorComponent` at
WGS84 `(-19.490, -44.387)` (near Inhaúma church, ~6 km SE of spawn) on the
terrain surface. Stored in the level + asserted by AC-V2-06. Range 220 m,
base fire interval 1.7 s, dumb-fire (no projectile lead). Destroyable by
cannon fire (AC-V2-16).

### FR-V2-08 — Crash detection via analytic ground (LD-12, AC-V2-08)

`UCrashDetectorComponent` uses
`UCesium3DTileset::FindGeospatialGroundAltitude` to query the analytic
terrain altitude under the pawn each tick. Crash when altitude delta <
`MOUNTAIN_BUFFER = 5 m`. Sea crash when ellipsoidal altitude < 0 m MSL.
Full tile-mesh collision is forbidden in MVP (would cook on game thread
and produce 50–200 ms hitches per LD-12 / SS-03).

### FR-V2-09 — Two cameras + Enhanced Input (LD-07, LD-26)

Enhanced Input plugin enabled. Single `IMC_AeroFightersMVP` mapping context
with InputActions: `IA_Throttle`, `IA_Pitch` (negated for sim-style inversion),
`IA_Roll`, `IA_Yaw`, `IA_FireCannon`, `IA_BarrelRoll`, `IA_CycleCamera`,
`IA_Pause`. Two camera modes: **Chase** (default, Spring Arm behind + above)
and **Cockpit / Nose** (forward-looking for cannon aim). Wide-chase, flyby,
and orbit cameras are deferred to v2.1.

### FR-V2-10 — HUD elements (LD-26)

UMG widgets, no external font assets, no external sprite assets. HUD shows
airspeed (m/s), altitude AGL (computed from FR-V2-08 ground query), throttle
%, cannon ammo, crosshair, score, and AA-target indicator. Boundary state
warning at 18 km (LD-18).

### FR-V2-11 — CesiumSunSky lighting + post-process palette (LD-25)

`CesiumSunSky` actor with `SolarTime = 12.0` UTC, fixed midday, no time-of-day
animation. Post-process volume: ACES Filmic tone mapping, Bloom 0.5, SSAO 0.4,
Motion Blur OFF, TAA ON, DOF OFF. Lumen mode = **screen-space, NOT hardware
ray tracing** (LD-13). Cesium attribution `ShowCreditsOnScreen = true`
always.

### FR-V2-12 — Audio palette (LD-25)

CC0 SFX (freesound.org filter) for cannon, hit, and explosion WAVs. MetaSound
patch for jet-engine drone modulated by throttle %. No external music.

### FR-V2-13 — Determinism harness (LD-14, AC-V2-14)

Console variable `aero.testMode 1` enables: `r.TemporalAASamples 1`,
`r.MotionBlur.Amount 0`, `r.Lumen.ScreenProbeGather.TemporalFilter 0`,
`CesiumSunSky.SolarTime = 12.0` (forced), service-scene animations shrunk
to v1 testMode analogue, fixed camera pose, tile-load gate active. Tile-load
gate polls `ACesium3DTileset::GetTotalNumberOfTilesCurrentlyLoading() == 0`
with a 30 s hard timeout (AC-V2-13).

### FR-V2-14 — Screenshot-diff harness (LD-10, LD-14, AC-V2-18)

Python harness launches a packaged Shipping build with `aero.testMode 1`,
loads 4 reference poses, applies the tile-load gate + 2 s Lumen settle,
captures screenshot, computes SSIM + pHash against a per-platform baseline
set. Thresholds (provisional, empirically tuned in PLAN from ≥ 3 sample
runs): **SSIM ≥ 0.72 per camera, mean SSIM ≥ 0.78 across 4 cameras, pHash
distance ≤ 20**. Per-platform baselines (Windows DX12 + Linux Vulkan
separate). Runs only on git tags + nightly cron with a GCP-spend gate
(skip if current spend > 80 % of $20 cap).

### FR-V2-15 — Boundary behavior at 20 km edge (LD-18)

3-tier soft boundary: 18 km HUD "RESTRICTED ZONE" warning (red flashing);
19.5 km Exponential Height Fog density ×10 (white-grey haze); 20 km
invisible spring force pushing back proportional to overshoot. No game-over.
SSE raised to 64 px beyond boundary for tile cost reduction.

### FR-V2-16 — Local-only launch configuration (O2)

The project builds Shipping binaries for Windows x64 and Linux x64 that the
operator runs locally. No `.exe` signing, no installer, no Releases packaging
in MVP. Build outputs land in `aero-fighters-v2/Saved/StagedBuilds/` and are
run directly. Path forward to public distribution is documented in §14.

---

## 6. Non-Functional Requirements

### NFR-V2-01 — Performance floor (AC-V2-17, LD-13)

RTX 3060 @ 1080p sustains **≥ 60 FPS averaged over a 60 s flight loop above
Inhaúma**, frame-time 99th-percentile **≤ 18.5 ms**. Gameplay per-frame budget:

| Subsystem | Budget (ms) | Notes |
|---|---:|---|
| Cesium tile streaming | 7–9 | pre-warmed in MENU |
| Lumen screen-space | 2–4 | Low/Medium preset |
| Niagara FX | 1–2 | bullet trails + hit FX |
| BP flight tick | < 0.30 / class | LD-02 promotion trigger |
| BP VM aggregate | ≤ 2.0 | LD-02 promotion trigger |
| Headroom | 0.9–4.9 | tight worst case |

Two-tier perf gate: cheap headless lane in PR CI (state machine, fire rate);
full windowed run on tag CI with GPU runner.

### NFR-V2-02 — Tile cost cap (AC-V2-12, LD-11, LD-22)

Google Maps Tiles API spend **≤ USD 20 / month** hard cap on the operator's
GCP project. Billing alerts fire at $10 (50 %), $15 (75 %), $20 (100 %) by
email. Manual cutoff procedure documented: operator disables the GCP key
within ~5 min of the $20 alert. Offline tile cache (LD-22, `make
tile-cache-populate`) is the default dev workflow; live fetch is opt-in.

### NFR-V2-03 — Platform compatibility

**Windows x64 native + Linux x64 native** local Shipping builds. No macOS.
No Proton/Wine. Linux Vulkan vs Windows DX12 shader-precision deltas are
absorbed by per-platform screenshot-diff baselines (SS-08, LD-14).

### NFR-V2-04 — Timeline (O3, LD-21)

**6–8 weeks** from kickoff to MVP closure. The 3-gate if-slip rule (LD-21)
remains active:

- **Gate-1 (end of Week 1):** self-hosted Windows + Linux runners online
  and passing UE5 compile-check. If Linux not ready, flagged at-risk;
  operator decides by end of Week 2 whether to defer.
- **Gate-2 (end of Week 4):** aircraft visible above Inhaúma with basic
  flight working. If not, scope cut (drop cockpit camera, drop stall HUD).
- **Gate-3 (end of Week 5):** Cesium tiles render at 60 FPS on at least
  Windows. If not, AC-V2-18 drops to manual review and ship arcade-quality
  via baked-tile adapter swap (possible because of LD-15 georef seam).

(Gate dates relaxed from synthesis's 4-week baseline per O3 cascade.)

### NFR-V2-05 — Blueprints-first with documented C++ promotion (LD-02)

BP-first prototyping is the working policy. Promotion to C++ when *any* of
the following trigger:

- **Hard:** per-class BP tick > 0.30 ms (CI gate).
- **Hard:** aggregate BP VM > 2.0 ms / frame.
- **Soft:** any BP graph > 150 nodes (weekly review).
- **Trigger:** if frame budget breached in Week 2, promote
  `UFlightArcadeComponent` to C++ immediately.

---

## 7. Stack Pinning

| Item | Pin | Notes |
|---|---|---|
| Engine | **Unreal Engine 5.5** (latest 5.5.x stable at impl start) | O1; supersedes discovery D1 |
| Cesium for Unreal | **Latest stable at impl start** — exact commit SHA recorded in TASKS T-001 | O1 cascade; pinned via committed file `aero-fighters-v2/Plugins/CesiumForUnreal/.commit-sha` (LD-16) + source mirror to operator-owned `cesium-unreal-pin` repo |
| Tile source | **Google Map Tiles API v1** (Photorealistic 3D Tiles) | Operator's personal GCP key; operator-only MVP per O2 — no third-party redistribution |
| Aircraft mesh | Generic delta-wing — hand-modeled UE5 BP primitive OR CC0 Sketchfab/PolyHaven asset | O4; license recorded in PLAN asset-license table |
| AA gun mesh | UE5 BP primitive own-work | LD-09 |
| Audio | CC0 freesound.org WAV + MetaSound | LD-25 |
| Linter | `clang-format` (UE5 style) + custom CI grep for Cesium-symbol leakage | enforces LD-15 |

The exact Cesium plugin version is chosen by `game-developer` at implementation
start once UE 5.5 is installed and recorded in TASKS T-001 along with the
commit SHA written to `.commit-sha`.

---

## 8. Secret & Key Management (LD-11, LD-24)

- **Google Maps Tiles API key**: operator's personal GCP project, scoped to
  Map Tiles API v1 only, IP-restricted to the operator's home/dev IPs.
- **Storage**: 1Password item `aero-fighters-v2/google-maps-tiles-api-key`
  (operator creates before first local build). Canonical fetch command:
  `op item get "aero-fighters-v2/google-maps-tiles-api-key" --field credential`.
- **Local consumption**: written to `aero-fighters-v2/.env.local` (gitignored)
  as `GOOGLE_MAPS_TILES_API_KEY=…`. Loaded at editor startup via a small BP
  utility.
- **CI consumption**: **not required for MVP** (operator-only launch per O2).
  Path-forward placeholder: GitHub Secret `GOOGLE_MAPS_TILES_API_KEY` on the
  self-hosted runner once nightly screenshot-diff CI lights up.
- **Rotation cadence**: **quarterly**, plus immediate rotation on suspected
  leak. Rotation drill documented in PLAN.
- **Revocation drill**: GCP console → API Credentials → disable key →
  confirm 401 from a curl to `https://tile.googleapis.com/v1/3dtiles/...?key=...`.

---

## 9. Acceptance Criteria

| ID | Description | Pass condition | Method |
|---|---|---|---|
| AC-V2-01 | Cesium streams photoreal tiles in 20 km radius around Inhaúma. | Standing the aircraft above origin shows recognizable photoreal terrain within 5 s; no missing tile placeholders at default LOD. | Manual + screenshot-diff (FR-V2-14) |
| AC-V2-02 | CesiumGeoreference origin is the exact Inhaúma anchor. | FTF: `OriginLatitude == -19.47 ± 0.0001`, `OriginLongitude == -44.46 ± 0.0001`, `OriginHeight == 800.0 ± 0.1`. | FTF, no GPU |
| AC-V2-03 | Generic delta-wing pawn spawns ≥ 500 m AGL above Inhaúma terrain. | First tick after `BeginPlay`: pawn altitude above analytic ground in (500 m, 3000 m AGL); WGS84 z ≈ 2095 m ± 5 m. | FTF |
| AC-V2-04 | Arcade flight controls (throttle / pitch / roll / yaw) respond within ≤ 1 frame input-to-effect latency. | FTF: apply full throttle for 3 simulated seconds, observe monotonic speed increase from 0 to ≥ 24 m/s; pitch / roll / yaw deltas match LD-06 constants. | FTF |
| AC-V2-05 | Cannon fires at 12.5 rounds/sec ± 2 %. | FTF: hold fire 10 s deterministic; count `OnProjectileSpawned` events = 125 ± 3. | FTF |
| AC-V2-06 | Exactly one AA gun static placement, reproducible. | FTF: load MVP level; assert exactly one `AAAGunActor`; WGS84 position within (1 m) of (-19.490, -44.387). | FTF |
| AC-V2-07 | Cannon projectile hit detection fires. | FTF: position projectile 1 m from AA gun, fire with deterministic velocity; `AAAGunActor.OnHit` fires within 100 ms. | FTF |
| AC-V2-08 | Terrain collision triggers crash state. | FTF: teleport pawn into Cesium terrain; `APlayerPawn.State == CRASHED` within 200 ms (via FR-V2-08 analytic ground query). | FTF |
| AC-V2-13 | Tile-load gate completes within 30 s timeout. | FTF: place camera at each of 4 reference poses, poll `tilesCurrentlyLoading`; gate passes when count == 0 within 30 s. | FTF |
| AC-V2-14 | `aero.testMode 1` produces deterministic rendering + georef cm round-trip. | FTF: execute `aero.testMode 1`; assert each determinism cvar from FR-V2-13; round-trip `FGeoCoord → FVector → FGeoCoord` ≤ 1 cm error over 100 random points. | FTF |
| AC-V2-16 | AA gun destruction after sufficient cannon hits. | FTF: deal damage = max health via deterministic projectile chain; `AAAGunActor` destroyed and removed from world. | FTF |
| AC-V2-17 | Performance floor: RTX 3060 @ 1080p ≥ 60 FPS sustained, 99th-percentile frame-time ≤ 18.5 ms. | Python perf harness: packaged Shipping build on self-hosted RTX 3060 runner; 60 s scripted flight loop; mean FPS ≥ 60, p99 frame ≤ 18.5 ms. | perf harness |
| AC-V2-18 | Screenshot-diff vs reference baselines passes thresholds, per platform. | Python harness: 4 reference poses; **SSIM ≥ 0.72 per camera, mean SSIM ≥ 0.78, pHash distance ≤ 20**; per-platform baseline; tag + nightly cron only with GCP-spend gate. | Python harness |
| AC-V2-19 | BP-to-C++ migration trigger documented + closure evidence attached. | At MVP closure: UE5 Insights profile attached for any BP class crossing 0.30 ms/tick or 2.0 ms aggregate; promotion decision + rationale recorded. | manual (closure) |
| AC-V2-20 | v1 Three.js Playwright suite remains entirely green. | `ci-v1.yml` runs the full v1 spec set on every commit affecting `aero-fighters/`; all existing v1 ACs pass. | Playwright CI |
| AC-V2-LOC-W | Windows x64 native local Shipping build runs on operator hardware. | `make build-win-shipping` produces a launchable Shipping binary; manual smoke: launches, reaches MENU, transitions to AIRBORNE, exits clean. | manual |
| AC-V2-LOC-L | Linux x64 native local Shipping build runs on operator hardware. | `make build-linux-shipping` produces a launchable Shipping ELF; manual smoke same as AC-V2-LOC-W. Subject to LD-21 Gate-1 if-slip. | manual |

---

## 10. Architecture Direction

5-module UE5 layout (architect's own §Concessions C1+C2; LD-01):

```
aero-fighters-v2/Source/
├── AeroFightersCore/        ← sortie SM (USTRUCT 4 states), Data Asset config, FGeoCoord, math helpers, no engine deps beyond Core
├── AeroFightersGeoref/      ← ONLY module allowed to `#include "Cesium*"`;
│                              exposes IWorldGeoreferenceProvider port
│                              + UCesiumGeorefAdapter implementation
├── AeroFightersGameplay/    ← APlayerPawn, UFlightArcadeComponent, UMG HUD,
│                              UCrashDetectorComponent, Niagara hooks,
│                              MetaSound bindings (audio + HUD folded in)
├── AeroFightersCombat/      ← UCannonComponent, AAAGunActor, projectile pool,
│                              hit detection delegates
└── AeroFightersHarness/     ← testMode cvar, tile-load gate, FTF assertions,
                              CI lint glue, perf harness hooks
```

Module dependency rules (Build.cs):

- `Core` depends on nothing UE5-game.
- `Georef` depends on `Core` + `CesiumRuntime`.
- `Gameplay`, `Combat`, `Harness` depend on `Core` + `Georef` (via the
  `IWorldGeoreferenceProvider` port only — no Cesium symbols).

**Non-negotiables (LD-15, RR-04):**

- `AeroFightersGeoref` is the only module allowed to `#include "Cesium*"`
  or reference `ACesium3DTileset`, `CesiumGeoreference`, etc.
- CI lint in `AeroFightersHarness` greps for `#include "Cesium` and any
  `UCesium*` symbol outside `AeroFightersGeoref/` and fails the build.
- Round-trip `FGeoCoord ↔ FVector` cm-equality test is mandatory (AC-V2-14).

**C++ promotion triggers (LD-02):**

- 0.30 ms / class (hard CI gate).
- 2.0 ms aggregate BP VM (hard CI gate).
- 150 BP nodes / graph (soft weekly review).
- Week-2 frame-budget breach → promote `UFlightArcadeComponent` to C++ at
  that moment.

The 7-module maximalist plan is the **v2.1 refactor target** and is *not*
scope here.

---

## 11. Build & Local-Run Targets

**MVP (this release):**

- `make build-win-shipping` → Windows x64 Shipping binary in
  `aero-fighters-v2/Saved/StagedBuilds/Windows/` — operator launches by
  double-click or CLI.
- `make build-linux-shipping` → Linux x64 Shipping ELF in
  `aero-fighters-v2/Saved/StagedBuilds/Linux/` — operator launches via
  shell. Subject to LD-21 Gate-1 if-slip.
- No installer, no signing, no packaging, no public distribution channel.

**Path forward to public distribution (deferred to v2.1):**

The georef seam (LD-15) makes the public-distribution path a configuration
choice rather than a rewrite. Two pre-validated options for v2.1:

1. **Seek written Google authorization** for embedding Photoreal 3D Tiles
   in a downloadable binary; if granted, ship via GitHub Releases zip
   under the operator's GCP key with cost-cap enforcement at the binary
   level.
2. **Swap to Cesium World Terrain + Bing Maps Aerial** as the primary
   tile source (Build.cs config change, not code); permissively licensed,
   no ToS gray area; visual quality steps down from photoreal to
   high-fidelity-grounded.

Decision deferred to the v2.1 SPEC.

---

## 12. Risk Register

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| RR-V2-01 | Cesium for Unreal plugin breaking changes on UE 5.5 line. | LOW (post-O1) | Pin to exact commit SHA (LD-16); mirror plugin source to `cesium-unreal-pin` operator repo. |
| RR-V2-02 | Google ToS gray-area for embedding Photoreal Tiles in a distributed binary. | LOW (post-O2) | MVP is operator-only — no redistribution. v2.1 SPEC decides between Google authorization or CWT+Bing swap. |
| RR-V2-03 | CesiumGeoreference origin drift / unit-error spawn (e.g., 800 m AGL vs WGS84). | HIGH → mitigated | LD-04 corrected spawn to 2095 m WGS84; AC-V2-03 asserts spawn altitude in (500 m, 3000 m AGL). Origin documented as chart anchor only. |
| RR-V2-04 | Lumen + TAA temporal accumulation breaks screenshot-diff determinism. | HIGH | `aero.testMode 1` cvar forces `r.TemporalAASamples 1`, motion blur off, Lumen temporal filter off, 2 s settle window (LD-14). |
| RR-V2-05 | Self-hosted GPU runner unavailable at Week-1 gate. | HIGH | LD-08 + LD-20 setup checklist: runner online with `self-hosted,gpu-rtx3060,ue5-builder` labels by Day 5; gate fires if not ready. |
| RR-V2-06 | Lumen + Cesium 99th-percentile frame spikes (50–80 ms tile-decode hitches). | HIGH | LD-13: screen-space Lumen, tile pre-warm in MENU, MaxTileCacheBytes = 3 GB starting. Perf gate AC-V2-17 is the canary. Insights profile every PR. |
| RR-V2-07 | $20 GCP cap blown by dev-iteration tile fetches before MVP closure. | MEDIUM | LD-22 offline tile cache as default (`CESIUM_OFFLINE_TILES=1`); LD-11 billing alerts $10/$15/$20; LD-10 screenshot-diff tag + nightly only. |
| RR-V2-08 | Cesium tile mesh collision cooking hitches on LOD transitions. | HIGH → mitigated | LD-12: analytic ground via `FindGeospatialGroundAltitude`; full mesh collision deferred to v2.1. |
| RR-V2-09 | Linux Vulkan vs Windows DX12 shader-precision deltas fail screenshot-diff. | HIGH | Two reference-baseline sets, one per platform (LD-14). SSIM metric (not per-pixel) accommodates precision variation. |
| RR-V2-10 | Shader compile stutter on first PIE / launch (30–120 s black screen). | MEDIUM | LD-19 shader pre-compilation in Project Settings + "Build Shader Bytecode" step in local build pipeline; README documents expected first-launch behavior. |

---

## 13. Required Planning Sequence

After this SPEC reaches `**Status:** Aprovado`, the product-engineer composes
the PLAN. The PLAN must close the Open Questions in §14 below and detail:

1. Week-by-week milestone plan honoring NFR-V2-04's 6–8 week envelope and
   LD-21's 3-gate if-slip rule.
2. Phased UE 5.5 setup + Cesium plugin pin selection (TASKS T-001).
3. Self-hosted runner topology + Week-1 setup checklist (LD-20).
4. Asset-license audit table (aircraft mesh source, CC0 audio attribution).
5. Demo flight script for MVP showcase (which path showcases the photoreal
   map).
6. Empirical calibration runs for screenshot-diff thresholds (≥ 3 samples
   per platform).

Cross-references for the PLAN author:

- `.dadaia/reports/product-engineer/2026-05-17T060824Z-game-discovery.html`
- `.dadaia/reports/product-engineer/2026-05-17T063246Z-synthesis-aero-v2.html`
- `.dadaia/reports/software-architect/2026-05-17T061546Z-game-arch.html`
- `.dadaia/reports/devops-engineer/2026-05-17T061638Z-game-devops.html`
- `.dadaia/reports/game-developer/2026-05-17T061730Z-gameplay-analysis.html`
- `.dadaia/reports/game-designer/2026-05-17T062026Z-design-analysis.html`
- `.dadaia/reports/game-tester/2026-05-17T062053Z-acceptance-criteria.html`

---

## 14. Open Questions (deferred to PLAN)

| # | Question | Owner |
|---|---|---|
| OQ-V2-01 | 1Password item ID confirmation: operator creates `aero-fighters-v2/google-maps-tiles-api-key` before T-002 lands. | operator |
| OQ-V2-02 | Exact Cesium for Unreal plugin version (decided + recorded in TASKS T-001 once UE 5.5 is installed). | game-developer |
| OQ-V2-03 | Exact generic-delta-wing mesh source (hand-modeled vs Sketchfab CC0 vs PolyHaven CC0) and license attribution. | game-developer + game-designer (hat) |
| OQ-V2-04 | Asset-license audit table content (CC0 audio attributions, mesh source, Niagara FX). | game-designer (hat) |
| OQ-V2-05 | MVP demo-script: which flight path showcases the photoreal map for the operator showcase? | game-designer (hat) + operator |
| OQ-V2-06 | GitHub Actions token scope for the self-hosted GPU runner registration (read-only repo + workflow scope). | devops-engineer |
| OQ-V2-07 | Empirically-calibrated SSIM + pHash thresholds (provisional thresholds in FR-V2-14 stand until PLAN's 3+ calibration runs lock final values). | game-tester (hat) + game-designer (hat) aesthetic veto |
| OQ-V2-08 | Path-forward decision document for public distribution (v2.1 input, not v2 scope). | product-engineer (v2.1) |

---

## 15. Approval

- [x] **Status:** Aprovado — 2026-05-17 (operator approval via workflow gate)

# PLAN: Aero Fighters Mission Realism

> **Status:** Aprovado
> **Spec:** `specs/features/aero-fighters-mission-realism/SPEC.md`
> **Created:** 2026-05-13
> **Owner roles:** `@software-architect`, `@game-developer`, `@qa-engineer`

---

## 1. Objective

Implement the approved mission-realism feature in small, testable slices:

1. explicit sortie state machine
2. one primary airport map with runway, hangars, service area, mandatory Tauan/Papai ground text, and lights
3. realistic-enough airport takeoff, landing, taxi, and automatic landing gear
4. return-to-base mission loop with 30-40s procedural service/rearm scene
5. weapon refill only through service
6. mayday, burning crash descent, ejection, parachute, survival/death state policy
7. multiple aircraft camera views and nuclear cinematic camera
8. improved procedural nuclear explosion with fireball, mushroom cloud, and shockwave
9. Playwright/video-backed QA after each implementation slice

Primary map for the first implementation: `desert` — lowest-risk first airport map (wider open terrain, fewer urban/building conflicts than Rio); a later spec can replicate the airport system to other maps.

---

## 2. Resolved Clarifications

Binding operator clarifications after the three-role spec review:

| Topic | Decision |
|---|---|
| Primary map | `desert` approved as first/default map for this feature slice. |
| Nuclear weapon | The atomic/nuclear bomb already exists; this feature moves it from `N` to `T` and improves camera/explosion behavior — no new weapon. |
| Nuclear scope | Improve the existing bomb's cinematic camera and explosion effect; do not redefine the weapon system unless required. |
| QA video policy | Videos are a diagnostic/validation tool, not permanent artifacts: capture bugs, verify fixes, delete heavy videos, and add lighter unit/sim/E2E regression assertions. |
| Service skip/acceleration | Realistic tanker-truck refuel/rearm/maintenance; acceleration/skip allowed only after the process is visible enough, without removing the 30-40s full path. |
| Mountain touchdown | Mountain contact kicks/bounces the aircraft into burning `MAYDAY`; it falls until ground/water impact, with ejection opportunity when conditions allow. |
| Full rearm meaning | "Bombs/weapons full" = restore all current armament: light missiles, heavy missiles, atomic/nuclear bomb stock. No separate bomb inventory. |
| Ejection survival | Ejection always saves the pilot in this first slice; parachute landing shown, survival not terrain-dependent yet. |
| No-ejection death | Inventory preserved at impact/death time with no free refill; mission targets/progress/score reset. |
| Test service duration | `testMode=1` service scene = 5 seconds; production keeps the 30-40s path. |
| Aircraft visual realism | Review and improve the aircraft model in this feature: N64/Aero Fighters Assault-inspired but a more readable, believable fighter silhouette via current Three.js procedural geometry. |
| HUD visual direction | Preserve current data; redesign toward Aero Fighters Assault/N64 language: green flight-combat overlay, side speed/altitude ladders, central bracket reticle, larger radar/minimap, weapon stock, runway/landing/service/ejection indicators. |
| Desert visual direction | `desert` must be a readable landmark map: runway, taxiway, hangars, service zone, roads/paths, scale objects, tanker trucks, text/lights, clear horizon/terrain contrast. |

---

## 3. Supersession Rules

This feature intentionally supersedes parts of the approved base Aero Fighters spec:

| Base behavior | New behavior under Mission Realism |
|---|---|
| Kills may spawn missile pickups restoring weapons | Kills no longer restore weapons; full restore only via service/rearm or ejection-survival recovery rule. |
| Mission advances immediately after required targets destroyed | Destroying required targets enters `RETURN_TO_BASE`; next sortie only after landing, taxi/service, service completion. |
| Always fixed chase camera | `Chase` preserves the old feel; `camera-modes.js` is the source of truth for all cameras. |
| Ground contact usually means instant crash | `classifyGroundContact()` decides runway/taxi/service/water/building/mountain/terrain before crash logic. |
| Mountain contact is immediate final failure | Mountain contact kicks the aircraft into burning `MAYDAY` fall; impact resolves death/survival via ejection policy. |

Historical tasks in `specs/features/aero-fighters/PLAN.md` and `TASKS.md` are backfill/historical context; new implementation follows this PLAN.

---

## 4. Requirement Traceability

- Full sortie loop (takeoff, mission, landing, refuel/maintenance): FR-01, FR-06, FR-07 → Phases 2, 5, 6
- 30-40s in-engine service scene with tanker truck, workers, missile/bomb replacement: FR-07 → Phase 6
- Realistic takeoff/landing, rolling on airport ground, no instant ground explosion: FR-03, FR-04, FR-05 → Phase 4
- Flat-terrain landing later, not first slice: Non-Goals, FR-03, FR-05 → deferred explicitly
- No landing on rough terrain, buildings, mountains, water: FR-03, FR-05, AC-MR-05 → Phases 3, 4, 10
- Airport runway/buildings/hangars, ground text `AEROPORTO DO TAUAN E DO PAPAI` with lights: FR-02, AC-MR-01, AC-MR-02 → Phase 3
- Weapons full after service; no bombs from kills: FR-07, FR-08, AC-MR-09 → Phase 5
- Continuous Playwright/video QA; video catches rendering bugs screenshots miss: FR-14, AC-MR-12, AC-MR-13 → Phases 1, 10, every slice
- Burning fall to ground, optional ejection, parachute shown: FR-09, AC-MR-10 → Phase 7
- Ejection survival preserves kills and restores weapons; death respawns enemies, resets score/progress, no free refill: FR-10, AC-MR-10, AC-MR-11 → Phase 7
- One primary map first; airport landing first, natural terrain later: Non-Goals, FR-02, FR-03, FR-05 → Phases 3, 4
- Unlimited ejection: FR-09 → Phase 7; automatic landing gear: FR-05 → Phase 4
- Multiple aircraft views: FR-12, AC-MR-15 → Phase 8; nuclear bomb moves `N`→`T`: FR-12, FR-13 → Phases 5, 8, 9
- Nuclear impact auto-switches camera: FR-12, AC-MR-16 → Phase 8; realistic explosion (fireball, mushroom, shockwave): FR-13, AC-MR-17 → Phase 9
- Three-role involvement (architect, developer, QA): FR-15, AC-MR-14 → Phases 0, 1, all implementation

All operator items are covered by the approved SPEC and mapped to an implementation phase.

---

## 5. Architecture Plan

Modules under `aero-fighters/src/`: `sortie-state.js`, `airport.js`, `landing-zones.js`, `ground-physics.js`, `service-scene.js`, `ejection.js`, `aircraft-model.js`, `camera-modes.js`, `nuclear-fx.js`, `physics-core.js`, `main.js`.

| Module | Responsibility |
|---|---|
| `sortie-state.js` | explicit sortie states, legal transitions, state snapshots |
| `airport.js` | procedural runway, taxi/service area, hangars, buildings, ground text, lights |
| `landing-zones.js` | runway bounds, valid/invalid surface classification, slope/obstacle reasons |
| `ground-physics.js` | frame-rate independent taxi, takeoff roll, landing roll, automatic gear, envelope checks |
| `service-scene.js` | tanker truck, hose, workers, rearm/maintenance animation, production/test durations |
| `ejection.js` | mayday fall, ejection event, parachute descent, survival/death resolution |
| `aircraft-model.js` | procedural higher-fidelity aircraft geometry, loadout hardpoints, gear visuals, visual diagnostics |
| `camera-modes.js` | chase, wide chase, cockpit/nose, flyby/cinematic, orbit/debug, temporary overrides |
| `nuclear-fx.js` | pooled procedural flash, fireball, rising plume, mushroom cloud, shockwave, lighting pulse |
| `physics-core.js` | pure math helpers and constants reused by gameplay and tests |
| `main.js` | orchestration only: input, update order, module wiring, debug API integration |

Architecture constraints:

- Keep `processInput`, `update(dt)`, and render/update side effects separated.
- Cap `dt`; keep physics frame-rate independent.
- Explicit state transitions; no hidden `playing && !dead && ...` combinations.
- Expose pure helpers for landing envelope and state policy tests.
- Keep procedural visuals bounded and pooled for browser/headless performance.
- Add debug snapshots for every new system before E2E relies on it.

---

## 6. QA Strategy

The `@qa-engineer` work starts before gameplay implementation.

Test surfaces under `tests/aero-fighters/`: `sortie.spec.js`, `landing.spec.js`, `service.spec.js`, `ejection.spec.js`, `camera.spec.js`, `nuclear-fx.spec.js`, plus `tools/test-aero-sortie-sim.js`.

Required `window.__aeroDebug.snapshot()` additions: `sortieState`, `selectedMap`, `airport`, `runwayBounds`, `landingZoneStatus`, `groundContact`, `groundSpeed`, `verticalSpeed`, `takeoffEnvelope`, `landingEnvelope`, `gearState`, `serviceState`, `serviceProgress`, `ejectionState`, `pilotState`, `cameraMode`, `cinematicCamera`, `nuclearFxState`, `missionProgress`, `missionScore`, `weaponInventory`, `airportText`, `criticalVideoCapture`, `aircraftVisual`, `hudLayout`, `desertLandmarks`.

Video-backed scenarios: airport takeoff; runway landing; invalid touchdown/forced crash; service progression; ejection and parachute descent; camera cycling; nuclear cinematic camera and return; mushroom cloud/shockwave progression; airport text/lights in motion; aircraft silhouette readability across all views; HUD readability/non-overlap while landing, servicing, ejecting, firing the atomic bomb; desert landmark readability at speed.

Video lifecycle:

- Playwright default keeps video on failure/retry; MR critical validation supports explicit capture mode (e.g. `AERO_RECORD_VIDEO=1`) recording even on pass.
- Videos are inspected while fixing rendering/physics bugs, then deleted; every resolved video-found bug leaves a lighter regression check (unit test, sim invariant, debug snapshot assertion, or short E2E).

Bug closure policy:

- Reporting a bug is not a done condition. Every confirmed bug becomes a TASKS item with observed evidence, suspected root cause, intended fix, validation command/QA scenario, and regression guard.
- A bug closes only after the fix is implemented, QA passes, and a regression guard exists; unfixable-in-scope bugs must be explicitly moved to a follow-up spec with reason and risk.

Commands that must pass before completion:

```bash
npm run validate:aero-map
npm run test:aero:unit
npm run test:aero:sim
TEST_PORT=<free-port> npm run test:aero:e2e
TEST_PORT=<free-port> npm run test:aero:qa
```

New E2E specs must preserve existing Playwright video/trace artifacts and add the explicit MR video-capture mode.

---

## 7. Implementation Phases

### Phase 0 — Architecture Review

Owner: `@software-architect`. Review the module split against current code; confirm `physics-core.js`/`ground-physics.js`/`landing-zones.js` boundaries; confirm `main.js` stays orchestration-only; approve the `sortie-state.js` transition graph. Deliverable: architecture notes in `TASKS.md` or a referenced review report before implementation.

### Phase 1 — QA Design First

Owner: `@qa-engineer`. Define Playwright acceptance scenarios, deterministic shortcut inputs/debug helpers (full sortie, service, ejection, nuclear cinematic), and video checkpoints before gameplay code changes; extend QA tools only inside `tests/aero-fighters/tools/`. Deliverable: TASKS entries for E2E specs and sim tools before implementation tasks.

### Phase 2 — Sortie State Machine

Owner: `@game-developer`. Add `sortie-state.js` with legal transitions `TAXI_OUT -> TAKEOFF_ROLL -> AIRBORNE/MISSION_ACTIVE -> RETURN_TO_BASE -> LANDING_ROLL -> TAXI_IN -> SERVICE_SCENE -> NEXT_SORTIE_READY`, plus mayday/ejection/death branches and debug snapshots; preserve the combat loop until airport phases are wired. TASKS must include a `state + event + guard -> nextState` transition matrix covering at least: `taxiStarted`, `runwayAligned`, `takeoffSpeedReached`, `liftoff`, `targetDestroyed`, `allRequiredTargetsDestroyed`, `approachEntered`, `touchdownSafe`, `touchdownUnsafe`, `mountainContact`, `waterImpact`, `serviceZoneReached`, `serviceComplete`, `criticalDamage`, `ejectRequested`, `pilotLanded`, `aircraftImpact`. Validation: unit/sim test of legal/illegal transitions and death/survival policy stubs.

### Phase 2.5 — Aircraft Visual Realism Review And Upgrade

Owner: `@game-developer`, reviewed by `@software-architect` and `@qa-engineer`. Review the current model against `aero-fighters/img/` references; extract construction from `player.js` into `aircraft-model.js` if needed; improve silhouette readability (longer nose, wider wing planform, visible tailplanes/stabilizers, readable canopy, underside hardpoints, gear visual states, material contrast under day/night/desert lighting); procedural Three.js geometry only (no external assets). Add `aircraftVisual` debug snapshot (mesh count, loadout, gear state, readability checkpoint). Validation: screenshot/video checkpoints across Chase, Wide Chase, Flyby/Cinematic, and runway/taxi views; no near-black unreadable silhouette; mesh/draw-call budget passes `npm run test:aero:qa`.

### Phase 3 — Airport On `desert`

Owner: `@game-developer`, reviewed by `@qa-engineer`. Add airport geometry to `desert` only (first/default MR map): runway, taxi/service pavement, hangars, support buildings, service zone, runway lights, roads/paths, desert scale landmarks; mandatory ground text `AEROPORTO DO TAUAN E DO PAPAI` beside the runway with marker lights; collision-safe, terrain-aligned surfaces; extend map validation (airport bounds, text, lights, no floating structures). TASKS must define the airport contract: `runway.center`, `heading`, `length`, `width`, `touchdownZone`, `taxiwayBounds`, `serviceZoneBounds`, height/flattening policy. Validation: map validator passes; Playwright video confirms runway/text/lights in motion; landmarks don't vanish/flicker/float.

### Phase 4 — Ground Physics, Takeoff, Landing, Automatic Gear

Owner: `@game-developer`. Add `landing-zones.js` and `ground-physics.js`: runway-only valid landing, automatic gear deploy/retract, acceleration, rolling friction, braking, taxi steering, takeoff minimum speed, landing speed/descent envelope; replace instant ground explosion with classified touchdown. Behavior: safe runway touchdown → `LANDING_ROLL`; unsafe touchdown → `MAYDAY` if survivable-looking else `CRASHED`; mountain contact → burning `MAYDAY` fall with ejection opportunity; building/water/high-speed terrain impact → `CRASHED`. Validation: sim tests for takeoff/landing envelopes; E2E video of takeoff and landing.

### Phase 5 — Mission Return, Rearm Rules, Score Rules

Owner: `@game-developer`. Final required target → `RETURN_TO_BASE` (not instant next mission); return-to-airport HUD/navigation; redesign HUD toward Aero Fighters Assault/N64 reference (green side speed/altitude/landing-envelope ladders, central flight/target brackets, larger radar/minimap, weapon stock, runway guidance, gear state, service progress, ejection prompt) with `hudLayout` debug diagnostics; disable target-kill weapon rewards; restore weapons only via service completion or ejection-survival rule; on pilot death reset targets/progress/score with no weapon refill; move atomic bomb from `N` to `T` (same existing weapon, no new one). Validation: sim tests for mission completion, inventory, score reset, enemy respawn; E2E confirms no kill refill and HUD readability/non-overlap in all moments.

### Phase 6 — Refuel/Rearm/Maintenance Scene

Owner: `@game-developer`. Add `service-scene.js`: 30-40s production timeline, 5s `testMode=1` timeline; tanker truck, hose/connection, workers, missile/bomb replacement as the visual focus; production acceleration/skip only after the operation is clearly visible; player control and damage disabled during service; transition to `NEXT_SORTIE_READY` then next sortie. Validation: unit/sim duration policy and restoration timing; E2E video of the sequence.

### Phase 7 — Mayday, Ejection, Parachute, Death Policy

Owner: `@game-developer`. Add `ejection.js`: critically damaged aircraft burns/smokes and falls uncontrolled; `J` ejection action, unlimited when mayday conditions allow; ejection seat/pilot and parachute descent rendered; ejection always survives in this slice — survival preserves destroyed targets and restores weapons after recovery/service; death without ejection resets targets/progress/score and preserves weapon inventory as-is at impact, no refill. Validation: unit/sim state policy; E2E video of burning fall, ejection, parachute, restart.

### Phase 8 — Camera Modes And Nuclear Cinematic Camera

Owner: `@game-developer`, reviewed by `@qa-engineer`. Add `camera-modes.js` with Chase, Wide Chase, Cockpit/Nose, Flyby/Cinematic, Orbit/Inspection; `C` camera-cycle action; `cameraMode` debug snapshot; on player-fired nuclear impact, temporarily switch to cinematic camera showing aircraft and explosion when feasible, then auto-return to the previous camera; shortened cinematic in `testMode=1`. Validation: E2E for cycling, control continuity, debug reporting, nuclear auto-camera and return.

### Phase 9 — Nuclear/Large Explosion Realism

Owner: `@game-developer`. Add `nuclear-fx.js`; improve the existing atomic bomb effect (now on `T`) with pooled procedural stages: flash, expanding fireball, rising core, stem/plume, mushroom cap, shockwave ring, dust/smoke/debris, lighting pulse, camera shake; large non-nuclear explosions may use a reduced version; headless/test degradation with same diagnostic states; expose `nuclearFxState.stage`, `fireballRadius`, `plumeHeight`, `shockwaveRadius`, `activeParticles`, `lightPulse`. Validation: E2E/video of fireball, mushroom shape, shockwave, camera shake; FPS/headless QA within threshold.

### Phase 10 — Regression, Tuning, Final Reviews

Owners: `@game-developer`, `@qa-engineer`, `@software-architect`. Run full Aero QA suite; inspect MR video-capture artifacts for motion/rendering bugs, then delete heavy videos once fixes are confirmed and lighter regression checks exist; convert every confirmed bug into a fix task before completion; tune constants only with test evidence and manual gameplay notes; confirm no floating targets/buildings/airport structures, no HUD overlap, architecture boundaries followed.

Completion criteria:

- All AC-MR-01 through AC-MR-17 pass; `npm run test:aero:qa` passes.
- MR critical scenarios validated with video during the current QA pass; persistent regression coverage via lightweight tests/debug assertions, not retained heavy videos.
- No confirmed bug remains only reported — each fixed or explicitly deferred into a new approved spec.
- `@software-architect` review accepts module boundaries.

---

## 8. Risk Controls

| Risk | Mitigation |
|---|---|
| Landing physics becomes frustrating | Forgiving envelope, clear HUD feedback, tune with video/manual review |
| `main.js` grows too large | Add modules first; keep `main.js` as coordinator |
| Headless FPS drops from airport/nuclear FX | Lower particle counts/geometry in headless while preserving debug state |
| Video QA becomes slow | Explicit MR video-capture mode only during triage/final validation; delete heavy videos, keep lightweight regression tests |
| Airport text becomes unreadable | Validate text placement by camera-distance E2E and video |
| Camera cinematic disrupts control | Store previous camera mode and enforce timed return |
| Death/ejection state becomes inconsistent | Pure state policy tests before E2E |

---

## 9. Deferred Work

Explicitly not part of this first implementation:

- safe landing/taxi on natural flat terrain outside the airport
- replicating the airport to every existing map
- real external 3D assets or video files
- manual landing gear controls
- full FAA-level flight model

---

## 10. Approval

- [x] Draft reviewed by operator
- [x] **Status:** Aprovado — 2026-05-13 — aprovado pelo operador: "O plan esta aprovado"

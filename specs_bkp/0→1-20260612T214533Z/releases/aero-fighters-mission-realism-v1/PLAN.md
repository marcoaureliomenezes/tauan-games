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

Primary map for the first implementation: `desert`.

Rationale: `desert` is the lowest-risk first airport map because it has wider open terrain and fewer urban/building conflicts than Rio. Once the runway, physics, cameras, service loop, and QA videos are stable there, a later spec can replicate the airport system to other maps.

---

## 2. Resolved Clarifications

These clarifications were provided by the operator after the three-role spec review and must be treated as binding for TASKS.

| Topic | Decision |
|---|---|
| Primary map | `desert` is approved as the first and default map for this feature slice. |
| Nuclear weapon | The atomic/nuclear bomb already exists in the game. This feature does not invent a new weapon; it moves the existing action from `N` to `T` and improves camera/explosion behavior. |
| Nuclear scope | Improve the existing atomic bomb's cinematic camera and explosion effect; do not redefine the whole weapon system unless required to support these improvements. |
| QA video policy | Videos are a diagnostic and validation tool, not permanent heavy artifacts. Use video to capture airport/rendering/physics bugs and verify fixes; after each bug is resolved, delete heavy videos and add lighter unit/simulation/E2E assertions to prevent regression. |
| Service scene skip/acceleration | Production should focus on realistic tanker-truck refuel/rearm/maintenance. It may support acceleration/skip after the process is visible enough, without removing the 30-40s full scene path. |
| Mountain touchdown | Touching a mountain must kick/bounce the aircraft into `MAYDAY`: the aircraft catches fire and falls until ground/water impact, giving the player an ejection opportunity when conditions allow it. |
| Full rearm meaning | “Bombs/weapons full” means restoring all current armament: light missiles, heavy missiles, and the existing atomic/nuclear bomb stock. Do not add a separate bomb inventory in this slice. |
| Ejection survival | Ejection always saves the pilot in this first slice. The parachute landing is still shown, but survival does not depend on terrain classification yet. |
| No-ejection death inventory | If the pilot dies without ejecting, inventory is preserved at impact/death time with no free refill. Mission targets/progress/score reset. |
| Test service duration | `testMode=1` service scene duration is 5 seconds. Production keeps the 30-40s full service path. |
| Aircraft visual realism | The current aircraft model must be reviewed and improved in this feature. The game remains inspired by Aero Fighters Assault/N64, but with current Three.js procedural geometry we should target a more readable, more believable fighter silhouette than the current low-detail model. |
| HUD visual direction | Preserve current data, but redesign Mission Realism HUD toward Aero Fighters Assault/N64 language: green flight-combat overlay, side speed/altitude ladders, central bracket reticle, larger radar/minimap, weapon stock, runway/landing/service/ejection indicators. |
| Desert visual direction | `desert` must become a readable landmark map, not only flat floor plus mesas: runway, taxiway, hangars, service zone, roads/paths, scale objects, tanker trucks, text/lights, and clear horizon/terrain contrast. |

---

## 3. Supersession Rules

This feature intentionally supersedes parts of the approved base Aero Fighters spec:

| Base behavior | New behavior under Mission Realism |
|---|---|
| Target kills may spawn missile pickups that restore weapons | Normal mission kills no longer restore weapons. Full restore happens only through service/rearm or explicit ejection-survival recovery rule. |
| Mission advances immediately after required targets are destroyed | Destroying required targets enters `RETURN_TO_BASE`; next sortie starts only after landing, taxi/service, and service completion. |
| Camera is always the fixed chase camera | `Chase` preserves the old feel, but `camera-modes.js` becomes the source of truth for all gameplay/cinematic cameras. |
| Ground/terrain contact means instant crash in most cases | `classifyGroundContact()` must decide runway/taxi/service/water/building/mountain/terrain before crash logic. |
| Mountain contact is immediate final failure | Mountain contact kicks the aircraft into burning `MAYDAY` fall when survivable-looking, then impact resolves death/survival via ejection policy. |

Historical tasks in `specs/features/aero-fighters/PLAN.md` and `TASKS.md` are backfill/historical context. New implementation must follow this Mission Realism PLAN once approved.

---

## 4. Requirement Traceability

| User requirement | SPEC coverage | PLAN phase |
|---|---|---|
| Full mission sortie: takeoff, mission, landing, refuel/maintenance | FR-01, FR-06, FR-07 | Phases 2, 5, 6 |
| 30-40s in-engine service scene, not video | FR-07 | Phase 6 |
| Tanker truck, human workers, missile/bomb replacement | FR-07 | Phase 6 |
| Realistic takeoff and landing, not instant explosion on ground | FR-03, FR-04, FR-05 | Phase 4 |
| Plane can roll on airport/runway ground | FR-03 | Phase 4 |
| Flat terrain landing later, not first slice | Non-Goals, FR-03, FR-05 | Deferred explicitly |
| Cannot land on rough terrain, buildings, mountains, water | FR-03, FR-05, AC-MR-05 | Phases 3, 4, 10 |
| Airport runway, buildings, hangars | FR-02, AC-MR-01 | Phase 3 |
| Ground text `AEROPORTO DO TAUAN E DO PAPAI` | FR-02, AC-MR-02 | Phase 3 |
| Lights around the text | FR-02, AC-MR-02 | Phase 3 |
| Bombs/weapons full after service | FR-07, FR-08 | Phase 5 |
| No more bombs from killing enemies | FR-08, AC-MR-09 | Phase 5 |
| Continuous QA with Playwright/video | FR-14, AC-MR-12, AC-MR-13 | Phases 1, 10 and every slice |
| Rendering bugs that screenshots miss must be caught by gameplay/video | FR-14 | Phases 1, 10 |
| Downed aircraft falls burning to ground | FR-09 | Phase 7 |
| Player can eject or not | FR-09 | Phase 7 |
| Parachute landing shown after ejection | FR-09, AC-MR-10 | Phase 7 |
| Ejection survival preserves dead enemies and restores weapons | FR-10, AC-MR-10 | Phase 7 |
| Pilot death respawns enemies and resets mission score/progress | FR-10, AC-MR-11 | Phase 7 |
| Death does not grant free weapon refill | FR-10, AC-MR-11 | Phase 7 |
| One primary map first | Non-Goals, FR-02 | Phase 3 |
| Airport landing first; natural terrain landing later | Non-Goals, FR-03, FR-05 | Phase 4 |
| Unlimited ejection | Open questions resolved, FR-09 | Phase 7 |
| Automatic landing gear | FR-05 | Phase 4 |
| Multiple aircraft views | FR-12, AC-MR-15 | Phase 8 |
| Existing nuclear/atomic bomb moves from `N` to `T` | FR-12, FR-13 | Phases 5, 8, 9 |
| Nuclear impact auto-switches camera | FR-12, AC-MR-16 | Phase 8 |
| Nuclear explosion more realistic: fireball, rising mushroom, shockwave | FR-13, AC-MR-17 | Phase 9 |
| Involve software-architect, game-developer, qa-engineer | FR-15, AC-MR-14 | Phases 0, 1, all implementation |

All items mentioned by the operator are covered by the approved SPEC and mapped to an implementation phase here.

---

## 5. Architecture Plan

Target module layout:

```text
aero-fighters/src/
├── sortie-state.js
├── airport.js
├── landing-zones.js
├── ground-physics.js
├── service-scene.js
├── ejection.js
├── aircraft-model.js
├── camera-modes.js
├── nuclear-fx.js
├── physics-core.js
└── main.js
```

Module responsibilities:

| Module | Responsibility |
|---|---|
| `sortie-state.js` | explicit sortie states, legal transitions, state snapshots |
| `airport.js` | procedural runway, taxi/service area, hangars, buildings, ground text, lights |
| `landing-zones.js` | runway bounds, valid/invalid surface classification, slope/obstacle reasons |
| `ground-physics.js` | frame-rate independent taxi, takeoff roll, landing roll, automatic gear, envelope checks |
| `service-scene.js` | tanker truck, hose, workers, rearm/maintenance animation, production/test durations |
| `ejection.js` | mayday fall, ejection event, parachute descent, survival/death resolution |
| `aircraft-model.js` | procedural higher-fidelity aircraft geometry, loadout hardpoints, landing gear visuals, visual diagnostics |
| `camera-modes.js` | chase, wide chase, cockpit/nose, flyby/cinematic, orbit/debug, temporary camera overrides |
| `nuclear-fx.js` | pooled procedural flash, fireball, rising plume, mushroom cloud, shockwave, lighting pulse |
| `physics-core.js` | pure math helpers and constants reused by gameplay and tests |
| `main.js` | orchestration only: input, update order, module wiring, debug API integration |

Architecture constraints:

- Keep `processInput`, `update(dt)`, and render/update side effects separated.
- Cap `dt` and keep physics frame-rate independent.
- Keep state transitions explicit; no hidden `playing && !dead && ...` state combinations.
- Expose pure helpers for landing envelope and state policy tests.
- Keep procedural visuals bounded and pooled for browser/headless performance.
- Add debug snapshots for every new system before E2E relies on it.

---

## 6. QA Strategy

The `@qa-engineer` work starts before gameplay implementation.

Required QA surfaces:

```text
tests/aero-fighters/
├── sortie.spec.js
├── landing.spec.js
├── service.spec.js
├── ejection.spec.js
├── camera.spec.js
├── nuclear-fx.spec.js
└── tools/
    └── test-aero-sortie-sim.js
```

Required debug contract additions in `window.__aeroDebug.snapshot()`:

- `sortieState`
- `selectedMap`
- `airport`
- `runwayBounds`
- `landingZoneStatus`
- `groundContact`
- `groundSpeed`
- `verticalSpeed`
- `takeoffEnvelope`
- `landingEnvelope`
- `gearState`
- `serviceState`
- `serviceProgress`
- `ejectionState`
- `pilotState`
- `cameraMode`
- `cinematicCamera`
- `nuclearFxState`
- `missionProgress`
- `missionScore`
- `weaponInventory`
- `airportText`
- `criticalVideoCapture`
- `aircraftVisual`
- `hudLayout`
- `desertLandmarks`

Video-backed scenarios:

- takeoff from airport
- landing on runway
- invalid touchdown or forced crash
- service scene progression
- ejection and parachute descent
- camera cycling in flight
- nuclear cinematic camera and return
- nuclear mushroom cloud/shockwave progression
- airport text and lights during motion, not only static screenshot
- aircraft silhouette/readability across chase, wide, cockpit/nose, flyby, and cinematic views
- HUD readability and non-overlap while landing, servicing, ejecting, and firing the atomic bomb
- desert landmark readability while flying at speed

Video lifecycle:

- Default Playwright config may keep video on failure/retry to control test cost.
- MR critical validation runs must support an explicit video-capture mode, for example `AERO_RECORD_VIDEO=1`, that records video even when tests pass.
- Videos are not regression artifacts to keep forever. They are inspected while fixing rendering/physics bugs, then deleted after the bug is resolved.
- Every resolved video-found bug must leave behind a lighter regression check where practical: unit test, simulation invariant, debug snapshot assertion, or short E2E assertion.

Bug closure policy:

- Reporting a rendering, physics, map, camera, aircraft, or gameplay bug is not a done condition.
- Every confirmed bug must become a tracked TASKS item with:
  - observed evidence
  - suspected root cause
  - intended fix
  - validation command or QA scenario
  - regression guard after the fix
- A bug is closed only after the fix is implemented, the relevant QA passes, and a regression guard exists.
- If a bug cannot be fixed in the current feature scope, it must be explicitly moved to a follow-up spec with reason and risk; it must not be silently left as a known issue.

Commands that must pass before completion:

```bash
npm run validate:aero-map
npm run test:aero:unit
npm run test:aero:sim
TEST_PORT=<free-port> npm run test:aero:e2e
TEST_PORT=<free-port> npm run test:aero:qa
```

The new E2E specs must preserve Playwright video/trace artifacts already configured by the QA hardening work and add the explicit MR video-capture mode described above.

---

## 7. Implementation Phases

### Phase 0 — Architecture Review

Owner: `@software-architect`

Actions:

- Review this module split against current Aero Fighters code.
- Confirm which logic belongs in `physics-core.js`, `ground-physics.js`, and `landing-zones.js`.
- Confirm `main.js` remains orchestration only.
- Approve state transition graph for `sortie-state.js`.
- Record any required adjustment before TASKS are drafted.

Deliverable:

- Architecture notes included in `TASKS.md` or a referenced review report before implementation starts.

### Phase 1 — QA Design First

Owner: `@qa-engineer`

Actions:

- Define Playwright acceptance scenarios before gameplay code changes.
- Define deterministic shortcut inputs/debug helpers for full sortie, service, ejection, and nuclear cinematic validation.
- Define video checkpoints for motion/rendering bugs.
- Extend QA tools only inside `tests/aero-fighters/tools/`.

Deliverable:

- TASKS entries for E2E specs and simulation tools before implementation tasks.

### Phase 2 — Sortie State Machine

Owner: `@game-developer`

Actions:

- Add `sortie-state.js`.
- Implement legal transitions:
  `TAXI_OUT -> TAKEOFF_ROLL -> AIRBORNE/MISSION_ACTIVE -> RETURN_TO_BASE -> LANDING_ROLL -> TAXI_IN -> SERVICE_SCENE -> NEXT_SORTIE_READY`.
- Add mayday/ejection/death branches.
- Add debug snapshot fields.
- Preserve current combat loop until airport phases are wired.

Validation:

- Unit/simulation test verifies legal/illegal transitions and death/survival state policy stubs.

TASKS must include a transition matrix before implementation:

```text
state + event + guard -> nextState
```

Minimum events:

- `taxiStarted`
- `runwayAligned`
- `takeoffSpeedReached`
- `liftoff`
- `targetDestroyed`
- `allRequiredTargetsDestroyed`
- `approachEntered`
- `touchdownSafe`
- `touchdownUnsafe`
- `mountainContact`
- `waterImpact`
- `serviceZoneReached`
- `serviceComplete`
- `criticalDamage`
- `ejectRequested`
- `pilotLanded`
- `aircraftImpact`

### Phase 2.5 — Aircraft Visual Realism Review And Upgrade

Owner: `@game-developer`, reviewed by `@software-architect` and `@qa-engineer`

Actions:

- Review the current procedural aircraft model against the local `aero-fighters/img/` screenshots and Aero Fighters Assault-style requirements.
- Extract or isolate aircraft construction from `player.js` into `aircraft-model.js` if needed to keep `player.js` focused on flight state/physics.
- Improve silhouette readability from gameplay cameras:
  - longer, clearer nose profile
  - wider readable wing planform
  - visible tailplanes/vertical stabilizers
  - canopy that reads as cockpit, not a small dark block
  - visible underside hardpoints/loadout
  - landing gear visual states for taxi/takeoff/landing
  - readable material contrast under day/night/desert lighting
- Preserve the no-external-assets rule: procedural Three.js geometry only.
- Preserve N64-inspired arcade readability, but use current procedural geometry to exceed the current low-detail model.
- Add debug snapshot `aircraftVisual` with approximate mesh count, visible loadout, gear visual state, and current camera readability checkpoint.

Validation:

- Playwright screenshot/video checkpoints show the aircraft clearly in at least Chase, Wide Chase, Flyby/Cinematic, and runway/taxi views.
- QA checks that the plane is not a near-black unreadable silhouette against the sky/terrain in the reference scenarios.
- Mesh/draw-call budget remains acceptable under `npm run test:aero:qa`.

### Phase 3 — Airport On `desert`

Owner: `@game-developer`, reviewed by `@qa-engineer`

Actions:

- Add airport geometry to `desert` only.
- Make `desert` the first/default Mission Realism map once this PLAN is approved.
- Include runway, taxi/service pavement, hangars, support buildings, service zone, runway lights.
- Add roads/paths, desert scale landmarks, and visual silhouettes that help the player understand altitude, speed, and airport approach.
- Add mandatory ground text `AEROPORTO DO TAUAN E DO PAPAI` beside runway.
- Add marker lights around the text.
- Ensure airport surface is collision-safe and terrain-aligned.
- Extend map validation to check airport bounds, text presence, lights, and no floating airport structures.
- Define a concrete airport contract in TASKS: `runway.center`, `heading`, `length`, `width`, `touchdownZone`, `taxiwayBounds`, `serviceZoneBounds`, and airport height/flattening policy.

Validation:

- Map validator passes.
- Playwright video confirms runway/text/lights are visible while moving.
- QA confirms desert landmarks do not vanish, flicker, float, or become unreadable during camera movement.

### Phase 4 — Ground Physics, Takeoff, Landing, Automatic Gear

Owner: `@game-developer`

Actions:

- Add `landing-zones.js` and `ground-physics.js`.
- Implement runway-only valid landing for this slice.
- Implement automatic gear deployment/retraction.
- Implement acceleration, rolling friction, braking, taxi steering, takeoff minimum speed, landing speed/descent envelope.
- Replace instant ground explosion with classified touchdown result.
- Keep invalid mountain/building/water/rough contact unsafe.

Initial behavior choice:

- Safe runway touchdown enters `LANDING_ROLL`.
- Unsafe touchdown enters `MAYDAY` if survivable-looking, otherwise `CRASHED`.
- Mountain contact kicks/bounces the aircraft into burning `MAYDAY`; the aircraft keeps falling until final impact and the player may eject when allowed.
- Building/water/high-speed terrain impact enters `CRASHED`.

Validation:

- Simulation tests cover takeoff below/above threshold and landing safe/unsafe envelopes.
- E2E video covers takeoff and landing.

### Phase 5 — Mission Return, Rearm Rules, Score Rules

Owner: `@game-developer`

Actions:

- Destroying final required target sets `RETURN_TO_BASE`, not instant next mission.
- Add return-to-airport HUD/navigation.
- Redesign Mission Realism HUD presentation toward the Aero Fighters Assault/N64 reference while preserving current game data.
- Add green side ladders or equivalent readable indicators for speed/altitude/landing envelope, central flight/target brackets, larger radar/minimap, weapon stock, runway guidance, gear state, service progress, and ejection prompt.
- Expose `hudLayout` debug diagnostics for overlap/readability checks.
- Disable target-kill weapon rewards.
- Restore bombs/missiles only after service completion or ejection-survival recovery rule.
- On pilot death, reset mission targets/progress/score and do not refill used weapons.
- Change the existing atomic/nuclear bomb action from `N` to `T`.
- Preserve the existing atomic bomb as the weapon being improved; do not add a separate new nuclear weapon unless a later approved clarification requires it.

Validation:

- Simulation tests cover mission completion, weapon inventory, score reset, and enemy respawn rules.
- E2E confirms no weapon refill from kills.
- E2E confirms HUD elements remain readable and do not overlap during normal flight, return-to-base, landing, service, ejection, and nuclear cinematic moments.

### Phase 6 — Refuel/Rearm/Maintenance Scene

Owner: `@game-developer`

Actions:

- Add `service-scene.js`.
- Implement 30-40s production service timeline.
- Implement shortened `testMode=1` timeline: 5 seconds.
- Render tanker truck, hose/connection, workers, missile/bomb replacement, hangar/service context.
- Make tanker trucks and the refuel/rearm process the visual focus of the scene.
- Allow production acceleration/skip only after the service operation is clearly visible, so realism is not skipped by accident.
- Disable player control and damage during service.
- Transition to `NEXT_SORTIE_READY` and then next sortie after service.

Validation:

- Unit/sim verifies duration policy and weapon restoration timing.
- E2E video captures service sequence.

### Phase 7 — Mayday, Ejection, Parachute, Death Policy

Owner: `@game-developer`

Actions:

- Add `ejection.js`.
- When critically damaged, aircraft burns/smokes and falls uncontrolled before impact.
- Add `J` ejection action.
- Unlimited ejection when mayday conditions allow it.
- Render ejection seat/pilot and parachute descent.
- Resolve survival/death explicitly: ejection always survives in this first slice.
- On survival: preserve destroyed targets and restore weapons after recovery/service.
- On death without ejection: reset targets/progress/score and preserve weapon inventory exactly as it is at impact/death time, with no refill.

Validation:

- Unit/sim tests state policy.
- E2E video captures burning fall, ejection, parachute, and restart.

### Phase 8 — Camera Modes And Nuclear Cinematic Camera

Owner: `@game-developer`, reviewed by `@qa-engineer`

Actions:

- Add `camera-modes.js`.
- Implement camera modes:
  Chase, Wide Chase, Cockpit/Nose, Flyby/Cinematic, Orbit/Inspection.
- Add `C` camera-cycle action.
- Add debug snapshot `cameraMode`.
- On player-fired nuclear impact, temporarily switch to cinematic camera showing aircraft and explosion when feasible.
- Return automatically to previous gameplay camera.
- Shorten cinematic duration in `testMode=1`.

Validation:

- E2E verifies camera cycling, control continuity, debug mode reporting, nuclear auto-camera, and return.

### Phase 9 — Nuclear/Large Explosion Realism

Owner: `@game-developer`

Actions:

- Add `nuclear-fx.js`.
- Improve the existing atomic/nuclear bomb effect, now triggered by `T`.
- Implement pooled procedural explosion stages:
  flash, expanding fireball, rising core, stem/plume, mushroom cap, shockwave ring, dust/smoke/debris, lighting pulse, camera shake.
- Make large non-nuclear explosions optionally use reduced version.
- Add headless/test degradation with same diagnostic states.
- Expose `nuclearFxState.stage`, `fireballRadius`, `plumeHeight`, `shockwaveRadius`, `activeParticles`, and `lightPulse` for QA assertions.

Validation:

- E2E/video verifies visible fireball expansion, rising mushroom shape, shockwave, and camera shake.
- FPS/headless QA remains within accepted threshold.

### Phase 10 — Regression, Tuning, Final Reviews

Owners: `@game-developer`, `@qa-engineer`, `@software-architect`

Actions:

- Run full Aero QA suite.
- Inspect MR video-capture artifacts for motion/rendering bugs missed by screenshots, then delete heavy videos once fixes are confirmed and lighter regression checks exist.
- Convert every confirmed rendering/physics/map/camera/aircraft bug into a fix task before completion.
- Tune constants only with test evidence and manual gameplay notes.
- Confirm no target/building/airport floating bugs.
- Confirm HUD does not overlap.
- Confirm architecture boundaries were followed.

Completion criteria:

- All AC-MR-01 through AC-MR-17 pass.
- `npm run test:aero:qa` passes.
- MR critical scenarios were validated with video during the current QA pass, and any persistent regression coverage is represented by lightweight tests/debug assertions rather than retained heavy videos.
- No confirmed bug from this feature remains only reported; each is fixed or explicitly deferred into a new approved spec.
- `@software-architect` review accepts module boundaries.

---

## 8. Risk Controls

| Risk | Mitigation |
|---|---|
| Landing physics becomes frustrating | Start with forgiving envelope, clear HUD feedback, then tune with video/manual review |
| `main.js` grows too large | Add modules first; keep `main.js` as coordinator |
| Headless FPS drops from airport/nuclear FX | Use lower particle counts/geometry in headless while preserving debug state |
| Video QA becomes slow | Use explicit MR video-capture mode only during bug triage/final visual validation; delete heavy videos after fixes and keep lightweight regression tests |
| Airport text becomes unreadable | Validate text placement by camera-distance E2E and video |
| Camera cinematic disrupts control | Store previous camera mode and enforce timed return |
| Death/ejection state becomes inconsistent | Pure state policy tests before E2E |

---

## 9. Deferred Work

These are explicitly not part of this first implementation:

- safe landing/taxi on natural flat terrain outside the airport
- replicating the airport to every existing map
- real external 3D assets or video files
- manual landing gear controls
- full FAA-level flight model

---

## 10. Approval

- [x] Draft reviewed by operator
- [x] **Status:** Aprovado — 2026-05-13 — aprovado pelo operador: "O plan esta aprovado"

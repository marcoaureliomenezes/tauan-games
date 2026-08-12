# SPEC: Aero Fighters Mission Realism

> **Status:** Aprovado
> **Author:** dadaia Labs
> **Created:** 2026-05-13
> **Related:** `specs/features/aero-fighters/SPEC.md`, `specs/features/aero-fighters-qa-hardening/SPEC.md`

---

## 1. Overview

This feature evolves Aero Fighters / Aero Strike from a mission-only air combat loop into a complete sortie simulation:

1. start on the ground at Tauan's airport
2. taxi and take off with realistic minimum-speed constraints
3. fly and complete the combat mission
4. return to a valid landing surface
5. land safely using realistic landing envelope constraints
6. taxi to service area
7. show a 30-40 second in-engine refuel and maintenance scene
8. restore missiles/bombs and continue the next mission

The goal is not a certified flight simulator. The goal is a believable browser game that reproduces the important constraints: runway, landing gear behavior, acceleration, takeoff speed, landing speed, touchdown rate, valid landing surfaces, crash conditions, mission persistence, refuel/rearm/maintenance, and ejection consequences.

This spec also formalizes continuous gameplay improvement: every implementation cycle must include `@game-developer`, `@qa-engineer`, and `@software-architect` responsibilities, and every edit must be validated through the Playwright QA harness created by `aero-fighters-qa-hardening`.

---

## 2. Problem Statement

Current behavior is too arcade and breaks realism:

- any ground touch explodes the aircraft
- there is no takeoff, taxi, landing, runway, or airport loop
- mission completion jumps directly to next mission instead of returning to base
- weapons are replenished by killing targets instead of refuel/rearm service
- the crash/mayday/ejection loop does not yet represent pilot survival and mission-state persistence precisely enough
- visual/rendering bugs can still be missed by static screenshots unless QA uses videos/traces and deterministic scenarios

---

## 3. Goals

- Add a full sortie lifecycle: takeoff -> mission -> return -> landing -> service -> next mission.
- Add realistic enough ground handling, takeoff, landing, and crash rules.
- Add airport infrastructure: runway, airport buildings, hangars, service area, lighting.
- Add mandatory ground text beside runway: `AEROPORTO DO TAUAN E DO PAPAI`.
- Add an in-engine 30-40 second refuel/maintenance/rearm scene with tanker truck and human workers.
- Remove weapon pickup reward from target kills; full weapon restoration happens only through service/rearm.
- Add ejection decision and parachute scene.
- Preserve mission state differently for successful ejection vs pilot death.
- Add multiple aircraft camera views inspired by established flight/action games.
- Add cinematic camera behavior for nuclear strike impact.
- Improve nuclear/large explosions with fireball growth, mushroom cloud, and shockwave behavior.
- Keep the game playable for Tauan: realism must improve feel, not make controls frustrating.
- Require QA validation and architecture review for each implementation slice.

---

## 4. Non-Goals

- No real video files; the service sequence is rendered procedurally in Three.js.
- No external 3D models or image assets.
- No TypeScript/bundler/build step.
- No multiplayer.
- No real-world airport reproduction; the airport is fictional and personal to Tauan.
- No full FAA-level flight model.
- No carrier landing in this iteration.
- No airport replication across every map in this first iteration. The first implementation targets one primary map only; after it is stable, later specs may reproduce it elsewhere.
- No flat-natural-terrain landing in this first iteration. This iteration must support airport/runway landing; flat terrain landing comes later.

---

## 5. Functional Requirements

### FR-01 — Sortie State Machine

Replace the implicit mission loop with an explicit sortie state machine.

Required states:

| State | Meaning |
|---|---|
| `MENU` | Map/start selection |
| `TAXI_OUT` | Aircraft starts on ground near hangar/service area |
| `TAKEOFF_ROLL` | Aircraft accelerates on runway |
| `AIRBORNE` | Normal flight |
| `MISSION_ACTIVE` | Combat mission in progress |
| `RETURN_TO_BASE` | Mission targets complete; player must return and land |
| `LANDING_ROLL` | Aircraft touched down validly and is decelerating |
| `TAXI_IN` | Player taxis to service zone |
| `SERVICE_SCENE` | 30-40 second refuel/rearm/maintenance sequence |
| `NEXT_SORTIE_READY` | Next sortie can start |
| `MAYDAY` | Aircraft burning/falling after being critically hit |
| `EJECTION` | Pilot ejected and parachute descent is active |
| `CRASHED` | Aircraft destroyed |
| `MISSION_FAILED` | Pilot died or unrecoverable state |

The state machine must be explicit and testable. Avoid using only boolean combinations like `running && !dead && !missionFailed`.

### FR-02 — Airport

The first implementation must choose one primary map and add the airport only there. This reduces risk: if airport placement, runway physics, rendering, or QA discovers problems, they can be fixed before duplicating the system to other maps.

The airport area must include:

- runway long enough for takeoff and landing
- taxiway or simple paved route from hangar/service area to runway
- hangars
- airport support buildings
- service/rearm zone
- runway lights
- edge lights or marker lights around the mandatory ground text
- collision-safe flat airport terrain

Mandatory visible text beside the runway:

```text
AEROPORTO DO TAUAN E DO PAPAI
```

Text requirements:

- placed on the ground beside the runway in very large letters
- readable from takeoff/landing camera distance
- surrounded or bordered by visible lights
- must not be hidden by terrain, buildings, fog, or camera framing

### FR-03 — Ground Handling

The aircraft can move on the ground under valid conditions:

- on runway
- on airport taxi/service pavement

Flat natural terrain landing/taxi is approved as future behavior, but is out of scope for this first implementation slice. The first slice must support safe ground movement at the airport only.

The aircraft must not safely roll on:

- mountains
- steep or rough terrain
- buildings/hangars
- water/ocean
- target structures

Ground physics must include:

- wheel contact state
- ground speed
- acceleration under throttle
- braking/airbrake behavior
- steering/yaw at low speed
- friction/rolling resistance
- landing gear contact tolerance

If aircraft touches invalid terrain or obstacle at unsafe conditions, it crashes.

### FR-04 — Takeoff Physics

Takeoff must require:

- aircraft on valid runway or valid flat ground
- throttle above takeoff threshold
- speed above minimum rotation speed
- pitch/rotation input or auto-rotation assist after threshold
- enough runway/flat distance to accelerate

Proposed initial constants, to calibrate during implementation:

| Constant | Initial Value | Meaning |
|---|---:|---|
| `TAKEOFF_MIN_SPEED` | 42 m/s | minimum speed before liftoff |
| `ROTATION_SPEED` | 38 m/s | speed where pitch-up can start lifting nose |
| `GROUND_ACCEL` | 18 m/s² | runway acceleration at full throttle |
| `GROUND_FRICTION` | 4 m/s² | rolling resistance/braking baseline |
| `MIN_LIFTOFF_PITCH` | 0.10 rad | pitch needed for takeoff |

Final values may be adjusted only if tests and gameplay review justify it.

### FR-05 — Landing Physics

Landing must be possible on:

- airport runway

Landing on valid flat ground zones is deferred to a later iteration. This first iteration must make airport runway landing realistic and reliable before expanding the surface model.

Landing must require safe envelope:

- touchdown surface is valid
- vertical descent rate is below maximum
- horizontal speed is below maximum landing speed
- aircraft pitch/roll are within safe limits
- landing gear/contact state is valid

Proposed initial constants:

| Constant | Initial Value | Meaning |
|---|---:|---|
| `LANDING_MAX_SPEED` | 48 m/s | above this is unsafe touchdown |
| `LANDING_MIN_SPEED` | 16 m/s | below this risks stall/hard drop |
| `MAX_TOUCHDOWN_VSPEED` | 8 m/s | maximum safe vertical descent |
| `MAX_TOUCHDOWN_ROLL` | 0.25 rad | maximum safe bank angle |
| `MAX_TOUCHDOWN_PITCH` | 0.35 rad | maximum safe pitch angle |
| `FLATNESS_MAX_SLOPE` | 0.08 | max terrain slope for non-runway landing |

Unsafe touchdown causes crash, bounce, gear collapse, or mayday depending severity. The PLAN must choose the first implementation behavior.

Landing gear behavior:

- landing gear is automatic in this iteration
- gear deploys automatically when approaching runway/landing state and speed/altitude are in landing envelope
- gear retracts automatically after takeoff
- player does not need a manual landing-gear key in this first slice

### FR-06 — Mission Completion Requires Return and Landing

Destroying all required targets no longer instantly advances to the next mission.

After final target is destroyed:

- HUD/overlay changes to `RETORNE AO AEROPORTO`
- navigation marker points to runway/service area
- mission remains active until aircraft lands and reaches service zone
- only after service scene completes does the next sortie begin

### FR-07 — Refuel/Rearm/Maintenance Scene

After successful landing and taxi to service zone, show a 30-40 second in-engine scene.

The scene must include:

- tanker truck approaching or parked near aircraft
- fuel hose or visual connection to aircraft
- human maintenance workers around aircraft
- missile/bomb replacement/rearm sequence
- hangar/service area environment visible
- progress indicator or unobtrusive status text
- camera angles showing the operation clearly

This is not a video file. It is an animated Three.js scene using procedural geometry.

During service:

- player controls are disabled
- aircraft cannot take damage
- weapons are restored to full at completion
- next sortie starts from airport after service

Duration:

- minimum 30 seconds
- maximum 40 seconds
- may be shortened only in `testMode=1` for automated QA, while production duration remains 30-40 seconds

### FR-08 — Rearm Rules

Remove or disable weapon rewards from killing targets.

New rule:

- full bombs/missiles are restored only after successful landing and service completion
- no missile pickup/drop from destroyed targets in normal mission loop
- if existing pickup visuals remain for future use, they must not restore weapons unless explicitly reintroduced by a future spec

### FR-09 — Mayday, Ejection, Pilot Survival

When aircraft is critically damaged by enemy fire or nuclear blast:

- aircraft enters `MAYDAY`
- aircraft remains visible
- fire/smoke effects are visible
- aircraft falls uncontrolled toward ground/water
- player is offered an ejection option

Required control:

| Action | Input | Effect |
|---|---|---|
| Eject | `J` or `Eject` action | Pilot ejects if allowed |

If player ejects:

- canopy/ejection seat effect appears
- pilot descends by parachute
- parachute landing is shown
- if parachute lands in safe area, pilot survives
- game restarts at airport/service state
- weapons are restored to full
- already destroyed enemies/targets remain destroyed
- mission progress is preserved

If player does not eject:

- aircraft impacts ground/water
- pilot dies
- mission state resets according to death rules

### FR-10 — Death vs Survival State Preservation

If pilot ejects and survives:

- destroyed targets remain destroyed
- score/progress remains
- player returns to base with full weapons after recovery/service
- remaining targets stay alive

If pilot dies in crash:

- targets/enemies respawn to mission start
- player returns with the weapon inventory he had before death rules apply; specifically, used bombs/missiles are not restored by death
- mission score resets
- mission progress resets

The implementation must make this state policy explicit and testable.

### FR-11 — Airport/Runway Navigation and HUD

Add HUD/navigation indicators for:

- runway direction
- distance to airport
- landing state: `GEAR/TOUCHDOWN/FAST/STEEP/ROLL`
- safe/unsafe landing envelope
- return-to-base objective
- service progress
- ejection prompt during mayday

HUD must remain readable and not overlap existing mission HUD.

### FR-12 — Camera Views and Cinematic Camera

The game must support multiple aircraft camera views. Current single-view behavior is insufficient for flight, landing, cinematic explosions, and QA review.

Required camera modes:

| Camera Mode | Purpose |
|---|---|
| Chase | Current third-person follow camera; default for normal flight |
| Wide Chase | Farther view for situational awareness, similar to arcade flight games |
| Cockpit/Nose | Forward-looking precision view for runway alignment |
| Flyby/Cinematic | External camera for dramatic pass-by or explosion viewing |
| Orbit/Inspection | Debug/QA-oriented orbit around aircraft or scene |

Controls:

- add camera-cycle action, preferred key `C`
- current camera mode must be visible in debug snapshot
- QA tests must verify camera switching does not break controls or HUD

Nuclear strike cinematic behavior:

- when player-fired nuclear missile impacts a target, camera automatically switches briefly to a cinematic angle
- cinematic angle must show both the player aircraft and the explosion when feasible
- after a short duration, camera returns to the previous gameplay camera
- player should not lose control permanently because of the cinematic camera
- in `testMode=1`, cinematic duration may be shortened for QA

Camera inspiration may come from established aircraft/action games: chase camera, wide chase, cockpit/nose, and flyby views. The PLAN must define exact angles/distances based on current scene scale and playability.

### FR-13 — More Realistic Nuclear and Large Explosions

Nuclear/large explosions are currently too fake and must be improved.

The nuclear explosion must include:

- initial intense flash
- expanding fireball
- rising fireball core
- stem/plume formation
- mushroom cloud shape
- expanding shockwave ring near ground/water
- dust/smoke/debris column
- lighting/color pulse that affects nearby scene perception
- camera shake scaled by distance
- audio/visual timing that makes impact feel heavy

The effect must remain procedural with Three.js primitives/materials; no video files or external particle assets.

Performance requirements:

- use pooling or bounded object counts
- headless/test mode may use lower particle counts while preserving behavior and diagnostics
- QA must validate the effect with video, not only screenshot

Large non-nuclear explosions may reuse a reduced version of this system, but nuclear impact gets the most dramatic treatment.

### FR-14 — Rendering and Map Bug Validation

Every implementation slice must use the existing QA hardening tools:

- deterministic `testMode`
- `window.__aeroDebug`
- map validation
- Playwright trace/screenshot/video
- replay simulation where applicable

New QA diagnostics must cover:

- airport text visibility
- runway and service area render correctly
- landing surface classification
- full takeoff replay
- full landing replay
- service scene progression
- ejection/parachute sequence
- camera mode switching
- nuclear cinematic camera activation and return
- nuclear mushroom cloud/shockwave progression in video
- no target/building floating after airport changes
- no rendering artifact that appears only in video/motion

### FR-15 — Agent Collaboration Requirements

This feature must involve three roles:

#### `@software-architect`

Responsibilities:

- review the state machine design
- review module boundaries before implementation
- prevent `main.js` from becoming a monolith
- check whether landing/ground physics belongs in `physics-core.js`, `player.js`, or new modules
- produce architecture feedback before TASKS implementation starts
- review final implementation against the approved architecture

#### `@game-developer`

Responsibilities:

- implement gameplay, physics, airport visuals, service scene, ejection, and state transitions
- provide gameplay-feel feedback after each playable slice
- tune constants only with test evidence and manual review notes
- preserve browser/no-build-step constraints

#### `@qa-engineer`

Responsibilities:

- define E2E acceptance checks before implementation starts
- add/maintain Playwright scenarios
- inspect trace/video artifacts for rendering/motion bugs
- validate smoothness, no console errors, stable map geometry, and full sortie flow
- block completion if QA scenarios fail

---

## 6. Non-Functional Requirements

### NFR-01 — Playability

Realism must improve the experience, not make the game frustrating. Taxi/takeoff/landing should be learnable by a child with clear feedback.

### NFR-02 — Performance

The feature must preserve:

- existing Aero Fighters smoke tests
- existing QA hardening tests
- headless FPS threshold from current specs

If a realism feature makes headless FPS fail, the PLAN must include scoped headless degradation that does not change normal gameplay.

### NFR-03 — No External Assets

Airport, tanker truck, workers, parachute, runway text, hangars, and service scene must use procedural Three.js geometry/materials.

### NFR-04 — Testability

New logic must expose enough debug data for QA:

- sortie state
- ground contact classification
- runway distance
- takeoff/landing speed envelope
- landing validity reason
- service scene phase/time remaining
- ejection state
- parachute position and landing status

---

## 7. Acceptance Criteria

| ID | Acceptance Criteria | Pass Condition |
|---|---|---|
| AC-MR-01 | Airport renders | Runway, hangars, buildings, service zone, runway lights visible |
| AC-MR-02 | Mandatory text renders | `AEROPORTO DO TAUAN E DO PAPAI` readable beside runway with surrounding lights |
| AC-MR-03 | Takeoff requires speed | Aircraft cannot liftoff below `TAKEOFF_MIN_SPEED`; can liftoff after valid roll |
| AC-MR-04 | Valid landing works | Aircraft lands on runway within speed/descent envelope and does not explode |
| AC-MR-05 | Invalid landing crashes | Aircraft touching mountain/building/water/rough slope crashes or fails safely |
| AC-MR-06 | Full sortie loop | Takeoff -> destroy targets -> return -> land -> service -> next sortie works |
| AC-MR-07 | Service scene | 30-40s production service scene shows tanker, workers, maintenance/rearm |
| AC-MR-08 | Test-mode service shortcut | QA can run service scene faster in `testMode` while production duration remains 30-40s |
| AC-MR-09 | Rearm rule | Weapons refill only after service completion, not on target kill |
| AC-MR-10 | Ejection survival | Ejection shows parachute, preserves destroyed targets, restores weapons after recovery |
| AC-MR-11 | No-ejection death | Pilot death resets mission targets and mission score, and does not grant free weapon refill |
| AC-MR-12 | QA video validation | Playwright captures video/trace for full takeoff, landing, service, and ejection scenarios |
| AC-MR-13 | QA hardening preserved | Existing `npm run test:aero:qa` passes after new scenarios are added |
| AC-MR-14 | Architecture review | `@software-architect` confirms module boundaries/state machine before implementation completion |
| AC-MR-15 | Camera modes | Player can cycle camera modes; debug snapshot reports current mode |
| AC-MR-16 | Nuclear cinematic camera | Player-fired nuclear impact triggers temporary cinematic camera and returns to gameplay camera |
| AC-MR-17 | Nuclear mushroom cloud | Nuclear explosion video shows expanding fireball, rising plume/mushroom cloud, and shockwave |

---

## 8. Proposed Architecture Direction

The formal PLAN must refine this, but the preferred module direction is:

```text
aero-fighters/src/
├── sortie-state.js       ← explicit state machine and transitions
├── ground-physics.js     ← taxi/takeoff/landing/ground-contact helpers
├── airport.js            ← runway, hangars, service zone, Tauan/Papai text
├── service-scene.js      ← tanker truck, workers, maintenance/rearm animation
├── ejection.js           ← ejection seat, parachute, pilot survival
├── camera-modes.js       ← chase/wide/cockpit/flyby/orbit and cinematic camera transitions
├── nuclear-fx.js         ← nuclear mushroom cloud, shockwave, fireball, light pulse
├── landing-zones.js      ← valid/invalid surface classification
└── physics-core.js       ← pure reusable math helpers extended from QA hardening

tests/aero-fighters/
├── sortie.spec.js        ← full sortie E2E
├── landing.spec.js       ← takeoff/landing envelopes
├── service.spec.js       ← refuel/rearm/maintenance scene
├── ejection.spec.js      ← mayday/ejection/death state policy
├── camera.spec.js        ← camera mode switching and nuclear cinematic camera
├── nuclear-fx.spec.js    ← video-backed nuclear explosion progression checks
└── tools/
    └── test-aero-sortie-sim.js
```

`main.js` must remain orchestration only. Avoid putting airport, service, ejection, and landing physics directly into `main.js`.

---

## 9. Required Planning Sequence After Approval

After this SPEC is approved:

1. `@software-architect` reviews state machine/module boundaries and records architecture notes.
2. `@qa-engineer` defines E2E/replay acceptance checks.
3. `@game-developer` reviews gameplay feel and implementation risks.
4. Draft `PLAN.md` with phases and file ownership.
5. After PLAN approval, draft `TASKS.md`.
6. After TASKS approval, implement in slices, running QA after every slice.

---

## 10. Open Questions

These can be decided before or during PLAN:

_(resolved before PLAN)_

- First implementation targets one primary map only.
- First implementation supports airport/runway landing only; flat natural terrain landing comes later.
- On pilot death, mission score and mission progress reset.
- Ejection is unlimited whenever mayday/ejection conditions allow it.
- Landing gear is automatic.

---

## 11. Approval

- [x] Draft reviewed by operator
- [x] **Status:** Aprovado — 2026-05-13 — aprovado pelo operador: "Aprovado"

# TASKS: Aero Fighters Mission Realism

> **Status:** Aprovado
> **SPEC:** `specs/features/aero-fighters-mission-realism/SPEC.md`
> **PLAN:** `specs/features/aero-fighters-mission-realism/PLAN.md`
> **Created:** 2026-05-13

---

## Pre-Implementation Checklist

- [x] SPEC.md with `**Status:** Aprovado`
- [x] PLAN.md with `**Status:** Aprovado`
- [x] TASKS.md with `**Status:** Aprovado`

Approved by operator on 2026-05-13: "Aprovado."

---

## Phase 0 — Architecture And QA Gates

### T00 — Record architecture review gates

- [x] Confirm `main.js` remains orchestration only.
- [x] Confirm new gameplay logic is split into modules, not added inline to `main.js`.
- [x] Confirm state machine, ground physics, aircraft model, camera modes, service scene, ejection, and nuclear FX boundaries.
- [ ] Confirm every implementation slice includes `@game-developer` implementation, `@qa-engineer` validation, and `@software-architect` boundary review when state/physics/camera modules are touched.

**Owner:** `@software-architect`

**Files:** this TASKS file, implementation notes/reports if needed.

### T01 — Define bug closure protocol in TASKS execution

- [ ] Every confirmed rendering/physics/map/camera/aircraft/gameplay bug gets a task or subtask.
- [ ] Each bug task records evidence, suspected cause, fix, validation command/scenario, and regression guard.
- [ ] No bug is closed by report only.
- [ ] If a bug cannot fit this feature, create a follow-up spec candidate with reason/risk.

**Owner:** `@game-developer`, validated by `@qa-engineer`

---

## Phase 1 — QA Harness For Mission Realism

### T02 — Add Mission Realism debug contract

- [ ] Extend `window.__aeroDebug.getSnapshot()` with `sortieState`.
- [ ] Add `selectedMap`, `airport`, `runwayBounds`, `landingZoneStatus`, `groundContact`.
- [ ] Add `groundSpeed`, `verticalSpeed`, `takeoffEnvelope`, `landingEnvelope`, `gearState`.
- [ ] Add `serviceState`, `serviceProgress`, `ejectionState`, `pilotState`.
- [ ] Add `cameraMode`, `cinematicCamera`, `nuclearFxState`.
- [ ] Add `missionProgress`, `missionScore`, `weaponInventory`.
- [ ] Add `airportText`, `criticalVideoCapture`, `aircraftVisual`, `hudLayout`, `desertLandmarks`.

**Files:** `aero-fighters/src/debug.js`, related new modules.

**Verify:** `TEST_PORT=<free-port> npm run test:aero:e2e -- diagnostics.spec.js`.

### T03 — Add explicit MR video capture mode

- [ ] Add an `AERO_RECORD_VIDEO=1` Playwright path or equivalent project/config.
- [ ] Record video on passing MR critical scenarios only when explicitly enabled.
- [ ] Keep default video policy lightweight.
- [ ] Document deletion policy for heavy videos after fixes.

**Files:** `tests/playwright.config.js`, `package.json`, `tests/aero-fighters/*`.

**Verify:** forced MR video run produces videos; normal QA run stays lightweight.

### T04 — Add Mission Realism simulation tool

- [ ] Create `tests/aero-fighters/tools/test-aero-sortie-sim.js`.
- [ ] Cover state machine transitions.
- [ ] Cover takeoff envelope.
- [ ] Cover landing envelope.
- [ ] Cover service duration and refill policy.
- [ ] Cover ejection survival and death inventory policy.
- [ ] Cover no weapon refill on kills.

**Verify:** `node tests/aero-fighters/tools/test-aero-sortie-sim.js`.

### T05 — Add MR E2E specs

- [ ] Create `tests/aero-fighters/sortie.spec.js`.
- [ ] Create `tests/aero-fighters/landing.spec.js`.
- [ ] Create `tests/aero-fighters/service.spec.js`.
- [ ] Create `tests/aero-fighters/ejection.spec.js`.
- [ ] Create `tests/aero-fighters/camera.spec.js`.
- [ ] Create `tests/aero-fighters/nuclear-fx.spec.js`.
- [ ] Add aircraft/HUD/desert readability checks.

**Verify:** `TEST_PORT=<free-port> npm run test:aero:e2e`.

---

## Phase 2 — Sortie State Machine

### T06 — Implement `sortie-state.js`

- [ ] Add explicit state enum.
- [ ] Add transition function with guards.
- [ ] Add transition history/debug data.
- [ ] Keep pure logic importable by Node tests.

**Files:** `aero-fighters/src/sortie-state.js`.

### T07 — Add transition matrix

- [ ] Define `state + event + guard -> nextState`.
- [ ] Cover `taxiStarted`, `runwayAligned`, `takeoffSpeedReached`, `liftoff`.
- [ ] Cover `targetDestroyed`, `allRequiredTargetsDestroyed`.
- [ ] Cover `approachEntered`, `touchdownSafe`, `touchdownUnsafe`, `mountainContact`, `waterImpact`.
- [ ] Cover `serviceZoneReached`, `serviceComplete`.
- [ ] Cover `criticalDamage`, `ejectRequested`, `pilotLanded`, `aircraftImpact`.

**Verify:** unit/sim tests reject illegal transitions.

### T08 — Wire sortie state into runtime

- [ ] Start Mission Realism on `desert`.
- [ ] Start at airport ground state when feature is active.
- [ ] Preserve current combat loop until later phases complete.
- [ ] Expose state in debug snapshot and HUD.

**Files:** `aero-fighters/src/main.js`, `state.js`, `missions.js`, `debug.js`.

---

## Phase 2.5 — Aircraft Visual Realism

### T09 — Extract aircraft model construction

- [ ] Create `aero-fighters/src/aircraft-model.js` or equivalent.
- [ ] Move/organize aircraft geometry builder out of `player.js` if practical.
- [ ] Keep `player.js` focused on physics/state.
- [ ] Preserve current public exports.

**Verify:** existing Aero smoke tests still pass.

### T10 — Upgrade procedural fighter model

- [ ] Improve fuselage/nose silhouette.
- [ ] Improve canopy shape/color/readability.
- [ ] Improve wings and tailplanes visibility.
- [ ] Improve exhaust/nozzle/afterburner.
- [ ] Improve panel/material contrast for day/night/desert.
- [ ] Preserve procedural/no-external-assets rule.
- [ ] Keep mesh/draw-call budget acceptable.

**Verify:** aircraft readability screenshots/video in Chase, Wide, Flyby, runway/taxi views.

### T11 — Add visual loadout and landing gear states

- [ ] Keep light/heavy/nuclear loadout visible enough from gameplay camera.
- [ ] Add automatic landing gear visual state.
- [ ] Show gear deployed during taxi/takeoff roll/landing/service.
- [ ] Show gear retracted in normal flight.
- [ ] Add `aircraftVisual` debug fields.

**Verify:** E2E/debug confirms gear and loadout states.

---

## Phase 3 — Desert Airport And Landmark Map

### T12 — Define airport contract for `desert`

- [ ] Define `runway.center`.
- [ ] Define runway `heading`, `length`, `width`.
- [ ] Define `touchdownZone`.
- [ ] Define `taxiwayBounds`.
- [ ] Define `serviceZoneBounds`.
- [ ] Define airport height/flattening policy.

**Files:** `aero-fighters/src/airport.js`, `landing-zones.js`, `maps/desert.js`.

### T13 — Build airport visuals

- [ ] Add runway.
- [ ] Add taxiway/service pavement.
- [ ] Add hangars.
- [ ] Add airport support buildings.
- [ ] Add service/rearm zone.
- [ ] Add runway lights.
- [ ] Add marker lights around mandatory text.

**Verify:** Playwright video confirms visibility while moving.

### T14 — Add mandatory ground text

- [ ] Render `AEROPORTO DO TAUAN E DO PAPAI` beside runway.
- [ ] Make it readable from takeoff/landing camera distances.
- [ ] Surround/border it with lights.
- [ ] Expose `airportText` diagnostics: bounds, letter count, lights, camera distance.

**Verify:** E2E screenshot/video and debug assertion.

### T15 — Add desert landmarks and readability

- [ ] Add roads/paths for airport approach and scale.
- [ ] Add desert landmarks/silhouettes inspired by reference images.
- [ ] Ensure landmarks do not flicker, vanish, float, or clip during camera movement.
- [ ] Add `desertLandmarks` diagnostics.

**Verify:** MR video pass plus lightweight debug regression.

---

## Phase 4 — Ground Physics, Takeoff, Landing

### T16 — Implement `landing-zones.js`

- [ ] Classify runway/taxiway/service/water/building/mountain/terrain.
- [ ] Make runway authoritative over terrain height inside airport bounds.
- [ ] Return reason codes for invalid contact.
- [ ] Keep pure helpers importable by Node tests.

### T17 — Implement `ground-physics.js`

- [ ] Add wheel contact state.
- [ ] Add ground speed.
- [ ] Add runway acceleration.
- [ ] Add rolling friction/braking.
- [ ] Add low-speed steering/yaw.
- [ ] Add takeoff minimum speed and rotation guard.
- [ ] Add landing speed/descent/pitch/roll envelope.

### T18 — Replace instant ground explosion with classified contact

- [ ] Safe runway touchdown enters `LANDING_ROLL`.
- [ ] Invalid high-speed/building/water impact enters `CRASHED`.
- [ ] Mountain contact kicks/bounces aircraft into burning `MAYDAY`.
- [ ] Aircraft remains visible while falling in `MAYDAY`.

**Verify:** sim + E2E landing/mountain scenarios.

---

## Phase 5 — Mission Return, Rearm, HUD

### T19 — Change mission completion flow

- [ ] Required target destruction enters `RETURN_TO_BASE`.
- [ ] HUD shows `RETORNE AO AEROPORTO`.
- [ ] Navigation points to runway/service area.
- [ ] Next sortie starts only after landing/taxi/service.

### T20 — Enforce rearm rules

- [ ] Disable target-kill missile pickups restoring weapons.
- [ ] Disable nuclear reward every 5 target kills.
- [ ] Restore full current armament only after service or ejection-survival recovery.
- [ ] Full armament means light missiles, heavy missiles, and existing atomic/nuclear bomb stock.
- [ ] No new separate bomb inventory in this slice.

**Verify:** sim/E2E confirms no kill-based refill.

### T21 — Update nuclear key from `N` to `T`

- [ ] Change input binding to `KeyT`.
- [ ] Update HUD labels/tooltips/text references.
- [ ] Update README/spec-derived docs if required.
- [ ] Update tests.

### T22 — Redesign Mission Realism HUD

- [ ] Preserve current data fields.
- [ ] Add Aero Fighters Assault/N64-inspired green flight-combat presentation.
- [ ] Add side speed/altitude or equivalent landing envelope indicators.
- [ ] Add central bracket reticle/readability improvements.
- [ ] Add larger radar/minimap treatment if feasible.
- [ ] Add runway guidance, gear state, service progress, ejection prompt.
- [ ] Add `hudLayout` debug diagnostics.

**Verify:** E2E checks HUD readability/non-overlap in flight, landing, service, ejection, nuclear cinematic.

---

## Phase 6 — Refuel/Rearm/Maintenance Scene

### T23 — Implement `service-scene.js`

- [ ] Add service state/timeline.
- [ ] Production duration path supports 30-40 seconds.
- [ ] `testMode=1` duration is exactly 5 seconds.
- [ ] Pause/timescale behavior is deterministic.
- [ ] Controls/damage disabled during service.

### T24 — Build procedural service visuals

- [ ] Add tanker truck as visual focus.
- [ ] Add fuel hose/connection.
- [ ] Add human maintenance workers.
- [ ] Add missile/bomb replacement/rearm sequence.
- [ ] Show hangar/service context.
- [ ] Allow acceleration/skip only after operation is clearly visible.

**Verify:** video captures beginning/middle/end; sim verifies refill only at completion.

---

## Phase 7 — Mayday, Ejection, Death Policy

### T25 — Implement `ejection.js`

- [ ] Add ejection action `J`.
- [ ] Ejection allowed during mayday conditions.
- [ ] Ejection is unlimited when conditions allow.
- [ ] Show ejection seat/pilot.
- [ ] Show parachute descent and landing.
- [ ] In this slice, ejection always saves the pilot.

### T26 — Implement death/survival state policy

- [ ] Ejection survival preserves destroyed targets/progress.
- [ ] Ejection survival restores full armament after recovery/service.
- [ ] No-ejection death resets targets/progress/mission score.
- [ ] No-ejection death preserves inventory exactly at impact/death time, no refill.

**Verify:** sim and E2E for ejection and no-ejection crash.

---

## Phase 8 — Camera Modes And Nuclear Cinematic

### T27 — Implement `camera-modes.js`

- [ ] Add `Chase`.
- [ ] Add `Wide Chase`.
- [ ] Add `Cockpit/Nose`.
- [ ] Add `Flyby/Cinematic`.
- [ ] Add `Orbit/Inspection`.
- [ ] Define numeric offsets/FOV/lerp for every mode.
- [ ] Add camera cycle action `C`.
- [ ] Expose `cameraMode` in debug snapshot.

### T28 — Add nuclear cinematic camera

- [ ] On player-fired nuclear impact, switch temporarily to cinematic camera.
- [ ] Frame aircraft and explosion when feasible.
- [ ] Return to previous gameplay camera automatically.
- [ ] Shorten cinematic duration in `testMode=1`.
- [ ] Ensure player control is not permanently disrupted.

**Verify:** `camera.spec.js` and MR video capture.

---

## Phase 9 — Nuclear FX And Weapon Feedback

### T29 — Implement `nuclear-fx.js`

- [ ] Improve existing atomic/nuclear bomb, now triggered by `T`.
- [ ] Add initial intense flash.
- [ ] Add expanding fireball.
- [ ] Add rising fireball core.
- [ ] Add plume/stem.
- [ ] Add mushroom cap/cloud.
- [ ] Add expanding shockwave ring.
- [ ] Add dust/smoke/debris.
- [ ] Add lighting pulse and camera shake.
- [ ] Keep bounded/pool-based object counts.

### T30 — Add nuclear FX diagnostics

- [ ] Expose `nuclearFxState.stage`.
- [ ] Expose `fireballRadius`.
- [ ] Expose `plumeHeight`.
- [ ] Expose `shockwaveRadius`.
- [ ] Expose `activeParticles`.
- [ ] Expose `lightPulse`.

**Verify:** automated thresholds plus video review.

### T31 — Improve missile/bomb visual feedback

- [ ] Strengthen light/heavy missile trails.
- [ ] Strengthen nuclear bomb/missile trail.
- [ ] Show launch origin from hardpoints/loadout.
- [ ] Add stronger glow/smoke timing.
- [ ] Keep object counts bounded.

---

## Phase 10 — Final QA, Bug Closure, Reviews

### T32 — Run full QA suite

- [x] `npm run validate:aero-map`
- [x] `npm run test:aero:unit`
- [x] `npm run test:aero:sim`
- [x] `node tests/aero-fighters/tools/test-aero-sortie-sim.js`
- [x] `TEST_PORT=<free-port> npm run test:aero:e2e`
- [x] `TEST_PORT=<free-port> npm run test:aero:qa`

### T33 — Run MR video validation pass

- [x] Takeoff video reviewed.
- [x] Landing video reviewed.
- [x] Service scene video reviewed.
- [x] Ejection video reviewed.
- [x] Camera mode video reviewed.
- [x] Nuclear cinematic/explosion video reviewed.
- [x] Airport text/lights video reviewed.
- [x] Aircraft readability video reviewed.
- [x] Desert landmark/render video reviewed.
- [x] Heavy videos deleted after bug fixes are validated.

### T34 — Close confirmed bugs with fixes

- [x] Every confirmed rendering bug fixed or explicitly moved to follow-up spec.
- [x] Every confirmed map/terrain placement bug fixed or explicitly moved to follow-up spec.
- [x] Every confirmed camera/HUD overlap/readability bug fixed or explicitly moved to follow-up spec.
- [x] Every confirmed aircraft visual bug fixed or explicitly moved to follow-up spec.
- [x] Each fixed bug has a lightweight regression guard where practical.

### T35 — Final role reviews

- [x] `@game-developer` confirms gameplay feel, aircraft readability, camera, service, ejection, nuclear FX.
- [x] `@qa-engineer` confirms E2E, video pass, and regression guards.
- [ ] `@software-architect` confirms module boundaries and no `main.js` monolith regression.

---

## Done Condition

- [ ] AC-MR-01 through AC-MR-17 pass.
- [x] Mission starts on `desert` with airport flow.
- [x] Aircraft model is visibly improved and readable across required camera modes.
- [x] Takeoff, landing, service, ejection, nuclear cinematic, and next sortie flow work.
- [x] Full armament refill rules match approved decisions.
- [x] No confirmed bug remains only reported.
- [x] Full Aero QA passes.
- [x] TASKS checkboxes for implemented work are marked complete.

## Implementation Validation — 2026-05-13

- `TEST_PORT=8096 npm run test:aero:qa` passed: map validation, unit tests, simulation tests, and 35 Playwright E2E tests.
- `AERO_RECORD_VIDEO=1 TEST_PORT=8097 npx playwright test tests/aero-fighters/sortie.spec.js tests/aero-fighters/landing.spec.js tests/aero-fighters/service.spec.js tests/aero-fighters/ejection.spec.js tests/aero-fighters/camera.spec.js tests/aero-fighters/nuclear-fx.spec.js --config=tests/playwright.config.js` passed: 7 MR video-backed scenarios.
- Heavy `.webm` artifacts generated by the video pass were deleted after validation.

---

## Approval

- [x] Draft reviewed by operator
- [x] **Status:** Aprovado — 2026-05-13 — aprovado pelo operador: "Aprovado."

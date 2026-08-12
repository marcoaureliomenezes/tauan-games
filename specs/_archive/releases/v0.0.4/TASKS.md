# TASKS: Aero Fighters QA Hardening

> **Status:** Aprovado
> **SPEC:** `specs/features/aero-fighters-qa-hardening/SPEC.md`
> **PLAN:** `specs/features/aero-fighters-qa-hardening/PLAN.md`
> **Created:** 2026-05-13

---

## Pre-Implementation Checklist

- [x] SPEC.md with `**Status:** Aprovado`
- [x] PLAN.md with `**Status:** Aprovado`
- [x] TASKS.md with `**Status:** Aprovado`

---

## Phase 1 — Deterministic Runtime and Debug API

### T01 — Add deterministic runtime config parser

- [x] Create a small query parser for `testMode`, `seed`, `map`, and `mission`.
- [x] Expose parsed runtime config through game state or a small helper.
- [x] Ensure default player-facing URL behaves exactly as before.

**Files:** `aero-fighters/src/state.js`, `aero-fighters/src/main.js` or a new helper module.

**Verify:** Browser loads normally and with `?testMode=1&seed=qa-001`.

### T02 — Add seeded RNG helper

- [x] Create `aero-fighters/src/rng.js`.
- [x] Implement deterministic string/integer seed support.
- [x] Provide `random()`, `range(min,max)`, `int(min,max)`, and `pick(array)` helpers.
- [x] Keep fallback behavior compatible with production.

**Verify:** Same seed returns the same first 10 values across two imports/runs.

### T03 — Route randomized Aero Fighters behavior through RNG

- [x] Replace direct randomized decisions that affect QA reproducibility with the seeded RNG path.
- [x] Cover target/pickup/flak/ambient random behavior where present.
- [x] Avoid changing constants or gameplay formulas.

**Verify:** Two loads with same seed produce the same initial target diagnostics.

### T04 — Add debug metrics collection

- [x] Track frame count, average FPS, worst frame time, and long-frame count.
- [x] Read renderer stats from Three.js renderer info.
- [x] Keep metrics lightweight and disabled or passive outside test/debug usage.

**Files:** `aero-fighters/src/debug.js`, `aero-fighters/src/main.js`, `aero-fighters/src/scene.js`.

**Verify:** Snapshot includes finite frame and renderer metrics.

### T05 — Implement `window.__aeroDebug`

- [x] Create `aero-fighters/src/debug.js`.
- [x] Implement `getSnapshot()`.
- [x] Implement `getRendererStats()`.
- [x] Implement `getTerrainHeightAt(x, z)`.
- [x] Implement `getNearestGroundSample(x, z)`.
- [x] Implement `getTargetDiagnostics()`.
- [x] Implement `getMapDiagnostics()`.
- [x] Implement `getPhysicsDiagnostics()`.
- [x] Implement `runFixedStep(seconds, dt, inputScript)` if feasible through extracted simulation helpers; otherwise delegate to Phase 3 implementation.
- [x] Implement `setDebugOverlay(enabled)`.
- [x] Attach API in `testMode=1`.

**Verify:** Playwright/console can call `window.__aeroDebug.getSnapshot()` on `?testMode=1`.

### T06 — Add disabled-by-default debug overlay

- [x] Render overlay only when explicitly enabled.
- [x] Show FPS/frame time, draw calls, triangles, player physics, map, seed, mission, and target counts.
- [x] Ensure overlay does not interfere with normal HUD or input.

**Verify:** `window.__aeroDebug.setDebugOverlay(true)` shows overlay; `false` hides it.

---

## Phase 2 — Map Validation

### T07 — Add shared map validation helpers

- [x] Create `aero-fighters/src/map-validation.js`.
- [x] Validate finite coordinates.
- [x] Validate playable bounds.
- [x] Validate valid map/island ownership.
- [x] Validate target grounding within `1.0` world unit.
- [x] Validate duplicate/minimum spacing.
- [x] Validate finite terrain samples.
- [x] Return structured errors with code, map, target id/type, coordinates, expected/actual values.

**Verify:** Unit import can validate an in-memory valid and invalid map case.

### T08 — Add invalid map fixtures

- [x] Create `tests/aero-fighters/fixtures/invalid-map-cases.js`.
- [x] Include at least: floating target, buried target, NaN coordinate, out-of-bounds target, duplicate overlap, invalid map id.

**Verify:** Each fixture triggers at least one expected validation error.

### T09 — Add map validator CLI under tools

- [x] Create `tests/aero-fighters/tools/validate-aero-map.js`.
- [x] Validate only current maps: `rio` and `desert`.
- [x] Validate invalid fixtures in a self-test mode or as part of the command.
- [x] Print actionable errors.
- [x] Exit non-zero on validation failure.

**Verify:** `node tests/aero-fighters/tools/validate-aero-map.js` works.

### T10 — Add npm script for map validation

- [x] Add `validate:aero-map` to `package.json`.

**Verify:** `npm run validate:aero-map`.

---

## Phase 3 — Physics Core and Simulation Tests

### T11 — Extract pure physics helpers

- [x] Create `aero-fighters/src/physics-core.js`.
- [x] Implement timestep clamp helper.
- [x] Implement throttle convergence helper.
- [x] Implement stall detection helper.
- [x] Implement bounded pitch/roll/yaw helper.
- [x] Implement altitude-over-terrain helper.
- [x] Implement terrain collision predicate.
- [x] Implement homing turn-rate/lifetime helper where practical.

**Verify:** Helpers import in Node without requiring DOM/WebGL.

### T12 — Route runtime physics through pure helpers

- [x] Update `player.js` to use relevant physics helpers.
- [x] Update `projectiles.js` to use relevant missile/projectile helpers where practical.
- [x] Preserve existing gameplay behavior.

**Verify:** Existing Aero Fighters smoke tests still list and run.

### T13 — Add physics unit test tool

- [x] Create `tests/aero-fighters/tools/test-aero-unit.js`.
- [x] Use Node built-in `node:test`.
- [x] Test dt clamp, gravity effect, throttle convergence, stall threshold, bounded rotation, terrain altitude, collision predicate, mayday visibility transition, and homing turn limit.

**Verify:** `node tests/aero-fighters/tools/test-aero-unit.js`.

### T14 — Add replay simulation tool

- [x] Create `tests/aero-fighters/tools/test-aero-sim.js`.
- [x] Implement deterministic replay harness with fixed `dt`.
- [x] Add straight flight scenario.
- [x] Add climb/dive/recover scenario.
- [x] Add low island pass scenario.
- [x] Add deliberate terrain crash scenario.
- [x] Add missile lock/hit scenario if supported by extracted helpers.
- [x] Add mission spawn validation for at least three seeds.
- [x] Assert no `NaN`/`Infinity`, valid altitude, bounded speed, stable target grounding, and bounded object counts.

**Verify:** `node tests/aero-fighters/tools/test-aero-sim.js`.

### T15 — Add npm scripts for unit and sim tests

- [x] Add `test:aero:unit`.
- [x] Add `test:aero:sim`.

**Verify:** `npm run test:aero:unit` and `npm run test:aero:sim`.

---

## Phase 4 — Playwright QA Expansion

### T16 — Upgrade Playwright config artifacts

- [x] Enable trace on first retry.
- [x] Enable video on failure/retry.
- [x] Keep screenshots on failure.
- [x] Add HTML reporter while preserving useful terminal output.
- [x] Keep `TEST_PORT` override behavior.

**Files:** `tests/playwright.config.js`.

**Verify:** A forced failing test emits trace, screenshot, and video artifacts.

### T17 — Add Aero Fighters E2E script

- [x] Add `test:aero:e2e` to `package.json`.
- [x] Ensure it runs `tests/aero-fighters/` with the shared config.

**Verify:** `npm run test:aero:e2e -- --list`.

### T18 — Add diagnostics Playwright spec

- [x] Create `tests/aero-fighters/diagnostics.spec.js`.
- [x] Verify debug API availability in `testMode`.
- [x] Verify seeded target layout stability across reloads.
- [x] Verify renderer stats are reported and finite.
- [x] Verify frame metrics include average FPS and worst frame time.
- [x] Verify no console errors during a deterministic 15-second scenario.

**Verify:** `npm run test:aero:e2e -- diagnostics.spec.js`.

### T19 — Add map Playwright spec

- [x] Create `tests/aero-fighters/map.spec.js`.
- [x] Verify all initial mission targets are grounded within `1.0`.
- [x] Verify representative terrain samples are finite.
- [x] Verify current maps `rio` and `desert` expose diagnostics.

**Verify:** `npm run test:aero:e2e -- map.spec.js`.

### T20 — Improve FPS diagnostics without hiding failures

- [x] Keep existing FPS acceptance check.
- [x] Add average FPS, worst frame time, and long-frame count to failure messages or debug snapshot.
- [x] Avoid lowering the existing accepted threshold unless a later approved spec changes it.

**Verify:** FPS failure output includes metrics useful for diagnosis.

---

## Phase 5 — Full QA Command

### T21 — Add full Aero Fighters QA command

- [x] Add `test:aero:qa` to `package.json`.
- [x] Run in order:
  1. `npm run validate:aero-map`
  2. `npm run test:aero:unit`
  3. `npm run test:aero:sim`
  4. `npm run test:aero:e2e`

**Verify:** `npm run test:aero:qa`.

### T22 — Final QA validation

- [x] Run `npm run validate:aero-map`.
- [x] Run `npm run test:aero:unit`.
- [x] Run `npm run test:aero:sim`.
- [x] Run `npm run test:aero:e2e`.
- [x] Run `npm run test:aero:qa`.
- [x] Confirm Playwright failure artifacts include trace, screenshot, and video via forced failure or documented artifact check.
- [x] Confirm `git status --short` contains only intended files.

---

## Done Condition

- [x] `npm run validate:aero-map` passes.
- [x] `npm run test:aero:unit` passes.
- [x] `npm run test:aero:sim` passes.
- [x] `npm run test:aero:e2e` runs existing smoke plus diagnostics/map checks.
- [x] `npm run test:aero:qa` runs the full chain.
- [x] `window.__aeroDebug.getSnapshot()` works in `testMode=1`.
- [x] Playwright failure artifacts include trace, screenshot, and video.

---

## Approval

- [x] Draft reviewed by operator
- [x] **Status:** Aprovado — 2026-05-13 — aprovado pelo operador: "Tasks aprovadas."

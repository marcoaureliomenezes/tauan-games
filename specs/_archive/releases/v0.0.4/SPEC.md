# SPEC: Aero Fighters QA Hardening

> **Status:** Aprovado
> **Author:** dadaia Labs
> **Created:** 2026-05-13
> **Related:** `specs/features/aero-fighters/SPEC.md`, `specs/features/testing-infra/SPEC.md`

---

## 1. Overview

This feature turns Aero Fighters / Aero Strike QA from smoke testing into a reliable engineering harness for debugging and improving map correctness, rendering, and flight physics.

The immediate problem is that the current Playwright suite can say whether broad acceptance criteria pass, but it does not explain enough when the world is wrong. Reported symptoms include:

- targets or enemies appearing above the ground
- bad terrain/map placement
- rendering failures that are hard to diagnose from a single screenshot
- physics that does not reproduce believable aircraft behavior
- flaky or misleading FPS checks in headless Chromium

This spec covers the first four hardening steps requested by the operator:

1. deterministic seed plus a test/debug API
2. map, terrain, and enemy/target validation
3. physics unit and replay simulation tests
4. Playwright trace/reporting upgrade for `@qa-engineer` validation

This is QA and instrumentation work first. It must not redesign gameplay, add new player-visible features, or replace Three.js.

---

## 2. Goals

- Give `@qa-engineer` enough observability to diagnose failures without manually opening the game first.
- Make map and target placement testable without a browser.
- Make flight physics testable with deterministic simulation.
- Preserve the no-build-step browser game architecture.
- Keep tests efficient enough to run frequently during game development.
- Make future physics/map fixes measurable before and after implementation.

---

## 3. Non-Goals

- No TypeScript migration.
- No bundler, Vite, Webpack, or build step.
- No external art/model/terrain assets.
- No migration from Three.js to Babylon/Godot/Unity.
- No new campaign content or playable aircraft.
- No full aerodynamic simulator with real-world classified/advanced flight-model fidelity.
- No replacement of Playwright; Playwright remains the E2E acceptance runner.

---

## 4. Functional Requirements

### FR-01 — Deterministic Runtime Mode

Aero Fighters must support a deterministic test mode enabled by query string or environment-driven test URL.

Required entry points:

- `?testMode=1`
- `?seed=<integer-or-string>`
- `?map=<map-id>` when multiple maps exist
- `?mission=<number>` when applicable

When `testMode=1`:

- random decisions must use a seeded RNG instead of `Math.random()` directly
- target placement, ambient effects, pickups, flak, and any randomized map detail must be reproducible for the same seed
- nonessential visual noise may be disabled if it makes screenshots or frame metrics unstable
- gameplay state must still follow the same production code paths unless explicitly marked as test-only instrumentation

Acceptance expectation: loading the same URL twice with the same seed yields the same target layout, terrain heights, and initial player state.

### FR-02 — `window.__aeroDebug` Test API

The game must expose a debug/test API in development and test mode:

```js
window.__aeroDebug = {
  version: 1,
  getSnapshot(),
  getRendererStats(),
  getTerrainHeightAt(x, z),
  getNearestGroundSample(x, z),
  getTargetDiagnostics(),
  getMapDiagnostics(),
  getPhysicsDiagnostics(),
  runFixedStep(seconds, dt, inputScript),
  setDebugOverlay(enabled),
}
```

Required snapshot fields:

- player position, velocity, pitch, roll, yaw, speed, throttle, altitude above terrain, stalled/dead flags
- camera position and target
- target positions, type, hp, island/map id, grounded status, and height error
- active projectiles and missiles counts
- map id, seed, mission/cycle, loaded chunks or island count
- renderer stats: draw calls, triangles, geometries, textures
- frame metrics: average FPS, worst frame time, long-frame count

The API is a test contract, not player-visible UI. It may be attached only when `testMode=1`, but Playwright must be able to use it.

### FR-03 — Map and Terrain Validator

Add a fast Node-based validator that runs without launching Chromium.

Required command:

```bash
npm run validate:aero-map
```

The validator must fail on:

- target/enemy `x`, `y`, `z` as `NaN` or `Infinity`
- targets outside playable world bounds
- targets not associated with a valid island/map region
- targets floating above terrain beyond tolerance
- targets buried below terrain beyond tolerance
- AA guns or military structures spawning in invalid terrain
- duplicate or overlapping target placements below minimum spacing
- terrain height functions returning invalid values for sampled points
- map definitions with missing ids, invalid bounds, or impossible dimensions

The validator must print actionable failure messages with target id/type/map/coordinates and measured terrain delta.

Scope for this first cycle: validate only the current Aero Fighters maps, `rio` and `desert`. Future maps must be covered by a later spec/update after the current improvements are evaluated.

Grounding tolerance: a target is considered correctly grounded when its measured height delta from terrain is within `1.0` world unit.

### FR-04 — Physics Unit Tests

Add fast deterministic physics tests that do not require a browser.

Required command:

```bash
npm run test:aero:unit
```

Minimum coverage:

- fixed timestep integration clamps large `dt`
- gravity affects vertical velocity consistently
- throttle converges toward target rate
- stall flag follows speed threshold
- pitch/roll/yaw rates are bounded by config
- altitude above terrain uses the same height function as collision
- terrain collision triggers only when the aircraft intersects rendered ground plus configured buffer
- mayday/crash transition preserves visible aircraft until impact conditions
- missile/projectile lifetime and homing turn-rate limits are deterministic

Physics code may need small extraction into pure modules to make this possible. Extraction must preserve browser runtime behavior.

### FR-05 — Replay Simulation Tests

Add replay/scenario tests that run fixed input scripts against deterministic game logic.

Required command:

```bash
npm run test:aero:sim
```

Minimum scenarios:

- straight flight at stable throttle for 10 seconds
- climb, dive, and recover without false terrain collision
- low pass over a known island without invisible mountain collision
- deliberate terrain crash at a known coordinate
- missile lock and hit on a deterministic target
- full mission spawn validation under at least three seeds

Each replay must assert invariants, not just final values:

- no `NaN` or `Infinity`
- no target floats or sinks during simulation
- player altitude remains coherent with terrain samples
- speed stays within configured physical bounds
- no unbounded object growth in projectiles, effects, or targets

### FR-06 — Playwright Trace and Report Upgrade

Upgrade Playwright config and scripts for useful `@qa-engineer` triage.

Required:

- trace recording on first retry
- HTML report support
- screenshot on failure
- video recording on failure or retry, because rendering/motion bugs are not always visible in static screenshots
- console error capture preserved in failure output
- test-specific artifact names for Aero Fighters
- dedicated script for Aero Fighters E2E:

```bash
npm run test:aero:e2e
```

Optional but allowed:

- headed debug script for local manual QA

### FR-07 — Aero Fighters E2E Expansion

The existing 18 Playwright ACs remain required. Add `@qa-engineer` E2E checks for diagnostics and world correctness:

- debug API is available in test mode
- deterministic seed produces stable target layout
- all initial targets are grounded within tolerance
- terrain height samples are finite across representative map points
- renderer stats stay below configured thresholds for draw calls and triangles
- frame metric test reports average FPS and worst frame time, not only pass/fail FPS
- no console errors during a deterministic 15-second scenario
- screenshot smoke for fixed camera/map scene

### FR-08 — Debug Overlay

Add a debug overlay toggled by `window.__aeroDebug.setDebugOverlay(true)` or a test-only key.

Overlay must be disabled by default for players.

Overlay should display:

- FPS / average frame time / worst frame time
- draw calls / triangles / active textures/geometries
- player speed, throttle, altitude above terrain, pitch/roll/yaw
- current map, seed, mission, target count
- optional visual helpers: target labels, terrain sample ray, hit radius markers, map/chunk boundaries

The overlay must not be required for assertions; tests should read structured debug data.

---

## 5. Non-Functional Requirements

### NFR-01 — Test Runtime

Target runtime on a local machine:

- map validator: under 2 seconds
- unit tests: under 5 seconds
- replay simulation tests: under 15 seconds
- Aero Fighters Playwright E2E: under 120 seconds

### NFR-02 — Determinism

All non-visual tests must be deterministic. A failed validator/unit/sim test must reproduce on the next run with the same seed.

### NFR-03 — No Build Step

All implementation must remain compatible with static browser serving through `python3 -m http.server`.

Node scripts may be used for tests and validators, but game runtime must not require bundling.

### NFR-04 — Offline Runtime

Tests must not require external network after dependencies and Playwright browser installation are already present.

### NFR-05 — QA Ergonomics

Failures must explain what broke:

- map failures include coordinates and expected vs actual terrain height
- physics failures include timestep, inputs, and measured values
- Playwright failures include trace/screenshot/report artifact locations

---

## 6. Acceptance Criteria

| ID | Test | Pass Condition |
|---|---|---|
| AC-QA-01 | Deterministic seed | Same seed produces same initial target layout and terrain samples across two loads |
| AC-QA-02 | Debug API | `window.__aeroDebug.getSnapshot()` returns player, map, target, renderer, and frame metrics |
| AC-QA-03 | Map validator | `npm run validate:aero-map` exits 0 on valid maps and reports actionable errors on injected invalid fixtures |
| AC-QA-04 | Physics unit tests | `npm run test:aero:unit` passes deterministic physics coverage |
| AC-QA-05 | Replay simulation | `npm run test:aero:sim` passes required scenarios with no invalid numeric state |
| AC-QA-06 | Grounded targets | Playwright verifies all initial mission targets are within terrain tolerance |
| AC-QA-07 | Renderer diagnostics | Playwright reports draw calls, triangles, geometries, and textures in Aero Fighters diagnostics |
| AC-QA-08 | Trace/report upgrade | A failing Playwright retry produces trace and screenshot artifacts |
| AC-QA-09 | Existing smoke suite preserved | Existing 18 Aero Fighters ACs still run through `npm run test:aero:e2e` |
| AC-QA-10 | Full QA command | `npm run test:aero:qa` runs validator, unit, sim, and E2E checks in order |

---

## 7. Proposed File Layout

```
tests/aero-fighters/
├── smoke.spec.js             ← existing ACs, preserved
├── diagnostics.spec.js       ← debug API, renderer stats, deterministic seed
├── map.spec.js               ← grounded targets and terrain samples via Playwright
├── fixtures/
│   └── invalid-map-cases.js  ← injected validator failure cases
└── tools/
    ├── validate-aero-map.js
    ├── test-aero-unit.js
    └── test-aero-sim.js

aero-fighters/src/
├── debug.js                  ← window.__aeroDebug and debug overlay wiring
├── rng.js                    ← seeded RNG helpers
├── physics-core.js           ← pure physics helpers extracted from player/projectile logic
└── map-validation.js         ← shared validation helpers usable by browser and Node
```

All QA tooling scripts for this feature must live under `tests/aero-fighters/tools/`, not root `scripts/`.

---

## 8. QA Engineer Responsibilities

The `@qa-engineer` owns:

- acceptance criteria for the new E2E diagnostics
- Playwright trace/report configuration validation
- failure artifact review process
- ensuring failures are reproducible and actionable
- final E2E validation after `@game-developer` implements instrumentation and physics/map fixes

The `@game-developer` owns:

- game runtime instrumentation
- deterministic seed support
- physics extraction if needed
- map/terrain correctness fixes
- preserving player-facing gameplay

---

## 9. Open Questions

_(resolved before PLAN)_

- QA tooling scripts live under `tests/aero-fighters/tools/`.
- Grounded-target tolerance is `1.0` world unit.
- Playwright records video on failure/retry.
- First implementation targets only current maps: `rio` and `desert`.

---

## 10. Approval

- [x] Draft reviewed by operator
- [x] **Status:** Aprovado — 2026-05-13 — aprovado pelo operador: "aprovado, meu caro"

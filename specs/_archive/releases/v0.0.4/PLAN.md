# PLAN: Aero Fighters QA Hardening

> **Status:** Aprovado
> **SPEC:** `specs/features/aero-fighters-qa-hardening/SPEC.md`
> **Created:** 2026-05-13

---

## 1. Implementation Strategy

Build the QA hardening path in four layers, matching the approved SPEC:

1. deterministic runtime and debug API
2. map/terrain/target validator
3. physics unit and replay simulation tests
4. Playwright trace/report/video E2E expansion

The key design choice is to extract small pure helpers from game runtime code without adding a build step. Browser modules stay as plain ES modules. Node QA tools under `tests/aero-fighters/tools/` may import shared pure modules from `aero-fighters/src/`.

---

## 2. Decisions

| Decision | Choice | Reason |
|---|---|---|
| Tooling location | `tests/aero-fighters/tools/` | Operator preference; keeps QA tooling scoped to Aero Fighters |
| Terrain tolerance | `1.0` world unit | Operator decision; strict enough to catch visible floating/burying |
| Video artifacts | Enabled on failure/retry | Rendering/motion bugs are not always visible in screenshots |
| Map scope | Current maps only: `rio`, `desert` | Evaluate improvement before defining future-map contract |
| Test runner for unit/sim | Node built-in `node:test` | No extra dependency, fast, works with ES modules |
| Deterministic RNG | Local seeded RNG module | Removes direct `Math.random()` dependence in test mode |
| Playwright artifacts | trace + screenshot + video + HTML report | Useful for `@qa-engineer` triage |

---

## 3. Phases

### Phase 1 — Deterministic Runtime and Debug API

Files:

- `aero-fighters/src/rng.js`
- `aero-fighters/src/debug.js`
- `aero-fighters/src/main.js`
- `aero-fighters/src/state.js`
- any module currently using random behavior

Work:

- Parse `testMode`, `seed`, `map`, and `mission` from query string.
- Add seeded RNG helper.
- Route randomized game decisions through the RNG where needed.
- Add `window.__aeroDebug` in test mode.
- Expose structured snapshots: player, map, targets, renderer stats, frame metrics.
- Add a disabled-by-default debug overlay toggled through debug API.

Verification:

- Browser load with `?testMode=1&seed=qa-001`.
- `window.__aeroDebug.getSnapshot()` returns required fields.
- Two loads with same seed return same target layout.

### Phase 2 — Shared Map Validation

Files:

- `aero-fighters/src/map-validation.js`
- `aero-fighters/src/world.js`
- `aero-fighters/src/targets.js`
- `aero-fighters/src/maps/rio.js`
- `aero-fighters/src/maps/desert.js`
- `tests/aero-fighters/tools/validate-aero-map.js`
- `tests/aero-fighters/fixtures/invalid-map-cases.js`
- `package.json`

Work:

- Create pure map validation helpers.
- Validate only `rio` and `desert`.
- Check finite coordinates, world bounds, valid map/island ownership, duplicate spacing, and terrain height.
- Check target grounding with tolerance `1.0`.
- Add invalid fixtures to prove validator catches failures.
- Add `npm run validate:aero-map`.

Verification:

- `npm run validate:aero-map` exits 0 on current valid maps.
- Injected invalid fixtures fail with actionable messages.

### Phase 3 — Physics Core and Replay Simulation

Files:

- `aero-fighters/src/physics-core.js`
- `aero-fighters/src/player.js`
- `aero-fighters/src/projectiles.js`
- `aero-fighters/src/config.js`
- `tests/aero-fighters/tools/test-aero-unit.js`
- `tests/aero-fighters/tools/test-aero-sim.js`
- `package.json`

Work:

- Extract pure helpers for timestep clamp, throttle convergence, stall detection, bounded rotation, altitude over terrain, terrain collision, and homing turn limits.
- Preserve existing browser behavior while routing through helpers.
- Add Node unit tests with `node:test`.
- Add deterministic replay tests for straight flight, climb/dive/recover, low island pass, deliberate terrain crash, missile hit, and mission spawn validation.
- Add `npm run test:aero:unit` and `npm run test:aero:sim`.

Verification:

- `npm run test:aero:unit` passes.
- `npm run test:aero:sim` passes.
- Tests fail deterministically if invalid numeric state or target floating is injected.

### Phase 4 — Playwright QA Expansion

Files:

- `tests/playwright.config.js`
- `tests/aero-fighters/smoke.spec.js`
- `tests/aero-fighters/diagnostics.spec.js`
- `tests/aero-fighters/map.spec.js`
- `package.json`

Work:

- Add trace on first retry.
- Add video on failure/retry.
- Keep screenshot on failure.
- Add HTML reporter support while preserving list output for terminal.
- Add deterministic test URL helper.
- Add diagnostics E2E specs:
  - debug API available
  - stable seeded target layout
  - targets grounded within `1.0`
  - finite terrain samples
  - renderer stats reported and below thresholds
  - frame metrics include average FPS and worst frame time
  - no console errors over deterministic 15-second scenario
- Add `npm run test:aero:e2e`.

Verification:

- `npm run test:aero:e2e` runs existing smoke plus diagnostics/map specs.
- Failing retry creates trace, screenshot, and video artifacts.
- Existing 18 Aero Fighters ACs still run.

### Phase 5 — Full QA Command

Files:

- `package.json`
- optional helper under `tests/aero-fighters/tools/`

Work:

- Add `npm run test:aero:qa`.
- Command order:
  1. `npm run validate:aero-map`
  2. `npm run test:aero:unit`
  3. `npm run test:aero:sim`
  4. `npm run test:aero:e2e`

Verification:

- `npm run test:aero:qa` runs the complete path.

---

## 4. Risk Management

| Risk | Mitigation |
|---|---|
| Debug API changes player behavior | Only expose instrumentation; keep production paths unchanged |
| RNG refactor changes gameplay feel | Route only randomized decisions; keep constants and formulas unchanged |
| Unit extraction causes module cycles | Extract small pure functions with no Three.js dependency when possible |
| Playwright videos slow E2E | Enable only on failure/retry |
| Existing FPS test remains flaky | Report average FPS and worst frame time; keep threshold but improve diagnostics |
| Map validation blocks current known bugs | That is expected; failures become actionable tasks during implementation |

---

## 5. QA Engineer Validation Protocol

`@qa-engineer` validates this feature by:

1. Running `npm run test:aero:qa`.
2. Inspecting Playwright artifacts from at least one forced failure.
3. Confirming map failures include coordinates and height deltas.
4. Confirming replay tests are deterministic across two consecutive runs.
5. Confirming debug snapshots contain enough state to diagnose flying targets, invisible collision, and rendering/performance issues.

---

## 6. Done Condition

The feature is complete when:

- `npm run validate:aero-map` passes for `rio` and `desert`.
- `npm run test:aero:unit` passes.
- `npm run test:aero:sim` passes.
- `npm run test:aero:e2e` runs existing smoke plus new diagnostics/map checks.
- `npm run test:aero:qa` runs the full chain.
- Playwright failure artifacts include trace, screenshot, and video.
- `window.__aeroDebug.getSnapshot()` exposes the required QA state in test mode.

---

## 7. Approval

- [x] Draft reviewed by operator
- [x] **Status:** Aprovado — 2026-05-13 — aprovado pelo operador: "aprovado"

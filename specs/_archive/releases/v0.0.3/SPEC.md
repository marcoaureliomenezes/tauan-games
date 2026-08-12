# SPEC: Testing Infrastructure — Playwright Quality Gates

> **Status:** [x] Approved
> **Author:** dadaia Labs
> **Created:** 2026-05-09

---

## 1. Overview

Mandatory automated testing layer that runs against every game before the operator opens a browser. The primary problem this solves: games previously shipped in a broken state — not functional, not playable — and the operator only discovered this by opening the browser themselves.

This spec establishes Playwright as the quality gate between "AI says the task is done" and "human reviews the game."

**Rule:** No implementation task for any game is considered complete until its Playwright smoke suite passes fully.

---

## 2. Problem Statement

| Symptom observed | Root cause | This spec fixes it by |
|---|---|---|
| Game opens with blank canvas | JS error on load, silently breaks | AC: zero console errors test |
| Controls don't respond | Event listener not wired | AC: keyboard input test verifies state change |
| Score never shows | DOM element missing or logic bug | AC: score increment test |
| Game crashes after 10 seconds | Memory leak or unhandled exception | AC: FPS + error test over 10s window |
| Operator can't tell if game is "working" before opening | No automated check | Full test suite as pre-review gate |

---

## 3. Tooling

### Playwright
- Version: latest stable (`@playwright/test`)
- Browser: Chromium (headless by default; `--headed` for visual debugging)
- Test files served via a local static HTTP server (started as part of test setup)

### Static server
- Tool: `npx serve` or `python3 -m http.server` started as a `globalSetup` in `playwright.config.js`
- Each game served at: `http://localhost:8080/<game-folder>/index.html`

### Directory structure
```
tests/
├── playwright.config.js          ← shared config, baseURL, browser, retries
├── globalSetup.js                ← starts static file server before tests
├── globalTeardown.js             ← stops server after tests
├── trex/
│   └── smoke.spec.js             ← T-Rex acceptance criteria (AC-1 through AC-8)
├── aero-fighters/
│   └── smoke.spec.js             ← Aero Fighters acceptance criteria (AC-1 through AC-8)
└── screenshots/                  ← reference screenshots saved on first pass
    ├── trex-start.png
    ├── trex-gameplay.png
    ├── trex-gameover.png
    ├── aero-start.png
    ├── aero-gameplay.png
    └── aero-gameover.png
```

---

## 4. Functional Requirements

### FR-01 — Smoke Suite per Game
Each game has a `smoke.spec.js` that tests the acceptance criteria listed in that game's SPEC.md. Tests must be independent (no shared state between tests).

> **Backfill 2026-05-11:** Aero Fighters expanded to **18 ACs** covering throttle, stall, inverted pitch, mission targets, heavy missile, barrel roll survivability and headless FPS threshold (≥15). T-Rex continua em 8 ACs.

### FR-02 — Load Tests
- Navigate to game URL
- Assert canvas element exists with width > 0
- Assert zero `console.error` calls during a 5-second observation window
- Take a screenshot named `<game>-start.png`

### FR-03 — Input Tests
- Simulate keyboard events using Playwright's `page.keyboard.press()`
- Assert observable state change (DOM value change, or exposed `window.game` state)
- Each game must expose its state via `window.game` object for testability:
  - `window.game.player` — player state (position, HP, dead flag)
  - `window.game.score` — current score as number
  - `window.game.running` — boolean: game loop is active

### FR-04 — State Tests
- Score increment: wait 3s after start, assert `window.game.score > 0`
- Death/game-over: set `window.game.player.dead = true` (or `lives = 0`) via `page.evaluate()`, assert overlay appears
- High score persistence: complete a game run, reload, assert persisted value present in DOM

### FR-05 — FPS Test
- Inject a frame counter via `page.evaluate()` that hooks into `requestAnimationFrame`
- Measure average FPS over a window (10s para T-Rex, 8s para Aero Fighters)
- Assert average FPS ≥ minimum threshold:
  - **55 FPS over 10s** para T-Rex (2D, leve)
  - **15 FPS over 8s** para Aero Fighters (3D PBR + skybox + sombras + tracers em headless chromium com software rendering — NFR-01 da aero-fighters SPEC mantém ≥45 como requisito de hardware real com GPU)

### FR-06 — Visual Snapshots
- Take screenshots at: start screen, mid-gameplay (after 5s), game-over screen
- Save to `tests/screenshots/` as reference images
- On subsequent runs, compare against references with 5% pixel difference tolerance

### FR-07 — CI-Friendly Output
- All tests output TAP/JUnit format (Playwright default)
- Exit code 0 = all passed, non-zero = failure
- Failure messages include the failing AC ID (e.g., "AC-4 failed: score did not increment")

---

## 5. Non-Functional Requirements

### NFR-01 — Speed
- Full suite (both games) must complete in < 90 seconds
- Tests must not depend on arbitrary `sleep()` calls — use `waitForFunction()` for state assertions

### NFR-02 — No External Network
- Tests run fully offline (local server + CDN already cached in game files)
- Playwright should be configured with `offline: false` but games must not require live network at test time

### NFR-03 — Developer Ergonomics
- Single command to run all tests: `npm test` (or `npx playwright test`)
- Single command to run one game's tests: `npx playwright test tests/trex/`
- Headed mode for debugging: `npx playwright test --headed`

---

## 6. Acceptance Criteria (for this spec itself)

| ID | Test | Pass Condition |
|---|---|---|
| AC-T1 | `npm test` runs without setup errors | Static server starts, both game URLs respond 200 |
| AC-T2 | T-Rex smoke suite passes | All 8 T-Rex ACs pass (see tauan-trex SPEC) |
| AC-T3 | Aero Fighters smoke suite passes | **All 18 Aero Fighters ACs pass** (see aero-fighters SPEC §5; expandido de 8 durante backfill 2026-05-11) |
| AC-T4 | Screenshots are saved | `tests/screenshots/` contains 6 PNG files after first run |
| AC-T5 | FPS test catches bad perf | Artificially throttling `requestAnimationFrame` to 30 FPS causes FPS test to fail |

---

## 7. Files to Create

```
tests/playwright.config.js
tests/globalSetup.js
tests/globalTeardown.js
tests/trex/smoke.spec.js
tests/aero-fighters/smoke.spec.js
package.json                     ← { "scripts": { "test": "playwright test" }, devDependencies: { "@playwright/test": "^1.44" } }
```

---

## 8. Required `window.game` Contract

All games implementing against this testing spec MUST expose:

```js
window.game = {
  running: Boolean,             // true when game loop is active
  score: Number,                // current score
  projectiles: Array,           // active projectile objects; AC-10 (Aero Fighters) checks .length
  targets: Array,               // active static targets (Aero Fighters); AC-12 checks .length and types
  enemies: Array,               // alias de `targets` para compat com tests legados — mesma referência
  kills: Number,                // cumulative kill count
  cycle: Number,                // difficulty loop counter, starts at 1 (Aero Fighters)
  targetsTotal: Number,         // total targets spawnados na missão atual (Aero Fighters)
  targetsDestroyed: Number,     // contador de alvos destruídos na missão atual (Aero Fighters)
  islands: Array,               // 12 ilhas fixas {cx, cz, radius, peakHeight} (Aero Fighters)
  player: {
    x: Number,                  // NOTE: always fixed in T-Rex (world scrolls, not player); meaningful in Aero Fighters
    y: Number,                  // vertical position; changes on jump (T-Rex) or pitch (Aero Fighters)
    pitch: Number,              // current pitch angle in radians (Aero Fighters); AC-4/AC-5 checks this
    dead: Boolean,              // set to true to trigger game over (for test injection)
    lives: Number,              // Aero Fighters: 0–3. T-Rex: always 1 (uses dead flag instead)
    missiles: Number,           // light missile stock 0–100 (Aero Fighters); AC-3 checks initial value
    heavyMissiles: Number,      // heavy missile stock 0–10 (Aero Fighters)
    speed: Number,              // current speed in m/s (Aero Fighters); AC-8/AC-9/AC-14 check this
    throttle: Number,           // throttle 0..1 (Aero Fighters); AC-8/AC-9 check this
    stalled: Boolean,           // true quando speed ≤ STALL_SPD (Aero Fighters); AC-14 checks this
  },
  flags: {                      // optional — Aero Fighters expõe paused, missionFailed, invincibility, shakeTime, crashFreezeTime
    paused: Boolean,
    missionFailed: Boolean,
    // ... outros flags game-specific
  },
}
```

This is a test contract, not production API. Games may expose more but must expose at least the above. `enemies` é alias de `targets` em Aero Fighters — mesma referência de array, compartilham push/splice.

---

## 9. Approval

- [x] Draft reviewed by operator
- [x] **Status:** [x] Approved — 2026-05-09
- [x] **Status:** [x] Approved — 2026-05-11 — Backfill aprovado pelo operador. Suite Playwright verificada: 26/26 ACs passando, FPS ≥15 headless confirmado. Ver `.dadaia/reports/refine-specs.md`.

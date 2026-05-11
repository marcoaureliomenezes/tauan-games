# Architect Review — tauan-games
**Date:** 2026-05-11
**Author:** architect-code-audit (Claude Sonnet 4.6)
**Scope:** Full repository — all games, testing infrastructure, SDD specs

---

## Executive Summary

- Both shipped games (Tauan T-Rex and Aero Strike / aero-fighters) are fully implemented, pass their Playwright smoke suites (8 and 18 ACs respectively), and are playable offline with zero external network dependencies at runtime.
- Aero Strike underwent a significant concept pivot during implementation (N64 air-combat arcade to F-35 ground-strike sim), creating spec drift that was identified and remediated via a `dadaia-grill-me` + `dadaia-refine-specs` session on 2026-05-11; the updated specs are in `[ ] In Review` pending operator promotion.
- The testing infrastructure is the strongest architectural asset: a well-designed Playwright suite with `window.game` test contracts, offline static server, and per-game AC isolation — allowing CI-style automated verification before operator review.
- The primary technical debt is a stale `AGENTS.md` at the repo root (unfilled placeholders) and a security spec (`specs/security/SPEC.md`) that remains in Draft status with no PLAN, TASKS, or implementation — no CI, no secret scanning, no dependency audit is in place.
- The recommended immediate priorities are: (1) promote the three `In Review` specs to Approved, (2) fill the `AGENTS.md` root file, and (3) initiate the Security SPEC pipeline.

---

## Game Inventory and Stacks

| Game | Folder | Engine | Version | Lines | Status |
|---|---|---|---|---|---|
| Tauan T-Rex | `tauan-trex/` | Phaser.js | 3.60 (vendor local) | ~773 (single file) | Approved + Implemented |
| Aero Strike | `aero-fighters/` | Three.js | r165 ES module (vendor local) | 2511 (15 modules) | Approved (In Review post-backfill) |
| Testing Infrastructure | `tests/` | Playwright | ^1.44.0 | — | Approved (In Review post-backfill) |

**Shared vendor:** `vendor/phaser.min.js` and `vendor/three.module.min.js` — both committed to the repository. No CDN required at test or play time.

**Stack Principles (from `specs/memory/tech-stack.md`):**
- No build step — `index.html` opens directly in any browser (Aero Strike requires HTTP server due to ES module CORS)
- No external asset files — all graphics, audio, and 3D geometry are procedural
- No TypeScript — plain JS for pedagogical simplicity
- Target audience: Tauan (child of operator), so controls must be immediately intuitive and errors must never silently break the experience

---

## Per-Game Analysis

### Tauan T-Rex (`tauan-trex/`)

**Architecture:**
Single-file game (`game.js`, ~773 lines). One Phaser `BootScene` handles all state transitions (`idle → running → dead`), all rendering via `Phaser.GameObjects.Graphics`, and all physics (manual gravity constant, velocity integration, forgiving AABB hitbox). Web Audio API generates all sounds procedurally. Score and hi-score use DOM elements overlaid on the canvas.

**Strengths:**
- Complete and clean implementation of spec — all 8 ACs pass, confirmed by `.last-run.json` (`"status": "passed", "failedTests": []`)
- `window.game` contract is correctly exposed and updated every frame — Playwright injection of `player.dead = true` works (AC-6)
- Phaser Graphics used exclusively (no raw `ctx` calls that would conflict with WebGL renderer pipeline) — matches explicit SPEC constraint
- Day/night cycle, pterodactyl obstacles, duck mechanic, milestone sounds, hi-score persistence via `localStorage` — all spec requirements implemented
- Responsive canvas (`Math.min(800, window.innerWidth)`), touch support, M-key mute — mobile NFRs covered
- Game loop exposes `window.__phaser` separately from `window.game` to avoid contract pollution — good separation

**Gaps:**
- `tauan-trex/index.html` loads Phaser from `../vendor/phaser.min.js` (vendor-local, correct), but the SPEC originally described CDN loading. The spec was updated to vendor-local; the implementation is correct, but the TASKS file still references "internet connection for Phaser CDN" in T20 (minor hygiene gap)
- No cloud decoration for the night scene sky — clouds exist but are single-color rectangles that work well in day but feel sparse in night mode. Not a spec gap but a cosmetic limitation
- `game.js` is approaching 773 lines; SPEC cap was "~600 lines max" (§7). The overrun is benign today but would need a refactor if features are added

**Technical Debt:**
- Single-file architecture is appropriate for this game's complexity, but the Phaser scene has no unit-testable logic outside the Playwright integration tests — any regression requires a full browser run to detect
- `window.game.projectiles` and `window.game.enemies` are initialized as empty arrays but never populated (T-Rex has no projectiles or enemies in the game logic) — they exist solely to satisfy the shared `window.game` contract. This is an intentional compatibility decision but is a leaky abstraction

---

### Aero Strike — F-35 Ground Strike (`aero-fighters/`)

**Architecture:**
14 ES modules under `src/` plus `index.html` (2511 total lines across modules). Modular structure was extracted from a monolith during implementation. Key architectural split:

```
state.js + config.js (foundation)
  ↑ scene.js, world.js, audio.js, input.js (infra)
    ↑ player.js, targets.js, projectiles.js, fx.js, crosshair.js (gameplay)
      ↑ missions.js, hud.js (rules)
        ↑ main.js (orchestration)
```

**Strengths:**
- Clean modular separation: state is a single source of truth in `state.js` (`window.game`), config constants are centralized in `config.js`, each module has a focused responsibility
- Full flight sim physics: throttle convergence, stall detection, gravity, crash on terrain/sea — significantly more complex than a typical browser game and correctly implemented
- Rich target variety (5 types: base, factory, building, convoy, AA gun) with distinct mesh builders, HP values, score points, and drop chances — all in `targets.js` (245 lines, within conventions)
- Mission difficulty loop: 3 target counts [8, 12, 16] per cycle, HP bonus per cycle, AA speedup per cycle — drives replayability
- Mega-explosion pooling in `fx.js` (fireball + ring shockwave + tumbling debris + rising smoke) — professional FX design
- Crosshair lock-on system (`crosshair.js`) required before missile firing — prevents degenerate play
- All 18 ACs pass — confirmed by test-results directory containing result folders for all 18 tests and `.last-run.json` status `passed`
- `ARCHITECTURE.md` contains an exceptionally thorough audit of the original monolith (24 concerns identified, 5 worst smells detailed) and a complete modularization proposal — invaluable for future evolution

**Gaps:**
- The ARCHITECTURE.md's proposed module structure (with `core/`, `world/`, `entities/`, `fx/`, `ui/`, `missions/` sub-directories and a `loop.js` system) was NOT fully implemented — the current flat `src/` structure merges several of these layers. This is pragmatic but leaves `main.js` at 231 lines with mixed orchestration and some game logic
- Shared smoke pool problem identified in ARCHITECTURE.md (smoke emitters for factories and explosion smoke competing for the same pool) was documented but not yet fixed in the implemented code
- Dual state problem partially persists: `game.player.speed` and `game.player.throttle` are written at the end of each frame from local variables in `player.js`. The ARCHITECTURE.md flagged this as the worst smell — it means any module reading `game.player.speed` mid-frame reads the previous frame's value
- `targets.js` at 245 lines slightly exceeds the 250-line guideline in CONVENTIONS; `fx.js` at 359 lines exceeds it by 44%
- `player.js` at 251 lines also marginally exceeds the guideline

**Technical Debt:**
- `AGENTS.md` at the repo root still has placeholder text (`<repo-name>`, `<!-- 2-3 sentences -->`) — agents working in this repo (other than the current session) would have incomplete orientation
- The T15 boss fight task in TASKS.md is crossed out but the structure of `missions.js` has no hook for a future boss fight — if the operator decides to add one (per "v2 backlog" note in SPEC), it will require both `missions.js` and `targets.js` changes
- `aero-fighters/SPEC.md` and related specs are in `[ ] In Review` status (not yet promoted to `[x] Approved`) — technically implementation is ahead of an approved spec, which is a minor SDD protocol gap
- Mobile controls are Out of Scope for v1 (documented in SPEC §6) — the game is desktop-only, which limits the child's ability to play on tablet/mobile

---

### Testing Infrastructure (`tests/`)

**Architecture:**
Playwright test suite at the repo root. `playwright.config.js` configures a shared Chromium headless runner with a `python3 -m http.server` static server spun up via `globalSetup.js` and torn down via `globalTeardown.js`. Per-game spec files in `tests/trex/smoke.spec.js` and `tests/aero-fighters/smoke.spec.js`.

**Strengths:**
- `window.game` contract enforced as the testability interface — tests inject state via `page.evaluate()` rather than scraping DOM, making them robust to UI changes
- Separate AC suites per game — T-Rex (8 ACs) and Aero Fighters (18 ACs) can be run independently
- FPS tests tailored to rendering complexity: 55 FPS over 10s for T-Rex (2D), 15 FPS over 8s for Aero Fighters (3D PBR/headless), with the real hardware requirement (≥45 FPS) documented separately in the SPEC
- `globalSetup.js` guards against port conflicts before starting the server (throws if port already in use)
- `retries: 1` in playwright config provides one automatic retry for flaky tests without masking real bugs
- Screenshots saved to `tests/screenshots/` on failure — supports visual debugging without storing reference images in git

**Gaps:**
- No visual snapshot regression testing (FR-06 in testing-infra SPEC calls for pixel-diff comparison at 5% tolerance, but the current spec does not implement this — screenshots are saved `only-on-failure`, not compared against references)
- No CI workflow configured (`.github/workflows/` does not exist) — the test suite runs locally but there is no automated gate on pull requests
- `tests/screenshots/` contains only `.last-run.json` — the 6 reference PNG files specified in the spec have not been committed
- The Aero Fighters AC-2 test (`no console errors on load`) uses a 4-second `waitForTimeout` — this is a sleep-based wait rather than a `waitForFunction`, which is slower and less reliable under load

---

## SDD Specs Evaluation

### Coverage

| Feature | SPEC.md | PLAN.md | TASKS.md | Status |
|---|---|---|---|---|
| tauan-trex | Approved 2026-05-09 | Approved 2026-05-09 | Approved | Fully implemented; all ACs pass |
| aero-fighters | In Review (backfill 2026-05-11) | In Review | Approved (backfill) | Fully implemented; 18 ACs pass; promotion pending |
| testing-infra | In Review (backfill 2026-05-11) | — | Approved | Fully implemented; promotion pending |
| security | Draft (no approval) | Missing | Missing | Not implemented |

### Spec Quality

**tauan-trex:** The specs are exemplary — SPEC.md is precise with exact pixel values, AC conditions, and behavioral contracts. PLAN.md lists 10 clear phases. TASKS.md has 20 granular tasks each with a Playwright verify command. Constitution Princípio 3 compliance: README.md exists and covers all required sections.

**aero-fighters:** Post-backfill specs are accurate to the code but the specs carry the mark of retrospective documentation — TASKS.md has a "Tasks added during implementation" section (T24-T28) and the T15 boss fight stub. The SPEC is thorough and the 18 ACs map cleanly to the implementation. ARCHITECTURE.md and CONVENTIONS.md add significant value.

**testing-infra:** SPEC.md covers tooling, per-game AC structure, FPS requirements, and the `window.game` contract in detail. FR-06 (visual snapshot regression) is specified but not implemented — this should be flagged as a known spec/implementation gap.

**security:** Only a Draft SPEC.md exists. No PLAN, no TASKS, no CI configuration. All five FRs (secret scanning, dependency audit, HTTPS enforcement, env template policy, pipeline gate) are unimplemented. This is the largest compliance gap in the repository.

### Constitution Compliance

- SDD pipeline (SPEC → PLAN → TASKS → Implementation with approval at each step) is followed for T-Rex and testing-infra
- Aero Fighters shows the inverse pattern (implementation preceded spec update) — remediated by the backfill session, but the backfill itself set a precedent that code can diverge before specs are updated
- Princípio 1 (projetos independentes) is respected: each game is a self-contained folder with no shared game-logic code
- Princípio 2 (simplicidade primeiro) is respected: T-Rex is a single JS file; Aero Fighters modularized only when complexity demanded it
- Princípio 3 (documentação mínima) was relaxed in a constitution amendment to allow AGENTS.md, ARCHITECTURE.md, CONVENTIONS.md as optional — the amendment is correctly reflected in `specs/constitution.md`

---

## Risks and Prioritized Recommendations

### P1 — Critical / Blocking

**P1-A: Promote In-Review specs to Approved**
`specs/features/aero-fighters/SPEC.md`, `specs/features/aero-fighters/PLAN.md`, and `specs/features/testing-infra/SPEC.md` are in `[ ] In Review` status. Until promoted, any further implementation work on these features is technically without an approved spec — a constitution violation. The operator should review and mark these `[x] Approved`.

**P1-B: Fill AGENTS.md root file**
`repos/tauan-games/AGENTS.md` has unresolved placeholders (`<repo-name>`, `<!-- 2-3 sentences -->`). Every AI agent working in this repo opens this file first. A blank orientation file causes agents to fall back on general heuristics, increasing the risk of out-of-scope changes. Estimated effort: 30 minutes.

**P1-C: Security SPEC has no implementation**
`specs/security/SPEC.md` is in Draft with no PLAN, no TASKS, and no CI. FR-S01 (no secrets in repo), FR-S02 (dependency audit), and FR-S05 (pipeline gate) are all unfulfilled. While the current codebase has no secrets to leak and `@playwright/test` has no known critical CVEs, the gap will grow as the repo matures. Initiate the SDD pipeline: approve SPEC, create PLAN and TASKS, configure a minimal GitHub Actions workflow with `npm audit --audit-level=high` and a secret scanner.

---

### P2 — High Priority

**P2-A: Set up CI (GitHub Actions)**
There is no `.github/workflows/` directory. The Playwright test suite is excellent but provides no automated gate on commits. A minimal workflow running `npm test` on push to `main` would catch regressions before the operator needs to open a browser. This directly fulfills testing-infra NFR-03 (CI-friendly output).

**P2-B: Fix `fx.js` size violation**
`aero-fighters/src/fx.js` is 359 lines — 44% over the 250-line convention. ARCHITECTURE.md explicitly recommended splitting the shared smoke pool into two separate pools (explosion: 50 slots, factory chimney: 30 slots). This change eliminates the risk of FX flickering when multiple factories are emitting smoke simultaneously during a large explosion. This is a gameplay-correctness issue, not just a style issue.

**P2-C: Resolve dual-state lag in `player.js`**
`game.player.speed` and `game.player.throttle` are written at the end of `updatePlayer()`, meaning any system reading these values before `updatePlayer()` runs reads stale data. This is the #1 worst smell identified in ARCHITECTURE.md. While no current bug has been triggered, adding any system that reads flight physics before player update would introduce subtle bugs. Fix: make `game.player.speed` the authoritative source from the start of the frame.

**P2-D: Remove sleep-based waits from Aero Fighters AC-2**
`tests/aero-fighters/smoke.spec.js` AC-2 uses `await page.waitForTimeout(4000)` to wait for console errors. This is a 4-second unconditional sleep. Replace with a `waitForFunction` polling approach (e.g., wait until the game's first frame renders) to make the test faster and more reliable.

---

### P3 — Low Priority / Backlog

**P3-A: Implement visual snapshot regression (testing-infra FR-06)**
The spec calls for pixel-diff comparison at 5% tolerance for start/gameplay/gameover screens. This is not implemented. Add reference PNGs to `tests/screenshots/` and configure Playwright's built-in `toHaveScreenshot()` assertions. This adds a regression layer that catches visual regressions invisible to behavioral ACs.

**P3-B: Aero Fighters — mobile controls**
Currently out of scope (SPEC §6), but the primary audience (a child) likely plays on tablets. Consider a P3 spike to evaluate feasibility of on-screen joystick or simplified touch controls for a future v2.

**P3-C: Aero Fighters — `main.js` refactor to pure orchestration**
`main.js` at 231 lines contains some game logic that belongs in `missions.js` or `player.js`. The ARCHITECTURE.md target was ≤120 lines. This is not urgent but would improve long-term maintainability.

**P3-D: Aero Fighters — boss fight (v2 backlog)**
FR-05 was removed and placed in Out of Scope with a "v2 backlog" note. If Tauan requests a boss fight, `missions.js:checkMissionComplete()` would need a new code path and a new `targets.js` builder. The architecture is ready for this extension but no hooks were pre-wired.

**P3-E: `tauan-trex/game.js` 600-line spec cap**
`game.js` is 773 lines — 29% over the SPEC's informal cap ("~600 lines max"). For a single-scene Phaser game this is manageable, but adding any new feature would push it further. Consider extracting the draw methods into a separate `draw.js` module if the game grows.

---

## Suggested Next Steps

**This week (operator action required):**
1. Review `specs/features/aero-fighters/SPEC.md` and `specs/features/testing-infra/SPEC.md`; promote to `[x] Approved` if the backfill accurately reflects the code.
2. Fill `repos/tauan-games/AGENTS.md` — 2-3 sentences on repo purpose, key paths, and stop conditions.
3. Approve the security SPEC draft and create a PLAN + TASKS for a minimal CI pipeline (GitHub Actions + `npm audit` + gitleaks/trufflehog).

**Short term (game-developer agent):**
4. Split `fx.js` into separate explosion and chimney smoke pools (P2-B) — estimated impact: eliminates FX flickering, keeps module under 250-line convention.
5. Unify `game.player.speed`/`game.player.throttle` as the single authoritative source from the start of each frame in `player.js` (P2-C).
6. Replace `waitForTimeout(4000)` in AC-2 with a `waitForFunction` poll (P2-D) — faster CI.

**Medium term:**
7. Configure a GitHub Actions workflow: `npm ci && npx playwright install chromium && npm test` triggered on push to `main`. Wire exit code 0/1 as a merge gate.
8. Add visual snapshot tests for both games (`toHaveScreenshot()`) to catch rendering regressions.
9. Revisit mobile controls for Aero Strike — evaluate on-screen D-pad feasibility for tablet play by Tauan.

---

*End of report. All file paths referenced are relative to `/home/ubuntu/workspace/repos/tauan-games/`.*

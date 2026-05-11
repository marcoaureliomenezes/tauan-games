# tauan-games — Repo Context

> This file is loaded by Claude Code, OpenCode, and Codex when working in this repo.
> It complements the workspace-root `AGENTS.md` with repo-domain knowledge.
> Edit this file directly — it is NOT lib-originated and will not be overwritten by `dadaia public install`.

---

## Repo Purpose

This repository contains browser games built for Tauan (child of the operator) as a learning and play platform. All games run directly in the browser with no build step, no CDN dependencies at runtime, and no external asset files — everything is procedural. The sole authorized agent for game code is `game-developer`; other agents must not modify files inside game folders.

## Games

| Game | Folder | Engine | Description |
|---|---|---|---|
| Tauan T-Rex | `tauan-trex/` | Phaser 3.60 (vendor-local) | Endless runner clone (dinosaur jumps over obstacles). Single-file (`game.js`, ~773 lines). Fully implemented; all 8 ACs pass. |
| Aero Strike | `aero-fighters/` | Three.js r165 (vendor-local, ES modules) | F-35 ground-strike simulator: destroy military targets (bases, factories, buildings, convoys, AA guns) over a 3D ocean world. 15-module architecture under `src/`. Fully implemented; all 18 ACs pass. |

## Spec Structure

Specs live under `specs/`. Load them in this order before making any change:

1. `specs/constitution.md` — immutable laws; read first always
2. `specs/features/<affected-feature>/SPEC.md` — feature contract
3. `specs/features/<affected-feature>/PLAN.md` — implementation plan
4. `specs/features/<affected-feature>/TASKS.md` — task list
5. `specs/z_bug_specs.md` — live unresolved gaps (if it exists)

Approval marker: `[x] Approved` in the spec header is required before any implementation. Do not implement against a spec in `[ ] Draft` or `[ ] In Review` status without operator approval.

## Repo-Specific Stop Conditions

Stop and ask the operator if:
- A spec for the affected feature is in `Draft` or `In Review` status (no implementation without `[x] Approved`)
- A change touches `vendor/` (Phaser, Three.js) — vendors are pinned and must not be upgraded without a spec change
- A change to `aero-fighters/src/state.js` or `window.game` contract would break existing Playwright ACs
- Any new module would push a source file above 250 lines without a plan to split it
- A task involves adding secrets, API keys, or network calls to a game (all games must be fully offline)

## Key Paths

- `tauan-trex/game.js` — entire T-Rex game (single file, Phaser scene)
- `tauan-trex/index.html` — loads `../vendor/phaser.min.js` and `game.js`
- `aero-fighters/src/state.js` — single source of truth (`window.game`); all modules import `game` from here
- `aero-fighters/src/config.js` — all numeric constants; change gameplay feel here, not in game modules
- `aero-fighters/src/main.js` — game loop orchestrator; wires all modules together
- `aero-fighters/src/fx.js` — particle/smoke/explosion pools (two separate smoke pools: `smokeExplPool` for explosions, `smokeChimPool` for factory chimneys)
- `aero-fighters/ARCHITECTURE.md` — architectural decisions and module dependency map
- `aero-fighters/CONVENTIONS.md` — code conventions including 250-line module limit
- `vendor/phaser.min.js` — Phaser 3.60, committed offline copy
- `vendor/three.module.min.js` — Three.js r165 ES module build, committed offline copy
- `tests/` — Playwright smoke suite (26 ACs total: 8 T-Rex + 18 Aero Fighters)
- `tests/playwright.config.js` — Playwright config (baseURL port 8080, python3 http.server globalSetup)

## Key Commands

```bash
# Run all tests (26 ACs — requires no process on port 8080)
cd /home/ubuntu/workspace/repos/tauan-games
npx playwright test --config tests/playwright.config.js

# Run only Aero Fighters tests
npx playwright test --config tests/playwright.config.js tests/aero-fighters/

# Run only T-Rex tests
npx playwright test --config tests/playwright.config.js tests/trex/

# Serve games manually for browser play (open http://localhost:8080)
python3 -m http.server 8080
```

## Architecture Notes — Aero Strike

The `aero-fighters` module dependency order (bottom-up):

```
state.js + config.js (foundation — no imports from other game modules)
  ↑ scene.js, world.js, audio.js, input.js (infrastructure)
    ↑ player.js, targets.js, projectiles.js, fx.js, crosshair.js (gameplay)
      ↑ missions.js, hud.js (rules layer)
        ↑ main.js (orchestrator — only file that imports from all layers)
```

`window.game` (exported from `state.js`) is the single authoritative state object. Playwright tests interact exclusively through `window.game` — never via DOM scraping. All modules read from `game` and write back to their designated fields (documented with `// CONTRATO: writer de game.xxx` comments in each module).

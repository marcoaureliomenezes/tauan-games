# TASKS: Testing Infrastructure — Playwright Quality Gates

> **Status:** [x] Approved
> **PLAN:** `specs/features/testing-infra/PLAN.md`
> **Must complete before:** tauan-trex T18, aero-fighters T22

---

## Pre-implementation Checklist

- [x] SPEC.md [x] Approved
- [x] PLAN.md [x] Approved
- [x] Node.js available: `node --version` returns v18+
- [x] Python3 available: `python3 --version` returns 3.8+

---

## Tasks

### T01 — Create root package.json
Create `/repos/tauan-games/package.json`:
```json
{
  "name": "tauan-games-tests",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:trex": "playwright test tests/trex/",
    "test:aero": "playwright test tests/aero-fighters/"
  },
  "devDependencies": {
    "@playwright/test": "^1.44.0"
  }
}
```
**Verify:** `cat package.json` shows correct content.

---

### T02 — Install Playwright and Chromium browser
```bash
cd /repos/tauan-games && npm install && npx playwright install chromium
```
**Verify:** `node_modules/@playwright/test` exists; `npx playwright --version` returns version string.

---

### T03 — Create globalSetup.js
Create `tests/globalSetup.js` — starts `python3 -m http.server 8080` from repo root, stores PID for teardown:
- Check port 8080 not already in use before starting (fail fast if occupied)
- Write PID to `tests/.server.pid`
- Wait up to 2s for server to respond on `http://localhost:8080`

**Verify:** Running `node tests/globalSetup.js` starts a server; `curl http://localhost:8080` returns HTML.

---

### T04 — Create globalTeardown.js
Create `tests/globalTeardown.js` — reads PID from `tests/.server.pid`, kills process.

**Verify:** Running `node tests/globalSetup.js && node tests/globalTeardown.js` leaves no orphan server process.

---

### T05 — Create playwright.config.js
Create `tests/playwright.config.js`:
- `baseURL: 'http://localhost:8080'`
- `use.browserName: 'chromium'`
- `globalSetup: './globalSetup.js'`
- `globalTeardown: './globalTeardown.js'`
- `use.screenshot: 'only-on-failure'`
- `outputDir: './screenshots'`
- `timeout: 30000`
- `retries: 1`

**Verify:** `npx playwright test --list` exits 0 (even with no test files yet).

---

### T06 — Create T-Rex smoke spec file
Create `tests/trex/smoke.spec.js` with 8 tests matching tauan-trex SPEC ACs:
- AC-1: canvas `#game-canvas` exists with width > 0 within 500ms
- AC-2: zero `console.error` calls during 5s
- AC-3: after Space, `window.game.running === true` within 500ms
- AC-4: during gameplay, Space changes `window.game.player.y` by ≥ 20 within 200ms
- AC-5: `window.game.score > 0` after 3s of gameplay
- AC-6: setting `window.game.player.dead = true` via evaluate → overlay with "GAME OVER" appears
- AC-7: reload after score > 0 → `#hi-score` element shows non-zero value
- AC-8: FPS hook measures ≥ 55 over 10s

Each test navigates to `http://localhost:8080/tauan-trex/index.html`.

**Verify:** `npx playwright test tests/trex/ --list` shows 8 tests. Tests fail with "net::ERR_CONNECTION_REFUSED" or similar — expected (game not yet built).

---

### T07 — Create Aero Fighters smoke spec file

Create `tests/aero-fighters/smoke.spec.js` with **18 tests** matching aero-fighters SPEC §5 ACs (expandido de 8 durante backfill 2026-05-11):

- AC-1: `<canvas>` exists; screenshot has non-black pixels within 1s
- AC-2: zero `console.error` calls during 5s
- AC-3: starts with 100 light missiles (`game.player.missiles === 100`)
- AC-4: ArrowDown pitches nose UP (pitch invertido — `game.player.pitch` muda no sentido correto em 300ms)
- AC-5: ArrowUp pitches nose DOWN (pitch invertido)
- AC-6: jet survives full vertical loop (360° pitch sem crash)
- AC-7: ArrowLeft rolls and turns jet left
- AC-8: W key increases throttle and speed
- AC-9: S key decreases throttle and speed
- AC-10: Space fires cannon projectile (`game.projectiles.length` aumenta em 200ms)
- AC-11: X fires homing missile after lock-on e decrementa `game.player.missiles`
- AC-12: mission spawns static military targets (`game.targets.length > 0` em 3s; tipos ∈ {base, factory, building, convoy, aaGun})
- AC-13: killing target increments score (setar `target.hp = 0` via evaluate → `#score` aumenta)
- AC-14: sustained S key causes stall ou near-stall speed (`game.player.stalled === true` ou `speed ≤ STALL_SPD`)
- AC-15: Shift barrel roll keeps jet alive
- AC-16: scene renders coloured background (sky + ocean — pixels coloridos, não preto puro)
- AC-17: setting `game.player.lives = 0` via evaluate → overlay "MISSÃO FALHOU"
- AC-18: FPS hook measures ≥ 15 over 8s em headless chromium (threshold tolerante por software rendering + PBR + skybox + tracers; NFR-01 ≥45 em hardware real)

Each test navigates to `http://localhost:8080/aero-fighters/index.html`.

**Verify:** `npx playwright test tests/aero-fighters/ --list` shows 18 tests.

---

### T08 — Download vendor JS files (offline CDN)
Per testing-infra SPEC NFR-02 ("CDN already cached in game files"), download both libraries once and commit them to `vendor/`. Games reference local paths — tests never require internet.

```bash
mkdir -p vendor
# Phaser 3.60.0 — official jsDelivr URL (cdnjs does not reliably carry 3.60.0)
curl -L "https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js" -o vendor/phaser.min.js

# Three.js 0.165.0 — ES MODULE build (não o UMD `three.min.js`).
# aero-fighters/src/main.js usa `import * as THREE from '../../vendor/three.module.min.js'`,
# então o vendor precisa ser o `three.module.min.js`, não `three.min.js`.
curl -L "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.min.js" -o vendor/three.module.min.js
```

Resulting structure:
```
vendor/
├── phaser.min.js              ← Phaser 3.60.0 (~1 MB) — UMD para tauan-trex
└── three.module.min.js        ← Three.js 0.165.0 ES module build (~600 KB) — para aero-fighters src/main.js
```

Games reference these as `../vendor/phaser.min.js` (tauan-trex) e `../../vendor/three.module.min.js` (aero-fighters via import dentro de `src/`).

**Verify:**
```bash
wc -c vendor/phaser.min.js              # > 900000 bytes
wc -c vendor/three.module.min.js        # > 500000 bytes
grep -q "^export" vendor/three.module.min.js && echo "ES module ✅"
```

Files exist e são non-trivially sized. **Add `vendor/` to `.gitignore` is NOT correct here** — vendor files devem ser commitados para tests rodarem offline sem download.

---

## Done Condition

All tasks T01–T08 complete. `vendor/phaser.min.js` e `vendor/three.module.min.js` existem. `npx playwright test --list` mostra **26 tests** totais (8 T-Rex + 18 Aero Fighters após backfill 2026-05-11). The infrastructure é ready e fully offline.

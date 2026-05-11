# PLAN: Tauan T-Rex — Enhanced Dino Run

> **Status:** [x] Approved
> **SPEC:** `specs/features/tauan-trex/SPEC.md` [x] Approved
> **Depends on:** `testing-infra` TASKS complete (Playwright + smoke suite file in place)
> **Created:** 2026-05-09

---

## Context

Chrome Dino clone personalized for Tauan. Single JS file + HTML, no build step. All graphics procedural via Phaser GameObjects.Graphics — zero external image files that can fail to load. Playwright smoke suite (8 ACs) must pass before delivery.

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| Phaser.js 3.60 via `vendor/phaser.min.js` | Input handling, physics loop, scene lifecycle out of the box; no bundler needed |
| Single `game.js` file | Matches constitution "simplicidade primeiro"; easy to read and audit |
| All graphics via `Phaser.GameObjects.Graphics` | Raw `ctx` calls conflict with Phaser's WebGL renderer; Graphics API is safe and composable |
| Web Audio API for sound | Zero audio file dependencies; all tones generated procedurally |
| `window.game` contract exposed at top of game loop | Lets Playwright inject state (`player.dead = true`) and read score without brittle DOM scraping |
| Canvas width = `min(800, window.innerWidth)` | Responsive on desktop and phone without requiring a separate mobile layout |

---

## Implementation Phases

### Phase 1 — Foundation (T01–T02)
`index.html`: loads Phaser 3.60 CDN, loads `game.js`, sets canvas container div.
`game.js` skeleton: `Phaser.Game` config (width, height, parent, scene list). Exposes `window.game` contract with defaults. Verify AC-1 (canvas renders) and AC-2 (no console errors).

### Phase 2 — Core visuals (T03–T04)
Ground: scrolling pixel line with pebble detail (TileSprite or manual Graphics scroll).
Tauan T-Rex sprite: green body, orange details, 60px tall, pixel art drawn with Graphics.fillRect + fillCircle. Start screen shows "TAUAN" label above dino.

### Phase 3 — Player physics (T05–T07)
Jump arc (gravity constant, velocity, clamped to ground). Single jump only.
Duck (50% hitbox reduction, faster descent mid-air). 
Game-start flow: Space/Up transitions from `idle` to `running`; sets `window.game.running = true`. Verify AC-3, AC-4.

### Phase 4 — Obstacles (T08–T09)
Cactus spawner (small, medium, cluster variants) with gap formula from spec.
Pterodactyl spawner (low/high flight path variants, only after score ≥ 300).

### Phase 5 — Collision + game over (T10–T11)
Forgiving hitbox (8px shrink each side). Death frame (X eyes, mouth open). Game-over overlay ("GAME OVER", score, restart prompt). Verify AC-6.

### Phase 6 — Score + persistence (T12–T13)
Score counter at `#score` DOM element (1pt per 6 frames). High score at `#hi-score`, loaded from localStorage on boot, saved on game over. Verify AC-5, AC-7.

### Phase 7 — Difficulty + day/night (T14–T15)
Speed progression (start 6px/frame, +0.5 per 300 pts, cap 18px/frame).
Day/night toggle at every 700 points (0.5s CSS transition on background + sprite color).

### Phase 8 — Sound (T16)
Web Audio API: `jump` (sine 220→440 Hz, 150ms), `die` (sawtooth 440→110 Hz, 300ms), `milestone` (triangle 880 Hz, 80ms every 100 pts). M key mutes.

### Phase 9 — Mobile + polish (T17)
Touch tap = Space, touch hold = Down. Canvas scales to phone width.

### Phase 10 — Quality gate (T18–T20)
FPS check (AC-8 ≥ 55). Full Playwright suite green. README.md.

---

## Risk & Mitigation

| Risk | Mitigation |
|---|---|
| Phaser CDN unavailable during testing | Resolved: Phaser loaded from `vendor/phaser.min.js` (committed to repo by testing-infra T08) — no network dependency at test time |
| Pixel art via Graphics feels wrong | Spec allows any Phaser GameObjects primitive — can use `fillStyle` + `fillRect` blocks to approximate pixel art |
| `window.game.running` not immediately true on Space | Expose it in `update()` loop; test uses `waitForFunction(() => window.game.running)` with 500ms timeout |

---

## File Layout (result)

```
tauan-trex/
├── index.html
├── game.js
└── README.md
```

---

## Verification

```bash
# Run T-Rex smoke suite only
npx playwright test tests/trex/smoke.spec.js --reporter=list

# Expected output after all phases complete:
# ✓ AC-1 Canvas renders on load
# ✓ AC-2 No console errors
# ✓ AC-3 Space starts game
# ✓ AC-4 Space triggers jump
# ✓ AC-5 Score increments
# ✓ AC-6 Game over on collision
# ✓ AC-7 High score persists
# ✓ AC-8 FPS >= 55
```

---

## Approval

- [ ] Draft reviewed by operator
- [x] **Status:** [x] Approved — 2026-05-09

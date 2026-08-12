# SPEC: Tauan T-Rex — Enhanced Dino Run

> **Status:** [x] Approved
> **Author:** dadaia Labs
> **Created:** 2026-05-09

---

## 1. Overview

A personalized, enhanced clone of the Google Chrome Dinosaur game, built for Tauan. The protagonist is a custom T-Rex character named Tauan, rendered in pixel art style with a green/orange palette. The game must be immediately playable — one key to start, one key to jump — with no loading screens, no missing assets, no console errors.

**Why this game:** Simple reflex game perfectly suited for a child. The Chrome Dino is one of the most universally known one-button games. This version upgrades the aesthetic and adds polish (sound, high-score persistence, day/night cycle) while keeping the core mechanic unchanged.

---

## 2. Target Audience

- Primary: Tauan (child)
- Controls: keyboard (desktop) and tap (mobile/tablet)
- Skill curve: starts easy, becomes genuinely challenging around score 500

---

## 3. Functional Requirements

### FR-01 — Game Start
- The game loads to a static "start screen" showing the Tauan dino and the prompt "PRESSIONE ESPAÇO"
- Pressing `Space` or `Up Arrow` or tapping the canvas starts the game
- No menu, no loading bar — the canvas must be interactive within 500ms of page load

### FR-02 — Player Controls
| Action | Input |
|---|---|
| Jump | `Space`, `Up Arrow`, or screen tap |
| Duck | Hold `Down Arrow` or long-press (reduces hitbox height by 50%) |
| Restart after game over | `Space` or tap |

- Single jump only (no double-jump)
- Jump arc is governed by fixed gravity constant (no variable jump height)
- Duck is available mid-air (pressing Down while jumping descends faster)

### FR-03 — Obstacles
| Type | Behavior |
|---|---|
| Small cactus | Single cactus, 30px wide × 50px tall |
| Medium cactus | Single cactus, 30px wide × 70px tall |
| Cactus cluster | 2–3 cacti grouped, 80px wide total |
| Pterodactyl (low) | Flies at dino chest height — must duck under |
| Pterodactyl (high) | Flies at dino head height — can pass under or jump over |

- Obstacles spawn off the right edge of the canvas at random intervals (min gap: 600px at starting speed)
- Minimum gap between obstacles scales with current speed (gap = 600 + speed × 20)
- Pterodactyls appear only after score ≥ 300

### FR-04 — Difficulty Progression
- Starting speed: 6 px/frame
- Speed increases by 0.5 every 300 points
- Maximum speed: 18 px/frame (reached at score ~3600)
- Obstacle spawn interval decreases proportionally with speed

### FR-05 — Score System
- Score increments at 1 point per 6 frames (≈10 points/second at 60 FPS)
- Current score displayed top-right as `SCORE: 00000` (zero-padded to 5 digits)
- High score displayed below as `HI: 00000`, loaded from `localStorage` on start
- High score is updated in real-time during play and saved on game over

### FR-06 — Day/Night Cycle
- Background starts white (day)
- At every 700 points, background transitions to dark (night) over 0.5s, and back at the next 700 points
- Day: white background, dark sprites
- Night: dark background, white/light sprites (CSS filter invert or separate color set)

### FR-07 — Collision & Game Over
- Hitbox: bounding rectangle, shrunk by 8px on each side from sprite bounds (forgiving hitbox)
- On collision: dino plays death frame (mouth open, X eyes), game stops
- Overlay shows: "GAME OVER", current score, high score, "PRESSIONE ESPAÇO PARA REINICIAR"
- High score saved to `localStorage` on game over

### FR-08 — Sound Effects
- All sounds generated via Web Audio API — zero external audio file dependencies
- `jump`: short rising tone (150ms, sine wave, 220 Hz → 440 Hz)
- `die`: descending tone (300ms, sawtooth, 440 Hz → 110 Hz)
- `milestone`: cheerful ding every 100 points (80ms, triangle wave, 880 Hz)
- Sounds can be muted by pressing `M`

### FR-09 — Visual Customization
- Dino sprite: pixel art T-Rex, green body with orange details, 60px tall
- Name "TAUAN" appears above the dino on the start screen
- Ground: scrolling pixel ground line with pebble details
- No external image files — all sprites drawn exclusively via Phaser GameObjects.Graphics (never raw canvas ctx calls, which conflict with Phaser's render pipeline)

---

## 4. Non-Functional Requirements

### NFR-01 — Performance
- Game must maintain ≥ 55 FPS on a mid-range laptop (measured via rAF delta)
- Canvas size: `min(800, window.innerWidth)` × 300px (responsive width, fixed height)

### NFR-02 — Zero External Asset Dependencies
- No image files to load (all graphics are procedural/canvas-drawn)
- No audio files to load (Web Audio API only)
- Only external dependency: Phaser.js 3.60 via CDN
- If CDN fails, the page must show a clear error — it must never silently break

### NFR-03 — Mobile Support
- Canvas scales to fill phone screen width
- Touch tap = Space, touch hold = Down Arrow
- No virtual joystick needed — single tap controls are sufficient

### NFR-04 — No Build Step
- `index.html` + `game.js` — open `index.html` directly in any browser, it works
- No npm, no bundler, no compilation

---

## 5. Acceptance Criteria (Automated — Playwright)

All of the following must pass via `tests/trex/smoke.spec.js` before any implementation task is closed:

| ID | Test | Pass Condition |
|---|---|---|
| AC-1 | Canvas renders on load | `#game-canvas` element exists and has width > 0 within 500ms |
| AC-2 | No console errors | Zero `console.error` calls during load and 5s idle |
| AC-3 | Space starts game | After pressing Space, `window.game.running === true` within 500ms |
| AC-4 | Space triggers jump | During gameplay, pressing Space changes dino Y by ≥ 20px within 200ms |
| AC-5 | Score increments | `#score` text value increases after 3 seconds of gameplay |
| AC-6 | Game over on collision | Injecting `game.player.dead = true` causes overlay with "GAME OVER" text to appear |
| AC-7 | High score persists | Score > 0 on game over → reload page → `#hi-score` shows that value |
| AC-8 | FPS ≥ 55 | Over 10 seconds of gameplay, average FPS measured via JS hook ≥ 55 |

---

## 6. Out of Scope

- Multiplayer
- Leaderboard / server-side score
- Additional game modes
- Character selection
- Unlockables

---

## 7. File Layout

```
tauan-trex/
├── index.html    ← single HTML file, loads Phaser from CDN, loads game.js
├── game.js       ← complete game logic (~600 lines max)
└── README.md     ← FR-10: required by constitution (see below)
```

### FR-10 — README.md (required by constitution Princípio 3)
The `tauan-trex/README.md` must contain:
- One-line description of the game
- How to run: "Open `index.html` in any browser"
- Controls: Space to start/jump, Down to duck, M to mute
- Requirements: modern browser with JavaScript enabled; internet connection for Phaser CDN

---

## 8. Open Questions

_(none at spec creation time)_

---

## 9. Approval

- [x] Draft reviewed by operator
- [x] **Status:** [x] Approved — 2026-05-09

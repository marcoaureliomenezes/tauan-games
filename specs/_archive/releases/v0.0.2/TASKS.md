# TASKS: Tauan T-Rex — Enhanced Dino Run

> **Status:** [x] Approved
> **PLAN:** `specs/features/tauan-trex/PLAN.md`
> **Prerequisite:** `testing-infra` all tasks complete (T01–T07)

---

## Pre-implementation Checklist

- [x] SPEC.md [x] Approved
- [x] PLAN.md [x] Approved
- [x] testing-infra TASKS complete (`npx playwright test tests/trex/ --list` shows 8 tests)
- [x] `tauan-trex/` folder existe e contém implementação (`index.html`, `game.js`, `README.md`)

---

## Tasks

### T01 — Create index.html
Create `tauan-trex/index.html`:
- Loads Phaser 3.60 from local vendor file: `../vendor/phaser.min.js` (see testing-infra T08)
- `<div id="game-container">` as Phaser parent
- Loads `game.js` as a module after Phaser
- Basic CSS: body margin 0, background #fff, canvas centered

**Verify:** Open `index.html` in browser. Page loads. Console shows Phaser banner. No errors.

---

### T02 — Create game.js skeleton with window.game contract
Create `tauan-trex/game.js`:
- `Phaser.Game` config: width = `Math.min(800, window.innerWidth)`, height = 300, parent `game-container`, scene `[BootScene]`
- `BootScene` with empty `create()` and `update()`
- Expose contract:
```js
window.game = {
  running: false,
  score: 0,
  projectiles: [],
  player: { x: 80, y: 220, dead: false, lives: 1 }
}
```

**Verify:** AC-1 passes (`#game-canvas` exists, width > 0). AC-2 passes (no console errors).
```bash
npx playwright test tests/trex/smoke.spec.js -g "AC-1|AC-2"
```

---

### T03 — Implement scrolling ground
In `BootScene.create()`: draw ground line using `Phaser.GameObjects.Graphics`:
- Horizontal line at y=250, full canvas width, 2px height, dark color (#535353)
- Small pebble dots scattered along ground (3px circles, random x spacing)
- Ground scrolls by moving a TileSprite or re-drawing each frame in `update()`

**Verify:** Ground line visible and scrolling when game runs. No canvas ctx calls — Phaser Graphics only.

---

### T04 — Implement Tauan T-Rex sprite + start screen
Draw T-Rex using `Phaser.GameObjects.Graphics`:
- Body: green `fillRect` blocks for torso, head, legs (60px tall total)
- Orange `fillRect` detail on eye, chest
- Standing frame: legs wide; running frame: legs alternating (swap every 10 frames)
- Start screen: "TAUAN" text above dino using `Phaser.GameObjects.Text`, "PRESSIONE ESPAÇO" below

**Verify:** Dino visible at left of canvas, "TAUAN" label above, start prompt visible. No external image requests in network tab.

---

### T05 — Implement jump physics
- `player.vy` velocity variable, gravity constant `0.6` px/frame²
- On Space/Up: if `player.onGround`, set `player.vy = -14`
- Each frame: `player.y += player.vy; player.vy += gravity`
- Clamp `player.y` to ground level (220)
- Update `window.game.player.y` each frame

**Verify:** AC-4 passes (Space changes player.y by ≥ 20 within 200ms).
```bash
npx playwright test tests/trex/smoke.spec.js -g "AC-4"
```

---

### T06 — Implement duck mechanic
- On Down Arrow held: `player.ducking = true`, hitbox height ÷ 2
- If ducking while airborne: apply downward force (`player.vy += 4` per frame)
- On release: restore hitbox, clear ducking
- Duck changes dino sprite to crouched shape (wider, shorter Graphics drawing)

**Verify:** Pressing Down while grounded shows crouched sprite. Pressing Down mid-air descends faster. Hitbox height is 50% of normal.

---

### T07 — Implement game-start flow
- State machine: `idle` → (Space) → `running` → (collision) → `dead` → (Space) → `running`
- On transition to `running`: set `window.game.running = true`, start scrolling ground, start spawning obstacles
- On `idle`: show start screen; dino is static
- On `dead`: stop obstacle movement, show game-over overlay

**Verify:** AC-3 passes (`window.game.running === true` after Space within 500ms).
```bash
npx playwright test tests/trex/smoke.spec.js -g "AC-3"
```

---

### T08 — Implement cactus obstacles
Cactus spawner in `update()`:
- 3 variants: small (30×50), medium (30×70), cluster (80×50)
- Spawn at x = canvasWidth + 10, random variant
- Move left at current speed each frame
- Remove when x < -100
- Minimum gap between spawns: `600 + speed × 20`
- Draw using `Phaser.GameObjects.Graphics` (green `fillRect` blocks)

**Verify:** Cacti appear from right, scroll left, disappear off left edge. Multiple variants visible over 30 seconds.

---

### T09 — Implement pterodactyl obstacle
- Only spawn when `score >= 300`
- Two variants: low (y=200, dino must duck) and high (y=170, can jump or pass under)
- Wings animate: two positions alternating every 15 frames (Graphics redraw)
- Remove when x < -100

**Verify:** No pterodactyls visible before score 300. Both variants appear after score 300. Low variant is clearly at duck height.

---

### T10 — Implement collision detection + death
For each obstacle each frame:
- Compare player hitbox (x±8, y±8 shrink) vs obstacle hitbox
- On overlap: set `player.dead = true`, switch to death frame (X eyes drawn with Graphics), stop game loop updates

**Verify:** Manually walking dino into cactus (by disabling jump for 2s) triggers death frame and stops movement.

---

### T11 — Implement game-over overlay + restart
On `player.dead = true`:
- Show overlay: semi-transparent rect, "GAME OVER" text, current score, high score, "PRESSIONE ESPAÇO PARA REINICIAR"
- Space/tap restarts: reset all state, re-enter `running`

**Verify:** AC-6 passes (injecting `window.game.player.dead = true` shows overlay with "GAME OVER").
```bash
npx playwright test tests/trex/smoke.spec.js -g "AC-6"
```

---

### T12 — Implement score system
- `score` increments +1 every 6 frames while `running`
- `#score` DOM element (HTML div overlaid on canvas via CSS absolute position) updated each frame: `SCORE: 00000`
- Update `window.game.score` each frame

**Verify:** AC-5 passes (`window.game.score > 0` after 3s of gameplay).
```bash
npx playwright test tests/trex/smoke.spec.js -g "AC-5"
```

---

### T13 — Implement high score persistence
- On game start: `hiScore = parseInt(localStorage.getItem('tauan-hiscore') || '0')`
- Update `#hi-score` DOM element: `HI: 00000`
- On game over: if `score > hiScore`, save to localStorage

**Verify:** AC-7 passes (score > 0 after game over → reload → `#hi-score` shows value).
```bash
npx playwright test tests/trex/smoke.spec.js -g "AC-7"
```

---

### T14 — Implement day/night cycle
- Track `lastCycleScore`: toggle at every 700 points
- Day → Night: `document.body.style.background = '#1a1a2e'`; invert sprite colors (or use a Graphics fillStyle switch)
- Night → Day: reverse
- Transition over 0.5s using CSS `transition: background 0.5s`

**Verify:** Background color inverts at score 700, reverts at 1400. Sprite colors contrast correctly in both modes.

---

### T15 — Implement speed progression
- Starting speed: 6 px/frame
- Each frame: `speed = 6 + Math.floor(score / 300) * 0.5`
- Cap at 18
- Obstacle gap formula: `600 + speed * 20`

**Verify:** At score 300, obstacle movement is visibly faster. At score 3600, speed is capped (obstacles don't keep accelerating infinitely).

---

### T16 — Implement sound effects
```js
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const ctx = new AudioCtx();
function playJump() { /* sine wave 220→440 Hz, 150ms */ }
function playDie()  { /* sawtooth 440→110 Hz, 300ms */ }
function playMilestone() { /* triangle 880 Hz, 80ms */ }
```
- M key toggles `muted` boolean; if muted, skip AudioContext calls
- Trigger: jump on Space, die on collision, milestone every 100 score points

**Verify:** Jump, die, and milestone sounds play at correct moments. M key silences them.

---

### T17 — Implement mobile touch support
- `canvas.addEventListener('touchstart')` → Space equivalent
- `canvas.addEventListener('touchend')` → if hold > 200ms, was Duck; on end, release duck
- Canvas CSS `width: 100%` on screens < 600px

**Verify:** On mobile viewport (375px width), canvas scales to full width. Tap starts game and triggers jump. Hold triggers duck.

---

### T18 — Performance + error check
- Run game for 10s, measure FPS via `requestAnimationFrame` delta
- Ensure no `console.error` or unhandled exceptions in 10s window

**Verify:** AC-2 and AC-8 pass.
```bash
npx playwright test tests/trex/smoke.spec.js -g "AC-2|AC-8"
```

---

### T19 — Full Playwright smoke suite
Run all 8 ACs. All must pass before this task is closed.

```bash
npx playwright test tests/trex/smoke.spec.js --reporter=list
```

**Verify:** Output shows `8 passed`. Screenshots saved to `tests/screenshots/trex-*.png`.

---

### T20 — Create README.md
Create `tauan-trex/README.md` per FR-10:
- Game name and one-line description
- How to run: "Open `index.html` in any modern browser"
- Controls table (Space, Down, M)
- Requirements note (internet for Phaser CDN)

**Verify:** File exists. `cat tauan-trex/README.md` shows all required sections.

---

## Done Condition

All tasks T01–T20 complete. `npx playwright test tests/trex/smoke.spec.js` shows `8 passed`. `tauan-trex/README.md` exists. Operator can open `tauan-trex/index.html` directly in a browser and play the game.

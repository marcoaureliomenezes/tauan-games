# Aero Strike — F-35 Ground Strike

Third-person flight combat in the browser. You pilot an **F-35 Lightning II** on ground-attack missions, destroying static military targets (bases, factories, terrorist buildings, troop convoys) defended by stationary AA emplacements. Built with Three.js (ES module).

## Run locally

```sh
cd /home/ubuntu/workspace/repos/tauan-games
python3 -m http.server 8080
# open http://localhost:8080/aero-fighters/index.html
```

## Controls (flight-sim convention — inverted pitch)

| Key | Action |
|-----|--------|
| ↑ ArrowUp / I | **Nose DOWN** (dive) — push stick forward |
| ↓ ArrowDown / K | **Nose UP** (climb) — pull stick back |
| ← → ArrowLeft/Right / A D | Roll + coordinated yaw |
| W | Throttle up |
| S | Throttle down / airbrake |
| Q / E | Rudder (yaw left/right) |
| Space or Z | Vulcan cannon (12.5 r/s) |
| X | Homing missile (uses 1 of `player.missiles`) |
| Shift | Barrel roll (invincible 0.5s, 1.5s cooldown) |
| P or Esc | Pause |
| M | Toggle sound |
| Space / Enter (title) | Start / restart |

> ⚠️ Watch your altitude. **Crashing into the sea or a mountain is instant death** — no second chances, regardless of remaining lives.

## Targets

| Type | HP | Score | Notes |
|------|-----|-------|-------|
| Military Base | 28 | 800 | Radar dish + barracks + flag — mega explosion on kill |
| Factory | 20 | 600 | Three smokestacks emitting constant smoke — mega explosion on kill |
| Terrorist Building | 14 | 450 | Multi-story tower with lit windows + antenna |
| Troop Convoy | 12 | 380 | Line of 5 military trucks |
| AA Gun | 6 | 250 | **Static defenders** — fire at player when in range (220m) |

Per cycle, target HP grows by +3 and AA fire rate increases.

## Mission flow

- **Mission 1**: 8 fixed targets across the island chain
- **Mission 2**: 12 targets (more bases + AA)
- **Mission 3+**: 16 targets (full layout) and tougher
- Destroy all targets → "MISSÃO COMPLETA" → next mission auto-spawns with +1 cycle difficulty
- AA guns + ambient flak fill the airspace after the first mission for atmosphere

## Visual / audio features

- **F-35 Lightning II silhouette**: faceted stealth fuselage, swept trapezoidal wings, twin canted V-tails, single engine exhaust with glow, dark bubble canopy
- **Multi-layer mega-explosions**: fireball + shockwave (RingGeometry) + tumbling debris (BoxGeometry with gravity) + long-lived rising smoke; player crash adds a white flash and double shockwave
- **Web Audio API engine**: synthesized in-browser, no external sound files
  - Jet engine rumble whose pitch/gain track speed and throttle
  - Cannon: filtered noise bursts
  - Missile: swept oscillator
  - Explosions: low-pass-swept noise with sub-bass sine thump on mega-explosions
  - AA fire: distant filtered noise pops
- **Ambient flak**: decorative grey puffs appear after mission 1 to convey a war zone

## Architecture notes

- Single ES module `game.js`, imports `three.module.min.js` from `../vendor/`
- Bullets, particles, debris, smoke, and shockwaves all pooled to keep mesh count bounded
- `window.game` contract: `running`, `score`, `projectiles[]`, `targets[]` (alias `enemies[]` retained), `kills`, `cycle`, `targetsTotal`, `targetsDestroyed`, `islands[]`, `player{x,y,pitch,dead,lives,missiles,speed,throttle,stalled}`
- `window.audio` is the audio module; `audio.toggle()` mutes/unmutes
- Game loop uses `THREE.Clock` delta for frame-rate-independent movement
- Terrain collision via dome heightmap: each island in `game.islands` has `{cx, cz, radius, peakHeight}`; the player's altitude is checked against the dome formula every frame

## Tip

Audio is lazy-initialized on the first keypress per browser autoplay policy — press any key on the title screen to enable sound, or click the **🔊 SOM** button.

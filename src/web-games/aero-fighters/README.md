# Aero Strike — F-35 Ground Strike

Third-person flight combat in the browser. You pilot an **F-35 Lightning II** on ground-attack missions, destroying static military targets (bases, factories, terrorist buildings, troop convoys) defended by stationary AA emplacements. Built with Three.js (ES module).

## Run locally

```sh
cd /home/ubuntu/workspace/repos/tauan-games
python3 -m http.server 8080
# open http://localhost:8080/src/web-games/aero-fighters/index.html
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
| X | Homing missile — todas as armas são infinitas, limitadas por cadência (X 5/s, B 1/s, R 1/5s, T 1/min) |
| Shift | Barrel roll (invincible 0.5s, 1.5s cooldown) |
| P or Esc | Pause |
| M | Toggle sound |
| Space / Enter (title) | Start / restart |

> ⚠️ Watch your altitude. **Crashing into the sea or a mountain is instant death** — no second chances, regardless of remaining lives.

## Mapa Inhaúma — campanha ("Salvar Inhaúma → Libertar Cachoeira")

No mapa **Inhaúma** o jogo é uma campanha em 2 atos (sem waves e sem chefe):
Cachoeira da Prata foi **ocupada** (zeppelins, helicópteros, ninhos AA nas colinas,
colunas blindadas, QG) e Inhaúma está **sob ataque** — colunas de tanques/
blindados/tropas/caminhões avançam de Cachoeira pela MG-060 e baterias de
artilharia **bombardeiam os prédios da cidade** (fogo e fumaça persistentes até a
bateria cair). O Ato 1 é destruir o ataque; o Ato 2 é libertar Cachoeira. O
aeroporto rearma a qualquer momento — voltar é decisão sua, não de wave.
Armas por cooldown (2026-08-11): X 0.2 s, B 1 s, R 5 s, T nuclear 60 s; pickups zeram recargas.

## Modo Inhaúma — Bateria Antiaérea (Defesa)

O modo **`inhauma-defense`** é jogado **do chão**: você é o soldado de uma bateria
antiaérea no alto de uma colina com vista para Inhaúma. Caças inimigos chegam em
**esquadrilhas infinitas** (a taxa cresce com seus abates) para bombardear a
cidade, a base e as baterias aliadas. Segure a barra **INHAÚMA** acima de 0%.

| Input | Action |
|-------|--------|
| Clique | Pointer lock (trava a mira) |
| Mouse | Mira (yaw/pitch do gimbal) |
| LMB (segurar) | Metralhadora .50 (tracers, heat com histerese) |
| X | Míssil AA homing (lock no retículo; pode errar se o caça manobrar) |
| RMB | Zoom |
| Scroll / 1 / 2 | Alternar arma |
| Esc | Sair do pointer lock / pausa |

Caças abatidos caem em espiral/glide/pique com fumaça preta até explodirem no
chão (20% ejetam de paraquedas). Mísseis inimigos que miram você têm alerta e
podem ser **interceptados no ar** pela .50 (bônus de score).


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
- **Atmospheric day/night cycle** (Inhaúma, release `inhauma-visual-uplift-v1`): Preetham physical sky (dawn/day/dusk/night), fog synced to the sky on every map (no more glowing horizon at night), subtle bloom, hemisphere lighting
- **Layered horizon**: 3 ridged backdrop mountain rings follow the player (always mountains on the horizon); terrain continues procedurally beyond the DEM edge
- **Textured terrain**: procedural canvas detail + normal map over biome vertex colors; slope- and noise-driven irregular snowline
- **Living city**: instanced low-rise houses with pitched terracotta roofs, mid-rise and setback towers with procedural window façades; windows glow warm at night
- **Composed forests**: multi-primitive merged crowns with per-instance tilt and scale
- **Real river**: one continuous ribbon carved from DEM drainage — width 14→56 m, sandy shores, bank foam
- **Road network**: authored MG-238 dual carriageway (median + guardrails) + 8 curated OSM corridors (BR-040, MG-060, …) with bridges and two-hand traffic

## Architecture notes

- Single ES module `game.js`, imports `three.module.min.js` from the repo-root `vendor/` (`../../../../vendor/` from `src/`)
- Bullets, particles, debris, smoke, and shockwaves all pooled to keep mesh count bounded
- `window.game` contract: `running`, `score`, `projectiles[]`, `targets[]` (alias `enemies[]` retained), `kills`, `cycle`, `targetsTotal`, `targetsDestroyed`, `islands[]`, `player{x,y,pitch,dead,lives,missiles,speed,throttle,stalled}`
- `window.audio` is the audio module; `audio.toggle()` mutes/unmutes
- Game loop uses `THREE.Clock` delta for frame-rate-independent movement
- Terrain collision via dome heightmap: each island in `game.islands` has `{cx, cz, radius, peakHeight}`; the player's altitude is checked against the dome formula every frame

## Tip

Audio is lazy-initialized on the first keypress per browser autoplay policy — press any key on the title screen to enable sound, or click the **🔊 SOM** button.

# TASKS: Aero Fighters Assault Replica

> **Status:** [x] Approved — 2026-05-12 (Sprint 1 de Bug Fixes adicionado e aprovado pelo operador)
> **PLAN:** `specs/features/aero-fighters/PLAN.md`
> **Prerequisite:** `testing-infra` all tasks complete (T01–T07)

---

## Pre-implementation Checklist

- [x] SPEC.md [x] Approved
- [x] PLAN.md [x] Approved
- [x] testing-infra TASKS complete (`npx playwright test tests/aero-fighters/ --list` shows **18 tests** — expandido de 8 durante backfill)
- [x] `aero-fighters/` folder existe e contém implementação modular em 15 ES modules em `src/`

> **Status do backlog:** Implementação concluída. Backfill de specs aplicado 2026-05-11 — ver `.dadaia/reports/refine-specs.md`. Tasks abaixo são reconstrução histórica do que foi feito (não roadmap futuro).

---

## Module Implementation Map (backfill 2026-05-11)

Cada task abaixo mapeia para um ou mais módulos em `aero-fighters/src/`. Resumo:

| Task (intent) | Módulo(s) | Notas |
|---|---|---|
| T01 index.html + HUD | `index.html` | HUD expandido com MSLS/HVY/SPD/THR/ALVOS/STALL |
| T02 state contract | `src/state.js` | `window.game` expandido |
| T03 sky + scrolling | `src/scene.js` + `src/world.js` | Substituído por ocean + dome islands + skybox/fog/sombras |
| T04 player jet | `src/player.js` | F-35 facetado em vez de F-14 N64 |
| T05 camera | `src/main.js:updateCamera` | Camera lerp + audio listener 3D + shadow camera target |
| T06 movement | `src/player.js` + `src/input.js` | Full sim: throttle, stall, rudder, gravity |
| T07 barrel roll | `src/player.js:barrelRoll` | Mantido |
| T08 cannon | `src/projectiles.js:spawnBullet` + `src/main.js:fireCannon` | 2 canos nas asas |
| T09 fighter enemies | — | **Substituído por static targets (ver T_NEW_4)** |
| T10 helicopters + drones | — | **Removido (ver T_NEW_4)** |
| T11 missile pickups | `src/projectiles.js:updatePickups` | Mantido |
| T12 missile system | `src/projectiles.js:spawnMissile/updateMissiles` + `src/crosshair.js` | Light + heavy tiers, exige lock-on |
| T13 collision | `src/projectiles.js` + `src/player.js:playerHit` | + crash em terreno |
| T14 lives + game over | `src/missions.js:gameOver/crashAndDie` | + crash freeze |
| ~~T15 Boss fight~~ | — | **REMOVIDO — ver §6 Out of Scope da SPEC** |
| T16 HUD updates | `src/hud.js:updateHUD` | + mission/speed/throttle/alvos/stall |
| T17 explosion pool | `src/fx.js` | Expandido: mega-explosion com shockwave/debris/smoke |
| T18 speed lines | `src/main.js:updateSpeedLines` | Mantido |
| T19 pause | `src/main.js:onAction('pause')` | Mantido |
| T20 difficulty loop | `src/missions.js:nextMission` + `src/config.js:MISSION` | Substituído por [8,12,16] + HP+3 + AA speedup |
| T21 perf check | — | AC-18 ≥15 FPS headless |
| T22 full suite | — | **18 ACs** (não 8) |
| T23 README | `aero-fighters/README.md` | Documenta pitch invertido e crash instantâneo |

Tasks novas adicionadas durante implementação (T24-T28) descritas após T23.

---

## Tasks

### T01 — Create index.html
Create `aero-fighters/index.html`:
- Loads Three.js r165 from local vendor file: `../vendor/three.min.js` (see testing-infra T08)
- HUD overlay structure (absolute-positioned HTML over canvas):
```html
<div id="hud">
  <div id="lives"></div>
  <div id="score">SCORE: 000000</div>
  <div id="missiles">MISSILES: 5</div>
  <div id="boss-bar" style="display:none"><div id="boss-hp"></div></div>
  <div id="altitude">ALT: 0m</div>
  <div id="kills">KILLS: 0</div>
</div>
```
- CSS: canvas fills viewport, HUD absolutely positioned over it, pointer-events: none on HUD
- Loads `game.js` after Three.js

**Verify:** Page loads. No console errors. HUD div elements present in DOM.

---

### T02 — Create game.js skeleton with window.game contract
Create `aero-fighters/game.js`:
- `THREE.Scene`, `THREE.WebGLRenderer` (fullscreen, antialias: false for N64 aesthetic)
- `THREE.PerspectiveCamera(75, aspect, 0.1, 1000)`
- `requestAnimationFrame` loop with `THREE.Clock` delta
- Window resize handler (update renderer size + camera aspect)
- Expose contract:
```js
window.game = {
  running: false,
  score: 0,
  projectiles: [],
  enemies: [],
  kills: 0,
  cycle: 1,
  player: { x: 0, y: 5, pitch: 0, dead: false, lives: 3, missiles: 5 },
}
```

**Verify:** AC-1 passes (`<canvas>` exists, screenshot shows non-black pixels — default Three.js grey or scene background). AC-2 passes (no console errors).
```bash
npx playwright test tests/aero-fighters/smoke.spec.js -g "AC-1|AC-2"
```

---

### T03 — Implement sky + scrolling ground
Sky: `scene.background = new THREE.Color(0x1a3a6e)` (deep blue).

Ground:
- Draw 128×128 checkerboard onto offscreen `<canvas>` (64×64px green/brown squares), create `THREE.CanvasTexture`
- Large `THREE.PlaneGeometry(200, 200)`, rotated flat, `MeshBasicMaterial` with texture, repeat wrapping
- Scroll: `groundMesh.material.map.offset.y += speed * delta` each frame (no geometry movement, UV offset scroll)

**Verify:** Sky color visible above horizon. Ground checkerboard scrolls continuously upward (sense of forward movement).

---

### T04 — Implement player jet geometry
Assemble F-14 silhouette from Three.js primitives, all in a `THREE.Group`:
- Fuselage: `BoxGeometry(0.5, 0.4, 3)`, `MeshPhongMaterial({color: 0x444444})`
- Left wing: `BoxGeometry(2.5, 0.05, 1.2)`, positioned left + angled back
- Right wing: mirror of left
- Vertical tail left: `BoxGeometry(0.05, 0.6, 0.8)`, top-rear
- Vertical tail right: mirror
- Cockpit: `BoxGeometry(0.3, 0.3, 0.5)`, `MeshPhongMaterial({color: 0xff6600})`

Add `AmbientLight(0xffffff, 0.6)` + `DirectionalLight(0xffffff, 0.8)` from above.
Place jet at `(0, 5, 0)`.

**Verify:** Jet visible in scene from behind. Orange cockpit distinct. Silhouette recognizable as fighter aircraft.

---

### T05 — Implement third-person camera
Each frame in `update()`:
```js
const targetPos = jet.position.clone().add(new THREE.Vector3(0, 3, -8));
camera.position.lerp(targetPos, 0.1);
camera.lookAt(jet.position.clone().add(new THREE.Vector3(0, 0, 5)));
```
- Lerp factor 0.1 gives slight lag behind jet (cinematic feel)
- Camera always looks slightly ahead of jet (forward vector offset)

**Verify:** Camera follows jet from behind and above. Horizon always visible. Rotating jet with keyboard (T06) shows camera follows.

---

### T06 — Implement movement controls
Keyboard state tracked via `keydown`/`keyup` event listeners on `window`.

Each frame:
- `A`/`Left`: `jet.rotation.z += 0.03` (bank left), `jet.position.x -= bankSpeed * delta`
- `D`/`Right`: mirror
- `W`/`Up`: `jet.rotation.x -= 0.02` (pitch up), `jet.position.y += pitchSpeed * delta`
- `S`/`Down`: mirror; clamp pitch to ±0.785 rad (±45°); clamp y to [1, 20]
- Update `window.game.player.pitch = jet.rotation.x` each frame

**Verify:** AC-3 passes (Down Arrow changes `window.game.player.pitch` within 300ms).
```bash
npx playwright test tests/aero-fighters/smoke.spec.js -g "AC-3"
```

---

### T07 — Implement Shift barrel roll
On `Shift` keydown (if cooldown expired):
- Set `player.invincible = true`
- Animate `camera.rotation.z` from 0 to `Math.PI * 2` over 0.5s using a lerp accumulator
- After 0.5s: clear invincible, start 1.5s cooldown timer

Alternating direction: first roll = positive rotation, second = negative, toggle each use.

**Verify:** Pressing Shift causes camera to roll 360° over ~0.5s. Second Shift rolls opposite direction. Rapid Shift presses respect cooldown.

---

### T08 — Implement cannon system
On `Space`/`Z` held (rate-limited to 10 rounds/sec = 1 bullet per 100ms):
- Create bullet: `CylinderGeometry(0.05, 0.05, 0.5)`, `MeshBasicMaterial({color: 0xffffff})`
- Place at jet nose position, oriented forward
- Push to `window.game.projectiles` array
- Each frame: move bullet forward at speed 40 units/sec
- Remove from array + scene when `z > 300` or on enemy hit

Max simultaneous bullets: 10 (oldest removed if limit exceeded).

**Verify:** AC-4 passes (`window.game.projectiles.length` increases on Space).
```bash
npx playwright test tests/aero-fighters/smoke.spec.js -g "AC-4"
```

---

### T09 — Implement game-start + fighter enemy spawner
Title screen: "AERO FIGHTERS" text overlay + "PRESSIONE ESPAÇO". Space starts game: `window.game.running = true`, show first wave.

Fighter jet enemy:
- Geometry: small `BoxGeometry(1.5, 0.3, 2)` + tiny wings, blue-grey color
- HP: 3; speed: medium (15 units/sec)
- AI: each frame, move toward `jet.position` with slight overshoot (`target + random offset ±2`)
- Push to `window.game.enemies` array on spawn

Wave 1: spawn 5 fighters with 1s delay between each.

**Verify:** AC-5 passes (`window.game.enemies.length > 0` within 3s of game start).
```bash
npx playwright test tests/aero-fighters/smoke.spec.js -g "AC-5"
```

---

### T10 — Implement helicopter + drone enemy types
Helicopter:
- `BoxGeometry(1.2, 0.5, 1.5)` body + 4 small flat `BoxGeometry` rotors (spin each frame)
- HP: 5; slow speed; fires burst of 3 `SphereGeometry(0.1)` red bullets every 2s toward player

Kamikaze drone:
- Small `ConeGeometry(0.3, 1, 4)`, fast, flies directly at jet, no weapon

Wave 2 onwards: mix of all 3 types per FR-04 wave table.

**Verify:** All 3 enemy types visible in scene. Helicopters fire red projectiles. Drones move faster than fighters.

---

### T11 — Implement missile pickup drops
On enemy death (HP ≤ 0):
- Fighter: 30% chance to spawn pickup; Helicopter: 50% chance
- Pickup: `SphereGeometry(0.3)`, green, `MeshBasicMaterial({color: 0x00ff00})`
- Floats at death position for 5s (slight up-down bob animation)
- On player AABB collision with pickup: `game.player.missiles = Math.min(5, game.player.missiles + 1)`, remove pickup

**Verify:** After killing several helicopters, green spheres appear at death positions. Player flying through sphere removes it and missile count increments.

---

### T12 — Implement missile system
On `X` keydown (if `game.player.missiles > 0`):
- Create missile: elongated `CylinderGeometry(0.08, 0.08, 1.2)`, white
- Find nearest enemy within 300 units (Euclidean distance check on `game.enemies` array)
- Each frame: lerp missile toward target position (turn rate capped: max 45° per frame delta)
- On hit: enemy HP -2, remove missile. If target dies mid-flight: missile continues to next nearest enemy or self-destructs at 300 units
- Deduct from `game.player.missiles`, update `#missiles` HUD

**Verify:** Firing X when enemy is in range sends white missile that tracks the enemy. Missile count in HUD decreases.

---

### T13 — Implement collision detection
Each frame, check:
1. Player bullets vs enemies: AABB distance < 0.8 → enemy HP -= 1
2. Enemy bullets vs player: AABB distance < 0.6 → player loses 1 life (if not invincible)
3. Enemy mesh vs player mesh: distance < 1.5 → player loses 1 life
4. Pickup vs player: distance < 1.0 → collect pickup

On enemy HP ≤ 0:
- Trigger explosion at position
- Remove from `game.enemies` and scene
- `game.score += killScore`; `game.kills += 1`
- Update `#score` and `#kills` HUD

**Verify:** AC-6 passes (setting `enemy.hp = 0` via evaluate → `#score` increases).
```bash
npx playwright test tests/aero-fighters/smoke.spec.js -g "AC-6"
```

---

### T14 — Implement player lives + game over
On life loss:
- Decrement `window.game.player.lives`
- Screen shake: `camera.position.x += (Math.random()-0.5)*2` for 18 frames
- Player flashes (toggle visibility every 5 frames) for 2s invincibility window

On `lives === 0`:
- Set `window.game.player.dead = true`
- Slow-motion: `game.timeScale = 0.5` for 1s
- Show overlay: "MISSÃO FALHOU", score, "PRESSIONE ESPAÇO PARA TENTAR NOVAMENTE"
- Space restarts: reset state, cycle 1, new game

**Verify:** AC-7 passes (setting `window.game.player.lives = 0` via evaluate shows "MISSÃO FALHOU").
```bash
npx playwright test tests/aero-fighters/smoke.spec.js -g "AC-7"
```

---

### T15 — ~~Implement boss fight~~ *(REMOVIDO)*

> **Backfill 2026-05-11:** Boss fight foi removido do escopo durante implementação. Mission complete agora é "todos os alvos estáticos destruídos" (ver `src/missions.js:checkMissionComplete`). Conteúdo original do T15 preservado no histórico git; ver `SPEC.md` §6 Out of Scope para nota "v2 backlog". Numeração mantida para preservar referências externas.

---

### T16 — Implement HUD updates
Wire all HUD elements to game state — called each frame:
- `#lives`: repeat "✈" × `game.player.lives` (or Unicode planes)
- `#score`: `SCORE: ${String(game.score).padStart(6,'0')}`
- `#missiles`: `MISSILES: ${'▲'.repeat(game.player.missiles)}`
- `#altitude`: `ALT: ${Math.round(game.player.y * 100)}m`
- `#kills`: `KILLS: ${game.kills}`

**Verify:** All HUD elements visible and update live during gameplay. Score changes immediately on kill.

---

### T17 — Implement explosion particle pool
Create pool of 20 particle meshes at init: `SphereGeometry(0.1)`, orange, `MeshBasicMaterial`.
All initially invisible (`mesh.visible = false`).

`triggerExplosion(position)`:
- Grab first available (invisible) particle from pool
- Set position, visible = true
- Expand scale from 0.1 to 1.5 over 0.8s, opacity fade to 0
- Return to pool when animation ends

**Verify:** Enemy deaths show orange particle burst. Pool never exceeds 20 visible particles (rapid kills reuse particles from pool).

---

### T18 — Implement speed lines effect
4 elongated `BoxGeometry(0.02, 0.02, 3)`, white, positioned at screen corners (converted to world space via unproject).
Opacity pulses between 0.1 and 0.5 using `Math.sin(Date.now() * 0.005)` — scales with current game speed.

**Verify:** Speed lines visible at screen edges. More prominent at high speed (late-game) than slow speed (start).

---

### T19 — Implement pause
On `Escape`/`P` keydown:
- Toggle `game.paused` boolean
- If paused: stop `requestAnimationFrame` update loop, show `#pause-overlay` div ("PAUSADO")
- If unpaused: resume loop, hide overlay
- Game also auto-pauses when `document.hidden` (tab switch)

**Verify:** P key pauses game (scene freezes). P key again resumes. Switching browser tabs auto-pauses.

---

### T20 — Implement difficulty loop (FR-11)
After "MISSION COMPLETE" 3s wait:
- `game.cycle += 1`
- `enemySpeedMultiplier = 1 + (game.cycle - 1) * 0.2` (cap at 2.5)
- Each wave: `baseEnemyCount + (game.cycle - 1) * 2` enemies
- Boss HP: `30 + (game.cycle - 1) * 10` (cap at 80)
- Player lives reset to 3
- `game.score` preserved (not reset)
- Restart from wave 1 with new multipliers

**Verify:** After defeating boss in cycle 1, enemies in cycle 2 visibly faster. Boss HP bar shows 40 HP in cycle 2. Score carries over from cycle 1.

---

### T21 — Performance + error check
Measure FPS over 10s. Verify ≤ 200 meshes in scene (`scene.children.length`). No console errors.

**Verify:** AC-2 and AC-8 pass.
```bash
npx playwright test tests/aero-fighters/smoke.spec.js -g "AC-2|AC-8"
```

---

### T22 — Full Playwright smoke suite
Run all 8 ACs. All must pass before this task is closed.

```bash
npx playwright test tests/aero-fighters/smoke.spec.js --reporter=list
```

**Verify:** Output shows `8 passed`. Screenshots saved to `tests/screenshots/aero-*.png`.

---

### T23 — Create README.md
Create `aero-fighters/README.md` per FR-10:
- Game name and one-line description
- How to run: "Open `index.html` in any modern browser with WebGL support"
- Controls table (Arrows, Space, X, Shift, P)
- Requirements note (internet for Three.js CDN, WebGL required)

**Verify:** File exists. All required sections present.

---

---

## Tasks adicionadas durante implementação (backfill 2026-05-11)

### T24 — Modularização do monolith para 15 ES modules

Distribuir lógica do monolithic `game.js` (2511 linhas) entre 15 módulos ES em `src/`:
`main`, `state`, `config`, `input`, `audio`, `scene`, `world`, `player`, `targets`, `projectiles`, `missions`, `fx`, `hud`, `crosshair` + `index.html` carregando como `<script type="module">`.

Auditoria do monolith original e justificativa da modularização em `aero-fighters/ARCHITECTURE.md`. Convenções em `aero-fighters/CONVENTIONS.md`.

**Verify:** Cada módulo respeita os limites de CONVENTIONS (≤250 linhas guideline; exceção: `targets.js` ~350 com 5 builders + AA AI). Zero side-effects no load (importar módulo não inicia game loop, áudio, ou adiciona mesh).

---

### T25 — Throttle + stall + gravity (full flight sim)

Implementar em `src/player.js`:
- Throttle controlado por W/S (target 0..1, convergência `CONVERGE_RATE=1.6/s`)
- Stall: HUD pisca `⚠ STALL` quando `speed ≤ STALL_SPD = 10 m/s`
- Gravity: 14 m/s² sempre puxando pra baixo
- Crash em terreno (mar Y ≤ 3 ou montanha via dome heightmap + `MOUNTAIN_BUFFER 2.5`) = morte instantânea

Constantes em `src/config.js:PLAYER`.

**Verify:** AC-8 (W aumenta throttle/speed), AC-9 (S diminui), AC-14 (S sustained causa stall).

---

### T26 — Heavy missile (B) tier

Implementar em `src/projectiles.js` + `src/main.js:fireHeavyMissile`:
- `MISSILES_HEAVY`: supply 10, dano 20 (5× light), turn rate 0.22 (close 0.45), range 1500m
- Tecla B; exige lock-on do crosshair (`src/crosshair.js:missileLockedTarget()`)
- HUD `#heavy-missiles` mostra `HVY: NN`

**Verify:** AC-11 (X dispara light e decrementa); manual: B dispara heavy e decrementa `game.player.heavyMissiles`.

---

### T27 — Static targets + AA defenders

Substituir enemy waves (T09-T10) por static targets em `src/targets.js`:
- 5 builders: `makeBase` (28HP, radar dish + barracks + flag), `makeFactory` (20HP, 3 smokestacks com smoke emitter), `makeBuilding` (14HP, multi-story tower), `makeConvoy` (12HP, 5 caminhões), `makeAAGun` (6HP, atira no player em range 220m)
- Layout fixo em `src/config.js:TARGET_LAYOUT` (16 entries; missão 1 usa 8, missão 2 usa 12, missão 3+ usa 16)
- Mega-explosion em kill de base/factory (`src/fx.js:megaExplosion`)
- AA fire AI: range 220m, base interval 1.7s, speedup -0.15s/ciclo

**Verify:** AC-12 (`game.targets.length > 0` em 3s; tipos válidos), AC-13 (kill incrementa score).

---

### T28 — Islands + dome heightmap + ambient flak

Implementar em `src/world.js`:
- 12 ilhas fixas em `src/config.js:ISLAND_DEFS` (cx, cz, radius, peakHeight)
- Cada ilha = dome heightmap (`islandHeightAt(x, z)` retorna altura do terreno em qualquer ponto)
- Player crash detection: cada frame compara `player.y` vs dome height + `MOUNTAIN_BUFFER`
- Oceano: `WORLD.OCEAN_SIZE = 10000`, fog near 300, far 700, sky color 0x87ceeb
- Nuvens: 60 sprites decorativos
- Ambient flak (decorative grey puffs) ativada após `cycle ≥ AMBIENT_FLAK_GATE_CYCLE = 2`

**Verify:** AC-6 (full vertical loop sem crash em céu aberto), AC-16 (scene renders coloured background).

---

## Done Condition

Todas as tasks T01-T28 complete (com T15 marcado como removido). `npx playwright test tests/aero-fighters/smoke.spec.js` mostra **18 passed**. `aero-fighters/README.md` existe. Operador abre `aero-fighters/index.html` (via `python3 -m http.server`) em browser e joga um jogo funcional de F-35 Ground Strike.

---

## Sprint 1 — Bug Fixes (2026-05-12)

> **Fonte:** `.dadaia/reports/game-developer/2026-05-12T000000Z-aero-fighters-gameplay-review.md`
> **SPEC:** §10 (Bug Fixes — Sprint 1), FR-06 (mayday visível até impacto), FR-12 (Heightmap consistency)
> **Aprovação operador:** "Sim. implemente." (2026-05-12)
>
> Cada task abaixo é **paralelizável** dentro do mesmo arquivo apenas se não conflitar em linhas. T-BF03 é independente (`config.js`). T-BF01 e T-BF02 mexem em arquivos distintos (`world.js` e `targets.js`) e podem rodar em paralelo, mas o autor deve estar ciente que ambas dependem da função `islandHeightAt()` corrigida (T-BF01) para resultado funcional final. T-BF04 é isolada em `player.js`.

### [x] T-BF01 — Corrigir `islandHeightAt()` (incluir noise na fórmula de colisão)

- **Arquivo:** `src/world.js:158-163`
- **O que fazer:** alinhar `islandHeightAt(isl, dx, dz)` com a fórmula usada por `createIsland()` para o mesh visual, incluindo o ruído senoidal de 4 octaves (`sin(x*0.18)*cos(z*0.14)*5 + sin(x*0.36+1.5)*cos(z*0.29+0.8)*2.5 + sin(x*0.72)*cos(z*0.63)*1.2 + sin(x*1.42+0.4)*cos(z*1.18-0.6)*0.6`). Aplicar `Math.max(0, parabola + noise)`. Alternativa permitida: `THREE.Raycaster` vertical contra o mesh da ilha, desde que determinístico e ≤ 1 ms por chamada.
- **Pré-condição:** nenhuma (independente de outras tasks do Sprint 1).
- **Pode rodar em paralelo com:** T-BF02, T-BF03, T-BF04.
- **Verificação:** voar próximo a montanhas confirma que avião não bate em "montanha invisível"; colisão e mesh coincidem visualmente; `checkTerrainCollision()` agora dispara em pontos onde o terreno renderizado realmente está. Smoke suite Playwright continua **18 passed**.
- **Requisito SPEC:** FR-12; §10.2.

### [x] T-BF02 — Corrigir `spawnTarget()` (usar altura real do terreno)

- **Arquivo:** `src/targets.js:232-234`
- **O que fazer:** garantir que o `yGround` passado para `mesh.position.set(worldX, yGround, worldZ)` corresponda à altura visível do mesh naquele `(x, z)`. Após T-BF01, o uso de `islandHeightAt()` (corrigida) já satisfaz o requisito. Caso a estratégia escolhida em T-BF01 seja raycast, replicar a mesma estratégia aqui ou reaproveitar uma função utilitária comum.
- **Pré-condição:** funcional somente após T-BF01 estar mergeada; pode ser **escrita em paralelo**, mas só passa nos testes manuais quando T-BF01 entrar.
- **Pode rodar em paralelo com:** T-BF01 (desenvolvimento), T-BF03, T-BF04.
- **Verificação:** nenhum alvo militar (base, factory, building, convoy, AA gun) aparece flutuando no ar ou enterrado no solo ao iniciar qualquer missão (1, 2, 3+). Inspeção visual em todas as 12 ilhas em `ISLAND_DEFS`. Playwright AC-12 continua passando.
- **Requisito SPEC:** FR-12; §10.1.

### [x] T-BF03 — Aumentar `MOUNTAIN_BUFFER` de 2.5 para 10 (paliativo imediato)

- **Arquivo:** `src/config.js:20`
- **O que fazer:** alterar a constante `MOUNTAIN_BUFFER` de `2.5` para `10`. É um paliativo enquanto T-BF01 não está mergeada; cobre o pico máximo de noise (~9.3 m). Pode ser revisado para baixo depois que T-BF01 entrar.
- **Pré-condição:** nenhuma. Mudança atômica de 1 linha.
- **Pode rodar em paralelo com:** T-BF01, T-BF02, T-BF04.
- **Verificação:** redução imediata e perceptível de colisões falsas com "montanha invisível" mesmo sem T-BF01. Playwright smoke suite continua **18 passed**.
- **Requisito SPEC:** FR-12 (parágrafo do paliativo); §10.3.

### [x] T-BF04 — Manter `jet.visible` durante mayday

- **Arquivo:** `src/player.js:322-326`
- **O que fazer:** remover `jet.visible = false` do callback de impacto no fluxo de mayday. O jet deve permanecer visível durante toda a queda (gravidade ampliada + tumble) até impactar o terreno/mar. A `megaExplosion('crash')` continua sendo disparada no impacto, mas `jet.visible = false` é movido para dentro de `_ejectAndRespawn()` (`player.js:422-435`) — só após explodir é que o mesh some, junto com o início do respawn.
- **Pré-condição:** nenhuma.
- **Pode rodar em paralelo com:** T-BF01, T-BF02, T-BF03.
- **Verificação:** ao ser abatido em qualquer altitude (especialmente em altitudes altas, 100+ unidades), o avião cai visivelmente em chamas e tumbling até bater no chão antes de explodir. Playwright smoke suite continua **18 passed** (incluindo AC-17 que cobre `lives = 0`).
- **Requisito SPEC:** FR-06 (bloco do mayday); §10.4.

### Sprint 1 — Done Condition

- T-BF01 + T-BF02 + T-BF03 + T-BF04 todos `[x]`.
- `npx playwright test tests/aero-fighters/smoke.spec.js --reporter=list` mostra **18 passed** (sem regressão dos 18 ACs originais).
- Inspeção visual do operador confirma:
  - Sem alvos flutuando.
  - Sem colisão em "montanha invisível".
  - Avião abatido cai visível até o impacto.
- AC-18 (FPS) permanece com a flakiness atual já documentada — não é objetivo do Sprint 1 (vai para Sprint 3 / FIX-09).

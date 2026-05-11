# SPEC: Aero Fighters Assault Replica

> **Status:** [x] Approved
> **Author:** dadaia Labs
> **Created:** 2026-05-09

---

## 1. Overview

> **Codename:** `aero-fighters` (mantido por inércia de paths/imports/testes)
> **Nome visível ao jogador:** **Aero Strike — F-35 Lightning II Ground Strike**

Jogo nasceu como uma replica de **Aero Fighters Assault** (N64, 1997, Paradigm Simulation) — combate aéreo arcade em terceira pessoa contra inimigos voadores + boss. Durante a implementação o conceito evoluiu para **ataque ao solo (air-to-ground)** com um F-35 Lightning II destruindo alvos militares estáticos (bases, fábricas, prédios, comboios) defendidos por canhões antiaéreos.

O core feel atual: **velocidade, barrel rolls, explosões massivas multi-camada, satisfação de travar e destruir um alvo militar**. Toda geometria continua procedural (primitivos Three.js), mas o aesthetic evoluiu de "blocky N64" para "stealth fighter facetado + PBR materials + sombras direcionais + skybox + fog".

**Por que esse jogo:** O conceito de combate aéreo arcade do N64 abriu espaço para um simulador leve de ataque ao solo, mais palatável para o público-alvo (Tauan, criança) — sem inimigos voadores hostis recorrentes, sem boss fight, com loop de missão claro (destrua todos os alvos → próxima missão).

---

## 2. Reference: Aero Fighters Assault (N64) — base histórica

> **Nota:** O jogo evoluiu para um conceito diferente durante a implementação (ver §1). Esta seção é preservada como **referência histórica** das mecânicas iniciais discutidas.

Mecânicas originalmente consideradas:
- Third-person camera locked behind the aircraft ✅ (mantido)
- Arcade flight: no stall speed, no realistic physics ❌ (substituído por full sim — ver FR-02)
- Vulcan cannon + limited missile stock with homing lock-on ✅ (mantido + 2 tiers de míssil — ver FR-03)
- Enemy waves of fighters, helicopters, drones ❌ (substituído por static targets — ver FR-04)
- End-of-level boss aircraft ❌ (removido — ver §6 Out of Scope, v2 backlog)
- Screen shake on taking damage ✅ (mantido)
- Barrel roll dodge maneuver ✅ (mantido — Shift)

---

## 3. Functional Requirements

### FR-01 — Scene & Camera
- Scene: sky (gradient background from deep blue at top to lighter blue at horizon) + scrolling ground plane (green/brown checkerboard texture drawn procedurally)
- Camera: always positioned 8 units behind + 3 units above the player jet, looking toward the jet nose
- Camera follows player with a slight lag (lerp factor 0.1) for a cinematic feel
- Horizon is always visible — pitch is clamped to ±45° to prevent the camera from pointing at the sky or ground only
- The ground scrolls continuously to give the sensation of forward flight

### FR-02 — Player Aircraft (F-35 Lightning II)

- **Model:** F-35 silhouette com fuselagem facetada stealth, asas trapezoidais sweptback, V-tails caudais canted, exausto único com glow, canopy bubble dark
- **Color:** jet grey + canopy escuro + flame yellow/orange no exausto
- **Physics:** full flight sim (não auto-fly)
  - `MAX_SPD = 80 m/s` (com throttle 100%), `MIN_SPD = 8 m/s`, `STALL_SPD = 10 m/s` (HUD pisca "STALL")
  - `GRAVITY = 14 m/s²` (sempre puxa pra baixo; throttle compensa)
  - `PITCH_RATE = 1.45 rad/s`, `ROLL_RATE = 2.30 rad/s`, `YAW_RATE = 0.80 rad/s`
  - `THROTTLE_UP_RATE = 1.3 /s`, `THROTTLE_DN_RATE = 0.9 /s`, convergência ao alvo `1.6 /s`
- **Posição inicial:** altura 80 unidades 3D (`START_HEIGHT`)
- **Crash conditions:** sea (Y ≤ 3) ou montanha (heightmap + `MOUNTAIN_BUFFER 2.5`) → morte instantânea (ver FR-06)
- Constantes vivem em `src/config.js:PLAYER`

### FR-03 — Player Controls

> **Pitch invertido (estilo simulador):** `↑` ArrowUp = nariz para BAIXO (dive); `↓` ArrowDown = nariz para CIMA (climb). Escolha estilística para sensação autêntica de F-35. Documentado também em `aero-fighters/README.md`.

| Action | Input | Effect |
|---|---|---|
| Pitch (nariz pra baixo) | `↑ ArrowUp` ou `I` | Mergulha — **pitch invertido estilo simulador** |
| Pitch (nariz pra cima) | `↓ ArrowDown` ou `K` | Climbs — **pitch invertido estilo simulador** |
| Roll + yaw coordenado | `← →` ou `A`/`D` | Rolagem com yaw acoplado |
| Rudder puro | `Q`/`E` | Yaw puro (sem roll); multiplicador `RUDDER_FACTOR = 0.65` |
| Throttle up | `W` | Acelera (target = 1.0); convergência 1.6 /s |
| Throttle down / airbrake | `S` | Desacelera (target = 0.0) |
| Vulcan cannon | `Space` ou `Z` | 12.5 r/s (`RATE = 0.08s`), 2 canos nas asas (offset 0.65 m) |
| Homing missile (light) | `X` | Dano 4, supply **100**, range 1200 m, turn rate 0.30 rad (close 0.55) — exige lock-on |
| Homing missile (heavy) | `B` | Dano 20 (5× light), supply **10**, range 1500 m, turn rate 0.22 (close 0.45) — exige lock-on |
| Barrel roll | `Shift` | 360° camera roll over 0.5s; invencível durante; cooldown 1.5s |
| Pause | `P` ou `Esc` | Toggle pause overlay "PAUSADO" |
| Mute | `M` | Toggle Web Audio engine |
| Start / Restart | `Space` ou `Enter` (em título / game over) | Inicia missão ou reinicia após game over |

- **Missile stock inicial:** **100 light + 10 heavy** (rebalanceado vs SPEC v1 que tinha 5 — atual permite arcade prolongado para criança)
- **Missile lock-on:** ambos os tiers (light/heavy) exigem alvo travado pelo crosshair antes de disparar (sem lock-on, disparo é cancelado e toca som de erro)
- **Pickups (esferas verdes):** restauram 1 light missile cada (drop chance varia por tipo de alvo — ver FR-04)
- Constantes em `src/config.js:CANNON`, `MISSILES_LIGHT`, `MISSILES_HEAVY`, `ROLL`

### FR-04 — Static Targets (Ground Strike Mission)

O jogo é **air-to-ground**. Alvos são estruturas militares estáticas posicionadas em ilhas (12 ilhas fixas em `ISLAND_DEFS`).

| Tipo | HP base | Score | Hitbox radius² | Drop chance (light missile pickup) | Notas |
|---|---|---|---|---|---|
| Military Base | 28 | 800 | 36 | 60% | Radar dish + barracks + flag |
| Factory | 20 | 600 | 28 | 50% | 3 smokestacks com smoke emitter contínuo |
| Terrorist Building | 14 | 450 | 18 | 30% | Multi-story tower com janelas acesas + antena |
| Troop Convoy | 12 | 380 | 60 | 40% | Linha de 5 caminhões militares |
| AA Gun | 6 | 250 | 9 | 10% | **Única defesa hostil** — atira no player em range 220 m |

**AA Gun (canhão antiaéreo):**
- Range: **220 m** (`AA.RANGE`)
- Base fire interval (cycle 1): **1.7 s** (`AA.BASE_INTERVAL`)
- Speedup por ciclo: **-0.15 s** (`AA.CYCLE_SPEEDUP`), cap em -0.7 s total (`AA.MAX_SPEEDUP`)
- Projétil: `SphereGeometry`, vermelho, velocidade média

**Mega-explosion em kill de base/factory:** fireball + shockwave (`RingGeometry`) + debris (`BoxGeometry` com gravidade) + smoke rising. Player crash adiciona white flash + double shockwave.

**Pickups (esferas verdes):** spawn na posição de morte do alvo conforme `dropChance`. Restauram 1 light missile cada. Floam in place 5s, removidos em contato com player.

**Layout fixo por missão:** definido em `src/config.js:TARGET_LAYOUT` (16 entries; missão 1 usa as 8 primeiras, missão 2 usa 12, missão 3+ usa as 16). Cada entry: `[islandIndex, dx, dz, tipo]`.

### FR-05 — *(removido)*

> Boss fight removido nesta versão. Conteúdo migrado para §6 Out of Scope com nota "v2 backlog". Numeração FR-05 fica vazia para preservar referências históricas em PRs/commits.

### FR-06 — Player Health, Lives & Crash

- Player começa com **3 vidas** (icons `♥♥♥` no HUD top-left)
- Tomar hit (bala inimiga de AA, colisão com alvo): -1 vida; shake 0.3s; 2s invincibility (jet pisca, `flags.invincibility`)
- **Última vida perdida:** slow-motion 0.5× por 1s → overlay "MISSÃO FALHOU — pressione Espaço para tentar novamente"
- **Crash em terreno (mar Y ≤ 3 ou montanha via heightmap dome + `MOUNTAIN_BUFFER 2.5`) = morte instantânea independente de vidas remanescentes.** Tela: white flash + double shockwave + "MISSÃO FALHOU" imediato. Crash freeze 2s (`flags.crashFreezeTime`) antes de habilitar restart (evita reinício acidental).
- **Restart:** reseta state (via `resetState()` em `src/state.js`), cycle 1, mission 1

### FR-07 — Scoring
- Score displayed top-center: `SCORE: 000000` (zero-padded 6 digits)
- Fighter kill: +100, helicopter kill: +150, drone kill: +50, boss kill: +1000
- Score multiplier × 2 for kills during barrel roll invincibility window
- High score persisted via `localStorage`

### FR-08 — HUD Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ MISSÃO N   ♥♥♥   SCORE: 001250   MSLS: 087   HVY: 08   SPD: 64   THR: 80%   │
│                                  ALT: 1450m   ALVOS: 5/8   ⚠ STALL    🔊 SOM │
│                                                                              │
│                              [3D SCENE]                                      │
│                                                                              │
│                              [crosshair / lock-on reticle]                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

Todos os elementos HTML em overlay (`pointer-events: none` exceto `#sound-toggle`).

| Elemento | ID | Conteúdo |
|---|---|---|
| Missão atual | `#mission` | `MISSÃO N` (N = `game.cycle`) |
| Vidas | `#lives` | `♥` × `game.player.lives` |
| Score | `#score` | `SCORE: NNNNNN` (6 dígitos zero-padded) |
| Light missiles | `#missiles` | `MSLS: NNN` |
| Heavy missiles | `#heavy-missiles` | `HVY: NN` |
| Speed | `#speed` | `SPD: NN` (m/s) |
| Throttle | `#throttle` | `THR: NN%` |
| Altitude | `#altitude` | `ALT: NNNNm` (decorative, calculado de player.y) |
| Alvos | `#targets` | `ALVOS: targetsDestroyed/targetsTotal` |
| Stall warning | `#stall-warn` | `⚠ STALL` (visível quando `player.stalled === true`, blink 0.4s) |
| Sound toggle | `#sound-toggle` | Botão clicável `🔊 SOM` / `🔇 SOM` |

Crosshair / reticle de lock-on é renderizado dentro da scena 3D (`src/crosshair.js`).

### FR-09 — Effects
| Effect | Implementation |
|---|---|
| Bullet trail | Small white CylinderGeometry, removed after 0.3s |
| Missile trail | Thin white cone following missile path |
| Explosion | 20 SphereGeometry particles, orange/red, expand and fade over 0.8s |
| Screen shake | Camera offset ±2 units random for 0.3s on hit received |
| Speed lines | 4 elongated BoxGeometry lines at screen edges, opacity pulses with speed |
| Barrel roll | Camera Z-rotation animates 360° over 0.5s |

---

## 4. Non-Functional Requirements

### NFR-01 — Performance
- **Deve manter ≥ 45 FPS em laptop mid-range com GPU** (requisito de hardware real)
- AC de teste mede **≥ 15 FPS over 8s em headless chromium** (software rendering + PBR + skybox + tracers degradam significativamente — ver AC-18 e `testing-infra/SPEC.md` FR-05)
- Scene object limit: pools enforce mesh budget — bullets, particles, debris, smoke, shockwaves todos pooled (ver `src/projectiles.js` e `src/fx.js`)
- Mega-explosion = fireball + ring shockwave + tumbling debris + rising smoke (todos recycled via pool)

### NFR-02 — Zero External Asset Dependencies
- No `.gltf`, `.obj`, or image texture files — all geometry is Three.js primitives
- Three.js r165 carregado de `vendor/three.module.min.js` (ES module build, commitado por testing-infra T08)
- Aesthetic evoluiu de "N64 blocky" para "stealth fighter facetado + PBR materials + skybox + fog + sombras direcionais"

### NFR-03 — No Build Step
- `index.html` + `src/*.js` (ES modules via `<script type="module">`) — abre `index.html` direto via `python3 -m http.server` (CORS exige HTTP, não `file://`)
- No npm install, no bundler, no compilation

### NFR-04 — Responsive Canvas
- Canvas fills the full browser window; resizes on window resize
- Game pauses automatically when window loses focus

---

## 5. Acceptance Criteria (Automated — Playwright)

Todos os ACs abaixo passam via `tests/aero-fighters/smoke.spec.js` antes de qualquer task ser fechado. **18 ACs** refletem o estado atual do jogo (expansão da versão v1 que tinha 8).

| ID | Test | Pass Condition |
|---|---|---|
| AC-1 | 3D canvas renders | `<canvas>` element existe; screenshot mostra pixels não-pretos (sky visible) em até 1s |
| AC-2 | No console errors | Zero `console.error` calls durante load e 5s idle |
| AC-3 | Starts with 100 missiles | `game.player.missiles === 100` no início (light missile supply) |
| AC-4 | ArrowDown pitches nose UP — jet climbs | Pressionar `↓` → `game.player.pitch` muda no sentido correto (pitch invertido) em até 300ms |
| AC-5 | ArrowUp pitches nose DOWN — jet descends | Pressionar `↑` → `game.player.pitch` muda no sentido correto |
| AC-6 | Jet survives full vertical loop (360° pitch) | Sequência de inputs completa loop sem crash |
| AC-7 | ArrowLeft rolls and turns jet left | `← `→ jet.rotation.z muda + posição lateral altera |
| AC-8 | W key increases throttle and speed | `W` → `game.player.throttle` e `game.player.speed` sobem |
| AC-9 | S key decreases throttle and speed | `S` → `game.player.throttle` e `game.player.speed` descem |
| AC-10 | Space fires cannon projectile | `Space` → `game.projectiles.length` aumenta em 200ms |
| AC-11 | X fires homing missile after lock-on, decrements counter | `X` com alvo travado → `game.player.missiles` decrementa |
| AC-12 | Mission spawns static military targets | `game.targets.length > 0` em até 3s após start; tipos ∈ {base, factory, building, convoy, aaGun} |
| AC-13 | Killing enemy increments score | Setar `target.hp = 0` via evaluate → `#score` aumenta |
| AC-14 | Sustained S key causes stall or near-stall speed | `S` mantido → `game.player.speed` ≤ `STALL_SPD` ou flag `stalled === true` |
| AC-15 | Shift barrel roll keeps jet alive | `Shift` → animação completa sem player.dead |
| AC-16 | Scene renders coloured background (sky + ocean) | Screenshot tem pixels coloridos (não preto, não branco puro) |
| AC-17 | Setting player lives to 0 shows MISSÃO FALHOU | `game.player.lives = 0` via evaluate → overlay "MISSÃO FALHOU" |
| AC-18 | FPS ≥ 15 over 8s (headless) | Hook de `requestAnimationFrame` mede ≥ 15 FPS over 8s. **NFR-01 ≥ 45 só verificável em hardware real com GPU.** |

---

## 6. Out of Scope

- Multiple playable aircraft
- Multiplayer
- Full campaign (8 missions like the original)
- Voice acting or music
- Mobile touch controls (desktop keyboard only for v1)
- **Q/E directional barrel roll** — fidelidade ao N64 original; reaproveitado como **rudder puro** no jogo atual (ver FR-03)
- **Boss fight (FR-05 original)** — v2 backlog. Não combina com o conceito atual (ataque ao solo, alvos estáticos, sem inimigos voadores recorrentes). Reavaliar se Tauan pedir um "chefe de fase".

---

## 7. File Layout

```
aero-fighters/
├── index.html              ← Carrega three.module.min.js e src/main.js como <script type="module">; HUD HTML overlay
├── README.md               ← Instruções de uso, controles, mission flow (FR-10)
├── AGENTS.md               ← Orientação para agentes IA (opcional — constitution Princípio 3 revisado)
├── ARCHITECTURE.md         ← Auditoria do monolito original + decisões de modularização
├── CONVENTIONS.md          ← Convenções de código (tamanho de módulo, naming, side-effects)
└── src/                    ← 15 ES modules (~2500 linhas totais)
    ├── main.js             ← Entry point: wire-up de módulos, game loop, câmera
    ├── state.js            ← Estado global `game` (única fonte de verdade); exposto em `window.game`
    ├── config.js           ← Constantes: PLAYER, CANNON, MISSILES_LIGHT, MISSILES_HEAVY, TARGETS, AA, MISSION, WORLD, COLORS, TARGET_LAYOUT, ISLAND_DEFS
    ├── input.js            ← Listeners de teclado, sistema de actions (start, fire, missile, heavyMissile, roll, pause, mute)
    ├── audio.js            ← Motor Web Audio: engine rumble, cannon, missile, explosions, AA fire
    ├── scene.js            ← Cena Three.js, câmera, renderer, luzes, sombras, fog, resize handler
    ├── world.js            ← Oceano procedural, ilhas (dome heightmap), nuvens, ambient flak
    ├── player.js           ← F-35 mesh + física de voo (throttle, stall, pitch/roll/yaw, crash detection)
    ├── targets.js          ← Builders de alvos (base/factory/building/convoy/aaGun) + AA fire AI
    ├── projectiles.js      ← Pools de balas (player/inimigo), mísseis homing (light/heavy), pickups
    ├── missions.js         ← Spawn de missão, mission complete, game over, next mission cycle
    ├── fx.js               ← Pools de partículas, debris, fumaça, shockwaves, flashes, mega-explosões
    ├── hud.js              ← Updates do HUD DOM (score, lives, speed, throttle, alvos, stall warning, sound icon)
    └── crosshair.js        ← Reticle 3D + lock-on alvo do míssil

vendor/                     ← (compartilhado entre jogos; commitado por testing-infra T08)
└── three.module.min.js     ← Three.js r165 ES module build
```

### FR-10 — README.md (required by constitution Princípio 3)
O `aero-fighters/README.md` deve conter:
- Descrição one-line do jogo (Aero Strike — F-35 Ground Strike)
- Como rodar: `python3 -m http.server 8080` + abrir `http://localhost:8080/aero-fighters/index.html`
- Controles completos (matching FR-03)
- Mission flow (Mission 1 = 8 alvos, Mission 2 = 12, Mission 3+ = 16)
- Requirements: browser moderno com WebGL; sem internet em runtime (vendor local)
- Avisos: pitch invertido; crash em terreno = morte instantânea

### FR-11 — Mission Difficulty Loop

Após "MISSÃO COMPLETA" (todos os alvos destruídos), o jogo avança para próxima missão com dificuldade incrementada:

- **Mission 1:** 8 alvos (primeiras 8 entries de `TARGET_LAYOUT`)
- **Mission 2:** 12 alvos
- **Mission 3+:** 16 alvos (todos)
- **HP de cada alvo:** `+3 por ciclo` (`MISSION.HP_BONUS_PER_CYCLE`)
- **AA fire interval:** `-0.15s por ciclo` (cap em -0.7s, ver `AA.CYCLE_SPEEDUP` / `MAX_SPEEDUP`)
- `game.cycle` incrementa por missão completada
- `game.score` acumula entre missões
- Lives **não** resetam entre missões (player precisa sobreviver continuamente)
- Ambient flak (decorative grey puffs) começa a aparecer após `cycle ≥ 2` (`WORLD.AMBIENT_FLAK_GATE_CYCLE`)
- Overlay de transição: `MISSION.COMPLETE_DELAY_MS = 2400ms` + `NEXT_OVERLAY_MS = 2200ms`

---

## 8. Open Questions

_(none at spec creation time)_

---

## 9. Approval

- [x] Draft reviewed by operator
- [x] **Status:** [x] Approved — 2026-05-09
- [x] **Status:** [x] Approved — 2026-05-11 — Backfill aprovado pelo operador. Implementação verificada: 18 ACs passando, modularização 15 ES modules, F-35 Ground Strike sim. Ver `.dadaia/reports/refine-specs.md` para detalhes.

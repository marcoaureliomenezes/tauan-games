# PLAN: Aero Fighters Assault Replica

> **Status:** [x] Approved
> **SPEC:** `specs/features/aero-fighters/SPEC.md` [x] Approved
> **Depends on:** `testing-infra` TASKS complete (Playwright + smoke suite file in place)
> **Created:** 2026-05-09

---

## Context

> **Backfill 2026-05-11:** Plano original assumiu single-file `game.js`. Implementação evoluiu para 15 ES modules em `src/` e o conceito mudou de "combate aéreo arcade" para "Aero Strike — F-35 Ground Strike" (ver `SPEC.md` §1 atualizada). Esta versão do PLAN reflete a arquitetura modular real.

Third-person 3D F-35 ground strike no browser. Geometria procedural via primitivos Three.js — no `.gltf` ou image files. Aesthetic: stealth fighter facetado + PBR materials + skybox + fog + sombras direcionais. **15 ES modules em `src/`** carregados via `<script type="module">` em `index.html`. Sem build step (vendor Three.js commitado em `vendor/three.module.min.js`). Playwright smoke suite (**18 ACs**) deve passar antes de delivery.

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| Three.js r165 via `vendor/three.module.min.js` (ES module) | Best 3D in browser sem build step; ES module habilita modularização nativa via `import * as THREE` |
| **Modularização em 15 ES modules em `src/`** | Auditoria do monolith 2511-line em `aero-fighters/ARCHITECTURE.md` mostrou 24 concerns misturados. Separação por responsabilidade (state/input/audio/scene/world/player/targets/projectiles/missions/fx/hud/crosshair/config). Legibilidade + manutenibilidade por iniciante + agente IA. |
| HTML overlay for HUD | Keeps HUD text crisp (DOM rendering) sem precisar de Three.js text sprites ou bitmap fonts |
| Object pooling em projectiles, particles, debris, smoke, shockwaves | High-frequency spawn/destroy causa GC stutters que matam FPS; pools enforced em `src/projectiles.js` e `src/fx.js` |
| `window.game.projectiles`, `targets`, `enemies` (alias) arrays | Dedicated arrays (não `scene.children`) tornam ACs unambiguous e dão pool management limpo. `enemies` é alias de `targets` mantido para compat com tests legados. |
| `Q/E` reaproveitado como rudder puro | Barrel roll v1 = Shift (mantido). Q/E direcional do N64 original virou yaw puro no F-35 (mais usável em air-to-ground). |
| Game loop via `requestAnimationFrame` + `THREE.Clock` delta | Standard Three.js pattern; delta-time ensures speed-correct physics across frame rates |
| **Full flight sim** (throttle + stall + gravity) | Substituiu "auto-fly constant speed" do plano original. Operador validou — sensação autêntica F-35; criança aprende throttle. |
| **Crash em terreno = instant death** | Substituiu lives-system genérico. Reforça "voe com cuidado"; restart 2s crash freeze evita reinício acidental. |
| **2 tiers de míssil (light X, heavy B)** | Light supply alto (100) permite arcade prolongado para criança; heavy (10) recompensa precisão (5× dano). Drop pickups em `dropChance` por tipo. |
| Mission difficulty loop ([8, 12, 16] alvos por ciclo, HP+3, AA speedup) | Substituiu difficulty multiplier do FR-11 original. Progressão clara, sem boss. |
| `aero-fighters/AGENTS.md` + `ARCHITECTURE.md` + `CONVENTIONS.md` | Docs operacionais para colaboração (humanos + agentes IA). Constitution Princípio 3 revisado permite docs adicionais quando o jogo cresce além de 1 arquivo. |

---

## Implementation Phases

### Phase 1 — Foundation (T01–T02)
`index.html`: loads Three.js r165 CDN, HUD overlay HTML (absolute-positioned divs over canvas), loads `game.js`.
`game.js` skeleton: `THREE.Scene`, `THREE.WebGLRenderer` (fullscreen), `THREE.PerspectiveCamera`, `requestAnimationFrame` loop. Exposes `window.game` contract. Verify AC-1 (3D canvas renders) and AC-2 (no console errors).

### Phase 2 — Scene (T03)
Sky: `scene.background = new THREE.Color(...)` with gradient shader or CSS background behind canvas.
Ground: large `THREE.PlaneGeometry` with procedural checkerboard via `THREE.CanvasTexture` (green/brown squares drawn once to an offscreen 2D canvas).
Ground scrolls via `mesh.position.z += speed * delta` loop, reset when out of view.

### Phase 3 — Player jet (T04)
F-14 silhouette assembled from Three.js primitives:
- Fuselage: `BoxGeometry(0.5, 0.4, 3)`, dark grey
- Wings: two flat `BoxGeometry(2.5, 0.05, 1.2)`, angled back
- Tail fins: two `BoxGeometry(0.05, 0.6, 0.8)`, vertical
- Cockpit: `BoxGeometry(0.3, 0.3, 0.5)`, orange material

### Phase 4 — Camera (T05)
`camera.position.set(jet.x, jet.y + 3, jet.z - 8)` each frame with lerp.
Horizon preservation: pitch clamped ±45°, camera lookAt = jet.position + forward vector.

### Phase 5 — Player controls (T06–T07)
Arrow/WASD: bank (`rotation.z`) and pitch (`rotation.x`), clamped ±45°.
Shift: barrel roll — animates `camera.rotation.z` 360° over 0.5s, sets `player.invincible = true` for duration, 1.5s cooldown. Verify AC-3 (pitch changes on Down Arrow).

### Phase 6 — Cannon system (T08)
Space/Z: spawn `CylinderGeometry(0.05, 0.05, 0.5)` white bullet at jet nose every 100ms.
Push to `window.game.projectiles` pool. Remove from pool + scene after 2s or on hit.
Rate limiter: max 10 bullets simultaneously. Verify AC-4 (projectiles.length increases).

### Phase 7 — Enemy spawner + AI (T09–T10)
Wave system: spawn off-screen edges. Fighter: `BoxGeometry` body + tiny wings, blue-grey, hunting AI.
Enemy spawns after game start. Verify AC-5. Game start = Space on title screen.

### Phase 8 — All enemy types + pickup drops (T11–T12)
Add helicopter (BoxGeometry + rotors, slow, burst fire) and kamikaze drone (small cone, fast, direct charge).
Pickup: green `SphereGeometry`, spawns at enemy death position (30% fighters, 50% helicopters), floats 5s, destroyed on player contact, restores 1 missile.

### Phase 9 — Collision detection (T13–T14)
AABB (axis-aligned bounding box) distance checks: projectile vs enemies, player vs enemies, player vs pickup.
Enemy HP reduction → death → explosion. Player hit → life loss → shake. Score update on kill. Verify AC-6, AC-7.

### Phase 10 — Missile system (T15)
X key: create homing missile (elongated `CylinderGeometry`, white). Missile tracks `nearest enemy` within 300 units (update target each frame, lerp toward it). Deducts from `window.game.player.lives`... wait, from `game.missiles` stock. Max 5, replenished by pickups.

### Phase 11 — Boss fight (T16)
Triggers at 30 kills. Boss: large `BoxGeometry(3, 1, 5)` + big wings, dark red. Circles player at distance 15. Fires `THREE.ConeGeometry` missile salvos (3 per 4s). HP bar injected into HUD overlay.

### Phase 12 — HUD overlay (T17)
All DOM: `#lives` (3 jet icons as Unicode ✈ or SVG), `#score`, `#missiles`, `#boss-bar` (hidden by default), `#altitude`, `#kills`. Updated each frame via `document.getElementById` writes.

### Phase 13 — Effects (T18–T19)
Explosion pool: 20 `SphereGeometry(0.1)` particles per pool slot. On trigger: expand + fade `opacity` over 0.8s, return to pool.
Screen shake: `camera.position.x += (Math.random()-0.5)*2` for 0.3s on hit.
Speed lines: 4 `BoxGeometry(0.05, 0.05, 3)` at screen corners, opacity pulse with speed.

### Phase 14 — Difficulty loop (T20)
`game.cycle` counter. On boss death: show "MISSION COMPLETE / CICLO N" for 3s, increment cycle, apply FR-11 multipliers to wave spawner and boss HP. Score does not reset.

### Phase 15 — Pause + polish (T21)
Esc/P: freeze `requestAnimationFrame` updates, show `#pause-overlay`. Unpause resumes.

### Phase 16 — Quality gate (T22–T24)
FPS check (AC-8 ≥ 45). No console errors (AC-2). Full Playwright suite green. README.md.

---

## Risk & Mitigation

| Risk | Mitigation |
|---|---|
| Three.js CDN unavailable in tests | Resolved: Three.js loaded from `vendor/three.min.js` (committed to repo by testing-infra T08) — no network dependency at test time |
| FPS < 45 due to too many meshes | Object pool enforces max 200 meshes (NFR-01). Profile during T22 and cut effects if needed. |
| Homing missile too hard to dodge | Missile turn rate capped at 45°/frame — child can outmaneuver with bank |
| Ground scroll Z-fighting | Slight `position.y` offset on ground plane eliminates Z-fighting with explosion particles |

---

## File Layout (result)

```
aero-fighters/
├── index.html
├── README.md
├── AGENTS.md               ← Opcional — orientação para agentes IA (Princípio 3 revisado)
├── ARCHITECTURE.md         ← Opcional — auditoria + decisões de modularização
├── CONVENTIONS.md          ← Opcional — regras de código
└── src/
    ├── main.js             ← Entry point / wire-up / game loop / câmera
    ├── state.js            ← Estado global game / window.game
    ├── config.js           ← Constantes (PLAYER, CANNON, MISSILES_LIGHT/HEAVY, TARGETS, AA, MISSION, WORLD, COLORS, layouts)
    ├── input.js            ← Listeners de teclado, sistema de actions
    ├── audio.js            ← Motor Web Audio
    ├── scene.js            ← Cena Three.js, câmera, renderer, luzes, sombras
    ├── world.js            ← Oceano, ilhas, nuvens, ambient flak
    ├── player.js           ← F-35 mesh + física de voo (throttle, stall, crash)
    ├── targets.js          ← Builders de alvos + AA fire AI
    ├── projectiles.js      ← Pools de balas + mísseis homing + pickups
    ├── missions.js         ← Mission spawn/complete/over/next
    ├── fx.js               ← Pools de partículas, debris, fumaça, shockwaves
    ├── hud.js              ← Updates do HUD DOM
    └── crosshair.js        ← Reticle 3D + lock-on

vendor/three.module.min.js  ← Three.js r165 ES module (commitado por testing-infra T08)
```

Ver `SPEC.md` §7 para descrição detalhada de cada módulo.

---

## Verification

```bash
# Run Aero Fighters smoke suite only
npx playwright test tests/aero-fighters/smoke.spec.js --reporter=list

# Expected output after all phases complete (18 ACs):
# ✓ AC-1  3D canvas renders with visible pixels
# ✓ AC-2  no console errors on load
# ✓ AC-3  starts with 100 missiles
# ✓ AC-4  ArrowDown pitches nose UP — jet climbs
# ✓ AC-5  ArrowUp pitches nose DOWN — jet descends
# ✓ AC-6  jet survives full vertical loop (360° pitch)
# ✓ AC-7  ArrowLeft rolls and turns jet left
# ✓ AC-8  W key increases throttle and speed
# ✓ AC-9  S key decreases throttle and speed
# ✓ AC-10 Space fires cannon projectile
# ✓ AC-11 X fires homing missile (após lock-on) e decrementa counter
# ✓ AC-12 mission spawns static military targets
# ✓ AC-13 killing enemy increments score
# ✓ AC-14 sustained S key causes stall or near-stall speed
# ✓ AC-15 Shift barrel roll keeps jet alive
# ✓ AC-16 scene renders coloured background (sky + ocean)
# ✓ AC-17 setting player lives to 0 shows MISSÃO FALHOU
# ✓ AC-18 FPS >= 15 over 8s (headless; NFR-01 ≥45 só em hardware real)
```

---

## Approval

- [x] Draft reviewed by operator
- [x] **Status:** [x] Approved — 2026-05-09
- [x] **Status:** [x] Approved — 2026-05-11 — Backfill aprovado pelo operador. Plano de modularização executado: 15 ES modules, full sim physics, ground-strike. 18 ACs passando. Ver `.dadaia/reports/refine-specs.md`.

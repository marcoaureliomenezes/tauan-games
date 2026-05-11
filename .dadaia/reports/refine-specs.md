# Refinamento de Specs — tauan-games

> **Gerado em:** 2026-05-11T02:16:49Z
> **Escopo:** `aero-fighters` (+ cascata em `testing-infra`, `memory/product.md`, `memory/tech-stack.md`, `constitution.md`)
> **Tipo de refinamento:** **Backfill** — código atual é a fonte de verdade; specs ajustam para refletir o estado real
> **Problemas encontrados:** 9 | **Resolvidos:** 9 | **Abertos:** 0

---

## Contexto

Auditoria SDD anterior detectou **major drift** entre `specs/features/aero-fighters/SPEC.md` (Aero Fighters Assault — combate aéreo arcade, N64) e o código implementado (`aero-fighters/src/*.js` — Aero Strike, F-35 Ground Strike, 15 ES modules). Operador instruiu: **manter código, refinar specs para o estado atual** (opção 2 do protocolo de remediação de drift).

Este report consolida as decisões tomadas na sessão de grilling e enumera as edições pendentes nos arquivos.

---

## Sumário de Problemas e Decisões

| # | Tipo | Specs envolvidas | Decisão | Status |
|---|------|------------------|---------|--------|
| 1 | Drift de identidade | `aero-fighters/SPEC.md` §1 | Codename `aero-fighters` mantido; SPEC Overview documenta evolução para "Aero Strike — F-35 Ground Strike" | ✅ Resolvido |
| 2 | Constitution Princípio 3 | `constitution.md` linha 18 | Relaxar: README sempre obrigatório; AGENTS/ARCHITECTURE/CONVENTIONS opcionais para jogos modularizados | ✅ Resolvido |
| 3 | Drift file layout | `aero-fighters/SPEC.md` §7 + `PLAN.md` | SPEC §7 lista os 15 módulos ES com 1 linha de responsabilidade cada | ✅ Resolvido |
| 4 | Funcional removido | `aero-fighters/SPEC.md` FR-05 | Boss fight movido para §6 Out of Scope com nota "v2 backlog" | ✅ Resolvido |
| 5 | Drift de NFR (FPS) | `aero-fighters/SPEC.md` NFR-01 + AC-8; `testing-infra/SPEC.md` FR-05 | NFR ≥45 FPS em hardware real preservado; AC de teste ≥15 FPS em headless documentado separado | ✅ Resolvido |
| 6 | UX | `aero-fighters/SPEC.md` FR-03 + README | Pitch invertido mantido como feature estilística de simulador; documentado na SPEC | ✅ Resolvido |
| 7 | Múltiplas mudanças funcionais | `aero-fighters/SPEC.md` FR-02/FR-03/FR-04/FR-06/FR-11 | Backfill batch — FR-02 ganha throttle/stall; FR-03 controles novos (W/S/Q/E/B + 100 light + 10 heavy missiles); FR-04 substitui enemies por static targets; FR-06 adiciona crash instantâneo; FR-11 substitui multipliers | ✅ Resolvido |
| 8 | Drift testing-infra | `testing-infra/SPEC.md` FR-01 + AC-T3 + §7 | 18 ACs documentados; vendor `three.module.min.js`; AC-T3 atualizado de "8 ACs pass" para "18 ACs pass" | ✅ Resolvido |
| 9 | Memory stale | `memory/product.md`; `memory/tech-stack.md` | product.md: status Draft → Approved nos dois jogos; tech-stack.md: "CDN only" → "Vendor local commitado em `vendor/`" | ✅ Resolvido |

---

## Detalhes por Decisão

### Decisão #1 — Identidade do jogo

**Tipo:** Drift de identidade
**Specs:** `specs/features/aero-fighters/SPEC.md` §1; path `specs/features/aero-fighters/`

**Descrição:** README e index.html chamam o jogo de "Aero Strike — F-35 Lightning II Ground Strike". SPEC ainda intitula "Aero Fighters Assault Replica" e descreve combate aéreo arcade.

**Pergunta feita:** Como nomear o jogo nas specs após o backfill?
**Resposta:** "Manter tudo como 'aero-fighters'" — codename interno permanece; SPEC Overview deixa clara a evolução do conceito.

**Resolução:**
- Path da feature: **inalterado** (`specs/features/aero-fighters/`)
- Path do código: **inalterado** (`aero-fighters/`)
- Título da SPEC: **inalterado** (`# SPEC: Aero Fighters Assault Replica`)
- §1 Overview: **reescrito** para explicar: jogo nasceu como "replica de Aero Fighters Assault N64", evoluiu para "Aero Strike — F-35 Lightning II Ground Strike" durante implementação. Codename `aero-fighters` mantido por inércia de paths/imports/testes.

---

### Decisão #2 — Documentos sidecar e Constitution Princípio 3

**Tipo:** Drift constitucional
**Specs:** `specs/constitution.md` linha 18 vs `aero-fighters/AGENTS.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`

**Descrição:** Constitution diz "Documentação mínima — README por jogo". `aero-fighters/` tem 3 docs extras totalizando ~40 KB de conteúdo operacional (orientação para agentes IA, auditoria arquitetural, regras de código).

**Pergunta feita:** Como tratar os 3 docs extras?
**Resposta:** "Relaxar constitution, manter docs" — conhecimento operacional é valioso.

**Resolução:**
- `constitution.md` Princípio 3: substituir por `"3. **Documentação mínima** — README por jogo é obrigatório com instruções de como rodar. Documentos adicionais (AGENTS.md, ARCHITECTURE.md, CONVENTIONS.md) são opcionais quando o jogo cresce além de 1 arquivo e precisa orientar agentes/colaboradores."`
- Docs em `aero-fighters/` permanecem onde estão.

---

### Decisão #3 — File layout dos 15 módulos

**Tipo:** Drift de file layout
**Specs:** `aero-fighters/SPEC.md` §7; `aero-fighters/PLAN.md` "File Layout (result)"

**Descrição:** SPEC/PLAN mandam `index.html + game.js (~900 linhas) + README.md`. Código tem 15 módulos ES (2511 linhas totais).

**Pergunta feita:** Como documentar o file layout dos 15 módulos no SPEC/PLAN?
**Resposta:** "Listar todos os 15 módulos com 1 linha cada".

**Resolução:**

SPEC §7 e PLAN "File Layout" substituem o single-file layout pela tabela abaixo:

```
aero-fighters/
├── index.html              ← Loads three.module.min.js e src/main.js como <script type="module">
├── README.md               ← Instruções de uso (FR-10)
├── AGENTS.md               ← Orientação para agentes IA (opcional, Princípio 3)
├── ARCHITECTURE.md         ← Auditoria modular (opcional)
├── CONVENTIONS.md          ← Convenções de código (opcional)
└── src/
    ├── main.js             ← Entry point: wire-up de módulos, game loop, câmera
    ├── state.js            ← Estado global `game`/window.game (única fonte de verdade)
    ├── config.js           ← Constantes (PLAYER, CANNON, MISSILES_LIGHT, MISSILES_HEAVY, TARGETS, AA, MISSION, WORLD, COLORS, TARGET_LAYOUT, ISLAND_DEFS)
    ├── input.js            ← Listeners de teclado, sistema de ações
    ├── audio.js            ← Motor Web Audio (engine rumble, cannon, missile, explosions, AA fire)
    ├── scene.js            ← Cena Three.js, câmera, renderer, luzes, sombras, resize handler
    ├── world.js            ← Oceano procedural, ilhas (dome heightmap), nuvens, flak ambiente
    ├── player.js           ← F-35 mesh + física de voo (throttle, stall, pitch/roll/yaw, crash detection)
    ├── targets.js          ← Builders de alvos (base/factory/building/convoy/aaGun) + AA fire AI
    ├── projectiles.js      ← Pools de balas (player/inimigo), mísseis homing (light/heavy), pickups
    ├── missions.js         ← Spawn de missão, mission complete, game over, next mission
    ├── fx.js               ← Pools de partículas, debris, fumaça, shockwaves, flashes, mega-explosões
    ├── hud.js              ← Updates do HUD DOM (score, lives, speed, throttle, alvos, stall warning)
    └── crosshair.js        ← Reticle 3D + lock-on alvo do míssil
vendor/
└── three.module.min.js     ← Three.js r165 ES module build (commitado, testing-infra T08)
```

PLAN.md adiciona seção "Architecture Decisions" apontando para `aero-fighters/ARCHITECTURE.md` como fonte de auditoria do monolito original e justificativa da modularização.

---

### Decisão #4 — Boss fight (FR-05)

**Tipo:** Funcional não-implementado
**Specs:** `aero-fighters/SPEC.md` FR-05

**Descrição:** SPEC FR-05 prevê boss aircraft de 30 HP disparado a partir de 30 kills. Código não tem boss — mission complete = todos os alvos estáticos destruídos.

**Pergunta feita:** O que fazer com o boss fight na SPEC?
**Resposta:** "Mover para Out of Scope com nota 'v2 backlog'".

**Resolução:**
- FR-05 inteiro removido da seção de requisitos.
- §6 Out of Scope ganha entry: `"**Boss fight** — descrito na v1 da SPEC mas não combina com o conceito atual (ataque ao solo, alvos estáticos, sem inimigos voadores recorrentes). v2 backlog: reavaliar se Tauan pedir um 'chefe de fase'."`
- FR-11 (difficulty loop pós-boss) também sai — substituído pela mecânica atual de "next mission" (ver Decisão #7).

---

### Decisão #5 — FPS threshold

**Tipo:** Drift de NFR
**Specs:** `aero-fighters/SPEC.md` NFR-01 + AC-8; `testing-infra/SPEC.md` FR-05

**Descrição:** SPEC original exige ≥45 FPS over 10s. Test atual mede ≥15 FPS over 8s com comentário "threshold tolerante: PBR + skybox + tracers em headless chromium com software rendering".

**Pergunta feita:** Como tratar o FPS threshold (NFR vs test AC)?
**Resposta:** "NFR ≥45 (hardware real) + AC test ≥15 (headless)".

**Resolução:**
- `aero-fighters/SPEC.md` NFR-01: mantém `"Deve manter ≥ 45 FPS em laptop mid-range com GPU"`.
- `aero-fighters/SPEC.md` AC-8: substitui por `"AC-18 (test): FPS hook mede ≥ 15 over 8s em headless chromium (software rendering); NFR-01 ≥ 45 só verificável em hardware real"`.
- `testing-infra/SPEC.md` FR-05: substitui por `"Average FPS ≥ minimum threshold; threshold de teste: 55 (T-Rex), 15 (Aero Fighters — visual heavy, headless)"`.
- `testing-infra/SPEC.md` §6 AC-T3: substituir `"All 8 Aero Fighters ACs pass"` por `"All 18 Aero Fighters ACs pass"`.

---

### Decisão #6 — Pitch invertido

**Tipo:** UX / drift de FR
**Specs:** `aero-fighters/SPEC.md` FR-03

**Descrição:** Código usa pitch invertido (↑=dive, ↓=climb), estilo simulador. Product memory diz "controles simples para criança".

**Pergunta feita:** Pitch invertido fica ou volta ao padrão?
**Resposta:** "Manter invertido, documentar como feature na SPEC".

**Resolução:**
- FR-03 (tabela de controles): linha de pitch ganha nota `"Pitch invertido (↑=dive, ↓=climb) — convenção de simulador de voo, escolha estilística de design para sensação autêntica de F-35"`.
- README já documenta — manter.
- Sem mudança de código.

---

### Decisão #7 — Backfill funcional batch (FR-02, FR-03, FR-04, FR-06, FR-11)

**Tipo:** Drift funcional batch
**Specs:** `aero-fighters/SPEC.md` FR-02 + FR-03 + FR-04 + FR-06 + FR-11

**Descrição:** Múltiplos FRs descrevem mecânicas que o código substituiu. Backfill agrupado para coerência.

**Pergunta feita:** Confirma as 9 mudanças como o conjunto final do backfill?
**Resposta:** "Confirmado, gerar report".

**Resolução (FR-02 — Player Aircraft):**

Substituir conteúdo atual por:

```markdown
### FR-02 — Player Aircraft (F-35 Lightning II)

- Model: F-35 silhouette com fuselagem facetada stealth, asas trapezoidais sweptback, V-tails caudais canted, exausto único com brilho, canopy bubble dark
- Color: jet grey + canopy escuro + flame yellow/orange no exausto
- Physics: full flight sim
  - `MAX_SPD = 80 m/s` (throttle 100%), `MIN_SPD = 8 m/s`, `STALL_SPD = 10 m/s` (HUD pisca "STALL")
  - `GRAVITY = 14 m/s²` (sempre puxa pra baixo; throttle compensa)
  - `PITCH_RATE = 1.45 rad/s`, `ROLL_RATE = 2.30 rad/s`, `YAW_RATE = 0.80 rad/s`
  - `THROTTLE_UP_RATE = 1.3 /s`, `THROTTLE_DN_RATE = 0.9 /s`, convergência alvo `1.6 /s`
- Posição inicial: altura 80 unidades 3D
- Crash conditions: sea (Y ≤ 3) ou montanha (`heightmap + MOUNTAIN_BUFFER 2.5`) → morte instantânea
- Constantes vivem em `src/config.js:PLAYER`
```

**Resolução (FR-03 — Player Controls):**

Substituir tabela inteira por:

```markdown
### FR-03 — Player Controls

| Action | Input | Effect |
|---|---|---|
| Pitch (nariz pra baixo) | `↑ ArrowUp` ou `I` | Mergulha — **pitch invertido estilo simulador** |
| Pitch (nariz pra cima) | `↓ ArrowDown` ou `K` | Climbs — **pitch invertido estilo simulador** |
| Roll + yaw coordenado | `← →` ou `A`/`D` | Rolagem com yaw acoplado |
| Rudder puro | `Q`/`E` | Yaw puro (sem roll), multiplicador 0.65 |
| Throttle up | `W` | Acelera (TARGET=1.0), convergência 1.6 |
| Throttle down / airbrake | `S` | Desacelera (TARGET=0.0) |
| Vulcan cannon | `Space` ou `Z` | 12.5 r/s (RATE 0.08s), 2 canos nas asas (offset 0.65) |
| Homing missile (light) | `X` | Dano 4, supply 100, range 1200m, turn rate 0.30 (close 0.55) |
| Homing missile (heavy) | `B` | Dano 20 (5x light), supply 10, range 1500m, turn mais lento |
| Barrel roll | `Shift` | 360° camera roll over 0.5s, invencível durante, 1.5s cooldown |
| Pause | `P` ou `Esc` | Toggle pause overlay |
| Mute | `M` | Toggle Web Audio |
| Start / Restart | `Space` ou `Enter` (em título / game over) | Inicia ou reinicia missão |

- Missile stock inicial: **100 light + 10 heavy** (rebalanceado vs SPEC v1 que tinha 5)
- Missile lock-on: ambos (light/heavy) exigem alvo travado pelo crosshair antes de disparar
- Pickups (esferas verdes): restauram 1 light missile cada (chance varia por tipo de alvo — ver FR-04)
```

**Resolução (FR-04 — Targets):**

Substituir wave system inteiro por:

```markdown
### FR-04 — Static Targets (Ground Strike Mission)

O jogo é air-to-ground. Alvos são estruturas militares estáticas em ilhas.

| Tipo | HP base | Score | Hitbox radius² | Drop chance (light missile pickup) | Notas |
|---|---|---|---|---|---|
| Military Base | 28 | 800 | 36 | 60% | Radar dish + barracks + flag |
| Factory | 20 | 600 | 28 | 50% | 3 smokestacks com smoke emitter contínuo |
| Terrorist Building | 14 | 450 | 18 | 30% | Multi-story tower com janelas acesas + antena |
| Troop Convoy | 12 | 380 | 60 | 40% | Linha de 5 caminhões militares |
| AA Gun | 6 | 250 | 9 | 10% | **Única defesa hostil** — atira no player em range 220m |

- AA Gun behavior:
  - Range: 220m
  - Base fire interval (cycle 1): 1.7s
  - Speedup por ciclo: -0.15s (cap em -0.7s total)
- Mega-explosion em kill de base/factory: fireball + shockwave (RingGeometry) + debris (BoxGeometry com gravidade) + smoke rising
- Layout fixo por missão definido em `src/config.js:TARGET_LAYOUT` (16 entries, missão 1 usa 8, missão 2 usa 12, missão 3+ usa 16)
- Cada alvo posicionado relativo a uma ilha (`islandIndex`, `dx`, `dz`) em `ISLAND_DEFS` (12 ilhas fixas)
```

**Resolução (FR-06 — Player Health & Lives):**

Substituir conteúdo por:

```markdown
### FR-06 — Player Health, Lives & Crash

- Player começa com 3 vidas (icons ♥♥♥ HUD top-left)
- Tomar hit (bala inimiga, colisão com alvo): -1 vida; shake 0.3s; 2s invincibility (jet pisca)
- Última vida perdida: slow-motion 0.5x por 1s → overlay "MISSÃO FALHOU — pressione Espaço para tentar novamente"
- **Crash em terreno (mar Y≤3 ou montanha) = morte instantânea independente de vidas remanescentes.** Tela: white flash + double shockwave + "MISSÃO FALHOU" imediato. Crash freeze 2s antes de habilitar restart (evita reinício acidental).
- Restart: reseta state, cycle 1, mission 1
```

**Resolução (FR-11 → Mission Difficulty Loop):**

Substituir conteúdo por:

```markdown
### FR-11 — Mission Difficulty Loop

Após "MISSÃO COMPLETA" (todos os alvos destruídos), o jogo avança para próxima missão com dificuldade incrementada:

- Mission 1: 8 alvos (primeiras 8 entries de `TARGET_LAYOUT`)
- Mission 2: 12 alvos
- Mission 3+: 16 alvos (todos)
- HP de cada alvo: `+3 por ciclo` (`HP_BONUS_PER_CYCLE`)
- AA fire interval: `-0.15s por ciclo` (cap em -0.7s)
- `cycle` counter incrementa por missão completada
- `score` acumula entre missões
- Lives **não** resetam entre missões
- Ambient flak (decorative grey puffs) começa a aparecer após `cycle ≥ 2` (`AMBIENT_FLAK_GATE_CYCLE`)
```

---

### Decisão #8 — Testing-infra alinhamento

**Tipo:** Drift de testing-infra
**Specs:** `testing-infra/SPEC.md` FR-01, FR-05, AC-T3, §7, §8

**Descrição:** Smoke spec expandiu para 18 ACs e adaptou ao jogo F-35 atual. Vendor file é `three.module.min.js` (ES module) em vez de `three.min.js` (UMD).

**Resolução:**
- `testing-infra/SPEC.md` FR-01: substituir frase `"tests exactly the acceptance criteria listed in that game's SPEC.md"` por `"tests the acceptance criteria listed in that game's SPEC.md. Aero Fighters expanded to 18 ACs covering throttle, stall, inverted pitch, mission targets, heavy missile, barrel roll survivability and headless FPS threshold."`
- FR-05 (FPS test): substituir `"55 (T-Rex), 45 (Aero Fighters)"` por `"55 (T-Rex), 15 (Aero Fighters em headless — ver NFR-01 da aero-fighters SPEC para o threshold de hardware real)"`.
- AC-T3: substituir `"All 8 Aero Fighters ACs pass"` por `"All 18 Aero Fighters ACs pass"`.
- §7 "Files to Create": vendor file = `vendor/three.module.min.js` em vez de `three.min.js`.
- §8 "Required `window.game` Contract": adicionar campos `targets`, `targetsTotal`, `targetsDestroyed`, `islands`, `player.heavyMissiles`, `player.speed`, `player.throttle`, `player.stalled`. Manter alias `enemies = targets` documentado.
- `testing-infra/TASKS.md` T08: corrigir comando `curl` de Three.js para apontar para `three.module.min.js` ou registrar nota explicativa.

---

### Decisão #9 — Memory updates

**Tipo:** Memory stale
**Specs:** `memory/product.md`; `memory/tech-stack.md`

**Resolução (`memory/product.md`):**

Tabela "Jogos / Projetos Atuais" — atualizar:

| Projeto | Pasta | Descrição | Status |
|---|---|---|---|
| Tauan T-Rex | `tauan-trex/` | Enhanced Chrome Dino clone — pixel art, high score, day/night | **Approved + Implementado** |
| Aero Fighters (Aero Strike) | `aero-fighters/` | F-35 Ground Strike no estilo arcade Three.js — codename `aero-fighters` mantido por inércia; produto visível ao jogador = "Aero Strike" | **Approved + Implementado** |
| Testing Infrastructure | `tests/` | Playwright smoke quality gate para todos os jogos | **Approved + Implementado** |

**Resolução (`memory/tech-stack.md`):**

- Linha 14: substituir `"CDN only para libs de terceiros — sem npm/bundler nos jogos em si"` por `"Vendor local commitado em `vendor/` — libs de terceiros (Phaser, Three.js) baixadas uma vez de CDN e versionadas no repo; testing-infra exige offline (NFR-02 testing-infra/SPEC.md)."`.
- Tabela "Stack Comprometida por Jogo": Three.js linha — substituir `"r165 (CDN)"` por `"r165 (vendor/three.module.min.js, ES module build)"`.

---

## Edições Pendentes nas Specs (consolidado)

Lista ordenada por arquivo para o aplicador (`dadaia-refine-specs`):

### 1. `specs/constitution.md`

| Linha/Seção | O que mudar |
|---|---|
| Princípio 3 (linha 18) | Substituir por: `"3. **Documentação mínima** — README por jogo é obrigatório com instruções de como rodar. Documentos adicionais (AGENTS.md, ARCHITECTURE.md, CONVENTIONS.md) são opcionais quando o jogo cresce além de 1 arquivo e precisa orientar agentes/colaboradores."` |

### 2. `specs/memory/product.md`

| Linha/Seção | O que mudar |
|---|---|
| Tabela "Jogos / Projetos Atuais" | Status Tauan T-Rex: SPEC Draft → Approved + Implementado; Status Aero Fighters: SPEC Draft → Approved + Implementado; nome muda para "Aero Fighters (Aero Strike)" com nota sobre codename; adicionar linha "Testing Infrastructure / `tests/` / Playwright smoke quality gate / Approved + Implementado" |

### 3. `specs/memory/tech-stack.md`

| Linha/Seção | O que mudar |
|---|---|
| Tabela "Stack Comprometida" linha aero-fighters | `r165 (CDN)` → `r165 (vendor/three.module.min.js, ES module)` |
| "Princípios de Stack" linha 14 | "CDN only..." → "Vendor local commitado em `vendor/`..." (texto completo no detalhe Decisão #9) |

### 4. `specs/features/aero-fighters/SPEC.md`

| Linha/Seção | O que mudar |
|---|---|
| §1 Overview | Reescrita: explica evolução de "replica N64" para "Aero Strike F-35 Ground Strike"; codename `aero-fighters` mantido |
| §2 Reference | Manter mas adicionar nota: "Conceito evoluiu durante implementação — ver §1" |
| FR-02 | Substituir por versão full flight sim (texto em Decisão #7) |
| FR-03 | Substituir tabela inteira por nova com 12 entries (texto em Decisão #7) |
| FR-04 | Substituir wave system por static targets table (texto em Decisão #7) |
| FR-05 | **DELETAR** todo o conteúdo de Boss Fight |
| FR-06 | Substituir por versão com crash instantâneo (texto em Decisão #7) |
| FR-08 HUD | Atualizar tabela: trocar Boss bar/Kills por `MISSÃO N`, `MSLS:` (light), `HVY:` (heavy), `SPD:`, `THR:`, `ALVOS X/Y`, `⚠STALL` |
| FR-11 | Substituir por Mission Difficulty Loop (texto em Decisão #7) |
| §5 Acceptance Criteria | Substituir tabela de 8 ACs por tabela de 18 ACs (espelha `tests/aero-fighters/smoke.spec.js`); AC-8 → AC-18 com nota "FPS ≥ 15 over 8s em headless; NFR-01 ≥ 45 em hardware real" |
| §6 Out of Scope | Adicionar: "Boss fight — v2 backlog (ver Decisão #4 em refine-specs.md)" |
| §7 File Layout | Substituir por layout de 15 módulos ES (tabela completa em Decisão #3) |
| FR-10 README | Atualizar lista de controles para refletir FR-03 atual (Space/Z, X, B, Shift, P, M, W/S, Q/E) |
| NFR-01 | Manter ≥45 FPS mas adicionar nota: "verificável apenas em hardware real com GPU; AC-18 mede ≥15 em headless por software rendering" |
| §9 Approval | Adicionar linha: "Backfill 2026-05-11 — refletir estado real do código (ver `.dadaia/reports/refine-specs.md`)" |

### 5. `specs/features/aero-fighters/PLAN.md`

| Linha/Seção | O que mudar |
|---|---|
| Architecture Decisions table | Adicionar linha: "Modularização em 15 ES modules / Auditoria de monolito 2511-line em `aero-fighters/ARCHITECTURE.md`; legibilidade + manutenibilidade por iniciante + agente" |
| File Layout (result) | Substituir por tabela completa de 15 módulos (texto em Decisão #3) |
| Implementation Phases | Adicionar nota no topo: "Plano original assumiu monolith game.js. Implementação fez modularização concorrente — fases T01-T23 cobrem o escopo, mas distribuídas pelos 15 módulos ES" |
| Verification | Atualizar lista de tests esperados: 18 ACs (não 8) |

### 6. `specs/features/aero-fighters/TASKS.md`

| Linha/Seção | O que mudar |
|---|---|
| Pre-implementation Checklist | Marcar TODOS os 4 checkboxes como `[x]` (já concluído) |
| T01 (index.html) | Atualizar para refletir HUD real (MISSÃO, lives, score, MSLS, HVY, SPD, THR, ALT, ALVOS, STALL, sound-toggle) |
| T02 (game.js skeleton) | Renomear para "T02 — game.js skeleton (modularizado em src/)" com referência a `src/state.js` e `src/main.js` |
| T03-T20 | Adicionar nota inline em cada uma: "Implementado em `src/<módulo>.js`" indicando módulo correspondente |
| T15 (Boss) | **DELETAR** (boss removido — Decisão #4) |
| Renumerar tarefas pós-T15 | T16 → T15, ..., T23 → T22 |
| Adicionar T_NEW — Modularização | "Distribuir lógica do monolithic game.js entre 15 módulos ES (audio/config/scene/...); ver ARCHITECTURE.md §2" |
| Adicionar T_NEW — Throttle/stall mechanic | Implementar throttle (W/S), stall (STALL_SPD), gravidade, crash detection |
| Adicionar T_NEW — Heavy missile (B) | Pool/spawn missiles, dano 5x, supply 10 |
| Adicionar T_NEW — Static targets | Substituir enemy waves por base/factory/building/convoy/aaGun |
| Adicionar T_NEW — Islands + heightmap | 12 ilhas com dome heightmap, terrain collision |
| Done Condition | Atualizar para 18 ACs (não 8) |

### 7. `specs/features/testing-infra/SPEC.md`

| Linha/Seção | O que mudar |
|---|---|
| FR-01 | Adicionar nota: "Aero Fighters expanded to 18 ACs covering throttle, stall, inverted pitch, mission targets, heavy missile, barrel roll survivability and headless FPS threshold" |
| FR-05 FPS | "55 (T-Rex), 45 (Aero Fighters)" → "55 (T-Rex), 15 (Aero Fighters em headless)" |
| §6 AC-T3 | "All 8 Aero Fighters ACs pass" → "All 18 Aero Fighters ACs pass" |
| §7 Files to Create | Aero Fighters AC count atualizado de 8 para 18 |
| §8 window.game Contract | Adicionar: `targets`, `targetsTotal`, `targetsDestroyed`, `islands`, `player.heavyMissiles`, `player.speed`, `player.throttle`, `player.stalled`. Documentar alias `enemies = targets` |

### 8. `specs/features/testing-infra/TASKS.md`

| Linha/Seção | O que mudar |
|---|---|
| Pre-implementation Checklist | Marcar todos `[x]` |
| T07 (aero-fighters smoke spec) | Atualizar lista de ACs de 8 para 18; descrever os 18 (matching `tests/aero-fighters/smoke.spec.js`) |
| T08 (vendor download) | Substituir comando `curl ... three.min.js` por `curl ... three.module.min.js` (ES module build) OU adicionar nota "vendor file = `three.module.min.js` para suportar `import * as THREE` em jogos modularizados" |

### 9. `specs/features/tauan-trex/TASKS.md` (cosmético)

| Linha/Seção | O que mudar |
|---|---|
| Pre-implementation Checklist | Marcar `[x]` no `PLAN.md [x] Approved` (atualmente `[ ]`) — hygiene, não bloqueia |

---

## Backlog Priorizado (pós-refinamento)

Ordem recomendada de aplicação das edições (dependências entre arquivos):

| Ordem | Arquivo | Depende de | Razão |
|---|---|---|---|
| 1 | `constitution.md` | — | Lei de base; Princípio 3 muda; outras specs referenciam |
| 2 | `memory/product.md` | constitution | Status + nomes alinham com decisão sobre codename |
| 3 | `memory/tech-stack.md` | constitution | "CDN only" muda baseado em testing-infra T08 |
| 4 | `specs/features/aero-fighters/SPEC.md` | memory/product, memory/tech-stack | Maior bloco de edição (10+ FRs) |
| 5 | `specs/features/aero-fighters/PLAN.md` | SPEC | Layout + decisions referenciam SPEC §7 |
| 6 | `specs/features/aero-fighters/TASKS.md` | SPEC + PLAN | Tarefas reorganizadas pós-modularização |
| 7 | `specs/features/testing-infra/SPEC.md` | aero-fighters SPEC | AC count e contract derivam de aero-fighters |
| 8 | `specs/features/testing-infra/TASKS.md` | testing-infra SPEC | T07 e T08 derivam |
| 9 | `specs/features/tauan-trex/TASKS.md` | — | Hygiene isolada |

---

## Próximos Passos

1. ~~Operador revisa este report e confirma (ou ajusta).~~ ✅ Confirmado 2026-05-11
2. ~~Operador invoca `/dadaia-refine-specs` — skill aplicará as 9 mudanças nos arquivos listados na ordem acima.~~ ✅ Aplicado 2026-05-11
3. Pós-aplicação: rodar `dadaia public doctor` para garantir que nenhum lib-asset foi tocado.
4. Operador revisa as specs em "In Review" e decide se promove para `[x] Approved`:
   - `specs/features/aero-fighters/SPEC.md`
   - `specs/features/aero-fighters/PLAN.md`
   - `specs/features/testing-infra/SPEC.md`
5. Considerar criar commit `refactor(aero-fighters): backfill specs para estado atual do código (Aero Strike F-35)` no repo `tauan-games`.
6. Considerar atualizar `repos/tauan-games/AGENTS.md` raiz (atualmente tem placeholders `<repo-name>`) — fora deste escopo, mas worth flagging.

---

## Status de Aplicação

| # | Arquivo | Status |
|---|---|---|
| 1 | `specs/constitution.md` | ✅ Aplicado 2026-05-11 |
| 2 | `specs/memory/product.md` | ✅ Aplicado 2026-05-11 |
| 3 | `specs/memory/tech-stack.md` | ✅ Aplicado 2026-05-11 |
| 4 | `specs/features/aero-fighters/SPEC.md` | ✅ Aplicado 2026-05-11 — movido para `[ ] In Review` |
| 5 | `specs/features/aero-fighters/PLAN.md` | ✅ Aplicado 2026-05-11 — movido para `[ ] In Review` |
| 6 | `specs/features/aero-fighters/TASKS.md` | ✅ Aplicado 2026-05-11 |
| 7 | `specs/features/testing-infra/SPEC.md` | ✅ Aplicado 2026-05-11 — movido para `[ ] In Review` |
| 8 | `specs/features/testing-infra/TASKS.md` | ✅ Aplicado 2026-05-11 |
| 9 | `specs/features/tauan-trex/TASKS.md` | ✅ Aplicado 2026-05-11 |

---

## Notas Finais

- **Nenhuma edição em código de produção** é exigida por este report. Todo o trabalho é em `specs/` + `memory/` + `constitution.md` + `.dadaia/reports/`.
- O testing-infra T08 ainda referencia `vendor/three.min.js` mas o código real usa `vendor/three.module.min.js` — a edição #8 cobre isso.
- O AGENTS.md raiz do repo `tauan-games` está com placeholders (`<repo-name>`, `<!-- 2-3 sentences -->`) — não tratado nesta sessão.
- A SPEC do `security/SPEC.md` continua em **Draft** (não aprovada) — também fora do escopo desta sessão.

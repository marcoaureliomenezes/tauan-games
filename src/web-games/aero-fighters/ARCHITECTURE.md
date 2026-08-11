# Aero Strike — Revisão de Arquitetura

> Auditoria do monolito `game.js` (1.445 linhas) com proposta concreta de modularização em ES modules nativos, sem ferramentas de build.
> Destinatários: o operador, o filho do operador (aprendendo a programar) e os agentes de IA que vão colaborar na evolução do código.
> Princípio condutor: **legível por iniciante, manutenível por agente, separação clara de responsabilidades**.

---

## 1. Auditoria do monolito atual

Hoje `aero-fighters/game.js` mistura **24 responsabilidades distintas** em um único arquivo. A descrição abaixo usa linhas reais do arquivo atual.

### 1.1 Concerns misturados (com cheiros de acoplamento)

| # | Concern | Linhas | Cheiro de acoplamento |
|---|---------|--------|----------------------|
| 1 | Contrato de estado global `game` e exposição em `window.game` | 9-28 | Estado mutado por TUDO; testes acoplados ao formato; `game.enemies = game.targets` é alias legado mantido por compatibilidade |
| 2 | Motor de áudio Web Audio (módulo `audio` com 9 métodos) | 34-185 | Já é um objeto coeso, mas exposto em `window.audio`; chamado de dentro de pools de partículas, de input handlers, de `damageTarget`, etc. |
| 3 | Cena, câmera, renderer, luzes, sol, fog, resize | 190-232 | Variáveis `scene`, `camera`, `renderer` viram singletons globais que todo módulo precisa enxergar |
| 4 | Geração procedural de textura do oceano (canvas 2D pintado à mão) | 237-273 | 36 linhas de detalhe artístico no meio do arquivo de jogo |
| 5 | Geração procedural de ilhas + tabela de colisão | 278-324 | `createIsland()` empurra para `game.islands` (efeito colateral); `islandHeightAt()` é função pura mas vive solta |
| 6 | Nuvens | 329-342 | OK, isolado, mas atualizado dentro de `updateOcean` |
| 7 | Construção do mesh do F-35 (IIFE com ~115 linhas de geometria) | 347-463 | Dezenas de magic numbers; trocar para outro avião exige editar o miolo do arquivo |
| 8 | Speed lines | 468-481 | Acopla a `jet.position` diretamente |
| 9 | Pools de balas (player e inimigo) | 486-506 | `spawnBullet` empurra para `game.projectiles` — outro side-effect global |
| 10 | Pools de partículas, debris, fumaça, ondas de choque, flashes + `explosion()` / `spawnShockwave()` / `spawnFlash()` / `megaExplosion()` | 511-674 | 163 linhas de FX num único bloco; `megaExplosion` chama `audio.megaExplosion()` direto |
| 11 | Smoke emitters contínuos (fumaça de chaminé de fábrica) | 677-695 | Acoplado ao pool de fumaça de explosão (compete pelo mesmo pool!) |
| 12 | Mísseis homing | 700-734 | Faz pesquisa O(N) em `game.targets`; chama `damageTarget` direto |
| 13 | Pickups (resupply de mísseis) | 739-754 | Lê/escreve `game.player.missiles` direto |
| 14 | Construtores de mesh de alvos: `makeBase`, `makeFactory`, `makeBuilding`, `makeConvoy`, `makeAAGun` | 759-873 | 115 linhas. **Adicionar 1 novo tipo de alvo significa editar este bloco no meio do arquivo.** |
| 15 | Tabela `targetTypes` + layout fixo `TARGET_LAYOUT` + `targetCountForMission` | 875-909 | Dados de design (níveis) misturados com código |
| 16 | `spawnTarget` / `damageTarget` / `killTarget` / `spawnMission` | 911-988 | `spawnTarget` cria smoke emitters da fábrica em coordenadas de mundo (lógica de fábrica vazada para o spawner genérico) |
| 17 | Input de teclado (com `audio.init()`, fireCannon, fireMissile, pausa, mute, swallow de seta) | 993-1014 | 22 linhas que sabem sobre: áudio, estado de jogo, missão, overlay, HUD do som, prevenção de scroll. Concentra acoplamento. |
| 18 | Handler do botão de som | 1017-1027 | Lê `getElementById` direto |
| 19 | Disparo de canhão + míssil | 1032-1056 | Lê `jet.quaternion`, `game.targets`, `game.player.missiles` — toca em três domínios |
| 20 | Barrel roll | 1061-1066 | Variáveis soltas `rollTimer`, `rollCooldown`, `rollDir`; lidas dentro de `updatePlayer` e `updateBullets` |
| 21 | Estado de física de voo (variáveis livres `speed`, `throttle`, `stalled`, scratches de quaternion) | 1071-1086 | Estado de player espalhado em DUAS estruturas: `game.player.*` E variáveis de módulo. Sincronizadas manualmente no fim de `updatePlayer` (1253-1257). |
| 22 | Referências de HUD + `updateHUD()` + overlay + show/hide | 1091-1126 | `updateHUD` lê 8 fontes diferentes (game.player, jet, speed, throttle, stalled) — virou um "Deus do HUD" |
| 23 | `startGame`, `restartGame`, `gameOver`, `crashAndDie`, `nextMission` | 1131-1175 | `restartGame` precisa lembrar de zerar 7 coleções diferentes — qualquer feature nova adiciona uma linha aqui |
| 24 | `updatePlayer`, `updateBullets`, `playerHit`, `updateTargets`, `updateAAGun`, `updateAmbientFlak`, `updateCamera`, `updateOcean`, `tick`, boot | 1184-1445 | Loop principal `tick()` (1390-1429) chama 11 updates em ordem rígida; trocar a ordem quebra coisas (ex.: `updateTargets` precisa rodar antes do check de mission complete) |

### 1.2 Os 5 piores cheiros

1. **Estado duplicado de player.** `game.player.speed` é escrito no fim de `updatePlayer` (linha 1256), mas a fonte da verdade durante o frame é a variável de módulo `speed` (linha 1071). Quem chega depois lendo `game.player.speed` lê o valor do frame anterior.

2. **Funções com side-effects globais.** `spawnBullet` empurra em `game.projectiles`. `spawnTarget` empurra em `game.targets` E em `smokeEmitters` (se for fábrica). `createIsland` empurra em `game.islands`. Quem lê só a assinatura não vê o efeito.

3. **Acoplamento direto entre FX e áudio.** `megaExplosion()` chama `audio.megaExplosion()` no final (linha 618). Trocar o motor de áudio amanhã exige varrer chamadas dentro de 5 módulos diferentes.

4. **Pool de fumaça compartilhado entre "explosão" e "chaminé".** Linhas 530-533 criam 70 sprites de fumaça; `explosion()` consome até 5 por boom (linhas 570-589) e `tickSmokeEmitters` consome 1 a cada ~0.5s por chaminé (683-693). Se cinco fábricas estão emitindo + uma base explode, a fumaça simplesmente para de aparecer e ninguém entende por quê.

5. **`tick()` é um Deus.** 40 linhas que sabem a ordem exata dos 11 updates. Adicionar "chuva" ou "trovão" exige editar este bloco e raciocinar sobre ordem global.

### 1.3 Cheiros menores mas relevantes para pedagogia

- **Magic numbers à solta:** `MAX_SPD=80`, `GRAVITY=14`, `CANNON_RATE=0.08`, `ROLL_DUR=0.5`, `if (jet.position.y < 3) crashAndDie('SEA')`. Um iniciante não consegue ajustar sem caçar em 5 lugares.
- **IIFE gigante para o jet** (linhas 348-461) impede reaproveitar o mesh em testes ou pré-visualização.
- **`setTimeout` espalhados:** linhas 611-616 (mega explosão em camadas), 1169 (crash), 1174 (next mission), 1306. Misturam controle de fluxo com renderização.
- **`window.game` e `window.audio` como API pública** sem nenhum lugar dizendo "esse é o contrato; nada mais é público". Qualquer dev/agente fica em dúvida do que pode mexer.

---

## 2. Estrutura de módulos proposta

**Restrições absolutas:**

- ES Modules nativos. Cada arquivo é `.js` com `export`. Sem bundler, sem TypeScript, sem npm install (continua `python3 -m http.server`).
- Caminhos relativos. O HTML carrega apenas `src/main.js` com `<script type="module">`.
- 12 módulos no total (não 50). Granularidade pedagógica.

### 2.1 Árvore de arquivos

```
src/web-games/aero-fighters/
  index.html                        ← mantém HUD/overlay; troca o <script> para src/main.js
  README.md
  ARCHITECTURE.md                   ← este documento
  CONVENTIONS.md                    ← regras curtas e práticas (ver seção 5)
  src/
    main.js                         ← orquestrador. ZERO lógica de jogo. Só wireup.
    config.js                       ← TODAS as constantes (velocidades, HP, cores, ranges)
    state.js                        ← estado de jogo + contrato window.game (única fonte)
    core/
      scene.js                      ← THREE.Scene, camera, renderer, luzes, resize, fog
      input.js                      ← teclado → flags semânticas (não Three.js, não áudio)
      loop.js                       ← clock, requestAnimationFrame, registra "systems"
      audio.js                      ← motor Web Audio (já está coeso; só extrair)
    world/
      ocean.js                      ← textura procedural + plano + animação
      islands.js                    ← geração de ilhas + islandHeightAt + colisão
      sky.js                        ← nuvens + sol + ambient flak
    entities/
      player.js                     ← mesh F-35 + física de voo + crash detection
      targets.js                    ← builders dos 5 tipos + spawn/damage/kill + AA fire
      bullets.js                    ← pools + spawn/update player & enemy
      missiles.js                   ← homing missiles
      pickups.js                    ← drops de munição
    fx/
      particles.js                  ← pools (particles, debris, smoke, shock, flash) + explosion/megaExplosion
    ui/
      hud.js                        ← updateHUD diff-render + show/hide overlay
    missions/
      layout.js                     ← TARGET_LAYOUT (dados) + targetCountForMission
      flow.js                       ← startGame/restartGame/gameOver/crashAndDie/nextMission
```

**Por que essa divisão e não outra:**

- 4 camadas: `core/` (infra) ← `world/` + `entities/` + `fx/` (gameplay) ← `ui/` + `missions/` (regras) ← `main.js` (orquestração).
- `world/` é "o que existe mesmo sem player" (oceano, ilhas, céu). `entities/` é "coisas que se movem ou morrem". Distinção fácil de explicar para uma criança.
- `fx/particles.js` separa "como explode visualmente" de "quando explode" (`entities/targets.js`).
- `missions/` separa "que alvos colocar onde" (dados) de "o que fazer entre missões" (fluxo).

### 2.2 Detalhes módulo a módulo

#### `src/config.js` — Constantes

- **Propósito:** Único lugar onde se ajustam velocidades, HPs, cores, intervalos, distâncias.
- **Exporta:** `PLAYER` (MAX_SPD, MIN_SPD, GRAVITY, PITCH, ROLL, YAW…), `CANNON` (rate, damage), `MISSILES` (max=100, damage=4, range=800), `TARGETS` (5 entradas com hp/score/hr2/dropChance), `AA` (range=220, baseInterval=1.7), `MISSION` (waveSizes=[8,12,16], hpBonusPerCycle=3), `WORLD` (oceanSize, fogNear, fogFar), `COLORS` (palette).
- **Importa:** nada.
- **Migra das linhas:** 875-881 (targetTypes), 1071-1076 (constantes de voo), 1033 (CANNON_RATE), 1062 (ROLL_DUR/CD), 875-881, 938 (range AA), e magic numbers de várias funções.

#### `src/state.js` — Estado do jogo

- **Propósito:** A ÚNICA fonte do `game` e do contrato `window.game`.
- **Exporta:** `game` (mesmo formato atual, mantido para backward-compat com tests). Função `resetState()` que zera tudo para um novo jogo.
- **Importa:** nada.
- **Migra:** 9-28.
- **Regra:** Outros módulos importam `game` daqui (`import { game } from '../state.js'`). NUNCA mais alguém escreve `window.game = …`.

#### `src/core/scene.js` — Cena Three.js

- **Propósito:** Setup do mundo 3D: scene, camera, renderer, luzes, sol, fog, resize.
- **Exporta:** `scene`, `camera`, `renderer`, `attachRenderer(domEl)`.
- **Importa:** `three.module.min.js`, `config.js` (COLORS, WORLD).
- **Migra:** 190-232.

#### `src/core/input.js` — Teclado → intenções

- **Propósito:** Traduz teclas em flags semânticas. NÃO sabe sobre áudio, HUD, ou Three.js.
- **Exporta:** `input` (objeto reativo: `input.pitchUp`, `input.pitchDown`, `input.rollLeft`, `input.rollRight`, `input.yawLeft`, `input.yawRight`, `input.throttleUp`, `input.throttleDown`, `input.firePressed`, `input.missilePressed`, `input.rollPressed`, `input.pausePressed`, `input.mutePressed`, `input.startPressed`), e `installListeners(target=window)`.
- **Importa:** nada.
- **Migra:** 993-1015 (sem as chamadas para `audio.init()`, `fireCannon()`, `audio.toggle()` — essas viram listeners em `main.js`).

#### `src/core/loop.js` — Game loop

- **Propósito:** Um `requestAnimationFrame` que itera uma lista registrada de "systems".
- **Exporta:** `registerSystem(fn)`, `start()`, `stop()`, `clock`.
- **Importa:** Three.js.
- **Padrão:** cada módulo de gameplay registra seu próprio update; `tick()` não conhece mais a lista hardcoded.

```js
// uso em main.js
import { registerSystem, start } from './core/loop.js';
registerSystem(updatePlayer);
registerSystem(updateBullets);
// ...
start();
```

- **Migra:** 1390-1429 reescrito.

#### `src/core/audio.js` — Motor Web Audio

- **Propósito:** Sons sintetizados. Mesma API do objeto `audio` atual.
- **Exporta:** `audio` (com `init`, `startEngine`, `stopEngine`, `setEngineRPM`, `cannon`, `missile`, `explosion`, `megaExplosion`, `aaFire`, `hit`, `toggle`).
- **Importa:** nada.
- **Migra:** 34-185 quase 1-para-1.
- **Mudança contratual:** continua exposto em `window.audio` (para backward-compat) mas o canônico vira o `import`.

#### `src/world/ocean.js` — Oceano

- **Exporta:** `ocean` (mesh), `updateOcean(dt, player)`.
- **Importa:** Three.js, `scene` de `core/scene.js`, `WORLD` de `config.js`.
- **Migra:** 237-273, 1376-1385 (parte do oceano).

#### `src/world/islands.js` — Ilhas

- **Exporta:** `createIslands()` (popula `game.islands`), `islandHeightAt(isl, dx, dz)`, `checkTerrainCollision(jetPosition)` (retorna `'SEA' | 'MOUNTAIN' | null` — extrai a lógica de 1232-1248).
- **Importa:** Three.js, `scene`, `game` de `state.js`.
- **Migra:** 278-324, e o bloco de colisão de `updatePlayer`.

#### `src/world/sky.js` — Céu, nuvens, flak ambiente

- **Exporta:** `createSky()`, `updateClouds(dt, player)`, `updateAmbientFlak(dt, player)`.
- **Importa:** Three.js, `scene`, `game`, `fx/particles.js` (para explosões decorativas).
- **Migra:** 222-232 (sun), 329-342 (clouds), 1332-1348 (ambient flak), parte de 1381-1384.

#### `src/entities/player.js` — F-35 + física

- **Exporta:** `jet` (Group), `updatePlayer(dt)`, `firePosition()`, `playerHit()`, `barrelRoll()`, `respawn()`.
- **Importa:** Three.js, `input`, `audio`, `game`, `config.PLAYER`, `islands.checkTerrainCollision`, `fx.megaExplosion`.
- **Migra:** 347-463 (mesh), 1061-1066, 1071-1086, 1184-1258, 1286-1291.
- **Mudança chave:** `speed`, `throttle`, `stalled` vivem dentro de `game.player.*` ÚNICO (sem variável de módulo paralela).

#### `src/entities/targets.js` — Alvos militares

- **Exporta:** `makeBase`, `makeFactory`, `makeBuilding`, `makeConvoy`, `makeAAGun` (builders), `spawnTarget(...)`, `damageTarget(...)`, `killTarget(...)`, `updateTargets(dt)`.
- **Importa:** Three.js, `scene`, `audio`, `game`, `config.TARGETS`, `fx.explosion/megaExplosion/spawnShockwave`, `pickups.spawnPickup`, `bullets.spawnBullet` (para AA).
- **Migra:** 759-988 (todo o bloco) + 1296-1327 (AA).

#### `src/entities/bullets.js` — Balas

- **Exporta:** `spawnBullet(orig, dir, isEnemy)`, `recycleBullet(p)`, `updateBullets(dt, jet, onTargetHit)`.
- **Importa:** Three.js, `scene`, `game`.
- **Migra:** 486-506, 1263-1285.
- **Decoupling:** o `if` que chama `damageTarget` vira um callback `onTargetHit(target)` injetado por `main.js` ou registrado pelo módulo de alvos. **Bullets não sabe que existem alvos.**

#### `src/entities/missiles.js` — Mísseis homing

- **Exporta:** `spawnMissile(orig, target)`, `updateMissiles(dt, onTargetHit)`.
- **Importa:** Three.js, `scene`, `audio`, `game`, `fx.explosion`.
- **Migra:** 700-734, 1044-1056.

#### `src/entities/pickups.js` — Drops

- **Exporta:** `spawnPickup(pos)`, `updatePickups(dt, jet)`.
- **Importa:** Three.js, `scene`, `game`.
- **Migra:** 739-754.

#### `src/fx/particles.js` — Efeitos

- **Exporta:** `explosion(pos, scale, color)`, `megaExplosion(pos, kind)`, `spawnShockwave(pos, maxR, color)`, `spawnFlash(pos, scale)`, `addSmokeEmitter(x, y, z, ownerMesh)`, `removeSmokeEmittersOf(mesh)`, `updateParticles(dt)`, `tickSmokeEmitters(dt)`.
- **Importa:** Three.js, `scene`, `audio`.
- **Migra:** 511-695.
- **Cuidado:** considerar SEPARAR o pool de smoke de chaminé do pool de smoke de explosão (cheiro #4 da auditoria). Recomendo dois pools dimensionados: 50 explosão + 30 chaminé.

#### `src/ui/hud.js` — HUD e overlay

- **Exporta:** `updateHUD()`, `showOverlay(title, sub, msHide)`, `hideOverlay()`, `tickOverlayTimer(dt)`, `setSoundIcon(muted)`.
- **Importa:** `game`.
- **Migra:** 1091-1126.

#### `src/missions/layout.js` — Dados de níveis

- **Exporta:** `TARGET_LAYOUT`, `targetCountForMission(m)`.
- **Importa:** nada.
- **Migra:** 884-909.
- **Pergunta aberta (seção 7):** mover isso para um `.json` carregado via `fetch`?

#### `src/missions/flow.js` — Fluxo de missão

- **Exporta:** `startGame()`, `restartGame()`, `gameOver(reason)`, `crashAndDie(where)`, `nextMission()`, `spawnMission(missionNum)`.
- **Importa:** `game`, `targets.{spawnTarget, …}`, `ui/hud`, `audio`, `player.respawn`, `fx.megaExplosion`.
- **Migra:** 911-988, 1131-1175.

#### `src/main.js` — Orquestrador

- **Propósito:** Wire-up. ZERO lógica de gameplay.
- **Importa:** todos os módulos acima.
- **O que faz:**
  1. `attachRenderer(document.body)`
  2. `createIslands()`, `createSky()`, criar `ocean`, adicionar `jet` à cena
  3. `input.installListeners()`
  4. Liga listeners de input para `firePressed → fireCannon`, `mutePressed → audio.toggle()`, etc.
  5. Registra todos os updates em `loop.registerSystem(...)` na ordem desejada
  6. Mostra overlay inicial e chama `loop.start()`
- **Tamanho alvo:** ≤ 120 linhas.

---

## 3. Grafo de dependências (camadas estritas)

```
                          ┌──────────────┐
                          │   main.js    │ ← topo: só ele importa de TODO mundo
                          └──────┬───────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
  ┌──────────┐            ┌──────────────┐         ┌──────────────┐
  │ missions │            │     ui       │         │   entities   │
  │  /flow   │            │    /hud      │         │              │
  │  /layout │            └──────┬───────┘         │  player      │
  └─────┬────┘                   │                 │  targets     │
        │                        │                 │  bullets     │
        │                        │                 │  missiles    │
        │                        │                 │  pickups     │
        │                        │                 └──────┬───────┘
        │                        │                        │
        └─────────┬──────────────┴────────────┬───────────┘
                  ▼                           ▼
            ┌──────────┐                 ┌──────────┐
            │  world   │                 │    fx    │
            │  ocean   │                 │ particles│
            │  islands │                 └─────┬────┘
            │  sky     │                       │
            └────┬─────┘                       │
                 │                             │
                 └──────────────┬──────────────┘
                                ▼
                         ┌─────────────┐
                         │    core     │
                         │  scene      │
                         │  input      │
                         │  loop       │
                         │  audio      │
                         └──────┬──────┘
                                ▼
                         ┌─────────────┐
                         │   state     │
                         │   config    │
                         └─────────────┘
```

**Leis das camadas (a serem ditas em voz alta):**

1. `state.js` e `config.js` não importam NADA do projeto.
2. `core/` pode importar `state` + `config`. Não importa `world/`, `entities/`, `fx/`, `ui/`, `missions/`, nem `main`.
3. `world/`, `fx/` podem importar `core/`, `state`, `config`. Não podem importar `entities/`, `missions/`, `ui/`.
4. `entities/` podem importar `core/`, `world/` (para colisão), `fx/`, `state`, `config`. NÃO importam `missions/` nem se importam entre si (exceção controlada: `targets` importa `bullets` e `pickups`, listada em CONVENTIONS).
5. `ui/` importa só `state` e `config`. NUNCA `entities/` ou `world/`.
6. `missions/` importa `entities/`, `ui/`, `state`, `config`.
7. `main.js` é o único que importa de quase tudo. Tudo descendo nessa árvore.

**Seams (costuras) que ficam baratas no futuro:**

- **Trocar o F-35 por outro avião:** edita só `entities/player.js` (mesh isolado).
- **Adicionar um 6º tipo de alvo (ex.: hangar):** adiciona `makeHangar()` em `entities/targets.js`, uma entrada em `config.TARGETS`, e um slot em `missions/layout.js`. Zero edição nos updates.
- **Substituir Web Audio por arquivos `.mp3`:** reimplementa `core/audio.js` mantendo a mesma API. Nenhum outro arquivo muda.
- **Adicionar um sistema de chuva:** cria `src/world/weather.js`, `loop.registerSystem(updateRain)` em `main.js`. Pronto.
- **Trocar Three.js por outro renderer:** seria caro mesmo nesse desenho — mas o impacto fica em `core/scene.js`, `entities/player.js` (mesh) e os builders de `entities/targets.js`. Sem espalhar pela física, missão, HUD ou input.

---

## 4. Plano de migração incremental (jogo nunca quebra)

Cada passo é uma única extração; após cada passo, recarregar a página e jogar 1 minuto para confirmar.

> **PRIMEIRA EXTRAÇÃO (maior alavanca, menor risco):** `config.js`. É só um arquivo de constantes. Não muda comportamento, mas dá ao filho do operador o ponto óbvio para "mexer no jogo" sem ter medo. Faça este antes de qualquer outro.

### Sequência sugerida

| Passo | Extrai | De onde (linhas) | Por que esta ordem |
|-------|--------|------------------|-------------------|
| 1 | `src/config.js` | 875-881, 1033, 1062, 1071-1076, etc. | Zero comportamento alterado; serve de "guard rail" para os passos seguintes |
| 2 | `src/state.js` | 9-28 | Tudo depende — extrair cedo evita import circular depois |
| 3 | `src/core/audio.js` | 34-185 | Já é coeso, baixíssimo risco |
| 4 | `src/core/scene.js` | 190-232 | Boilerplate Three.js sai do meio do código |
| 5 | `src/fx/particles.js` | 511-695 | Usado por player, targets, missiles — melhor sair antes deles |
| 6 | `src/world/ocean.js`, `src/world/sky.js`, `src/world/islands.js` | 237-342, 1332-1385 | Mundo, sem regras |
| 7 | `src/entities/bullets.js` | 486-506, 1263-1285 | Pré-requisito para targets/missiles |
| 8 | `src/entities/pickups.js` | 739-754 | Pequeno, isolado |
| 9 | `src/entities/missiles.js` | 700-734, 1044-1056 | Depende de targets só por callback (já desacoplado) |
| 10 | `src/entities/targets.js` | 759-988, 1296-1327 | O maior bloco — fazer só depois dos pools estarem fora |
| 11 | `src/entities/player.js` | 347-463, 1071-1086, 1184-1291 | Mesh + física juntos |
| 12 | `src/core/input.js` | 993-1015 | Listeners viram `installListeners()` + wiring em main |
| 13 | `src/ui/hud.js` | 1091-1126 | Diff-render isolado |
| 14 | `src/missions/layout.js`, `src/missions/flow.js` | 884-909, 1131-1175 | Fluxo de jogo |
| 15 | `src/core/loop.js` + `src/main.js` | 1390-1445 | Última etapa: substituir `tick()` global por `registerSystem` |
| 16 | Trocar `<script src="game.js">` por `<script type="module" src="src/main.js">` no `index.html`; deletar `game.js`. |

**Truque para não quebrar:** Durante os passos 1-14, `game.js` permanece como entry-point e vai virando cada vez mais magro (basta passar a fazer `import { x } from './src/.../y.js'` no topo do `game.js`). Só no passo 15 o `tick()` é virado de cabeça para baixo.

---

## 5. Convenções de colaboração (humanos + agentes)

Estas regras devem ser fixadas em `aero-fighters/CONVENTIONS.md` (criar como parte do passo 0 do plano de migração) e referenciadas no `AGENTS.md` do repo `tauan-games`.

### 5.1 Limites duros

- **Tamanho:** Nenhum módulo passa de **250 linhas**. Se passar, é sinal claro de que precisa rachar.
- **Tamanho de função:** Nenhuma função passa de **60 linhas**. `updatePlayer` hoje tem 75 e dá para ver o cheiro.
- **Profundidade de import:** Nenhum módulo importa mais de **6 outros módulos do projeto**. Se importa demais, é um Deus disfarçado.

### 5.2 Nomenclatura

- Arquivos: `lower-kebab` (`ambient-flak.js`) ou `lowerCamel` curto (`bullets.js`). Escolha um e mantenha; sugiro `lowerCamel` para combinar com o JS interno.
- Exports nomeados sempre. Nada de `export default`. Iniciante precisa ver na chamada `import { spawnBullet } from './bullets.js'` exatamente o que veio.
- Funções de update se chamam sempre `updateX(dt, ...)`. Spawners se chamam `spawnX(...)`. Construtores de mesh se chamam `makeX()`. Já é a convenção do código atual — formalizar.

### 5.3 Onde vai cada coisa nova

| Quero adicionar... | Vai em... |
|--------------------|-----------|
| Um novo tipo de alvo (ex.: silo de míssil) | `entities/targets.js` (builder `makeSilo`) + entrada em `config.TARGETS` + slot em `missions/layout.js` |
| Um novo som | `core/audio.js` (novo método na API do `audio`) |
| Uma nova tecla / comando | `core/input.js` (nova flag) + listener em `main.js` |
| Um novo widget no HUD | `ui/hud.js` (campo no objeto `_h` + render diff) e `index.html` (span novo) |
| Um novo efeito visual (ex.: trilha de fumaça atrás do jet) | `fx/particles.js` ou `fx/<novo>.js` |
| Uma nova missão | edita `missions/layout.js` (dados) |
| Um inimigo voador (aviões inimigos) | NOVO arquivo `entities/enemyJet.js`. NÃO grudar em `targets.js`. |
| Um novo cenário (ex.: deserto em vez de oceano) | `world/<novo>.js` substituindo `ocean.js` + `islands.js` |

### 5.4 `window.game` — o contrato global

**Decisão proposta (precisa do operador para confirmar — ver seção 7):**

- `window.game` continua existindo, **lido apenas por testes externos**.
- `window.audio` igual.
- Dentro do código, **ninguém faz `window.game = ...` ou `game.x = ...` exceto:**
  - `state.js` (define o objeto)
  - `state.js#resetState()` (zera campos)
  - `entities/player.js#updatePlayer` (escreve `game.player.x/y/speed/...`)
  - `entities/targets.js#killTarget` (incrementa `game.score`, `game.kills`, `game.targetsDestroyed`)
  - `missions/flow.js` (define `game.cycle`, `game.running`)
- Cada lugar que escreve em `game` precisa de um comentário `// CONTRATO: writer de game.X`.
- Leitura é livre.

### 5.5 Efeitos colaterais no load

**Regra:** importar um módulo não pode iniciar o game loop, não pode tocar áudio, não pode adicionar mesh à cena. Pode definir geometrias, materiais, pools, listeners — desde que o mesh só vá para a cena via uma função `create…()` ou `install…()` chamada por `main.js`.

Hoje, importar `game.js` faz literalmente tudo (cria mundo, mostra overlay, chama `tick()`). Após a migração, apenas `main.js` é "side-effect heavy"; os demais são bibliotecas.

### 5.6 Comentários e legibilidade para iniciante

- Em cima de cada módulo, **um bloco de 3 linhas** dizendo: o que faz, o que exporta de mais importante, e UMA frase do tipo "para adicionar X, edite Y".
- Magic numbers ficam em `config.js` com nome em maiúsculas e comentário. Ex.:
  ```js
  export const PLAYER = {
    MAX_SPD: 80,        // m/s — velocidade máxima com throttle 100%
    MIN_SPD: 8,         // m/s — abaixo disso o avião entra em stall
    STALL_SPD: 10,      // m/s — limiar para HUD piscar "STALL"
    GRAVITY: 14,        // m/s² — puxa o avião para baixo todo frame
  };
  ```
- Funções públicas (exportadas) têm uma linha de docstring `// `. Funções privadas (não exportadas) não precisam.

### 5.7 Regras para agentes (e o filho!)

1. Antes de mudar qualquer coisa que cruza módulo, **abra o arquivo importador e veja se quebra**. Use `grep -r 'spawnBullet' src/` para achar usos.
2. Se for adicionar uma feature nova, primeiro escreva uma frase explicando "onde vai" usando a tabela 5.3.
3. Não copie e cole. Se você está prestes a duplicar 5 linhas, extraia uma função em `config.js` ou no próprio módulo.
4. Se você precisa de uma variável global nova, pare. Use `state.js`.

---

## 6. Recomendação concreta — primeiros 30 minutos

Para sair do papel hoje à noite:

1. Criar `aero-fighters/src/` e `aero-fighters/src/config.js`.
2. Mover para `config.js` apenas estas constantes (sem renomear nada, sem refatorar lógica):
   - linha 1033: `CANNON_RATE = 0.08`
   - linhas 1062: `ROLL_DUR`, `ROLL_CD`
   - linhas 1073-1076: `MAX_SPD`, `MIN_SPD`, `STALL_SPD`, `GRAVITY`
   - linhas 875-881: `targetTypes` (renomear para `TARGETS`)
3. No topo de `game.js`, adicionar `import { CANNON_RATE, ROLL_DUR, ROLL_CD, MAX_SPD, MIN_SPD, STALL_SPD, GRAVITY, TARGETS as targetTypes } from './src/config.js';` e remover as declarações originais.
4. Abrir o jogo. Se rodar idêntico, **commit**. Mostre para seu filho: "olha, agora as regras do jogo moram nesse arquivo separado. Mude um número aí e veja o que acontece."

Esse é o exercício pedagógico de abertura. Cada commit subsequente repete o padrão: corta um pedaço, jogo continua funcionando, criança ganha confiança.

---

## 7. Perguntas abertas (para o operador)

Estas decisões EU sozinho não resolvo — dependem do gosto e dos planos do operador.

1. **Layout de missões em JSON?**
   Hoje `TARGET_LAYOUT` é literal JS (`[[3, 0, 0, 'base'], ...]`). Tem dois caminhos:
   - **(a)** Manter em `missions/layout.js` como literal. Mais simples; o filho lê e edita no mesmo editor.
   - **(b)** Mover para `missions/layout.json` carregado por `fetch('./missions/layout.json')`. Permite ter `mission-1.json`, `mission-2.json`, `mission-boss.json`. Custo: precisa async no boot.
   Recomendo **(a)** agora; migrar para (b) só quando passar de ~5 missões diferentes.

2. **Event bus, callbacks ou imports diretos?**
   O acoplamento "bullet acerta target → target.damage" hoje é resolvido por `damageTarget()` global. As três opções:
   - **(α)** Bullets importa `damageTarget` direto. Simples, fácil de debugar; mas cria dependência `entities/bullets → entities/targets` que viola a regra 4 (entities não se importam entre si).
   - **(β)** Callback injetado: `updateBullets(dt, jet, onPlayerHit, onTargetHit)`. Mais limpo, mas o iniciante vê parâmetros estranhos.
   - **(γ)** Mini event-bus: `events.emit('bulletHit', target)`. Mais escalável para um agente de IA, mas magia para a criança.
   Minha recomendação: **(α) com exceção formalizada em CONVENTIONS** ("entities/bullets pode importar entities/targets para chamar damageTarget"). É honesto. Se a base crescer, migrar para (β).

3. **Manter `window.game` e `window.audio` como API pública?**
   Hoje há `// kept as alias of targets for backwards-compat with old tests` (linha 14). Existem tests externos vivos consumindo isso? Se sim, mantemos. Se foi um experimento abandonado, podemos remover o alias e o `window.game`, e expor só `import { game } from './state.js'` para módulos e nada para o mundo externo.

4. **Bundler / hot-reload?**
   `vite` daria recarga automática de módulo (super útil ao iterar visualmente), mas exige `npm install` e tira a graça de "abre um http.server e roda". Recomendação: **NÃO** introduzir Vite agora. Quando a criança estiver confortável com ES modules nativos, aí sim — mas o ganho é instrutor, não arquitetural.

5. **TypeScript?**
   Não. Para um projeto pedagógico de filho de 8-12 anos, o tipo certo é JSDoc (`@param {number} dt`) opcional. Sem `tsc`, sem build.

6. **Pool de smoke compartilhado entre chaminé e explosão.**
   Quero separar em dois pools dimensionados (50 explosão + 30 chaminé). Mudança pequena, em `fx/particles.js`. Aprova?

7. **Variáveis duplicadas `speed`/`throttle` (módulo) vs `game.player.speed`/`game.player.throttle`.**
   Vou unificar em `game.player.*` durante a extração de `entities/player.js`. Confirma que nenhum teste externo lê isso a meio-frame e precisa do valor antigo?

8. **`CONVENTIONS.md` separado ou tudo dentro de `AGENTS.md` do `aero-fighters/`?**
   Hoje só existe `tauan-games/AGENTS.md`. Recomendo criar `aero-fighters/CONVENTIONS.md` para regras de arquitetura específicas do jogo, e linkar dele no `AGENTS.md` raiz.

---

## 8. Resumo de uma linha

> Quebrar `game.js` em **12 módulos** sob `src/`, com **4 camadas** rígidas (`state/config` → `core` → `world|entities|fx` → `ui|missions` → `main`), começando pelo passo de menor risco (`config.js`) e respeitando os limites de **250 linhas/arquivo** e **60 linhas/função** — sem build step, sem framework, com `window.game` mantido apenas como contrato externo de testes.

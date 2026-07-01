---
slug: aero-strike-combat
title: Aero Strike — inimigos e armas
category: product
tldr: 8 tipos de alvo (estáticos e móveis lentos) + boss kaiju + guerra dos aliados; canhão + 3 classes de míssil + nuke, com lock-on por cone.
summary: Especifica o catálogo de inimigos do Aero Strike (bases, fábricas, comboios, antiaéreas, helicópteros, navios, alvos lentos móveis) com HP/comportamento, o boss, o front paralelo dos aliados, e o arsenal do jogador (canhão Vulcan, mísseis leve/pesado/nuclear) com o sistema de lock-on. Detalhe suficiente para recriar o combate.
tags:
  - product
  - aero-strike
  - combat
  - enemies
  - weapons
agent_tier: self-pull
token_estimate: 0
last_updated: "2026-07-01"
release_origin: aero-fighters-world-realism-v1
---

## Propósito

Descrever o que o jogador combate e com o quê — com detalhe suficiente para recriar o
combate. Parte de [[aero-strike]].

## Visão geral

### Como adicionar um inimigo (seam)

O sistema de alvos (`targets.js`) tem um registro `MAKERS` (tipo→builder de mesh). Um novo
tipo exige exatamente: (1) `makeXxx()` + registro em `MAKERS`; (2) linha em `TARGETS`
(`config.js`); (3) constantes de velocidade/alcance em `SLOW_TARGETS` se móvel; (4)
fiação em `spawnTarget` (altitude aérea, path, fireInterval/range); (5) dispatch de AI em
`updateTargets`; (6) FX em `killTarget`; (7) slots nos `TARGET_LAYOUT*`. Móveis reutilizam
`updatePathTarget(t, dt, speed, altitude)` — `altitude 0` = solo, `> 0` = ar; **lento = só
usar um valor de velocidade pequeno** (não há mínimo).

### Alvos do jogador (config `TARGETS`)

| Tipo | HP | Score | Móvel? | Comportamento |
|------|----|-------|--------|---------------|
| `base` | 28 | 800 | estático | mega-explosão ao morrer |
| `factory` | 20 | 600 | estático | 3 chaminés soltam fumaça; mega-explosão |
| `building` | 14 | 450 | estático | — |
| `convoy` | 12 | 380 | estático | fila de 5 caminhões |
| `armedConvoy` | 18 | 700 | **solo, lento** | segue estrada/patrulha (~9 m/s), dispara rajadas (alcance 420) |
| `helicopter` | 10 | 650 | **ar, lento** | altitude 46, rotores animados, dispara (~14 m/s, alcance 620) |
| `aaGun` | 6 | 250 | estático (torre mira) | **única defesa fixa** — mira e atira no player em alcance `AA.RANGE 220`, intervalo `1.7 − speedup` |
| `warship` | 35 | 1200 | **naval, lento** | waypoints circulares, rajadas de 2, alcance 1200 |

- HP cresce `+3·(ciclo−1)`. `hr2` = raio² de acerto. Alvos são posicionados a partir do
  `TARGET_LAYOUT` do mapa (relativo à ilha/morro ou coordenada absoluta idx=-1); pavimento
  de aeroporto é pulado no spawn.
- **Alvos lentos móveis são um eixo de expansão** (WS-4): novos tipos de solo (ex.: tanque
  ~6 m/s) e de ar (ex.: dirigível/patrulha lenta ~7 m/s, alta) seguem o padrão
  `armedConvoy`/`helicopter`.

### Boss — "Godzillão" (kaiju)

Spawna quando todos os alvos da missão são destruídos. `HP 200`, raio de acerto 24, sobe do
chão (2,2 s), caminha na direção do jato a ~16 m/s, arremessa pedras balísticas
(`ROCK_SPD 150`, gravidade 26, mira antecipada) a cada ~3,4 s dentro de 1100 m. Entra em
`game.targets` como `type:'boss'` (balas/mísseis/nuke o acertam de graça); matá-lo dá 8000
de score, mega-explosão e libera o pouso. HP espelhado em `game.flags.bossHp` para a barra
do HUD.

### Guerra dos aliados (front paralelo)

`wingmen.js` + `ally-war.js`: 2 caças amigos (azuis) escoltam e atacam `game.allyEnemies`
(4 caças inimigos vermelhos, nova leva a cada ~7 s) com mísseis próprios; os inimigos
revidam com tracers contra os wingmen. **Este front nunca toca os alvos do jogador** e
vice-versa. Wingmen decolam/pousam com o jogador. (Caças inimigos que enfrentam o **player**
estão fora de escopo — backlog `aero-air-combat-v1`.)

### Arsenal do jogador (config)

- **Canhão Vulcan** (Space/Z): `RATE 0.08 s` (12,5 tiros/s), 2 balas/tiro, `BULLET_SPD
  110`, vida 2 s. Acerto: `dist² < target.hr2` → dano 1.
- **Míssil leve** (X): suprimento **100**, dano 4, 80/130 m/s, turn 0.30/0.55, vida 6 s,
  busca 1200 — **precisa de lock**, teleguiado com re-alvo.
- **Míssil pesado** (B): suprimento **10**, dano **20** (5×), 65/100 m/s, vida 8 s —
  precisa de lock.
- **Míssil nuclear** (T): suprimento **3**, dano **4000**, `BLAST_RADIUS 400`,
  `PLAYER_KILL_RADIUS 200`, `PLAYER_DAMAGE_RADIUS 450`. **Dispara sem lock** (acerta o
  terreno se não houver alvo). Na detonação: dano radial com falloff, deforma o terreno
  (cratera), slow-mo global 0.35× por 1,5 s (não em test/headless), câmera cinematográfica
  dedicada, e o espetáculo visual de [[aero-strike-fx]].
- **Lock-on** (`crosshair.js`): retículo fixo de canhão no centro; caixa de míssil segue o
  alvo mais próximo num **cone frontal ±15°** dentro de 1600 m; trava após 0,35 s no cone
  (beep acelerando, caixa fica vermelha). Rearme total no serviço do aeroporto.

## Estado runtime tocado

- `game.targets[]` (inclui boss), `game.allyEnemies[]`, `game.projectiles`,
  `game.player.{missiles,heavy,nuclear,hp,lives}`, `game.score`, `game.kills`,
  `game.targetsDestroyed`, `game.flags.bossHp`.

## Dependências

- [[aero-strike]] — o jogo. [[aero-strike-fx]] — o que acontece quando algo morre/explode.
- [[aero-strike-world]] — onde os alvos vivem (layouts por mapa).

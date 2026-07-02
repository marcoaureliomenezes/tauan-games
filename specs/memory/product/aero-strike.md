---
slug: aero-strike
title: Aero Strike — o jogo
category: product
tldr: Ataque ao solo em 3ª pessoa com um F-35 (Three.js) — destrua todos os alvos militares da missão, mate o boss, volte e pouse.
summary: Especifica a identidade, o loop de jogo, o objetivo, os modos e o modelo de vidas/HP do Aero Strike (pasta aero-fighters/). Atom-raiz para recriar o jogo a partir da memória; aponta para world/flight/combat/fx.
tags:
  - product
  - aero-strike
  - gameplay
agent_tier: self-pull
token_estimate: 0
last_updated: "2026-07-01"
release_origin: aero-fighters-world-realism-v1
---

## O que é

Aero Strike (pasta interna `aero-fighters/`, nome visível **Aero Strike**) é um jogo web
3D de combate ar-solo em 3ª pessoa. O jogador pilota um **F-35 Lightning II** e destrói
alvos militares (bases, fábricas, comboios, navios, antiaéreas, helicópteros) espalhados
por um mapa, enfrenta um **boss kaiju** ao fim da leva de alvos, e — no modo realista
padrão — volta ao aeroporto e **pousa** para reabastecer e iniciar a próxima surtida.
Engine: Three.js r165 (ES modules nativos, sem bundler, vendor local
`vendor/three.module.min.js`), Degrau 2 da ladder de engines (ver [[architecture]] e
[[tech-stack]]). Público-alvo: Tauan (ver [[overview]]); barra de qualidade em
[[quality-bar]].

## Propósito

Entregar um jogo de voo **imediatamente jogável** — sem loading visível, sem erro de
console, controles descobertos em segundos — que capture a sensação arcade de caça
(referência: Aero Fighters Assault N64) com um verniz de simulação leve (modelo de
energia de voo, decolagem/pouso, superfície realista). É o jogo mais complexo do
portfólio (~50 módulos ES, ~9,8k linhas).

## Fluxo de uso

1. **Boot** — o `index.html` carrega `src/main.js`; a cena/sky/mapa padrão inicializa e
   um **overlay de seleção de mapa** aparece.
2. **Seleção de mapa** — o jogador escolhe um dos 4 mapas (Mar do Sul/islands, Deserto,
   Rio de Janeiro, Inhauma); o mapa, seu aeroporto e o jato são construídos; wingmen e o
   front paralelo de caças são criados; overlay de instruções.
3. **Início** — Space/Enter começa a surtida: o jato decola (ou auto-taxi conduz) e a
   **missão 1** spawna sua leva de alvos.
4. **Combate** — o jogador voa, mira e destrói os alvos (canhão + mísseis + nuke). Ao
   destruir todos, um **boss kaiju** surge; matá-lo completa a missão.
5. **Retorno (modo realista)** — a surtida entra em `RETURN_TO_BASE`; o jogador volta ao
   aeroporto, pousa, o auto-taxi leva ao serviço (reabastece/rearma) e sinaliza
   `NEXT_SORTIE_READY`; Space inicia a próxima surtida (dificuldade sobe por ciclo).
6. **Fim** — perder as 3 vidas, morrer ou espatifar leva a game over ("pressione Espaço
   para reiniciar").

## Diferencial

- **Modo realista é o padrão** (`missionRealism.enabled`): muda fundamentalmente o loop —
  há máquina de estados de surtida (sortie FSM), aeroporto em todo mapa, decolagem/pouso,
  auto-taxi e cena de serviço, em vez do "próxima missão instantânea" arcade. Detalhe em
  [[aero-strike-flight]].
- **Uma verdade de superfície:** `surfaceInfoAt(x,z)→{height,kind}` governa colisão, pouso
  e HUD em todos os mapas — mar afunda, montanha/terra explode, pista pousa. Ver
  [[aero-strike-world]].
- **Três frentes simultâneas:** o jogador vs. alvos; o boss; e uma "guerra dos aliados"
  paralela (wingmen vs. caças inimigos) que nunca cruza com os alvos do jogador. Ver
  [[aero-strike-combat]].
- **Espetáculo de destruição:** explosões em camadas e uma **nuke** com flash, fireball,
  cogumelo atômico persistente, shockwave e ignição de cenário. Ver [[aero-strike-fx]].

## Estado runtime tocado

- `game` (fonte única, exposta em `window.game`): `running`, `score`, `cycle`, `lives`,
  `player.*`, `targets[]`, `islands[]`, `flags.*`, `missionRealism.*`, `activeMap`,
  `runtime` (config por URL `?map=&mission=&seed=&testMode=`).
- **Vidas/HP:** 3 vidas × 3 HP. 3 acertos → *mayday* (queda em chamas descontrolada) →
  impacto → respawn consome 1 vida. Morte instantânea: mar (splash + afundamento) ou
  montanha (mayday).

## Dependências

- [[aero-strike-world]] — mapas, terreno, água/rio, estradas, árvores, estruturas.
- [[aero-strike-flight]] — controles, física de voo, surtida/aeroporto/auto-taxi.
- [[aero-strike-combat]] — inimigos, boss, ally-war, armas, lock-on.
- [[aero-strike-fx]] — explosões, nuke, câmera, áudio, HUD.
- [[games-catalog]] — status de release; [[quality-bar]] — critérios de entrega.

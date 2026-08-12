---
slug: james-bond-jogo
title: James Bond Operações — o jogo
category: product
tldr: FPS de espionagem no browser com 6 operações, IA de guardas com A*, reforços que chegam voando de asa-delta — tudo procedural, nenhum asset do GoldenEye.
summary: Intuito, mapas (6 operações), lógica e características do james-bond (src/web-games/james-bond, Three.js) — inclui pulo que vence obstáculo baixo, auto-recarga, lança-granadas 2 s e reforços de asa-delta.
tags: [product, james-bond, fps]
token_estimate: 0
last_updated: "2026-08-12"
release_origin: repo-restructure-src-20260718
---

## Intuito
FPS de missões inspirado nos shooters de 1997 (estrutura, não assets): infiltrar,
cumprir objetivos e escapar. Conteúdo visual e sonoro 100% procedural/original.

## Mapas (operações)
1. Barragem Alpina · 2. Complexo Químico · 3. Relay Congelado · 4. Silo de
Mísseis · 5. Fragata Sequestrada · 6. Controle na Selva — cada uma com
iluminação própria e objetivos de missão. Toda missão tem mezanino com
escadaria, telhado, passagem subterrânea e torre de vigia (escada de mão).

## Lógica
Colisão AABB determinística em grid (paredes contíguas com colisores mesclados);
guardas navegam por grafo Yuka + A*; arsenal 1-5 + granada; mapa tático (M);
áudio sintetizado via Web Audio (sem samples).

## Movimento e pulo
O pulo (Espaço) tem ápice ~1,21 m (jumpSpeed 6.6, gravity 18): vence o
parapeito de 1,05 m de mezanino/telhado/torre e obstáculos baixos como
engradados e tambores. É a saída da torre de vigia — pula-se o guarda-corpo
(não há dano de queda). Escadarias sobem andando (passo automático 0,62 m).

## Combate e arsenal (5 slots)
Faca · Desert Eagle (7) · AK-47 (30) · Lança-granadas · Granada de mão.
- **Auto-recarga**: pente zerado engata a recarga sozinho — no disparo que
  esvazia o pente ou ao puxar o gatilho com ele vazio (E/R continuam manuais).
- **Lança-granadas**: cadência de 2 s, munição infinita, projétil visível.
- **Som por classe** (Web Audio, síntese): pistola = estalo agudo + boom grave
  seco; rifle = soco médio + clack de ferrolho; suprimida = thwip curto.

## Reforços de asa-delta
Cada missão declara `spawnRate: 5` (um reforço a cada 12 s) e `maxAlive: 16`.
O spawner só repõe quem morre, até o teto. O reforço não aparece do nada:
entra no mapa VOANDO de asa-delta (pool fixo de 4 velas coloridas,
~17 m de altitude, ~5 s de planeio com flare de pouso), vindo da direção da
borda. Em voo o inimigo já está vivo e alvejável — derrubar o piloto deixa o
corpo planando até o chão. Pool de rigs fixo (nunca cresce após o deploy);
só o térreo recebe reforço. Telemetria: `spawnerStats().arriving`.

## Características
Materiais PBR procedurais (metal/concreto/piso/neve), céu atmosférico, lanterna
tática, props instanciados. Auto-degradação em GPU fraca: 55% resolução, 30 Hz,
sem sombras. Estado de teste em `window.game`.

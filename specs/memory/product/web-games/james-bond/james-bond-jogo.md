---
slug: james-bond-jogo
title: James Bond Operações — o jogo
category: product
tldr: FPS de espionagem no browser com 6 operações, IA de guardas com A*, tudo procedural — nenhum asset do GoldenEye.
summary: Intuito, mapas (6 operações), lógica e características do james-bond (src/web-games/james-bond, Three.js).
tags: [product, james-bond, fps]
token_estimate: 0
last_updated: "2026-07-18"
release_origin: repo-restructure-src-20260718
---

## Intuito
FPS de missões inspirado nos shooters de 1997 (estrutura, não assets): infiltrar,
cumprir objetivos e escapar. Conteúdo visual e sonoro 100% procedural/original.

## Mapas (operações)
1. Barragem Alpina · 2. Complexo Químico · 3. Relay Congelado · 4. Silo de
Mísseis · 5. Fragata Sequestrada · 6. Controle na Selva — cada uma com
iluminação própria e objetivos de missão.

## Lógica
Colisão AABB determinística em grid (paredes contíguas com colisores mesclados);
guardas navegam por grafo Yuka + A*; arsenal 1-5 + granada/mina remota; mapa
tático (M); áudio sintetizado via Web Audio (sem samples).

## Características
Materiais PBR procedurais (metal/concreto/piso/neve), céu atmosférico, lanterna
tática, props instanciados. Auto-degradação em GPU fraca: 55% resolução, 30 Hz,
sem sombras. Estado de teste em `window.game`.

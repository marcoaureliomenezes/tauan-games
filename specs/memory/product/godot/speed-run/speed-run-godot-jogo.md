---
slug: speed-run-godot-jogo
title: Speed Run (Godot) — o jogo
category: product
tldr: Corrida desktop Godot 4 com VehicleBody3D real — circuito com aterro, guard-rails e 3 IA.
summary: Intuito, pista, lógica e características do speed-run Godot (src/godot/speed-run). Sucessor gráfico/físico da versão web por decisão do operador (2026-07-18).
tags: [product, speed-run, godot, corrida]
token_estimate: 0
last_updated: "2026-07-18"
release_origin: repo-restructure-src-20260718
---

## Intuito
Elevar a corrida ao patamar de engine real: física de veículo nativa
(suspensão raycast, atrito de pneu, transferência de peso, capotamento por
corpo rígido) e gráficos com sombras dinâmicas, céu procedural, névoa e
tonemap FILMIC. Decisão do operador após pesquisa de engines (Unreal/Unity são
editor-GUI-cêntricos; Godot opera por texto+CLI).

## Pista (v1)
Circuito fechado ~2,5 km (Curve3D suavizada) com elevação, faixas amarela
tracejada/brancas de borda, guard-rails com postes E colisão, terreno
heightfield que SEGUE a elevação da pista (aterro contínuo — nunca fita
flutuante), 420 árvores, anel de montanhas.

## Carros
GLB Quaternius CC0 (mesma fonte da versão web): Idea Adventure (jogador),
Velocità GT, Thunder V8, Neon 2049 (3 IA seguidoras de spline com alvo de
velocidade por curvatura). Rig de rodas: `VehicleWheel3D` com malha da roda
dianteira-esquerda centrada por AABB, espelhada por rotação 180° (nunca escala
negativa). Tração integral, centro de massa baixo (anti-capote).

## Lógica
`race.gd` constrói o mundo inteiro em código (sem editor); `car_factory.gd`
monta os VehicleBody3D. Countdown 3-2-1-GO, 3 voltas, HUD (km/h, volta,
posição, tempo), reset R. **Convenção MEDIDA** (tests/probe.gd):
`engine_force` positivo = ré neste rig → frente usa força negativa; ré real no
S com carro parado; esterço 4,2 rad/s com redução em alta velocidade.

## Características
Godot 4.7.1 Forward+; roda em Iris Xe; testes: `CORRIDA_TEST=1` headless
(métrica de avanço real) e `CORRIDA_SHOT=<dir>` (screenshots de viewport).
Pendências conhecidas: menu de seleção carro/pista, mais pistas, tráfego civil,
som; recolor não pega carros com textura-atlas (Neon 2049 sai branco-azulado).

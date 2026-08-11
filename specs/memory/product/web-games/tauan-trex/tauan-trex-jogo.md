---
slug: tauan-trex-jogo
title: Tauan T-Rex — o jogo
category: product
tldr: Clone aprimorado do Chrome Dino em Phaser — pular cactos, abaixar sob pterodátilos, dificuldade progressiva.
summary: Intuito, lógica e características do tauan-trex (src/web-games/tauan-trex, Phaser 3 vendorizado).
tags: [product, tauan-trex, runner]
token_estimate: 0
last_updated: "2026-07-18"
release_origin: repo-restructure-src-20260718
---

## Intuito
Runner infinito personalizado para o Tauan: sobreviver o máximo possível
desviando de obstáculos, com placar.

## Lógica
Corrida lateral com velocidade crescente; pulo (cactos) e agachar
(pterodátilos); colisão termina a corrida; score por distância/tempo.

## Características
Phaser 3 vendorizado (`vendor/phaser.min.js`), `game.js` único. ACs de QA
numerados nos testes (score após 3 s, FPS ≥ 55).

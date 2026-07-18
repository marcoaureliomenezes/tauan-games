---
slug: speed-run-web-jogo
title: Speed Run (web) — o jogo
category: product
tldr: Corrida arcade estilo Cruis'n World no browser — 3 pistas, 5 carros GLB (incl. Fiat Idea Adventure 2013), tráfego civil, capotamento.
summary: Intuito, pistas, lógica e características do speed-run web (src/web-games/speed-run, Three.js). Versão irmã desktop em src/godot/speed-run.
tags: [product, speed-run, corrida]
token_estimate: 0
last_updated: "2026-07-18"
release_origin: repo-restructure-src-20260718
---

## Intuito
Corrida arcade no espírito Cruis'n World (N64): pistas cênicas, tráfego civil,
carro especial do operador (Fiat Idea Adventure 2013 Dual Logic). Visual era
PS1: low-poly + textura procedural rica (lei: sem textura = rejeitado).

## Pistas (3, declarativas em tracks.js)
- **Centro Urbano** — prédios com fachadas iluminadas, avenidas.
- **Floresta Temperada** — pinheiros, trechos de terra.
- **Deserto do Arizona** — mesas/estratos, saguaros, offroad.
Spline Catmull-Rom fechada; superfícies asfalto/terra/offroad com atrito, arrasto
e tremulação distintos (SURFACES).

## Carros (5 + tráfego)
GLB Quaternius CC0 recolorido por saturação: Idea Adventure (SUV, cinza),
Thunder V8, Velocità GT, Mule Pickup, Neon 2049; tráfego civil lento (caminhão,
SUV). Rig de rodas: pivô recentrado no cubo (geometria dos GLB fica na origem).

## Lógica/física
`physics.js` própria: aceleração/freio/ré, colisão elástica 1-D com massas reais
(caminhão 4,5 t) e e=0,35, sem teto duro de velocidade (excesso decai por
arrasto — teto destruía momento), capotamento com desvirada em 2 s, cerca como
barreira sólida com ricochete, projeção contínua na spline (sem saltito).
IA por spline com lookahead; 6 corredores + 4 tráfego; 3 voltas.

## Características
Three.js r165, texturas canvas procedurais, PMREM p/ reflexo de lataria, debug
`window.__corrida`, IA pode dirigir o jogador nos testes.

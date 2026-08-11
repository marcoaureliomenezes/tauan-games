---
slug: far-west-jogo
title: Far West — o jogo
category: product
tldr: Faroeste open-world no browser — cowboy a cavalo num mundo procedural de 2048×2048 m com rios, florestas, caça e bandidos.
summary: Intuito, mapa, lógica de mundo e características do far-west (src/web-games/far-west, Three.js). Em desenvolvimento ativo (far-west-character-v1).
tags: [product, far-west, open-world]
token_estimate: 0
last_updated: "2026-07-18"
release_origin: repo-restructure-src-20260718
---

## Intuito
Western de exploração livre: cavalgar, caçar veados, capturar bandidos, entregar
caça — um mundo vivo e determinístico que roda offline no browser.

## Mapa
Mundo único procedural 2048×2048 m, seed fixa: montanhas emoldurando o horizonte,
florestas temperadas, 2 rios nascendo nas montanhas e descendo a um lago (perfil
de leito monotônico), vaus rasos (≤1,2 m) e pontes de madeira, trilhas.

## Lógica
Pipeline determinístico noise→rivers→heightfield (grid 2 m; contrato
`heightAt/normalAt/slopeAt/moistureAt` idêntico à malha renderizada), chunks com
LOD. Estado único em `window.game`; constantes só em `config.js`. Cavalo com
andaduras (passo/trote/galope com stamina), revólver com mira e recarga,
interações E (capturar/entregar/comer).

## Características
Three.js r165 vendorizado, ES modules ≤250 linhas, sem build; câmera 1ª/3ª pessoa
(V); mapa fullscreen (M). Modelos CC0 (cavalo, veado, cowboy…) em vendor/models.

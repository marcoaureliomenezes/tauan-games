---
slug: memoria-bichos-jogo
title: Memória dos Bichos — o jogo
category: product
tldr: Jogo da memória infantil em HTML/CSS/JS puro — pares de animais, por clique ou toque.
summary: Intuito, níveis e características do memoria-bichos (src/web-games/memoria-bichos, DOM puro).
tags: [product, memoria-bichos, infantil]
token_estimate: 0
last_updated: "2026-07-18"
release_origin: repo-restructure-src-20260718
---

## Intuito
Jogo para criança pequena: escolher um nível e encontrar pares de animais
virando cartas. Interface grande, colorida, tolerante a toque.

## Níveis e lógica
Níveis por quantidade de pares (dificuldade progressiva); carta vira no clique/
toque; par encontrado permanece aberto; nível vence ao encontrar todos os pares.

## Características
HTML/CSS/JS puro (DOM, sem canvas, sem libs) — `game.js` + `styles.css` únicos.
Acessível via hub `index.html`. Testes Playwright cobrem fluxo completo.

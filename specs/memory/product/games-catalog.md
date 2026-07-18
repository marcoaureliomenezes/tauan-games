---
slug: games-catalog
title: Catálogo de jogos
category: product
tldr: Todos os jogos do tauan-games por grupo de tecnologia (src/web-games e src/godot) com status.
summary: Lista canônica dos 9 jogos do portfólio, pasta, tecnologia, descrição e status. Reescrito 2026-07-18 na reestruturação src/.
tags: [product, catalog, games]
token_estimate: 0
last_updated: "2026-07-18"
release_origin: repo-restructure-src-20260718
---

## Propósito

Registrar TODOS os jogos e seu status, por grupo de tecnologia, para que
qualquer agente saiba o que existe antes de tocar no produto. Detalhes de cada
jogo: atoms em `product/web-games/<jogo>/` e `product/godot/<jogo>/`.

## Web games (`src/web-games/`)

| Jogo | Pasta | Tecnologia | Status |
|---|---|---|---|
| Aero Strike (aero-fighters) | `src/web-games/aero-fighters/` | Three.js r165 | Jogável; mapas incl. Inhaúma GIS |
| Far West | `src/web-games/far-west/` | Three.js r165 | Em desenvolvimento (far-west-character-v1) |
| James Bond Operações | `src/web-games/james-bond/` | Three.js r165 | Jogável; 6 operações |
| Memória dos Bichos | `src/web-games/memoria-bichos/` | HTML/CSS/JS puro | Jogável |
| Speed Run (web) | `src/web-games/speed-run/` | Three.js r165 | Jogável; 3 pistas, 5 carros |
| Tauan T-Rex | `src/web-games/tauan-trex/` | Phaser 3 (vendor) | Jogável |
| Space War | `space-war/` ⚠ raiz | Three.js r165 | Jogável; MIGRAÇÃO p/ src/web-games pendente |

## Godot games (`src/godot/`)

| Jogo | Pasta | Tecnologia | Status |
|---|---|---|---|
| Speed Run (Godot) | `src/godot/speed-run/` | Godot 4.7 | Jogável v1 (circuito único, 3 IA) |
| Aero Fighters v2 | `src/godot/aero-fighters-v2/` | Godot 4.x | Wave 1 completa; Wave 2 em progresso |

## Nomenclatura

Codename da pasta ≠ nome visível: `aero-fighters` exibe "Aero Strike";
`speed-run` exibe "Cruis'n Tauan". O hub `index.html` na raiz é a vitrine
pública dos jogos web (GitHub Pages); jogos Godot são distribuídos como binário
desktop (GitHub Releases).

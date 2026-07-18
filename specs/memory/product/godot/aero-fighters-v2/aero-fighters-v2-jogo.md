---
slug: aero-fighters-v2-jogo
title: Aero Fighters v2 — o jogo
category: product
tldr: Combate aéreo cel-shaded sobre Inhaúma-MG em Godot 4 — OSM + SRTM, roda em Iris Xe.
summary: Intuito, mapa, lógica e características do aero-fighters-v2 (src/godot/aero-fighters-v2). Degrau 3 da ladder; irmão do aero-fighters Three.js.
tags: [product, aero-fighters-v2, godot, voo]
token_estimate: 0
last_updated: "2026-07-18"
release_origin: repo-restructure-src-20260718
---

## Intuito
Recriar o combate aéreo do aero-fighters num patamar de engine desktop, com
direção de arte cel-shading estilizada sobre um lugar REAL: Inhaúma, Minas
Gerais. Sem APIs pagas nem contas externas.

## Mapa
Inhaúma-MG estilizada: footprints de prédios do OpenStreetMap
(`InhaumaBuildings`), vegetação (`InhaumaFoliage`), elevação SRTM (mirror AWS).

## Lógica
Scene tree Godot: `Player.tscn` (voo + canhão), `AAProjectile`/`Bullet`,
alvos (`Targets/`), `crash_detector`, câmera própria; shader cel em pós
(`CelShaderPass`). Autoload singletons para estado.

## Características
Godot 4 Forward+; roda a 1080p em Iris Xe. CI lint-only (gdlint + validade de
cenas headless + flake8 tools + Git LFS check); gates visuais/perf locais.
Status: Wave 1 completa, Wave 2 em progresso (pausado 2026-06-12, retomado na
migração p/ src/godot 2026-07-18). Docs próprios em docs/ e Tools/ Python.

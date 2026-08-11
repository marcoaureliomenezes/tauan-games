---
slug: games-catalog
title: Catálogo de jogos
category: product
tldr: Os 5 jogos web do tauan-games (src/web-games) com pasta, tecnologia e status.
summary: "Lista canônica dos 5 jogos do portfólio — todos web. Atualizado 2026-08-11: operador definiu foco exclusivo em aero-fighters, james-bond, space-war, speed-run e demolition-ball; removidos tauan-trex, memoria-bichos, far-west, bang-bang e TODOS os projetos Godot (repo é 100% web)."
tags: [product, catalog, games]
token_estimate: 0
last_updated: "2026-08-11"
release_origin: v0.10.0
---

## Propósito

Registrar TODOS os jogos e seu status para que qualquer agente saiba o que
existe antes de tocar no produto. Detalhes de cada jogo: atoms em
`product/web-games/<jogo>/`.

## Jogos (`src/web-games/`) — catálogo completo

| Jogo | Pasta | Tecnologia | Status |
|---|---|---|---|
| Aero Strike (aero-fighters) | `src/web-games/aero-fighters/` | Three.js r165 | Jogável; Inhaúma GIS; armas por cadência, campanha Cachoeira→Inhaúma |
| James Bond Operações | `src/web-games/james-bond/` | Three.js r165 | Jogável; 6 operações; uplift perf/gameplay 2026-08-11 |
| Space War | `src/web-games/space-war/` | Three.js r165 | Jogável; física real; decolagem pilotada |
| Cruis'n Tauan (speed-run) | `src/web-games/speed-run/` | Three.js r165 | Jogável; Idea Adventure réplica, música, 3 pistas + sprint/Fuga |
| Demolition Ball | `src/web-games/demolition-ball/` | WebGL2 puro (zero libs) | Jogável; v0.9.0 cidade viva + Modo Tauan |

## Decisão de escopo (operador, 2026-08-11)

O repositório é **100% web** e o foco é EXCLUSIVAMENTE nos 5 jogos acima.
Removidos (histórico permanece no git): tauan-trex, memoria-bichos, far-west,
bang-bang (web) e todos os projetos Godot (`src/godot/` não existe mais).
Nenhum agente deve recriar projetos Godot ou os jogos removidos sem ordem
explícita do operador.

## Nomenclatura

Codename da pasta ≠ nome visível: `aero-fighters` exibe "Aero Strike";
`speed-run` exibe "Cruis'n Tauan". O hub `index.html` na raiz é a vitrine
pública (GitHub Pages) — os cards do portal devem espelhar este catálogo 1:1.

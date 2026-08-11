---
slug: games-catalog
title: Catálogo de jogos
category: product
tldr: Todos os jogos do tauan-games por grupo de tecnologia (src/web-games e src/godot) com status.
summary: "Lista canônica dos 7 jogos catalogados do portfólio, pasta, tecnologia, descrição e status. Atualizado 2026-08-10 (v0.6.0): memoria-bichos/tauan-trex/demolition-ball-fable-5 deletados; aero-fighters unificado na versão web (v2 Godot removido); port Godot do aero-fighters restaurado e rastreado em git."
tags: [product, catalog, games]
token_estimate: 0
last_updated: "2026-08-10"
release_origin: v0.6.0
---

## Propósito

Registrar TODOS os jogos e seu status, por grupo de tecnologia, para que
qualquer agente saiba o que existe antes de tocar no produto. Detalhes de cada
jogo: atoms em `product/web-games/<jogo>/` e `product/godot/<jogo>/`.

## Web games (`src/web-games/`)

| Jogo | Pasta | Tecnologia | Status |
|---|---|---|---|
| Aero Strike (aero-fighters) | `src/web-games/aero-fighters/` | Three.js r165 | Jogável; mapas incl. Inhaúma GIS |
| James Bond Operações | `src/web-games/james-bond/` | Three.js r165 | Jogável; 6 operações |
| Speed Run (web) | `src/web-games/speed-run/` | Three.js r165 | Jogável — uplift v0.7.0: colisões invisíveis zeradas, fixed timestep, pista sprint + modo Fuga, Idea procedural |
| Space War | `space-war/` ⚠ raiz | Three.js r165 | Jogável; MIGRAÇÃO p/ src/web-games pendente |

## Godot games (`src/godot/`)

| Jogo | Pasta | Tecnologia | Status |
|---|---|---|---|
| Space War (Godot) | `src/godot/space-war/` | Godot 4.7 | Em desenvolvimento |

Nota 2026-08-10 (v0.7.0): speed-run Godot deletado após colheita (Idea, sprint,
perseguição portados para o web). james-bond Godot desapareceu da working tree
(nunca foi rastreado em git); rebuild parte do zero pelo contrato no atom
`product/godot/james-bond/`. Corrida no Godot: encerrada por decisão do operador.

## Nomenclatura

Codename da pasta ≠ nome visível: `aero-fighters` exibe "Aero Strike";
`speed-run` exibe "Cruis'n Tauan". O hub `index.html` na raiz é a vitrine
pública dos jogos web (GitHub Pages); jogos Godot são distribuídos como binário
desktop (GitHub Releases).

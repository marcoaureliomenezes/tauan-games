---
slug: games-catalog
title: Catálogo de jogos
category: product
tldr: Jogos/experimentos ativos do tauan-games e seus status de release.
summary: Lista cada projeto do repo (tauan-trex, aero-fighters/Aero Strike, space-war, testing-infra, aero-fighters-v2) com pasta, descrição e status. Inclui a nota de nomenclatura codename vs nome visível. Portado do HTML legado em 2026-06-12.
tags:
  - product
  - catalog
  - games
agent_tier: self-pull
token_estimate: 0
last_updated: "2026-07-03"
release_origin: space-war-campaign-v1
---

## Propósito

Registrar os jogos/experimentos ativos e seu status de release, para que qualquer agente
saiba o que existe e o que está em jogo antes de tocar no produto.

## Catálogo de features

| Projeto | Pasta | Descrição | Status |
|---------|-------|-----------|--------|
| Tauan T-Rex | `tauan-trex/` | Chrome Dino clone personalizado para Tauan — pixel art, high score, day/night. | Implementado (release `tauan-trex-v1` arquivada) |
| Aero Fighters (nome visível: **Aero Strike**) | `aero-fighters/` | F-35 Lightning II Ground Strike em Three.js — ataque a alvos militares. | Implementado (`aero-fighters-v1`, `aero-fighters-qa-hardening-v1` arquivadas; `aero-fighters-inhauma-map-v1` e `aero-fighters-mission-realism-v1` entregues pré-migração). **Uplift em definição: `aero-fighters-uplift-v1`.** |
| Space War | `space-war/` | Simulador de combate espacial Three.js: 6 sistemas estelares sobre a biblioteca de componentes celestes (`src/celestial/`, taxonomia NASA parametrizada por massa; sistemas como dados em `universe.js`), gravidade patched-conics, campanha em 5 fases (Solar → Betelgeuse → Binário → Caótico → Sgr A✦) com bombas inimigas balísticas, nukes recarregáveis e cometas com relevância de missão. | Implementado (`space-war-v1` entregue; `space-war-celestial-components-v1` e `space-war-campaign-v1` arquivadas 2026-07-03; backlog space-war zerado) |
| Aero Fighters V2 | `aero-fighters-v2/` | Reimplementação em Godot 4 (release `aero-fighters-v2-godot-stylized-inhauma-v1`, Aprovado). | **PAUSADO 2026-06-12** — retomar após o uplift do jogo web. |
| Testing Infrastructure | `tests/` | Playwright smoke + AC quality gate compartilhado por todos os jogos. | Implementado (release `testing-infra-v1` arquivada) |

## Diferencial

Nota de nomenclatura: o codename de pasta (`aero-fighters/`) e o nome visível ao jogador
(**Aero Strike**) divergem por escolha deliberada do operador. Toda referência interna
(specs, paths, comandos npm) usa o codename; toda referência visível ao jogador usa o
nome comercial. Não renomear pastas sem decisão explícita.

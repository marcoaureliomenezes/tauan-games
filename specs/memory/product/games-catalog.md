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
last_updated: "2026-07-04"
release_origin: space-war-interstellar-experience-v1
---

## Propósito

Registrar os jogos/experimentos ativos e seu status de release, para que qualquer agente
saiba o que existe e o que está em jogo antes de tocar no produto.

## Catálogo de features

| Projeto | Pasta | Descrição | Status |
|---------|-------|-----------|--------|
| Tauan T-Rex | `tauan-trex/` | Chrome Dino clone personalizado para Tauan — pixel art, high score, day/night. | Implementado (release `tauan-trex-v1` arquivada) |
| Aero Fighters (nome visível: **Aero Strike**) | `aero-fighters/` | F-35 Lightning II Ground Strike em Three.js — ataque a alvos militares. | Implementado (`aero-fighters-v1`, `aero-fighters-qa-hardening-v1` arquivadas; `aero-fighters-inhauma-map-v1` e `aero-fighters-mission-realism-v1` entregues pré-migração). **Uplift em definição: `aero-fighters-uplift-v1`.** |
| Space War | `space-war/` | Simulador de combate espacial Three.js: 6 sistemas estelares em **proporções verdadeiras** (θ = 2R/d; sistemas a ~anos-luz de jogo com cull universal — de um sistema não se vê os corpos dos outros) sobre a biblioteca de componentes celestes (`src/celestial/`, taxonomia NASA parametrizada por massa; sistemas como dados em `universe.js`; μ∝f com v_esc preservada e períodos Kepler), **estrelas fotométricas** (fontes pontuais I = L·(D0/d)² em quads instanciados, LOD ponto↔disco com histerese, glows de sistema, corona com teto de pixels, flare ∝ fluxo), gravidade patched-conics + Paczyński–Wiita nos compactos (ISCO 3rs, anel de fótons 2.6rs, zona de maré), **buraco negro e estrela de nêutrons das referências** (disco com estrias espirais e rim branco-quente; pulsar R 90 com needles polares, dipolo e strobe 30 Hz), **viagem interestelar T/O/Z** com perfil trapezóide 30/40/30 (cruzeiro a β≈0.995), relatividade visual realista (aberração da forma aparente, T′=δT, beaming δ⁴/headlight), crescimento na passagem rasante (2R/d, teto 48 px), streaks tangenciais com conservação de fluxo e imunidade a colisão em viagem, campanha em 5 fases (Solar → Betelgeuse → Binário → Caótico → Sgr A✦) com **caçada sequencial** e naves capitais, **solução de tiro balística no C** (`ballistics.js`, HUD com arco previsto, nuke `aimed` sob gravidade pura), **arsenal gravitacional** ([G] traçadora infinita, [H] bomba de Higgs com poço transiente em `computeGravity`, braços de Roche e supernova), bases de anatomia legível, cogumelo nuclear / duplo flash no vácuo e skybox com galeria de galáxias + bulbo galáctico na direção de Sgr A✦. | Implementado e **público no GitHub Pages** (`space-war-v1` entregue; `space-war-celestial-components-v1`, `space-war-campaign-v1`, `space-war-ballistic-war-v1` arquivadas 2026-07-03; `space-war-physics-fidelity-v1`, `space-war-interstellar-journey-v1`, `space-war-photometric-stars-v1`, `space-war-true-proportions-v1`, `space-war-interstellar-experience-v1` arquivadas 2026-07-04; ledger de bugs space-war zerado) |
| Aero Fighters V2 | `aero-fighters-v2/` | Reimplementação em Godot 4 (release `aero-fighters-v2-godot-stylized-inhauma-v1`, Aprovado). | **PAUSADO 2026-06-12** — retomar após o uplift do jogo web. |
| Testing Infrastructure | `tests/` | Playwright smoke + AC quality gate compartilhado por todos os jogos. | Implementado (release `testing-infra-v1` arquivada) |

## Diferencial

Nota de nomenclatura: o codename de pasta (`aero-fighters/`) e o nome visível ao jogador
(**Aero Strike**) divergem por escolha deliberada do operador. Toda referência interna
(specs, paths, comandos npm) usa o codename; toda referência visível ao jogador usa o
nome comercial. Não renomear pastas sem decisão explícita.

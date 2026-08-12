---
title: space-war-phases-roster-recovery-v1
status: idea
opened: 2026-08-12
description: Portar o trabalho não-mergeado do PR #21 (tag archive/space-war-phases-and-roster-v1) para o layout atual — roster DEVORADOR, world.js streaming/floating-origin, 3 fixes P0 de física, 11 testes.
---

# space-war-phases-roster-recovery-v1

## Description

O PR #21 (`feature/space-war-phases-and-roster-v1`, 12 commits, ~2.678 inserções,
2026-07-07) foi fechado sem merge em 2026-08-12 após auditoria de 3 sondas
independentes (blob-hash, grep de símbolos, git log -S) provar que **0% do
conteúdo está na develop**. O tip está preservado na tag anotada
`archive/space-war-phases-and-roster-v1` (ba4528d).

Conteúdo a portar (pré-reorg, `space-war/` → `src/web-games/space-war/`):

- `world.js` NOVO — streaming de sistemas (loadSystem/unloadSystem com dispose real
  de GPU), **floating-origin rebase a 1M unidades** (mata jitter float32).
- `config.js` — roster de 5 sistemas (split Devorador BN+Gigante / Pulsar
  NS+Sentinela), campos `lum`/`arriveDist`, colapso de literais + fixture snapshot
  de 491 linhas.
- 3 fixes P0: fronteira gateia relatividade; poço Higgs com perfil real
  (`higgsWellAccel`, Eggleton lobe, L1); gate de captura da nuke via `escapeSpeed`.
- Rename `game.phase` → `game.screen` (21 arquivos).
- Testes: `phases.spec.js` (5 E2E, incl. AC-05 GPU-dispose) + 6 unit novos em
  `test-physics-unit.js` + fixture.
- Docs: audit 2026-07-07 (2 arquivos), SPEC/PLAN/TASKS da release, backlog de
  findings LOW deferidos.

## Motivation

Trabalho real de física/arquitetura sem contraparte na develop. ATENÇÃO: a develop
seguiu linha divergente (mode.js three-states 2026-07-18, hysterese 1.0/1.15×R,
launch/launchpad/ballistics que o branch nunca viu) — **merge direto é inviável e
regrediria**; é um porte seletivo com reconciliação de design. O streaming +
floating origin não tem equivalente na develop (nada é descarregado nem rebased).

## Acceptance criteria

- Cada item acima portado OU rejeitado com justificativa escrita (disposition
  explícita por item, padrão de auditoria).
- Reconciliação com mode.js documentada (qual hysterese/mecanismo prevalece).
- Testes portados verdes; fixture snapshot regenerado para o config atual.
- Doutrina test-stewardship aplicada (S-08/S-10: cada asserção no menor tier).

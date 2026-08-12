---
title: "Combate ar-ar para aero-fighters (caças inimigos)"
status: candidate
opened: 2026-06-12
origin: grill aero-fighters-uplift-v1 (ADR-U3)
description: >-
  Caças inimigos ficaram FORA da release aero-fighters-uplift-v1 (ADR-U3) para não
  inflar o escopo. O jogo se chama Aero Fighters e hoje toda oposição é estática
  (AA) ou naval lenta (warship) — falta oposição aérea com IA de voo.
intents:
  - subject:
      kind: catalog
      ref: aero-strike-combat
    change: >-
      Adicionar combate ar-ar: novo módulo entities/enemyJet.js (lugar reservado em
      aero-fighters/CONVENTIONS.md §5.3, não grudar em targets.js); IA de voo
      patrulha → perseguição → ataque com desengajamento (arcade, não BFM); lock do
      player em alvos AÉREOS (crosshair hoje só trava em game.targets no chão);
      balanceamento por missão (nº de caças cresce com cycle); áudio flyby doppler
      e alerta de míssil inimigo.
---

# Backlog — Combate ar-ar para aero-fighters

**Decisão de origem:** ADR-U3 (grill 2026-06-12) — caças inimigos ficaram FORA da
release `aero-fighters-uplift-v1` para não inflar o escopo. O jogo se chama *Aero
Fighters* e hoje toda oposição é estática (AA) ou naval lenta (warship).

## Escopo candidato

- Novo módulo `entities/enemyJet.js` (lugar já reservado em
  `aero-fighters/CONVENTIONS.md` §5.3 — NÃO grudar em `targets.js`).
- IA de voo: patrulha → perseguição → ataque com desengajamento (arcade, não BFM).
- Lock do player em alvos AÉREOS (crosshair hoje só trava em `game.targets` no chão).
- Balanceamento por missão (nº de caças cresce com cycle).
- Áudio: flyby doppler, alerta de míssil inimigo.

## Pré-requisitos

Fundação da `aero-fighters-uplift-v1`: verdade de superfície (WS-1), voo com energia
(WS-3) e mortes por superfície (WS-5) — caças mortos devem cair com a mesma rota
mayday/queda.

## Curadoria (2026-08-11, project-manager)

Normalização BL-SCHEMA: frontmatter canônico (`title`/`opened`/`description`), status
`CANDIDATE` → `candidate`, e `intents[]` retro-vinculado à âncora de catálogo
`aero-strike-combat` (entradas `candidate` exigem intents tipados). Conteúdo original
preservado.

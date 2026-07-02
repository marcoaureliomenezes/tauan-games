---
name: aero-air-combat-v1
status: CANDIDATE
created: 2026-06-12
origin: grill aero-fighters-uplift-v1 (ADR-U3)
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

---
name: aero-air-combat-v1
status: delivered
created: 2026-06-12
delivered_in: v0.3.5
origin: grill v0.1.0 (ADR-U3)
---

# Backlog — Combate ar-ar para aero-fighters

**Decisão de origem:** ADR-U3 (grill 2026-06-12) — caças inimigos ficaram FORA da
release `v0.1.0` para não inflar o escopo. O jogo se chama *Aero
Fighters* e hoje toda oposição é estática (AA) ou naval lenta (warship).

## Escopo candidato

- Novo módulo `entities/enemyJet.js` (lugar já reservado em
  `aero-fighters/CONVENTIONS.md` §5.3 — NÃO grudar em `targets.js`).
- IA de voo: patrulha → perseguição → ataque com desengajamento (arcade, não BFM).
- Lock do player em alvos AÉREOS (crosshair hoje só trava em `game.targets` no chão).
- Balanceamento por missão (nº de caças cresce com cycle).
- Áudio: flyby doppler, alerta de míssil inimigo.

## Pré-requisitos

Fundação da `v0.1.0`: verdade de superfície (WS-1), voo com energia
(WS-3) e mortes por superfície (WS-5) — caças mortos devem cair com a mesma rota
mayday/queda.

---
name: aero-rotate-key-undiscoverable
status: Closed
severity: HIGH
reported: 2026-06-12
surface: aero-fighters — takeoff rotation input (player.js liftoff gate)
session_id: null
---

**Symptom:** "O avião não voa." Segurar ↑ (input natural de subir) com throttle
máximo NUNCA decola — verificado live: 8 s de W + ArrowUp → preso em y=0.9 a
106 m/s. Só a tecla ↓ (esquema invertido) rotaciona e decola (3 s → AIRBORNE).

**Repro:** desert → Space → segurar W + ArrowUp. Nada acontece, sem nenhum feedback.

**Expected:** O jogador descobre a decolagem em segundos (quality-bar: "controles
descobertos em segundos"). Input natural deve funcionar OU haver callout claro.

**Notes:** Liftoff gate escuta exclusivamente `input.pitchDown` (`src/player.js:355-358`).
A dica existe só no overlay de texto inicial. Agravante: groundSpeed sem limite
(106+ m/s) mascara o problema — parece que "falta velocidade". Fix → WS-4 do audit
`specs/audits/2026-06-12T220815Z/`: aceitar ↑ ou ↓ para rotação no solo + callout
"ROTATE" no HUD ao atingir V_ROTATE; grill: manter esquema invertido ou torná-lo
opcional.

**Fix (2026-06-12, release aero-fighters-uplift-v1):** Wave 3 (ADR-U1): no solo ↑ OU ↓ rotacionam (player.js liftoff gate); AC-5 atualizado e verde.

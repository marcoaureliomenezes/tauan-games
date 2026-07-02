---
name: aero-islands-realism-softlock
status: Closed
severity: CRITICAL
reported: 2026-06-12
surface: aero-fighters — sortie FSM / landing-zones / maps islands+rio
session_id: null
---

**Symptom:** No mapa `islands` (e `rio`) com mission realism, o avião nunca decola.
Verificado ao vivo: 8 s de throttle máximo + rotação → estado `TAXI_OUT`, y=0.9,
speed **106,5 m/s**, contact `water`. O jogo fica soft-locked esquiando na água.

**Repro:** `index.html?map=islands` → Space → segurar W (e ArrowDown). Observar
`window.game.missionRealism.sortie.state` — nunca sai de TAXI_OUT.

**Expected:** Decolagem possível em todos os mapas jogáveis.

**Notes:** Liftoff gate exige `surface === 'runway'` (`src/player.js:355-358`), mas
`classifyGroundContact`/`getAirportForMap` só conhecem aeroportos do desert e do
inhauma (`src/landing-zones.js:23-29`, `src/airport.js:31-33`). Rio é incoerente:
`rioHeightAt` consulta o aeroporto do desert. Agravante: `updateGroundRoll` não tem
velocidade terminal (accel 18 > friction 4) — groundSpeed cresce sem limite.
Solução proposta: WS-2 do audit `specs/audits/2026-06-12T220815Z/`.

**Fix (2026-06-12, release aero-fighters-uplift-v1):** Wave 2 (commit eb13fba): pista costeira islands (ADR-U2) + registro de aeroportos por mapa + pista rio; liftoff verificado nos 4 mapas (U-AC-1).

---
name: aero-airborne-floor-glue
status: Closed
severity: CRITICAL
reported: 2026-06-12
surface: aero-fighters — player.js floor clamp / checkTerrainCollision
session_id: null
---

**Symptom:** Em estado `AIRBORNE`, descer até a pista gruda o avião em y=0.9 com
z congelado (observado em ≈−260, borda sul da pista do desert), speed 80, sem crash,
sem pouso, sem recuperação possível. Verificado ao vivo 2× (probes Playwright).

**Repro:** desert → decolar → nariz para baixo até tocar a pista voando. O avião
fica "colado" deslizando no chão para sempre.

**Expected:** Tocar a pista em voo deve resultar em pouso (sink baixo) ou crash
(sink alto) — nunca um limbo sem transição.

**Notes:** O floor-clamp do caminho airborne (`src/player.js:518-529`) força
`y = contact.height + 0.9` sobre superfície de aeroporto, enquanto
`checkTerrainCollision` (`src/world.js:190`) devolve `null` quando `contact.safe`.
Touchdown só é avaliado em `RETURN_TO_BASE` (`src/player.js:553`). Solução: máquina
de contato única (WS-1 do audit `specs/audits/2026-06-12T220815Z/`).

**Fix (2026-06-12, release aero-fighters-uplift-v1):** Wave 1 (commit eb13fba): máquina de contato em player.js — touchdown oportunista / hard-landing bounce / crash roteado; estado congelado impossível (U-AC-3).

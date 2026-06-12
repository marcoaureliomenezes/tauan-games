---
name: aero-sea-label-on-land
status: Open
severity: HIGH
reported: 2026-06-12
surface: aero-fighters — world.js checkTerrainCollision
session_id: null
---

**Symptom:** Colidir com o chão plano de QUALQUER mapa abaixo de y=3 produz crash
classificado como `'SEA'` → overlay "IMPACTO NO MAR" no meio do deserto/cidade.
Não há diferenciação física mar vs terra (afundar vs explodir).

**Repro:** desert → decolar → mergulhar no piso fora da pista. Overlay exibe
"IMPACTO NO MAR".

**Expected:** Mar só existe onde o mapa tem água (islands, orla do rio). Impacto na
água → splash + afundamento; impacto na terra → explosão/skid.

**Notes:** `src/world.js:191` — `if (jetPosition.y < 3) return 'SEA'` incondicional.
`classifyGroundContact` até distingue água (`src/landing-zones.js:31`, só islands),
mas o caminho de crash não a consulta. Pedido explícito do operador (2026-06-12):
colisão com mar ≠ colisão com terra; avião deve cair com fumaça e explodir no solo,
ou afundar no mar. Solução: WS-1 + WS-5 do audit
`specs/audits/2026-06-12T220815Z/`.

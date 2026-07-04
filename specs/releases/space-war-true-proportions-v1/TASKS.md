# TASKS — Release: space-war-true-proportions-v1

> **Status:** Aprovado — 2026-07-04
> **Owner:** main agent (Fable 5) — mandato do operador

- [x] **T-TP-01** — Config: remover WALL-SCALE; bloco único de proporção
  verdadeira (raios/μ revertidos, centros ×5, SOI solar, RENDER/skybox/FLARE/
  OVERDRIVE/gauges). Write set: `space-war/src/config.js`,
  `space-war/src/celestial/physics.js` (gauges/PHOTO_D0).
- [x] **T-TP-02** — Cull universal (solar incluso) + Betelgeuse sem
  alwaysVisible + glow do solar. Write set: `space-war/src/celestial/system.js`,
  `space-war/src/celestial/starlod.js`, `space-war/src/universe.js`.
- [x] **T-TP-03** — Buraco negro das referências: rs 3×, disco 5× com estrias
  espirais + rim quente, jato bipolar no estelar, monte lenseado. Write set:
  `space-war/src/celestial/stars.js`, `space-war/src/celestial/atoms.js`,
  `space-war/src/config.js` (defs BN).
- [x] **T-TP-04** — Estrela de nêutrons das referências: R 90, needles polares,
  halo, gaiola, core ofuscante. Write set: `space-war/src/celestial/stars.js`,
  `space-war/src/config.js` (def NS).
- [x] **T-TP-05** — Remanescente fade-in de longe + corrente de acreção espiral
  + jato da nave sem bola azul + reflexo sutil. Write set:
  `space-war/src/celestial/system.js`, `space-war/src/universe.js`,
  `space-war/src/ship.js`.
- [x] **T-TP-06** — Testes por LEIS: unit sweep re-derivado; physics.spec AC-06
  reescrito (proporções); novo `proportions.spec.js`; ajustes journey/
  photometric/campaign. Write set: `tests/space-war/**`.
- [-] **T-TP-07** — QA end-of-alpha + security push-verdict + push + PR stacked
  (base main) + CI verde. Write set: `.dadaia/handoff/**`, `specs/**`.

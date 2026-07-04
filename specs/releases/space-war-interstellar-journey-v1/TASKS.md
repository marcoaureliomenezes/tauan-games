# TASKS — Release: space-war-interstellar-journey-v1

> **Status:** Aprovado — 2026-07-04 · **SPEC:** [Aprovado] · **PLAN:** [Aprovado]

## Write set

`space-war/src/**`, `tests/space-war/**`, `package.json`, esta release.
**PROIBIDO:** `aero-fighters/**`, `tauan-trex/**`, `vendor/**`.

## Tasks

- [ ] T-IJ-01 journey.js: perfil brachistochrone puro (node-testável) + autopilot
      T/O/[Z] contextual + abort + HUD (ETA, β, barra s) + journeyWarp debug. **AC-01, AC-02.**
- [ ] T-IJ-02 starfield.js: corredor galáctico em chunks hash (2 camadas + nebulosas,
      fade por proximidade de sistema, paleta espectral). **AC-03.**
- [ ] T-IJ-03 Relatividade realista: aberração + T'=δT + beaming δ⁴ no shader do
      starfield; convergência+tint no postfx p/ skybox. **AC-04.**
- [ ] T-IJ-04 Bulbo galáctico no skybox na direção do core (sem ponto central). **AC-05.**
- [ ] T-IJ-05 Nave visível: jato de plasma shader, wingtips vermelhas pulsantes,
      rim+PointLight de reflexo. **AC-06.**
- [ ] T-IJ-06 Unit (perfil) + e2e (engate/warp/uniforms/chegada/nave) + suíte completa
      + QA + security + push/PR/CI. **AC-07.**

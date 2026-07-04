# PLAN — Release: space-war-interstellar-experience-v1

> **Status:** Aprovado — 2026-07-04
> **Base:** feature/space-war-true-proportions-v1 (stacked em PR #18)

## Decisões

- **D-1 (leis puras primeiro):** `journeyProfileTrapezoid(D,T,t)` em
  celestial/physics.js ao lado do brachistochrone (que fica como lei documentada
  da v1 — os testes de lei continuam valendo para ambos). journey.js troca o
  perfil e o β_visual (0.985·v/vPeak → 0.995·v/vMax).
- **D-2 (crescimento = geometria, não truque):** iRad por instância (600–3500,
  poucos grandes) → termo angular honesto 2·iRad/(d·θpx) somado ao px
  fotométrico, teto suave uCloseMax 48. O crescimento emerge SÓ para parâmetro
  de impacto pequeno — exatamente a demanda ("perto do centro da tela").
- **D-3 (riscos = eixos próprios do quad):** em vez do billboard right/up da
  câmera, eixos (radial-de-tela do fluxo aparente, perpendicular) — com
  alongamento L = w·(1 + clamp(uStreakK·v·senθA/d, 0, 10)). Streak 0 → PSF
  circular idêntica (orientação irrelevante). Fallback right/up quando dead-ahead.
- **D-4 (imunidade REVERTE D-1 do rc-1 da journey):** o abort-por-impacto foi
  decisão de QA; o operador agora manda o contrário ("retire a possibilidade de
  colidirmos"). Fica documentado aqui; `journey.immune = true` como diag.
- **D-5 (HUD por fase):** ACELERANDO/CRUZEIRO/FREANDO derivados de prof.phase.

## Ordem

1. T-IE-01 physics.js trapezoide + unit.
2. T-IE-02 journey.js (perfil, β 0.995, imunidade, fase) + hud.js.
3. T-IE-03 starfield.js (iRad, streak, beaming 9, β teto 0.995, diag).
4. T-IE-04 testes: journey.spec platô; novo journey-experience.spec; suíte.
5. T-IE-05 QA + security + push + PR (base main) + CI verde.

## Riscos

- **R-1 journey.spec assume brachistochrone** (pico no meio): platô agora —
  revisar asserts de β/warp.
- **R-2 headless perf:** quads maiores (48px) só em passagens raras; streak é
  vertex-only. Counts headless inalterados.
- **R-3 arrival:** perfil muda x(t) mas x(T)=D exato — chegada intacta.

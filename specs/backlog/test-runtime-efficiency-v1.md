---
title: "Eficiência de execução da suíte Playwright (CI 20,4 min → alvo ≤ 10 min)"
status: candidate
opened: 2026-08-11
description: >-
  Baseline CI 2026-07-20 = 168 testes em 20,4 min com workers:1; média de sucesso
  11,8 min; pior caso 28,2 min (≈19 min de fila de runner). Estimativa: −40–50% só
  com config; −55–65% com mudanças em testes.
intents:
  - subject:
      kind: catalog
      ref: quality-bar
    change: >-
      Eficiência da suíte Playwright de src/web-games/ — (1)
      tests/playwright.config.js: workers 1 → 2–3 (runner público GitHub Actions =
      4 vCPU), estimativa −40–50% do step de testes; (2) tests/playwright.config.js:
      testDir '.' sem testIgnore engole james-bond (budgets 600–900 s/teste) e
      demolition-ball SEM as flags GL — adicionar testIgnore para dirs com config
      dedicado (preventivo: evita explosão de horas quando o james-bond de 12 testes
      for commitado); (3) tests/playwright.config.js: promover as flags GL/ANGLE de
      tests/demolition-ball-opus-5/playwright.config.js:25-33 ao config raiz
      (SwiftShader medido a 1,76–2,65 fps contra requisito de 55 no trex) — ganho
      local (GPU) alto e comprovado, ganho no CI (sem GPU) exige 1 run A/B antes de
      contar; (4) .github/workflows/ci.yml: sem path filter e sem concurrency group,
      commit docs/Godot roda a suíte toda e pushes empilham fila (pior caso 19 min
      de fila) — adicionar paths filter + concurrency cancel-in-progress (os
      workflows Godot do próprio repo já fazem); (5) tests/ specs: 216,6 s de
      waitForTimeout fixo em 191 call sites — converter para polling (padrão já
      existe em tests/aero-fighters/smoke.spec.js:36), estimativa −10–15% + menos
      retries, sequenciar depois dos itens config-only; (6)
      tests/playwright.config.js: retries:1 global + trace/video on-first-retry —
      teste com timeout de 90 s paga 180 s, revisar política de retry/timeout.
---

# Eficiência de execução da suíte Playwright (CI 20,4 min → alvo ≤ 10 min)

## Description

Baseline CI 2026-07-20 = 168 testes em 20,4 min com `workers: 1`; média de sucesso
11,8 min; pior caso 28,2 min (≈19 min de fila de runner). Estimativa: −40–50% só com
config; −55–65% com mudanças em testes.

## Mudanças propostas (detalhe por alvo)

1. `src/web-games/tests/playwright.config.js` — `workers: 1` → 2–3 (runner público =
   4 vCPU); estimativa −40–50% do step de testes.
2. `src/web-games/tests/playwright.config.js` — `testDir: '.'` sem `testIgnore` engole
   james-bond (budgets 600–900 s/teste) e demolition-ball SEM as flags GL; adicionar
   `testIgnore` para dirs com config dedicado (preventivo: evita explosão de horas
   quando o james-bond de 12 testes for commitado).
3. `src/web-games/tests/playwright.config.js` — promover as flags GL/ANGLE de
   `tests/demolition-ball-opus-5/playwright.config.js:25-33` ao config raiz
   (SwiftShader medido a 1,76–2,65 fps contra requisito de 55 no trex); ganho local
   (GPU) alto e comprovado; ganho no CI (sem GPU) exige 1 run A/B antes de contar.
4. `.github/workflows/ci.yml` — sem path filter e sem concurrency group: commit
   docs/Godot roda a suíte toda e pushes empilham fila (pior caso 19 min de fila);
   adicionar paths filter + concurrency cancel-in-progress (os workflows Godot do
   próprio repo já fazem).
5. `src/web-games/tests/` (specs) — 216,6 s de `waitForTimeout` fixo em 191 call
   sites; converter para polling (padrão já existe em
   `tests/aero-fighters/smoke.spec.js:36`); estimativa −10–15% + menos retries.
   (Mudança em código de teste — sequenciar depois dos itens config-only.)
6. `src/web-games/tests/playwright.config.js` — `retries: 1` global + trace/video
   on-first-retry: teste com timeout de 90 s paga 180 s; revisar política de
   retry/timeout.

## Evidence

- Report: `.dadaia/reports/tauan-games/qa-engineer/2026-08-11T180616Z-test-runtime-efficiency-both-repos.html`
- Handoff: `.dadaia/handoff/tauan-games/2026-08-11T180616Z-qa-engineer-test-runtime-efficiency-both-repos.handoff.json`

## Acceptance criteria

Medição antes/depois contra o baseline do report (step "Run tests" do CI e wall local),
sem remover nenhum teste.

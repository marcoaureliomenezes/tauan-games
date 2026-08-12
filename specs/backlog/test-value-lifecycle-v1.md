---
title: test-value-lifecycle-v1
status: idea
opened: 2026-08-12
description: Corrigir a pirâmide invertida da suíte (23/25 suítes Node fora do CI), deletar/fundir/rebaixar E2E sem valor e adotar política de ciclo de vida de testes com teto por jogo.
---

# test-value-lifecycle-v1

## Description

Consumir o estudo de valor/ciclo-de-vida de 2026-08-12
(`.dadaia/reports/tauan-games/qa-engineer/2026-08-12T153535Z-playwright-value-lifecycle-study.html`,
handoff validado no mesmo timestamp). Frentes, em ordem de ROI:

1. **Ligar as suítes Node no CI** — `test:aero:qa`, `test:aero:unit`, `test:aero:sim`,
   `test:space-war:unit` (23/25 suítes, ~5.700 LOC, segundos de runtime) como primeiro
   job do `ci.yml`, gateando a matriz de browser.
2. **Deletar sem perda de cobertura**: 4 testes tautológicos em
   `aero-fighters/review-fixes.spec.js`; aero AC-1 (⊂ AC-16) e AC-2 (⊂ soak do
   diagnostics); waitForFunction duplicado em `landing.spec.js:66/76`; teste FPS do
   demolition-ball (skip permanente em CI); 13 probes órfãos (ws3/ws4/ws5/ws6,
   `solve-upper.mjs`); 10 npm scripts duplicados (package.json:27-35); 18 PNGs
   rastreados sob `tests/**/screenshots/` + write de `sortie.spec.js:154` (git rm +
   gitignore).
3. **Fundir duplicatas**: decolagem ~11×→2 no aero; `three-states-flow` (240 s) →
   mode/journey (preservar só o freio de acoplamento 2000 u/s); nuke 3×→1 (manter
   arsenal-keys, tecla real); anatomia NS 2×→1; Higgs 2×→1; nuke-staging aero 2×→1;
   remover passo demolition-ball da célula corrida do `ci.yml` (roda 2×).
4. **Rebaixar para Node** (sem browser): proporções angulares, massas TOV/SMBH,
   footprint (space-war); raios nucleares, surface-kinds U-AC-2/U-AC-7, 6 boots de
   map.spec para `Number.isFinite` (aero); grip de `SURFACES`, contagem de placas
   (corrida).
5. **Defeitos de config**: `tests/james-bond/playwright.config.js` outputDir escapa
   6 níveis para `.dadaia/tmp/root/20260718/` (em runner GitHub sai do checkout);
   testes de FPS AC-18 (aero) e FPS≥4 (space-war) → frame-counter poll (−14 s de sleep).
6. **Política de ciclo de vida como lei do repo** (AGENTS.md do tauan-games, após
   aprovação): nascimento ligado a AC/bug; E2E só quando a asserção exige browser;
   teto ~12–15 E2E por jogo; morte explícita (feature removida, redundância,
   tautologia, skip permanente, custo>valor); revisão de suíte no DoD de release;
   dev local nunca roda suíte inteira (`--only-changed`, `--project`, `@smoke`);
   browsers de agente com nice/taskset + flags ANGLE locais (GPU real; A/B do CI já
   medido negativo — runner sem GPU) + teardown de playwright-mcp órfãos.

## Update 2026-08-12 (mesmo dia, sessão de estudo aprofundado)

Estudo aprofundado com mapa integral de rebaixamento e doutrina referenciada:

- Report: `.dadaia/reports/tauan-games/qa-engineer/2026-08-12T160030Z-agent-test-lifecycle-doctrine.html`
  (+ anexo `...-annex-demotion-map.html` com os 187 casos classificados um a um; handoff VALID).
- **Classificação dos 187 casos E2E**: 63 browser-intrínsecos (34%) · 62 já cobertos por
  suítes Node que não rodam (33%) · 53 rebaixáveis (19 bloqueados por DOM top-level em
  scene.js/world.js/main.js — refactor `initScene()` lazy, precedente T-09 nuclear-fx) ·
  9 andaimes. Projeção: **187 → 63–82 E2E (−56% a −66%)**; ~50 min de orçamento de
  browser viram segundos de node.
- **9 admissões verbatim nos specs** de que a camada Node é a autoridade (lista no anexo §1).
- **Doutrina de 6 leis** (report §5) para ciclo de vida de testes com agentes: intenção
  declarada (CONTRACT/SENTINEL/SCAFFOLD em tests/tmp com expiração/QUARANTINE), admissão
  filtrada (padrão Meta TestGen-LLM/ACH), rebaixamento pós-validação obrigatório
  (Vocke/Beck), separação implementador × steward (Beck: deleção pelo implementador =
  trapaça), valor medido por mutation testing (Stryker), E2E só para o intrinsecamente
  de browser. 24 referências verificadas com URL no report.
- Plano em fases: F0 config-only (ligar suítes Node como gate, deletar 9 andaimes,
  execução dupla) · F1 rebaixar 62+34 casos · F2 refactor habilitador (destrava 19) ·
  F3 lei no AGENTS.md + piloto Stryker + DoD com etapa de rebaixamento.

## Update 2026-08-12 (v2 — statements normativos)

Report v2 com o catálogo de 30 statements (S-01..S-30) que será a fonte da skill
`dadaia-test-stewardship` e do incremento da lei DADAIA.md:
`.dadaia/reports/tauan-games/qa-engineer/2026-08-12T175304Z-test-stewardship-statements-v2.html`
(handoff VALID). 21 statements com respaldo de literatura verificada (36 refs no total,
incl. SWE-book ch11/12/14, Bazel timeouts 60/300/900s, Micco 2016, Slack 2022, Datadog
30d/30d), 9 normas nossas declaradas (destaque: S-17 teste-lápide — inédito na
literatura; S-02 SCAFFOLD em tests/tmp com expiração no fechamento). 8 parâmetros
aguardando aprovação do operador (§10 do report). Rota: aprovação → ai-engineer autoria
a skill → lei via dadaia_workspace/public/ + re-projeção.

## Motivation

Operador (2026-08-12): CPU do laptop integralmente consumida por browsers headless de
teste/validação; "essa estratégia atual não será mais tolerada". Diagnóstico: pirâmide
invertida no CI (188 casos E2E vs 2 suítes Node), redundância estrutural (~11 testes de
decolagem), tautologias e ~91 s de sleeps fixos. Referências externas unânimes (Google
Testing Blog 70/20/10, Fowler practical-test-pyramid e nonDeterminism, Kent C. Dodds,
Playwright best-practices) — detalhes e URLs no report.

## Acceptance criteria

- CI executa as suítes Node como job de gate antes da matriz de browser; cobertura
  raiz+dedicados ≥ baseline.
- Zero testes tautológicos; zero probes órfãos; zero artefatos de teste rastreados no
  git que runs sobrescrevem; zero duplicação de execução no CI (demolition-ball 1×).
- Contagem de casos E2E por jogo ≤ teto aprovado, com cobertura equivalente provada
  (mapa velho→novo no CLOSURE).
- Política de ciclo de vida publicada como lei do repo e referenciada no DoD.
- Wall-clock do CI ≤ baseline v0.10.0 (aero 6,8 min / space-war 6,5 min / corrida
  2,8 min) com a camada Node adicionada.

## Intents (required at `candidate` and beyond)

<!--
An `idea` needs no `intents[]`. Before promoting this entry to `status: candidate`, add a
typed `intents[]` frontmatter block binding each change to a canonical subject anchor, then
move it ABOVE the closing `---` of the frontmatter. Discover bindable anchors with
`dadaia backlog subjects`. Subject kinds: code | cli | catalog | doc | invariant
(code anchors are derived from Python sources only — in a non-Python repo bind catalog/doc/
invariant anchors instead).
-->

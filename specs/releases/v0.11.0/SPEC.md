# SPEC — Release: v0.11.0

**Status:** Aprovado
**Release ID:** v0.11.0
**Owner:** product-engineer (autoria delegada pelo operador em sessão de 2026-08-12)
**Opened:** 2026-08-12
**Consumes:** test-value-lifecycle-v1 (fases 0 e 1; fase 2 — refactor initScene — fica no backlog)

## 1. Problema

Auditoria de 2026-08-12 (report `2026-08-12T160030Z-agent-test-lifecycle-doctrine.html` +
anexo demotion-map, workspace `.dadaia/reports/tauan-games/qa-engineer/`) classificou os
187 casos E2E: **63 browser-intrínsecos (34%) · 62 já cobertos por suítes Node que não
rodam em CI nenhum (33%) · 53 rebaixáveis (19 bloqueados por DOM top-level) · 9
andaimes/tautologias**. 24 suítes Node (~170 casos) têm valor zero em CI. ~50 min de
orçamento declarado de browser são substituíveis por segundos de node. Ordem do operador:
corrigir tempo/recursos/complexidade, deletar slop, rebaixar E2E→integration/unit,
limpar lixo de disco.

## 2. Requisitos (por statement da doutrina v2)

- **FR-1 (S-16, S-18):** deletar os 9 testes andaime/tautologia, 13 probes órfãos,
  10 npm scripts duplicados; remover PNGs rastreados que runs sobrescrevem (+ screenshot
  write de sortie.spec.js:154); corrigir âncora do .gitignore.
- **FR-2:** ligar as suítes Node no CI como job-gate antes da matriz de browser
  (test:aero:qa, test:space-war:unit, + defense-mode e firestorm fora da cadeia);
  remover a execução dupla do demolition-ball no ci.yml.
- **FR-3 (S-12, S-15):** rebaixar os casos ALREADY-COVERED (deletar E2E mantendo
  resíduos de 1 linha DOM/HUD onde o mapa indica) e os DEMOTABLE-NEW desbloqueados
  (criar/estender suítes Node conforme esboços do anexo). Casos ⚠ (bloqueados por DOM
  top-level) NÃO são tocados nesta release. Mapa E2E→substituto registrado no CLOSURE.
- **FR-4:** james-bond outputDir deixa de escapar do repo; screenshots de caminho feliz
  sem consumidor removidos (S-23); FPS asserts de parede (aero AC-18, space-war FPS≥4)
  viram frame-counter poll; FPS morto do demolition-ball deletado.
- **FR-5:** higiene de disco fora do repo: artefatos de runs anteriores
  (screenshots/report/pids órfãos) deletados, respeitando servidores registrados vivos.

## 3. Aceitação

- Suítes Node passam localmente (node, segundos) e são gate no ci.yml.
- `npx playwright test --list` parseia limpo em todos os configs.
- Contagem E2E ≤ 100 (de 187) sem perda de cobertura sem mapa.
- Worktree limpo pós-release; nenhum artefato rastreado sobrescrito por run.

## 4. Baseline

v0.10.0 CLOSURE: aero 6,8 min · space-war 6,5 min · corrida 2,8 min (CI); 187 casos E2E;
24 suítes Node fora do CI.

# PLAN — v0.11.0

**Status:** Aprovado

Execução em write-sets disjuntos, 4 agentes de jogo em paralelo + coordenador.
Fonte operacional: anexo demotion-map (workspace
`.dadaia/reports/tauan-games/qa-engineer/2026-08-12T160030Z-agent-test-lifecycle-doctrine-annex-demotion-map.html`)
— tabelas por jogo com classe (BI/AC/DN/SC), cobertura Node existente (arquivo:linha) e
esboço dos testes novos.

| Lote | Write set | Conteúdo |
|---|---|---|
| T-01 aero | `src/web-games/tests/aero-fighters/**` | deletar SC (6) + E2E AC (38, resíduos onde indicado), fundir duplicatas, criar test-aero-map-constants.mjs + extensões sim/sortie/taxi/visual, AC-18→frame-counter |
| T-02 space-war | `src/web-games/tests/space-war/**` | deletar SC (1) + E2E AC (18), criar test-sw-gravity-unit/journey-unit + extensões physics/mode, FPS≥4→frame-counter, manter three-states-flow como SENTINEL |
| T-03 corrida | `src/web-games/tests/corrida/**` + `src/web-games/speed-run/src/signage.js` (extração pura measureClearance) | criar test-corrida-unit/signage/physics.mjs, deletar SC + rebaixar DN desbloqueados, deletar probes órfãos ws3-ws6 |
| T-04 jb+demolition | `src/web-games/tests/james-bond/**`, `src/web-games/tests/demolition-ball/**` | estender unit.mjs (kids cone, floor-audit ×6 substituindo E2E 900s, missions content, spawner, watchtower; rope demolition), slim smoke.spec, outputDir fix, deletar FPS morto |
| T-05 coordenador | `src/web-games/package.json`, `.github/workflows/ci.yml`, `.gitignore`, PNGs rastreados, specs/releases | dedupe scripts, novos scripts node, job-gate no CI, remover dup demolition, git rm PNGs, ACTIVE.md |
| T-06 coordenador | fora do repo | limpeza de disco de runs anteriores (checando server registry) |

Regras: nenhum agente roda suíte Playwright completa (validação por node suites +
`playwright test --list`); casos ⚠ intocados; commits convencionais por lote com stage
explícito; sem push nos lotes (push só no fim, via develop, com verdict de segurança).

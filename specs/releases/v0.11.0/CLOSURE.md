# CLOSURE — v0.11.0

**Status:** Aprovado
**Closed:** 2026-08-12
**Branch:** feature/0.11.0 (base origin/develop c48bfa5)

## Resultado

| Métrica | Antes | Depois |
|---|---|---|
| Casos E2E (total) | 187 | **93** (−50,3%) |
| aero-fighters | 84 | 30 |
| space-war | 57 | 31 |
| corrida | 23 | 14 |
| james-bond | 14 | 12 |
| demolition-ball | 9 | 6 |
| Suítes Node no CI | 2/26 | **26/26** (job `node-gate`, gate da matriz) |
| Suítes Node corrida | 0 | 3 (13 casos) |
| npm scripts duplicados | 10 | 0 |
| PNGs rastreados sobrescritos por runs | 18 | 0 |
| Probes órfãos | 13 | 0 |
| Execução dupla demolition-ball no CI | sim | não |

## Evidência (tripla por lote)

- **T-01 aero (805dbd1):** 84→30; 7 specs deletados; node 24/24 unit + 188 asserções/0 falhas
  na cadeia sim de 18 scripts; `--list` 30 tests. Handoff `2026-08-12T195942Z-…T-01…`.
- **T-02 space-war (0887bef):** 57→31; launch.spec.js deletado (verbatim-coberto);
  2 suítes novas; node 37 subtests verdes; `--list` 31. Handoff `…T-02…`.
- **T-03 corrida (0f71ed9):** 23→14; 3 suítes Node inéditas (13/13); extração pura
  `measureClearance` com cross-check pré/pós idêntico nas 4 pistas; 10 probes deletados
  (grep-verificado). Handoff `…T-03…`.
- **T-04 jb+db (6fe169d):** 14→12 e 9→6; E2E 900 s substituído por floor-audit físico
  ×6 missões em unit.mjs; outputDir corrigido (escapava 6 níveis do repo);
  **4 claims do mapa refutados por inspeção → 4 testes MANTIDOS** com nota in-file
  (jb :617 LOS, jb :816 hang-glider lifecycle, db :38 throttle-from-rest, db :89
  collide-glue). Handoff `…T-04…`.
- **T-05/T-06 (17005aa):** node-gate no ci.yml (needs: node-gate na matriz); dedupe;
  gitignore por-jogo; 17 PNGs des-rastreados; disco: 52 MB de artefatos + 7 servidores
  HTTP órfãos (11–30 h, fora do registry) + pids mortos removidos.
- **T-07 integração:** `npm run test:unit` (gate completo, todos os jogos) exit 0;
  `--list` verde nos 3 configs (75 + 12 + 6 = 93).

## Rebaixamento — mapa E2E→substituto (S-15)

Mapa integral, caso a caso, no anexo do estudo (workspace):
`.dadaia/reports/tauan-games/qa-engineer/2026-08-12T160030Z-agent-test-lifecycle-doctrine-annex-demotion-map.html`.
Correções de mapa apuradas em execução: MAP_KEYS tem 5 chaves (não 4); maps/index.js e
INHAUMA_CITIES/LANDMARKS não importam em Node (poisoned via scene.js) — cobertos por
imports alcançáveis + regex de fonte; 4 claims ALREADY-COVERED de jb/db refutados
(testes mantidos). Doutrina aplicada: statements S-02/S-12/S-15/S-16/S-18/S-23/S-24
do report v2 (`2026-08-12T175304Z-test-stewardship-statements-v2.html`).

## Fora do escopo (permanece no backlog test-value-lifecycle-v1)

- Fase 2: refactor `initScene()` lazy (aero+space-war scene.js, corrida main.js
  nitro/chase) — destrava as 19 demoções ⚠ restantes.
- Fase 3: skill dadaia-test-stewardship + incremento DADAIA.md + piloto Stryker
  (aguardando aprovação dos 8 parâmetros do §10 do report v2).
- Caches ms-playwright (1,26 GB, 2 gerações) — presos por playwright-mcp de outras
  sessões vivas; decisão do operador.

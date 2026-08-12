# SPEC — Release: v0.10.0

**Status:** Aprovado
**Release ID:** v0.10.0
**Owner:** product-engineer
**Opened:** 2026-08-11
**Consumes:** test-runtime-efficiency-v1, test-artifact-hygiene-v1

---

## 1. Problem and context

A suíte Playwright de `src/web-games/` é o único portão automático de qualidade dos
jogos web — e hoje ela custa caro em duas dimensões, ambas medidas (não estimadas):

**Tempo.** O CI roda 168 testes estritamente em série (`workers: 1`) num runner de
4 vCPU. A última execução de referência levou 20,4 min; a média de sucesso dos
últimos 20 runs é 11,8 min; o pior caso foi 28,2 min, dos quais ≈19 min foram fila
de runner (o workflow não tem `concurrency` nem `paths`, então commit de docs ou de
Godot dispara a suíte inteira e pushes empilham). Dentro da suíte há 216,6 s de
`waitForTimeout` fixo em 191 call sites — piso serial puro, que não encolhe com
paralelismo. O config raiz (`testDir: '.'`, sem `testIgnore`) engole diretórios que
têm config dedicado: james-bond (orçamentos `test.setTimeout` de 600–900 s por
teste) e demolition-ball (que perde as flags GL do seu próprio config). E o WebGL
roda em SwiftShader em todos os jogos exceto demolition-ball: 1,76–2,65 fps medidos
contra a asserção `expect(fps).toBeGreaterThanOrEqual(55)` de
`tests/trex/smoke.spec.js:76-94`.

**Lixo.** A suíte escreve artefatos sem consumidor e sem retenção.
`src/web-games/tests/screenshots/` cresceu de 5,5 MB para 75 MB em um único dia de
execuções; `tests/playwright-report/` (516 KB) é regenerado a cada run e nunca
removido; 6 arquivos `.server-*.pid` órfãos de runs crashados sobraram na árvore — e
um pid órfão com a porta ocupada faz `globalSetup.js:35` **abortar** runs futuros
(`Port ${PORT} is already in use`), ou seja, o lixo não é só desperdício, quebra
execução. Pior: dois pid files (`.server-8097.pid`, `.server-8399.pid`) foram
**commitados** — `.gitignore:21` só passou a cobrir o padrão depois, e `.gitignore`
já rastreado não desfaz. O operador classificou a situação como inadmissível.

### Conjunto escolhido (picked set)

| Item | Origem | Disposição nesta release |
|---|---|---|
| `specs/backlog/test-runtime-efficiency-v1.md` | backlog (candidate) | **Consumido integralmente** — 6 alvos viram R-01…R-05, R-08 |
| `specs/backlog/test-artifact-hygiene-v1.md` | backlog (candidate) | **Consumido integralmente** — 4 alvos viram R-06 |

**Nenhum bug entra nesta release.** Doutrina do operador e lei do workspace: bug
nunca é material de release — registra, reproduz na causa raiz, teste RED, fix,
GREEN, evento `resolved`, na mesma sessão. Se qualquer tarefa desta release
descobrir um bug, ele é resolvido pela via de hotfix e apenas referenciado aqui.

### Base de evidência

- Report: `.dadaia/reports/tauan-games/qa-engineer/2026-08-11T180616Z-test-runtime-efficiency-both-repos.html`
- Handoff: `.dadaia/handoff/tauan-games/2026-08-11T180616Z-qa-engineer-test-runtime-efficiency-both-repos.handoff.json`
  (`content_hash` 2a6e3877af50348d71be34dda546f6534ef32466fea8e550a436d6c2656b2067)
- Grill do operador, 2026-08-11 (decisões registradas em §5).

### Baseline — o "antes" de toda aceitação

Toda medição "depois" desta release compara contra esta tabela. Nenhum número novo
substitui um destes sem estar registrado no CLOSURE.

| Métrica | Baseline | Fonte |
|---|---|---|
| CI run de referência | **29710660997** | report |
| Testes nesse run | 168 | report |
| Wall desse run | 20,4 min | report |
| `workers` | 1 | `src/web-games/tests/playwright.config.js:8` |
| Média de sucesso (últimos 20 runs) | 11,8 min | report |
| Pior caso | 28,2 min (≈19 min de fila de runner) | report |
| `waitForTimeout` fixo | 216,6 s em 191 call sites | report |
| FPS sob SwiftShader | 1,76–2,65 (requisito do teste: ≥ 55) | `tests/trex/smoke.spec.js:76-94` |
| `tests/screenshots/` | 5,5 MB → 75 MB em um dia | report |
| `tests/playwright-report/` | 516 KB por run, nunca removido | report |
| Pid files órfãos | 6 `.server-*.pid` | report |
| Pid files **commitados** | `.server-8097.pid`, `.server-8399.pid` | git (deleted-in-worktree) |

### Fatos confirmados na árvore em 2026-08-11 (leitura do PE)

- `tests/playwright.config.js`: `testDir: '.'`, `outputDir: './screenshots'`,
  `timeout: 30000`, `retries: 1`, `workers: 1`, `trace/video: 'on-first-retry'`.
- `tests/demolition-ball-opus-5/playwright.config.js:25-33`: as 5 flags GL/ANGLE
  (`--use-gl=angle`, `--use-angle=gl`, `--ignore-gpu-blocklist`,
  `--enable-gpu-rasterization`, `--enable-unsafe-swiftshader`).
- `tests/james-bond/playwright.config.js`: config dedicado **sem**
  `globalSetup`/`globalTeardown` e com `baseURL` em `TEST_PORT || 3658` — hoje ele
  **não é auto-suficiente em CI** (depende de um servidor já de pé).
- `tests/james-bond/smoke.spec.js`: 13 testes, com `test.setTimeout(600000)` e
  `(900000)` — `test.setTimeout` prevalece sobre o `timeout: 30000` do config raiz,
  então esses orçamentos valem também quando o config raiz engole o diretório.
- `.github/workflows/ci.yml`: sem `paths:`, sem `concurrency:`; `godot-ci.yml:11-25`
  já tem os dois — é o padrão interno a espelhar.
- `.gitignore` raiz: `tests/screenshots/` (linhas 6 e 20) está **ancorado na raiz**
  do repo e portanto **não cobre** `src/web-games/tests/screenshots/`;
  `playwright-report/`, `test-results/` e `.server-*.pid` (sem barra) cobrem
  qualquer profundidade.
- Padrão de polling já existente e a ser replicado:
  `tests/aero-fighters/smoke.spec.js:36-43` (`waitForFunction` sobre estado real do
  jogo, substituindo `waitForTimeout(4000)`).
- Escritas incondicionais de screenshot em caminho feliz dentro de specs:
  `tests/demolition-ball-opus-5/e2e.spec.js:127` (`screenshots/…png`, caminho
  relativo ao cwd) e `tests/aero-fighters/sortie.spec.js:147`.

---

## 2. Objective

Cortar o custo de execução da suíte web pela metade — step "Run tests" do CI
**≤ 10 min** só com config, **≤ 9 min** com as conversões de teste — e acabar com a
classe de lixo de execução (artefato sem consumidor, pid órfão, pid commitado),
**sem deletar um único teste e sem baixar a barra de qualidade**.

---

## 3. Scope

Cada cluster declara a aceitação **contra o baseline de §1**. Medição "antes" =
tabela do baseline; medição "depois" = run equivalente registrado na tarefa.

### R-01 — Experimento A/B GL/ANGLE no CI (P0, primeira tarefa)

O ganho local das flags GL é grande e comprovado (GPU real); o ganho **no CI** é
desconhecido (runner sem GPU) e por isso **não pode ser contado antes de medido**.
Dois runs de CI do **mesmo subconjunto** (specs de space-war, via
`npm run test:space-war`), um com e um sem as flags, mesma sha, mesma contagem de
testes reportada.

- **Aceitação:** delta de tempo do subconjunto (A menos B) registrado em segundos e
  em %, com a contagem de testes idêntica nos dois runs e zero teste novo/removido;
  resultado escrito nas notas da release e **decide o parâmetro de R-05**.
- **Mecanismo:** flags GL entram no config raiz atrás de env (`PW_GL_ARGS`,
  default desligado nesta tarefa) + `workflow_dispatch` no `ci.yml` para disparar
  os dois runs; nenhuma mudança de default aqui.

### R-02 — Paralelismo (`workers` 1 → 2, avaliar 3) (P0)

- **Aceitação:** step "Run tests" do CI medido antes (run 29710660997) e depois, com
  `workers: 2`; se a suíte ficar verde e o ganho justificar, medir também
  `workers: 3` e manter o melhor. Requisito duro: **mesmo conjunto de testes,
  zero flake novo** — dois runs verdes consecutivos com o valor escolhido.
  Meta parcial deste cluster: ≥ 30% de redução do step contra os 20,4 min.

### R-03 — `testIgnore` dos diretórios com config dedicado (P0)

`testDir: '.'` engole `james-bond/` (13 testes com orçamento de 600–900 s) e
`demolition-ball-opus-5/` (sem as flags GL de que ele precisa).

- **Aceitação:** o run raiz deixa de incluir esses diretórios **e a cobertura não
  se perde**: cada config dedicado passa a rodar num job de CI próprio, filtrado por
  `paths` do jogo correspondente (padrão `godot-ci.yml`), em paralelo com o job
  principal. Para isso, `tests/james-bond/playwright.config.js` ganha
  `globalSetup`/`globalTeardown` parametrizados por `TEST_PORT` (hoje não é
  auto-suficiente). Prova: um push que toca `src/web-games/james-bond/**` dispara e
  passa o job dedicado; um push que não toca, não dispara.
- **Nota de resolução (PE):** o backlog pedia apenas `testIgnore`. `testIgnore` puro
  seria perda de cobertura — esta SPEC exige a contrapartida do job dedicado.

### R-04 — `paths` filter + `concurrency` no `ci.yml` (P0)

- **Aceitação:** `ci.yml` com `paths:` cobrindo `src/web-games/**` e o próprio
  workflow, e `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`,
  espelhando `godot-ci.yml:11-25`. Prova: (a) um commit que só toca `specs/` ou
  `src/godot/**` **não** dispara o job de Playwright; (b) dois pushes seguidos no
  mesmo ref cancelam o run anterior. Alvo: eliminar a componente de fila do pior
  caso de 28,2 min (≈19 min).

### R-05 — Posição definitiva das flags GL/ANGLE (P1, depende de R-01)

- **Aceitação:** flags **sempre ativas no config raiz para execução local**; no CI,
  ligadas se e somente se R-01 mediu ganho — a decisão e o número que a sustenta
  ficam registrados no TASKS/CLOSURE. Se o A/B der neutro ou negativo, o default de
  CI fica desligado e isso é registrado como resultado, não como falha.

### R-06 — Higiene de artefatos (P0)

1. `tests/globalSetup.js`: política **run-start clean** — remove artefatos da
   execução anterior (`screenshots/`, `playwright-report/`, `test-results/`, pid
   files mortos) antes de subir o servidor; pid file cujo processo não existe mais
   é removido em vez de abortar o run.
2. `tests/globalTeardown.js`: remoção do `.server-*.pid` garantida também em morte
   anormal (`try/finally` + handlers de `SIGINT`/`SIGTERM`/`exit`), eliminando a
   classe do pid órfão.
3. Specs: nenhum artefato de caminho feliz sem consumidor definido — alvos
   confirmados `demolition-ball-opus-5/e2e.spec.js:127` e
   `aero-fighters/sortie.spec.js:147`. Consumidor válido = upload de CI em falha ou
   inspeção local documentada; caso contrário, não escreve.
4. `.gitignore`: cobrir de fato os diretórios gerados sob `src/web-games/`
   (o padrão ancorado `tests/screenshots/` não cobre) e **`git rm --cached`** dos
   pid files commitados (`.server-8097.pid`, `.server-8399.pid`).
- **Aceitação:** depois de um run completo, `git status` limpo; nenhum artefato do
  run anterior sobrevive ao início do run seguinte (`tests/screenshots/` medido
  antes/depois, contra os 75 MB do baseline); **zero pid órfão após `kill -9`** de um
  run em andamento; zero pid file rastreado em git.

### R-07 — Conversão `waitForTimeout` → polling (P1)

216,6 s fixos em 191 call sites, convertidos por lotes (um lote por diretório de
jogo), no padrão de `tests/aero-fighters/smoke.spec.js:36-43`.

- **Aceitação:** por lote — soma de `waitForTimeout` restante no diretório, wall do
  lote antes/depois, **nenhum teste removido, renomeado ou enfraquecido** (mesma
  asserção, mesma contagem), suíte verde. Total: redução ≥ 60% dos 216,6 s e ≥ 10%
  do wall da suíte atribuíveis a este cluster.

### R-08 — Política de retry/timeout (P1)

`retries: 1` global + `timeout: 30000` (e `test.setTimeout` de até 900 s nos
dedicados): um teste que estoura paga o dobro, com trace e vídeo.

- **Aceitação:** política revista e justificada por escrito (o que retenta, quantas
  vezes, com qual timeout e quais artefatos), com o custo de pior caso recalculado
  contra os 28,2 min do baseline; nenhum teste perde retry sem evidência de que ele
  não é flaky.

### R-09 — Fechamento e prova

- **Aceitação:** um run de CI final na branch da release com o step "Run tests"
  **≤ 10 min** (obrigatório) e **≤ 9 min** (stretch), suíte verde, contagem de
  testes ≥ baseline no conjunto raiz + dedicados somados, `dadaia specs doctor`
  limpo e memória sincronizada.

---

## 4. Out of scope

- **Deletar, pular (`test.skip`) ou enfraquecer qualquer teste** — guardrail do
  operador, vale para toda a release.
- Testes/CI do repositório `dadaia-workspace` (o report cobre os dois repos; os
  achados de lá viram backlog naquele contexto, não tarefa daqui).
- Suítes Godot (`godot-ci.yml`, gdUnit4, sondas) — só servem de padrão a espelhar.
- Tuning de performance dos jogos em si (o 1,76 fps do SwiftShader é ambiente de
  teste, não regressão de jogo).
- Reconciliar o catálogo de memória com a árvore (ver risco em §5) — vai para o
  backlog, não é entrega desta release.
- Migração de `space-war` para `src/web-games/` (pendência antiga, independente).

---

## 5. Dependencies and risks

### Decisões do operador (grill 2026-08-11)

| # | Decisão |
|---|---|
| D1 | Escopo completo em **uma** release — as duas entradas de backlog consumidas juntas. |
| D2 | Sequenciamento: tarefas **config-only primeiro**, depois as que tocam testes. |
| D3 | O A/B GL/ANGLE no CI é a **primeira** tarefa e decide o parâmetro de R-05. |
| D4 | Alvo: step de testes do CI **≤ 10 min**; stretch **≤ 9 min**. |
| D5 | Nenhum bug entra na release (doutrina hotfix). |
| D6 | Guardrail duro: nenhum teste deletado, qualidade preservada. |

### Dependências

- **v0.8.0 está em `IMPLEMENTATION`** (`specs/releases/ACTIVE.md`) com T-05/T-06
  abertos tocando `tests/corrida/**` (nitro, placas). Esta release **não pode**
  começar antes de o operador repontar `ACTIVE.md`; e o lote `corrida` de R-07 é o
  **último** a ser convertido, para não colidir com edições vivas de v0.8.0.
- R-05 depende de R-01. R-02/R-03/R-05/R-08 tocam o **mesmo arquivo**
  (`tests/playwright.config.js`) — estritamente sequenciais, um `[-]` por vez.
- R-09 depende de tudo.

### Riscos

| Risco | Mitigação |
|---|---|
| `workers > 1` expõe flake latente (jogos WebGL competindo por CPU no runner) | dois runs verdes consecutivos como critério; se flake aparecer, tratar como bug (hotfix) e não subir workers |
| Servidor estático único compartilhado por workers paralelos | é `python3 -m http.server` servindo arquivos estáticos; se saturar, medir e considerar servidor por worker antes de recuar o paralelismo |
| A/B GL no CI dá ganho nulo (runner sem GPU) | resultado nulo é resultado válido: flags ficam local-only, registrado em R-05 |
| `testIgnore` sem job dedicado = perda silenciosa de cobertura | R-03 exige o job dedicado + `globalSetup` no config do james-bond como parte da mesma tarefa |
| `paths` filter esconde quebra causada por mudança fora de `src/web-games/**` | incluir no filtro o próprio workflow e o `package-lock.json`; documentar o que ficou de fora |
| Run-start clean apaga artefato que alguém ainda ia inspecionar | limpar apenas no **início** do run (nunca no fim) e imprimir o que foi removido |
| Conversão de 191 sleeps introduz espera insuficiente (flake) | lotes pequenos por diretório, polling sobre **estado real** do jogo com timeout generoso (padrão de `smoke.spec.js:36`), suíte verde por lote |
| Medição local contaminada por host saturado (report: load 27–55, duas sessões concorrentes) | **toda** medição de aceitação é de CI (runner dedicado); medida local só como indício |
| Divergência memória × árvore (ver abaixo) confunde o "conjunto de testes esperado" | T-01 registra o manifesto de specs do run 29710660997 como verdade do baseline |

### Divergência memória × árvore (achado do PE, roteado ao backlog)

`specs/memory/product/games-catalog.md` (v0.6.0, 2026-08-10) lista **4** jogos web e
afirma que `memoria-bichos`, `tauan-trex` e `demolition-ball-fable-5` foram
deletados. A árvore tem **9** diretórios de jogo web (incluindo `memoria-bichos/`,
`tauan-trex/`, `far-west/`, `bang-bang/`, `demolition-ball-opus-5/`) e a suíte raiz
roda specs de todos eles — inclusive `tests/trex/smoke.spec.js`, cujo AC-8 exige
≥ 55 fps. Ou seja: parte do custo de 20,4 min é gasto em jogos que a memória diz
não existirem. Esta release **não resolve** isso (guardrail D6 proíbe remover
testes), mas o registra: item de backlog para o `project-manager`, e T-01 documenta,
a partir do manifesto do run de CI, exatamente quais specs compõem os 168 testes.

---

## 6. Memory files affected at closure

| Arquivo | Mudança prevista |
|---|---|
| `specs/memory/quality-assurance.md` | MACRO 1 — QA dos web-games: paralelismo da suíte, `testIgnore` + jobs dedicados por config, política run-start clean de artefatos, regra "artefato sem consumidor não se escreve", padrão polling no lugar de sleep fixo, política de retry/timeout |
| `specs/memory/tech-stack.md` | Testing stack: valor de `workers`, flags GL/ANGLE (local e/ou CI) e os jobs de CI da suíte web |
| `specs/memory/architecture.md` | Só se a topologia de jobs de CI da suíte web estiver descrita lá (verificar no CLOSURE; se não estiver, registrar "sem mudança") |

---

## 7. Acceptance criteria (resumo executável)

1. Step "Run tests" do CI **≤ 10 min** (obrigatório) / **≤ 9 min** (stretch),
   comparado ao run 29710660997 (20,4 min, 168 testes, `workers: 1`).
2. Zero teste deletado, pulado ou enfraquecido; contagem de testes (raiz +
   dedicados) ≥ 168.
3. Commit que não toca `src/web-games/**` não dispara a suíte web; pushes
   consecutivos no mesmo ref cancelam o anterior.
4. Após um run completo: `git status` limpo, `tests/screenshots/` sem herança do run
   anterior, zero pid órfão após `kill -9`, zero pid file rastreado em git.
5. `waitForTimeout` fixo reduzido em ≥ 60% dos 216,6 s.
6. Delta do A/B GL/ANGLE registrado em número, com a decisão de R-05 justificada.
7. `dadaia specs doctor` limpo e memória sincronizada no CLOSURE.

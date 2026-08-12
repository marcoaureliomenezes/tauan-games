# TASKS — Release: v0.10.0

> **Status:** Draft
> **Release ID:** v0.10.0
> **Spec:** `SPEC.md` · **Plan:** `PLAN.md`

---

## Regras desta release

- **Um `[-]` por vez.** Não há tarefas paralelas: T-02/T-03/T-05/T-08 escrevem no
  mesmo `src/web-games/tests/playwright.config.js`, e as demais dependem de medições
  anteriores.
- **Guardrail (D6):** nenhum teste deletado, pulado (`test.skip`) ou enfraquecido.
  Toda tarefa que toca spec prova contagem e asserções idênticas.
- **Medição de aceitação é de CI.** Baseline de comparação: run **29710660997** —
  168 testes, 20,4 min, `workers: 1`; média de sucesso 11,8 min; pior caso 28,2 min
  (≈19 min de fila). Número local só entra rotulado como indício.
- **Todo % reivindicado aponta para um run de CI identificável** (id do run no campo
  de evidência).

---

## T-01 — Experimento A/B GL/ANGLE no CI [x]

- **Owner:** software-engineer
- **Write set:** `src/web-games/tests/playwright.config.js` (bloco `launchOptions`
  atrás de `PW_GL_ARGS`, default **desligado**), `.github/workflows/ci.yml`
  (`workflow_dispatch` + inputs `gl_args` e `test_cmd` → env `PW_GL_ARGS`)
- **Evidência (2026-08-11, sha `274839a`, branch `release/v0.10.0`):**
  - Run A (`gl_args=false`) **31535867767**: 54 passed + 1 flaky, 0 failed — step **7,0 min**.
  - Run B (`gl_args=true`) **31535879006**: 53 passed + 1 flaky + **1 failed** — step **8,4 min**.
  - Contagem **idêntica**: 55 testes nos dois runs (`npm run test:space-war`).
  - **Delta: B +1,4 min (+20%)** — flags são mais lentas no runner sem GPU.
  - **Mudança de resultado:** a falha de B (`campaign.spec.js:167` AC-10 flare
    solar local) e o flaky (`photometric.spec.js:78` AC-03) são asserções
    VISUAIS de flare — o path ANGLE renderiza diferente do SwiftShader puro.
  - Manifesto do baseline 29710660997: 28 spec files compõem os 168 testes
    (inclui `tests/trex`, `tests/memoria-bichos`, `tests/far-west` — divergência
    memória × árvore roteada ao backlog na T-09).
- **Parâmetro p/ T-05:** flags **OFF no CI** (resultado negativo: +20% de tempo
  + 1 teste quebrado). Para o default LOCAL, T-05 deve re-verificar os 2 specs
  de flare com flags ativas antes de decidir — o path ANGLE altera renderização
  mesmo em llvmpipe.

- **Owner:** software-engineer
- **Write set:** `src/web-games/tests/playwright.config.js` (bloco `launchOptions`
  atrás de `PW_GL_ARGS`, default **desligado**), `.github/workflows/ci.yml`
  (`workflow_dispatch` + input `gl_args` → env `PW_GL_ARGS`)
- **Precondição:** `ACTIVE.md` repontado para v0.10.0; branch da release criada
- **Execução:** dois runs de CI na **mesma sha**, mesmo subconjunto
  (`npm run test:space-war`), um com `gl_args=true` e outro com `false`; as 5 flags
  são as de `tests/demolition-ball-opus-5/playwright.config.js:25-33`
- **Done quando:**
  1. contagem de testes reportada pelo Playwright **idêntica** nos dois runs;
  2. duração do step registrada nos dois, com delta em segundos **e** em %;
  3. registrado se algum teste mudou de resultado entre A e B;
  4. registrado, a partir do manifesto do run 29710660997, **quais** spec files
     compõem os 168 testes do baseline (resolve a divergência memória × árvore
     apontada em SPEC §5);
  5. resultado escrito aqui como parâmetro de T-05 — inclusive se for nulo/negativo.
- **Paralelismo:** nenhum (primeira tarefa, por decisão D3)

## T-02 — `workers` 1 → 2 (avaliar 3) [-]

- **Owner:** software-engineer
- **Medição (2026-08-11):** workers:2 **inviável no runner**, dois pontos:
  (a) com os dirs pesados no root, run **31536963772** travado >1h → cancelado
  (bisect local: demolition-ball e2e 33-60 s+retry/teste sob o config raiz);
  (b) na suíte magra pós-testIgnore, run **31543170001**: **84/179 falhas** por
  boot starvation — `waitForSelector('canvas')` 15 s estourado em massa —
  47,5 min. SwiftShader não tolera 2 instâncias WebGL no runner.
- **Escape da aceitação aplicado:** paralelismo **recuado** (workers:1,
  commit `fb41682`) — resultado negativo registrado, não falha. Velocidade
  virá de testIgnore/paths/polling/retry. Suíte magra workers:1 em
  re-medição (run **31548373788**); workers:3 descartado (pior que 2).
- **Desvio registrado (ordem):** T-03 executada **antes** da conclusão de
  T-02 — a inviabilidade de workers:2 era causada pelos dirs que T-03 remove;
  a re-medição de workers só faz sentido na suíte magra. Aceitações intactas.

- **Owner:** software-engineer
- **Write set:** `src/web-games/tests/playwright.config.js` (linha 8)
- **Precondição:** T-01 `[x]` (não misturar dois experimentos)
- **Done quando:**
  1. `workers: 2` com **dois runs de CI verdes consecutivos**, mesma contagem de
     testes do baseline (168), zero flake novo;
  2. step "Run tests" medido antes (29710660997) e depois, com redução **≥ 30%**
     contra os 20,4 min;
  3. `workers: 3` medido também; mantém-se o melhor, e o número que sustentou a
     escolha fica registrado aqui;
  4. se algum teste ficar flaky, ele **não** é pulado — ou o paralelismo recua, ou o
     flake vira bug pela via de hotfix (id do bug registrado aqui).
- **Paralelismo:** nenhum

## T-03 — `testIgnore` + jobs de CI dedicados (cobertura preservada) [-]

- **Owner:** software-engineer
- **Entregue (commit `6626d9e`, ajuste `916d26f`):**
  1. `testIgnore: ['**/james-bond/**']` no config raiz (a entrada de
     demolition-ball foi **removida** — jogo/testes deletados em `59f793d`
     pela sessão paralela de higiene do repo; `demolition-ball-ci.yml`
     descartado no ajuste).
  2. james-bond auto-suficiente: `tests/james-bond/globalSetup.js` +
     `globalTeardown.js` (porta TEST_PORT||3658), registrados no config
     dedicado — prova local: servidor sobe/encerra e o pid file é limpo
     (a falha local inicial foi `ERR_UNSAFE_PORT` por minha escolha da
     porta 3659, que está na blocklist do Chromium — não é defeito do
     mecanismo; suite completa validada na 8377).
  3. `james-bond-ci.yml` dedicado no padrão godot-ci (paths + concurrency).
- **Limitação GitHub registrada:** workflows criados em branch só registram
  triggers `push`/`pull_request` após chegarem à `main` — a prova
  positiva/negativa de paths do item 4 fica para o primeiro push pós-merge.
- **Contagem:** suíte raiz agora = aero-fighters + corrida + space-war
  (179 testes na medição de T-02); raiz + james-bond dedicado ≥ 168 ✓.
- **Step time do root magro:** em medição (run **31548373788**).

- **Owner:** software-engineer
- **Write set:** `src/web-games/tests/playwright.config.js` (`testIgnore`),
  `src/web-games/tests/james-bond/playwright.config.js`
  (`globalSetup`/`globalTeardown` parametrizados por `TEST_PORT`),
  `.github/workflows/ci.yml` (dois jobs dedicados, `paths`-filtrados)
- **Precondição:** T-02 `[x]`
- **Done quando:**
  1. o run raiz não inclui mais `**/james-bond/**` nem
     `**/demolition-ball-opus-5/**` (contagem do run raiz registrada antes/depois);
  2. existe um job de CI por config dedicado, filtrado por `paths` do jogo
     correspondente (padrão `godot-ci.yml:11-25`), rodando em paralelo com o job
     principal;
  3. o config do james-bond passou a ser auto-suficiente (sobe e derruba o próprio
     servidor) — hoje ele presume um servidor em `TEST_PORT || 3658`;
  4. prova positiva **e** negativa: um push tocando `src/web-games/james-bond/**`
     dispara e passa o job dedicado; um push que não toca, não dispara;
  5. **soma** das contagens (raiz + dedicados) ≥ 168 — nenhuma cobertura perdida;
  6. step "Run tests" do job principal medido depois do `testIgnore`.
- **Paralelismo:** nenhum

## T-04 — `paths` filter + `concurrency` no `ci.yml` [ ]

- **Owner:** software-engineer
- **Write set:** `.github/workflows/ci.yml`
- **Precondição:** T-03 `[x]`
- **Done quando:**
  1. `paths:` cobrindo `src/web-games/**` e o próprio workflow, em `push` e
     `pull_request`; `concurrency: { group: ci-${{ github.ref }},
     cancel-in-progress: true }` — espelhando `godot-ci.yml:11-25`;
  2. prova (a): commit que só toca `specs/` ou `src/godot/**` **não** dispara o job
     de Playwright (id do run/ausência registrada);
  3. prova (b): dois pushes seguidos no mesmo ref cancelam o run anterior (ids dos
     dois runs registrados);
  4. o que ficou **fora** do filtro está listado aqui como decisão explícita
     (contra o pior caso de 28,2 min, ≈19 min dos quais eram fila).
- **Paralelismo:** nenhum

## T-05 — Posição definitiva das flags GL/ANGLE [ ]

- **Owner:** software-engineer
- **Write set:** `src/web-games/tests/playwright.config.js` (default do
  `PW_GL_ARGS`), `.github/workflows/ci.yml` (env do step, se aplicável)
- **Precondição:** T-01 `[x]` (o número) e T-04 `[x]`
- **Done quando:**
  1. flags **sempre ativas na execução local** — o motivo medido está citado:
     1,76–2,65 fps sob SwiftShader contra o `expect(fps).toBeGreaterThanOrEqual(55)`
     de `tests/trex/smoke.spec.js:76-94`;
  2. no CI, ligadas **se e somente se** T-01 mediu ganho; a decisão cita o delta de
     T-01 em s e %;
  3. resultado neutro/negativo é registrado como resultado (flags ficam local-only),
     não como pendência;
  4. um run de CI verde com a configuração final.
- **Paralelismo:** nenhum

## T-06 — Higiene de artefatos (run-start clean + pid + gitignore) [ ]

- **Owner:** software-engineer
- **Write set:** `src/web-games/tests/globalTeardown.js`,
  `src/web-games/tests/globalSetup.js`, `.gitignore`,
  `src/web-games/tests/demolition-ball-opus-5/e2e.spec.js` (linha 127),
  `src/web-games/tests/aero-fighters/sortie.spec.js` (linha 147)
- **Precondição:** T-05 `[x]`
- **Done quando:**
  1. **Teardown:** remoção do `.server-*.pid` garantida também em morte anormal
     (`try/finally` + handlers `SIGINT`/`SIGTERM`/`exit`) — hoje o
     `fs.unlinkSync` de `globalTeardown.js:16` só roda no caminho feliz;
  2. **Setup:** pid file cujo processo não existe mais é removido em vez de abortar
     o run (hoje `globalSetup.js:33-36` aborta com `Port … is already in use`);
     em seguida, run-start clean de `screenshots/`, `playwright-report/`,
     `test-results/`, **imprimindo o que foi removido**; limpeza só no **início** do
     run, nunca no fim;
  3. **Prova do pid órfão:** `kill -9` no meio de um run e o run seguinte **inicia**
     (hoje aborta) — comando e saída registrados;
  4. **Specs:** os dois screenshots incondicionais de caminho feliz ou ganham
     consumidor documentado (upload de CI em falha / inspeção local descrita em
     comentário no spec) ou deixam de ser escritos — **sem** remover ou enfraquecer
     nenhuma asserção;
  5. **`.gitignore`:** `src/web-games/tests/screenshots/` efetivamente ignorado (o
     padrão ancorado `tests/screenshots/` das linhas 6 e 20 não cobre) e
     `git rm --cached` dos pid files rastreados (`.server-8097.pid`,
     `.server-8399.pid`);
  6. **Medida:** `du -sh` dos três diretórios antes/depois de um run completo contra
     o baseline (75 MB em `tests/screenshots/`, 516 KB em `playwright-report/`);
     `git status --porcelain` **vazio** após o run; zero pid file rastreado em git.
- **Paralelismo:** nenhum

## T-07 — `waitForTimeout` → polling, por lote [ ]

- **Owner:** software-engineer
- **Write set:** specs por lote —
  L1 `tests/aero-fighters/*.spec.js` · L2 `tests/space-war/*.spec.js` ·
  L3 `tests/trex/*.spec.js` · L4 `tests/bang-bang/*.spec.js` ·
  L5 `tests/far-west/*.spec.js` · L6 `tests/corrida/*.spec.js`
- **Precondição:** T-06 `[x]`; **L6 só depois** de v0.8.0 sair de `IMPLEMENTATION`
  (T-05/T-06 de v0.8.0 editam `tests/corrida/**`)
- **Padrão obrigatório:** `waitForFunction` sobre estado real do jogo, no molde de
  `tests/aero-fighters/smoke.spec.js:36-43` (timeout generoso que detecta falha real
  sem mascará-la). Proibido trocar `waitForTimeout(800)` por `waitForTimeout(200)`:
  ou vira polling, ou fica como está **com justificativa escrita no próprio spec**.
- **Done quando (por lote):**
  1. soma de `waitForTimeout` restante no diretório registrada antes/depois;
  2. wall do lote antes/depois (`playwright test tests/<dir>/`);
  3. contagem de testes e asserções **idênticas** — nenhum teste removido,
     renomeado, pulado ou enfraquecido;
  4. suíte verde após o lote.
- **Done quando (total):** redução **≥ 60%** dos 216,6 s (191 call sites) e ganho
  **≥ 10%** do wall da suíte atribuível a este cluster, medido em CI.
- **Paralelismo:** lotes são sequenciais entre si (um `[-]` por vez); anotar aqui o
  lote em curso.

## T-08 — Política de retry/timeout [ ]

- **Owner:** software-engineer + qa-engineer (revisão)
- **Write set:** `src/web-games/tests/playwright.config.js` (`retries`, `timeout`,
  `trace`, `video`); documento curto da política dentro do próprio config ou em
  `docs/`
- **Precondição:** T-07 `[x]` (sleeps fixos já removidos — só então o flake residual
  é diagnosticável)
- **Done quando:**
  1. política escrita: o que retenta, quantas vezes, timeout por classe de teste
     (smoke curto vs auditoria longa), quais artefatos são gravados em falha —
     amarrada ao consumidor definido em T-06 (upload `if: failure()` de
     `ci.yml:55-63`);
  2. custo de pior caso recalculado contra os 28,2 min do baseline;
  3. **nenhum teste perde retry sem evidência** de que não é flaky (n runs verdes
     citados);
  4. suíte verde em CI com a política final.
- **Paralelismo:** nenhum

## T-09 — Prova final, memória e doctor [ ]

- **Owner:** qa-engineer + product-engineer
- **Write set:** `specs/memory/quality-assurance.md`,
  `specs/memory/tech-stack.md`, `specs/memory/architecture.md` (só se a topologia de
  jobs de CI estiver descrita lá), `specs/releases/v0.10.0/CLOSURE.md`
- **Precondição:** T-01…T-08 `[x]`; `ACTIVE.md` em fase `CLOSURE`
- **Done quando:**
  1. run de CI final na branch da release com step "Run tests" **≤ 10 min**
     (obrigatório) e, se alcançado, **≤ 9 min** (stretch) — id do run registrado;
  2. contagem total de testes (raiz + jobs dedicados) **≥ 168**; zero teste
     deletado/pulado/enfraquecido em toda a release;
  3. tabela consolidada antes/depois de todas as métricas do baseline de SPEC §1;
  4. memória sincronizada: `quality-assurance.md` (paralelismo, `testIgnore` + jobs
     dedicados, run-start clean, regra "artefato sem consumidor não se escreve",
     padrão polling, política de retry) e `tech-stack.md` (valor de `workers`, flags
     GL, jobs de CI da suíte web);
  5. achados roteados ao backlog registrados no CLOSURE — em especial a **divergência
     memória × árvore** (catálogo lista 4 jogos web; a árvore tem 9 e a suíte roda
     specs de jogos que a memória diz deletados);
  6. `dadaia specs doctor` limpo;
  7. sweep de disposição: as duas entradas de backlog consumidas marcadas
     `DELIVERED — v0.10.0`.
- **Paralelismo:** nenhum

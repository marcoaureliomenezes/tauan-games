# PLAN — Release: v0.10.0

> **Status:** Aprovado
> **Release ID:** v0.10.0
> **Spec:** `SPEC.md`

---

## Estratégia

Uma release, duas frentes (tempo e lixo), executada em **uma única linha
sequencial**. Não há paralelismo real: quatro tarefas escrevem no mesmo arquivo
(`src/web-games/tests/playwright.config.js`) e as demais dependem de medições das
anteriores. A ordem é a decisão D2 do operador — **config-only primeiro, testes
depois** — com uma exceção deliberada na frente: o experimento A/B, porque o seu
resultado é parâmetro de uma tarefa posterior.

Princípio de medição, válido para todas as tarefas: **medição de aceitação é de
CI**, nunca local. O report que originou esta release já provou que o host local
está saturado (load 27–55, sessões concorrentes rodando Chromium) e que números
locais são limite superior, não medida. Medida local entra como indício, sempre
rotulada como tal.

Princípio de honestidade: um experimento que dá resultado nulo é resultado, não
falha. Nada de "contar" ganho não medido — o A/B existe exatamente para impedir isso.

---

## Sequência

| # | Tarefa | Classe | Depende de |
|---|---|---|---|
| 1 | T-01 — A/B GL/ANGLE no CI | experimento (config, sem default novo) | — |
| 2 | T-02 — `workers` 1 → 2 (avaliar 3) | config-only | T-01 (evita ruído no A/B) |
| 3 | T-03 — `testIgnore` + jobs dedicados | config-only + CI | T-02 |
| 4 | T-04 — `paths` + `concurrency` no `ci.yml` | config-only (CI) | T-03 |
| 5 | T-05 — posição definitiva das flags GL | config-only | T-01, T-04 |
| 6 | T-06 — higiene de artefatos | infra de teste + 2 specs | T-05 |
| 7 | T-07 — `waitForTimeout` → polling (lotes) | toca testes | T-06 |
| 8 | T-08 — política de retry/timeout | config-only | T-07 |
| 9 | T-09 — prova final, memória, doctor | fechamento | tudo |

Por que T-01 antes de T-02: se o paralelismo mudar primeiro, o A/B das flags GL
passa a comparar dois regimes de agendamento ao mesmo tempo e o delta deixa de ser
atribuível. Um experimento por vez.

Por que T-08 depois de T-07: a política de retry só pode ser revista quando os
sleeps fixos (fonte principal de flake e de custo de timeout) já saíram.

---

## Camadas afetadas

| Camada | Arquivos |
|---|---|
| Config da suíte | `src/web-games/tests/playwright.config.js` (T-01, T-02, T-03, T-05, T-08) |
| Configs dedicados | `src/web-games/tests/james-bond/playwright.config.js`, `src/web-games/tests/demolition-ball-opus-5/playwright.config.js` (T-03) |
| Ciclo de vida do run | `src/web-games/tests/globalSetup.js`, `src/web-games/tests/globalTeardown.js` (T-06) |
| CI | `.github/workflows/ci.yml` (T-01, T-03, T-04) |
| Ignore | `.gitignore` (T-06) |
| Specs de teste | `tests/demolition-ball-opus-5/e2e.spec.js`, `tests/aero-fighters/sortie.spec.js` (T-06); lotes por diretório de jogo (T-07) |
| Memória | `specs/memory/quality-assurance.md`, `specs/memory/tech-stack.md` (T-09) |

---

## Notas de design

### T-01 — o experimento (mecanismo)

O A/B precisa ser barato, repetível e reversível. Mecanismo escolhido:

1. As 5 flags de `tests/demolition-ball-opus-5/playwright.config.js:25-33` entram no
   config raiz **atrás de env**, default **desligado**:
   `launchOptions: process.env.PW_GL_ARGS === '1' ? { args: [...] } : undefined`.
2. `ci.yml` ganha `workflow_dispatch` com input booleano `gl_args`, propagado como
   `PW_GL_ARGS` para o step de testes.
3. Dois disparos na **mesma sha**, mesmo subconjunto — `npm run test:space-war`
   (subconjunto fixo, reproduzível, sem depender de contagem cravada) — um com
   `gl_args=true`, outro com `false`.
4. Registrar: contagem de testes reportada pelo Playwright (deve ser idêntica),
   duração do step, delta absoluto e percentual, e se houve mudança de resultado
   (verde/vermelho) em qualquer teste.

A infraestrutura de env fica no repo depois do experimento — é ela que T-05 usa para
fixar (ou não) o default. Nada de patch temporário jogado fora.

### T-02 — paralelismo

`workers: 2` primeiro. O servidor estático é `python3 -m http.server` servindo
arquivos estáticos do repo — não há estado compartilhado entre testes além da porta,
e `TEST_PORT` já parametriza sessões concorrentes. Riscos reais são CPU (runner de
4 vCPU rodando Chromium WebGL em software) e testes sensíveis a tempo (FPS,
física). Critério: **dois runs verdes consecutivos** com o valor escolhido. Só então
medir `workers: 3`; se 3 piorar o wall ou introduzir vermelho, fica 2 e o número
que mostrou isso vai para o TASKS.

Se um teste virar flaky com paralelismo, ele **não** é pulado nem afrouxado: ou o
paralelismo recua, ou o flake é tratado como bug pela via de hotfix.

### T-03 — `testIgnore` com contrapartida

`testIgnore: ['**/james-bond/**', '**/demolition-ball-opus-5/**']` no config raiz.
Sozinho, isso é perda de cobertura — por isso a mesma tarefa entrega os jobs
dedicados no `ci.yml`, no padrão do `godot-ci.yml` (job próprio + `paths:` do jogo).

Bloqueio conhecido: `tests/james-bond/playwright.config.js` não tem
`globalSetup`/`globalTeardown` e aponta para `TEST_PORT || 3658` — hoje ele presume
um servidor de pé, o que não existe em CI. A tarefa adiciona os dois hooks
(reutilizando os do diretório pai, que já são parametrizados por `TEST_PORT`), do
mesmo modo que o config do demolition-ball já faz em `:14-15`.

Custo consciente: os 13 testes do james-bond têm orçamento de 600–900 s cada. Por
isso o job dedicado é `paths`-filtrado no próprio jogo — ele não roda em push que
não toca `src/web-games/james-bond/**`.

### T-04 — `paths` + `concurrency`

Espelhar `godot-ci.yml:11-25`:

```yaml
on:
  push:
    branches: [main]
    paths: ["src/web-games/**", ".github/workflows/ci.yml"]
  pull_request:
    branches: [main]
    paths: ["src/web-games/**", ".github/workflows/ci.yml"]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

Atenção ao filtro: `src/web-games/**` já cobre `package.json`/`package-lock.json`
(estão dentro de `src/web-games/`). O que fica **fora** do filtro (raiz, `specs/`,
`src/godot/**`, outros workflows) deve ser listado no TASKS como decisão explícita.

### T-05 — onde as flags GL ficam

Duas dimensões independentes:

- **Local (com GPU):** flags **sempre ligadas**. O ganho está medido (1,76–2,65 fps
  em SwiftShader contra ≥ 55 exigido por `tests/trex/smoke.spec.js:76-94`).
- **CI (sem GPU):** ligadas **se e somente se** T-01 mediu ganho. Implementação:
  default do `PW_GL_ARGS` invertido para ligado, com o CI podendo desligar — ou o
  oposto — conforme o número. A escolha e o número que a sustenta ficam no TASKS.

### T-06 — higiene, na ordem certa

1. **`globalTeardown` primeiro** (fecha a torneira): `try/finally` em volta do
   `process.kill` + handlers de `SIGINT`/`SIGTERM`/`exit` que removem o pid file. O
   `fs.unlinkSync(PID_FILE)` de hoje (`globalTeardown.js:16`) só roda no caminho
   feliz.
2. **`globalSetup` depois** (limpa o que sobrou): antes de `checkPort()`, varrer pid
   files do diretório e, para cada um, checar se o processo existe
   (`process.kill(pid, 0)`); pid morto → remove o arquivo e segue. Só então aplicar
   a guarda de porta ocupada de `globalSetup.js:33-36` — hoje ela aborta o run por
   causa de lixo. Em seguida, run-start clean de `screenshots/`,
   `playwright-report/`, `test-results/`, **imprimindo o que removeu**.
   Limpeza é sempre no **início**, nunca no fim: o artefato do último run continua
   disponível para inspeção humana.
3. **Specs:** `demolition-ball-opus-5/e2e.spec.js:127` escreve
   `screenshots/…png` por caminho relativo ao cwd (fora de qualquer `outputDir`) e
   `aero-fighters/sortie.spec.js:147` escreve em caminho fixo. Regra: ou o artefato
   tem consumidor definido (upload de CI em falha, ou inspeção local documentada em
   comentário no próprio spec), ou não é escrito. Screenshot de caminho feliz sem
   consumidor: removido — sem remover ou enfraquecer a asserção do teste.
4. **`.gitignore`:** `tests/screenshots/` (linhas 6 e 20) está ancorado na raiz do
   repo e **não** cobre `src/web-games/tests/screenshots/`; corrigir para padrão não
   ancorado ou caminho completo. E `git rm --cached` dos pid files rastreados
   (`.server-8097.pid`, `.server-8399.pid`) — `.gitignore` não desfaz rastreamento.

Antes/depois medidos com `du -sh` dos três diretórios e `git status --porcelain`
vazio. Prova do pid órfão: subir um run, `kill -9` no processo do Playwright,
verificar que o run seguinte **inicia** (hoje aborta).

### T-07 — conversão dos sleeps, por lote

Padrão de referência: `tests/aero-fighters/smoke.spec.js:36-43` — `waitForFunction`
sobre estado real do jogo (`window.game`, flags de módulo carregado), com timeout
generoso (15 s) que detecta falha real sem mascará-la. O anti-padrão a eliminar é
`waitForTimeout(N)` fixo: paga N sempre, e quando a máquina está lenta ainda por
cima falha.

Lotes, na ordem (maior densidade primeiro, `corrida` por último para não colidir com
v0.8.0):

| Lote | Diretório | Sleeps aprox. (call sites) |
|---|---|---|
| L1 | `tests/aero-fighters/` | ~61 |
| L2 | `tests/space-war/` | ~50 |
| L3 | `tests/trex/` | ~15 |
| L4 | `tests/bang-bang/` | ~12 |
| L5 | `tests/far-west/` | ~12 |
| L6 | `tests/corrida/` | ~15 |

(Contagens conferidas na árvore em 2026-08-11; o total do report — 191 call sites em
specs — é a referência de aceitação. `tests/james-bond/` fica fora do run raiz por
T-03 e é opcional aqui; `tests/*/tools/*.mjs` são ferramentas de operador, fora do
escopo.)

Regra por lote: converter, rodar o diretório, comparar wall antes/depois, conferir
que a contagem de testes e as asserções são idênticas. Sleep que **não** tem
condição observável equivalente permanece — e o motivo é escrito no próprio spec.
Não vale trocar `waitForTimeout(800)` por `waitForTimeout(200)`: ou vira polling, ou
fica como está com justificativa.

### T-08 — retry e timeout

Hoje: `retries: 1`, `timeout: 30000`, `trace`/`video` em `on-first-retry`. Um teste
que estoura paga 2 × 30 s + custo de trace/vídeo. Entregar uma política escrita:
o que retenta (e onde o retry esconde flake que deveria virar bug), quantas vezes,
com qual timeout por classe de teste (smoke rápido vs auditoria longa), e quais
artefatos são gravados em falha — amarrada ao consumidor definido em T-06 (o upload
de `if: failure()` do `ci.yml:55-63`).

Nenhum teste perde retry sem evidência de que ele não é flaky. Retry removido por
palpite é como teste deletado por palpite.

---

## Plano de validação

| O que | Como | Contra |
|---|---|---|
| Ganho do A/B GL | 2 runs de CI, mesma sha, mesmo subconjunto | delta em s e % |
| Ganho de paralelismo | step "Run tests" do CI, 2 runs verdes | 20,4 min / 168 testes (run 29710660997) |
| Fila eliminada | dois pushes seguidos; commit fora de `src/web-games/**` | pior caso 28,2 min (≈19 min de fila) |
| Cobertura preservada | soma das contagens (raiz + jobs dedicados) | ≥ 168 testes |
| Sleeps | soma de `waitForTimeout` por diretório | 216,6 s / 191 call sites |
| Lixo | `du -sh` dos 3 diretórios + `git status --porcelain` | 75 MB / 516 KB / 6 pid órfãos / 2 pid rastreados |
| Pid órfão | `kill -9` no meio de um run, iniciar o próximo | hoje aborta em `globalSetup.js:35` |
| Fechamento | run final na branch + `dadaia specs doctor` | step ≤ 10 min (stretch ≤ 9 min) |

---

## Riscos técnicos (execução)

- **Contaminação de medida:** qualquer número de aceitação vindo de máquina local é
  inválido. Se o CI estiver indisponível, a tarefa espera — não se aceita indício
  local como prova.
- **Colisão com v0.8.0:** `tests/corrida/**` está sob edição viva (T-05/T-06 de
  v0.8.0). Lote L6 por último e só depois de o operador repontar `ACTIVE.md`.
- **Arquivo único de config:** T-02/T-03/T-05/T-08 escrevem no mesmo arquivo —
  estritamente um `[-]` por vez, sem exceção.
- **`paths` filter escondendo quebra:** mudança fora de `src/web-games/**` que quebre
  a suíte deixa de ser detectada no push. Mitigação: manter o workflow no filtro e
  documentar o que ficou fora; se aparecer um caso real, ele vira bug, não exceção
  silenciosa.
- **Ganho reivindicado sem medida:** proibido. Todo % no CLOSURE aponta para um run
  de CI identificável.

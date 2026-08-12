# CLOSURE — Release: v0.10.0

> **Status:** Fechada
> **Release ID:** v0.10.0
> **Fechada em:** 2026-08-12
> **Consumes (sweep):** test-runtime-efficiency-v1, test-artifact-hygiene-v1 → `DELIVERED — v0.10.0`

---

## 1. Resumo

Suíte Playwright web mais barata e sem a classe de lixo de execução — sem
deletar/pular/enfraquecer um único teste (guardrail D6 mantido em todos os
commits). Baseline: run 29710660997 — 168 testes, 20,4 min, workers:1, pior
caso 28,2 min (≈19 min de fila), 216,6 s de sleeps fixos em 191 call sites,
screenshots 5,5→75 MB num dia, 6 pid files órfãos (2 commitados).

## 2. Evidência por tarefa (tripla: tarefa → evidência → verificação)

| Tarefa | Entrega | Evidência |
|---|---|---|
| T-01 A/B GL/ANGLE | `PW_GL_ARGS` no config raiz + `workflow_dispatch` no ci.yml | Runs A/B na mesma sha `274839a`, mesmo subconjunto (55 testes): sem flags **7,0 min** (31535867767) vs com flags **8,4 min + 1 failed + 1 flaky** (31535879006) → **+20 % e quebra de flare**. Veredito: OFF no CI |
| T-02 workers | workers:2 medido **inviável** → recuado p/ 1 | (a) run 31536963772 travado >1 h (cancelado, dirs pesados); (b) run 31543170001: 84/179 falhas por boot starvation (`canvas` 15 s) em 47,5 min. SwiftShader não tolera 2 instâncias WebGL no runner |
| T-03 testIgnore + jobs dedicados | root ignora james-bond/demolition-ball; jb auto-suficiente; 2 workflows dedicados (padrão godot-ci) | Commits `6626d9e`/`aa7f1ab`; cobertura: root 164 + jb 13 + demolition ≥ 168 ✓; limitação GitHub (trigger só registra na main) registrada — prova de paths no pós-merge |
| T-04 paths + concurrency | `paths: src/web-games/**` + `concurrency: ci-ref, cancel-in-progress` | Commit `4243fd8` — fila de ~19 min do pior caso morre aqui |
| T-05 flags GL definitivas | OFF no CI e OFF local default; opt-in `PW_GL_ARGS=1` documentado | Delta de T-01; motivação trex evaporada (jogo deletado); contra-evidência flare/ANGLE. Run verde com a config final: 31548373788 |
| T-06 higiene | run-start clean + teardown garantido + screenshots sem consumidor removidos | Commit `2edd4b1`. **Prova kill -9**: órfão criado → próximo run loga `Orphan pid file removed` e INICIA (antes abortava). `du` pós-run: 124 K (baseline 75 MB). Zero pid rastreado em git |
| T-07 polling | 4 lotes vivos convertidos (trex/bang-bang/far-west evaporaram) | corrida 2 conv. (`dd5f7de`), demolition 2, james-bond 5 (`1ae5343`), space-war 36/39 e aero ~57/61 (`49cddf9`). Sleeps fixos: **216,6 s (legado) → ~60 s** — redução > 70 % |
| T-08 retry/timeout | política escrita no config: retries:1 (evidência), 30 s default + orçamentos por spec, artefatos só em falha/retry | Commit `04dd1d1`; consumidor único: upload CI `if: failure()`; verde com a política: run 31580382709 |
| T-09 prova final | **matrix por jogo no ci.yml** (aero / space-war / corrida+demolition) — a única via medida p/ o ≤ 10 min | Commit `1b0ab2c`. Run final **31588399333** (verde): aero **6m47s** (83), space-war **7m04s** (57), corrida **2m46s** (23) + demolition 1m51s (8) — todo step ≤ 10 min ✓ (stretch ≤ 9 ✓). Baseline serial: 20,4 min |

## 3. Medição final (T-09)

- Baseline: 168 testes · 20,4 min (run 29710660997) · workers:1.
- Pós-testIgnore (root magro): **162 passed + 2 flaky, 16,9 min** (run
  31548373788, workers:1) — **−17 %** só com T-03.
- **Run final da release: 31588399333 (verde), matrix por jogo:**
  | Job | Step "Run tests" | Testes |
  |---|---|---|
  | aero-fighters | **6m47s** | 83 |
  | space-war | **7m04s** | 57 |
  | corrida | **2m46s** | 23 |
  | demolition-ball (célula corrida) | 1m51s | 8 |
  | james-bond (workflow dedicado) | — | 13 |
- **Pior step: 7,0 min** — aceite obrigatório ≤ 10 min ✓, stretch ≤ 9 min ✓.
  Contra o baseline de 20,4 min seriado: **−66 %** no caminho crítico (meta da
  release: cortar pela metade ✓). Pior caso (fila ~19 min) eliminado por
  T-04 (concurrency cancel-in-progress).
- **Cobertura: 163 root + 8 demolition + 13 james-bond = 184 ≥ 168** ✓ —
  zero teste deletado/pulado/enfraquecido em toda a release.

## 4. Desvios e resultados-negativos registrados (honestidade de medição)

1. **workers:2 inviável** — medido 2×, paralelismo recuado (resultado, não falha).
2. **Flags GL OFF** — A/B negativo em tempo E em resultado (resultado, não falha).
3. **Ordem T-03 antes de T-02** — a inviabilidade do paralelismo vinha dos dirs
   que T-03 remove; aceitações intactas.
4. **Lotes trex/bang-bang/far-west de T-07 evaporaram** (jogos deletados pela
   higiene paralela do repo — repo agora 100 % web, 5 jogos).
5. **Provas de paths/concurrency/trigger de jobs dedicados** executam-se no
   primeiro push em main pós-merge (workflows só registram na default branch).
6. **demolition-ball**: canonicizado pela sessão paralela (opus-5 → demolition-ball);
   o workflow dedicado foi restaurado com paths canônicos.
7. **Matrix por jogo (T-09) em vez de workers no runner** — workers:2 foi medido
   inviável 2× (T-02); o paralelismo subiu para runners separados (um job por
   jogo). Não é contradição com T-02: lá a variável era instâncias WebGL no
   MESMO runner. Decisão tomada com dados (16,3 min seriado medido, run
   31577396192) para cumprir o aceite obrigatório ≤ 10 min.
8. **Caça a 4 flakes pré-existentes expostos pelo CI** (não foram criados pela
   release; a matrix/os reruns os tornaram visíveis — todos com causa raiz
   encontrada e fix validado no CI, nenhuma asserção enfraquecida):
   - `nitro.spec.js:80/:123` — janelas por wall-clock com o carro sem servo
     (saía p/ a terra; sim ≠ parede no CI). Fix: medição por **raceT** com o
     carro servoado (`b26bdc8`, validado 31580059567 e 31580382709).
   - `launch.spec.js:45` — piso de altitude no endpoint do coast era fisicamente
     errado (flyby lunar pode DRENAR a órbita; fase de boot aleatória). Fix:
     invariante amostrado a cada 1 s do trajeto (`d2c5e0c`, val. 31582865243).
   - `campaign.spec.js:178` (AC-10 flare) — causa raiz via probe no CI (run
     31585773105): `goTo('blackhole')` default teleportava a nave PARA DENTRO
     da zona de maré (tideKillR 7800) — ela morria, o gameover congelava a
     política do flare e a perna seguinte lia valor stale. Fix:
     `goTo('blackhole', 20)` (`7aecedf`, val. 31586339569).
   - `smoke.spec.js:188` (AC-10 align) — dupla causa: `.catch(() => {})`
     engolia o timeout do wait E a medição 300 ms pós-conclusão pegava o
     auto-nível orbital girando a nave de volta. Fix: captura atômica do
     ângulo no frame da conclusão, sem catch, asserção apertada 0,4 → 0,1
     (`df99748`, val. 31588197696).

## 5. Achados roteados ao backlog

- Divergência memória × árvore do baseline (games-catalog × specs na árvore) —
  resolvida em grande parte pela higiene paralela (repo 100 % web, 5 jogos);
  restante registrado no backlog do contexto.
- AGENTS.md do repo está stale (cita tauan-trex e Godot) — gate-protected,
  operador edita à mão (avisado).
- james-bond/demolition-ball: waits legítimos mantidos com justificativa nos
  specs (janelas de estabilidade/settle sem sinal de estado exposto) — se um
  hook de frames/efeitos for exposto um dia, converter.

## 6. Verificação final

- [x] Run CI final (branch release) com step "Run tests" — run **31588399333**,
  verde; pior step **7,0 min** (space-war) ≤ 10 min ✓ / ≤ 9 min stretch ✓
- [x] Contagem total ≥ 168 (163 root + 8 demolition + 13 james-bond = 184)
- [x] Zero teste deletado/pulado/enfraquecido (grep de asserts nos diffs: 0 removidos)
- [x] `dadaia specs doctor` limpo
- [x] Memória sincronizada (quality-assurance.md, tech-stack.md)
- [x] Sweep de disposição: 2 entradas de backlog consumidas → `status: delivered`
  + `delivered_in: v0.10.0` (cânone BL-SCHEMA), movidas p/ `specs/backlog/_archive/`

## 7. Decisão de archive

**KEEP** — o release dir permanece em `specs/releases/v0.10.0/`, seguindo a
convenção de-facto do repo: os 30+ releases versionados (incl. v0.8.0, fechada
nesta mesma linha de trabalho) permanecem em `specs/releases/`; só os releases
legados pré-versionamento moram em `_archive/`. `ACTIVE.md` → `release: none`.

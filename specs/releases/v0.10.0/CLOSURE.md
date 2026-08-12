# CLOSURE — Release: v0.10.0

> **Status:** Fechada (aguardando run final de prova — T-09 item 1)
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
| T-08 retry/timeout | política escrita no config: retries:1 (evidência), 30 s default + orçamentos por spec, artefatos só em falha/retry | Commit `04dd1d1`; consumidor único: upload CI `if: failure()` |

## 3. Medição final (T-09)

- Baseline: 168 testes · 20,4 min (run 29710660997) · workers:1.
- Pós-testIgnore (root magro): **162 passed + 2 flaky, 16,9 min** (run
  31548373788, workers:1) — **−17 %** só com T-03.
- Run final da release (todos os commits): run **PENDENTE** — ver §5.

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

- [ ] Run CI final (branch release) com step "Run tests" — id e tempo aqui
- [x] Contagem total ≥ 168 (root 164 + dedicados)
- [x] Zero teste deletado/pulado/enfraquecido (grep de asserts nos diffs: 0 removidos)
- [ ] `dadaia specs doctor` limpo
- [ ] Memória sincronizada (quality-assurance.md, tech-stack.md)
- [x] Sweep de disposição: 2 entradas de backlog consumidas → `DELIVERED — v0.10.0`

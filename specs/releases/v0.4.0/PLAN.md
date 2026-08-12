# PLAN — Release: v0.4.0

> **Status:** Aprovado
> **Release ID:** v0.4.0
> **Spec:** `SPEC.md`

---

## Sequência de execução

1. **Recon** — mapear todas as referências a bang-bang/far-west (código, testes,
   hub, package.json, specs, memory). Confirmar duplicidade bang-bang == far-west
   (`diff -rq`: idênticos exceto branding).
2. **Deleção (R-01/R-02)** — remover diretórios de código e testes; limpar hub
   `index.html`, `package.json`; comentário morto em `james-bond/src/ai/enemy-assets.js`.
3. **Auditorias paralelas (R-03/R-04/R-05)** — subagentes read-only:
   speed-run web, speed-run godot, james-bond godot-vs-web. Evidência file:line.
4. **Saneamento de specs (R-02/R-06)** — backlog `v0.3.1` →
   `rejected`; releases mortas → `specs/releases/legacy/`; regenerar
   `catalog.json`/`index.md` via `dadaia memory catalog generate`; remover
   far-west de games-catalog/tech-stack/architecture/quality-assurance/constitution.
5. **Atualização de memória pós-auditoria (R-06)** — registrar vereditos:
   speed-run (web e godot) "quebrado — sob auditoria, restart pendente";
   james-bond godot "port falho — rebuild a partir da versão web (contrato de
   portabilidade: `missions.js`, `weapons.js`, `guards.js` TYPE_STATS)".
6. **Verificação final** — `dadaia specs doctor`, grep sweep, hub renderiza sem
   os cards deletados.

## Notas de fase

- A release começou com `ACTIVE.md` apontando para
  `v0.3.10` (IMPLEMENTATION) sem nenhuma sessão
  viva além desta — entrada obsoleta; `ACTIVE.md` passou a apontar para esta
  release. Memory edits feitos em fase DEFINITION, edits de produção em
  IMPLEMENTATION (RULE A do gate).

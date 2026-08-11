# TASKS — Release: v0.4.0

> **Status:** Aprovado
> **Release ID:** v0.4.0
> **Spec:** `SPEC.md` · **Plan:** `PLAN.md`

---

## T-01 — Deletar bang-bang e far-west (código + testes + hub) [x]

- **Owner:** software-engineer
- **Write set:** `src/web-games/bang-bang/`, `src/web-games/far-west/`,
  `src/godot/bang-bang/`, `tests/bang-bang/`, `tests/far-west/`,
  `index.html`, `src/web-games/package.json`,
  `src/web-games/james-bond/src/ai/enemy-assets.js` (comentário).
- **Evidência:** `diff -rq` confirmou duplicidade bang-bang == far-west (3 arquivos
  de branding); `ls` pós-delete limpo; grep sweep sem referências vivas.

## T-02 — Saneamento de specs (backlog + legacy + catálogo) [x]

- **Owner:** product-engineer
- **Write set:** `specs/backlog/v0.3.1.md` (→ rejected),
  `specs/backlog/v0.3.0.md` (desbloqueio), `specs/releases/legacy/`
  (4 releases mortas movidas), `specs/memory/product/catalog.json` + `index.md`
  (regenerados via `dadaia memory catalog generate`).

## T-03 — Remover far-west da memória core [x]

- **Owner:** product-engineer
- **Write set:** `specs/memory/product/games-catalog.md`, `specs/memory/tech-stack.md`,
  `specs/memory/architecture.md`, `specs/memory/quality-assurance.md`,
  `specs/constitution.md`, `specs/memory/product/web-games/far-west/` (deletado).

## T-04 — Auditoria speed-run web [x]

- **Owner:** project-auditor (subagente explore)
- **Entrega:** relatório spec-vs-implementação com playability killers (file:line)
  e gap list priorizada para restart.
- **Veredito:** o jogo RODA e o visual convence; "injogável" explicado por bugs
  pré-2026-07-18 (direção invertida, pista invisível) + slow-motion abaixo de
  20 FPS (`main.js:204` dt-clamp sem substepping). Defeitos vivos: SportsCarB
  andando de lado (`cars.js:96` heurística de bbox), rodas aninhadas mortas
  (`cars.js:111`), leak de GPU por restart (`main.js:92-150`), pile-up da IA na
  curva 1. P0: substepping de timestep fixo, yaw por modelo no catálogo, spec
  Playwright com input real (smoke atual dirige o player via hack de IA).

## T-05 — Auditoria speed-run godot [x]

- **Owner:** project-auditor (subagente explore)
- **Entrega:** idem T-04 para `src/godot/speed-run/` (VehicleBody3D, input map,
  wiring de cenas, IA).
- **Veredito:** INJOGÁVEL + spec drift — o código virou "Cruis'n Tauan" A→B com
  perseguição policial (spec diz circuito fechado/3 voltas/GLB). Player 3× mais
  lento que a IA (câmbio M.A.V.S vs engine_force bruto), paredes invisíveis
  encalham o player, IA trava sem ré (branch morto `Race_follow_AI.gd:235`),
  GodotPhysics em vez de Jolt. Aproveitável: route/terrain builder e o harness
  headless `tests/drive_route.gd`. Decisão do operador pendente: restaurar a
  spec ou reescrevê-la para o A→B.

## T-06 — Auditoria james-bond godot vs web [x]

- **Owner:** project-auditor (subagente explore)
- **Entrega:** inventário de features da versão web (contrato de portabilidade),
  tabela de divergência, plano priorizado de port fiel. Veredito: sistemas ~70%
  fiéis (AI, dificuldade, player, HUD); conteúdo (mapas, missões, inimigos,
  arsenal) é outro jogo — rebuild a partir de `missions.js`, `weapons.js`,
  `guards.js` TYPE_STATS.

## T-07 — Atualizar memória com vereditos das auditorias [x]

- **Owner:** product-engineer
- **Write set:** `specs/memory/product/web-games/speed-run/speed-run-web-jogo.md`,
  `specs/memory/product/godot/speed-run/speed-run-godot-jogo.md`,
  `specs/memory/product/games-catalog.md` (status), atom novo ou nota para
  james-bond godot (estado: port falho, rebuild pendente).
- **Evidência:** seções "Auditoria 2026-08-10" nos dois atoms de speed-run;
  atom novo `product/godot/james-bond/james-bond-godot-jogo.md` com o contrato
  de portabilidade; catalog regenerado (16 features).

## T-08 — Verificação final [x]

- **Owner:** qa-reviewer
- **Entrega:** `dadaia specs doctor` verde (0 erros; 39 warnings pré-existentes
  de naming legado), grep sweep sem referências mortas, hub `index.html` sem
  cards deletados.
- **Depende de:** T-07.

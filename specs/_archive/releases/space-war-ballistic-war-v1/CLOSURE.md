# Closure: Release — space-war-ballistic-war-v1

> **Status:** Aprovado
> **Release ID:** space-war-ballistic-war-v1
> **Owner:** product-engineer
> **Closed:** 2026-07-03

## Summary

Rodada de playtest do operador (2026-07-03) transformada em guerra balística honesta:
a tecla C agora computa uma **solução de tiro** sob o campo gravitacional real dos
corpos componentizados — a nave aponta para ONDE LANÇAR, o HUD desenha o arco previsto
com ponto de impacto e tempo de voo, e a nuke lançada segue gravidade pura até o alvo
(o arco previsto É a trajetória real). A campanha ganhou **caçada sequencial**: 5/7/9/
11/13 alvos por fase, cada baixa faz o próximo alvo surgir em OUTRA lua/planeta ou numa
nave capital orbitante (~700 u), com escoltas; bases redesenhadas com anatomia legível
(domo de comando, hábitats, antena, pista) mantendo pegada ≤3% da superfície. Explosão
nuclear realista: cogumelo orientado pela normal da superfície em impactos, casca +
duplo flash no vácuo. Mid-release o operador pediu uplift do fundo espacial: galeria de
galáxias em destaque (jatos polares + lóbulo, discos edge-on com faixa de poeira,
espirais inclinadas) + 9k estrelas de fundo — matéria-prima da lente gravitacional.
Também corrigiu a regressão `space-war-solar-system-key-drift` (nav/map filtravam
`'home'` após a migração celestial renomear o sistema para `'solar'`).

## Tasks completed

| Task ID | Description | Final commit |
|---------|-------------|--------------|
| T-BW-01 | `ballistics.js` solver + teste unit node (arco curva, alvo orbital, velocidade herdada) | `ca9190e` |
| T-BW-02 | C = solução de tiro (ship.js) + arco no HUD (nav.js) + launch `aimed` gravidade pura + `game.nav.solution` | `ca9190e` |
| T-BW-03 | Caçada sequencial 5/7/9/11/13 (campaign/missions/enemies) com retarget + escoltas | `ca9190e` |
| T-BW-04 | Base v2 legível + nave capital orbitante | `ca9190e` |
| T-BW-05 | `nukeMushroom` + duplo flash no vácuo | `ca9190e` |
| T-BW-06 | e2e novos + suíte adaptada verde + QA + security + push/PR/CI | `fa03eb0` |
| T-BW-07 | Skybox uplift: galáxias em destaque + 9k estrelas (fotos do operador como referência) | `ca9190e` |
| T-BW-08 | Fix bug `space-war-solar-system-key-drift` (nav/map `'home'`→`'solar'`) | `ca9190e` |

## Validations

| Description | Command | Evidence |
|-------------|---------|----------|
| Unit node: 26 checks celestial + 7 checks balística (arco curva vs tiro reto, alvo orbital com lead, compensação de velocidade herdada) | `npm run test:space-war:unit` | `test-ballistics-unit: solver balístico OK` |
| e2e Playwright 21/21 (9 campanha + 12 smoke), incl. AC-01 alinhamento à solução, AC-03 cadeia de caçada, AC-04 pegada de base | `npx playwright test tests/space-war/` | `21 passed (3.1m)` |
| QA end-of-alpha APPROVE 6/6 ACs | — | `.dadaia/handoff/tauan-games/2026-07-03T191652Z-qa-engineer-ballistic-war-alpha-review.handoff.json` |
| Security push-verdict APPROVE (0 findings) pinado no sha empurrado | — | `.dadaia/handoff/tauan-games/2026-07-03T191945Z-security-reviewer-ballistic-war-push.handoff.json` (`metrics.commit_sha = fa03eb07…`) |
| PR #13 CI verde (Playwright + GitGuardian) e merge em main | `gh pr view 13` | merge commit `f98ff87` |
| Write-set: gravity.js/orbits.js/config.js/universe.js/celestial/* intocados | `git diff main...feature --stat` | diff vazio nos caminhos PROIBIDOS |

## Drifts

### skybox-uplift-mid-release

**Description:** Mid-implementation o operador adicionou fotos de referência
(`bug-space-war/`) e pediu galáxias no fundo + melhores estrelas, com atenção à lente
gravitacional. Não estava no SPEC original.

**Resolution:** Absorvido como T-BW-07 na mesma release (paint-time only — zero custo
de FPS; nenhuma mudança de física). SPEC/TASKS atualizados antes da implementação.

**Memory updates:** coberto pela linha do catálogo (galáxias no skybox).

### base-footprint-floor-vs-cap

**Description:** O piso de legibilidade da base (`s ≥ 14`) violava o teto de pegada
(≤3% da área) em corpos pequenos (errantes R≈90).

**Resolution:** O invariante vence: `s = min(max(14, min(70, R·0.028)), R·0.042)` —
em corpos minúsculos a base encolhe abaixo do piso estético.

**Memory updates:** nenhum (detalhe de implementação, coberto por teste e2e).

## Memory updates

- `specs/memory/product/games-catalog.md` — linha Space War: solução balística no C,
  caçada sequencial com naves capitais, cogumelo nuclear, galáxias no skybox; status
  inclui `space-war-ballistic-war-v1` arquivada.
- `specs/memory/architecture.md` — Degrau 2 Space War: `ballistics.js` (solver de
  solução de tiro consumindo `computeGravity`) adicionado à estrutura.
- `specs/memory/tech-stack.md` — no change: release não tocou dependências.
- `specs/memory/quality-assurance.md` — no change: pirâmide de testes inalterada
  (novos testes seguem o padrão existente node-unit + Playwright e2e).

## Dispositions

| File | Kind | Terminal status | Evidence |
|------|------|-----------------|----------|
| `specs/backlog/_archive/space-war-ballistic-war-v1.md` | backlog | `delivered` + `delivered_in: space-war-ballistic-war-v1` | este CLOSURE + merge `f98ff87` |
| bug `space-war-solar-system-key-drift` (JSONL) | bug | `resolved --release space-war-ballistic-war-v1` | T-BW-08, commit `ca9190e` |

Bug `pages-deploy-workflow-conflicts-with-legacy-mode` (LOW) permanece **Open** — não
foi picked nesta release; a correção é decisão do operador entre modo `workflow`
(deploy curado `_site`, sem publicar `specs/`) e deletar `pages.yml` (mantém deploy
legacy do repo inteiro). A troca de `build_type` é mudança de settings do repo,
permission-blocked para o agente.

## Backlog returns

- `backlog/candidates.md` — sem novos itens desta release (hygiene candidates da
  rodada anterior — untrack `tests/playwright-report/`, `intents[]` faltantes em 5
  entradas antigas — já registrados lá).

## Archive decision

**MOVE** — release movida para `specs/_archive/releases/space-war-ballistic-war-v1/`
via `git mv`. `ACTIVE.md` volta a apontar para a release estacionada
`aero-fighters-world-realism-v1` (phase IMPLEMENTATION), pendente decisão do operador
entre retomá-la ou grillar `aero-air-combat-v1`.

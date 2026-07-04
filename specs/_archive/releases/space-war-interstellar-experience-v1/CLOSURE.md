# Closure: Release — space-war-interstellar-experience-v1

> **Status:** Aprovado
> **Release ID:** space-war-interstellar-experience-v1
> **Owner:** product-engineer
> **Closed:** 2026-07-04

## Summary

A viagem interestelar ganhou a experiência que o operador exigiu (brief de pesquisa
com 19 referências em `physics-brief-relativistic-passage.md`): perfil **trapezóide
30/40/30** (`journeyProfileTrapezoid`: v_max = D/(0.7T), a = v_max/(0.3T)) com fase
de CRUZEIRO a β≈0.995 — onde a aberração é violenta (estrela a 90° aparece a 5.7°,
arccos β) e o headlight/beaming δ⁴ (teto 9 à frente, piso 0.02 atrás) concentra o céu
num cone à frente, como pedido. **Crescimento na passagem rasante**: cada estrela do
corredor tem pseudo-raio e cresce honestamente por 2R/d até o teto suave de 48 px —
as que cruzam perto do centro da tela (menor parâmetro de impacto b) incham antes de
passar. **Riscos tangenciais** (streaks): alongamento ∝ ω = v·sinθ/d (ω_max = v/b no
través), persistência de visão honesta com intensidade dividida pelo stretch
(conservação de fluxo). Colisão com estrelas em viagem REMOVIDA por ordem do operador
(imunidade no corredor — reverte o D-1 do rc-1 da journey). HUD com fases
ACELERANDO / CRUZEIRO v_max / FREANDO.

## Tasks completed

| Task ID | Description | Final commit |
|---------|-------------|--------------|
| T-IE-01 | `journeyProfileTrapezoid` (30/40/30) puro + unit node | `95f5279` |
| T-IE-02 | journey.js no trapezóide (β 0.995, imunidade, fase) + HUD | `95f5279` |
| T-IE-03 | Starfield: crescimento na passagem + streaks tangenciais | `95f5279` |
| T-IE-04 | Testes: unit trapezóide; journey.spec platô; journey-experience.spec | `95f5279` |
| T-IE-05 | QA + security + push + PR #19 + CI verde | `95f5279` |

## Validations

| Description | Command | Evidence |
|-------------|---------|----------|
| Unit node 14/14 (x(T)=D exato, continuidade nas juntas 0.3/0.7, platô) | `npm run test:space-war:unit` | commit `95f5279` |
| e2e 48/48 zero retries (journey-experience.spec 3/3 + suíte inteira) | `npx playwright test tests/space-war/` | PR #19 CI verde (run 28716116469) |
| QA end-of-alpha APPROVE (AC-01..06 PASS) | — | `.dadaia/handoff/tauan-games/2026-07-04T184537Z-qa-engineer-interstellar-experience-alpha-review.handoff.json` |
| Security push-verdict APPROVE pinado em `95f5279` | — | `.dadaia/handoff/tauan-games/2026-07-04T184600Z-security-reviewer-interstellar-experience-push.handoff.json` |
| Merge em main + site público servindo esta versão | `gh pr view 19` + curl cache-bust | merge `7427485`; Pages run 28719095566 success |

## Drifts

### pages-deploy-transient-failure

**Description:** No ship da fila, o deploy do Pages disparado pelo merge falhou com
"Deployment failed, try again later" (padrão transitório já conhecido do repo).

**Resolution:** Re-dispatch manual do `pages.yml` — verde no 2º dispatch, versão
verificada no site público com cache-busting (marcadores: trapezóide, streaks, fix
das armas, config de proporções).

**Memory updates:** gotcha já registrado no atom do projeto na workspace-memory do
agente ("2º dispatch ativa").

## Memory updates

- `specs/memory/product/games-catalog.md` — linha Space War reescrita para o estado
  atual completo (esta edição cobre a fila das 5 releases; status: arquivadas
  2026-07-04, jogo público no GitHub Pages).
- `specs/memory/architecture.md` — Degrau 2 Space War: `journey.js`, `starfield.js`,
  `starlod.js` e leis puras (fotometria + perfis de viagem) em `celestial/physics.js`.
- `specs/memory/tech-stack.md` — no change: sem dependências novas em toda a fila.
- `specs/memory/quality-assurance.md` — no change: pirâmide inalterada (node-unit +
  Playwright e2e).

## Dispositions

| File | Kind | Terminal status | Evidence |
|------|------|-----------------|----------|
| bug `space-war-interstellar-experience-flat` (JSONL) | bug | `resolved --release space-war-interstellar-experience-v1` | T-IE-01..04, commit `95f5279` |

## Backlog returns

- `backlog/ideas.md` — knobs de gosto para um eventual rc de ajuste visual
  (CLOSE_MAX_PX 48, STREAK_K 12, teto de beaming 9) caso o operador queira mais/menos
  drama após jogar mais.

## Archive decision

**MOVE** — release movida para
`specs/_archive/releases/space-war-interstellar-experience-v1/` via `git mv`.
`ACTIVE.md` volta a apontar para a release estacionada
`aero-fighters-world-realism-v1` (phase IMPLEMENTATION), pendente decisão do operador
entre retomá-la ou definir a próxima.

# Closure: Release — space-war-photometric-stars-v1

> **Status:** Aprovado
> **Release ID:** space-war-photometric-stars-v1
> **Owner:** product-engineer
> **Closed:** 2026-07-04

## Summary

R1 da revisão técnica profunda (relatório do software-architect de 2026-07-04):
estrelas como **fontes pontuais fotométricas** — o cânone dos planetários. Fluxo
F ∝ L/d² vira intensidade I = L·(D0/d)²; pontos ACENDEM ao aproximar (α = clamp(I)),
depois incham por glare ∝ √I (Spencer 1995), e só então viram disco (LOD ponto↔disco
com histerese 2px sobe / 1px desce). Starfield reescrito em quads instanciados
(billboards) — GL_POINTS só garante 1 px de máximo no WebGL, por isso os círculos de
7 px fixos que o operador reportou. Sistemas ganharam glows fotométricos universais
(L_sys = Σ luminosidades, gauge D0_SYS) com handoff cluster↔membros em 0.9·raio.
Corona com teto de pixels e flare ∝ fluxo matam o "sol gigante de longe". Sanitize
NaN/overbright no lens pass protege o bloom (o KILLER GOTCHA AdditiveBlending +
log-depth + bloom = mips NaN = globo branco). Mid-release, root-cause do flake
pré-existente do solver balístico (loteria de boot: fases orbitais aleatórias +
goTo não co-móvel + `waitForFunction` de 2 args que descartava o timeout).

## Tasks completed

| Task ID | Description | Final commit |
|---------|-------------|--------------|
| T-PS-01 | Leis fotométricas puras em `celestial/physics.js` + unit node | `c534abc` |
| T-PS-02 | Atributos `lum` declarados (config.js/universe.js) | `c534abc` |
| T-PS-03 | Starfield fotométrico em quads instanciados | `c534abc` |
| T-PS-04 | LOD ponto↔disco (`starlod.js`) + glows de sistema | `c534abc` |
| T-PS-05 | Corona com teto de pixels + flare ∝ fluxo | `c534abc` |
| T-PS-06 | Sanitize NaN/overbright no lens pass | `c534abc` |
| T-PS-07 | E2E `photometric.spec.js` + suíte completa | `c534abc` |
| T-PS-08 | QA + security + push + PR #17 + CI verde | `d9e9499` |
| T-PS-09 | (drift rc-1) Root-cause do flake do solver balístico, 10/10 | `d9e9499` |

## Validations

| Description | Command | Evidence |
|-------------|---------|----------|
| Unit node: bloco fotométrico (I, px, α, LOD, lumForStar) | `npm run test:space-war:unit` | commit `c534abc` |
| e2e `photometric.spec.js` 4/4 + suíte completa verde | `npx playwright test tests/space-war/` | PR #17 CI verde |
| Flake balístico: 10/10 pós root-cause (antes 4/6 fail na BASE) | `npx playwright test campaign.spec.js --repeat-each 10` | `d9e9499` |
| QA end-of-alpha APPROVE + QA rc-1 flakefix | — | `.dadaia/handoff/tauan-games/2026-07-04T052508Z-…alpha-review.handoff.json` + `…060546Z-…rc1-flakefix.handoff.json` |
| Security push-verdict APPROVE ×2 (push + push2) | — | `.dadaia/handoff/tauan-games/2026-07-04T052600Z-…push.handoff.json` + `…060600Z-…push2.handoff.json` |
| Merge em main | `gh pr view 17` | merge commit `b6cc1c2` |

## Drifts

### preexisting-ballistic-flake-root-caused

**Description:** O CI do PR #17 falhou num teste que a release NÃO tocou (solver
balístico). Medição na BASE provou 4/6 de falha — os CIs verdes anteriores eram
loteria de boot (fases orbitais `Math.random()`, base aleatória na superfície, goTo
com ~250 u/s de drift não co-móvel).

**Resolution:** T-PS-09 absorvido na release: `goToObjective` co-móvel
(`s.vel.copy(worldVel)`) + descoberta de que `waitForFunction(fn, {timeout})` de
2 args põe as options no slot de ARG (timeouts nunca aplicados). 10/10 após o fix.

**Memory updates:** gotcha Playwright registrado no atom de QA da workspace-memory
do agente; sem mudança em `specs/memory/quality-assurance.md` (pirâmide inalterada).

## Memory updates

- `specs/memory/product/games-catalog.md` — linha Space War reescrita (estrelas
  fotométricas incluídas).
- `specs/memory/architecture.md` — Degrau 2 Space War: `starlod.js` e as leis
  fotométricas em `celestial/physics.js` na estrutura (edição única da fila).
- `specs/memory/tech-stack.md` — no change.
- `specs/memory/quality-assurance.md` — no change.

## Dispositions

| File | Kind | Terminal status | Evidence |
|------|------|-----------------|----------|
| bug `space-war-starfield-fixed-size-points` (JSONL) | bug | `resolved --release space-war-photometric-stars-v1` | T-PS-03, commit `c534abc` |
| bug `space-war-neutron-star-barely-visible` (JSONL) | bug | `resolved --release space-war-photometric-stars-v1` | T-PS-01/02/04 (NS lum 80 + LOD ponto) |
| bug `space-war-neutron-star-too-dim` (JSONL) | bug | `resolved --release space-war-photometric-stars-v1` | duplicata do anterior; mesmo fix |
| bug `space-war-distant-suns-oversized` (JSONL) | bug | `resolved --release space-war-photometric-stars-v1` | T-PS-05 (teto de corona + flare ∝ fluxo) |

## Backlog returns

- `backlog/candidates.md` — varredura dos `waitForFunction` de 2 args restantes na
  suíte (higiene; candidato já anotado na rodada).

## Archive decision

**MOVE** — release movida para
`specs/_archive/releases/space-war-photometric-stars-v1/` via `git mv`.

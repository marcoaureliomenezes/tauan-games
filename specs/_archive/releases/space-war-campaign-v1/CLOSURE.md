# Closure: Release — space-war-campaign-v1

> **Status:** Aprovado
> **Release ID:** space-war-campaign-v1
> **Owner:** product-engineer
> **Closed:** 2026-07-03

## Summary

O Space War deixou de ser um sandbox de 6 sistemas sem propósito e virou uma campanha de
guerra espacial em 5 fases ordenadas (Sistema Solar → Betelgeuse → Binário BN+Pulsar →
Binário Caótico → Núcleo da Galáxia), com missões por sistema (bombardeio, caça e
coleta — o cometa Halley virou objetivo de missão), desbloqueio progressivo e vitória
final em Sagitário A✦. O combate ganhou física de verdade: inimigos co-movem com os
corpos que guardam, bombardeiros lançam bombas balísticas puxadas pelo mesmo campo
gravitacional da nave, o fogo respeita oclusão do corpo-âncora, e as nukes do jogador
recarregam. O bug do flare solar (glare cobrindo o universo) foi resolvido — o brilho
do Sol agora é local. Mergeada em `main` via PR #11. Com esta release, TODO o backlog
de space-war está entregue e o ledger de bugs do contexto está zerado.

## Tasks completed

| Task ID | Description | Final commit |
|---------|-------------|--------------|
| T-CP-01 | Flare solar local (atenuação+corte por distância) + regressão AC-10 | `a7498bb` |
| T-CP-02 | campaign.js (5 fases como dados) + missions.js executor + tipo visit | `e341832` |
| T-CP-03 | Inimigos body-relativos: papéis, spawn por fase, oclusão, zona segura | `e341832` |
| T-CP-04 | Nukes recarregáveis + bombas inimigas balísticas com dano em área | `e341832` |
| T-CP-05 | Mapa ✔/▶/🔒 por sistema + HUD fase/recarga | `e341832` |
| T-CP-06 | Suite campaign.spec.js (7 testes) + QA + disposições + rc-1 | `5b46a23` |

## Validations

| Description | Command | Evidence |
|-------------|---------|----------|
| E2E completo space-war (12 smoke + 7 campanha) | `TEST_PORT=8085 npm run test:space-war` | 19/19 verdes — handoff QA `2026-07-03T173842Z` |
| Gating/unlock de campanha (AC-01/02/03) | `npx playwright test tests/space-war/campaign.spec.js` | 7/7 verdes (rerun limpo pós-commit) |
| Bomba inimiga sob gravidade (AC-04) | teste `AC-04` (bomba em repouso acelera) | campaign.spec.js verde |
| Regressão do flare (AC-10) | teste `AC-10` (perto=visível, binário=invisível) | campaign.spec.js verde |
| Física intocada | `git diff --stat 23d9631..HEAD -- gravity.js orbits.js config.js universe.js` | diff vazio — QA verificado |
| QA end-of-alpha 11/11 ACs | — | `.dadaia/handoff/tauan-games/2026-07-03T173842Z-qa-engineer-campaign-alpha-review.handoff.json` (APPROVED) |
| Security push-review 0 findings | — | `.dadaia/handoff/tauan-games/2026-07-03T174349Z-security-reviewer-campaign-push.handoff.json` (commit_sha `5b46a231`) |
| CI do PR verde e merge | `gh pr checks 11` | PR #11 MERGED `8ae4b75` |

## Drifts

### escala-ja-entregue-por-t-wr-15

**Description:** O backlog pedia recalibração de distâncias (≥2×) e escala de corpos
(≥10×), mas foi escrito ANTES do playtest da rodada T-WR-15 (distâncias ×4, aproximação
×22/×9/×6) que já tinha aterrissado.

**Resolution:** Decisão D-3 do SPEC: metas de escala consideradas entregues por
T-WR-15; nenhum multiplicador novo nesta release (evita regressão de gameplay tunado).

**Memory updates:** nenhum (decisão registrada no SPEC §6).

### teto-de-base-vence-o-piso

**Description:** O piso de legibilidade da escala de base (14) estourava o teto AC-08 de
3% da área em corpos pequenos (errantes do núcleo, R≈90).

**Resolution:** O invariante vence o piso: `s = min(s, R·0.058)` — detectado por análise
antes do teste falhar em fase 5; coberto pelo teste AC-08.

**Memory updates:** nenhum.

### bug-blackhole-ja-corrigido

**Description:** Durante a varredura de disposições, o ledger acusou o bug HIGH
`space-war-blackhole-no-attraction` aberto — mas as notas do próprio evento e o código
atual de gravity.js provam que o fix (fallback argmax interestelar + soma do par
binário) foi entregue em T-WR-13 (2026-07-01); faltava só o evento terminal.

**Resolution:** Evento `resolved` retroativo apontando `aero-fighters-world-realism-v1`.

**Memory updates:** nenhum.

## Memory updates

- `specs/memory/product/games-catalog.md` — Space War adicionado ao catálogo com estado
  atual (6 sistemas na biblioteca celestial, campanha em 5 fases, releases entregues).
- `specs/memory/architecture.md` — Degrau 2 lista `space-war/`; estrutura interna
  documenta a biblioteca `celestial/` + `universe.js` (dados) + `campaign.js` (fases).
- `specs/memory/tech-stack.md` — sem mudança: zero dependências novas.
- `specs/memory/quality-assurance.md` — sem mudança: mesmo harness Playwright.

## Dispositions

| File | Kind | Terminal status | Evidence |
|------|------|-----------------|----------|
| `specs/backlog/space-war-phased-campaign-physics-enemies.md` | backlog | `delivered — space-war-campaign-v1` | frontmatter `status: delivered` (este commit) |
| bug `space-war-solar-flare-universe-overlay` (JSONL) | bug | `resolved — space-war-campaign-v1` | evento em `specs/bugs/20260703T17Z-00.jsonl` |
| bug `space-war-blackhole-no-attraction` (JSONL) | bug | `resolved — aero-fighters-world-realism-v1` (retroativo) | evento em `specs/bugs/20260703T17Z-00.jsonl` |

## Backlog returns

- `backlog/ideas.md` ← Inimigos como atores N-body plenos (D-5 escolheu rails
  body-relativos; revisável).
- `backlog/ideas.md` ← Strip de `__swDebug` do bundle publicado no Pages (hardening
  opcional apontado pela security review).
- `backlog/candidates.md` ← Higiene: remover `tests/playwright-report/` do tracking do
  repo (artefato proibido pela regra de higiene; flagged por QA e security).

## Archive decision

**MOVE** — `git mv specs/releases/space-war-campaign-v1
specs/_archive/releases/space-war-campaign-v1` (este commit). ACTIVE.md devolvido ao
incumbente pausado `aero-fighters-world-realism-v1` (IMPLEMENTATION) — a escolha entre
retomá-lo ou grillar `aero-air-combat-v1` é do operador.

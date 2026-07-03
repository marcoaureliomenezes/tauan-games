# Closure: Release — space-war-celestial-components-v1

> **Status:** Aprovado
> **Release ID:** space-war-celestial-components-v1
> **Owner:** product-engineer
> **Closed:** 2026-07-03

## Summary

Os corpos celestes do Space War deixaram de ser construção artesanal por sistema e
viraram uma biblioteca de componentes parametrizáveis: uma superclasse `Star` com sete
subclasses da taxonomia estelar da NASA (main sequence, gigante vermelha, supergigante,
anã branca, anã marrom, estrela de nêutrons, buraco negro), planetas, luas e cometas —
todos instanciáveis por parâmetros físicos (no mínimo massa) e automaticamente
interativos nos sistemas. Os 5 sistemas existentes viraram dados declarativos, e um 6º
sistema demo ("Véu": gigante vermelha + anã branca + cometa) provou que criar um sistema
novo custa zero código de montagem. Mergeada em `main` via PR #10.

## Tasks completed

| Task ID | Description | Final commit |
|---------|-------------|--------------|
| T-CC-01 | physics.js puro (massa→μ/cor/raio, Hill, vis-viva, Kepler) + unit tests | `329de91` |
| T-CC-02 | atoms.js — extração verbatim dos átomos visuais | `329de91` |
| T-CC-03 | CelestialBody base + 6 motion components | `329de91` |
| T-CC-04 | Hierarquia Star (7 subclasses NASA) | `329de91` |
| T-CC-05 | Planet / Moon / Comet | `329de91` |
| T-CC-06 | system.js builder único + universe.js declarativo + fachada bodies.js | `ba98b05` |
| T-CC-07 | Cometa Halley + sistema demo Véu (100% dados) | `ba98b05` |
| T-CC-08 | Testes verdes + QA review + rc-1 | `23d9631` |

## Validations

| Description | Command | Evidence |
|-------------|---------|----------|
| Paridade dos 5 sistemas (smoke 12/12) | `TEST_PORT=8082 npm run test:space-war` | handoff QA `2026-07-03T162022Z` (12/12, 2 execuções independentes) |
| Leis de derivação (massa→cor/raio, Hill, vis-viva, Kepler) | `npm run test:space-war:unit` | 26 checks `ok`, exit 0 |
| Física intocada (prova da componentização) | `git diff --stat HEAD -- gravity.js orbits.js config.js` | diff vazio — QA AC-05 |
| QA end-of-alpha 10/10 ACs | — | `.dadaia/handoff/tauan-games/2026-07-03T162022Z-qa-engineer-celestial-components-alpha-review.handoff.json` (APPROVED) |
| Security push-review 0 findings | — | `.dadaia/handoff/tauan-games/2026-07-03T165652Z-security-reviewer-celestial-components-push.handoff.json` (commit_sha `23d9631c`) |
| CI do PR verde e merge | `gh pr checks 10` | PR #10 MERGED `fd72604` (GitGuardian + Playwright pass) |

## Drifts

### moon-defs-sem-key

**Description:** As luas históricas de config.js não têm campo `key`; o construtor de
`CelestialBody` exigia `name` E `key` e quebrou o boot na primeira migração.

**Resolution:** `key` virou opcional (paridade com os records antigos — nav/map toleram
`undefined`). Detectado ao vivo via MCP browser antes do smoke.

**Memory updates:** nenhum (detalhe de implementação; documentado aqui).

### cor-espectral-vazando-no-mapa

**Description:** BlackHole/NeutronStar herdavam cor espectral derivada da massa, mudando
a cor do ponto no mapa (antes `undefined`).

**Resolution:** Compactos recebem `color: 0x000000` default — paridade com o mapa.

**Memory updates:** nenhum.

## Memory updates

- `specs/memory/product/games-catalog.md` — Space War adicionado ao catálogo (linha nova
  com pasta, descrição e releases) — feito na CLOSURE conjunta com space-war-campaign-v1.
- `specs/memory/architecture.md` — Degrau 2 (Three.js) agora lista `space-war/` e a
  estrutura da biblioteca `celestial/` — feito na CLOSURE conjunta.
- `specs/memory/tech-stack.md` — sem mudança: a release não tocou dependências (zero
  deps novas; Three.js r165 vendorado inalterado).
- `specs/memory/quality-assurance.md` — sem mudança: harness Playwright existente
  reutilizado (suite nova é conteúdo, não infra).

## Dispositions

| File | Kind | Terminal status | Evidence |
|------|------|-----------------|----------|
| `specs/backlog/space-war-celestial-body-component-library.md` | backlog | `delivered — space-war-celestial-components-v1` | frontmatter `status: delivered` + `release:` (este commit) |

## Backlog returns

- `backlog/ideas.md` ← Magnetar como subclasse distinta de NeutronStar (adiado no SPEC §4).
- `backlog/ideas.md` ← Disco de detritos opcional para WhiteDwarf.

## Archive decision

**MOVE** — `git mv specs/releases/space-war-celestial-components-v1
specs/_archive/releases/space-war-celestial-components-v1` (este commit). ACTIVE.md
devolvido ao incumbente pausado `aero-fighters-world-realism-v1` após a CLOSURE dupla.

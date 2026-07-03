# Closure: Release — space-war-v1

> **Status:** Aprovado
> **Release ID:** space-war-v1
> **Owner:** product-engineer
> **Closed:** 2026-07-03 (retroativo — a release foi entregue em 2026-06-13/14, antes
> da adoção do protocolo de CLOSURE neste repo; este registro foi escrito na varredura
> de arquivamento da CLOSURE dupla de space-war em 2026-07-03)

## Summary

Release fundadora do Space War: simulador de voo espacial 6-DOF em Three.js r165
(vendorado, zero build step) com Sistema Solar completo (Sol + 8 planetas + luas em
escala comprimida), gravidade newtoniana com patched-conics, decolagem da Terra,
combate (laser + nukes), missões de bombardeio, mapa, navegação e skybox galáctico
procedural. Base sobre a qual as releases posteriores (T-WR-13..15, celestial
components, campanha) evoluíram o jogo para 6 sistemas estelares e campanha em fases.

## Tasks completed

27/27 tasks `[x]` em TASKS.md (T-SW-01.. — ondas Fundação → Voo → Combate → Missões →
QA). Commits na história de `main` de 2026-06-13/14 (pré-migração pattern-1 do specs/).

## Validations

| Description | Command | Evidence |
|-------------|---------|----------|
| Smoke + AC suite (AC-01..AC-11 do SPEC) | `npm run test:space-war` | `tests/space-war/smoke.spec.js` — 12 testes, verdes desde a entrega e mantidos verdes por todas as releases posteriores |
| Jogo publicado | GitHub Pages | live via workflow `pages.yml` |

## Drifts

Não rastreados à época (pré-protocolo). A evolução subsequente está nas CLOSUREs de
`space-war-celestial-components-v1` e `space-war-campaign-v1`.

## Memory updates

- `specs/memory/product/games-catalog.md` — linha do Space War adicionada na CLOSURE
  conjunta de 2026-07-03 (o catálogo não tinha sido atualizado na entrega original).

## Dispositions

Sem bugs/backlog associados no formato atual (a release precede o ledger JSONL e o
esquema de intents).

## Backlog returns

Nenhum pendente — os desdobramentos viraram os backlog entries que geraram as releases
seguintes (já entregues e arquivadas).

## Archive decision

**MOVE** — arquivada em `specs/_archive/releases/space-war-v1/` (2026-07-03). Débito
conhecido: o nome `space-war-v1` não segue o canon SemVer (SPEC-DOC-016) — renomear
quebraria referências históricas (memória, CLOSUREs, commits); a reconciliação de
naming é decisão do operador, registrada em `specs/backlog/candidates.md`.

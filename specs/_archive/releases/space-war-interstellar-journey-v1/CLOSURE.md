# Closure: Release — space-war-interstellar-journey-v1

> **Status:** Aprovado
> **Release ID:** space-war-interstellar-journey-v1
> **Owner:** product-engineer
> **Closed:** 2026-07-04

## Summary

Viagem interestelar de verdade entre os sistemas do universo: autopilot contextual
**T/O/Z** com perfil brachistochrone (a = 4D/T², flip no meio, 3–6 min ∝ distância),
corredor galáctico em starfield wrap-infinito de 2 camadas + nebulosas Hα/OIII/reflexão
com paralaxe real, e relatividade REALISTA no shader: aberração da forma APARENTE
(+β), recoloração blackbody T′=δT e beaming δ⁴ por estrela. Bulbo galáctico
equiretangular na direção de Sgr A✦ (Great Rift, janelas de Baade, sem ponto central) e
nave finalmente visível em viagem (jato de plasma duplo em shader, wingtips vermelhas
pulsantes, luz de reflexo). O perfil brachistochrone desta release foi posteriormente
substituído pelo trapezóide 30/40/30 em `space-war-interstellar-experience-v1` (o
CLOSURE de lá documenta a troca); o corredor, a relatividade e o bulbo permanecem
como estão.

## Tasks completed

| Task ID | Description | Final commit |
|---------|-------------|--------------|
| T-IJ-01 | journey.js: perfil brachistochrone puro + autopilot T/O/Z | `17ee071` |
| T-IJ-02 | starfield.js: corredor em chunks hash (2 camadas + nebulosas) | `17ee071` |
| T-IJ-03 | Relatividade: aberração + T′=δT + beaming δ⁴ no shader | `17ee071` |
| T-IJ-04 | Bulbo galáctico no skybox (u = atan2(z,−x)/2π) | `17ee071` |
| T-IJ-05 | Nave visível: jato de plasma, wingtips, luz de reflexo | `17ee071` |
| T-IJ-06 | Unit (perfil) + e2e + suíte completa + QA/security/push/PR/CI | `57d1f06` |

## Validations

| Description | Command | Evidence |
|-------------|---------|----------|
| Unit node 41 checks (perfil brachistochrone x(T)=D, simetria, flip) | `npm run test:space-war:unit` | commit `17ee071` |
| e2e suíte 32/32 (engate/warp/uniforms/chegada/nave) | `npx playwright test tests/space-war/` | `57d1f06` |
| QA end-of-alpha APPROVE 7/7 ACs | — | `.dadaia/handoff/tauan-games/2026-07-04T034631Z-qa-engineer-interstellar-journey-alpha-review.handoff.json` |
| Security push-verdict APPROVE pinado no sha | — | `.dadaia/handoff/tauan-games/2026-07-04T035257Z-security-reviewer-interstellar-journey-push.handoff.json` |
| Merge em main | `gh pr view 16` | merge commit `9b662bb` |

## Drifts

### collision-abort-added-then-reversed

**Description:** O QA rc-1 apontou que o corredor atravessava estrelas sem
consequência; adicionou-se aborto de queima por colisão (PLAN D-1). Duas releases
depois o operador ordenou "Retire a possibilidade de colidirmos com estrelas" — o
aborto foi removido em `space-war-interstellar-experience-v1` (imunidade em viagem).

**Resolution:** Reversão documentada no PLAN D-4 da release experience; este CLOSURE
registra apenas que D-1 nasceu aqui.

**Memory updates:** cobertos pela linha do catálogo (estado atual = viagem imune).

### brachistochrone-superseded

**Description:** O perfil 50/50 (acelera até o meio, freia até o fim) não dava fase de
cruzeiro — o operador pediu 30/40/30 com platô em v_max.

**Resolution:** `journeyProfileTrapezoid` substituiu o perfil em
`space-war-interstellar-experience-v1`; a lei brachistochrone permanece em
`celestial/physics.js` como lei documentada v1 (unit-testada).

**Memory updates:** linha do catálogo descreve o perfil atual (trapezóide).

## Memory updates

- `specs/memory/product/games-catalog.md` — linha Space War reescrita (viagem
  interestelar com relatividade incluída).
- `specs/memory/architecture.md` — Degrau 2 Space War: `journey.js` + `starfield.js`
  adicionados à estrutura (edição única da fila).
- `specs/memory/tech-stack.md` — no change.
- `specs/memory/quality-assurance.md` — no change.

## Dispositions

| File | Kind | Terminal status | Evidence |
|------|------|-----------------|----------|
| `specs/backlog/_archive/space-war-interstellar-journey-v1.md` | backlog | `delivered` + `delivered_in: space-war-interstellar-journey-v1` (arquivado neste CLOSURE) | este CLOSURE + merge `9b662bb` |

Nenhum bug picked nesta release.

## Backlog returns

- `backlog/candidates.md` — sem novos itens desta release.

## Archive decision

**MOVE** — release movida para
`specs/_archive/releases/space-war-interstellar-journey-v1/` via `git mv`.

# Closure: Release — space-war-physics-fidelity-v1

> **Status:** Aprovado
> **Release ID:** space-war-physics-fidelity-v1
> **Owner:** product-engineer
> **Closed:** 2026-07-04

## Summary

Fidelidade física dos objetos compactos ancorada em literatura (30+ referências no
SPEC): pulsar OFUSCANTE com strobe 30 Hz, corona e halo; massas TOV para a estrela de
nêutrons (μ 2.0e12) e hierarquia SMBH real para Sgr A✦ (μ 4.0e13); ISCO em 3rs com
anel de fótons em 2.6rs (geometria EHT); pseudo-potencial Paczyński–Wiita kind-gated
com zona de dano de maré; beaming ~10:1 e L∝M^3.5. Arsenal gravitacional novo:
**[G] bomba traçadora** (infinita, luminosa, trilha — sonda de validação do campo) e
**[H] bomba de Higgs** (poço transiente em `game.wells` consumido por
`computeGravity`, braços de plasma por critério de Roche, mergulho = supernova
garantida com dano em área). Escala de parede: planetas ×10 com μ∝f (v_esc
preservada), luas re-espaçadas com períodos Kepler √(a³/μ), Sol ×5 — a lei de escala
que a release seguinte (true-proportions) veio a REVERTER por ordem do operador; a
reversão está documentada lá, não aqui (este CLOSURE registra o que ESTA release
entregou).

## Tasks completed

| Task ID | Description | Final commit |
|---------|-------------|--------------|
| T-PF-01 | Config/massas TOV/SMBH + disco Sgr A✦ mais tênue | `efb384f` |
| T-PF-02 | NS brilha: light def + núcleo emissivo + corona + halo + strobe 30 Hz | `efb384f` |
| T-PF-03 | Corrente de acreção re-narrada: remanescente → disco do BN | `efb384f` |
| T-PF-04 | Paczyński–Wiita kind-gated + zona de maré + unit test | `efb384f` |
| T-PF-05 | Beaming 0.35/0.85 + lightForMass + assist fade em SOI | `efb384f` |
| T-PF-06 | [G] traçadora gravitacional infinita com trilha | `4b57070` |
| T-PF-07 | [H] bomba de Higgs: wells em computeGravity + Roche + supernova | `4b57070` |
| T-PF-08 | Escala de parede ×10 com μ∝f e períodos Kepler | `82fb088` |
| T-PF-09 | e2e novos + suíte verde + QA + security + push/PR/CI | `c71a736` |

## Validations

| Description | Command | Evidence |
|-------------|---------|----------|
| Unit node: ISCO 3rs, PW, μ∝f, Kepler √(a³/μ) provados como leis | `npm run test:space-war:unit` | commit `82fb088` |
| Suíte e2e Playwright completa verde local + CI | `npx playwright test tests/space-war/` | PR #15 CI verde |
| QA end-of-alpha APPROVE | — | `.dadaia/handoff/tauan-games/2026-07-04T030342Z-qa-engineer-physics-fidelity-alpha-review.handoff.json` |
| Security push-verdict APPROVE pinado no sha empurrado | — | `.dadaia/handoff/tauan-games/2026-07-04T034500Z-security-reviewer-physics-fidelity-push.handoff.json` |
| Merge em main | `gh pr view 15` | merge commit `21f4734` |

## Drifts

### wall-scale-superseded-next-release

**Description:** T-PF-08 (escala de parede ×10) atendia a demanda "planetas maiores"
da rodada; na rodada seguinte o operador esclareceu que queria proporções HONESTAS
(θ = 2R/d) — grandes só NA APROXIMAÇÃO — e mandou reverter a inflação estática.

**Resolution:** Revertido integralmente pela release `space-war-true-proportions-v1`
(bug `space-war-fake-apparent-proportions`). O AC-06 do SPEC desta release carrega
nota SUPERSEDED apontando para lá. Mecanismo μ∝f e a lei de períodos Kepler
SOBREVIVEM — são a base do re-gauge da release seguinte.

**Memory updates:** cobertos pela linha do catálogo (estado atual = proporções
verdadeiras).

## Memory updates

- `specs/memory/product/games-catalog.md` — linha Space War reescrita para o estado
  atual pós-fila (arsenal [G]/[H] incluído).
- `specs/memory/architecture.md` — Degrau 2 Space War: journey/starfield/starlod
  adicionados à estrutura (edição única cobrindo a fila toda).
- `specs/memory/tech-stack.md` — no change: sem dependências novas.
- `specs/memory/quality-assurance.md` — no change: pirâmide inalterada.

## Dispositions

| File | Kind | Terminal status | Evidence |
|------|------|-----------------|----------|
| `specs/backlog/_archive/space-war-physics-fidelity-v1.md` | backlog | `delivered` + `delivered_in: space-war-physics-fidelity-v1` (arquivado neste CLOSURE) | este CLOSURE + merge `21f4734` |

Nenhum bug picked exclusivamente nesta release; os bugs de visual do NS abertos na
época foram resolvidos pelas releases fotométrica e de proporções (dispositions lá).

## Backlog returns

- `backlog/candidates.md` — sem novos itens desta release.

## Archive decision

**MOVE** — release movida para
`specs/_archive/releases/space-war-physics-fidelity-v1/` via `git mv`. `ACTIVE.md`
tratado no fim da fila de closures (volta à release estacionada
`aero-fighters-world-realism-v1`).

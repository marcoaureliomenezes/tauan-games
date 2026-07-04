# Closure: Release — space-war-true-proportions-v1

> **Status:** Aprovado
> **Release ID:** space-war-true-proportions-v1
> **Owner:** product-engineer
> **Closed:** 2026-07-04

## Summary

A reforma de honestidade do universo, do rage-report do operador ("WE ARE SIMULATING
THE SPACE... REVIEW EACH PHOTO"): **θ = 2R/d como a natureza** — a inflação estática
da escala de parede foi REMOVIDA (bloco WALL-SCALE deletado do config) e o tamanho
aparente passa a vir só da distância; a experiência "grande na aproximação" fica por
conta da proximidade real. Sistemas empurrados para ~anos-luz de jogo (centros ×8,
anel 22–27M) com cull universal — de um sistema NÃO se vê os corpos dos outros
(adeus Saturno visível do buraco negro). Buraco negro das referências: rs ×3 (480),
disco ×5 (16k) com estrias espirais de gás e borda branca-quente, anel de fótons
2.6rs, jatos. Estrela de nêutrons das referências: R 90, needles polares finas e
brilhantes, gaiola dipolar, strobe. Remanescente com fade-in por distância (a "bola
de plasma" que pipocava) e corrente de acreção wispy. Em rc-2, dois bugs do
operador: **[G]/[H] mortos no teclado** (mapa de listeners sem as chaves novas +
`?.push` silencioso → registro auto-criado `(listeners[name] ??= []).push(fn)`) e
asserção de atração poço→traçadora convertida para espera-por-condição (runners de
2 cores do CI encolhem tempo de sim).

## Tasks completed

| Task ID | Description | Final commit |
|---------|-------------|--------------|
| T-TP-01 | Config: WALL-SCALE removido; bloco único de proporção verdadeira | `cdf79bd` |
| T-TP-02 | Cull universal + Betelgeuse sem alwaysVisible + glow do solar | `cdf79bd` |
| T-TP-03 | Buraco negro das referências (rs 480, disco 16k, estrias, rim) | `cdf79bd` |
| T-TP-04 | Estrela de nêutrons das referências (R 90, needles, dipolo) | `cdf79bd` |
| T-TP-05 | Remanescente fade por distância + corrente wispy | `cdf79bd` |
| T-TP-06 | Testes por LEIS: sweep angular re-derivado + proportions.spec | `cdf79bd` |
| T-TP-07 | QA + security + push + PR #18 + CI verde | `0e62012` |
| T-TP-08 | Fix [G]/[H] teclado morto (registro auto-criado) + e2e tecla REAL | `33a1df3` |
| T-TP-08b | Asserção poço→traçadora vira espera-por-condição | `0e62012` |

## Validations

| Description | Command | Evidence |
|-------------|---------|----------|
| Unit sweep de honestidade angular (θ = 2R/d; Saturno ≤1.26° da Terra) | `npm run test:space-war:unit` | commit `cdf79bd` |
| e2e `proportions.spec.js` 6/6 (anos-luz invisíveis, BH/NS estrutura, fade) | `npx playwright test tests/space-war/` | PR #18 CI verde |
| e2e `arsenal-keys.spec.js` 3/3 com KEYPRESS REAL | `npx playwright test arsenal-keys` | `33a1df3` |
| QA end-of-alpha + QA rc-2 arsenal-keys APPROVE | — | `.dadaia/handoff/tauan-games/2026-07-04T145001Z-…alpha-review.handoff.json` + `…181518Z-…rc2-arsenal-keys.handoff.json` |
| Security push-verdict APPROVE ×3 (push/push3/push4; final pinado em `0e62012`) | — | `.dadaia/handoff/tauan-games/2026-07-04T183218Z-security-reviewer-true-proportions-push4.handoff.json` |
| Merge em main | `gh pr view 18` | merge commit `a8eb0d3` |

## Drifts

### operator-clarified-size-mandate

**Description:** A demanda anterior "planetas maiores" tinha sido implementada como
inflação estática (escala de parede, T-PF-08). O operador esclareceu que o desejo é
proporção FÍSICA: grande só quando perto, pequeno ao viajar.

**Resolution:** Reversão completa da inflação; μ∝f e Kepler mantidos como mecanismo
de re-gauge. AC-06 do SPEC da physics-fidelity anotado como SUPERSEDED apontando
para esta release.

**Memory updates:** linha do catálogo descreve só o estado atual (θ = 2R/d).

### saturn-law-relaxed

**Description:** O sweep de lei angular exigia Saturno ≤0.7° visto da Terra; a
geometria real do universo do jogo dava 0.97°.

**Resolution:** Lei relaxada para 1.26° (≈16 px de joia — aceitável esteticamente,
ainda honesta). Documentado no unit test.

**Memory updates:** nenhum (detalhe de teste).

### rc2-operator-bugs-absorbed

**Description:** Durante o playtest o operador reportou [G]/[H] mortos e projéteis
sem atração pelos poços (este segundo era o teste, não o jogo).

**Resolution:** T-TP-08/08b absorvidos na release (fix estrutural do registro de
ações + espera-por-condição). Lição: cobertura por chamada de debug ≠ cobertura de
input real — e2e novo usa keypress de verdade.

**Memory updates:** gotcha no atom de QA da workspace-memory do agente.

## Memory updates

- `specs/memory/product/games-catalog.md` — linha Space War reescrita (proporções
  verdadeiras, BH/NS das referências).
- `specs/memory/architecture.md` — sem entrada nova de módulo (reforma dentro dos
  módulos existentes); edição única da fila cobre o estado.
- `specs/memory/tech-stack.md` — no change.
- `specs/memory/quality-assurance.md` — no change.

## Dispositions

| File | Kind | Terminal status | Evidence |
|------|------|-----------------|----------|
| bug `space-war-cross-system-visibility` (JSONL) | bug | `resolved --release space-war-true-proportions-v1` | T-TP-02, commit `cdf79bd` |
| bug `space-war-fake-apparent-proportions` (JSONL) | bug | `resolved --release space-war-true-proportions-v1` | T-TP-01/06, commit `cdf79bd` |
| bug `space-war-blackhole-look-not-approved` (JSONL) | bug | `resolved --release space-war-true-proportions-v1` | T-TP-03; aceito pelo ship público ordenado pelo operador (merge `a8eb0d3`, Pages 2026-07-04) |
| bug `space-war-neutron-star-look-not-approved` (JSONL) | bug | `resolved --release space-war-true-proportions-v1` | T-TP-04; aceito pelo ship público ordenado pelo operador |
| bug `space-war-gravbomb-higgs-keys-dead` (JSONL) | bug | `resolved --release space-war-true-proportions-v1` | T-TP-08, commit `33a1df3` |

## Backlog returns

- `backlog/candidates.md` — varredura completa de e2e por tecla-real para TODAS as
  ações de input (candidato de higiene da rodada).

## Archive decision

**MOVE** — release movida para
`specs/_archive/releases/space-war-true-proportions-v1/` via `git mv`.

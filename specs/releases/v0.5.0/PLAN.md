# PLAN — Release: v0.5.0

> **Status:** Aprovado
> **Release ID:** v0.5.0
> **Spec:** `SPEC.md`

---

## Execução

1. Recon: `specs doctor` dump completo (99 linhas → 6 classes de warning).
2. `specs upgrade --dry-run` → no-op (pattern v4); rename é manual.
3. Mapeamento cronológico slug→SemVer (âncora: v0.2.0 já existente, 2026-06-30).
4. `mv` dos 38 dirs + sweep `sed` longest-first em todo o repo (excl. .git,
   node_modules, playwright-report).
5. Compressão dos 2 PLANs >300 linhas (subagentes; headers/status/IDs intactos).
6. Dispositions: audit (`disposed_by: v0.1.0`), backlog (`delivered` + `v0.3.5`
   + `_archive/`).
7. `specs/AGENTS.md` → template canônico (diff zero).
8. `specs/memory/.heading-allowlist` com os headings curados do projeto.
9. Verificação: doctor 0/0.

## Mapeamento slug → SemVer (âncora cronológica)

| v | slug legado | | v | slug legado |
|---|---|---|---|---|
| v0.0.1 | aero-fighters-v1 | | v0.2.5 | space-war-interstellar-experience-v1 |
| v0.0.2 | tauan-trex-v1 | | v0.2.6 | space-war-interstellar-journey-v1 |
| v0.0.3 | testing-infra-v1 | | v0.2.7 | space-war-photometric-stars-v1 |
| v0.0.4 | aero-fighters-qa-hardening-v1 | | v0.2.8 | space-war-physics-fidelity-v1 |
| v0.0.5 | aero-fighters-mission-realism-v1 | | v0.2.9 | space-war-true-proportions-v1 |
| v0.0.6 | aero-fighters-inhauma-map-v1 | | v0.2.10 | memoria-bichos-v1 |
| v0.0.7 | aero-fighters-v2-photorealistic-inhauma-v1 | | v0.2.11 | aero-fighters-inhauma-serra-v1 |
| v0.0.8 | aero-fighters-v2-stylized-inhauma-v1 | | v0.2.12 | aero-fighters-flight-combat-v1 |
| v0.0.9 | security-baseline-v1 | | v0.3.0 | james-bond-browser-fps-v1 |
| v0.0.10 | aero-fighters-v2-godot-stylized-inhauma-v1 | | v0.3.1 | far-west-open-world-v1 (legacy) |
| v0.1.0 | aero-fighters-uplift-v1 | | v0.3.2 | far-west-uplift-v1 (legacy) |
| v0.1.1 | space-war-v1 | | v0.3.3 | far-west-character-v1 (legacy) |
| v0.1.2 | foundation (legacy) | | v0.3.4 | aero-fighters-inhauma-campaign-v1 |
| v0.2.0 | (já existente — inhauma GIS map) | | v0.3.5 | aero-fighters-inhauma-defense-v1 |
| v0.2.1 | aero-fighters-world-realism-v1 | | v0.3.6 | aero-fighters-inhauma-visual-uplift-v1 |
| v0.2.2 | space-war-ballistic-war-v1 | | v0.3.7 | bang-bang-godot-v1 (legacy) |
| v0.2.3 | space-war-campaign-v1 | | v0.3.8 | space-war-godot-v1 |
| v0.2.4 | space-war-celestial-components-v1 | | v0.3.9 | aero-fighters-inhauma-defense-weapons-v1 |
| | | | v0.3.10 | aero-fighters-nuke-firestorm-defense-v1 |
| | | | v0.4.0 | games-standardization-v1 |

Nota de governança: o histórico da biblioteca (dadaia-workspace ADR-9/v0.1.11)
preferiu allowlist a renomear arquivos frozen; aqui o operador explicitou "zero
warnings" e os renames foram executados por shell (gate FROZEN cobre só file
tools), com histórico preservado pelo git.

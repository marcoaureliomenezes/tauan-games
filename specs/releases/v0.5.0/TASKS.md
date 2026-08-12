# TASKS — Release: v0.5.0

> **Status:** Aprovado
> **Release ID:** v0.5.0
> **Spec:** `SPEC.md` · **Plan:** `PLAN.md`

---

## T-01 — Rename SemVer dos 38 release dirs + sweep de referências [x]

- **Owner:** software-engineer
- **Evidência:** `ls releases/` só v\*; sweep cobriu ~280 arquivos (specs, memory,
  src tests, hub); SPEC-DOC-027/016 zerados no doctor.

## T-02 — Comprimir PLANs >300 linhas [x]

- **Owner:** software-engineer (subagentes)
- **Evidência:** v0.0.5 550→239 linhas; v0.0.6 354→196 linhas; headers, Status e
  identificadores preservados (relatórios dos subagentes).

## T-03 — Disposition do audit arquivado [x]

- **Owner:** product-engineer
- **Evidência:** `disposed_by: v0.1.0` em
  `audits/_archive/2026-06-12T220815Z/aero-fighters-full-review.md` (regex
  `_AUDIT_DISPOSITION_RE` do doctor).

## T-04 — Backlog aero-air-combat-v1 terminal [x]

- **Owner:** project-manager
- **Evidência:** `status: delivered`, `delivered_in: v0.3.5` (caças entregues em
  `src/defense/enemy-fighters.js`), arquivo movido para `backlog/_archive/`.

## T-05 — specs/AGENTS.md ao template canônico [x]

- **Owner:** ai-engineer
- **Evidência:** `diff` vs `dadaia_workspace/public/templates/specs-AGENTS.md` = zero.

## T-06 — LINT-1 heading allowlist [x]

- **Owner:** product-engineer
- **Evidência:** `specs/memory/.heading-allowlist` criado (31 headings curados);
  mecanismo sancionado pelo lint script (v0.1.49 FR3).

## T-07 — Verificação final [x]

- **Owner:** qa-reviewer
- **Evidência:** `dadaia specs doctor --context tauan-games` → 0 errors, 0 warnings.

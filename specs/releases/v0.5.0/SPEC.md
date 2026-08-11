# SPEC — Release: v0.5.0

**Status:** Aprovado
**Release ID:** v0.5.0
**Owner:** product-engineer
**Opened:** 2026-08-10

---

## 1. Problem and context

`dadaia specs doctor` reported 39 warnings on the specs tree (2026-08-10). Root
cause: the dadaia-workspace canon tightened over library upgrades (SemVer release
naming SPEC-DOC-027/016, 300-line PLAN cap SPEC-DOC-005, audit disposition markers
SPEC-DOC-036, terminal backlog statuses SPEC-DOC-031/035, AGENTS.md template hash
TREE-5, memory heading allowlist LINT-1) and this repo's older artifacts were never
migrated. Operator directive: "hard hygiene pass — I don't want any warning."

## 2. Objective

Bring the specs tree to zero doctor errors and zero doctor warnings.

## 3. Scope

- **R-01 — SemVer rename:** all 38 legacy release dirs (active, `legacy/`,
  `_archive/`) renamed to `vX.Y.Z`, chronological mapping anchored on the existing
  v0.2.0; every textual cross-reference swept repo-wide (~280 files touched).
- **R-02 — Oversized PLANs:** v0.0.5 (550→239 lines) and v0.0.6 (354→196),
  headers/status/IDs preserved.
- **R-03 — Audit disposition:** `audits/_archive/2026-06-12T220815Z` marked
  `disposed_by: v0.1.0`.
- **R-04 — Backlog terminal status:** `aero-air-combat-v1` → `status: delivered`,
  `delivered_in: v0.3.5` (enemy fighters shipped in `src/defense/enemy-fighters.js`),
  moved to `backlog/_archive/`.
- **R-05 — TREE-5:** `specs/AGENTS.md` merged to canonical template (byte-identical).
- **R-06 — LINT-1:** `specs/memory/.heading-allowlist` created with the project's
  curated headings (sanctioned extension point, lint-memory-atoms.py v0.1.49 FR3).

## 4. Out of scope

- Content changes to any release's SPEC/PLAN/TASKS beyond compression/rename.
- Touching production code (except pre-existing slug references in test comments,
  swept by R-01).
- The dadaia-workspace library's own specs tree.

## 5. Dependencies and risks

| Risk | Mitigation |
|---|---|
| Renames break historical pointers | Full-repo sed sweep, longest-slug-first; mapping recorded in PLAN.md |
| Frozen-archive renames are normally rejected (library ADR-9 precedent) | Operator explicitly directed zero warnings; renames executed via shell, history preserved in git |
| v0.4.0 (games-standardization) was in flight under legacy slug | Renamed with everything else; ACTIVE.md re-pointed |

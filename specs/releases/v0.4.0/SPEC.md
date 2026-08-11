# SPEC — Release: v0.4.0

**Status:** Draft
**Release ID:** v0.4.0
**Owner:** product-engineer
**Opened:** 2026-08-10

---

## 1. Problem and context

Operator directive (2026-08-10): the game catalog accumulated dead/duplicate/broken
entries and the specs no longer tell the truth:

- **bang-bang** — "trash"; the web version is a byte-level duplicate of far-west
  (only `index.html`, `README.md`, `src/config.js` branding differ — confirmed by
  `diff -rq`). The Godot version (121 MB) was never delivered to standard.
- **far-west** — same game as bang-bang under a wrong name; operator ordered its
  deletion together with bang-bang.
- **speed-run** — both the web (Three.js) and the Godot (VehicleBody3D) versions
  are so bad the operator could not play them. Both need a full audit against
  their memory specs before any restart.
- **james-bond** — the web version is good (operator's son loves it) and is the
  reference product. The Godot version does not correspond to it ("guns, enemies,
  map — whole crap"). The Godot version must be rebuilt as a faithful port of the
  web version.

## 2. Objective

Standardize the catalog: delete bang-bang and far-west everywhere, audit speed-run
(web + godot) and james-bond (godot vs web), and bring the memory/specs back in
sync with reality.

## 3. Scope

- **R-01 — Delete bang-bang (all surfaces):** `src/web-games/bang-bang/`,
  `src/godot/bang-bang/`, `tests/bang-bang/`, root `index.html` card/title,
  `package.json` test script.
- **R-02 — Delete far-west (web):** `src/web-games/far-west/`, `tests/far-west/`,
  memory `specs/memory/product/web-games/far-west/`, and every catalog/stack/
  architecture/QA/constitution reference. Backlog entry `v0.3.1`
  marked `rejected` (backlog entries are never deleted). Dead releases
  (`far-west-*`, `v0.3.7`) moved to `specs/releases/legacy/`.
- **R-03 — Audit speed-run web:** implementation vs
  `specs/memory/product/web-games/speed-run/`; concrete playability killers with
  file:line evidence; prioritized gap list for restart.
- **R-04 — Audit speed-run godot:** same protocol vs
  `specs/memory/product/godot/speed-run/`.
- **R-05 — Audit james-bond godot vs web:** web feature inventory as the porting
  contract; divergence table; what a faithful Godot port must build.
- **R-06 — Memory update:** `games-catalog.md`, `catalog.json`, `index.md`,
  `tech-stack.md`, `architecture.md`, `quality-assurance.md`, `constitution.md`
  reflect the deletions and the audit verdicts (speed-run marked broken/under
  audit; james-bond godot marked as failed port pending rebuild).

## 4. Out of scope

- Rebuilding/fixing speed-run (web or godot) — future release(s), informed by R-03/R-04.
- Rebuilding james-bond in Godot — future release, informed by R-05.
- Touching the active release `v0.3.10`.
- Deleting vendored assets still used by other games (`vendor/` untouched).

## 5. Dependencies and risks

| Risk | Mitigation |
|---|---|
| Another session holds `v0.3.10` in IMPLEMENTATION | This release does not touch aero-fighters paths; advisory presence only |
| Deletions are destructive | Repo is git-tracked; code recoverable from history; specs archived, not deleted |
| james-bond web references far-west in a code comment (`enemy-assets.js`) | Comment updated to drop the dead reference |

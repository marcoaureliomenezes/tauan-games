# SPEC — Release: v0.6.0

**Status:** Aprovado
**Release ID:** v0.6.0
**Owner:** product-engineer
**Opened:** 2026-08-10

---

## 1. Problem and context

Operator directive (2026-08-10): second round of catalog standardization.

- **memoria-bichos, tauan-trex, demolition-ball-fable-5** — ordered deleted.
- **aero-fighters duplication** — the deep review found not two but THREE
  implementations:
  1. `src/web-games/aero-fighters` (web, Three.js) — 21k lines, 76 Playwright
     ACs + 17 Node sims, 5 consecutive approved releases of investment
     (v0.3.4–v0.3.10), canonical source per `v0.3.10/PORT-GODOT.md`.
  2. `src/godot/aero-fighters-v2` (tracked) — 2,233-line skeleton: cannon-only,
     flat terrain (Terrain3D never wired), no audio, stale docs, paused
     2026-06-12, third plan in its slot after two cancelled UE5 attempts.
  3. `src/godot/aero-fighters` (UNTRACKED) — 3-day burst port (2026-07-19..22)
     of the web game: campaign, defense mode, nuke, 15 WAVs, DEM terrain;
     incomplete (no kaiju, no legacy maps), zero committed history, idle 3 weeks.

## 2. Objective

One aero-fighters — the web version, most advanced and most tested — and a
catalog free of the three deleted games.

## 3. Scope

- **R-01 — Delete memoria-bichos, tauan-trex, demolition-ball-fable-5** (code,
  tests, hub cards, npm scripts, memory atoms, catalog/stack/arch/QA/constitution
  refs). Backlog `memoria-bichos-v1` → rejected; release v0.2.10 → legacy/.
- **R-02 — Keep web aero-fighters as the sole implementation.**
- **R-03 — Transfer before delete:** v2's OSM+SRTM geo pipeline
  (`Content/World/*` → `assets/geo/`, `Tools/inhauma-data-fetch.py` +
  `requirements.txt` → `tools/`); web `extract-osm-roads` input paths updated.
- **R-04 — Delete `src/godot/aero-fighters-v2`** (git-tracked → recoverable) +
  its CI workflow, LFS `.gitattributes`, runner-healthcheck workflow.
- **R-05 — Backup + delete the untracked Godot port** → tarball at
  `.dadaia/tmp/aero-port-backup/src-godot-aero-fighters-port-20260810.tar.gz`
  (workspace root) — its ONLY copy was the working tree.
- **R-06 — Memory/spec sync** + doctor 0/0.

## 4. Out of scope

- Editing `repos/tauan-games/AGENTS.md` (gate: law file, operator-only) — its
  Games table still lists Tauan T-Rex and the deleted Godot port; operator must
  update by hand (diff provided in TASKS.md T-06 note).
- Committing anything to git (operator's call).
- Rebuilding speed-run / james-bond-godot (tracked in v0.4.0 audits).

## 5. Dependencies and risks

| Risk | Mitigation |
|---|---|
| Untracked port is irreversible once deleted | 12 MB tarball backup taken BEFORE deletion (path above) |
| Web OSM tooling read v2's pbf | Pipeline moved + paths updated before v2 deletion |
| v2 was LFS-scoped | `.gitattributes` removed with it; geo assets moved as plain files (372 K) |

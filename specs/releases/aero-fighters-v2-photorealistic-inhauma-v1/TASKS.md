# TASKS: Aero Fighters v2 — Photorealistic Inhaúma (MVP v1)

> **Status:** Pending — awaiting SPEC approval
> **Author:** product-engineer (dadaia Labs)
> **Created:** 2026-05-17
> **SPEC:** `specs/releases/aero-fighters-v2-photorealistic-inhauma-v1/SPEC.md`
> **PLAN:** `specs/releases/aero-fighters-v2-photorealistic-inhauma-v1/PLAN.md`
> **Release id:** `aero-fighters-v2-photorealistic-inhauma-v1`

---

## Status note

This is a **scaffold only**. The full task list is composed after both the
SPEC and the PLAN reach `**Status:** Aprovado`. The seed tasks below preview
the first-wave dependencies that will unblock Phase 1 of the PLAN.

## Marker convention (from `dadaia-task-manager` skill)

| Marker | State | Meaning |
|---|---|---|
| `[ ]` | OPEN | task declared, no agent reserved it |
| `[-]` | IN PROGRESS | reserved by an agent; only one allowed per file |
| `[x]` | DONE | implemented, verified, committed |

---

## Seed tasks

- **T-001 [ ] OPEN — Pin exact Cesium for Unreal version after UE 5.5 install.**
  Owner: `game-developer`. Install UE 5.5 (latest stable point release at impl
  start); install Cesium for Unreal latest stable; record exact version string
  + commit SHA into `aero-fighters-v2/Plugins/CesiumForUnreal/.commit-sha`;
  mirror the plugin source into operator-owned `cesium-unreal-pin` repo
  (LD-16). Blocks Phase 2.

- **T-002 [-] IN PROGRESS — Register operator's machine as self-hosted GH runner
  `gpu-rtx3060`.** Owner: `devops-engineer`. Labels:
  `self-hosted,gpu-rtx3060,ue5-builder`. Windows registration first; Linux
  second (WSL2 with GPU passthrough or Linux VM). Verify with a UE5
  compile-check job. Land the GitHub Secret
  `GOOGLE_MAPS_TILES_API_KEY` fetched via
  `op item get "aero-fighters-v2/google-maps-tiles-api-key" --field credential`
  (LD-08, LD-24). Gate-1 fires end of Week 1.
  - T-002 closure pending operator action: runner physical registration. Workflow + doc landed in commit 86d8258. Operator dispatches aero-v2-runner-healthcheck.yml; on green artifact, flip T-002 [x] manually with closing commit `chore(tasks): finish T-002`.

- **T-003 [x] DONE — Source generic delta-wing CC0 mesh; document license.**
  Owner: `game-designer` (hat) + `game-developer`. Search Sketchfab CC0 +
  PolyHaven CC0 filtered to generic delta-wing fighter / no real-world
  likeness; if no acceptable source, hand-model UE5 BP primitive assembly.
  Record source URL + license string in the asset-license table (PLAN
  deliverable). Blocks Phase 3 (FR-V2-04).
  Closure: hand-model path elected after prior CC0 search returned no acceptable sources. See Content/Aircraft/HandModeled.md.

- **T-004 [ ] OPEN — Stand up 5-module UE5 layout with georef seam + CI
  lint.** Owner: `game-developer`. Create modules Core, Georef, Gameplay,
  Combat, Harness with the Build.cs dependency rules from SPEC §10; land
  `IWorldGeoreferenceProvider` + `UCesiumGeorefAdapter`; add the CI lint that
  greps for `#include "Cesium` outside `AeroFightersGeoref/` and fails the
  build (LD-15). Implement round-trip cm-equality test stub (AC-V2-14).
  Blocks all gameplay work.

- **T-005 [ ] OPEN — Create `DA_AeroFightersV2Config` Data Asset with origin
  + spawn coords.** Owner: `game-developer`. CesiumGeoreference origin
  `(-19.47, -44.46, 800.0 m WGS84)` as chart anchor; pawn spawn
  `(-19.47, -44.46, 2095.0 m WGS84)`; AA gun WGS84 `(-19.490, -44.387)`.
  Wire into FTF assertions for AC-V2-02, AC-V2-03, AC-V2-06 (LD-04).

- **T-006 [x] DONE — Pre-author Cesium-isolation lint script (paper).**
  Owner: `game-developer` (lint hat). Authors `aero-fighters-v2/Tools/lint-cesium-isolation.sh` enforcing LD-15 / SPEC §10. CI wiring lands in Wave 2.
  Closure: Vacuous-pass verified. Wave 2 wires into .github/workflows/aero-v2-ci.yml.

- **T-007 [x] DONE — Author AC-V2 traceability matrix (paper).** Owner: `game-developer` (tester hat). Path: `aero-fighters-v2/Tests/AcceptanceCriteria.md`. Maps every AC-V2-XX to test path + method (FTF / Python harness / manual). Filled per Wave by the wave-owning agent.
  Closure: 17 AC rows mapped (AC-V2-01..20 + LOC-W/L), all placeholder Test names for wave-owning agents to fill. Commit a24da73.

- **T-008 [x] DONE — Pre-author screenshot-diff harness skeleton (paper).** Owner: `game-developer` (tester hat). Path: `aero-fighters-v2/Tools/screenshot-diff-harness.py`. Implements SSIM + pHash core, UE5 launch parameterized. Wired into CI in Wave 7.
  Closure: compute_ssim/compute_phash_distance/score_pair/aggregate_results/write_html_report fully implemented; launch_shipping_build_and_capture() stubbed (NotImplementedError, Wave 5). --self-check exits 2 (missing deps) with install instructions. py_compile OK. Commit a24da73.

- **T-009 [x] DONE — Pre-author perf harness skeleton (paper).** Owner: `game-developer` (tester hat). Path: `aero-fighters-v2/Tools/perf-harness.py`. Frame-time series + percentile assertion. UE5 launch parameterized.
  Closure: parse_frame_times_csv/compute_mean_fps/compute_percentile/assert_ac_v2_17/write_html_report fully implemented; run_scripted_flight_and_capture() stubbed (NotImplementedError, Wave 6). --self-check exits 0 (stdlib only, no external deps). py_compile OK. Commit a24da73.

- **T-010 [x] DONE — Pre-author tile-cache populate skeleton (paper).** Owner: `game-developer` (ops hat). Path: `aero-fighters-v2/Tools/tile-cache-populate.py`. Hits Google Map Tiles API for the 20km radius around Inhaúma; populates the offline cache per LD-22 / RR-V2-07. Auth-stubbed until operator key lands.
  Closure: Full argparse CLI (--center-lat/lon, --radius-km, --lod, --output-dir, --max-tiles, --yes, --dry-run). Web Mercator XYZ tile enumeration at LOD 18. Auth guard (exit 2), cost estimate + confirm prompt (--yes skips), per-tile progress, sha256 + byte-size manifest append. requests>=2.31 already in Tools/requirements.txt. py_compile OK, dry-run exits 3.

- **T-011 [x] DONE — Author .env.local.example (paper).** Owner: `game-developer` (ops hat). Path: `aero-fighters-v2/.env.local.example`. Documents GOOGLE_MAPS_TILES_API_KEY + CESIUM_OFFLINE_TILES per SPEC §8.
  Closure: GOOGLE_MAPS_TILES_API_KEY (required), CESIUM_OFFLINE_TILES=1 (default on), CESIUM_TILE_CACHE_DIR (commented default), UE_INSTALL_PATH (commented). 1Password fetch command documented. SPEC §8 referenced.

- **T-012 [x] DONE — Author project README (paper).** Owner: `game-developer` (ops hat). Path: `aero-fighters-v2/README.md`. Operator-facing setup + run instructions.
  Closure: All required sections: title+description, status, prerequisites, first-time setup (7 steps), running, testing, architecture overview, Cesium isolation rule, cost governance, license notice, links, MVP scope reminder.

- **T-013 [x] DONE — Author UE5 .gitignore (paper).** Owner: `game-developer` (ops hat). Path: `aero-fighters-v2/.gitignore`. Standard UE5 ignore list (Binaries/, DerivedDataCache/, Intermediate/, Saved/, etc.).
  Closure: Epic canonical UE5 entries + .env.local / *-tile-cache / Python venv / StagedBuilds / timestamped report artifacts. All entries commented.

- **T-014 [-] IN PROGRESS — Pre-author repo .gitattributes for git-lfs (paper).**
  Owner: `game-developer` (ops hat). Path: `.gitattributes` (repo root of tauan-games). Tracks binary asset types via LFS so future agents don't have to remember per-file.

---

## Conventions

- One `[-]` IN PROGRESS at a time per this file. Pick a task with `[ ] →
  [-]` + commit `chore(tasks): start <task-id>` before any production edit.
- Close with `[-] → [x]` + commit `feat|fix|chore(scope): <message>
  (<task-id>)`.
- Production work in this release is rooted at `repos/tauan-games/aero-fighters-v2/`
  (created by T-004, not in this scaffold).

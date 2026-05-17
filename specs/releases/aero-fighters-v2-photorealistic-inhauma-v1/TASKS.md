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

- **T-003 [-] IN PROGRESS — Source generic delta-wing CC0 mesh; document license.**
  Owner: `game-designer` (hat) + `game-developer`. Search Sketchfab CC0 +
  PolyHaven CC0 filtered to generic delta-wing fighter / no real-world
  likeness; if no acceptable source, hand-model UE5 BP primitive assembly.
  Record source URL + license string in the asset-license table (PLAN
  deliverable). Blocks Phase 3 (FR-V2-04).

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

---

## Conventions

- One `[-]` IN PROGRESS at a time per this file. Pick a task with `[ ] →
  [-]` + commit `chore(tasks): start <task-id>` before any production edit.
- Close with `[-] → [x]` + commit `feat|fix|chore(scope): <message>
  (<task-id>)`.
- Production work in this release is rooted at `repos/tauan-games/aero-fighters-v2/`
  (created by T-004, not in this scaffold).

# PLAN: Aero Fighters v2 — Stylized Inhaúma (MVP-2)

> **Status:** Aprovado — 2026-05-17 (composed alongside approved SPEC after grill-me pivot session)
> **Author:** product-engineer (dadaia Labs)
> **Created:** 2026-05-17
> **SPEC:** `specs/releases/aero-fighters-v2-stylized-inhauma-v1/SPEC.md`
> **TASKS:** `specs/releases/aero-fighters-v2-stylized-inhauma-v1/TASKS.md`
> **Release id:** `aero-fighters-v2-stylized-inhauma-v1`
> **Supersedes:** `aero-fighters-v2-photorealistic-inhauma-v1` (cancelled 2026-05-17 — hardware constraint)
> **Grill input:** `.dadaia/reports/tauan-games/product-engineer/2026-05-17T210822Z-stylized-pivot.html`

---

## 1. Strategy

Wave-based execution on a **single shared working tree**. Each wave fires
multiple game-specialized agents in parallel (fresh context per wave) that
write to non-overlapping file sets. Verification runs between waves; on
green the next wave fires. The Inspiron 15-3511 (Iris Xe G7) is the only
dev box and the only test box. No self-hosted runner, no cloud GPU.

Total **5 implementation waves + Wave 0 (operator bootstrap)** covering 21
seed tasks across 5–6 weeks (ADR-V2-S-03). Wave count compresses from the
cancelled release's 7 waves because: no Cesium isolation seam, no
photoreal calibration sub-runs, no Win/Mac cross-build wave.

Three tasks are already `[x] DONE` via the pivot commit (T-S-03, T-S-13,
T-S-14 — pure carryover verification). Wave 1 starts with 18 open tasks.

---

## 2. Wave Roster

| Wave | Phase | Tasks | Calendar |
|---|---|---|---|
| 0 | Operator bootstrap | UE 5.5 source build + NASA EarthData creds in 1Password | week 0 |
| 1 | Project skeleton + georef + CI | T-S-01, T-S-02, T-S-04, T-S-05, T-S-11 | week 1 |
| 2 | Inhaúma data pipeline + Landscape | T-S-06, T-S-16, T-S-12 | week 2 |
| 3 | Pawn + flight + cel-shader | T-S-10, T-S-15, FR-V2-S-04/05/10/11 | week 3 |
| 4 | Combat + mission system + targets | T-S-19, T-S-20, T-S-17, T-S-18, FR-V2-S-06/07/09 | week 4 |
| 5 | Harness + perf + closure | T-S-07, T-S-08, T-S-09, T-S-21 | weeks 5–6 |

---

## 3. Wave 0 — Operator Bootstrap (BLOCKING)

Operator-driven; no agents fire until every line below is green.

- [ ] UE 5.5 source built or installed on Inspiron 15-3511. Verification:
  `~/UnrealEngine-5.5/Engine/Binaries/Linux/UnrealEditor --version` exits 0.
- [ ] NASA EarthData account created at `https://urs.earthdata.nasa.gov/`
  (free). Credentials stored in 1Password as
  `aero-fighters-v2/nasa-earthdata` with fields `username` + `password`.
- [ ] `op item get "aero-fighters-v2/nasa-earthdata" --field username`
  returns a value.
- [ ] OSM data source pinned: Geofabrik Brazil-southeast extract date
  documented in `aero-fighters-v2/Content/World/SOURCES.md` (created by T-S-06).
- [ ] Git LFS installed locally + on GH-hosted runner: `git lfs version`
  exits 0; `aero-fighters-v2/.gitattributes` patterns match SPEC §8.

Verification commands run before Wave 1 fires:

```bash
~/UnrealEngine-5.5/Engine/Binaries/Linux/UnrealEditor --version
op item get "aero-fighters-v2/nasa-earthdata" --field username >/dev/null
git lfs version
```

All green → Wave 1 spawns.

---

## 4. Wave 1 — Project Skeleton + Georef + CI

**Tasks:** T-S-01, T-S-02, T-S-04, T-S-05, T-S-11. **Calendar:** week 1.

### Parallel agents

**`game-developer`** — owns T-S-01, T-S-04, T-S-05.
- T-S-01: Create UE 5.5 project at `aero-fighters-v2/AeroFightersV2.uproject`
  via UnrealEditor GUI. Project template = **Blank C++**. Configure
  `DefaultEngine.ini` for Forward Shading: `r.ForwardShading=1`,
  `r.SkinCache.CompileShaders=1`, `r.GenerateMeshDistanceFields=0`. Lumen
  OFF, Nanite OFF at project level. Document UE version in
  `aero-fighters-v2/docs/ue-version.md`.
- T-S-04: Create 4 modules under `aero-fighters-v2/Source/`:
  - `AeroFightersCore/` — deps: `Core`, `CoreUObject`. Contains `FGeoCoord.h`,
    `EAeroFlightState.h`, `UAeroFightersV2StylizedConfig.h`, `UInhaumaWorldGeoref.h/.cpp`.
  - `AeroFightersTerrain/` — deps: `Core`, `CoreUObject`, `Engine`,
    `AeroFightersCore`, `Landscape`, `PCG`. Stubs only (Wave 2 fills).
  - `AeroFightersGameplay/` — deps: `Core`, `CoreUObject`, `Engine`,
    `EnhancedInput`, `UMG`, `AeroFightersCore`, `AeroFightersTerrain`.
    Stubs only (Wave 3 fills).
  - `AeroFightersCombat/` — deps: same as Gameplay + `AeroFightersGameplay`.
    Stubs only (Wave 4 fills).
- T-S-05: Create `DA_AeroFightersV2StylizedConfig.uasset` +
  `DA_AeroFightersV2StylizedMissionConfig.uasset` under
  `Content/Data/` with all coords + HP + difficulty coefficients from SPEC §5.

**`devops-engineer`** — owns T-S-02.
- T-S-02: Author `.github/workflows/aero-v2-stylized-ci.yml`. Jobs (GH-hosted
  `ubuntu-latest`): (1) `module-lint` — verify Build.cs deps with a Python
  script; (2) `python-lint` — flake8 on `aero-fighters-v2/Tools/`;
  (3) `lfs-verify` — `git lfs ls-files` non-empty.
- Do NOT add headless FTF in Wave 1 — that needs UE5 on the runner. Defer
  to Wave 5 if at all.

**`game-developer` (ops hat)** — owns T-S-11.
- T-S-11: Rewrite `aero-fighters-v2/.env.local.example`. Drop all Cesium /
  Google entries. Add `NASA_EARTHDATA_USERNAME`, `NASA_EARTHDATA_PASSWORD`,
  `OSM_BBOX_NORTH/SOUTH/EAST/WEST` defaults (±0.20° around Inhaúma WGS84
  `(-19.47, -44.46)`). Reference 1Password item `aero-fighters-v2/nasa-earthdata`.

### Wave 1 verification

```bash
RELEASE=repos/tauan-games/aero-fighters-v2
test -f $RELEASE/AeroFightersV2.uproject
ls $RELEASE/Source/{AeroFightersCore,AeroFightersTerrain,AeroFightersGameplay,AeroFightersCombat}/Build.cs
test -f $RELEASE/Content/Data/DA_AeroFightersV2StylizedConfig.uasset
test -f $RELEASE/Content/Data/DA_AeroFightersV2StylizedMissionConfig.uasset
test -f $RELEASE/.env.local.example && ! grep -q "GOOGLE_MAPS_TILES_API_KEY" $RELEASE/.env.local.example
test -f .github/workflows/aero-v2-stylized-ci.yml
make -C ~/UnrealEngine-5.5 AeroFightersV2Editor -j$(nproc) 2>&1 | tail -3   # compiles
```

All green → Wave 2 fires.

---

## 5. Wave 2 — Inhaúma Data Pipeline + Landscape

**Tasks:** T-S-06, T-S-16, T-S-12. **Calendar:** week 2.

### Parallel agents

**`game-developer` (ops hat)** — owns T-S-06.
- T-S-06: Author `aero-fighters-v2/Tools/inhauma-data-fetch.py`. CLI flags:
  `--center-lat -19.47 --center-lon -44.46 --radius-km 22 --srtm-tiles AUTO
  --output-dir Content/World/ --yes --dry-run`. Steps:
  1. `osmconvert` Brazil-southeast PBF clip → `inhauma-osm.pbf`.
  2. Parse + emit `inhauma-buildings.json` + `inhauma-landuse.json`.
  3. NASA SRTM tile list + download via EarthData (HTTP Basic Auth).
  4. `gdal_merge.py` → single GeoTIFF; reproject to UTM 23S.
  5. Append source revisions to `Content/World/SOURCES.md`.

**`game-developer`** — owns T-S-16.
- T-S-16: After T-S-06 completes, convert `inhauma-heightmap.tif` to
  16-bit PNG via `gdal_translate -ot UInt16 -scale 0 1500 0 65535`. Import
  into UE5 Landscape at origin via UE5 Landscape Import. Centroid +
  resolution verified against SPEC §5 AC-V2-S-02. Document workflow in
  `aero-fighters-v2/docs/landscape-import.md`.

**`game-developer` (ops hat)** — owns T-S-12.
- T-S-12: Rewrite `aero-fighters-v2/README.md`. New sections: prereqs
  (UE 5.5 Linux build, NASA EarthData free login, osmconvert, GDAL),
  first-time setup (7 steps), running (Linux only), testing (FTF + harnesses),
  architecture overview (4 modules), cel-shader notes, OSM ODbL attribution
  block, license notice.

### Wave 2 verification

```bash
RELEASE=repos/tauan-games/aero-fighters-v2
python3 $RELEASE/Tools/inhauma-data-fetch.py --dry-run
test -f $RELEASE/Content/World/inhauma-heightmap.tif
test -f $RELEASE/Content/World/inhauma-buildings.json
ls $RELEASE/Content/Landscape/  # imported Landscape asset
grep -q "ODbL" $RELEASE/README.md  # attribution present
```

All green → Wave 3 fires.

---

## 6. Wave 3 — Pawn + Flight + Cel-Shader

**Tasks:** T-S-10, T-S-15 + FR-V2-S-04/05/10/11. **Calendar:** week 3.

### Parallel agents

**`game-developer`** — owns Pawn + Flight + Cameras + HUD.
- Implement `APlayerPawn` in `AeroFightersGameplay/` (BP-first, derived from
  a thin C++ base). Spawn at `DA_AeroFightersV2StylizedConfig.SpawnLatitude/Longitude/Height`.
- `UFlightArcadeComponent` (BP) implementing FR-V2-S-05 constants ported
  from v1 `config.js`.
- Enhanced Input: `IMC_AeroFightersStylizedMVP` + 8 InputActions per FR-V2-S-10.
- Two cameras: chase (spring-arm) + cockpit; `IA_CycleCamera` swaps.
- `WBP_HUD` (UMG) implementing FR-V2-S-11.

**`game-developer`** — owns T-S-10 (cel-shader).
- Build `M_PP_CelShader.uasset` PostProcess Material per FR-V2-S-12.
  Diffuse step-quantization (3 bands), Sobel-edge outline on depth + normal,
  ×1.15 saturation lift. Calibrate thresholds over ≥ 3 runs; document in
  `docs/cel-shader-calibration.md`.

**`game-designer` (hat)** — owns T-S-15.
- Swap T-S-03 hand-modeled mesh Material to a cel-friendly Material
  (`M_CelAircraft`) that pairs with `M_PP_CelShader`. Material is BP-only.

### Wave 3 verification

```bash
RELEASE=repos/tauan-games/aero-fighters-v2
test -f $RELEASE/Content/Pawn/BP_PlayerPawn.uasset
test -f $RELEASE/Content/PostProcess/M_PP_CelShader.uasset
test -f $RELEASE/docs/cel-shader-calibration.md
# PIE smoke (manual operator step, recorded in commit message)
```

All green → Wave 4 fires.

---

## 7. Wave 4 — Combat + Mission System + Targets

**Tasks:** T-S-17, T-S-18, T-S-19, T-S-20 + FR-V2-S-06/07/09. **Calendar:** week 4.

### Parallel agents

**`game-developer`** — owns T-S-19, T-S-20 + Combat + Crash.
- T-S-19: `UMissionSubsystem` (GameInstance subsystem) per FR-V2-S-08.
- T-S-20: Three target Actors:
  - `AFactoryActor` — HP 20, mega-explosion BP.
  - `ABaseActor` — HP 28, multi-stage destruction (radar then building).
  - `AAAGunClusterActor` — 3 sub-guns @ HP 6, range 220 m, base interval 1.7 s.
- `UCannonComponent` — 12.5 r/s, projectile pool 30, BP base.
- `UCrashDetectorComponent` — samples `ALandscape` ground via the in-Core
  georef utility (no Cesium); crashes on `altitudeDelta < 5 m`.

**`game-developer`** — owns T-S-17, T-S-18.
- T-S-17: `PCG_InhaumaBuildings` graph extruding `inhauma-buildings.json`
  per FR-V2-S-13. Material = `M_CelBuilding`.
- T-S-18: `PCG_InhaumaFoliage` graph scattering low-poly trees on
  `inhauma-landuse.json` per FR-V2-S-14 (≤ 12,000 HISM instances).

**`game-designer` (hat)** — supports targets.
- Hand-author cel-friendly Materials for factory/base/AA cluster meshes
  (own-work, no external assets).

### Wave 4 verification

```bash
RELEASE=repos/tauan-games/aero-fighters-v2
ls $RELEASE/Content/Targets/{BP_Factory,BP_Base,BP_AAGunCluster}.uasset
# PIE: destroy 3 targets → MISSION COMPLETE → next mission spawns
# operator records PIE screenshot evidence
```

All green → Wave 5 fires.

---

## 8. Wave 5 — Harness + Perf + Closure

**Tasks:** T-S-07, T-S-08, T-S-09, T-S-21. **Calendar:** weeks 5–6.

### Parallel agents

**`game-developer` (tester hat)** — owns T-S-07, T-S-08, T-S-09, T-S-21.
- T-S-21: `aero.testMode 1` cvar implementing FR-V2-S-16 determinism override
  set (replaces cancelled SPEC's Lumen-based overrides).
- T-S-08: Re-capture 4 fixed cel-shaded baselines (LFS) at Iris Xe. Update
  thresholds to AC-V2-S-19 (SSIM ≥ 0.78 per cam, mean ≥ 0.84, pHash ≤ 16).
- T-S-09: Repin perf harness assertion message to cite Iris Xe baseline.
  Numbers unchanged (60 FPS mean, 18.5 ms p99).
- T-S-07: Author full AC-V2-S traceability matrix.

**Closure phase (after all Wave 5 green):** `product-engineer` invokes
`dadaia-release-closure` skill — writes `CLOSURE.md` with evidence triples
per AC + flips ACTIVE.md to `phase: shipped` + appends entry to
`specs/memory/architecture.html` (the only spec-memory write authorized
this release).

### Wave 5 verification

```bash
RELEASE=repos/tauan-games/aero-fighters-v2
python3 $RELEASE/Tools/screenshot-diff-harness.py --self-check
python3 $RELEASE/Tools/perf-harness.py --assert-only  # mean ≥ 60, p99 ≤ 18.5
grep -E '^- AC-V2-S-.*\[x\]' $RELEASE/Tests/AcceptanceCriteria.md | wc -l  # all 23
test -f repos/tauan-games/specs/releases/aero-fighters-v2-stylized-inhauma-v1/CLOSURE.md
```

All green → release CLOSURE complete.

---

## 9. Cross-Wave Invariants

1. **Marker hygiene** — agents flip `[ ] → [-]` before any production write
   and `[-] → [x]` after committing. One `[-]` at a time per TASKS.md.
2. **No Cesium** — any `#include "Cesium*` or `UCesium*` reference in
   `Source/` is a CI fail. (Cesium plugin must not be installed in the project.)
3. **v1 untouched** — no agent in any wave modifies `repos/tauan-games/aero-fighters/`.
4. **CC0 only** — no Fab, no Quixel, no Sketchfab non-CC0. Designer audits
   each asset's license in `Content/Aircraft/LICENSE.md`.
5. **Operator-only distribution** — no `make package`, no GitHub Releases,
   no itch.io, no Steam during v2 (deferred to a future release).
6. **Scope errors** — any agent receiving a task outside its scope replies
   `[SCOPE ERROR]` per the workspace rule and refuses.
7. **Commit format** — `feat(<module>): <message> (<task-id>)` for code;
   `chore(tasks): start|finish <task-id>` for marker flips.
8. **Auto-advance gate** — every wave's verification block must exit 0
   before the next wave fires.

---

## 10. Risk Register Actuals (vs SPEC §12)

| Risk | SPEC severity | Wave that closes |
|---|---|---|
| RR-V2-S-01 — SRTM tile gaps at Inhaúma bbox edges | MEDIUM | 2 (T-S-06 logs gaps, allows manual fill) |
| RR-V2-S-02 — OSM data quality (incomplete bldg footprints) | MEDIUM | 4 (PCG filter rejects degenerate polys) |
| RR-V2-S-03 — Cel-shader cost overflows 0.8 ms budget on Iris Xe | HIGH | 3 (T-S-10 calibration runs) |
| RR-V2-S-04 — UE5 Linux Forward Shading + Landscape edge cases | MEDIUM | 5 (perf harness + screenshot-diff) |
| RR-V2-S-05 — Mission system state churn drops FPS | LOW | 4 (BP-first profiling) |
| RR-V2-S-06 — Iris Xe headroom too thin for 60 FPS p99 | HIGH | 5 (final perf gate; fallback = 1024×600 internal) |

---

## 11. Open Questions (deferred until execution)

- **OQ-V2-S-01** — Final cel-shader edge thresholds (depth + normal) —
  resolved during T-S-10 calibration; ≥ 3 runs document final values.
- **OQ-V2-S-02** — Fallback internal resolution if Iris Xe misses 60 FPS
  p99 — 1024×600 candidate; gate fires in Wave 5.
- **OQ-V2-S-03** — Whether to keep cel-shader at fixed-3-bands or expose
  a band-count slider — defer to first operator playtest (post-Wave 3).
- **OQ-V2-S-04** — OSM data refresh cadence — Geofabrik weekly is the
  default; if mid-release data drift breaks tests, pin to a fixed extract date.

---

## 12. Sizing

| Wave | Parallel agents | Sessions est. |
|---|---:|---:|
| 0 (operator) | 0 | 0 |
| 1 | 3 | 1 |
| 2 | 2 | 1 |
| 3 | 3 | 1–2 |
| 4 | 3 | 1–2 |
| 5 | 1 | 1 |
| **Total** | | **5–7 orchestrator sessions** |

Compresses from the cancelled release's 9–12 sessions because of dropped
Cesium scope, dropped Win build, and single-target perf gate.

---

## 13. Final Verification (end-to-end, post-CLOSURE)

```bash
RELEASE=repos/tauan-games/aero-fighters-v2
SPECS=repos/tauan-games/specs

# All ACs marked done
grep -c '^- AC-V2-S-.*\[x\]' $RELEASE/Reports/closure/AC-V2-S-MVP-SUMMARY.html

# Perf gate green on Iris Xe
python3 $RELEASE/Tools/perf-harness.py --assert-only

# Screenshot-diff green on cel-shaded baselines
python3 $RELEASE/Tools/screenshot-diff-harness.py --compare

# v1 still green (parallel evolution)
gh run list --workflow=ci-v1.yml --limit 1 --json conclusion --jq '.[0].conclusion'

# ACTIVE.md flipped to shipped
grep -E 'phase:\s*shipped' $SPECS/releases/ACTIVE.md
```

All green → MVP-2 shipped. v2.1 release opens with Photoreal scope if
RTX 3060 acquired, or further stylized iteration if Iris Xe remains the
only hardware.

# PLAN: Aero Fighters v2 — Photorealistic Inhaúma (MVP v1)

> **Status:** Pending — awaiting SPEC approval
> **Author:** product-engineer (dadaia Labs)
> **Created:** 2026-05-17
> **SPEC:** `specs/releases/aero-fighters-v2-photorealistic-inhauma-v1/SPEC.md`
> **Release id:** `aero-fighters-v2-photorealistic-inhauma-v1`

---

## Status note

This is a **scaffold only**. The full implementation plan is composed after
the SPEC reaches `**Status:** Aprovado` per the workspace SDD hard-stop. The
phase outline below is a one-line preview of the work the full PLAN will
detail.

---

## Phase outline (preview — to be expanded after SPEC approval)

- **Phase 1 — Environment + runners (Week 1).** Install UE 5.5 stable on
  operator's RTX 3060 dev box; install Cesium for Unreal latest stable, pin
  exact commit SHA into `Plugins/CesiumForUnreal/.commit-sha`; register
  self-hosted runner labeled `self-hosted,gpu-rtx3060,ue5-builder` (Windows
  + Linux); land Week-1 setup checklist (LD-20). **Gate-1 fires end of Week 1.**

- **Phase 2 — Georef seam + project skeleton (Week 2).** Create 5-module
  layout (Core, Georef, Gameplay, Combat, Harness); land
  `IWorldGeoreferenceProvider` + `UCesiumGeorefAdapter`; CesiumGeoreference
  actor at origin; CI lint that fails on Cesium symbol leakage; round-trip
  cm-equality test (AC-V2-14); `DA_AeroFightersV2Config` with spawn coords.

- **Phase 3 — Player pawn + arcade flight (Weeks 2–3).** Generic delta-wing
  pawn mesh sourced (hand-modeled or CC0); `UFlightArcadeComponent` (BP first);
  Enhanced Input mapping context + 8 InputActions (LD-07); chase + cockpit
  cameras; basic HUD widgets. AC-V2-03, AC-V2-04, AC-V2-15.

- **Phase 4 — Cesium photoreal terrain + tile cache (Week 3).** CesiumSunSky
  fixed midday; screen-space Lumen Low preset; `MaxTileCacheBytes = 3 GB`;
  offline tile cache via `make tile-cache-populate`; `CESIUM_OFFLINE_TILES=1`
  default in `.env.local`. **Gate-2 fires end of Week 4** (aircraft visible
  + flight working).

- **Phase 5 — Cannon + AA gun + crash detection (Weeks 4–5).**
  `UCannonComponent` at 12.5 r/s with 30-projectile pool; `AAAGunActor` placed
  via `UCesiumGlobeAnchorComponent`; `UCrashDetectorComponent` via Cesium
  analytic ground altitude (no full mesh collision per LD-12); hit / destroy
  events. AC-V2-05, AC-V2-06, AC-V2-07, AC-V2-08, AC-V2-16. **Gate-3 fires
  end of Week 5** (Cesium tiles render @ 60 FPS on Windows).

- **Phase 6 — Determinism harness + screenshot-diff (Weeks 5–6).**
  `aero.testMode 1` cvar + cvar overrides; tile-load gate; Python screenshot
  harness with SSIM + pHash; ≥ 3 calibration runs per platform to lock
  thresholds (currently provisional in SPEC); per-platform baseline capture.
  AC-V2-13, AC-V2-14, AC-V2-18.

- **Phase 7 — Perf gate + local builds (Weeks 6–7).** Python perf harness
  on self-hosted RTX 3060; 60 s scripted flight loop; assert ≥ 60 FPS mean,
  p99 ≤ 18.5 ms; `make build-win-shipping` + `make build-linux-shipping`;
  manual smoke per AC-V2-LOC-W + AC-V2-LOC-L. AC-V2-17.

- **Phase 8 — CI lanes + v1 parity + closure (Weeks 7–8).** `ci-v1.yml`
  preserved verbatim (v1 Playwright stays green); `ci-v2.yml` for UE5
  compile-check + FTF + perf on self-hosted; nightly cron for screenshot-diff
  with GCP-spend gate; tag naming `aero-v2-<semver>`; closure evidence pack
  (BP profile, asset-license table, demo recording). AC-V2-20.

---

## Open questions to close in the full PLAN

See SPEC §14 (OQ-V2-01 through OQ-V2-08).

---

## Cross-references

- Discovery: `.dadaia/reports/product-engineer/2026-05-17T060824Z-game-discovery.html`
- Synthesis: `.dadaia/reports/product-engineer/2026-05-17T063246Z-synthesis-aero-v2.html`
- software-architect: `.dadaia/reports/software-architect/2026-05-17T061546Z-game-arch.html`
- devops-engineer: `.dadaia/reports/devops-engineer/2026-05-17T061638Z-game-devops.html`
- game-developer: `.dadaia/reports/game-developer/2026-05-17T061730Z-gameplay-analysis.html`
- game-designer (hat): `.dadaia/reports/game-designer/2026-05-17T062026Z-design-analysis.html`
- game-tester (hat): `.dadaia/reports/game-tester/2026-05-17T062053Z-acceptance-criteria.html`

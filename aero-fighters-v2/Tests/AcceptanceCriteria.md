# aero-fighters-v2 — Acceptance Criteria Traceability Matrix

> Owns mapping AC-V2-XX → test path → test name → method → owning wave.
> Wave-owning agent fills `Test path` and `Test name` columns when implementing.

| AC ID | Description (one-line) | Method | Test path | Test name | Owning wave | Status |
|---|---|---|---|---|---|---|
| AC-V2-01 | Cesium streams photoreal tiles 20km Inhauma | Manual + screenshot-diff | `Tools/screenshot-diff-harness.py` | (Pose_01..04) | 5 | TODO |
| AC-V2-02 | CesiumGeoreference origin matches DA_AeroFightersV2Config | FTF | `Tests/FTF/Test_FR_V2_02_Origin.cpp` | (Wave 2 fills) | 2 | TODO |
| AC-V2-03 | Pawn spawns ≥500m AGL over Inhaúma | FTF | `Tests/FTF/Test_FR_V2_04_Pawn.cpp` | (Wave 3 fills) | 3 | TODO |
| AC-V2-04 | Arcade flight controls respond ≤1 frame | FTF | `Tests/FTF/Test_FR_V2_05_Flight.cpp` | (Wave 3 fills) | 3 | TODO |
| AC-V2-05 | Cannon 12.5 r/s ± 2% | FTF | `Tests/FTF/Test_FR_V2_06_Cannon.cpp` | (Wave 4 fills) | 4 | TODO |
| AC-V2-06 | Exactly 1 AA gun at known WGS84 | FTF | `Tests/FTF/Test_FR_V2_07_AAGun.cpp` | (Wave 4 fills) | 4 | TODO |
| AC-V2-07 | Cannon hit detection fires within 100ms | FTF | `Tests/FTF/Test_FR_V2_07_AAGun.cpp` | (Wave 4 fills) | 4 | TODO |
| AC-V2-08 | Terrain collision → CRASHED within 200ms | FTF | `Tests/FTF/Test_FR_V2_08_Crash.cpp` | (Wave 4 fills) | 4 | TODO |
| AC-V2-13 | Tile-load gate completes within 30s | FTF | `Tests/FTF/Test_FR_V2_13_TestMode.cpp` | (Wave 5 fills) | 5 | TODO |
| AC-V2-14 | testMode determinism + georef cm round-trip | FTF | `Tests/FTF/Test_FR_V2_13_TestMode.cpp` + `Source/AeroFightersHarness/Tests/GeorefRoundTripTest.cpp` | (Wave 2/5 fill) | 2/5 | TODO |
| AC-V2-16 | AA gun destruction via cumulative cannon hits | FTF | `Tests/FTF/Test_FR_V2_07_AAGun.cpp` | (Wave 4 fills) | 4 | TODO |
| AC-V2-17 | RTX 3060 1080p ≥60 FPS, p99 ≤18.5ms | Perf harness | `Tools/perf-harness.py` | (Wave 6 fills) | 6 | TODO |
| AC-V2-18 | Screenshot-diff vs baselines per platform | Python harness | `Tools/screenshot-diff-harness.py` | (Wave 5 fills) | 5 | TODO |
| AC-V2-19 | BP-to-C++ migration trigger documented | Manual (closure) | `Reports/closure/AC-V2-19.md` | (Wave 6 fills) | 6 | TODO |
| AC-V2-20 | v1 Three.js Playwright suite remains green | Playwright CI | `tests/aero-fighters/` (v1 path) | (existing v1 suite) | 7 | TODO |
| AC-V2-LOC-W | Windows local Shipping build runs | Manual smoke | `Reports/smoke/win-<ts>.md` | (Wave 6 fills) | 6 | TODO |
| AC-V2-LOC-L | Linux local Shipping build runs | Manual smoke | `Reports/smoke/linux-<ts>.md` | (Wave 6 fills) | 6 | TODO |

## How to update this matrix

When an agent implements a test for AC-V2-XX, they edit the corresponding row:
- Replace `(Wave N fills)` placeholder in the `Test name` column with the actual test function name
- Flip `Status` to `WIP`, `PASS`, or `FAIL`

The closure summary `Reports/closure/AC-V2-MVP-SUMMARY.html` (Wave 7) reads this
file as the source of truth for AC coverage.

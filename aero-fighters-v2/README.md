# Aero Fighters v2 — Stylized Inhauma (Godot 4)

Flight-combat game set over a stylized cel-shaded recreation of Inhauma, Minas Gerais.
Built on Godot 4 (Forward+ renderer) with building footprints from OpenStreetMap and
elevation data from the AWS-mirrored SRTM heightmap. No paid APIs, no external
accounts required. The game runs natively on a humble Intel Iris Xe iGPU at 1080p.
Sister project to `aero-fighters/` (Three.js v1, Degrau 2 of the engine ladder).
This is Degrau 3.

---

## Status

**Aprovado 2026-05-18** — see
[`specs/releases/aero-fighters-v2-godot-stylized-inhauma-v1/SPEC.md`](../specs/releases/aero-fighters-v2-godot-stylized-inhauma-v1/SPEC.md)

Wave 1 complete. Wave 2 in progress.

---

## Prerequisites

OS: **Linux x64 only** (Ubuntu 22.04 / 24.04 verified). Windows and macOS exports
are deferred to a future release.

**Godot 4.4 stable (Mono build)**
Download the single `.zip` from https://godotengine.org/download/linux — look for
`Godot_v4.x-stable_mono_linux_x86_64.zip`. Unzip it anywhere. No install command,
no package manager, no root. Run the binary directly:

```bash
unzip Godot_v4.4-stable_mono_linux_x86_64.zip -d ~/godot/
chmod +x ~/godot/Godot_v4.4-stable_mono_linux_x86_64/Godot_v4.4-stable_mono_linux.x86_64
```

The Mono build keeps the GDScript-to-C# promotion path open (NFR-V2-G-05). If you
have the standard build already, add the Mono build alongside — they coexist.

**git + git-lfs** — large binaries (heightmaps, baselines) are tracked via Git LFS.

**Terrain data prep:** `osmium-tool` and `gdal-bin` (apt packages, one-time).

**Python 3 + pip + `requests` + `python-dotenv`** for the `Tools/` scripts.

No NASA account needed. No Google API key. No paid service.

---

## First-time setup

Run these steps once after cloning the repo.

**1.** Clone + enter the game directory: `cd repos/tauan-games/aero-fighters-v2/`

**2.** Pull LFS pointers: `git lfs install && git lfs pull`

**3.** Copy env template and set your Godot binary path:

```bash
cp .env.local.example .env.local
# Edit .env.local — set GODOT_BIN_PATH to the full path of your Godot binary:
# GODOT_BIN_PATH=~/godot/Godot_v4.4-stable_mono_linux_x86_64/Godot_v4.4-stable_mono_linux.x86_64
```

The `OSM_BBOX_*` variables default to the Inhauma region (not secret, leave as-is).
`NASA_EARTHDATA_*` is kept for future optional workflows; not needed for MVP-2.

**4.** Install terrain tools and Python deps:

```bash
sudo apt install osmium-tool gdal-bin python3-pip
pip install -r Tools/requirements.txt
```

---

## Running

**Open in Godot editor:**

```bash
$GODOT_BIN_PATH --path /path/to/repos/tauan-games/aero-fighters-v2/
```

Or launch the Godot project manager and point it at the `aero-fighters-v2/` directory.

**Headless launch (for CI smoke or quick sanity check):**

```bash
$GODOT_BIN_PATH --headless --quit --path /path/to/repos/tauan-games/aero-fighters-v2/
```

**Linux x64 export (post-Wave 5, not yet available):**

```bash
$GODOT_BIN_PATH --export-release "Linux/X11" StagedBuilds/aero-fighters-v2
```

---

## Generating the Inhauma world data

This is a one-time step (or repeated when you change the bounding box). It downloads
OSM building footprints and SRTM elevation tiles and converts them into the formats
Godot and Terrain3D expect.

```bash
cd repos/tauan-games/aero-fighters-v2/
python3 Tools/inhauma-data-fetch.py --yes
```

This tool:

- Downloads the Brazil-southeast OSM extract from Geofabrik (anonymous, no account).
- Clips to the Inhauma bounding box (~19.47 S, ~44.46 W, ±0.20 deg) via osmium-tool.
- Exports building footprints (capped at the 5,000 largest by area) and land-use
  polygons to JSON for GDScript consumption.
- Downloads SRTM 30 m elevation tiles from the **AWS Open Data S3 mirror** at
  `elevation-tiles-prod.s3.amazonaws.com/skadi/` — anonymous public read, no auth.
  These are the same SRTMGL1 v003 bytes that NASA distributes, pre-packaged by Mapzen.
- Assembles tiles into a single GeoTIFF, reprojects to UTM zone 23S, and emits a
  16-bit PNG ready for Terrain3D import.

Outputs land in `Content/World/` and are committed via Git LFS. Source revisions are
recorded in `Content/World/SOURCES.md` for reproducibility.

**After fetching, import into Terrain3D:**

Follow `docs/terrain3d-import.md` (added in Wave 2) to wire the heightmap PNG into
the `Terrain3D` node in `scenes/Main.tscn`.

---

## Project layout

```
aero-fighters-v2/
├── project.godot              # Godot 4 project file — renderer, autoloads, input map
├── scenes/
│   ├── Main.tscn              # Root scene
│   ├── Player.tscn            # Aircraft pawn with chase + cockpit cameras
│   ├── HUD.tscn               # CanvasLayer UI nodes
│   ├── CelShaderPass.tscn     # Fullscreen ColorRect + cel-shader ShaderMaterial
│   └── Targets/
│       ├── factory.tscn
│       ├── base.tscn
│       └── aa_cluster.tscn
├── scripts/                   # GDScript — flight, cannon, crash detector, spawners
├── autoload/                  # Godot Autoload singletons (MissionManager, GameConfig, Telemetry)
├── resources/                 # .tres files (GameConfig, MissionConfig)
├── shaders/                   # .gdshader files (cel screen-space + per-mesh)
├── addons/
│   └── terrain_3d/            # Terrain3D plugin (MIT, TokisanGames)
├── Content/
│   ├── World/                 # LFS: heightmap.tif/.png, buildings.json, osm.pbf, SOURCES.md
│   ├── Aircraft/              # Hand-modeled delta-wing .gltf + HandModeled.md
│   ├── Audio/                 # CC0 WAV/OGG + LICENSE.md
│   └── PostProcess/           # Cel-shader support assets
├── Tools/                     # Python scripts: data fetch, screenshot-diff, perf harness
├── Tests/
│   ├── AcceptanceCriteria.md  # AC-V2-G-XX traceability matrix
│   ├── unit/                  # GUT-style GDScript unit tests
│   └── baselines/linux/       # LFS: cel-shaded screenshot reference baselines
├── docs/                      # Operator docs: godot-version.md, terrain3d-import.md, etc.
└── StagedBuilds/              # gitignored — output of godot --export-release
```

---

## Architecture overview

Five guiding principles from SPEC §10:

- **Scene-tree + Autoload singletons (Godot 4 idiom).** All global state (mission
  cycle, difficulty, config) lives in Autoload GDScript singletons (`MissionManager`,
  `GameConfig`, `Telemetry`). Scenes communicate through signals rather than direct
  node references.

- **GDScript-first with explicit C# promotion triggers (NFR-V2-G-05).** All gameplay
  scripts start as GDScript. Promotion to C# (Godot Mono build) fires when a script
  exceeds 0.30 ms per physics tick or 2.0 ms in aggregate, or any file exceeds 600
  lines. The Mono build is required from day one to keep the promotion path open.

- **Cel-shader via fullscreen ColorRect + StandardMaterial3D Toon mix.** A
  `CanvasLayer` node in `CelShaderPass.tscn` holds a fullscreen `ColorRect` with a
  `ShaderMaterial` that reads the viewport texture and applies diffuse
  step-quantization (3 bands), Sobel-edge outline detection, and a saturation lift.
  Aircraft, buildings, and targets additionally use `StandardMaterial3D` with Toon
  shading enabled for their base look.

- **Terrain3D plugin for SRTM heightmap import.** The Terrain3D addon handles the
  clipmap terrain from the 16-bit PNG produced by the data-fetch pipeline. No custom
  mesh tiling required in the happy path.

- **PCG-equivalent OSM scatter via MultiMeshInstance3D.** Buildings and foliage are
  spawned from JSON at level load by GDScript Autoloads (`building_spawner.gd`,
  `foliage_spawner.gd`) into single-draw-call `MultiMeshInstance3D` nodes. Building
  count is capped at 5,000; foliage at 12,000 — both within Iris Xe budget.

---

## Cel-shader notes

The two-layer cel-shading approach (screen-space pass + per-mesh Toon mix) is
calibrated over at least three runs on Iris Xe at 1080p native. Threshold values
(depth-edge, normal-edge, saturation) are recorded in
`docs/cel-shader-calibration.md` (added in Wave 3). Outline pass cost target is
0.8 ms on Iris Xe at 1080p native.

---

## Testing

Test infrastructure is being built across Waves 2-5. Placeholder locations:

- `Tests/AcceptanceCriteria.md` — traceability matrix for AC-V2-G-01..23 (Wave 2).
- `Tests/unit/` — GUT-style GDScript unit tests, run headless via
  `godot --headless --quit-after 5 --script Tests/unit/run_all.gd`.
- `Tools/screenshot-diff-harness.py` — SSIM + pHash harness against
  `Tests/baselines/linux/` (Wave 5; runs on git tags + nightly cron).
- `Tools/perf-harness.py` — 60 s scripted flight loop; asserts mean >= 60 FPS,
  p99 frame <= 18.5 ms on Iris Xe (Wave 5; operator-local).

The v1 Three.js Playwright suite must remain green throughout:

```bash
cd ../aero-fighters && npx playwright test
```

---

## License and attribution

**This project:** MIT license (operator's choice; see root `LICENSE` file).

**OpenStreetMap data:** Map data copyright OpenStreetMap contributors, licensed
under the Open Database License (ODbL) 1.0.
https://www.openstreetmap.org/copyright
Attribution is required on any product derived from OSM data. The in-game boot
splash and pause menu display "Map data (c) OpenStreetMap contributors, ODbL 1.0".

**SRTM elevation data:** SRTMGL1 v003 produced by NASA/USGS, public domain.
Mirror by Mapzen / AWS Open Data Sponsorship Program.
https://registry.opendata.aws/terrain-tiles/

**Terrain3D addon:** MIT license (TokisanGames). License verified in T-G-16 before
commit. See `addons/terrain_3d/LICENSE.md`.

**In-game art and geometry:** own-work, all CC0-compatible per the foundation's
asset-license policy. CC0 audio assets are attributed individually in
`Content/Audio/LICENSE.md`. Aircraft mesh attestation in
`Content/Aircraft/HandModeled.md`.

---

## Why Godot 4 and not the earlier plans?

Two operator-decided pivots led here (both documented as ADRs in the grill reports):

**Pivot 1 (2026-05-17):** the original photoreal plan using streaming 3D tiles and
a paid mapping API was cancelled due to hardware constraints and cost exposure on the
operator's Iris Xe + Ubuntu 24.04 setup. See the stylized-pivot grill report below.

**Pivot 2 (2026-05-18):** the replacement plan using a different desktop 3D engine
was cancelled mid-Wave-0 when 2+ hours of build attempts confirmed the engine's
source build is fundamentally broken on Ubuntu 24.04 (toolchain mismatches, EOL'd
dependencies, non-idempotent setup). Godot 4 installs from an 80 MB zip with no
toolchain at all. See the godot-pivot grill report below.

The previously-targeted desktop engine is reserved as Degrau 4 of the engine ladder
(ADR-V2-G-02) for a future release when hardware allows. Godot 4 is Degrau 3 and
stays permanently — not a stepping stone.

---

## MVP-2 scope reminder

One mission cycle: spawn airborne over Inhauma, fly arcade (throttle / pitch / roll /
yaw / stall recovery), fire cannon at 12.5 rounds/sec, destroy three target types
(factory HP 20, military base HP 28, AA cluster 3 x HP 6). When all three are
destroyed the next mission cycle begins with HP scaled x1.15 and AA fire rate
scaled x0.92. No save state, no cutscene, no public distribution.

Deferred to v2.1+: missiles, bombs, multiplayer, cockpit-interior graphics, Windows
and macOS exports, itch.io / Steam distribution.

---

## Links

- SPEC: [`specs/releases/aero-fighters-v2-godot-stylized-inhauma-v1/SPEC.md`](../specs/releases/aero-fighters-v2-godot-stylized-inhauma-v1/SPEC.md)
- PLAN: [`specs/releases/aero-fighters-v2-godot-stylized-inhauma-v1/PLAN.md`](../specs/releases/aero-fighters-v2-godot-stylized-inhauma-v1/PLAN.md)
- TASKS: [`specs/releases/aero-fighters-v2-godot-stylized-inhauma-v1/TASKS.md`](../specs/releases/aero-fighters-v2-godot-stylized-inhauma-v1/TASKS.md)
- Grill report (Godot pivot): [`.dadaia/reports/tauan-games/product-engineer/2026-05-18T005834Z-godot-pivot.html`](../../.dadaia/reports/tauan-games/product-engineer/2026-05-18T005834Z-godot-pivot.html)
- Grill report (stylized pivot): [`.dadaia/reports/tauan-games/product-engineer/2026-05-17T210822Z-stylized-pivot.html`](../../.dadaia/reports/tauan-games/product-engineer/2026-05-17T210822Z-stylized-pivot.html)
- v1 sister project: [`aero-fighters/README.md`](../aero-fighters/README.md)

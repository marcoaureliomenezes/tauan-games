# Aero Fighters v2

Photorealistic flight game over Inhaúma MG, UE 5.5 + Cesium for Unreal.

---

## Status

Release: `aero-fighters-v2-photorealistic-inhauma-v1`
Spec: `specs/releases/aero-fighters-v2-photorealistic-inhauma-v1/SPEC.md`
**Status: Aprovado**

MVP scope: operator-only local runs. Public distribution deferred to v2.1.
See SPEC §4 (Non-Goals) and §11 (Build & Local-Run Targets).

---

## Prerequisites

- **Unreal Engine 5.5** — latest stable 5.5.x point release. Install via
  Epic Games Launcher (Windows) or build from source (Linux). UE 5.5
  install path must be reachable by `UnrealBuildTool`. Set `UE_INSTALL_PATH`
  in `.env.local` if it is not in the default location.
- **Cesium for Unreal plugin** — latest stable at impl start; exact version
  pinned in `Plugins/CesiumForUnreal/.commit-sha` (T-001). Install through
  the UE5 Marketplace or copy from the pin repo.
- **Google Map Tiles API key** — operator's personal GCP project, scoped to
  Map Tiles API v1, IP-restricted. Stored in 1Password; see SPEC §8.
- **1Password CLI (`op`)** — for secret fetch:
  `op item get "aero-fighters-v2/google-maps-tiles-api-key" --field credential`
- **git LFS** — large binary assets (baselines, audio WAVs) are tracked via
  LFS. Run `git lfs install` once after cloning.
- **Python 3.11+** — for the harness scripts in `Tools/`. Install deps:
  `pip install -r Tools/requirements.txt`
- **Self-hosted GitHub Actions runner** — `self-hosted,gpu-rtx3060,ue5-builder`
  labels. Setup: `docs/runner-setup-linux.md`.

---

## First-time setup

Follow these steps from a clean checkout.

**1. Install UE 5.5**

Download via Epic Games Launcher or build from source. Record the install
path; set `UE_INSTALL_PATH` in `.env.local` if needed.

**2. Install Cesium for Unreal**

Install the Cesium for Unreal plugin. The exact pinned version is in
`Plugins/CesiumForUnreal/.commit-sha`. If the pin file does not exist yet
(T-001 pending), install the latest stable and record the SHA after install.

**3. Build or populate the offline tile cache**

The offline cache is the default dev workflow (CESIUM_OFFLINE_TILES=1).
This means you spend $0 against the $20/mo GCP cap during normal dev.

```bash
# Dry-run first to see what would be fetched:
python3 Tools/tile-cache-populate.py --dry-run

# Then populate (requires GOOGLE_MAPS_TILES_API_KEY in environment):
source .env.local
python3 Tools/tile-cache-populate.py --yes
```

The cache lands in `~/aero-fighters-v2-tile-cache/` by default.
Override with `--output-dir` or `CESIUM_TILE_CACHE_DIR` in `.env.local`.

**4. Create and fill `.env.local`**

```bash
cp .env.local.example .env.local
# Open .env.local and fill in GOOGLE_MAPS_TILES_API_KEY.
# Fetch from 1Password:
#   op item get "aero-fighters-v2/google-maps-tiles-api-key" --field credential
```

**5. Install Python dependencies**

```bash
pip install -r Tools/requirements.txt
```

**6. Register the self-hosted runner**

Follow `docs/runner-setup-linux.md`. The runner must carry labels
`self-hosted,gpu-rtx3060,ue5-builder` and have the GitHub Secret
`GOOGLE_MAPS_TILES_API_KEY` wired in.

**7. Open the project in UE5**

```bash
# Linux
"$UE_INSTALL_PATH/Engine/Binaries/Linux/UnrealEditor" AeroFightersV2.uproject

# Windows (via Explorer or CLI)
# Double-click AeroFightersV2.uproject
# OR:
# "C:\Program Files\Epic Games\UE_5.5\Engine\Binaries\Win64\UnrealEditor.exe" AeroFightersV2.uproject
```

On first open UE5 will compile shaders. This can take 30–120 s and shows a
black screen — this is expected (RR-V2-10). Do not interrupt it.

---

## Running

Shipping binaries are produced by:

```bash
make build-win-shipping    # Windows x64 — AC-V2-LOC-W
make build-linux-shipping  # Linux x64   — AC-V2-LOC-L (Gate-1 if-slip applies)
```

Output lands in:

```
aero-fighters-v2/Saved/StagedBuilds/Windows/
aero-fighters-v2/Saved/StagedBuilds/Linux/
```

Launch directly from that directory. No installer, no signing. This is
operator-only by design (SPEC §4, O2).

```bash
# Linux
./Saved/StagedBuilds/Linux/AeroFightersV2.sh

# Windows
./Saved/StagedBuilds/Windows/AeroFightersV2.exe
```

---

## Testing

```bash
# UE5 Functional Tests (FTF) — no GPU required, run headless
make ftf

# Screenshot-diff harness (tag + nightly cron; requires packaged Shipping build)
# See Tools/screenshot-diff-harness.py for threshold details (AC-V2-18)
make screenshot-diff

# Performance harness (requires packaged Shipping build + RTX 3060)
# Asserts mean FPS >= 60, p99 frame <= 18.5 ms (AC-V2-17)
make perf
```

The v1 Three.js Playwright suite must remain green throughout:

```bash
cd ../aero-fighters && npx playwright test
```

---

## Architecture overview

5-module UE5 layout (SPEC §10):

```
Source/
  AeroFightersCore/      — sortie SM, FGeoCoord, Data Asset config, math helpers
  AeroFightersGeoref/    — ONLY module allowed to #include "Cesium*"
                           exposes IWorldGeoreferenceProvider port
  AeroFightersGameplay/  — APlayerPawn, UFlightArcadeComponent, HUD, crash detector
  AeroFightersCombat/    — UCannonComponent, AAAGunActor, projectile pool
  AeroFightersHarness/   — testMode cvar, tile-load gate, FTF assertions, CI lint
```

Module dependency: Core <- Georef <- {Gameplay, Combat, Harness}. Gameplay,
Combat, and Harness consume Cesium only through the IWorldGeoreferenceProvider
port — no direct Cesium symbols outside Georef.

---

## Cesium isolation rule

Every contributor must keep Cesium symbols inside `Source/AeroFightersGeoref/`.
The script `Tools/lint-cesium-isolation.sh` enforces this. CI runs it on every
push. A build that leaks `#include "Cesium` outside Georef fails immediately.

```bash
bash Tools/lint-cesium-isolation.sh
```

---

## Cost governance

GCP hard cap: **USD 20 / month** (NFR-V2-02).

- Billing alerts fire at $10 (50%), $15 (75%), $20 (100%) by email.
- `CESIUM_OFFLINE_TILES=1` (default in `.env.local.example`) means dev
  sessions never fetch live tiles.
- The screenshot-diff harness (AC-V2-18) runs only on git tags + nightly
  cron, with a spend gate: if current GCP spend > 80% of the $20 cap, the
  harness skips live fetch automatically.
- Manual cutoff: GCP console → API & Services → Credentials → disable
  the key. This takes ~5 minutes and stops all tile spend immediately.

To check current spend: GCP Billing dashboard → select the aero-fighters-v2
project → view current month's charges for Map Tiles API.

---

## License notice

Photorealistic 3D Tiles are streamed via the operator's personal Google Map
Tiles API key. Google's Terms of Service prohibit redistribution of
Photorealistic 3D Tile data in downloadable binaries without written
authorization from Google (SPEC §4, §11, RR-V2-02). This MVP is
**operator-only, local runs only**. Do not distribute Shipping binaries
that contain or embed tile data.

Aircraft geometry, AA gun geometry, and all procedural assets are own-work.
CC0 audio assets are attributed in `Content/Audio/LICENSE.md`.
Aircraft mesh source and license: `Content/Aircraft/HandModeled.md`.

---

## Links

- Spec: `specs/releases/aero-fighters-v2-photorealistic-inhauma-v1/SPEC.md`
- Plan: `specs/releases/aero-fighters-v2-photorealistic-inhauma-v1/PLAN.md`
- Tasks: `specs/releases/aero-fighters-v2-photorealistic-inhauma-v1/TASKS.md`
- Runner setup: `docs/runner-setup-linux.md`

---

## MVP scope reminder

This release is **operator-only local runs**. The following are explicitly
deferred to v2.1 and beyond:

- Public distribution (GitHub Releases, itch.io, Steam)
- Windows installer signing
- Linux `.deb` / `.AppImage` packaging
- Multiplayer, nuclear FX, missiles, bombs, multiple enemy types
- Full aerodynamic flight model (JSBSim)
- Cockpit/wide-chase/orbit cameras (v2.1+)

The georef seam (SPEC §10, LD-15) makes the path to public distribution a
configuration change rather than a rewrite — contingent on either Google
authorization or a tile-source swap (SPEC §11).

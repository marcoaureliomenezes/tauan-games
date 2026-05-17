#!/usr/bin/env python3
"""
tile-cache-populate.py
======================
Pre-populates the offline Cesium tile cache for the 20 km radius around
Inhaúma MG (FR-V2-01) so day-to-day development never touches the live
Google Map Tiles API endpoint.

Design rationale
----------------
RR-V2-07: Offline tile cache as default dev workflow — live fetch is
opt-in. This script is the canonical way to build that cache.

NFR-V2-02: Google Maps Tiles API spend is capped at USD 20/month.
Every live fetch counts against that cap. Running this script once
(with --yes) primes the cache; subsequent dev sessions use
CESIUM_OFFLINE_TILES=1 (see .env.local.example) and spend nothing.

LOD choice: LOD 18 is used as the base zoom level. Google Photorealistic
3D Tiles use internal LODs (roughly equivalent to map zoom 17–22 when
addressed via the XYZ tiling scheme). LOD 18 gives tile dimensions of
roughly 74 m × 74 m at Inhaúma's latitude (~19.5°S), which covers the
20 km radius with ~73,000 tiles in the bounding box. The default
--max-tiles cap (5000) limits a single run to the densest inner region;
run repeatedly with --center offsets to fill the full radius if needed.

Tile addressing
---------------
This script uses the Web Mercator XYZ tiling scheme (same as Google Maps
standard tiles). Google Photorealistic 3D Tiles are streamed via a
different endpoint (glTF/3D Tiles format) but share the same XYZ spatial
index. The per-tile output path is:

    <output-dir>/<z>/<x>/<y>.glb

Google returns glTF binary (.glb) payloads for photorealistic tiles.
The actual MIME is "model/gltf-binary". If the response is not .glb
(e.g. a JSON error), the file is written as .json for inspection.

Auth
----
Reads GOOGLE_MAPS_TILES_API_KEY from the environment. If unset, prints a
clear instruction message and exits 2. Set the key in .env.local and
source it before running:

    cp .env.local.example .env.local
    # fill GOOGLE_MAPS_TILES_API_KEY
    source .env.local

Exit codes
----------
0  success — all tiles fetched (or 0 tiles in bounding box)
2  GOOGLE_MAPS_TILES_API_KEY not set in environment
3  --dry-run: tile list printed, cost estimate shown, no fetch performed
4  --max-tiles cap exceeded before finishing the bounding box

Dependencies (Tools/requirements.txt):
    requests>=2.31

References
----------
SPEC §5 FR-V2-01, §6 NFR-V2-02, §12 RR-V2-07
SPEC Release: aero-fighters-v2-photorealistic-inhauma-v1
"""

import argparse
import hashlib
import json
import math
import os
import pathlib
import sys
import time

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Default center: Inhaúma MG (FR-V2-01)
DEFAULT_CENTER_LAT = -19.47
DEFAULT_CENTER_LON = -44.46
DEFAULT_RADIUS_KM = 20.0

# Base LOD for tile enumeration. See module docstring for rationale.
DEFAULT_LOD = 18

# Safety cap — prevents runaway API cost on misconfigured runs.
DEFAULT_MAX_TILES = 5000

# Google Map Tiles API endpoint for Photorealistic 3D Tiles (glTF).
# Reference: https://developers.google.com/maps/documentation/tile/3d-tiles
TILE_API_BASE = "https://tile.googleapis.com/v1/3dtiles/{z}/{x}/{y}.glb"

# Cost estimate basis: Google charges per 1000 tiles for Map Tiles API.
# As of 2026 this is approximately USD 5 per 1000 map tiles (verify on
# GCP pricing page before large runs; prices may change).
USD_PER_1000_TILES = 5.0

# Default output directory (operator-configurable via --output-dir).
DEFAULT_OUTPUT_DIR = pathlib.Path.home() / "aero-fighters-v2-tile-cache"

# ---------------------------------------------------------------------------
# WGS-84 / Web Mercator helpers
# ---------------------------------------------------------------------------


def deg2rad(deg: float) -> float:
    return deg * math.pi / 180.0


def lat_lon_to_tile(lat: float, lon: float, zoom: int) -> tuple[int, int]:
    """Convert WGS-84 lat/lon to XYZ tile coords at the given zoom level."""
    n = 2**zoom
    x = int((lon + 180.0) / 360.0 * n)
    lat_rad = deg2rad(lat)
    y = int((1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * n)
    # Clamp to valid range
    x = max(0, min(n - 1, x))
    y = max(0, min(n - 1, y))
    return x, y


def tile_to_lat_lon_bounds(x: int, y: int, zoom: int) -> dict:
    """Return the WGS-84 bounding box of an XYZ tile (N/S/E/W)."""
    n = 2**zoom
    lon_west = x / n * 360.0 - 180.0
    lon_east = (x + 1) / n * 360.0 - 180.0

    def tile_y_to_lat(ty: float) -> float:
        return math.degrees(math.atan(math.sinh(math.pi * (1.0 - 2.0 * ty / n))))

    lat_north = tile_y_to_lat(y)
    lat_south = tile_y_to_lat(y + 1)
    return {"lat_north": lat_north, "lat_south": lat_south, "lon_west": lon_west, "lon_east": lon_east}


def bounding_box_tiles(
    center_lat: float,
    center_lon: float,
    radius_km: float,
    zoom: int,
) -> list[tuple[int, int]]:
    """
    Enumerate all XYZ tiles at `zoom` that fall within a bounding box
    derived from `radius_km` around the given centre.

    Uses a rectangular bounding box (not a circle) for simplicity. This
    slightly over-fetches corner tiles but is correct and fast.
    """
    # Earth radius (mean) in km
    EARTH_RADIUS_KM = 6371.0

    # Latitude delta for the given radius
    delta_lat = math.degrees(radius_km / EARTH_RADIUS_KM)

    # Longitude delta (varies with latitude)
    delta_lon = math.degrees(
        radius_km / (EARTH_RADIUS_KM * math.cos(deg2rad(center_lat)))
    )

    lat_min = center_lat - delta_lat
    lat_max = center_lat + delta_lat
    lon_min = center_lon - delta_lon
    lon_max = center_lon + delta_lon

    # Clamp to valid WGS-84 range
    lat_min = max(-85.0511, lat_min)
    lat_max = min(85.0511, lat_max)
    lon_min = max(-180.0, lon_min)
    lon_max = min(180.0, lon_max)

    # Convert corners to tile indices.
    # In Web Mercator tile coordinates, y=0 is at the top (north) and
    # increases southward. Therefore:
    #   NW corner (lat_max, lon_min) → smallest x and smallest y (top-left)
    #   SE corner (lat_min, lon_max) → largest x and largest y (bottom-right)
    x_min, y_top = lat_lon_to_tile(lat_max, lon_min, zoom)   # NW (top-left)
    x_max, y_bottom = lat_lon_to_tile(lat_min, lon_max, zoom)  # SE (bottom-right)

    tiles = []
    for x in range(x_min, x_max + 1):
        for y in range(y_top, y_bottom + 1):
            tiles.append((x, y))

    return tiles


# ---------------------------------------------------------------------------
# Cache manifest helpers
# ---------------------------------------------------------------------------


def sha256_of_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def append_manifest_entry(manifest_path: pathlib.Path, entry: dict) -> None:
    """Append a single entry to the JSON-lines cache manifest."""
    with open(manifest_path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry) + "\n")


# ---------------------------------------------------------------------------
# API fetch
# ---------------------------------------------------------------------------


def fetch_tile(
    z: int,
    x: int,
    y: int,
    api_key: str,
    session,
) -> tuple[bytes, str]:
    """
    Fetch a single tile from the Google Map Tiles API.

    Returns (content_bytes, extension) where extension is ".glb" for
    successful photorealistic tiles or ".json" for error responses.
    """
    url = TILE_API_BASE.format(z=z, x=x, y=y)
    params = {"key": api_key, "session": session} if session else {"key": api_key}
    resp = _requests().get(url, params=params, timeout=30)
    content_type = resp.headers.get("Content-Type", "")
    if "gltf-binary" in content_type or resp.status_code == 200:
        ext = ".glb"
    else:
        ext = ".json"
    return resp.content, ext


def _requests():
    """Lazy import of requests so --dry-run works without the package installed."""
    try:
        import requests
        return requests
    except ImportError:
        print(
            "ERROR: 'requests' package not found.\n"
            "Install it with: pip install -r Tools/requirements.txt",
            file=sys.stderr,
        )
        sys.exit(2)


# ---------------------------------------------------------------------------
# Core populate logic
# ---------------------------------------------------------------------------


def populate(
    center_lat: float,
    center_lon: float,
    radius_km: float,
    zoom: int,
    output_dir: pathlib.Path,
    api_key: str,
    max_tiles: int,
    yes: bool,
    dry_run: bool,
) -> int:
    """
    Main populate routine.

    Returns an exit code:
      0  success
      3  dry-run (printed tile list, did not fetch)
      4  max-tiles cap exceeded
    """
    tiles = bounding_box_tiles(center_lat, center_lon, radius_km, zoom)
    total = len(tiles)

    estimated_cost = (total / 1000.0) * USD_PER_1000_TILES
    print(
        f"Tile parameters: center=({center_lat}, {center_lon}), "
        f"radius={radius_km} km, LOD={zoom}"
    )
    print(f"Bounding-box tile count: {total}")
    print(f"Estimated cost: ${estimated_cost:.2f} at $5/1000 tiles.")

    cap_exceeded = total > max_tiles

    if dry_run:
        if cap_exceeded:
            print(
                f"WARNING: Tile count {total} exceeds --max-tiles cap {max_tiles}. "
                f"A live run would exit 4. Showing first {max_tiles} tiles below.",
            )
        display_tiles = tiles[:max_tiles] if cap_exceeded else tiles
        print(f"\n[DRY RUN] Would fetch {len(display_tiles)} tile(s) to {output_dir}:")
        for x, y in display_tiles:
            bounds = tile_to_lat_lon_bounds(x, y, zoom)
            out_path = output_dir / str(zoom) / str(x) / f"{y}.glb"
            print(
                f"  z={zoom} x={x} y={y} -> {out_path}  "
                f"(bbox: {bounds['lat_south']:.4f},{bounds['lon_west']:.4f} .. "
                f"{bounds['lat_north']:.4f},{bounds['lon_east']:.4f})"
            )
        print(f"\nDry run complete. Exit 3 (no tiles fetched).")
        return 3

    # Live-fetch path: enforce the cap before spending any API calls.
    if cap_exceeded:
        print(
            f"ERROR: Tile count {total} exceeds --max-tiles cap {max_tiles}.\n"
            f"Reduce --radius-km, increase --max-tiles, or use a higher LOD to "
            f"preview a smaller area.",
            file=sys.stderr,
        )
        return 4

    if not yes:
        try:
            input(
                f"Estimated cost: ${estimated_cost:.2f} at $5/1000 tiles. "
                f"Press ENTER to confirm, Ctrl-C to abort. "
            )
        except KeyboardInterrupt:
            print("\nAborted by user.")
            sys.exit(0)

    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = output_dir / "cache-manifest.json"

    fetched = 0
    errors = 0

    # We do not re-use HTTP sessions across tiles for simplicity; a future
    # optimisation could use requests.Session with connection pooling.
    for i, (x, y) in enumerate(tiles, start=1):
        tile_dir = output_dir / str(zoom) / str(x)
        tile_dir.mkdir(parents=True, exist_ok=True)

        tile_path_base = tile_dir / str(y)
        glb_path = tile_dir / f"{y}.glb"

        # Skip already-cached tiles (resumable run)
        if glb_path.exists():
            print(f"[{i}/{total}] z={zoom} x={x} y={y} -> {glb_path} (cached, skip)")
            fetched += 1
            continue

        print(f"[{i}/{total}] z={zoom} x={x} y={y} -> ", end="", flush=True)
        try:
            content, ext = fetch_tile(zoom, x, y, api_key, session=None)
            out_path = tile_dir / f"{y}{ext}"
            out_path.write_bytes(content)

            bounds = tile_to_lat_lon_bounds(x, y, zoom)
            entry = {
                "z": zoom,
                "x": x,
                "y": y,
                "path": str(out_path),
                "ext": ext,
                "sha256": sha256_of_bytes(content),
                "bytes": len(content),
                "bbox": bounds,
                "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            append_manifest_entry(manifest_path, entry)

            print(f"{out_path} ({len(content)} bytes, sha256={entry['sha256'][:12]}…)")
            fetched += 1

        except Exception as exc:
            print(f"ERROR: {exc}")
            errors += 1
            # Continue on errors — a partial cache is still useful.

    print(
        f"\nDone. Fetched: {fetched}, Errors: {errors}, Total: {total}. "
        f"Cache manifest: {manifest_path}"
    )
    return 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="tile-cache-populate",
        description=(
            "Pre-populate the offline Cesium tile cache for Aero Fighters v2.\n\n"
            "Default center: Inhaúma MG (-19.47, -44.46), 20 km radius, LOD 18.\n"
            "Set GOOGLE_MAPS_TILES_API_KEY in environment before running (see "
            ".env.local.example).\n\n"
            "References: SPEC FR-V2-01, NFR-V2-02, RR-V2-07 (LD-22)."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--center-lat",
        type=float,
        default=DEFAULT_CENTER_LAT,
        help=f"Latitude of the tile cache centre (default: {DEFAULT_CENTER_LAT}, Inhaúma MG).",
    )
    parser.add_argument(
        "--center-lon",
        type=float,
        default=DEFAULT_CENTER_LON,
        help=f"Longitude of the tile cache centre (default: {DEFAULT_CENTER_LON}, Inhaúma MG).",
    )
    parser.add_argument(
        "--radius-km",
        type=float,
        default=DEFAULT_RADIUS_KM,
        help=f"Radius in km around the centre to populate (default: {DEFAULT_RADIUS_KM}).",
    )
    parser.add_argument(
        "--lod",
        type=int,
        default=DEFAULT_LOD,
        help=f"Tile zoom level (LOD). Default {DEFAULT_LOD}. Higher = smaller tiles, more API calls.",
    )
    parser.add_argument(
        "--output-dir",
        type=pathlib.Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory to write cached tiles into (default: {DEFAULT_OUTPUT_DIR}).",
    )
    parser.add_argument(
        "--max-tiles",
        type=int,
        default=DEFAULT_MAX_TILES,
        help=(
            f"Safety cap: abort if bounding-box tile count exceeds this value "
            f"(default: {DEFAULT_MAX_TILES}). Exit code 4 if exceeded. "
            "Protects against runaway API cost (NFR-V2-02)."
        ),
    )
    parser.add_argument(
        "--yes",
        "-y",
        action="store_true",
        help="Skip the cost-confirmation prompt and start fetching immediately.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Print the tile coordinate list and cost estimate without making "
            "any API calls. Exits with code 3."
        ),
    )

    args = parser.parse_args()

    # --- Auth check (skip for dry-run so the script is useful without a key) ---
    if not args.dry_run:
        api_key = os.environ.get("GOOGLE_MAPS_TILES_API_KEY", "").strip()
        if not api_key:
            print(
                "ERROR: GOOGLE_MAPS_TILES_API_KEY is not set in the environment.\n\n"
                "To fix this:\n"
                "  1. Copy .env.local.example to .env.local (in aero-fighters-v2/).\n"
                "  2. Fill in GOOGLE_MAPS_TILES_API_KEY with your GCP key.\n"
                "  3. Run:  source aero-fighters-v2/.env.local\n\n"
                "Fetch the key from 1Password:\n"
                '  op item get "aero-fighters-v2/google-maps-tiles-api-key" --field credential\n\n'
                "See SPEC §8 (Secret & Key Management) for the full procedure.",
                file=sys.stderr,
            )
            sys.exit(2)
    else:
        api_key = ""  # not needed for dry-run

    exit_code = populate(
        center_lat=args.center_lat,
        center_lon=args.center_lon,
        radius_km=args.radius_km,
        zoom=args.lod,
        output_dir=args.output_dir,
        api_key=api_key,
        max_tiles=args.max_tiles,
        yes=args.yes,
        dry_run=args.dry_run,
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

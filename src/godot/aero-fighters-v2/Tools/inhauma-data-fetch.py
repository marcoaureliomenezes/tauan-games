#!/usr/bin/env python3
"""
inhauma-data-fetch.py — OSM + AWS SRTM terrain pipeline for aero-fighters-v2.

Produces terrain and building data for the 20 km radius around Inhaúma MG:
  - Content/World/inhauma-osm.pbf         (clipped OSM extract)
  - Content/World/inhauma-buildings.json  (building polygons, top 5000 by area)
  - Content/World/inhauma-landuse.json    (landuse polygons)
  - Content/World/inhauma-heightmap.tif   (SRTM 30m, UTM 23S, clipped)
  - Content/World/inhauma-heightmap.png   (16-bit PNG for Terrain3D import)
  - Content/World/SOURCES.md             (provenance record)

Data sources (all free, no auth):
  - OSM: Geofabrik Brazil southeast regional PBF (~280MB), CC-licensed
  - SRTM: AWS Open Data mirror https://elevation-tiles-prod.s3.amazonaws.com/skadi/
    Same SRTMGL1 v003 bytes as NASA EarthData; anonymous public read (SPEC §8 amendment).

Dependencies:
  Python packages (pip):
    python-dotenv >= 1.0.0
    requests >= 2.31.0

  System packages (apt):
    osmium-tool   (provides `osmium` binary)
    gdal-bin      (provides gdal_merge.py, gdal_translate, gdalwarp)

Usage:
  python3 Tools/inhauma-data-fetch.py [OPTIONS]

  Options:
    --center-lat FLOAT   WGS84 center latitude  (default: -19.47)
    --center-lon FLOAT   WGS84 center longitude (default: -44.46)
    --radius-km  FLOAT   Radius in km (default: 22; bbox ≈ ±0.20 deg)
    --output-dir PATH    Directory for outputs   (default: Content/World/)
    --yes                Skip interactive confirmation
    --dry-run            Print plan and exit 3 without downloading
    --skip-osm           Skip OSM steps (use if already fetched)
    --skip-srtm          Skip SRTM steps (use if already fetched)
    --export-web-data    Export deterministic web-game GIS modules from local data
    --force              Force re-fetch even if outputs are up to date

Exit codes:
  0  Success (or idempotent up-to-date)
  1  Unexpected error (stack trace printed)
  2  Missing system dependency (osmium or gdal tools)
  3  Dry-run (no action taken)
  4  Bbox / cap parameter out of range

Configuration:
  Reads aero-fighters-v2/.env.local for OSM_BBOX_* defaults (optional).
  CLI flags override .env.local values.

SRTM tile naming:
  SRTM tiles are named by their south-west corner, 1x1 degree, as
  {N|S}{abs_lat:02d}{E|W}{abs_lon:03d}.  Example: south-west corner at
  lat=-20, lon=-45 → S20W045.  AWS path:
  https://elevation-tiles-prod.s3.amazonaws.com/skadi/S20/S20W045.hgt.gz
"""

import argparse
import gzip
import hashlib
import json
import math
import os
import subprocess
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Attempt to import optional dependencies gracefully
# ---------------------------------------------------------------------------
try:
    import requests
except ImportError:
    print(
        "[ERROR] Python package 'requests' not installed. Run: pip install requests",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from dotenv import load_dotenv

    _HAS_DOTENV = True
except ImportError:
    _HAS_DOTENV = False

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
GEOFABRIK_URL = "https://download.geofabrik.de/south-america/brazil/sudeste-latest.osm.pbf"
AWS_SRTM_BASE = "https://elevation-tiles-prod.s3.amazonaws.com/skadi"
SRTM_TILE_DIM = 3601  # samples per side (30m SRTM1 = 1 arc-second)
BUILDING_CAP = 5000
LANDUSE_TAGS = {"forest", "grass", "residential", "industrial", "farmland", "orchard"}
WEB_DRIVABLE_HIGHWAYS = {
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "unclassified",
    "residential",
    "living_street",
    "service",
    "track",
}
WEB_ROAD_WIDTHS = {
    "motorway": 22,
    "motorway_link": 14,
    "trunk": 21,
    "trunk_link": 14,
    "primary": 18,
    "primary_link": 12,
    "secondary": 16,
    "secondary_link": 11,
    "tertiary": 13,
    "tertiary_link": 10,
    "unclassified": 10,
    "residential": 8,
    "living_street": 7,
    "service": 6,
    "track": 5,
}
WEB_ROAD_PRIORITY = {
    "motorway": 90,
    "trunk": 85,
    "primary": 80,
    "secondary": 70,
    "tertiary": 60,
    "unclassified": 45,
    "residential": 35,
    "living_street": 30,
    "service": 25,
    "track": 20,
}
WEB_EXCLUDED_HIGHWAYS = {"footway", "path", "construction", "services"}
WEB_WORLD_SCALE = 0.06
WEB_NODE_SNAP = 8.0
WEB_POINT_MIN_STEP = 5.0

WEB_AIRPORT_ZONES = (
    {"id": "runway-safety", "cx": -560, "cz": 320, "half_x": 82, "half_z": 390},
    {"id": "taxiway-safety", "cx": -560, "cz": 430, "half_x": 48, "half_z": 120},
    {"id": "service-safety", "cx": -560, "cz": 475, "half_x": 70, "half_z": 70},
    {"id": "north-approach", "cx": -560, "cz": -220, "half_x": 125, "half_z": 230},
    {"id": "south-approach", "cx": -560, "cz": 860, "half_x": 125, "half_z": 230},
)

# Metres per degree at Inhauma latitude (approx)
LAT_TO_KM = 111.0  # 1 deg lat ≈ 111 km everywhere
LON_TO_KM_AT_LAT = 111.0 * math.cos(math.radians(-19.47))  # ≈ 104.9 km / deg

# ---------------------------------------------------------------------------
# Dependency checks
# ---------------------------------------------------------------------------


def _require_bin(name: str, hint: str) -> str:
    """Return the binary path or exit 2 with installation instructions."""
    import shutil

    path = shutil.which(name)
    if path is None:
        print(f"[MISSING DEP] '{name}' not found in PATH.", file=sys.stderr)
        print(f"  Install: {hint}", file=sys.stderr)
        print("  This tool cannot continue without it.", file=sys.stderr)
        sys.exit(2)
    return path


def check_system_deps(skip_osm: bool, skip_srtm: bool):
    """Verify all required system binaries are present."""
    if not skip_osm:
        _require_bin("osmium", "sudo apt install osmium-tool")
    if not skip_srtm:
        for name in ("gdal_translate", "gdalwarp"):
            _require_bin(name, "sudo apt install gdal-bin")
        # gdal_merge.py can live anywhere on PATH
        import shutil

        if shutil.which("gdal_merge.py") is None:
            # Try the common gdal-bin location
            candidates = [
                "/usr/bin/gdal_merge.py",
                "/usr/lib/gdal-2/gdal_merge.py",
                "/usr/lib/gdal_merge.py",
            ]
            found = next((c for c in candidates if os.path.isfile(c)), None)
            if found is None:
                print("[MISSING DEP] 'gdal_merge.py' not found.", file=sys.stderr)
                print("  Install: sudo apt install gdal-bin", file=sys.stderr)
                sys.exit(2)
            return  # found via fallback path
    return


def _gdal_merge_path() -> str:
    """Return path to gdal_merge.py."""
    import shutil

    p = shutil.which("gdal_merge.py")
    if p:
        return p
    candidates = [
        "/usr/bin/gdal_merge.py",
        "/usr/lib/gdal-2/gdal_merge.py",
        "/usr/lib/gdal_merge.py",
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return "gdal_merge.py"  # let subprocess fail with a clear message


# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------


def load_config(repo_root: Path) -> dict:
    """Load .env.local if present; return env dict."""
    env_file = repo_root / "aero-fighters-v2" / ".env.local"
    if _HAS_DOTENV and env_file.is_file():
        load_dotenv(env_file, override=False)
    return os.environ.copy()


# ---------------------------------------------------------------------------
# Bbox helpers
# ---------------------------------------------------------------------------


def compute_bbox(center_lat: float, center_lon: float, radius_km: float) -> dict:
    """Compute WGS84 bounding box for a circle of radius_km."""
    delta_lat = radius_km / LAT_TO_KM
    delta_lon = radius_km / LON_TO_KM_AT_LAT
    return {
        "north": center_lat + delta_lat,
        "south": center_lat - delta_lat,
        "east": center_lon + delta_lon,
        "west": center_lon - delta_lon,
    }


def srtm_tiles(bbox: dict) -> list:
    """
    Return list of SRTM tile descriptors covering the bbox.

    SRTM tiles are 1x1 degree, named by their SW corner.
    E.g. lat=-20..lat=-19 and lon=-45..lon=-44 → tile S20W045.
    """
    tiles = []
    south_i = math.floor(bbox["south"])  # inclusive floor
    north_i = math.floor(bbox["north"])  # SW corner of tile containing north edge
    west_i = math.floor(bbox["west"])
    east_i = math.floor(bbox["east"])

    for lat in range(south_i, north_i + 1):
        for lon in range(west_i, east_i + 1):
            lat_str = ("N" if lat >= 0 else "S") + f"{abs(lat):02d}"
            lon_str = ("E" if lon >= 0 else "W") + f"{abs(lon):03d}"
            name = f"{lat_str}{lon_str}"
            subdir = lat_str  # AWS subdir matches the lat prefix
            tiles.append({"name": name, "subdir": subdir, "lat": lat, "lon": lon})
    return tiles


# ---------------------------------------------------------------------------
# Hashing helpers
# ---------------------------------------------------------------------------


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------------------
# HTTP helpers with progress
# ---------------------------------------------------------------------------


def download_file(url: str, dest: Path, resume: bool = True) -> dict:
    """
    Download url → dest, with optional resume support.
    Returns dict with 'etag', 'last_modified'.
    """
    headers = {}
    mode = "wb"
    current_size = 0
    if resume and dest.is_file():
        current_size = dest.stat().st_size
        if current_size > 0:
            headers["Range"] = f"bytes={current_size}-"
            mode = "ab"

    resp = requests.get(url, headers=headers, stream=True, timeout=60)
    if resp.status_code == 416:
        # Server says range not satisfiable → file already complete, verify with HEAD
        resp = requests.head(url, timeout=30)
        return {
            "etag": resp.headers.get("ETag", ""),
            "last_modified": resp.headers.get("Last-Modified", ""),
        }
    resp.raise_for_status()

    if resp.status_code == 200 and mode == "ab":
        # Server ignored Range header, start fresh
        mode = "wb"
        current_size = 0

    total = int(resp.headers.get("Content-Length", 0)) + current_size
    etag = resp.headers.get("ETag", "")
    last_modified = resp.headers.get("Last-Modified", "")

    downloaded = current_size
    print(f"  Downloading: {url}", flush=True)
    with open(dest, mode) as f:
        for chunk in resp.iter_content(1 << 16):
            f.write(chunk)
            downloaded += len(chunk)
            if total > 0:
                pct = 100 * downloaded / total
                print(
                    f"  {pct:5.1f}%  {downloaded >> 20} MB / {total >> 20} MB\r",
                    end="",
                    flush=True,
                )
    print()
    return {"etag": etag, "last_modified": last_modified}


def head_file(url: str) -> dict:
    """Return ETag and Last-Modified via HEAD."""
    resp = requests.head(url, timeout=30)
    resp.raise_for_status()
    return {
        "etag": resp.headers.get("ETag", ""),
        "last_modified": resp.headers.get("Last-Modified", ""),
    }


# ---------------------------------------------------------------------------
# OSM steps
# ---------------------------------------------------------------------------


def fetch_geofabrik_pbf(cache_dir: Path) -> dict:
    """
    Download Brazil-southeast PBF if the cached copy is stale.
    Cache key: HTTP Last-Modified header.
    Returns dict with 'path', 'last_modified'.
    """
    pbf_path = cache_dir / "sudeste.osm.pbf"
    lm_path = cache_dir / "sudeste.last_modified"

    # Check remote Last-Modified
    print("[OSM] Checking Geofabrik PBF…", flush=True)
    meta = head_file(GEOFABRIK_URL)
    remote_lm = meta["last_modified"]

    cached_lm = ""
    if lm_path.is_file():
        cached_lm = lm_path.read_text().strip()

    if pbf_path.is_file() and cached_lm == remote_lm and remote_lm:
        print(f"  Cached PBF up to date (Last-Modified: {remote_lm})", flush=True)
        return {"path": pbf_path, "last_modified": remote_lm}

    print(f"  Cache miss (remote={remote_lm!r}, cached={cached_lm!r})", flush=True)
    result = download_file(GEOFABRIK_URL, pbf_path, resume=True)
    if result["last_modified"]:
        lm_path.write_text(result["last_modified"])
    return {"path": pbf_path, "last_modified": result["last_modified"]}


def clip_pbf(osmium_bin: str, pbf_src: Path, bbox: dict, output: Path):
    """Clip PBF to bbox using osmium extract."""
    bbox_str = f"{bbox['west']},{bbox['south']},{bbox['east']},{bbox['north']}"
    print(f"[OSM] Clipping PBF to bbox {bbox_str}…", flush=True)
    cmd = [
        osmium_bin,
        "extract",
        "--bbox",
        bbox_str,
        "--output",
        str(output),
        "--overwrite",
        str(pbf_src),
    ]
    result = subprocess.run(cmd, check=True, capture_output=True, text=True)
    if result.stderr:
        print(f"  osmium stderr: {result.stderr.strip()}", flush=True)
    size_mb = output.stat().st_size / (1 << 20)
    print(f"  Clipped PBF: {output} ({size_mb:.1f} MB)", flush=True)


# ---------------------------------------------------------------------------
# OSM PBF parsing (buildings + landuse)
# We use osmium's export to geojson rather than pulling osmium python bindings,
# since osmium-tool is the apt dep (not osmium python module which requires
# a separate pip install).  We pipe through osmium tags-filter + osmium export.
# ---------------------------------------------------------------------------


def _osmium_export_json(
    osmium_bin: str, pbf_path: Path, output_json: Path, tags_filter_args: list
) -> bool:
    """
    Filter PBF by tags and export to GeoJSON via osmium.
    Returns True on success.
    """
    # Step 1: filter
    filtered_pbf = output_json.parent / (output_json.stem + "_filtered.osm.pbf")
    cmd_filter = (
        [osmium_bin, "tags-filter", str(pbf_path)]
        + tags_filter_args
        + ["--output", str(filtered_pbf), "--overwrite"]
    )
    subprocess.run(cmd_filter, check=True, capture_output=True, text=True)

    # Step 2: export to geojson
    cmd_export = [
        osmium_bin,
        "export",
        "--geometry-types=polygon",
        "--output-format=geojson",
        "--output",
        str(output_json),
        "--overwrite",
        str(filtered_pbf),
    ]
    result = subprocess.run(cmd_export, capture_output=True, text=True)
    # osmium export may exit nonzero for some warnings; check file exists
    if not output_json.is_file() or output_json.stat().st_size == 0:
        print(f"  osmium export stderr: {result.stderr.strip()}", flush=True)
        return False
    filtered_pbf.unlink(missing_ok=True)
    return True


def _shoelace_area(coords: list) -> float:
    """Approximate polygon area in square degrees via shoelace formula."""
    n = len(coords)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        x1, y1 = coords[i]
        x2, y2 = coords[(i + 1) % n]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def _sq_deg_to_m2(sq_deg: float, lat: float) -> float:
    """
    Convert area in square degrees to approx m2 at given latitude.
    1 deg lat ≈ 111,000 m; 1 deg lon at lat ≈ 111,000*cos(lat) m.
    """
    lat_m = 111_000.0
    lon_m = 111_000.0 * math.cos(math.radians(lat))
    return sq_deg * lat_m * lon_m


def extract_buildings(osmium_bin: str, pbf_path: Path, output_json: Path):
    """
    Parse clipped PBF for building=* ways; output JSON (top 5000 by area).
    """
    print("[OSM] Extracting buildings…", flush=True)
    tmp_geojson = output_json.parent / "_buildings_raw.geojson"

    ok = _osmium_export_json(osmium_bin, pbf_path, tmp_geojson, ["w/building"])
    if not ok:
        print(
            "  Warning: osmium export produced no output. Creating empty buildings list.",
            flush=True,
        )
        output_json.write_text("[]")
        return

    with open(tmp_geojson, "r", encoding="utf-8") as f:
        geojson = json.load(f)

    features = geojson.get("features", [])
    buildings = []
    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        if geom.get("type") not in ("Polygon", "MultiPolygon"):
            continue
        if "building" not in props:
            continue

        # Extract outer ring (first ring of first polygon)
        if geom["type"] == "Polygon":
            outer = geom["coordinates"][0]
        else:
            outer = geom["coordinates"][0][0]

        # GeoJSON coords are [lon, lat]
        polygon_wgs84 = [[c[1], c[0]] for c in outer]  # convert to [lat, lon]
        centroid_lat = sum(c[0] for c in polygon_wgs84) / len(polygon_wgs84)

        # Compute area
        sq_deg = _shoelace_area([[c[1], c[0]] for c in polygon_wgs84])
        area_m2 = _sq_deg_to_m2(sq_deg, centroid_lat)

        try:
            levels = int(props.get("building:levels", 3))
        except (ValueError, TypeError):
            levels = 3
        levels = max(1, levels)

        buildings.append(
            {
                "id": int(props.get("@osmId", 0)),
                "polygon_wgs84": polygon_wgs84,
                "levels": levels,
                "area_m2": area_m2,
            }
        )

    # Sort by area descending, cap at BUILDING_CAP
    buildings.sort(key=lambda b: b["area_m2"], reverse=True)
    buildings = buildings[:BUILDING_CAP]

    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(buildings, f, separators=(",", ":"))

    tmp_geojson.unlink(missing_ok=True)
    print(f"  Buildings written: {len(buildings)} (capped at {BUILDING_CAP})", flush=True)


def extract_landuse(osmium_bin: str, pbf_path: Path, output_json: Path):
    """
    Parse clipped PBF for landuse polygons; output JSON.
    """
    print("[OSM] Extracting landuse…", flush=True)
    tmp_geojson = output_json.parent / "_landuse_raw.geojson"

    tag_filters = [
        "w/landuse=forest",
        "w/landuse=grass",
        "w/landuse=residential",
        "w/landuse=industrial",
        "w/landuse=farmland",
        "w/landuse=orchard",
    ]
    ok = _osmium_export_json(osmium_bin, pbf_path, tmp_geojson, tag_filters)

    if not ok:
        print(
            "  Warning: osmium export produced no landuse output. Creating empty list.", flush=True
        )
        output_json.write_text("[]")
        return

    with open(tmp_geojson, "r", encoding="utf-8") as f:
        geojson = json.load(f)

    features = geojson.get("features", [])
    landuse_list = []
    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        lu_type = props.get("landuse", "")
        if lu_type not in LANDUSE_TAGS:
            continue
        if geom.get("type") not in ("Polygon", "MultiPolygon"):
            continue

        if geom["type"] == "Polygon":
            outer = geom["coordinates"][0]
        else:
            outer = geom["coordinates"][0][0]

        polygon_wgs84 = [[c[1], c[0]] for c in outer]
        landuse_list.append(
            {
                "id": int(props.get("@osmId", 0)),
                "type": lu_type,
                "polygon_wgs84": polygon_wgs84,
            }
        )

    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(landuse_list, f, separators=(",", ":"))

    tmp_geojson.unlink(missing_ok=True)
    print(f"  Landuse entries written: {len(landuse_list)}", flush=True)


# ---------------------------------------------------------------------------
# Web-game deterministic export
# ---------------------------------------------------------------------------


def _local_point(
    lon: float, lat: float, origin_lat: float, origin_lon: float, scale: float = WEB_WORLD_SCALE
) -> dict:
    """Project WGS84 lon/lat to compressed game coordinates."""
    x = (lon - origin_lon) * LON_TO_KM_AT_LAT * 1000.0 * scale
    z = (lat - origin_lat) * LAT_TO_KM * 1000.0 * scale
    return {"x": round(x, 1), "z": round(z, 1)}


def _point_in_airport_exclusion(p: dict) -> bool:
    for zone in WEB_AIRPORT_ZONES:
        if (
            abs(p["x"] - zone["cx"]) <= zone["half_x"]
            and abs(p["z"] - zone["cz"]) <= zone["half_z"]
        ):
            return True
    return False


def _segment_hits_airport(a: dict, b: dict) -> bool:
    steps = max(3, int(math.ceil(math.hypot(b["x"] - a["x"], b["z"] - a["z"]) / 12)))
    for i in range(steps + 1):
        t = i / steps
        p = {"x": a["x"] + (b["x"] - a["x"]) * t, "z": a["z"] + (b["z"] - a["z"]) * t}
        if _point_in_airport_exclusion(p):
            return True
    return False


def _polyline_length(points: list) -> float:
    total = 0.0
    for i in range(1, len(points)):
        total += math.hypot(
            points[i]["x"] - points[i - 1]["x"], points[i]["z"] - points[i - 1]["z"]
        )
    return total


def _simplify_points(points: list) -> list:
    if len(points) <= 2:
        return points
    simplified = [points[0]]
    for p in points[1:-1]:
        last = simplified[-1]
        if math.hypot(p["x"] - last["x"], p["z"] - last["z"]) >= WEB_POINT_MIN_STEP:
            simplified.append(p)
    if simplified[-1] != points[-1]:
        simplified.append(points[-1])
    return simplified


def _split_airport_safe_segments(points: list) -> list:
    parts = []
    current = []
    for p in points:
        if _point_in_airport_exclusion(p):
            if len(current) >= 2:
                parts.append(current)
            current = []
            continue
        if current and _segment_hits_airport(current[-1], p):
            if len(current) >= 2:
                parts.append(current)
            current = [p]
        else:
            current.append(p)
    if len(current) >= 2:
        parts.append(current)
    return parts


def _canonical_ref(ref: str) -> str:
    if not ref:
        return ""
    return ref.lower().replace(" ", "-").replace(";", "-").replace("/", "-")


def _snap_node_id(p: dict) -> str:
    sx = int(round(p["x"] / WEB_NODE_SNAP))
    sz = int(round(p["z"] / WEB_NODE_SNAP))
    return f"n{sx}_{sz}"


def _road_sort_key(edge: dict) -> tuple:
    priority = WEB_ROAD_PRIORITY.get(edge["kind"].replace("_link", ""), 10)
    ref_score = 20 if edge.get("ref") else 0
    return (-priority - ref_score, -edge["length"], edge["id"])


def _osmium_export_lines(
    osmium_bin: str, pbf_path: Path, output_geojson: Path, tags_filter_args: list
):
    filtered_pbf = output_geojson.parent / (output_geojson.stem + "_filtered.osm.pbf")
    cmd_filter = (
        [osmium_bin, "tags-filter", str(pbf_path)]
        + tags_filter_args
        + ["--output", str(filtered_pbf), "--overwrite"]
    )
    subprocess.run(cmd_filter, check=True, capture_output=True, text=True)
    cmd_export = [
        osmium_bin,
        "export",
        "--geometry-types=linestring",
        "--output-format=geojson",
        "--output",
        str(output_geojson),
        "--overwrite",
        str(filtered_pbf),
    ]
    subprocess.run(cmd_export, check=True, capture_output=True, text=True)
    filtered_pbf.unlink(missing_ok=True)


def _js_module(name: str, value) -> str:
    return (
        f"export const {name} = {json.dumps(value, ensure_ascii=False, separators=(',', ':'))};\n"
    )


def _deterministic_web_generated_at(source_hash: str) -> str:
    return f"deterministic:{source_hash[:16]}"


def export_web_data(
    osmium_bin: str,
    pbf_path: Path,
    output_dir: Path,
    origin_lat: float,
    origin_lon: float,
    scale: float,
):
    """Export static ES modules consumed by the Three.js web map."""
    print("[WEB] Exporting deterministic Inhauma web map data…", flush=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    tmp_geojson = output_dir / "_web_roads_raw.geojson"
    _osmium_export_lines(osmium_bin, pbf_path, tmp_geojson, ["w/highway"])

    with open(tmp_geojson, "r", encoding="utf-8") as f:
        geojson = json.load(f)

    raw_features = geojson.get("features", [])
    nodes = {}
    edges = []
    named = {}
    skipped_airport_segments = 0
    skipped_kind = 0
    source_hash = sha256_file(pbf_path)

    for feature_index, feat in enumerate(raw_features):
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        kind = str(props.get("highway", ""))
        if kind in WEB_EXCLUDED_HIGHWAYS or kind not in WEB_DRIVABLE_HIGHWAYS:
            skipped_kind += 1
            continue
        if geom.get("type") != "LineString":
            continue
        coords = geom.get("coordinates", [])
        if len(coords) < 2:
            continue
        points = _simplify_points(
            [
                _local_point(float(lon), float(lat), origin_lat, origin_lon, scale)
                for lon, lat in coords
            ]
        )
        for part_index, part in enumerate(_split_airport_safe_segments(points)):
            if len(part) < 2:
                continue
            if len(part) != len(points):
                skipped_airport_segments += 1
            length = _polyline_length(part)
            if length < 18:
                continue
            node_ids = []
            for p in part:
                node_id = _snap_node_id(p)
                if node_id not in nodes:
                    nodes[node_id] = {"id": node_id, "x": p["x"], "z": p["z"]}
                if not node_ids or node_ids[-1] != node_id:
                    node_ids.append(node_id)
            if len(node_ids) < 2:
                continue
            osm_id = str(props.get("@id") or props.get("@osmId") or feature_index)
            ref = str(props.get("ref", ""))
            edge = {
                "id": f"osm-{feature_index}-{part_index}",
                "osmId": osm_id,
                "kind": kind,
                "ref": ref,
                "name": str(props.get("name", "")),
                "surface": str(props.get("surface", "")),
                "oneway": str(props.get("oneway", "")),
                "width": WEB_ROAD_WIDTHS.get(kind, 8),
                "lanes": max(
                    1,
                    (
                        int(str(props.get("lanes", "2")).split(";")[0])
                        if str(props.get("lanes", "2")).split(";")[0].isdigit()
                        else 2
                    ),
                ),
                "length": round(length, 1),
                "nodes": node_ids,
            }
            edges.append(edge)
            canon = _canonical_ref(ref)
            if canon:
                named.setdefault(canon, []).extend(part)

    # Keep deterministic order and stable diagnostics.
    edges.sort(key=_road_sort_key)
    node_list = sorted(nodes.values(), key=lambda n: n["id"])
    road_graph = {"nodes": node_list, "edges": edges}
    named_routes = {}
    for key, pts in named.items():
        if len(pts) >= 2:
            named_routes[key] = pts[:1400]

    metadata = {
        "source": "inhauma-osm-pbf-web-export-v1",
        "generatedAt": _deterministic_web_generated_at(source_hash),
        "input": "aero-fighters-v2/Content/World/inhauma-osm.pbf",
        "inputSha256": source_hash,
        "origin": {"lat": origin_lat, "lon": origin_lon},
        "worldScale": scale,
        "axis": "x=east,z=north",
        "rawRoadFeatureCount": len(raw_features),
        "edgeCount": len(edges),
        "nodeCount": len(node_list),
        "skippedKindCount": skipped_kind,
        "airportClippedSegmentCount": skipped_airport_segments,
        "airportExclusionZones": [
            {
                "id": zone["id"],
                "cx": zone["cx"],
                "cz": zone["cz"],
                "halfW": zone["half_x"],
                "halfL": zone["half_z"],
            }
            for zone in WEB_AIRPORT_ZONES
        ],
    }
    projection = {
        "originLat": origin_lat,
        "originLon": origin_lon,
        "latMetersPerDegree": LAT_TO_KM * 1000.0,
        "lonMetersPerDegree": LON_TO_KM_AT_LAT * 1000.0,
        "worldScale": scale,
        "axis": "x=east,z=north",
    }

    (output_dir / "projection.js").write_text(
        _js_module("INHAUMA_PROJECTION", projection), encoding="utf-8"
    )
    (output_dir / "metadata.js").write_text(
        _js_module("INHAUMA_WEB_MAP_METADATA", metadata), encoding="utf-8"
    )
    (output_dir / "roads.js").write_text(
        _js_module("INHAUMA_OSM_ROAD_GRAPH", road_graph)
        + _js_module("INHAUMA_OSM_NAMED_ROUTES", named_routes),
        encoding="utf-8",
    )
    tmp_geojson.unlink(missing_ok=True)
    print(f"  Web roads written: {len(edges)} edges, {len(node_list)} snapped nodes", flush=True)
    print(f"  Output: {output_dir}", flush=True)


# ---------------------------------------------------------------------------
# SRTM steps
# ---------------------------------------------------------------------------


def fetch_srtm_tile(tile: dict, cache_dir: Path) -> dict:
    """
    Fetch a single SRTM .hgt.gz tile from AWS Open Data (anonymous).
    Cache in cache_dir.
    Returns dict with 'gz_path', 'hgt_path', 'etag'.
    """
    name = tile["name"]
    subdir = tile["subdir"]
    gz_name = f"{name}.hgt.gz"
    url = f"{AWS_SRTM_BASE}/{subdir}/{gz_name}"
    gz_path = cache_dir / gz_name
    hgt_path = cache_dir / f"{name}.hgt"

    print(f"[SRTM] Fetching tile {name}…", flush=True)
    if gz_path.is_file() and gz_path.stat().st_size > 0:
        # Check ETag
        try:
            meta = head_file(url)
            remote_etag = meta["etag"].strip('"')
        except Exception:
            remote_etag = ""
        # If file exists and we have cached etag, compare
        etag_path = cache_dir / f"{name}.etag"
        cached_etag = etag_path.read_text().strip() if etag_path.is_file() else ""
        if cached_etag and cached_etag == remote_etag:
            print(f"  Cached tile up to date: {gz_path}", flush=True)
        else:
            result = download_file(url, gz_path, resume=False)
            etag = result["etag"].strip('"')
            if etag:
                etag_path.write_text(etag)
    else:
        result = download_file(url, gz_path, resume=False)
        etag = result["etag"].strip('"')
        etag_path = cache_dir / f"{name}.etag"
        if etag:
            etag_path.write_text(etag)

    # Decompress to .hgt
    print(f"  Decompressing {gz_name}…", flush=True)
    with gzip.open(gz_path, "rb") as gz_f:
        raw = gz_f.read()
    with open(hgt_path, "wb") as hgt_f:
        hgt_f.write(raw)

    etag_path = cache_dir / f"{name}.etag"
    etag = etag_path.read_text().strip() if etag_path.is_file() else ""

    return {"gz_path": gz_path, "hgt_path": hgt_path, "etag": etag}


def merge_srtm_tiles(hgt_paths: list, bbox: dict, output_dir: Path) -> dict:
    """
    Merge .hgt tiles → inhauma-heightmap-wgs84.tif (via gdal_merge.py),
    reproject + clip → inhauma-heightmap.tif (UTM 23S),
    export → inhauma-heightmap.png (16-bit UInt16 scaled 0–1500m).
    Returns dict with output paths.
    """
    wgs84_tif = output_dir / "inhauma-heightmap-wgs84.tif"
    utm_tif = output_dir / "inhauma-heightmap.tif"
    png_out = output_dir / "inhauma-heightmap.png"

    gdal_merge = _gdal_merge_path()
    hgt_str = [str(p) for p in hgt_paths]

    print("[SRTM] Merging tiles with gdal_merge.py…", flush=True)
    merge_cmd = [
        "python3",
        gdal_merge,
        "-o",
        str(wgs84_tif),
        "-of",
        "GTiff",
        "-ot",
        "Int16",
    ] + hgt_str
    subprocess.run(merge_cmd, check=True, capture_output=True, text=True)

    print("[SRTM] Reprojecting to UTM 23S and clipping…", flush=True)
    bbox_te = [
        str(bbox["west"]),
        str(bbox["south"]),
        str(bbox["east"]),
        str(bbox["north"]),
    ]
    warp_cmd = [
        "gdalwarp",
        "-t_srs",
        "EPSG:31983",
        "-tr",
        "30",
        "30",
        "-r",
        "bilinear",
        "-te_srs",
        "EPSG:4326",
        "-te",
        bbox_te[0],
        bbox_te[1],
        bbox_te[2],
        bbox_te[3],
        "-overwrite",
        str(wgs84_tif),
        str(utm_tif),
    ]
    subprocess.run(warp_cmd, check=True, capture_output=True, text=True)

    print("[SRTM] Exporting 16-bit PNG for Terrain3D…", flush=True)
    translate_cmd = [
        "gdal_translate",
        "-ot",
        "UInt16",
        "-scale",
        "0",
        "1500",
        "0",
        "65535",
        "-of",
        "PNG",
        str(utm_tif),
        str(png_out),
    ]
    subprocess.run(translate_cmd, check=True, capture_output=True, text=True)

    return {
        "wgs84_tif": wgs84_tif,
        "utm_tif": utm_tif,
        "png": png_out,
    }


# ---------------------------------------------------------------------------
# Idempotence check
# ---------------------------------------------------------------------------


def is_up_to_date(png_path: Path, sources_md: Path) -> bool:
    """
    Return True if inhauma-heightmap.png exists and its SHA matches SOURCES.md.
    """
    if not png_path.is_file():
        return False
    if not sources_md.is_file():
        return False
    current_sha = sha256_file(png_path)
    content = sources_md.read_text()
    return f"inhauma-heightmap.png sha256: {current_sha}" in content


# ---------------------------------------------------------------------------
# SOURCES.md writing
# ---------------------------------------------------------------------------


def write_sources_md(sources_path: Path, run_data: dict):
    """Append / create SOURCES.md provenance record."""
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    lines = [
        f"## Fetch run {now_iso}",
        "",
        f"- bbox: N={run_data['bbox']['north']:.4f} S={run_data['bbox']['south']:.4f} "
        f"E={run_data['bbox']['east']:.4f} W={run_data['bbox']['west']:.4f}",
        f"- Geofabrik PBF Last-Modified: {run_data.get('geofabrik_lm', 'n/a')}",
    ]

    for tile_name, etag in run_data.get("srtm_etags", {}).items():
        lines.append(f"- SRTM tile {tile_name} ETag: {etag}")

    for fname, sha in run_data.get("output_shas", {}).items():
        lines.append(f"- {fname} sha256: {sha}")

    lines.append("")

    # Prepend (or create)
    existing = sources_path.read_text() if sources_path.is_file() else ""
    sources_path.write_text("\n".join(lines) + "\n" + existing)
    print(f"[INFO] SOURCES.md updated: {sources_path}", flush=True)


# ---------------------------------------------------------------------------
# Dry-run
# ---------------------------------------------------------------------------


def print_dry_run(args, bbox: dict, tiles: list):
    """Print what would happen and exit 3."""
    print("=== DRY RUN ===")
    print(f"  Center:    ({args.center_lat}, {args.center_lon})")
    print(f"  Radius:    {args.radius_km} km")
    print(
        f"  Bbox:      N={bbox['north']:.4f} S={bbox['south']:.4f} "
        f"E={bbox['east']:.4f} W={bbox['west']:.4f}"
    )
    print(f"  Output:    {args.output_dir}")
    print()
    if not args.skip_osm:
        print("  OSM steps:")
        print("    1. Download Geofabrik PBF → Tools/.cache/geofabrik/sudeste.osm.pbf (~280 MB)")
        print(f"    2. osmium extract → {args.output_dir}/inhauma-osm.pbf")
        print(
            f"    3. Extract buildings (cap {BUILDING_CAP}) → "
            f"{args.output_dir}/inhauma-buildings.json"
        )
        print(f"    4. Extract landuse → {args.output_dir}/inhauma-landuse.json")
    if not args.skip_srtm:
        print("  SRTM steps:")
        for t in tiles:
            url = f"{AWS_SRTM_BASE}/{t['subdir']}/{t['name']}.hgt.gz"
            print(f"    5. Fetch {url} → Tools/.cache/srtm/{t['name']}.hgt.gz")
        print(f"    6. gdal_merge.py → {args.output_dir}/inhauma-heightmap-wgs84.tif")
        print(f"    7. gdalwarp (UTM 23S) → {args.output_dir}/inhauma-heightmap.tif")
        print(f"    8. gdal_translate (PNG 16-bit) → {args.output_dir}/inhauma-heightmap.png")
    print("  9. Write {args.output_dir}/SOURCES.md")
    print("=== END DRY RUN ===")
    sys.exit(3)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--center-lat", type=float, default=-19.47)
    p.add_argument("--center-lon", type=float, default=-44.46)
    p.add_argument("--radius-km", type=float, default=22.0)
    p.add_argument("--output-dir", type=str, default="Content/World")
    p.add_argument("--yes", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--skip-osm", action="store_true")
    p.add_argument("--skip-srtm", action="store_true")
    p.add_argument(
        "--export-web-data",
        action="store_true",
        help="Export static JS GIS modules for aero-fighters from local outputs",
    )
    p.add_argument(
        "--web-output-dir",
        type=str,
        default="../aero-fighters/src/maps/inhauma-data",
        help="Output directory for --export-web-data",
    )
    p.add_argument(
        "--web-world-scale",
        type=float,
        default=WEB_WORLD_SCALE,
        help="Compressed world scale for web-game coordinates",
    )
    p.add_argument("--force", action="store_true")
    return p.parse_args()


def main():
    args = parse_args()

    # Locate repo root (2 levels up from this script)
    script_dir = Path(__file__).resolve().parent
    game_root = script_dir.parent  # aero-fighters-v2/
    repo_root = game_root.parent.parent  # workspace root

    # Load .env.local
    load_config(repo_root / "repos" / "tauan-games")

    # Override bbox from .env.local if present and not overridden by CLI
    def _env_float(key, default):
        val = os.environ.get(key)
        return float(val) if val else default

    # Check if CLI defaults were overridden explicitly
    # (simple approach: use env vars only if args still at defaults)
    if args.center_lat == -19.47 and args.center_lon == -44.46 and args.radius_km == 22.0:
        osm_north = _env_float("OSM_BBOX_NORTH", None)
        osm_south = _env_float("OSM_BBOX_SOUTH", None)
        osm_east = _env_float("OSM_BBOX_EAST", None)
        osm_west = _env_float("OSM_BBOX_WEST", None)
        if all(v is not None for v in [osm_north, osm_south, osm_east, osm_west]):
            # Compute center + radius from env bbox
            center_lat = (osm_north + osm_south) / 2
            center_lon = (osm_east + osm_west) / 2
            radius_km = min(
                (osm_north - osm_south) / 2 * LAT_TO_KM,
                (osm_east - osm_west) / 2 * LON_TO_KM_AT_LAT,
            )
            print(
                f"[CONFIG] Using .env.local bbox: center=({center_lat:.4f},{center_lon:.4f}) "
                f"radius≈{radius_km:.1f}km",
                flush=True,
            )
            args.center_lat = center_lat
            args.center_lon = center_lon
            args.radius_km = radius_km

    # Validate
    if not (-90 < args.center_lat < 90) or not (-180 < args.center_lon < 180):
        print("[ERROR] center-lat/lon out of range.", file=sys.stderr)
        sys.exit(4)
    if args.radius_km <= 0 or args.radius_km > 500:
        print("[ERROR] radius-km out of range (0, 500].", file=sys.stderr)
        sys.exit(4)

    bbox = compute_bbox(args.center_lat, args.center_lon, args.radius_km)
    tiles = srtm_tiles(bbox)

    # Resolve output dir relative to game root
    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = game_root / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    cache_dir_pbf = script_dir / ".cache" / "geofabrik"
    cache_dir_srtm = script_dir / ".cache" / "srtm"
    cache_dir_pbf.mkdir(parents=True, exist_ok=True)
    cache_dir_srtm.mkdir(parents=True, exist_ok=True)

    # Dry run
    if args.dry_run:
        print_dry_run(args, bbox, tiles)

    # Dependency check
    osmium_bin = None
    if not args.skip_osm or args.export_web_data:
        import shutil

        osmium_bin = shutil.which("osmium")
        if osmium_bin is None:
            print("[MISSING DEP] 'osmium' not found in PATH.", file=sys.stderr)
            print("  Install: sudo apt install osmium-tool", file=sys.stderr)
            sys.exit(2)
    check_system_deps(args.skip_osm, args.skip_srtm)

    if args.export_web_data:
        clipped_pbf = output_dir / "inhauma-osm.pbf"
        if not clipped_pbf.is_file():
            print(f"[ERROR] Missing local PBF for web export: {clipped_pbf}", file=sys.stderr)
            print(
                "  Run the fetch step first or set --output-dir to a directory"
                " containing inhauma-osm.pbf.",
                file=sys.stderr,
            )
            sys.exit(2)
        web_output_dir = Path(args.web_output_dir)
        if not web_output_dir.is_absolute():
            web_output_dir = game_root / web_output_dir
        export_web_data(
            osmium_bin,
            clipped_pbf,
            web_output_dir,
            args.center_lat,
            args.center_lon,
            args.web_world_scale,
        )
        sys.exit(0)

    # Idempotence check
    png_path = output_dir / "inhauma-heightmap.png"
    sources_md = output_dir / "SOURCES.md"
    if not args.force and is_up_to_date(png_path, sources_md):
        print("[INFO] Outputs are up to date. Use --force to re-fetch.", flush=True)
        sys.exit(0)

    # Confirm
    if not args.yes:
        print("\nThis will download ~280 MB (Geofabrik PBF) + a few MB of SRTM tiles.")
        print(f"Output: {output_dir}")
        answer = input("Continue? [y/N] ").strip().lower()
        if answer != "y":
            print("Aborted.")
            sys.exit(0)

    run_data: dict = {"bbox": bbox, "srtm_etags": {}, "output_shas": {}}

    # ---- OSM ----------------------------------------------------------------
    if not args.skip_osm:
        # Fetch / cache Geofabrik PBF
        geo_result = fetch_geofabrik_pbf(cache_dir_pbf)
        geofabrik_lm = geo_result["last_modified"]
        run_data["geofabrik_lm"] = geofabrik_lm

        # Clip to bbox
        clipped_pbf = output_dir / "inhauma-osm.pbf"
        clip_pbf(osmium_bin, geo_result["path"], bbox, clipped_pbf)

        # Extract buildings
        buildings_json = output_dir / "inhauma-buildings.json"
        extract_buildings(osmium_bin, clipped_pbf, buildings_json)

        # Extract landuse
        landuse_json = output_dir / "inhauma-landuse.json"
        extract_landuse(osmium_bin, clipped_pbf, landuse_json)

    # ---- SRTM ---------------------------------------------------------------
    if not args.skip_srtm:
        hgt_paths = []
        for tile in tiles:
            result = fetch_srtm_tile(tile, cache_dir_srtm)
            hgt_paths.append(result["hgt_path"])
            run_data["srtm_etags"][tile["name"]] = result["etag"]

        merge_srtm_tiles(hgt_paths, bbox, output_dir)

    # ---- Record SHAs --------------------------------------------------------
    for fname in [
        "inhauma-osm.pbf",
        "inhauma-buildings.json",
        "inhauma-landuse.json",
        "inhauma-heightmap.tif",
        "inhauma-heightmap.png",
    ]:
        fpath = output_dir / fname
        if fpath.is_file():
            run_data["output_shas"][fname] = sha256_file(fpath)

    # ---- SOURCES.md ---------------------------------------------------------
    write_sources_md(sources_md, run_data)

    print("\n[DONE] All outputs written to:", output_dir, flush=True)
    for fname, sha in run_data["output_shas"].items():
        size = (output_dir / fname).stat().st_size
        print(f"  {fname:40s} {size >> 10:>8} KB  sha256:{sha[:16]}…", flush=True)

    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        sys.exit(1)
    except Exception:
        traceback.print_exc()
        sys.exit(1)

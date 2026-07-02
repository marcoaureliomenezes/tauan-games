# SPEC: Aero Fighters - Inhauma GIS Map Replacement

> **Status:** Aprovado
> **Aprovação:** 2026-06-30 — aprovado pelo operador: "Of course it's approved. We cannot build good maps only with our hands. I agree with the plan, lets use third parts to improve the game."
> **Author:** Codex / product-engineer
> **Created:** 2026-06-30
> **Release ID:** v0.2.0
> **Supersedes:** `aero-fighters-inhauma-map-v1` map-generation approach
> **Consumes:** aero-fighters-inhauma-gis-map-v1

---

## 1. Overview

Replace the current hand-authored Inhauma map in `aero-fighters/` with a GIS-baked,
locally generated map system.

The current map is visually and functionally too limited: roads are disconnected
decorative pieces, traffic has no road graph, buildings are rectangular placeholders,
trees are repeated fake cones, terrain is not based on the existing SRTM data, and the
airport is only protected by terrain flattening rather than by map feature exclusion.

This release does not add detail on top of the stale map. It replaces stale map layers
with authoritative generated layers:

- SRTM-derived terrain grid replaces the current FBM-only Inhauma terrain.
- OSM-derived road graph replaces `INHAUMA_ROAD_DEFS` as the source of roads and traffic.
- OSM building footprints replace the procedural city grid boxes.
- OSM landuse/water polygons replace random tree scatter and approximate water bodies.
- Airport safety geometry becomes a first-class exclusion system applied before roads,
  buildings, trees, targets, and traffic are emitted.

The game remains a static browser game: Three.js r165, native ES modules, no TypeScript,
no bundler, no runtime CDN, and no live map-tile/network dependency.

## 2. Current-State Problems

### P-01 Roads Are Not Roads

Current Inhauma roads are three hard-coded polylines rendered as individual flat plane
segments. There is no graph topology, intersection model, snapping, lane centerline,
road class system, or airport conflict check.

Observed result:

- road pieces can appear disconnected;
- curves and intersections look wrong;
- roads can conflict with landing surfaces;
- cars loop on isolated decorative paths instead of driving through a network.

### P-02 Airport Is Not Protected

The current airport flattening only changes terrain height near runway/taxiway/service
rectangles. It does not prevent roads, buildings, trees, traffic, or mission targets from
spawning in the runway safety area or approach corridors.

### P-03 City Is Procedural Placeholder Geometry

Inhauma's city is generated from a circular grid of box buildings. It does not use real
building footprints, street blocks, landuse, or neighborhood shape.

### P-04 Foliage Is Fake And Uniform

Trees are generated from one trunk/crown prototype with random placement filtered by
height. They are not based on forest/grass/orchard/farmland polygons and do not have
species/prototype variation.

### P-05 Terrain Is Not Data-Backed

The web map ignores the existing SRTM heightmap already generated in `aero-fighters-v2`.
Named hills are procedural features, not a realistic terrain base.

### P-06 Existing GIS Assets Are Underused

The repo already contains an Inhauma OSM/SRTM pipeline under `aero-fighters-v2`, but the
web game does not consume it and the pipeline does not yet export roads/water/game-ready
local data.

## 3. Technology Decisions

### TD-01 Runtime Stack

Keep the current web runtime:

- Three.js r165 from `vendor/three.module.min.js`;
- native ES modules;
- no build step;
- no TypeScript;
- no external runtime network calls;
- no CDN;
- no Google Maps, Mapbox, OSM, Overpass, or tile server access at runtime.

### TD-02 Data Source Stack

Approved third-party/offline sources:

- Geofabrik Brazil/Sudeste OSM PBF for roads, buildings, landuse, water, and ways;
- SRTM/AWS terrain tiles for elevation;
- existing `aero-fighters-v2/Content/World/*` data as seed/provenance;
- existing `aero-fighters-v2/Tools/inhauma-data-fetch.py` as the starting generator.

### TD-03 Preprocessing Tool Stack

Approved preprocessing tools:

- `osmium` for PBF clipping/filtering/export;
- GDAL tools for SRTM merge/reprojection/resampling;
- optional dev-only geometry utilities in the generator, such as Earcut/Turf-style
  operations, when vendored or invoked only during generation.

Preprocessing tools do not become runtime dependencies.

### TD-04 Generated Data Format

The implementation must produce game-ready local data under the web game boundary.
Allowed forms:

- committed static JS modules exporting compact arrays/objects; or
- committed local JSON files loaded by the static server.

Because the product quality bar requires offline runtime behavior, generated data must be
local to the repo and deterministic.

### TD-05 Three.js Rendering APIs

Use:

- `BufferGeometry` for terrain chunks, road ribbons, intersections, water, and merged
  building geometry;
- `InstancedMesh` for cars, repeated tree prototypes, utility poles, small props, and
  simple repeated houses;
- `Shape`/`ExtrudeGeometry` or pre-triangulated geometry for OSM building footprints;
- `CanvasTexture` only for generated procedural markings/material detail;
- LOD and chunking where needed to keep the renderer budget stable.

## 4. Replacement Scope

The stale current Inhauma map content must not remain as hidden fallback or duplicated
parallel implementation.

During implementation, replace or delete stale content for:

- `INHAUMA_ROAD_DEFS` as the authoritative road source;
- segmented road-plane rendering;
- decorative non-graph traffic;
- procedural circular town grid;
- random terrain-height tree scatter as the authoritative foliage source;
- FBM-only terrain as the authoritative terrain source;
- airport terrain-only safety handling;
- any tests that only prove old hand-authored landmarks while missing road graph,
  exclusion, and GIS-data acceptance.

Fallbacks are allowed only for explicit non-Inhauma maps or for temporary in-task states.
The final release must have one authoritative Inhauma map path.

## 5. Functional Requirements

### FR-01 GIS Data Pipeline

Extend or replace `aero-fighters-v2/Tools/inhauma-data-fetch.py` with a web-map generator
that emits compact Inhauma data for the Three.js game:

- terrain height grid;
- OSM road graph and road classes;
- OSM building footprints and height metadata;
- landuse polygons;
- water polygons/ways;
- source metadata and hashes.

### FR-02 Local Coordinate System

Create one canonical projection module for Inhauma:

- origin near Inhauma center;
- WGS84 lat/lon to local meters;
- stable handedness and axis convention documented in code;
- same projection used by terrain, roads, buildings, water, foliage, airport, targets,
  diagnostics, and tests.

### FR-03 Terrain Replacement

Terrain must be sampled from the generated SRTM-derived height grid, with optional small
procedural detail only as secondary decoration.

Terrain must support:

- visual mesh and collision height from the same source;
- airport flattening;
- road bed carving/flattening;
- finite samples across all QA points;
- no mountain/terrain intrusion into runway, taxiway, service zone, safety area, or
  approach corridors.

### FR-04 Road Network Replacement

Roads must be generated from OSM `highway=*` ways into a connected graph.

The runtime road layer must include:

- road nodes and edges;
- road class -> width/material mapping;
- continuous ribbon geometry rather than disconnected plane pieces;
- intersection patches;
- road bed terrain adjustment;
- clipping/rerouting around airport safety exclusions;
- diagnostics for graph connectivity and airport conflicts.

### FR-05 Functional Traffic

Traffic must use the road graph, not decorative loops.

Minimum traffic behavior:

- cars choose routes across connected edges;
- cars stay on lane centerlines;
- no car enters runway, taxiway, service zone, safety zone, or approach exclusion;
- speed varies by road class;
- diagnostics expose active cars and route/edge identifiers in test mode.

### FR-06 Airport Safety Authority

The Inhauma airport model must define:

- runway polygon;
- taxiway and service/apron polygons;
- runway safety area;
- approach clear zones;
- no-road zone;
- no-building zone;
- no-tree zone;
- no-target zone.

Every generated layer must consult these zones before final emission.

### FR-07 Building Replacement

Buildings must originate from OSM building footprints where available.

Minimum behavior:

- use real footprints, not circular-grid placeholders;
- height from `height`, `building:levels`, or sane defaults;
- support simple roof/material variation;
- merge or instance by material/LOD to control draw calls;
- exclude all building geometry from airport safety zones and roads.

### FR-08 Foliage Replacement

Foliage must originate from OSM landuse/natural polygons and generated exclusion masks.

Minimum behavior:

- forest/orchard/farmland/grass/residential densities differ;
- at least four tree/vegetation visual prototypes;
- deterministic placement;
- no foliage on roads, water, buildings, runway, taxiway, service zone, safety area, or
  approach exclusions.

### FR-09 Water And Rural Features

Water must use OSM water/waterway polygons/ways where available, with curated additions
only when source data is incomplete and the addition is documented.

Rural features must come from landuse and road context where possible:

- farms/pastures;
- field patches;
- rural road shoulders;
- sparse buildings/sheds;
- vegetation corridors.

### FR-10 Diagnostics And QA Contract

`window.__aeroDebug.getMapDiagnostics()` for Inhauma must expose:

- data version/source hashes;
- projection origin;
- terrain grid metadata;
- road graph stats;
- disconnected road components;
- airport exclusion conflict counts;
- building count and source count;
- foliage counts by prototype/type;
- traffic route state;
- existing city/landmark fields required by current tests.

## 6. Non-Functional Requirements

- No runtime network.
- No runtime CDN.
- No required build step for playing the game.
- Generated data must be deterministic and committed or reproducibly generated.
- Keep maps `desert`, `rio`, and `islands` working.
- Keep `window.game` and `window.__aeroDebug` compatibility.
- Keep renderer budget within Playwright fidelity test thresholds or update thresholds
  only with evidence that the map remains playable on target hardware.
- Do not keep stale duplicate map systems after final replacement.

## 7. Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-GIS-01 | Inhauma runtime uses generated local GIS data; no live tile/API/network call is made. |
| AC-GIS-02 | The old `INHAUMA_ROAD_DEFS` hard-coded road source is removed or reduced to non-authoritative test fixtures only. |
| AC-GIS-03 | Road graph has at least one connected main component containing Inhauma access roads and MG-238-equivalent routing. |
| AC-GIS-04 | No road geometry intersects runway, taxiway, service zone, runway safety area, or approach clear zones except explicitly allowed service access. |
| AC-GIS-05 | Traffic routes across graph edges and no vehicle enters airport exclusion zones. |
| AC-GIS-06 | Buildings are generated from OSM footprints; the final Inhauma city is not a circular grid of boxes. |
| AC-GIS-07 | Foliage is generated from landuse/natural polygons with at least four visual prototypes and all required exclusions. |
| AC-GIS-08 | Terrain visual mesh and collision use the same SRTM-derived height source with airport and road flattening. |
| AC-GIS-09 | Airport takeoff and landing remain playable; approach/landing experience is not obstructed by roads, trees, buildings, targets, or terrain. |
| AC-GIS-10 | Existing Inhauma landmarks remain diagnosable, but their placement must be compatible with the generated map. |
| AC-GIS-11 | `npm run validate:aero-map` passes. |
| AC-GIS-12 | `npm run test:aero:qa` passes without regressions. |
| AC-GIS-13 | A final code search proves stale authoritative procedural Inhauma systems are gone from production runtime. |

## 8. Out Of Scope

- Live Google Maps / Google Photorealistic Tiles runtime integration.
- Live OSM/Overpass runtime queries.
- Mapbox runtime dependency.
- Full photogrammetry.
- Exact real airport certification modeling.
- Migrating the web game to Godot, UE5, React, or a bundler.
- Replacing the whole mission/combat system.

## 9. Required Evidence Before Closure

- Source hashes/provenance for generated GIS data.
- Screenshot or Playwright evidence of the new Inhauma scene.
- Road/airport conflict validator output.
- Road graph connectivity validator output.
- Traffic exclusion validator output.
- `npm run validate:aero-map`.
- `npm run test:aero:qa`.
- Code search evidence that stale hand-authored authoritative Inhauma map layers were
  deleted/replaced.

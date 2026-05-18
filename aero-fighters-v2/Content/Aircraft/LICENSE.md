# Aircraft Content — License Ledger

> Tracks license attestation for every asset under
> `aero-fighters-v2/Content/Aircraft/`.

## Geometry

| Asset | Origin | License | Date | Author |
|---|---|---|---|---|
| `HandModeled.md` | Own-work design spec — engine-agnostic primitive assembly for generic delta-wing fighter. No real-world aircraft IP likeness (per FR-V2-04 Non-Goals). | Same as project (MIT — operator review pending per T-G-12 README scope) | 2026-05-17 | game-developer (designer hat), cancelled release `aero-fighters-v2-photorealistic-inhauma-v1` T-003 |
| `aircraft.tscn` | Own-work — hand-modeled in Godot 4 primitives (BoxMesh / SphereMesh / CylinderMesh) per `HandModeled.md` spec. 7 primitive MeshInstance3D nodes, ≈ 1224 tris. No external mesh imports. | Same as project (MIT — operator review pending per T-G-12) | 2026-05-18 | orchestrator + game-designer hat agent, release `aero-fighters-v2-godot-stylized-inhauma-v1` T-G-15 |

## Materials

| Asset | Origin | License | Date | Author |
|---|---|---|---|---|
| `M_CelAircraft.tres` | Own-work — Godot 4 `StandardMaterial3D` resource. Cel-friendly base (matte slate blue-grey, roughness 0.8, metallic 0.0); the toon look is produced by the screen-space cel-shader pass authored in T-G-10, not by this material. | Same as project (MIT) | 2026-05-18 | game-designer hat agent, T-G-15 |

## Attestation

All assets in this directory are **own-work**, produced inside the
`aero-fighters-v2` working tree. No external mesh, texture, or material was
imported. Foundation rule CV-08 (no external assets beyond CC0 audio) is
honored. No Sketchfab, no Fab, no Quixel, no Megascans, no third-party FBX,
glTF, or OBJ.

## World Geometry — Buildings + Foliage (T-G-17, T-G-18)

| Asset | Origin | License | Date | Author |
|---|---|---|---|---|
| `Content/Materials/M_CelBuilding.tres` | Own-work — Godot 4 `StandardMaterial3D` resource. Warm sandy/concrete albedo (0.7, 0.65, 0.55), matte (roughness 0.85, metallic 0.0). | Same as project (MIT) | 2026-05-18 | game-developer, T-G-17 |
| `Content/Materials/M_CelFoliage.tres` | Own-work — Godot 4 `StandardMaterial3D` resource. Matte forest green albedo (0.32, 0.55, 0.28). | Same as project (MIT) | 2026-05-18 | game-developer, T-G-18 |
| `scripts/building_spawner.gd` | Own-work — GDScript MultiMeshInstance3D scatter from OSM building polygons. | Same as project (MIT) | 2026-05-18 | game-developer, T-G-17 |
| `scripts/foliage_spawner.gd` | Own-work — GDScript MultiMeshInstance3D scatter from OSM landuse polygons. Deterministic RNG seed 42. Low-poly tree mesh generated via SurfaceTool. | Same as project (MIT) | 2026-05-18 | game-developer, T-G-18 |
| Tree mesh (procedural) | Own-work via Godot 4 SurfaceTool (hexagonal cylinder trunk + octahedral canopy). No external mesh. | Same as project (MIT) | 2026-05-18 | game-developer, T-G-18 |
| Building footprint data | Derived from OpenStreetMap `inhauma-buildings.json` (T-G-06 output). | ODbL 1.0 — © OpenStreetMap contributors. Attribution required. See `Content/World/SOURCES.md`. | 2026-05-18 | T-G-06 data pipeline |
| Landuse polygon data | Derived from OpenStreetMap `inhauma-landuse.json` (T-G-06 output). | ODbL 1.0 — © OpenStreetMap contributors. Attribution required. See `Content/World/SOURCES.md`. | 2026-05-18 | T-G-06 data pipeline |

## Future entries

When Wave 4 lands cannon muzzle flash + hit FX + jet engine drone audio,
those entries will be added below with their CC0 attribution.

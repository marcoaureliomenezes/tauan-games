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

## Future entries

When Wave 4 lands cannon muzzle flash + hit FX + jet engine drone audio,
those entries will be added below with their CC0 attribution.

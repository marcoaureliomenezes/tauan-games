# Terrain3D Heightmap Import — Operator Instructions

> Status: install + project wiring complete (T-G-16 code path). Final
> Terrain3DStorage materialization is a one-time operator step in the
> Godot editor (headless API of Terrain3D 1.0.1 is not 100% scriptable
> for the import step; doing it via the editor takes ~2 minutes).

## What's already on disk

| Asset | Path | Status |
|---|---|---|
| Terrain3D addon (MIT) | `addons/terrain_3d/` | ✅ v1.0.1, plugin enabled in `project.godot` |
| Heightmap PNG | `Content/World/inhauma-heightmap.png` | ✅ 1475×1458 px, 16-bit UInt PNG |
| Heightmap GeoTIFF | `Content/World/inhauma-heightmap.tif` | ✅ EPSG:31983 (UTM 23S), 30m pixel |
| OSM buildings JSON | `Content/World/inhauma-buildings.json` | ✅ 651 polygons |
| OSM landuse JSON | `Content/World/inhauma-landuse.json` | ✅ |
| OSM PBF clip | `Content/World/inhauma-osm.pbf` | ✅ ~904 KB |
| Sources provenance | `Content/World/SOURCES.md` | ✅ |
| Import helper script | `tools_godot/import_terrain.gd` | ✅ (used in step 4 below) |

## Height mapping reference

The 16-bit UInt PNG was produced by `gdal_translate -scale 0 1500 0 65535`,
so:

```
height_metres = (pixel_value_uint16 / 65535.0) × 1500.0
```

Inhaúma's terrain spans roughly **645 m to 1103 m** elevation. Origin
WGS84 `(-19.47, -44.46)` samples at **761 m** in the source SRTM
(verified via `gdallocationinfo -wgs84 -valonly inhauma-heightmap.tif
-44.46 -19.47`).

## Manual import steps (~2 minutes)

1. **Open the project in the Godot editor:**
   ```bash
   ~/godot/godot --editor --path aero-fighters-v2/
   ```

2. **Verify the Terrain3D plugin is enabled:**
   - Menu → Project → Project Settings → Plugins tab → confirm
     `Terrain 3D` is listed and the Enable checkbox is checked.
   - If not, check the box. The plugin should load without errors.

3. **Open `scenes/Main.tscn`** by double-clicking it in the FileSystem dock.

4. **Add a `Terrain3D` node:**
   - In the Scene dock, click the `Main` root node.
   - Click the `+` button → search for `Terrain3D` → Create.
   - The node will appear as a child of `Main`.
   - In the Inspector, set Storage to a new `Terrain3DStorage` resource
     (click the dropdown → New Terrain3DStorage).
   - Save the storage to `res://Content/World/inhauma-terrain.tres`
     (Inspector → click Storage → Save → choose that path).

5. **Import the heightmap:**
   - With the Terrain3D node selected, open the Terrain3D panel
     (bottom of the editor) → Tools → Import.
   - Heightmap file: `res://Content/World/inhauma-heightmap.png`
   - Import scale (height): **1500.0** (matches the gdal_translate
     scaling above; this maps PNG `1.0` to `1500 m`).
   - Position: origin (default).
   - Click Import. Wait ~30 seconds for region tiling.

6. **Save the scene:** Ctrl+S on Main.tscn.

7. **Verify height-at-origin (AC-V2-G-02):**
   - Open `tools_godot/import_terrain.gd` in the editor's Script panel.
   - The script includes a `verify_height_at_origin()` function — run
     it via the Script Editor's Run button OR write the result by hand:
     compare `Terrain3D.get_height(Vector3(0, 0, 0))` to the expected
     SRTM sample **761 m** (Inhaúma origin).
   - Acceptance: error ≤ 5 m.

## Headless alternative (advanced, deferred)

A fully-headless variant would require Terrain3D's `import_images()` API
called from a script, then driving the Godot main loop until the import
worker finishes. As of Terrain3D 1.0.1, the headless path requires
careful frame-pumping with `--quit-after N` (not `--quit`) because the
import is asynchronous. Sample sketch lives in `tools_godot/import_terrain.gd`
but is not Wave-2-blocking.

When/if we automate this for CI (Wave 5), revisit this section with the
working invocation.

## Provenance

Generated 2026-05-18 by orchestrator during Wave 2 completion of
`aero-fighters-v2-godot-stylized-inhauma-v1`. Grill report:
`.dadaia/reports/tauan-games/product-engineer/2026-05-18T005834Z-godot-pivot.html`.

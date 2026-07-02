## import_terrain.gd — Terrain3D heightmap import via project autoload
##
## This script is registered as the "ImportTerrain" autoload temporarily in
## project.godot to run the heightmap import headless. After running, remove
## the autoload entry.
##
## Usage (see docs/terrain3d-import.md for full instructions):
##   1. Add to [autoload] in project.godot:
##        ImportTerrain="*res://tools_godot/import_terrain.gd"
##   2. Run:
##        ~/godot/godot --headless --quit --path aero-fighters-v2/
##   3. Remove the autoload entry from project.godot.
##   4. Verify Content/World/inhauma-terrain.res was created.
##
## Height mapping:
##   Source: gdal_translate -scale 0 1500 0 65535 (0..65535 UInt16 = 0..1500 m)
##   Terrain3DUtil.load_image() normalises UInt16 PNG to [0..1] float
##   import_scale = 1500.0 maps [0..1] → [0..1500] metres
##
## AC-V2-G-02 verification:
##   SRTM source value at WGS84 (-19.47, -44.46): 761 m
##   Expected Terrain3D height at world (0, 0, 0): ~761 m ± 5 m

extends Node

const HEIGHTMAP_PATH  := "res://Content/World/inhauma-heightmap.png"
const OUTPUT_DIR      := "res://Content/World/"
const OUTPUT_RES      := "res://Content/World/inhauma-terrain.res"
const IMPORT_SCALE    := 1500.0
const HEIGHT_OFFSET   := 0.0


func _ready() -> void:
	# Wait one extra frame for Terrain3D GDExtension node to fully initialize
	# before calling import_images (avoids "Data not initialized" error)
	await get_tree().process_frame
	await get_tree().process_frame
	run_import()
	get_tree().quit(0)


func run_import() -> void:
	print("[import_terrain] Starting Terrain3D heightmap import...")

	if not ClassDB.class_exists("Terrain3D"):
		push_error("[import_terrain] Terrain3D not in ClassDB. GDExtension not loaded.")
		push_error("  Check that addons/terrain_3d/bin/libterrain.linux.release.x86_64.so exists.")
		get_tree().quit(1)
		return

	if not FileAccess.file_exists(HEIGHTMAP_PATH):
		push_error(
			"[import_terrain] Not found: %s — run Tools/inhauma-data-fetch.py first."
			% HEIGHTMAP_PATH
		)
		get_tree().quit(1)
		return

	# Use ClassDB to instantiate without static type annotations
	# (static type annotations on GDExtension classes fail at parse time in headless mode
	#  before the extension is registered — use untyped variables instead)
	var terrain = ClassDB.instantiate("Terrain3D")
	if terrain == null:
		push_error("[import_terrain] ClassDB.instantiate('Terrain3D') returned null.")
		get_tree().quit(1)
		return
	# Add to scene tree first, then wait for _ready to fire in the extension
	add_child(terrain)
	# Give the GDExtension node time to initialize its internal data
	await get_tree().process_frame

	# Retrieve or create Terrain3DData — Terrain3D auto-creates it internally
	var terrain_data = terrain.get("data")
	if terrain_data == null:
		terrain_data = ClassDB.instantiate("Terrain3DData")
		if terrain_data == null:
			push_error("[import_terrain] Terrain3DData instantiation failed.")
			get_tree().quit(1)
			return
		terrain.set("data", terrain_data)
		await get_tree().process_frame

	# Load heightmap via Terrain3DUtil (static class, not instantiated)
	print("[import_terrain] Loading: %s" % HEIGHTMAP_PATH)
	var util_class = (
		ClassDB.instantiate("Terrain3DUtil") if ClassDB.class_exists("Terrain3DUtil") else null
	)
	var height_image: Image

	if util_class != null:
		# Terrain3DUtil is instantiable
		height_image = util_class.call(
			"load_image", HEIGHTMAP_PATH, ResourceLoader.CACHE_MODE_IGNORE,
			Vector2(0.0, 1.0), Vector2i(1024, 1024)
		)
	else:
		# Fallback: load PNG directly; Terrain3D will interpret pixel data
		height_image = Image.load_from_file(ProjectSettings.globalize_path(HEIGHTMAP_PATH))

	if height_image == null or height_image.is_empty():
		push_error("[import_terrain] Failed to load heightmap image.")
		get_tree().quit(1)
		return

	print("[import_terrain] Loaded %dx%d format=%d" % [
		height_image.get_width(), height_image.get_height(), height_image.get_format()
	])

	# TYPE_HEIGHT=0, TYPE_CONTROL=1, TYPE_COLOR=2, TYPE_MAX=3
	var type_max: int = 3
	var type_height: int = 0
	if ClassDB.class_exists("Terrain3DRegion"):
		type_max = ClassDB.class_get_integer_constant("Terrain3DRegion", "TYPE_MAX")
		type_height = ClassDB.class_get_integer_constant("Terrain3DRegion", "TYPE_HEIGHT")

	var imported_images: Array = []
	imported_images.resize(type_max)
	imported_images[type_height] = height_image

	print("[import_terrain] Calling import_images (scale=%.1f)..." % IMPORT_SCALE)
	terrain_data.call("import_images", imported_images, Vector3.ZERO, HEIGHT_OFFSET, IMPORT_SCALE)

	print("[import_terrain] Saving to: %s" % OUTPUT_RES)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT_DIR))
	var err: int = ResourceSaver.save(terrain_data, OUTPUT_RES)
	if err != OK:
		push_error("[import_terrain] Save failed: %s (err=%d)" % [error_string(err), err])
		get_tree().quit(1)
		return

	print("[import_terrain] SUCCESS — saved: %s" % OUTPUT_RES)
	print(
		"[import_terrain] AC-V2-G-02: sample terrain.get_height(Vector3(0,0,0))"
		+ " → should be ~761 ± 5 m"
	)

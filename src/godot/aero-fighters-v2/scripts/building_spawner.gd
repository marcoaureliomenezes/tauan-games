extends Node3D
# building_spawner.gd — T-G-17
# Reads Content/World/inhauma-buildings.json and populates a single
# MultiMeshInstance3D with one BoxMesh per OSM building polygon.
# All 651 buildings (capped at 5000 by RR-V2-G-03) render in one draw call.
# Depends on T-G-04 (scene tree) + T-G-06 (buildings JSON) + T-G-16 (Terrain3D).

# World origin (WGS84) — must match GameConfig origin_latitude / origin_longitude
const ORIGIN_LAT: float = -19.47
const ORIGIN_LON: float = -44.46

# Flat-Earth approximation at lat ≈ -19°
const METERS_PER_DEG_LAT: float = 111320.0
const METERS_PER_DEG_LON: float = 105000.0  # 111320 * cos(-19°) ≈ 105000

# Building constants
const DEFAULT_LEVELS: int = 3
const METERS_PER_LEVEL: float = 3.0

# Safety caps (RR-V2-G-03 + sanity)
const MAX_BUILDING_INSTANCES: int = 5000
const MAX_DISTANCE_FROM_ORIGIN_M: float = 25000.0  # 25 km sanity filter

# Path to the MultiMeshInstance3D child node that this spawner populates
@onready var multi_mesh_instance: MultiMeshInstance3D = $BuildingsMesh


func _ready() -> void:
	_spawn_buildings()


func _spawn_buildings() -> void:
	var json_path: String = "res://Content/World/inhauma-buildings.json"

	# Load JSON
	var file := FileAccess.open(json_path, FileAccess.READ)
	if file == null:
		push_error("[building_spawner] Could not open %s" % json_path)
		return

	var json_text: String = file.get_as_text()
	file.close()

	var json := JSON.new()
	var parse_err := json.parse(json_text)
	if parse_err != OK:
		push_error("[building_spawner] JSON parse error: %s" % json.get_error_message())
		return

	var buildings: Array = json.data
	if not buildings is Array:
		push_error("[building_spawner] Expected JSON array, got %s" % typeof(buildings))
		return

	# Cap at 5000 by area_m2 (defensive double-check — T-G-06 tool already caps)
	if buildings.size() > MAX_BUILDING_INSTANCES:
		buildings.sort_custom(func(a, b): return a.get("area_m2", 0.0) > b.get("area_m2", 0.0))
		buildings = buildings.slice(0, MAX_BUILDING_INSTANCES)

	# Try to get a reference to Terrain3D node for height sampling
	# Wrapped in null-check; fall back to y=0 if plugin not loaded.
	var terrain_node: Node = null
	var parent := get_parent()
	if parent:
		terrain_node = parent.find_child("Terrain3D", true, false)

	# Collect valid transforms
	var transforms: Array[Transform3D] = []

	for bld in buildings:
		var polygon: Array = bld.get("polygon_wgs84", [])
		if polygon.size() < 3:
			continue

		# Convert WGS84 polygon vertices to local world XZ coords
		var local_verts: Array = []
		for vert in polygon:
			var lat: float = vert[0]
			var lon: float = vert[1]
			var wx: float = (lon - ORIGIN_LON) * METERS_PER_DEG_LON
			var wz: float = -(lat - ORIGIN_LAT) * METERS_PER_DEG_LAT
			local_verts.append(Vector2(wx, wz))

		# Compute centroid
		var centroid: Vector2 = _polygon_centroid(local_verts)

		# Sanity filter: reject if > 25 km from origin
		if centroid.length() > MAX_DISTANCE_FROM_ORIGIN_M:
			continue

		# Compute bounding-box footprint
		var min_x: float = local_verts[0].x
		var max_x: float = local_verts[0].x
		var min_z: float = local_verts[0].y
		var max_z: float = local_verts[0].y
		for v in local_verts:
			min_x = min(min_x, v.x)
			max_x = max(max_x, v.x)
			min_z = min(min_z, v.y)
			max_z = max(max_z, v.y)

		var footprint_w: float = max(max_x - min_x, 0.5)
		var footprint_d: float = max(max_z - min_z, 0.5)

		# Height from levels
		var levels: int = int(bld.get("levels", DEFAULT_LEVELS))
		if levels < 1:
			levels = DEFAULT_LEVELS
		var height: float = float(levels) * METERS_PER_LEVEL

		# Sample terrain height at centroid
		var ground_y: float = 0.0
		if terrain_node and terrain_node.has_method("get_height"):
			var probe := Vector3(centroid.x, 0.0, centroid.y)
			# Terrain3D.get_height returns world-Y at the given XZ position
			ground_y = terrain_node.call("get_height", probe)

		# Build transform: position base of building on terrain
		var pos := Vector3(centroid.x, ground_y + height * 0.5, centroid.y)
		var scale3 := Vector3(footprint_w, height, footprint_d)
		var xform := Transform3D(Basis().scaled(scale3), pos)
		transforms.append(xform)

	var count: int = transforms.size()
	if count == 0:
		push_warning("[building_spawner] No valid buildings to spawn")
		return

	# Configure MultiMesh
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.instance_count = count
	mm.mesh = BoxMesh.new()
	# BoxMesh default is 1x1x1 m — we scale via per-instance transform above

	for i in range(count):
		mm.set_instance_transform(i, transforms[i])

	# Apply material to the base mesh
	var mat := load("res://Content/Materials/M_CelBuilding.tres")
	if mat:
		mm.mesh.surface_set_material(0, mat)

	multi_mesh_instance.multimesh = mm

	print("[building_spawner] populated %d building instances over Inhauma bbox" % count)


# Compute polygon centroid (shoelace centroid for simple polygons)
func _polygon_centroid(verts: Array) -> Vector2:
	var n: int = verts.size()
	if n == 0:
		return Vector2.ZERO
	if n == 1:
		return verts[0]
	if n == 2:
		return (verts[0] + verts[1]) * 0.5

	var cx: float = 0.0
	var cy: float = 0.0
	var area: float = 0.0

	for i in range(n):
		var j: int = (i + 1) % n
		var cross: float = verts[i].x * verts[j].y - verts[j].x * verts[i].y
		area += cross
		cx += (verts[i].x + verts[j].x) * cross
		cy += (verts[i].y + verts[j].y) * cross

	area *= 0.5
	if abs(area) < 0.0001:
		# Degenerate polygon — use arithmetic mean
		var sum := Vector2.ZERO
		for v in verts:
			sum += v
		return sum / float(n)

	cx /= (6.0 * area)
	cy /= (6.0 * area)
	return Vector2(cx, cy)

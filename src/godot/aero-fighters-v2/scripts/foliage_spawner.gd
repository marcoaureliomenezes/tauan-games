extends Node3D
# foliage_spawner.gd — T-G-18
# Reads Content/World/inhauma-landuse.json and scatters low-poly tree instances
# into a single MultiMeshInstance3D using per-polygon rejection sampling.
# Total instance count capped at 12,000 (RR-V2-G-04).
# RNG seeded at 42 for deterministic placement across runs (FR-V2-G-16 / FR-V2-G-20).
# Depends on T-G-17 (building spawner established patterns).

# World origin (WGS84) — matches GameConfig and building_spawner
const ORIGIN_LAT: float = -19.47
const ORIGIN_LON: float = -44.46

const METERS_PER_DEG_LAT: float = 111320.0
const METERS_PER_DEG_LON: float = 105000.0  # cos(-19°) * 111320

# Scatter densities (trees per m²)
const DENSITY_FOREST: float = 0.005    # 50 trees/ha
const DENSITY_ORCHARD: float = 0.003   # 30 trees/ha
const DENSITY_FARMLAND: float = 0.0005 # 5 trees/ha
const DENSITY_GRASS: float = 0.001     # 10 trees/ha
const DENSITY_RESIDENTIAL: float = 0.001

# Global instance budget (RR-V2-G-04)
const MAX_FOLIAGE_INSTANCES: int = 12000

# Rejection sampling limits (per polygon attempt)
const MAX_ATTEMPTS_FACTOR: int = 10  # max_attempts = desired_count * 10

# Tree geometry constants
const TRUNK_HEIGHT: float = 2.0
const TRUNK_RADIUS_TOP: float = 0.15
const TRUNK_RADIUS_BOT: float = 0.20
const CANOPY_RADIUS: float = 1.5
const CANOPY_HEIGHT_OFFSET: float = 2.5  # center of canopy above ground

# Deterministic RNG seed (FR-V2-G-16 / FR-V2-G-20)
const RNG_SEED: int = 42

@onready var multi_mesh_instance: MultiMeshInstance3D = $FoliageMesh


func _ready() -> void:
	_scatter_foliage()


func _scatter_foliage() -> void:
	var json_path: String = "res://Content/World/inhauma-landuse.json"

	var file := FileAccess.open(json_path, FileAccess.READ)
	if file == null:
		push_error("[foliage_spawner] Could not open %s" % json_path)
		return

	var json_text: String = file.get_as_text()
	file.close()

	var json := JSON.new()
	var parse_err := json.parse(json_text)
	if parse_err != OK:
		push_error("[foliage_spawner] JSON parse error: %s" % json.get_error_message())
		return

	var polygons: Array = json.data
	if not polygons is Array:
		push_error("[foliage_spawner] Expected JSON array")
		return

	# Scatter types and their densities
	var scatter_types: Dictionary = {
		"forest": DENSITY_FOREST,
		"orchard": DENSITY_ORCHARD,
		"farmland": DENSITY_FARMLAND,
		"grass": DENSITY_GRASS,
		"residential": DENSITY_RESIDENTIAL,
	}

	# Try to get Terrain3D reference for height sampling
	var terrain_node: Node = null
	var parent := get_parent()
	if parent:
		terrain_node = parent.find_child("Terrain3D", true, false)

	# Seeded RNG for determinism
	var rng := RandomNumberGenerator.new()
	rng.seed = RNG_SEED

	# --- Pass 1: collect candidate polygons + compute weighted areas ---
	# Each entry: {type, local_verts, area_m2, density, raw_count, bbox}
	var candidates: Array = []
	var total_weighted_area: float = 0.0

	for poly in polygons:
		var poly_type: String = poly.get("type", "")
		if not poly_type in scatter_types:
			continue

		var polygon: Array = poly.get("polygon_wgs84", [])
		if polygon.size() < 3:
			continue

		# Convert WGS84 to local XZ
		var local_verts: Array = []
		for vert in polygon:
			var wx: float = (vert[1] - ORIGIN_LON) * METERS_PER_DEG_LON
			var wz: float = -(vert[0] - ORIGIN_LAT) * METERS_PER_DEG_LAT
			local_verts.append(Vector2(wx, wz))

		# Compute polygon area (shoelace)
		var area_m2: float = abs(_polygon_area(local_verts))
		if area_m2 < 1.0:
			continue

		# Compute bounding box
		var min_x: float = local_verts[0].x
		var max_x: float = local_verts[0].x
		var min_z: float = local_verts[0].y
		var max_z: float = local_verts[0].y
		for v in local_verts:
			min_x = min(min_x, v.x)
			max_x = max(max_x, v.x)
			min_z = min(min_z, v.y)
			max_z = max(max_z, v.y)

		var bbox_w: float = max_x - min_x
		var bbox_h: float = max_z - min_z
		if bbox_w < 0.01 or bbox_h < 0.01:
			continue

		var density: float = scatter_types[poly_type]
		# Weighted area = area * density, used for proportional budget allocation
		var weighted: float = area_m2 * density
		total_weighted_area += weighted

		candidates.append({
			"type": poly_type,
			"local_verts": local_verts,
			"area_m2": area_m2,
			"density": density,
			"weighted": weighted,
			"min_x": min_x, "max_x": max_x,
			"min_z": min_z, "max_z": max_z,
		})

	if candidates.is_empty() or total_weighted_area < 0.001:
		push_warning("[foliage_spawner] No foliage candidates found")
		return

	# --- Pass 2: allocate instance budget proportionally, then sample ---
	var all_positions: Array = []
	var type_counts: Dictionary = {}
	var polygon_count_used: int = 0

	for cand in candidates:
		# Proportional budget for this polygon
		var fraction: float = cand.weighted / total_weighted_area
		var alloc: int = max(1, int(fraction * float(MAX_FOLIAGE_INSTANCES)))

		# Don't sample more than what's left in the global budget
		var remaining: int = MAX_FOLIAGE_INSTANCES - all_positions.size()
		if remaining <= 0:
			break
		alloc = min(alloc, remaining)

		# Rejection sampling inside polygon bbox
		var placed: int = 0
		var max_attempts: int = alloc * MAX_ATTEMPTS_FACTOR
		var attempts: int = 0

		var bbox_w: float = cand.max_x - cand.min_x
		var bbox_h: float = cand.max_z - cand.min_z

		while placed < alloc and attempts < max_attempts:
			attempts += 1
			var px: float = cand.min_x + rng.randf() * bbox_w
			var pz: float = cand.min_z + rng.randf() * bbox_h
			var pt := Vector2(px, pz)

			if _point_in_polygon(pt, cand.local_verts):
				var ground_y: float = 0.0
				if terrain_node and terrain_node.has_method("get_height"):
					ground_y = terrain_node.call("get_height", Vector3(px, 0.0, pz))

				all_positions.append(Vector3(px, ground_y, pz))
				placed += 1

				var t: String = cand.type
				if not t in type_counts:
					type_counts[t] = 0
				type_counts[t] += 1

		if placed > 0:
			polygon_count_used += 1

	var total_count: int = all_positions.size()
	if total_count == 0:
		push_warning("[foliage_spawner] No foliage instances to spawn")
		return

	# Build the combined tree mesh (trunk + canopy)
	var tree_mesh := _build_tree_mesh()

	# Configure MultiMesh
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.instance_count = total_count
	mm.mesh = tree_mesh

	for i in range(total_count):
		var pos: Vector3 = all_positions[i]
		var xform := Transform3D(Basis(), pos)
		mm.set_instance_transform(i, xform)

	multi_mesh_instance.multimesh = mm

	# Build breakdown string
	var breakdown: String = ""
	for t in type_counts:
		breakdown += " %s=%d" % [t, type_counts[t]]

	print("[foliage_spawner] scattered %d tree instances across %d landuse polygons (cap %d) [%s]" % [
		total_count, polygon_count_used, MAX_FOLIAGE_INSTANCES, breakdown.strip_edges()
	])


# Build a low-poly tree mesh combining trunk (hexagonal prism) + canopy (octahedron)
# via SurfaceTool. Total tris <= 100.
func _build_tree_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)

	var mat := load("res://Content/Materials/M_CelFoliage.tres")

	# Trunk: hexagonal prism (6 sides)
	_add_cylinder(st, TRUNK_RADIUS_BOT, TRUNK_RADIUS_TOP, TRUNK_HEIGHT, 6, 0.0)

	# Canopy: low-poly octahedron-like sphere centered at CANOPY_HEIGHT_OFFSET
	_add_sphere_lowpoly(st, CANOPY_RADIUS, CANOPY_HEIGHT_OFFSET)

	st.generate_normals()
	if mat:
		st.set_material(mat)

	return st.commit()


# Add a cylinder (trunk) using SurfaceTool
func _add_cylinder(
	st: SurfaceTool, r_bot: float, r_top: float, h: float, sides: int, y_offset: float
) -> void:
	var angle_step: float = TAU / float(sides)
	var y_bot: float = y_offset
	var y_top: float = y_offset + h

	for i in range(sides):
		var a0: float = i * angle_step
		var a1: float = (i + 1) * angle_step

		var b0 := Vector3(cos(a0) * r_bot, y_bot, sin(a0) * r_bot)
		var b1 := Vector3(cos(a1) * r_bot, y_bot, sin(a1) * r_bot)
		var t0 := Vector3(cos(a0) * r_top, y_top, sin(a0) * r_top)
		var t1 := Vector3(cos(a1) * r_top, y_top, sin(a1) * r_top)

		# Side quad (2 triangles)
		st.add_vertex(b0)
		st.add_vertex(b1)
		st.add_vertex(t0)

		st.add_vertex(b1)
		st.add_vertex(t1)
		st.add_vertex(t0)

	# Top cap
	var top_center := Vector3(0.0, y_top, 0.0)
	for i in range(sides):
		var a0: float = i * angle_step
		var a1: float = (i + 1) * angle_step
		var t0 := Vector3(cos(a0) * r_top, y_top, sin(a0) * r_top)
		var t1 := Vector3(cos(a1) * r_top, y_top, sin(a1) * r_top)
		st.add_vertex(top_center)
		st.add_vertex(t0)
		st.add_vertex(t1)

	# Bottom cap
	var bot_center := Vector3(0.0, y_bot, 0.0)
	for i in range(sides):
		var a0: float = i * angle_step
		var a1: float = (i + 1) * angle_step
		var b0 := Vector3(cos(a0) * r_bot, y_bot, sin(a0) * r_bot)
		var b1 := Vector3(cos(a1) * r_bot, y_bot, sin(a1) * r_bot)
		st.add_vertex(bot_center)
		st.add_vertex(b1)
		st.add_vertex(b0)


# Add a low-poly sphere canopy (4+4 triangles = 8 tris, diamond/octahedron shape)
func _add_sphere_lowpoly(st: SurfaceTool, r: float, cy: float) -> void:
	var top := Vector3(0.0, cy + r, 0.0)
	var bot := Vector3(0.0, cy - r, 0.0)

	# 4-point equator
	var equator: Array = [
		Vector3(r, cy, 0.0),
		Vector3(0.0, cy, r),
		Vector3(-r, cy, 0.0),
		Vector3(0.0, cy, -r),
	]

	# Upper 4 triangles
	for i in range(4):
		var a: Vector3 = equator[i]
		var b: Vector3 = equator[(i + 1) % 4]
		st.add_vertex(top)
		st.add_vertex(a)
		st.add_vertex(b)

	# Lower 4 triangles
	for i in range(4):
		var a: Vector3 = equator[i]
		var b: Vector3 = equator[(i + 1) % 4]
		st.add_vertex(bot)
		st.add_vertex(b)
		st.add_vertex(a)


# Shoelace polygon area (signed)
func _polygon_area(verts: Array) -> float:
	var n: int = verts.size()
	var area: float = 0.0
	for i in range(n):
		var j: int = (i + 1) % n
		area += verts[i].x * verts[j].y
		area -= verts[j].x * verts[i].y
	return area * 0.5


# Point-in-polygon ray-casting test
func _point_in_polygon(pt: Vector2, verts: Array) -> bool:
	var n: int = verts.size()
	var inside: bool = false
	var j: int = n - 1

	for i in range(n):
		var xi: float = verts[i].x
		var yi: float = verts[i].y
		var xj: float = verts[j].x
		var yj: float = verts[j].y

		if ((yi > pt.y) != (yj > pt.y)) and \
			(pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi):
			inside = not inside
		j = i

	return inside

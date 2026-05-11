## island_generator.gd — Procedural island terrain using SurfaceTool.
## Same dome formula as Three.js world.js: height = (1 - dist^2 * 1.35) * peak + noise
extends Node3D

const GRID_RES: int = 32  # vertices per side per island

# Biome color thresholds (fraction of peak height)
const BEACH_FRAC: float = 0.04
const GRASS_FRAC: float = 0.09
const FOREST_FRAC: float = 0.45
const ROCK_FRAC: float = 0.80

var _island_meshes: Array[MeshInstance3D] = []

func _ready() -> void:
	_generate_all_islands()

func _generate_all_islands() -> void:
	var island_data: Array = []
	for def in Config.ISLAND_DEFS:
		var cx: float = def[0]
		var cz: float = def[1]
		var radius: float = def[2]
		var peak: float = def[3]
		var mi: MeshInstance3D = generate_island(Vector3(cx, 0.0, cz), peak, radius)
		add_child(mi)
		_island_meshes.append(mi)
		island_data.append({
			"center_x": cx,
			"center_z": cz,
			"radius": radius,
			"peak_height": peak,
		})
	# Share island data with MissionManager for collision queries
	MissionManager.island_data = island_data

func generate_island(center: Vector3, peak_height: float, radius: float) -> MeshInstance3D:
	var st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)

	var step: float = (radius * 2.2) / float(GRID_RES)
	var origin_x: float = center.x - radius * 1.1
	var origin_z: float = center.z - radius * 1.1

	# Build vertex grid
	var heights: Array = []
	for row in range(GRID_RES + 1):
		var row_arr: Array = []
		for col in range(GRID_RES + 1):
			var wx: float = origin_x + col * step
			var wz: float = origin_z + row * step
			var dx: float = wx - center.x
			var dz: float = wz - center.z
			var dist: float = sqrt(dx * dx + dz * dz)
			var norm: float = dist / radius
			var h: float = 0.0
			if norm < 1.05:
				# Dome formula
				var dome: float = (1.0 - norm * norm * 1.35) * peak_height
				# 4-octave noise
				var n: float = _noise4(wx * 0.04, wz * 0.04, peak_height)
				h = maxf(0.0, dome + n)
				# Fade edge to zero
				if norm > 0.85:
					h *= (1.0 - (norm - 0.85) / 0.20)
			row_arr.append(h)
		heights.append(row_arr)

	# Emit triangles with biome colors
	for row in range(GRID_RES):
		for col in range(GRID_RES):
			var wx00: float = origin_x + col * step
			var wz00: float = origin_z + row * step
			var h00: float = heights[row][col]
			var h10: float = heights[row][col + 1]
			var h01: float = heights[row + 1][col]
			var h11: float = heights[row + 1][col + 1]

			var p00 = Vector3(wx00, h00, wz00)
			var p10 = Vector3(wx00 + step, h10, wz00)
			var p01 = Vector3(wx00, h01, wz00 + step)
			var p11 = Vector3(wx00 + step, h11, wz00 + step)

			var avg_h: float = (h00 + h10 + h01 + h11) / 4.0
			var c: Color = _biome_color(avg_h, peak_height)

			_emit_tri(st, p00, p10, p11, c)
			_emit_tri(st, p00, p11, p01, c)

	st.generate_normals()
	var mesh: ArrayMesh = st.commit()
	var mi = MeshInstance3D.new()
	mi.mesh = mesh
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON

	# Add StaticBody for terrain collision
	var sb = StaticBody3D.new()
	var cshape = CollisionShape3D.new()
	var heightmap = HeightMapShape3D.new()
	# Build heightmap data
	var hm_data: PackedFloat32Array = PackedFloat32Array()
	for row in range(GRID_RES + 1):
		for col in range(GRID_RES + 1):
			hm_data.append(heights[row][col])
	heightmap.map_data = hm_data
	heightmap.map_width = GRID_RES + 1
	heightmap.map_depth = GRID_RES + 1
	cshape.shape = heightmap
	# Position heightmap at island center
	cshape.position = Vector3(
		center.x,
		0.0,
		center.z
	)
	cshape.scale = Vector3(step, 1.0, step)
	sb.add_child(cshape)
	mi.add_child(sb)

	return mi

func _emit_tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, col: Color) -> void:
	var n: Vector3 = (b - a).cross(c - a).normalized()
	st.set_color(col)
	st.set_normal(n)
	st.add_vertex(a)
	st.set_color(col)
	st.set_normal(n)
	st.add_vertex(b)
	st.set_color(col)
	st.set_normal(n)
	st.add_vertex(c)

func _biome_color(h: float, peak: float) -> Color:
	var frac: float = h / maxf(peak, 1.0)
	if h < 0.5:
		return Color(0.76, 0.7, 0.5)   # sand / ocean floor
	if frac < BEACH_FRAC:
		return Color(0.82, 0.76, 0.54)  # beach
	if frac < GRASS_FRAC:
		return Color(0.47, 0.67, 0.29)  # grass
	if frac < FOREST_FRAC:
		return Color(0.22, 0.45, 0.18)  # forest
	if frac < ROCK_FRAC:
		return Color(0.49, 0.46, 0.42)  # rock
	return Color(0.92, 0.94, 0.97)      # snow

## 4-octave value noise approximation (no external library needed)
func _noise4(x: float, z: float, scale: float) -> float:
	var amp: float = scale * 0.08
	var freq: float = 1.0
	var val: float = 0.0
	for _i in range(4):
		val += _vnoise(x * freq, z * freq) * amp
		amp *= 0.5
		freq *= 2.0
	return val

func _vnoise(x: float, z: float) -> float:
	var ix: int = int(floor(x))
	var iz: int = int(floor(z))
	var fx: float = x - floor(x)
	var fz: float = z - floor(z)
	# Smooth interpolation
	fx = fx * fx * (3.0 - 2.0 * fx)
	fz = fz * fz * (3.0 - 2.0 * fz)
	var a: float = _hash(ix, iz)
	var b: float = _hash(ix + 1, iz)
	var c: float = _hash(ix, iz + 1)
	var d: float = _hash(ix + 1, iz + 1)
	return lerp(lerp(a, b, fx), lerp(c, d, fx), fz)

func _hash(x: int, z: int) -> float:
	var n: int = x * 1619 + z * 31337
	n = (n >> 13) ^ n
	n = (n * (n * n * 60493 + 19990303) + 1376312589) & 0x7fffffff
	return float(n) / float(0x7fffffff) * 2.0 - 1.0

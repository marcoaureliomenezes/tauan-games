class_name InhaumaTerrain
extends Node3D
## InhaumaTerrain — malha do terreno em chunks com cores de bioma por vértice.
## Port do sistema de chunks do web (inhauma-scene.js), estático na v0.1:
## cobre a área jogável central; o fog (900/2600 m) esconde a borda.
## TODO(v0.2): reciclagem de chunks ao redor do avião (terreno "infinito").

const CHUNK_SIZE := 800.0
const CHUNK_VERTS := 32 # 32x32 quads por chunk (passo 25 m — era 48/16,7 m; Wave I)
const REGION_CENTER := Vector2(-300, 300)
const REGION_CHUNKS := 8 # 8x8 chunks = 6,4 km² cobertos

var heightmap: InhaumaHeightmap

var _snow_noise := FastNoiseLite.new()
var _patch_noise := FastNoiseLite.new()
var _dither_noise := FastNoiseLite.new()

# Constantes do biomeColor web (inhauma-scene.js:264-285)
const SNOW_LINE_M := 800.0
const SNOW_LINE_JITTER_M := 90.0
const SNOW_SLOPE_LIFT_M := 140.0
const SNOW_EDGE_BAND_M := 70.0
const ROCK_LINE_M := 480.0
const STEEP_SLOPE := 0.45
const VERY_STEEP_SLOPE := 0.8
const ROCK_PATCH_MIN_SLOPE := 0.16
const ROCK_PATCH_JITTER := 0.30

# Cores de bioma (altitude/slope — inhauma-scene.js biomas por vértice)
const C_SAND := Color(0.82, 0.75, 0.55)
const C_FIELD := Color(0.35, 0.55, 0.25)
const C_FOREST := Color(0.20, 0.40, 0.16)
const C_SUBALPINE := Color(0.28, 0.40, 0.22)
const C_ALPINE := Color(0.45, 0.42, 0.35)
const C_ROCK := Color(0.45, 0.43, 0.40)
const C_SNOW := Color(0.92, 0.93, 0.95)


func _init(p_heightmap: InhaumaHeightmap = null) -> void:
	heightmap = p_heightmap


func _ready() -> void:
	if heightmap == null:
		heightmap = InhaumaHeightmap.new()
	_snow_noise.seed = 411
	_snow_noise.frequency = 0.0009
	_snow_noise.fractal_octaves = 3
	_patch_noise.seed = 412
	_patch_noise.frequency = 0.006
	_patch_noise.fractal_octaves = 3
	_dither_noise.seed = 413
	_dither_noise.frequency = 0.05
	_dither_noise.fractal_octaves = 2
	_build_all()


func _build_all() -> void:
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.95
	mat.albedo_texture = _bake_detail_texture() # ruído de detalhe multiplicativo
	var half := REGION_CHUNKS * CHUNK_SIZE * 0.5
	var origin := REGION_CENTER - Vector2(half, half)
	for cz in REGION_CHUNKS:
		for cx in REGION_CHUNKS:
			var chunk_origin := origin + Vector2(cx, cz) * CHUNK_SIZE
			var mi := MeshInstance3D.new()
			mi.mesh = _build_chunk_mesh(chunk_origin)
			mi.material_override = mat
			mi.name = "Chunk_%d_%d" % [cx, cz]
			add_child(mi)


## Textura de detalhe em tons de cinza (~0,85-1,10) — multiplica o vertex color
## do bioma sem mudar a cor base (como o canvas detail do inhauma-terrain-texture.js).
func _bake_detail_texture() -> ImageTexture:
	const SIZE := 256 # tiling a cada 18 m — 256² é indistinguível a 512² à distância
	var n1 := FastNoiseLite.new()
	n1.seed = 555
	n1.frequency = 4.0 / SIZE # granulado fino
	n1.fractal_octaves = 4
	var n2 := FastNoiseLite.new()
	n2.seed = 556
	n2.frequency = 0.4 / SIZE # variação de média escala (manchas)
	n2.fractal_octaves = 3
	var img := Image.create(SIZE, SIZE, false, Image.FORMAT_L8)
	for y in SIZE:
		for x in SIZE:
			var fine: float = n1.get_noise_2d(x, y) * 0.5 + 0.5
			var mid: float = n2.get_noise_2d(x, y) * 0.5 + 0.5
			var v := clampf(0.82 + fine * 0.18 + (mid - 0.5) * 0.14, 0.0, 1.0)
			img.set_pixel(x, y, Color(v, v, v))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)


func _build_chunk_mesh(chunk_origin: Vector2) -> ArrayMesh:
	var step := CHUNK_SIZE / CHUNK_VERTS
	var n := CHUNK_VERTS + 1
	# Alturas computadas UMA vez por vértice; normais/cores derivam da grade
	# (antes eram ~9 chamadas de height_at por vértice — gargalo do boot).
	var heights := PackedFloat32Array()
	heights.resize(n * n)
	for iz in n:
		for ix in n:
			heights[iz * n + ix] = heightmap.height_at(
				chunk_origin.x + ix * step, chunk_origin.y + iz * step)
	var verts := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	var uvs := PackedVector2Array()
	var indices := PackedInt32Array()
	verts.resize(n * n)
	normals.resize(n * n)
	colors.resize(n * n)
	uvs.resize(n * n)
	for iz in n:
		for ix in n:
			var wx: float = chunk_origin.x + ix * step
			var wz: float = chunk_origin.y + iz * step
			var i := iz * n + ix
			var h: float = heights[i]
			verts[i] = Vector3(wx, h, wz)
			uvs[i] = Vector2(wx / 18.0, wz / 18.0) # tile de detalhe a cada 18 m
			# Normal e slope pela grade renderizada (mesh == colisão)
			var hxp: float = heights[iz * n + mini(ix + 1, n - 1)]
			var hxm: float = heights[iz * n + maxi(ix - 1, 0)]
			var hzp: float = heights[mini(iz + 1, n - 1) * n + ix]
			var hzm: float = heights[maxi(iz - 1, 0) * n + ix]
			var dhdx: float = (hxp - hxm) / (2.0 * step)
			var dhdz: float = (hzp - hzm) / (2.0 * step)
			normals[i] = Vector3(-dhdx, 1.0, -dhdz).normalized()
			colors[i] = _biome_color_grid(h, Vector2(dhdx, dhdz).length(), wx, wz)
	for iz in CHUNK_VERTS:
		for ix in CHUNK_VERTS:
			var a := iz * n + ix
			var b := a + 1
			var c := a + n
			var d := c + 1
			# Winding horário visto de cima (front face Godot = clockwise)
			indices.append_array([a, b, c, b, d, c])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh


## Port exato do biomeColor() do web (inhauma-scene.js): rocha exposta (incl.
## patches por ruído), 5 bandas de vegetação, neve blendada com jitter de cota
## e lift por inclinação, dither de rocha anti-banding.
func _biome_color_grid(h: float, slope: float, x: float, z: float) -> Color:
	var c: Color
	if _is_exposed_rock(h, slope, x, z):
		var dark := VERY_STEEP_SLOPE_FACTOR if slope >= VERY_STEEP_SLOPE else 1.0
		var dither := _dither_noise.get_noise_2d(x + 61000.0, z + 52000.0) * 0.06
		c = Color((0.40 + dither) * dark, (0.35 + dither) * dark, (0.30 + dither) * dark)
	elif h < GameConfig.MAP_WATER_Y + 1.5:
		c = Color(0.74, 0.68, 0.46) # areia/margem
	elif h < 18.0:
		c = Color(0.16, 0.55, 0.16) # campo verde vivo (vale)
	elif h < 48.0:
		c = Color(0.12, 0.40, 0.14) # mata densa
	elif h < 180.0:
		c = Color(0.24, 0.37, 0.19) # mata rala / subalpina
	else:
		c = Color(0.34, 0.38, 0.25) # campo alpino / rocha esparsa
	# Neve blendada por cima (jitter de cota + lift por inclinação)
	var snow_line: float = SNOW_LINE_M + _snow_noise.get_noise_2d(x - 20000.0, z + 15000.0) * SNOW_LINE_JITTER_M + slope * SNOW_SLOPE_LIFT_M
	var snow_t := clampf((h - snow_line) / SNOW_EDGE_BAND_M + 0.5, 0.0, 1.0)
	snow_t = snow_t * snow_t * (3.0 - 2.0 * snow_t)
	if slope >= VERY_STEEP_SLOPE:
		snow_t = 0.0
	if snow_t > 0.0:
		var t := minf(1.0, slope / STEEP_SLOPE)
		var snow := Color(0.93 - t * 0.09, 0.95 - t * 0.08, 0.97 - t * 0.04)
		c = c.lerp(snow, snow_t)
	return c


const VERY_STEEP_SLOPE_FACTOR := 0.78


func _is_exposed_rock(h: float, slope: float, x: float, z: float) -> bool:
	if slope >= STEEP_SLOPE or h > ROCK_LINE_M:
		return true
	if slope < ROCK_PATCH_MIN_SLOPE:
		return false
	var patch: float = (_patch_noise.get_noise_2d(x + 71000.0, z - 63000.0) + 1.0) * 0.5
	return slope + patch * ROCK_PATCH_JITTER >= STEEP_SLOPE

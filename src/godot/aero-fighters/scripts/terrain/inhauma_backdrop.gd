class_name InhaumaBackdrop
extends Node3D
## InhaumaBackdrop — anéis de montanhas de fundo (port de inhauma-backdrop.js):
## 3 anéis ridged a 3,5-5,8 km, puramente visual (sem colisão, fog cobre).

const RINGS := [
	{"r_in": 3400.0, "r_out": 4100.0, "h_max": 550.0},
	{"r_in": 4300.0, "r_out": 5000.0, "h_max": 750.0},
	{"r_in": 5100.0, "r_out": 5800.0, "h_max": 950.0},
]
const SEGMENTS := 96


func _ready() -> void:
	var noise := FastNoiseLite.new()
	noise.seed = 909
	noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	noise.frequency = 1.0 / 900.0
	noise.fractal_type = FastNoiseLite.FRACTAL_RIDGED
	noise.fractal_octaves = 4
	var verts := PackedVector3Array()
	var colors := PackedColorArray()
	var indices := PackedInt32Array()
	var rock := Color(0.42, 0.40, 0.38)
	var snow := Color(0.85, 0.87, 0.9)
	# Neblina manual: os anéis ficam ALÉM do fog far (3,4-5,8 km > 2600/3400 m) —
	# com fog normal eles sumiriam; o material desliga o fog e as cores já vêm
	# esmaecidas (Wave G — "as montanhas não podem aparecer e desaparecer")
	var haze := GameConfig.FOG_COLOR
	var vi := 0
	for ring in RINGS:
		var base_vi := vi
		var haze_t: float = 0.45 + 0.25 * (ring.r_in / 5800.0)
		for i in SEGMENTS + 1:
			var a := (float(i) / SEGMENTS) * TAU
			var dir := Vector2(cos(a), sin(a))
			var ridge: float = (noise.get_noise_2d(dir.x * 3000.0 + ring.r_in, dir.y * 3000.0) + 1.0) * 0.5
			var h: float = ring.h_max * (0.35 + 0.65 * ridge)
			var p_in := Vector3(dir.x * ring.r_in, -30, dir.y * ring.r_in)
			var p_mid := Vector3(dir.x * (ring.r_in + ring.r_out) * 0.5, h, dir.y * (ring.r_in + ring.r_out) * 0.5)
			var p_out := Vector3(dir.x * ring.r_out, -20, dir.y * ring.r_out)
			verts.append_array([p_in, p_mid, p_out])
			colors.append_array([
				rock.lerp(haze, haze_t),
				rock.lerp(snow, clampf(h / ring.h_max - 0.35, 0.0, 1.0)).lerp(haze, haze_t),
				rock.lerp(haze, haze_t)])
			vi += 3
		for i in SEGMENTS:
			var a0 := base_vi + i * 3
			# Duas faixas de triângulos (in→mid, mid→out)
			indices.append_array([a0, a0 + 3, a0 + 1, a0 + 1, a0 + 3, a0 + 4])
			indices.append_array([a0 + 1, a0 + 4, a0 + 2, a0 + 2, a0 + 4, a0 + 5])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_COLOR] = colors
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 1.0
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.disable_fog = true # neblina já embutida nas cores (Wave G — sem pop)
	mi.material_override = mat
	mi.name = "BackdropRings"
	add_child(mi)

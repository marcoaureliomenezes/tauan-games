class_name RouteBuilder
extends Node3D
## Constrói uma rota cidade-a-cidade (curva ABERTA) a partir de GameState.ROUTES:
## estrada via Road Generator com trechos tipados (rodovia duplicada, pista
## simples, terra, travessia de riacho), guard-rails nos trechos asfaltados,
## checkpoints, cidades nas duas pontas, terreno low-poly, montanhas de fundo.

const RoadContainerScript := preload("res://addons/road-generator/nodes/road_container.gd")
const RoadManagerScript := preload("res://addons/road-generator/nodes/road_manager.gd")
const RoadPointScript := preload("res://addons/road-generator/nodes/road_point.gd")

const CHECKPOINT_COUNT := 6
const WALL_STEP := 4.0
const TERRAIN_RES := 150
const RP_SPACING := 19.0
const XZ_CELL := 32.0

const SEGMENT_SPECS := {
	"dual":
	{
		"lanes": 4,
		"lane_width": 3.9,
		"shoulder": 1.4,
		"wall": 11.0,
		"color": Color(0.16, 0.16, 0.17)
	},
	"single":
	{"lanes": 2, "lane_width": 3.7, "shoulder": 1.0, "wall": 7.2, "color": Color(0.18, 0.18, 0.19)},
	"dirt":
	{"lanes": 2, "lane_width": 3.4, "shoulder": 0.8, "wall": 0.0, "color": Color(0.48, 0.36, 0.22)},
	"ford":
	{"lanes": 2, "lane_width": 3.4, "shoulder": 0.8, "wall": 0.0, "color": Color(0.42, 0.33, 0.22)},
}

var curve := Curve3D.new()
var track_len := 0.0
var checkpoints: Array[Area3D] = []
var finish_s := 0.0

var _def: Dictionary = {}
var _noise := FastNoiseLite.new()
var _terrain_center := Vector3.ZERO
var _terrain_size := 2000.0
var _xz_samples: PackedVector3Array = PackedVector3Array()
var _xz_grid := {}


func build(def: Dictionary) -> void:
	_def = def
	_noise.seed = int(def["seed"])
	_noise.frequency = 1.0 / float(def["base_scale"])
	_noise.fractal_octaves = 4
	_build_curve()
	_build_environment()
	_build_roads()
	_build_walls()
	_build_fords()
	_build_checkpoints()
	_build_cities()
	_build_terrain()
	_build_far_mountains()
	_build_scenery()


func segment_type_at(s: float) -> String:
	var frac := clampf(s / track_len, 0.0, 1.0)
	for seg: Dictionary in _def["segments"]:
		if frac <= float(seg["until"]) + 0.0001:
			return seg["type"]
	return "single"


func road_half_width_at(s: float) -> float:
	var spec: Dictionary = SEGMENT_SPECS[segment_type_at(s)]
	return float(spec["lanes"]) * float(spec["lane_width"]) * 0.5 + float(spec["shoulder"])


func closest_route_point_xz(x: float, z: float) -> Vector3:
	# Ponto da rota mais próximo em XZ (grade espacial — get_closest_point do
	# Curve3D compara em 3D e desalinha o corredor onde a rota sobe/desce).
	var cell := Vector2i(int(floor(x / XZ_CELL)), int(floor(z / XZ_CELL)))
	var best := Vector3.ZERO
	var best_d := INF
	for ring in 40:
		for cy in range(cell.y - ring, cell.y + ring + 1):
			for cx in range(cell.x - ring, cell.x + ring + 1):
				if maxi(absi(cx - cell.x), absi(cy - cell.y)) != ring:
					continue
				for idx: int in _xz_grid.get(Vector2i(cx, cy), []):
					var p := _xz_samples[idx]
					var d := Vector2(x, z).distance_squared_to(Vector2(p.x, p.z))
					if d < best_d:
						best_d = d
						best = p
		if best_d < INF and float(ring) * XZ_CELL > sqrt(best_d):
			break
	return best


func height_at(x: float, z: float) -> float:
	var h := _noise.get_noise_2d(x, z) * float(_def["amplitude"])
	var closest := closest_route_point_xz(x, z)
	var flat_d := Vector2(x, z).distance_to(Vector2(closest.x, closest.z))
	var blend := clampf((flat_d - 15.0) / 50.0, 0.0, 1.0)
	return lerpf(closest.y - 0.35, h + 4.0, blend)


func point_at(s: float) -> Vector3:
	return curve.sample_baked(clampf(s, 0.0, track_len))


func lane_center_offset(s: float) -> float:
	# Distância lateral do centro da estrada até o meio da faixa da direita
	# (magnitude; cada sentido aplica à direita do próprio deslocamento).
	var spec: Dictionary = SEGMENT_SPECS[segment_type_at(s)]
	var w := float(spec["lane_width"])
	return w * 1.0 if int(spec["lanes"]) >= 4 else w * 0.5


func start_grid_transform(slot: int) -> Transform3D:
	var s := clampf(14.0 + 8.0 * float(slot), 4.0, track_len - 10.0)
	var pos := point_at(s)
	var ahead := point_at(s + 3.0)
	var side := (ahead - pos).cross(Vector3.UP).normalized()
	var lane := 1.9 if slot % 2 == 0 else -1.9
	# Carros M.A.V.S têm o nariz no +Z: -Z aponta para TRÁS.
	var basis := Basis.looking_at(pos - ahead, Vector3.UP)
	return Transform3D(basis, pos + side * lane + Vector3.UP * 1.2)


func _build_curve() -> void:
	var pts: Array = _def["points"]
	var base := Curve3D.new()
	base.closed = false
	base.bake_interval = 2.0
	for i in pts.size():
		var prev: Vector3 = pts[maxi(i - 1, 0)]
		var next: Vector3 = pts[mini(i + 1, pts.size() - 1)]
		var tangent := (next - prev) * 0.22
		base.add_point(pts[i], -tangent, tangent)
	var base_len := base.get_baked_length()
	# Resample denso + LOMBADAS/CRISTAS: subidas que terminam em quebra seca —
	# em velocidade o carro sai do chão no início da descida.
	var crests: Array = _def.get("crests", [])
	var samples: Array[Vector3] = []
	var step := 24.0
	var n := int(base_len / step)
	for i in n + 1:
		var s := base_len * float(i) / float(n)
		var p := base.sample_baked(s)
		for crest_frac: float in crests:
			var d := absf(s / base_len - crest_frac) * base_len
			if d < 60.0:
				# Rampa assimétrica: sobe suave (gauss), corta rápido no topo.
				p.y += 6.5 * exp(-pow(d / 26.0, 2.0))
		samples.append(p)
	curve.closed = false
	curve.bake_interval = 2.0
	for i in samples.size():
		var prev := samples[maxi(i - 1, 0)]
		var next := samples[mini(i + 1, samples.size() - 1)]
		var tangent := (next - prev) * 0.3
		curve.add_point(samples[i], -tangent, tangent)
	track_len = curve.get_baked_length()
	finish_s = track_len - 30.0
	_xz_samples.clear()
	_xz_grid.clear()
	var s_acc := 0.0
	while s_acc <= track_len:
		var p := curve.sample_baked(s_acc)
		var idx := _xz_samples.size()
		_xz_samples.append(p)
		var key := Vector2i(int(floor(p.x / XZ_CELL)), int(floor(p.z / XZ_CELL)))
		if key not in _xz_grid:
			_xz_grid[key] = []
		_xz_grid[key].append(idx)
		s_acc += 5.0
	var acc := Vector3.ZERO
	for i in curve.point_count:
		acc += curve.get_point_position(i)
	_terrain_center = acc / float(curve.point_count)
	var first: Vector3 = pts[0]
	var last: Vector3 = pts[pts.size() - 1]
	_terrain_size = maxf(first.distance_to(last), track_len * 0.62) + 900.0


func _build_environment() -> void:
	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.light_intensity_lux = float(_def["sun_energy_lux"])
	sun.light_temperature = float(_def["sun_temperature"])
	sun.rotation_degrees = Vector3(float(_def["sun_angle"]), 35.0, 0.0)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 300.0
	add_child(sun)

	var sky_mat := PhysicalSkyMaterial.new()
	sky_mat.rayleigh_color = _def["horizon_color"]
	var sky := Sky.new()
	sky.sky_material = sky_mat
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.fog_enabled = true
	env.fog_density = float(_def["fog_density"])
	env.fog_light_color = _def["horizon_color"]
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	var world_env := WorldEnvironment.new()
	world_env.name = "WorldEnv"
	world_env.environment = env
	add_child(world_env)
	_build_clouds()


func _build_clouds() -> void:
	# Céu azul com nuvens low-poly (esferas achatadas brancas bem no alto).
	var rng := RandomNumberGenerator.new()
	rng.seed = int(_def["seed"]) * 17 + 3
	var puff := SphereMesh.new()
	puff.radius = 30.0
	puff.height = 16.0
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.98, 0.98, 1.0, 0.92)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	puff.material = mat
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = puff
	var count := 40
	mm.instance_count = count
	for i in count:
		var p := (
			_terrain_center
			+ Vector3(
				rng.randf_range(-_terrain_size, _terrain_size) * 0.8,
				rng.randf_range(170.0, 260.0),
				rng.randf_range(-_terrain_size, _terrain_size) * 0.8
			)
		)
		var sc := Vector3(
			rng.randf_range(1.0, 3.2), rng.randf_range(0.5, 1.0), rng.randf_range(1.0, 2.2)
		)
		mm.set_instance_transform(i, Transform3D(Basis.IDENTITY.scaled(sc), p))
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	add_child(mmi)


func _run_bounds() -> Array:
	# Converte os segmentos em runs [s_ini, s_fim, tipo].
	var runs: Array = []
	var start := 0.0
	for seg: Dictionary in _def["segments"]:
		var end_s: float = float(seg["until"]) * track_len
		runs.append([start, end_s, seg["type"]])
		start = end_s
	return runs


func _build_roads() -> void:
	var manager: Node3D = RoadManagerScript.new()
	manager.name = "RoadManager"
	add_child(manager)
	var run_idx := 0
	for run: Array in _run_bounds():
		var spec: Dictionary = SEGMENT_SPECS[run[2]]
		var container: Node3D = RoadContainerScript.new()
		container.name = "Run%d_%s" % [run_idx, run[2]]
		manager.add_child(container)
		container.create_geo = true
		container.generate_ai_lanes = false
		var mat := StandardMaterial3D.new()
		mat.albedo_color = spec["color"]
		mat.roughness = 1.0
		if run[2] == "dirt" or run[2] == "ford":
			container.material_resource = mat
		_fill_run(container, run[0], run[1], spec)
		run_idx += 1


func _fill_run(container: Node3D, s_from: float, s_to: float, spec: Dictionary) -> void:
	var length := s_to - s_from
	var n := maxi(2, int(length / RP_SPACING) + 1)
	var rps: Array = []
	for i in n:
		var s := s_from + length * float(i) / float(n - 1)
		s = minf(s, track_len - 0.5)
		var rp: Node3D = RoadPointScript.new()
		container.add_child(rp)
		rp.name = "RP%03d" % i
		rp.traffic_dir.clear()
		rp.lanes.clear()
		var lanes := int(spec["lanes"])
		for l in lanes:
			var fwd := l >= lanes / 2
			rp.traffic_dir.append(
				RoadPointScript.LaneDir.FORWARD if fwd else RoadPointScript.LaneDir.REVERSE
			)
			rp.lanes.append(RoadPointScript.LaneType.FAST if fwd else RoadPointScript.LaneType.SLOW)
		rp.lane_width = float(spec["lane_width"])
		rp.shoulder_width_l = float(spec["shoulder"])
		rp.shoulder_width_r = float(spec["shoulder"])
		var pos := point_at(s)
		var ahead := point_at(minf(s + 3.0, track_len))
		if ahead.distance_to(pos) < 0.5:
			ahead = pos + (pos - point_at(maxf(s - 3.0, 0.0)))
		rp.global_transform = Transform3D(Basis.looking_at(ahead - pos, Vector3.UP), pos)
		rps.append(rp)
	for i in rps.size():
		var rp: Node3D = rps[i]
		if i > 0:
			rp.prior_pt_init = rp.get_path_to(rps[i - 1])
		if i < rps.size() - 1:
			rp.next_pt_init = rp.get_path_to(rps[i + 1])
	if container.has_method("rebuild_segments"):
		container.rebuild_segments(true)


func _build_walls() -> void:
	# Contenção CONTÍNUA: o carro fica limitado à rodovia da cidade A à B.
	# Visual por trecho (guard-rail zebrado no asfalto, cerca de madeira na
	# terra) + parede de colisão alta invisível sem NENHUM vão.
	var walls := StaticBody3D.new()
	walls.name = "Walls"
	add_child(walls)
	var rail_mesh := BoxMesh.new()
	rail_mesh.size = Vector3(0.35, 0.6, WALL_STEP * 1.35)
	var rail_mat := StandardMaterial3D.new()
	rail_mat.vertex_color_use_as_albedo = true
	rail_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	rail_mesh.material = rail_mat
	var wood_mesh := BoxMesh.new()
	wood_mesh.size = Vector3(0.18, 1.0, WALL_STEP * 1.35)
	var wood_mat := StandardMaterial3D.new()
	wood_mat.albedo_color = Color(0.42, 0.28, 0.14)
	wood_mesh.material = wood_mat
	for side: float in [-1.0, 1.0]:
		var rail_t: Array[Transform3D] = []
		var rail_c: Array[Color] = []
		var wood_t: Array[Transform3D] = []
		var i := 0
		var s := 0.0
		while s < track_len - 1.0:
			var seg_type := segment_type_at(s + WALL_STEP * 0.5)
			var wall_off := road_half_width_at(s + WALL_STEP * 0.5) + 1.7
			var pos := point_at(s)
			var ahead := point_at(minf(s + WALL_STEP, track_len))
			var dir := ahead - pos
			if dir.length() < 0.1:
				break
			var lat := Vector3(dir.x, 0, dir.z).normalized().cross(Vector3.UP)
			var base := (pos + ahead) * 0.5 + lat * wall_off * side
			base.y = (pos.y + ahead.y) * 0.5
			# Segue o declive da pista (sem degraus nem barreira flutuando).
			var basis := Basis.looking_at(dir.normalized(), Vector3.UP)
			var paved := seg_type == "dual" or seg_type == "single"
			var t := Transform3D(basis, base + Vector3.UP * (0.55 if paved else 0.5))
			if paved:
				rail_t.append(t)
				rail_c.append(Color.RED if i % 2 == 0 else Color.WHITE)
			else:
				wood_t.append(t)
			# Colisão contínua e alta (invisível) — nada atravessa nem pula.
			var shape := CollisionShape3D.new()
			var box := BoxShape3D.new()
			box.size = Vector3(0.4, 3.2, WALL_STEP * 1.4)
			shape.shape = box
			shape.transform = Transform3D(basis, base + Vector3.UP * 1.4)
			walls.add_child(shape)
			s += WALL_STEP
			i += 1
		for pack: Array in [[rail_mesh, rail_t, rail_c], [wood_mesh, wood_t, []]]:
			var transforms: Array = pack[1]
			if transforms.is_empty():
				continue
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.use_colors = not (pack[2] as Array).is_empty()
			mm.mesh = pack[0]
			mm.instance_count = transforms.size()
			var mmi := MultiMeshInstance3D.new()
			mmi.multimesh = mm
			walls.add_child(mmi)
			for j in transforms.size():
				mm.set_instance_transform(j, transforms[j])
				if mm.use_colors:
					mm.set_instance_color(j, pack[2][j])
	_build_tree_fences()


func _build_tree_fences() -> void:
	# "Cerca viva": fileira densa de árvores margeando os trechos de terra.
	var crown := SphereMesh.new()
	crown.radius = 1.9
	crown.height = 3.6
	var mat := StandardMaterial3D.new()
	mat.albedo_color = (_def["tree_color"] as Color).darkened(0.15)
	crown.material = mat
	var transforms: Array[Transform3D] = []
	for side: float in [-1.0, 1.0]:
		var s := 0.0
		while s < track_len - 1.0:
			if segment_type_at(s) in ["dirt", "ford"]:
				var pos := point_at(s)
				var ahead := point_at(minf(s + 3.0, track_len))
				var lat := (ahead - pos).cross(Vector3.UP).normalized()
				var p := pos + lat * (road_half_width_at(s) + 5.0) * side
				transforms.append(
					Transform3D(Basis.IDENTITY, Vector3(p.x, height_at(p.x, p.z) + 2.4, p.z))
				)
			s += 7.0
	if transforms.is_empty():
		return
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = crown
	mm.instance_count = transforms.size()
	for j in transforms.size():
		mm.set_instance_transform(j, transforms[j])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	add_child(mmi)


func _build_fords() -> void:
	# Água rasa cruzando a estrada nos trechos "ford".
	var water_mat := StandardMaterial3D.new()
	water_mat.albedo_color = Color(0.25, 0.5, 0.65, 0.72)
	water_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	water_mat.roughness = 0.1
	water_mat.metallic = 0.4
	for run: Array in _run_bounds():
		if run[2] != "ford":
			continue
		var mid := (float(run[0]) + float(run[1])) * 0.5
		var length := float(run[1]) - float(run[0])
		var pos := point_at(mid)
		var ahead := point_at(mid + 2.0)
		var dir := (ahead - pos).normalized()
		var mesh := PlaneMesh.new()
		mesh.size = Vector2(90.0, length + 14.0)
		mesh.material = water_mat
		var water := MeshInstance3D.new()
		water.mesh = mesh
		water.global_transform = Transform3D(
			Basis.looking_at(dir, Vector3.UP), pos + Vector3.UP * 0.12
		)
		add_child(water)


func _build_checkpoints() -> void:
	for i in CHECKPOINT_COUNT:
		var s := track_len * float(i + 1) / float(CHECKPOINT_COUNT)
		s = minf(s, finish_s)
		var pos := point_at(s)
		var ahead := point_at(minf(s + 2.0, track_len))
		if ahead.distance_to(pos) < 0.5:
			ahead = pos + Vector3.FORWARD
		var area := Area3D.new()
		area.name = "Checkpoint%d" % i
		area.collision_mask = 0xFFFFFFFF
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(46.0, 10.0, 3.0)
		shape.shape = box
		area.add_child(shape)
		area.global_transform = Transform3D(
			Basis.looking_at(ahead - pos, Vector3.UP), pos + Vector3.UP * 3.0
		)
		add_child(area)
		checkpoints.append(area)


func _build_cities() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = int(_def["seed"]) * 13 + 5
	for city: Array in [[0.0, _def["city_a"]], [track_len, _def["city_b"]]]:
		var s: float = city[0]
		var anchor := point_at(clampf(s, 20.0, track_len - 20.0))
		var ahead := point_at(clampf(s + 4.0, 0.0, track_len))
		var back := point_at(clampf(s - 4.0, 0.0, track_len))
		var dir := (ahead - back).normalized()
		var lat := dir.cross(Vector3.UP).normalized()
		for b in 26:
			var side := -1.0 if b % 2 == 0 else 1.0
			var along := rng.randf_range(-30.0, 140.0) * (1.0 if s < 1.0 else -1.0)
			var lateral := rng.randf_range(16.0, 90.0) * side
			var p := anchor + dir * along + lat * lateral
			var w := rng.randf_range(6.0, 14.0)
			var h := rng.randf_range(5.0, 18.0)
			var mesh := BoxMesh.new()
			mesh.size = Vector3(w, h, rng.randf_range(6.0, 14.0))
			var mat := StandardMaterial3D.new()
			mat.albedo_color = Color(
				rng.randf_range(0.55, 0.9), rng.randf_range(0.5, 0.85), rng.randf_range(0.5, 0.8)
			)
			mesh.material = mat
			var mi := MeshInstance3D.new()
			mi.mesh = mesh
			mi.position = Vector3(p.x, height_at(p.x, p.z) + h * 0.5 - 1.0, p.z)
			add_child(mi)


func _build_terrain() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var step := _terrain_size / float(TERRAIN_RES)
	var half := _terrain_size * 0.5
	var n_verts := (TERRAIN_RES + 1) * (TERRAIN_RES + 1)
	# Passo 1: ruído base em todos os vértices (rápido).
	var heights := PackedFloat32Array()
	heights.resize(n_verts)
	for iz in TERRAIN_RES + 1:
		for ix in TERRAIN_RES + 1:
			var x := _terrain_center.x - half + float(ix) * step
			var z := _terrain_center.z - half + float(iz) * step
			heights[iz * (TERRAIN_RES + 1) + ix] = (
				_noise.get_noise_2d(x, z) * float(_def["amplitude"]) + 4.0
			)
	# Passo 2: carimbo do corredor — cada amostra da rota abaixa/nivela os
	# vértices num raio de 65 m (evita 23k buscas de vizinho por vértice).
	var best_d := PackedFloat32Array()
	best_d.resize(n_verts)
	var route_y := PackedFloat32Array()
	route_y.resize(n_verts)
	for i in n_verts:
		best_d[i] = 1e12
	var reach := int(ceil(65.0 / step)) + 1
	for p in _xz_samples:
		var cx := int(round((p.x - _terrain_center.x + half) / step))
		var cz := int(round((p.z - _terrain_center.z + half) / step))
		for iz in range(maxi(cz - reach, 0), mini(cz + reach, TERRAIN_RES) + 1):
			for ix in range(maxi(cx - reach, 0), mini(cx + reach, TERRAIN_RES) + 1):
				var x := _terrain_center.x - half + float(ix) * step
				var z := _terrain_center.z - half + float(iz) * step
				var d2 := Vector2(x, z).distance_squared_to(Vector2(p.x, p.z))
				var idx := iz * (TERRAIN_RES + 1) + ix
				if d2 < best_d[idx]:
					best_d[idx] = d2
					route_y[idx] = p.y
	for i in n_verts:
		if best_d[i] < 1e11:
			var blend := clampf((sqrt(best_d[i]) - 15.0) / 50.0, 0.0, 1.0)
			heights[i] = lerpf(route_y[i] - 0.6, heights[i], blend)
	for iz in TERRAIN_RES:
		for ix in TERRAIN_RES:
			var corners := [
				Vector2i(ix, iz),
				Vector2i(ix + 1, iz),
				Vector2i(ix + 1, iz + 1),
				Vector2i(ix, iz),
				Vector2i(ix + 1, iz + 1),
				Vector2i(ix, iz + 1),
			]
			for c: Vector2i in corners:
				var h := heights[c.y * (TERRAIN_RES + 1) + c.x]
				var v := Vector3(
					_terrain_center.x - half + float(c.x) * step,
					h,
					_terrain_center.z - half + float(c.y) * step
				)
				st.set_color(_terrain_color(h))
				st.add_vertex(v)
	st.generate_normals()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 1.0
	var mesh := st.commit()
	mesh.surface_set_material(0, mat)
	var body := StaticBody3D.new()
	body.name = "Terrain"
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	body.add_child(mi)
	var shape := CollisionShape3D.new()
	shape.shape = mesh.create_trimesh_shape()
	body.add_child(shape)
	add_child(body)


func _build_far_mountains() -> void:
	# Cadeia de montanhas distante ao redor do mapa (efeito parallax com a névoa).
	var rng := RandomNumberGenerator.new()
	rng.seed = int(_def["seed"]) * 31 + 7
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	var cone := CylinderMesh.new()
	cone.top_radius = 18.0
	cone.bottom_radius = 260.0
	cone.height = 220.0
	cone.radial_segments = 7
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 1.0
	cone.material = mat
	mm.mesh = cone
	var count := 26
	mm.instance_count = count
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	add_child(mmi)
	var radius := _terrain_size * 0.5 + 500.0
	var peak: Color = _def["peak_color"]
	var high: Color = _def["high_color"]
	for i in count:
		var ang := TAU * float(i) / float(count) + rng.randf_range(-0.08, 0.08)
		var dist := radius + rng.randf_range(-140.0, 260.0)
		var p := _terrain_center + Vector3(cos(ang) * dist, 0.0, sin(ang) * dist)
		var scale_f := rng.randf_range(0.7, 1.8)
		var t := Transform3D(
			Basis.IDENTITY.scaled(Vector3(scale_f, rng.randf_range(0.8, 1.7), scale_f)),
			Vector3(p.x, 60.0, p.z)
		)
		mm.set_instance_transform(i, t)
		mm.set_instance_color(i, high.lerp(peak, rng.randf_range(0.3, 0.9)))


func _terrain_color(h: float) -> Color:
	var amp := float(_def["amplitude"])
	var t := clampf((h + amp * 0.2) / (amp * 1.3), 0.0, 1.0)
	var low: Color = _def["low_color"]
	var high: Color = _def["high_color"]
	var peak: Color = _def["peak_color"]
	if t < 0.6:
		return low.lerp(high, t / 0.6)
	return high.lerp(peak, (t - 0.6) / 0.4)


func _build_scenery() -> void:
	# Vegetação por bioma. "cerrado": eucaliptos (tronco alto e fino, copa
	# estreita) + pés de pequi (tronco baixo retorcido, copa larga e escura)
	# sobre capim dourado; "mata": árvores frondosas genéricas.
	var rng := RandomNumberGenerator.new()
	rng.seed = int(_def["seed"]) * 7 + 1
	var count := int(_def["tree_count"])
	var cerrado: bool = _def.get("veg", "mata") == "cerrado"
	var trunk := CylinderMesh.new()
	var crown := SphereMesh.new()
	if cerrado:
		trunk.top_radius = 0.14
		trunk.bottom_radius = 0.2
		trunk.height = 7.0
		crown.radius = 1.1
		crown.height = 4.6
	else:
		trunk.top_radius = 0.25
		trunk.bottom_radius = 0.4
		trunk.height = 2.2
		crown.radius = 1.6
		crown.height = 3.2
	var crown_mat := StandardMaterial3D.new()
	crown_mat.albedo_color = _def["tree_color"]
	crown.material = crown_mat
	var trunk_mat := StandardMaterial3D.new()
	trunk_mat.albedo_color = Color(0.62, 0.6, 0.55) if cerrado else Color(0.35, 0.23, 0.12)
	trunk.material = trunk_mat
	if cerrado:
		_scatter_pequi(rng, count / 2)
	for part: Array in [[trunk, 3.6 if cerrado else 1.1], [crown, 7.6 if cerrado else 3.4]]:
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = part[0]
		mm.instance_count = count
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		add_child(mmi)
		rng.seed = int(_def["seed"]) * 7 + 1
		var placed := 0
		var attempts := 0
		while placed < count and attempts < count * 30:
			attempts += 1
			var s := rng.randf() * track_len
			var lateral := rng.randf_range(18.0, 150.0)
			var side := -1.0 if rng.randf() < 0.5 else 1.0
			var pos := point_at(s)
			var ahead := point_at(minf(s + 2.0, track_len))
			var lat_dir := (ahead - pos).cross(Vector3.UP).normalized()
			var p := pos + lat_dir * lateral * side
			var closest := closest_route_point_xz(p.x, p.z)
			if Vector2(p.x, p.z).distance_to(Vector2(closest.x, closest.z)) < 16.0:
				continue
			var h := height_at(p.x, p.z)
			var scale_f := rng.randf_range(0.8, 1.6)
			var t := Transform3D(
				Basis.IDENTITY.scaled(Vector3.ONE * scale_f),
				Vector3(p.x, h + float(part[1]) * scale_f, p.z)
			)
			mm.set_instance_transform(placed, t)
			placed += 1
		mm.visible_instance_count = placed


func _scatter_pequi(rng: RandomNumberGenerator, count: int) -> void:
	# Pequizeiro: tronco curto e grosso, copa larga baixa e escura (savana).
	var trunk := CylinderMesh.new()
	trunk.top_radius = 0.22
	trunk.bottom_radius = 0.34
	trunk.height = 1.8
	var trunk_mat := StandardMaterial3D.new()
	trunk_mat.albedo_color = Color(0.3, 0.22, 0.15)
	trunk.material = trunk_mat
	var crown := SphereMesh.new()
	crown.radius = 2.6
	crown.height = 2.6
	var crown_mat := StandardMaterial3D.new()
	crown_mat.albedo_color = Color(0.16, 0.3, 0.12)
	crown.material = crown_mat
	for part: Array in [[trunk, 0.9], [crown, 2.6]]:
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = part[0]
		mm.instance_count = count
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		add_child(mmi)
		rng.seed = int(_def["seed"]) * 19 + 11
		var placed := 0
		var attempts := 0
		while placed < count and attempts < count * 30:
			attempts += 1
			var s := rng.randf() * track_len
			var lateral := rng.randf_range(20.0, 160.0)
			var side := -1.0 if rng.randf() < 0.5 else 1.0
			var pos := point_at(s)
			var ahead := point_at(minf(s + 2.0, track_len))
			var lat_dir := (ahead - pos).cross(Vector3.UP).normalized()
			var p := pos + lat_dir * lateral * side
			var closest := closest_route_point_xz(p.x, p.z)
			if Vector2(p.x, p.z).distance_to(Vector2(closest.x, closest.z)) < 17.0:
				continue
			var h := height_at(p.x, p.z)
			var sc := rng.randf_range(0.8, 1.4)
			mm.set_instance_transform(
				placed,
				Transform3D(
					Basis.IDENTITY.scaled(Vector3.ONE * sc),
					Vector3(p.x, h + float(part[1]) * sc, p.z)
				)
			)
			placed += 1
		mm.visible_instance_count = placed

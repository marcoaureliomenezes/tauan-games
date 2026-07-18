# race.gd — Cruis'n Tauan (Godot 4). Constrói o mundo inteiro em código:
# circuito por Curve3D (pista + faixas + saias + guard-rails com colisão),
# cenário (árvores, montanhas), iluminação real (sol + sombras + céu + névoa),
# 4 carros VehicleBody3D (1 jogador + 3 IA), voltas, HUD e câmera de chase.
extends Node3D

const CarF := preload("res://scripts/car_factory.gd")

const ROAD_W := 14.0
const LAPS := 3
const STEP := 2.0

var curve := Curve3D.new()
var track_len := 0.0
var cars: Array[VehicleBody3D] = []
var player: VehicleBody3D
var camera: Camera3D
var phase := "countdown"
var countdown := 3.6
var race_t := 0.0
var progress := {}      # car -> {lap, s, last_s}
var hud := {}
var test_mode := OS.get_environment("CORRIDA_TEST") == "1"
var test_t := 0.0
var shot_dir := OS.get_environment("CORRIDA_SHOT")   # captura frames p/ validação
var shot_n := 0

# ── setup ───────────────────────────────────────────────────────────────────
func _ready() -> void:
	_build_curve()
	_build_environment()
	_build_road()
	_build_rails()
	_build_scenery()
	_spawn_cars()
	_build_camera()
	_build_hud()

func _build_curve() -> void:
	var pts := [
		Vector3(0, 0.2, 0), Vector3(120, 1, -12), Vector3(200, 4, -60),
		Vector3(214, 7, -150), Vector3(150, 5, -212), Vector3(40, 2, -224),
		Vector3(-60, 0.2, -190), Vector3(-140, 3, -224), Vector3(-222, 6, -180),
		Vector3(-244, 4, -90), Vector3(-200, 1, 6), Vector3(-118, 4, 44),
		Vector3(-40, 1, 22),
	]
	for p in pts:
		curve.add_point(p + Vector3(0, 0.15, 0))
	curve.closed = true
	curve.bake_interval = 1.0
	# suaviza os cantos com in/out automáticos (Catmull-Rom-ish)
	var n := curve.point_count
	for i in n:
		var prev: Vector3 = curve.get_point_position((i - 1 + n) % n)
		var next: Vector3 = curve.get_point_position((i + 1) % n)
		var t := (next - prev) * 0.22
		curve.set_point_in(i, -t)
		curve.set_point_out(i, t)
	track_len = curve.get_baked_length()

func _build_environment() -> void:
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-38, 145, 0)
	sun.light_energy = 1.35
	sun.light_color = Color(1.0, 0.96, 0.88)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 260.0
	add_child(sun)

	var we := WorldEnvironment.new()
	var env := Environment.new()
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.22, 0.45, 0.78)
	sm.sky_horizon_color = Color(0.74, 0.82, 0.88)
	sm.ground_bottom_color = Color(0.2, 0.24, 0.2)
	sm.ground_horizon_color = Color(0.72, 0.79, 0.83)
	sky.sky_material = sm
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.9
	env.fog_enabled = true
	env.fog_light_color = Color(0.75, 0.82, 0.88)
	env.fog_density = 0.0009
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.glow_enabled = true
	env.glow_intensity = 0.25
	we.environment = env
	add_child(we)

	# rede de segurança bem abaixo de tudo
	var net := StaticBody3D.new()
	var ncol := CollisionShape3D.new()
	ncol.shape = WorldBoundaryShape3D.new()
	net.position = Vector3(0, -2.0, 0)
	net.add_child(ncol)
	add_child(net)
	_build_terrain()

var _tnoise: FastNoiseLite

# altura do terreno em p (mesma lei usada na malha — árvores usam também)
func _terrain_h(p: Vector3) -> float:
	if _tnoise == null:
		_tnoise = FastNoiseLite.new()
		_tnoise.frequency = 0.008
	var cp: Vector3 = curve.get_closest_point(p)
	var d := Vector2(p.x - cp.x, p.z - cp.z).length()
	var t := clampf((d - ROAD_W / 2 - 1.0) / 46.0, 0.0, 1.0)
	var rolling: float = _tnoise.get_noise_2d(p.x, p.z) * 2.6 * t
	return lerpf(cp.y - 0.18, maxf(rolling, 0.0), t * t * (3.0 - 2.0 * t))

# TERRENO com relevo que ACOMPANHA a elevação da pista (bug "pista a 1 m do
# chão"): altura = Y da estrada no ponto mais próximo, decaindo suave até 0
# longe dela — a estrada vira aterro contínuo, nunca fita flutuante.
func _build_terrain() -> void:
	var x0 := -400.0; var x1 := 340.0
	var z0 := -380.0; var z1 := 180.0
	var cell := 6.0
	var nx := int((x1 - x0) / cell) + 1
	var nz := int((z1 - z0) / cell) + 1
	var hs := PackedFloat32Array()
	hs.resize(nx * nz)
	for j in nz:
		for i in nx:
			hs[j * nx + i] = _terrain_h(Vector3(x0 + i * cell, 0, z0 + j * cell))
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for j in nz - 1:
		for i in nx - 1:
			var a := Vector3(x0 + i * cell, hs[j * nx + i], z0 + j * cell)
			var b := Vector3(x0 + (i + 1) * cell, hs[j * nx + i + 1], z0 + j * cell)
			var c := Vector3(x0 + i * cell, hs[(j + 1) * nx + i], z0 + (j + 1) * cell)
			var d2 := Vector3(x0 + (i + 1) * cell, hs[(j + 1) * nx + i + 1], z0 + (j + 1) * cell)
			for v in [a, b, c, b, d2, c]:
				st.set_uv(Vector2(v.x, v.z) * 0.09)
				st.add_vertex(v)
	st.generate_normals()
	var mesh := st.commit()
	var gmat := StandardMaterial3D.new()
	gmat.albedo_color = Color(0.28, 0.46, 0.19)   # verde SÓLIDO (texture só modula)
	gmat.albedo_texture = _noise_tex(Color(0.72, 0.72, 0.72), Color(1, 1, 1), 3.0)
	gmat.roughness = 1.0
	gmat.cull_mode = BaseMaterial3D.CULL_DISABLED   # terreno visível de qualquer lado
	mesh.surface_set_material(0, gmat)
	var gmi := MeshInstance3D.new()
	gmi.mesh = mesh
	var gbody := StaticBody3D.new()
	var gcol2 := CollisionShape3D.new()
	gcol2.shape = mesh.create_trimesh_shape()
	gbody.add_child(gcol2)
	gbody.add_child(gmi)
	add_child(gbody)

func _noise_tex(a: Color, b: Color, scale_: float) -> ImageTexture:
	var img := Image.create(128, 128, false, Image.FORMAT_RGB8)
	var noise := FastNoiseLite.new()
	noise.frequency = 0.09 * scale_
	for y in 128:
		for x in 128:
			var t := (noise.get_noise_2d(x, y) + 1.0) / 2.0
			img.set_pixel(x, y, a.lerp(b, t))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)

func _asphalt_tex() -> ImageTexture:
	var img := Image.create(256, 256, false, Image.FORMAT_RGB8)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var base := Color(0.16, 0.16, 0.17)
	img.fill(base)
	for i in 26000:                          # agregado do asfalto
		var v := rng.randf_range(-0.05, 0.06)
		var c := Color(base.r + v, base.g + v, base.b + v)
		img.set_pixel(rng.randi() % 256, rng.randi() % 256, c)
	return ImageTexture.create_from_image(img)

# fita ao longo da curva: half-width l→r, offset vertical; devolve ArrayMesh
func _ribbon(l: float, r: float, y0: float, mat: Material,
		dashed := false, drop := 0.0) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := int(track_len / STEP)
	var uv_v := 0.0
	for i in n:
		if dashed and (i / 3) % 2 == 1:
			continue
		var o1 := i * STEP
		var o2 := minf((i + 1) * STEP, track_len)
		var pa: Vector3 = curve.sample_baked(o1, true)
		var pb: Vector3 = curve.sample_baked(o2, true)
		var ta := (curve.sample_baked(fmod(o1 + 1.0, track_len), true) - pa).normalized()
		var tb := (curve.sample_baked(fmod(o2 + 1.0, track_len), true) - pb).normalized()
		var sa := Vector3(-ta.z, 0, ta.x).normalized()
		var sb := Vector3(-tb.z, 0, tb.x).normalized()
		var a1 := pa + sa * l + Vector3(0, y0, 0)
		var a2 := pa + sa * r + Vector3(0, y0 - drop, 0)
		var b1 := pb + sb * l + Vector3(0, y0, 0)
		var b2 := pb + sb * r + Vector3(0, y0 - drop, 0)
		var v1 := uv_v
		var v2 := uv_v + STEP / 8.0
		uv_v = v2
		for tri in [[a1, b1, a2, Vector2(0, v1), Vector2(0, v2), Vector2(1, v1)],
				[a2, b1, b2, Vector2(1, v1), Vector2(0, v2), Vector2(1, v2)]]:
			st.set_uv(tri[3]); st.add_vertex(tri[0])
			st.set_uv(tri[4]); st.add_vertex(tri[1])
			st.set_uv(tri[5]); st.add_vertex(tri[2])
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.mesh.surface_set_material(0, mat)
	return mi

func _build_road() -> void:
	var amat := StandardMaterial3D.new()
	amat.albedo_texture = _asphalt_tex()
	amat.uv1_scale = Vector3(1, 1, 1)
	amat.roughness = 0.92
	var road := _ribbon(-ROAD_W / 2, ROAD_W / 2, 0.0, amat)
	road.name = "Road"
	add_child(road)
	# colisão da pista (trimesh côncavo real)
	var body := StaticBody3D.new()
	var col := CollisionShape3D.new()
	col.shape = road.mesh.create_trimesh_shape()
	body.add_child(col)
	add_child(body)

	var white := StandardMaterial3D.new()
	white.albedo_color = Color(0.92, 0.92, 0.9)
	var yellow := StandardMaterial3D.new()
	yellow.albedo_color = Color(0.95, 0.78, 0.1)
	add_child(_ribbon(-ROAD_W / 2 + 0.15, -ROAD_W / 2 + 0.5, 0.02, white))
	add_child(_ribbon(ROAD_W / 2 - 0.5, ROAD_W / 2 - 0.15, 0.02, white))
	add_child(_ribbon(-0.18, 0.18, 0.02, yellow, true))
	# saias laterais (aterro) até o chão
	var dirt := StandardMaterial3D.new()
	dirt.albedo_color = Color(0.32, 0.26, 0.18)
	add_child(_ribbon(-ROAD_W / 2 - 1.6, -ROAD_W / 2, -0.02, dirt, false, 9.0))
	add_child(_ribbon(ROAD_W / 2, ROAD_W / 2 + 1.6, -0.02, dirt, false, 9.0))

func _build_rails() -> void:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.62, 0.64, 0.66)
	mat.metallic = 0.7
	mat.roughness = 0.45
	for side: float in [-1.0, 1.0]:
		var off: float = side * (ROAD_W / 2 + 2.0)
		# rail visual: fita vertical
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		var n := int(track_len / STEP)
		for i in n:
			var o1 := i * STEP
			var o2 := minf((i + 1) * STEP, track_len)
			var pa: Vector3 = curve.sample_baked(o1, true)
			var pb: Vector3 = curve.sample_baked(o2, true)
			var ta := (curve.sample_baked(fmod(o1 + 1.0, track_len), true) - pa).normalized()
			var tb := (curve.sample_baked(fmod(o2 + 1.0, track_len), true) - pb).normalized()
			var sa := Vector3(-ta.z, 0, ta.x).normalized() * off
			var sb := Vector3(-tb.z, 0, tb.x).normalized() * off
			var a1 := pa + sa + Vector3(0, 0.35, 0)
			var a2 := pa + sa + Vector3(0, 0.85, 0)
			var b1 := pb + sb + Vector3(0, 0.35, 0)
			var b2 := pb + sb + Vector3(0, 0.85, 0)
			for v in [a1, b1, a2, a2, b1, b2, a1, a2, b1, b1, a2, b2]:
				st.add_vertex(v)   # dois lados (winding duplo)
		st.generate_normals()
		var mi := MeshInstance3D.new()
		mi.mesh = st.commit()
		mi.mesh.surface_set_material(0, mat)
		add_child(mi)
		# BARREIRA SÓLIDA (bug crítico "atravessei a cerca"): trimesh fino é
		# atravessável por tunneling em alta velocidade (colisão discreta).
		# Aqui: corrente de CAIXAS VOLUMÉTRICAS (1.2 m de espessura, 4 m de
		# altura, sobrepostas) — impossível tunelar um volume sólido.
		var sbody := StaticBody3D.new()
		var seg := 4.0
		var nseg := int(track_len / seg)
		for i in nseg:
			var o1 := i * seg
			var o2 := fmod(o1 + seg, track_len)
			var pa: Vector3 = curve.sample_baked(o1, true)
			var pb: Vector3 = curve.sample_baked(o2, true)
			var ta := (curve.sample_baked(fmod(o1 + 1.0, track_len), true) - pa).normalized()
			var tb := (curve.sample_baked(fmod(o2 + 1.0, track_len), true) - pb).normalized()
			var ca := pa + Vector3(-ta.z, 0, ta.x).normalized() * off
			var cb := pb + Vector3(-tb.z, 0, tb.x).normalized() * off
			var mid := (ca + cb) / 2.0 + Vector3(0, 2.0, 0)
			var dir := (cb - ca)
			var length := dir.length()
			if length < 0.01:
				continue
			var col := CollisionShape3D.new()
			var box := BoxShape3D.new()
			box.size = Vector3(1.2, 4.0, length + 1.6)   # +1.6 = sobreposição
			col.shape = box
			col.transform = Transform3D(Basis.looking_at(dir.normalized(), Vector3.UP), mid)
			sbody.add_child(col)
		add_child(sbody)
		# postes
		var pm := MultiMesh.new()
		pm.transform_format = MultiMesh.TRANSFORM_3D
		var post := BoxMesh.new()
		post.size = Vector3(0.14, 0.9, 0.14)
		post.material = mat
		pm.mesh = post
		var count := int(track_len / 8.0)
		pm.instance_count = count
		for k in count:
			var o := k * 8.0
			var p: Vector3 = curve.sample_baked(o, true)
			var t2 := (curve.sample_baked(fmod(o + 1.0, track_len), true) - p).normalized()
			var s2 := Vector3(-t2.z, 0, t2.x).normalized() * off
			pm.set_instance_transform(k, Transform3D(Basis(), p + s2 + Vector3(0, 0.45, 0)))
		var pmi := MultiMeshInstance3D.new()
		pmi.multimesh = pm
		add_child(pmi)

func _build_scenery() -> void:
	# árvore: tronco + copa cônica em uma ArrayMesh (2 superfícies)
	var tmat := StandardMaterial3D.new()
	tmat.albedo_color = Color(0.36, 0.25, 0.14)
	var cmat := StandardMaterial3D.new()
	cmat.albedo_color = Color(0.10, 0.35, 0.13)
	var trunk := CylinderMesh.new()
	trunk.top_radius = 0.22; trunk.bottom_radius = 0.3; trunk.height = 2.2
	var crown := CylinderMesh.new()
	crown.top_radius = 0.0; crown.bottom_radius = 2.4; crown.height = 5.6
	crown.radial_segments = 7
	var tree := ArrayMesh.new()
	var st := SurfaceTool.new()
	st.append_from(trunk, 0, Transform3D(Basis(), Vector3(0, 1.1, 0)))
	tree = st.commit(tree)
	tree.surface_set_material(0, tmat)
	var stc2 := SurfaceTool.new()
	stc2.append_from(crown, 0, Transform3D(Basis(), Vector3(0, 4.6, 0)))
	tree = stc2.commit(tree)
	tree.surface_set_material(1, cmat)

	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = tree
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	var placed: Array[Transform3D] = []
	while placed.size() < 420:
		var o := rng.randf() * track_len
		var lat := rng.randf_range(14.0, 90.0) * (1 if rng.randf() < 0.5 else -1)
		var p: Vector3 = curve.sample_baked(o, true)
		var t3 := (curve.sample_baked(fmod(o + 1.0, track_len), true) - p).normalized()
		var pos := p + Vector3(-t3.z, 0, t3.x).normalized() * lat
		pos.y = _terrain_h(pos)
		var cp2: Vector3 = curve.get_closest_point(pos)
		if Vector2(cp2.x - pos.x, cp2.z - pos.z).length() < ROAD_W / 2 + 4.0:
			continue
		var sc := rng.randf_range(0.8, 1.7)
		placed.append(Transform3D(Basis().rotated(Vector3.UP, rng.randf() * TAU)
			.scaled(Vector3(sc, sc, sc)), pos))
	mm.instance_count = placed.size()
	for i in placed.size():
		mm.set_instance_transform(i, placed[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	add_child(mmi)

	# montanhas distantes
	var rng2 := RandomNumberGenerator.new()
	rng2.seed = 9
	for i in 14:
		var ang := TAU * i / 14.0 + rng2.randf_range(-0.1, 0.1)
		var mtn := MeshInstance3D.new()
		var cone := CylinderMesh.new()
		cone.top_radius = 0.0
		cone.bottom_radius = rng2.randf_range(180, 340)
		cone.height = rng2.randf_range(110, 240)
		cone.radial_segments = 9
		var mmat := StandardMaterial3D.new()
		mmat.albedo_color = Color(0.42, 0.48, 0.58)
		cone.material = mmat
		mtn.mesh = cone
		mtn.position = (Vector3(cos(ang), 0, sin(ang)) * rng2.randf_range(750, 1050)
			+ Vector3(0, cone.height / 2 - 8, -100))
		add_child(mtn)

func _spawn_cars() -> void:
	var keys := ["idea", "exotic", "muscle", "concept"]
	for i in keys.size():
		var car := CarF.build(keys[i])
		var o := track_len - 8.0 * i - 6.0
		var p: Vector3 = curve.sample_baked(o, true)
		var t4 := (curve.sample_baked(fmod(o + 1.0, track_len), true) - p).normalized()
		var side := Vector3(-t4.z, 0, t4.x).normalized() * (3.0 if i % 2 == 0 else -3.0)
		car.global_transform = Transform3D(
			Basis.looking_at(t4, Vector3.UP), p + side + Vector3(0, 1.0, 0))
		add_child(car)
		cars.append(car)
		progress[car] = {"lap": 1, "s": o / track_len, "last_s": o / track_len, "ai_lane": (3.0 if i % 2 == 0 else -3.0)}
	player = cars[0]

func _build_camera() -> void:
	camera = Camera3D.new()
	camera.fov = 72
	camera.far = 4000
	add_child(camera)
	var pp: Vector3 = player.global_position
	camera.global_position = pp + Vector3(0, 4, 10)
	camera.look_at(pp)

func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	for cfg in [
		{"n": "speed", "pos": Vector2(-280, -90), "size": 46, "anchor": Vector2(1, 1)},
		{"n": "lap", "pos": Vector2(24, 16), "size": 26, "anchor": Vector2(0, 0)},
		{"n": "time", "pos": Vector2(-200, 16), "size": 24, "anchor": Vector2(1, 0)},
		{"n": "count", "pos": Vector2(-60, -60), "size": 84, "anchor": Vector2(0.5, 0.5)},
	]:
		var lb := Label.new()
		lb.add_theme_font_size_override("font_size", cfg["size"])
		lb.add_theme_color_override("font_color", Color(1, 0.85, 0.2))
		lb.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
		lb.add_theme_constant_override("outline_size", 8)
		lb.set_anchors_preset(Control.PRESET_TOP_LEFT)
		lb.anchor_left = cfg["anchor"].x; lb.anchor_right = cfg["anchor"].x
		lb.anchor_top = cfg["anchor"].y; lb.anchor_bottom = cfg["anchor"].y
		lb.position = cfg["pos"]
		layer.add_child(lb)
		hud[cfg["n"]] = lb

# ── loop ────────────────────────────────────────────────────────────────────
func _physics_process(delta: float) -> void:
	if phase == "countdown":
		countdown -= delta
		hud["count"].text = "GO!" if countdown < 0.6 else str(ceili(countdown - 0.6))
		if countdown <= 0:
			phase = "race"
			hud["count"].text = ""
	if phase == "race":
		race_t += delta
	if test_mode:
		test_t += delta
		_check_test()
	if shot_dir != "":
		test_t += 0.0 if test_mode else delta
		var t2 := test_t if test_mode else race_t + (3.6 - countdown)
		if (shot_n == 0 and t2 > 5.0) or (shot_n == 1 and t2 > 11.0) or (shot_n == 2 and t2 > 17.0):
			shot_n += 1
			get_viewport().get_texture().get_image().save_png(
				"%s/godot-shot-%d.png" % [shot_dir, shot_n])
			if shot_n >= 3:
				get_tree().quit(0)

	for car in cars:
		var is_ai: bool = car != player or test_mode
		if phase == "countdown":
			car.engine_force = 0
			car.brake = 30
			car.steering = 0
		elif is_ai:
			_drive_ai(car, delta)
		else:
			_drive_player(car, delta)
		_anomaly_guard(car)
		_update_progress(car)
	_update_camera(delta)
	_update_hud()

func _drive_player(car: VehicleBody3D, delta: float) -> void:
	var def: Dictionary = car.get_meta("def")
	var throttle := Input.get_action_strength("accelerate")
	var brake_in := Input.get_action_strength("brake")
	var steer := Input.get_action_strength("steer_left") - Input.get_action_strength("steer_right")
	var speed := car.linear_velocity.length()
	var fwd_speed := -car.global_transform.basis.z.dot(car.linear_velocity)
	# CONVENÇÃO MEDIDA (tests/probe.gd): engine_force POSITIVO = ré (+Z);
	# frente exige força NEGATIVA. Nunca confiar no doc — medir.
	if brake_in > 0 and fwd_speed < 0.5:
		car.engine_force = def["engine"] * 0.45 * brake_in    # ré
		car.brake = 0
	else:
		var lim: float = clampf(1.0 - fwd_speed / def["top"], 0.0, 1.0)
		car.engine_force = -def["engine"] * throttle * lim    # frente
		car.brake = def["brake"] * brake_in
	if Input.is_action_pressed("handbrake"):
		car.brake = maxf(car.brake, def["brake"] * 1.2)
	# esterço: resposta rápida, reduz menos em alta velocidade
	var max_steer: float = def["steer"] * (1.0 - clampf(speed / 80.0, 0.0, 0.6))
	car.steering = move_toward(car.steering, steer * max_steer, 4.2 * delta)
	if Input.is_action_just_pressed("reset_car"):
		_reset_car(car)

func _drive_ai(car: VehicleBody3D, delta: float) -> void:
	var def: Dictionary = car.get_meta("def")
	var pos := car.global_position
	var o := curve.get_closest_offset(pos)
	var speed := car.linear_velocity.length()
	var look := 12.0 + speed * 0.55
	var lane: float = progress[car]["ai_lane"]
	var tgt: Vector3 = curve.sample_baked(fmod(o + look, track_len), true)
	var tan5: Vector3 = (curve.sample_baked(fmod(o + look + 1.0, track_len), true) - tgt).normalized()
	tgt += Vector3(-tan5.z, 0, tan5.x).normalized() * lane * 0.5
	var local := car.global_transform.affine_inverse() * tgt
	var ang := atan2(-local.x, -local.z)      # frente é -Z
	car.steering = move_toward(car.steering, clampf(ang * 1.4, -def["steer"], def["steer"]), 3.0 * delta)
	# alvo de velocidade pela curvatura à frente
	var ahead: Vector3 = curve.sample_baked(fmod(o + 34.0, track_len), true)
	var here_t: Vector3 = (curve.sample_baked(fmod(o + 1.0, track_len), true)
		- curve.sample_baked(o, true)).normalized()
	var ahead_t: Vector3 = (curve.sample_baked(fmod(o + 35.0, track_len), true) - ahead).normalized()
	var straight: float = clampf(here_t.dot(ahead_t), 0.0, 1.0)
	var target_speed: float = def["top"] * (0.42 + 0.58 * straight * straight)
	if speed < target_speed:
		# sinal MEDIDO: frente = engine_force negativo (tests/probe.gd)
		car.engine_force = -def["engine"] * clampf(1.0 - speed / def["top"], 0.0, 1.0)
		car.brake = 0
	else:
		car.engine_force = 0
		car.brake = def["brake"] * 0.5 if speed > target_speed + 4.0 else 0.0
	# capotou/saiu? reseta
	if car.global_transform.basis.y.y < 0.1 or pos.y < -4.0:
		_reset_car(car)

var anomalies := 0            # violações de contenção detectadas (teste falha se > 0)

# GUARDA DE CONTENÇÃO (bug crítico "carro embaixo do terreno"): a cada tick,
# nenhum carro pode estar (a) abaixo do terreno, (b) além da cerca. Se estiver,
# é anomalia: conta, loga e reseta na pista. Cinto além do CCD + caixas sólidas.
func _anomaly_guard(car: VehicleBody3D) -> void:
	var p := car.global_position
	var cp: Vector3 = curve.get_closest_point(p)
	var lateral := Vector2(p.x - cp.x, p.z - cp.z).length()
	var below := p.y < _terrain_h(p) - 1.5
	var escaped := lateral > ROAD_W / 2 + 3.2      # cerca fica em W/2+2.0
	if below or escaped:
		anomalies += 1
		var why := "UNDERGROUND" if below else "ESCAPED"
		print("ANOMALY %s car=%s pos=%.1f,%.1f,%.1f lat=%.1f" % [
			why, car.name, p.x, p.y, p.z, lateral])
		_reset_car(car)

func _reset_car(car: VehicleBody3D) -> void:
	var o := curve.get_closest_offset(car.global_position)
	var p: Vector3 = curve.sample_baked(o, true)
	var t6 := (curve.sample_baked(fmod(o + 1.0, track_len), true) - p).normalized()
	car.linear_velocity = Vector3.ZERO
	car.angular_velocity = Vector3.ZERO
	car.global_transform = Transform3D(Basis.looking_at(t6, Vector3.UP), p + Vector3(0, 1.2, 0))

func _update_progress(car: VehicleBody3D) -> void:
	var pr: Dictionary = progress[car]
	var s := curve.get_closest_offset(car.global_position) / track_len
	if pr["last_s"] > 0.9 and s < 0.1:
		pr["lap"] += 1
	elif pr["last_s"] < 0.1 and s > 0.9:
		pr["lap"] -= 1
	pr["last_s"] = pr["s"]
	pr["s"] = s

func _update_camera(delta: float) -> void:
	var b := player.global_transform.basis
	var fwd := -b.z
	fwd.y = 0
	fwd = fwd.normalized()
	var speed := player.linear_velocity.length()
	var want: Vector3 = player.global_position - fwd * (7.5 + speed * 0.06) + Vector3(0, 3.2, 0)
	camera.global_position = camera.global_position.lerp(want, clampf(6.0 * delta, 0, 1))
	camera.look_at(player.global_position + fwd * 7.0 + Vector3(0, 1.2, 0))
	camera.fov = 72 + clampf(speed * 0.22, 0, 16)

func _update_hud() -> void:
	var kmh := int(player.linear_velocity.length() * 3.6)
	hud["speed"].text = "%d km/h" % kmh
	var pr: Dictionary = progress[player]
	var pos_rank := 1
	for c in cars:
		if c != player and progress[c]["lap"] + progress[c]["s"] > pr["lap"] + pr["s"]:
			pos_rank += 1
	hud["lap"].text = "VOLTA %d/%d  ·  %dº/%d" % [mini(pr["lap"], LAPS), LAPS, pos_rank, cars.size()]
	hud["time"].text = "%d:%04.1f" % [int(race_t / 60), fmod(race_t, 60.0)]

var _test_travel := 0.0     # avanço REAL no sentido da corrida (ré desconta)

func _check_test() -> void:
	var pr: Dictionary = progress[player]
	var ds: float = pr["s"] - pr["last_s"]
	if ds > 0.5: ds -= 1.0
	elif ds < -0.5: ds += 1.0
	_test_travel += ds * track_len
	# fase de ESTRESSE DA CERCA: força o jogador contra a barreira em alta
	# velocidade (lane bem além da pista); a contenção tem que segurar.
	if test_t > 13.0 and test_t < 17.0:
		pr["ai_lane"] = 30.0
	elif test_t >= 17.0 and pr["ai_lane"] > 10.0:
		pr["ai_lane"] = 0.0
	if test_t < 30.0:
		return
	var fwd_speed: float = -player.global_transform.basis.z.dot(player.linear_velocity)
	var ok := _test_travel > 150.0 and fwd_speed > 3.0 and anomalies == 0
	if ok:
		print("TEST PASS travel=%.0fm fwd=%.1fm/s anomalies=0 cars=%d" % [
			_test_travel, fwd_speed, cars.size()])
		get_tree().quit(0)
	else:
		print("TEST FAIL travel=%.0fm fwd=%.1fm/s anomalies=%d" % [
			_test_travel, fwd_speed, anomalies])
		get_tree().quit(1)

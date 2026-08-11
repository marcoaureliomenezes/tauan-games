class_name RaceManager
extends Node3D
## Orquestra a viagem cidade-a-cidade nas duas visões sobre o MESMO mapa:
## - corrida: 3 oponentes disputam quem chega primeiro à cidade B;
## - perseguição: viaturas caçam o jogador (barra de vida, batidas ferem,
##   spike strips na pista para desviar); vencer = chegar vivo à cidade B.
## Tráfego ambiente (caminhões/ambulâncias/carros) roda nas duas visões.
## O carro do jogador é SEMPRE a réplica do Fiat Idea Adventure 2013 prata.

const PLAYER_SCENE := preload("res://addons/M.A.V.S/Vehicle/TGR/TRG.tscn")
const AI_SCENE := preload("res://addons/M.A.V.S/Vehicle/AI_Vehicles/AI_TRG.tscn")
const AI_NAMES := ["Rivaldo", "Turbina", "Zeca Drift"]
const AI_TOP_SPEED := [230.0, 205.0, 185.0]
const POLICE_NAMES := ["PM-01", "PM-02", "PM-03"]
const POLICE_TOP_SPEED := [225.0, 210.0, 200.0]
const AI_LOOKAHEAD := 17.0
const STATE_DRIVE := 0
const STATE_MENU := 3
const MAX_LIFE := 100.0
const SPIKE_INTERVAL := 16.0

var track: RouteBuilder
var player: VehicleBody3D
var racers: Array[VehicleBody3D] = []
var police: Array[VehicleBody3D] = []
var traffic: TrafficManager
var mode := "corrida"
var phase := "countdown"
var countdown := 3.9
var race_time := 0.0
var life := MAX_LIFE

var _progress := {}
var _ai_targets := {}
var _flip_timers := {}
var _labels := {}
var _life_bar: ColorRect
var _spike_timer := SPIKE_INTERVAL * 0.6
var _spikes: Array[Area3D] = []
var _last_hit := 0.0
var _test_mode := OS.get_environment("CORRIDA_TEST") == "1"
var _shot_dir := OS.get_environment("CORRIDA_SHOT")
var _shot_timer := 0.0
var _shot_n := 0


func _ready() -> void:
	mode = GameState.selected_mode
	var def: Dictionary = GameState.track_def()
	track = RouteBuilder.new()
	track.name = "Track"
	add_child(track)
	track.build(def)
	traffic = TrafficManager.new()
	traffic.name = "Traffic"
	add_child(traffic)
	traffic.setup(track, int(def["seed"]) * 3 + 1)
	_spawn_player()
	if mode == GameState.MODE_CHASE:
		_spawn_police()
	else:
		_spawn_opponents()
	_connect_checkpoints()
	_build_camera()
	_build_hud()


func _physics_process(delta: float) -> void:
	match phase:
		"countdown":
			_tick_countdown(delta)
		"race":
			_tick_race(delta)
		"finished":
			if _test_mode:
				_print_test_report()
				get_tree().quit()


func race_progress(car: VehicleBody3D) -> float:
	return track.curve.get_closest_offset(car.global_position)


func _tick_countdown(delta: float) -> void:
	countdown -= delta
	_labels["center"].text = str(ceili(countdown)) if countdown > 0.9 else "JÁ!"
	if countdown <= 0.9 and player.veh_state != STATE_DRIVE:
		for car in racers:
			car.set_physics_process(true)
			car.can_sleep = false
			car.sleeping = false
		player.veh_state = STATE_DRIVE
		if player.minimap_node and player.minimap_node.debug_hud:
			player.minimap_node.debug_hud.visible = false
	if countdown <= 0.0:
		phase = "race"
		_labels["center"].text = ""


func _tick_race(delta: float) -> void:
	race_time += delta
	if _test_mode:
		Input.action_press("Acceleration")
	_drive_ai()
	_update_respawn(delta)
	if mode == GameState.MODE_CHASE:
		_tick_chase(delta)
	if race_progress(player) >= track.finish_s:
		_finish(true)
	_update_hud()
	_capture_frame(delta)
	var test_secs := (
		float(OS.get_environment("CORRIDA_TEST_SECS"))
		if OS.get_environment("CORRIDA_TEST_SECS") != ""
		else 6.0
	)
	if _test_mode and race_time > test_secs:
		_print_test_report()
		get_tree().quit()


func _tick_chase(delta: float) -> void:
	_spike_timer -= delta
	if _spike_timer <= 0.0:
		_spike_timer = SPIKE_INTERVAL
		_deploy_spike_strip()
	_check_collisions(delta)
	if life <= 0.0:
		_finish(false)


func _spawn_player() -> void:
	player = PLAYER_SCENE.instantiate()
	player.name = "Player"
	player.is_current_veh = true
	player.veh_state = STATE_MENU
	player.key_handbrake = "HandBrake"
	player.key_shift_up = "ShiftUp"
	player.key_shift_down = "ShiftDown"
	player.key_camera = "CameraChange"
	player.debug_hud = false
	add_child(player)
	# Na perseguição o jogador larga na frente; a polícia vem atrás.
	player.global_transform = track.start_grid_transform(
		5 if GameState.selected_mode == GameState.MODE_CHASE else 0
	)
	# Réplica Fiat Idea Adventure 2013 prata (requisito fixo do operador).
	VehicleFactory.swap_body(player, VehicleFactory.build_idea_adventure())
	VehicleFactory.fit_idea_wheelbase(player)
	racers.append(player)
	_register_car(player)


func _spawn_opponents() -> void:
	for i in AI_NAMES.size():
		var ai := _spawn_ai_car(AI_NAMES[i], AI_TOP_SPEED[i], track.start_grid_transform(i + 1))
		racers.append(ai)
		_register_car(ai)


func _spawn_police() -> void:
	for i in POLICE_NAMES.size():
		var t := track.start_grid_transform(i)
		var cop := _spawn_ai_car(POLICE_NAMES[i], POLICE_TOP_SPEED[i], t)
		VehicleFactory.swap_body(cop, VehicleFactory.build_police_body())
		var bar := VehicleLightbar.new()
		cop.add_child(bar)
		police.append(cop)
		racers.append(cop)
		_register_car(cop)


func _spawn_ai_car(ai_name: String, top_speed: float, t: Transform3D) -> VehicleBody3D:
	var ai: VehicleBody3D = AI_SCENE.instantiate()
	ai.name = ai_name
	ai.race_AI = true
	ai.max_speed = top_speed
	add_child(ai)
	ai.global_transform = t
	var target := Node3D.new()
	target.name = "Target_%s" % ai_name
	add_child(target)
	target.global_position = track.point_at(AI_LOOKAHEAD)
	ai.target_ray = target
	_ai_targets[ai] = target
	ai.set_physics_process(false)
	return ai


func _register_car(car: VehicleBody3D) -> void:
	_progress[car] = {"next_cp": 0}
	_flip_timers[car] = 0.0
	car.contact_monitor = true
	car.max_contacts_reported = 8
	# M.A.V.S usa wheel_rest_length=0.0; em cena procedural o chassi encosta
	# no asfalto e as rodas perdem carga — levantar a suspensão.
	for w in car.find_children("*", "VehicleWheel3D", false, false):
		w.wheel_rest_length = 0.3
		w.position.y -= 0.12
	_fix_tire_smoke(car)
	var engine_audio := car.get_node_or_null("Car_Engine_Sound") as AudioStreamPlayer3D
	if engine_audio:
		engine_audio.volume_db = -6.0
	var tyre_audio := car.get_node_or_null("Tyre_Squeek_Sound") as AudioStreamPlayer3D
	if tyre_audio:
		tyre_audio.volume_db = -30.0
	var indicator := car.get_node_or_null("Car_Indicator") as Sprite3D
	if indicator:
		indicator.scale = Vector3.ONE * 0.45
		indicator.modulate.a = 0.75


func _fix_tire_smoke(car: VehicleBody3D) -> void:
	# Tire_smoke do M.A.V.S usa cubos; troca por billboard com textura de
	# fumaça do Kenney Particle Pack (CC0).
	var tex := load("res://addons/kenney_particle_pack/smoke_05.png")
	for p: GPUParticles3D in car.find_children("Tire_smoke*", "GPUParticles3D", true, false):
		var mat := StandardMaterial3D.new()
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
		mat.albedo_texture = tex
		mat.albedo_color = Color(0.75, 0.73, 0.7, 0.55)
		mat.vertex_color_use_as_albedo = true
		var quad := QuadMesh.new()
		quad.size = Vector2(0.9, 0.9)
		quad.material = mat
		p.draw_pass_1 = quad
		var pm := p.process_material as ParticleProcessMaterial
		if pm:
			pm.scale_min = 0.5
			pm.scale_max = 1.2
			pm.color = Color(1, 1, 1, 0.6)
			var ramp := Gradient.new()
			ramp.set_color(0, Color(1, 1, 1, 0.55))
			ramp.set_color(1, Color(1, 1, 1, 0.0))
			var ramp_tex := GradientTexture1D.new()
			ramp_tex.gradient = ramp
			pm.color_ramp = ramp_tex


func _connect_checkpoints() -> void:
	for i in track.checkpoints.size():
		track.checkpoints[i].body_entered.connect(_on_checkpoint.bind(i))


func _on_checkpoint(body: Node3D, index: int) -> void:
	if body in _progress and index == _progress[body]["next_cp"]:
		_progress[body]["next_cp"] = index + 1


func _drive_ai() -> void:
	for ai: VehicleBody3D in _ai_targets:
		var target: Node3D = _ai_targets[ai]
		if ai in police:
			# Polícia caça o JOGADOR, não a linha de chegada.
			var to_player := player.global_position - ai.global_position
			if to_player.length() > 14.0:
				target.global_position = player.global_position + Vector3.UP * 0.5
			else:
				target.global_position = (
					ai.global_position + to_player.normalized() * 18.0 + Vector3.UP * 0.5
				)
		else:
			var s := race_progress(ai)
			target.global_position = (
				track.point_at(minf(s + AI_LOOKAHEAD, track.track_len)) + Vector3.UP * 0.5
			)


func _deploy_spike_strip() -> void:
	# Um policial "joga" o dispositivo na pista à frente do jogador.
	if police.is_empty():
		return
	var s := race_progress(player) + 130.0
	if s >= track.finish_s - 40.0:
		return
	var pos := track.point_at(s)
	var ahead := track.point_at(s + 3.0)
	var dir := (ahead - pos).normalized()
	var lat := dir.cross(Vector3.UP).normalized()
	var side := 1.0 if randf() < 0.5 else -1.0
	var half_w := track.road_half_width_at(s)
	var strip := Area3D.new()
	strip.name = "SpikeStrip"
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(half_w * 1.1, 1.0, 1.2)
	shape.shape = box
	strip.add_child(shape)
	var visual := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(half_w * 1.1, 0.1, 0.5)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.9, 0.75, 0.1)
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mesh.material = mat
	visual.mesh = mesh
	strip.add_child(visual)
	for i in 6:
		var spike := MeshInstance3D.new()
		var cone := CylinderMesh.new()
		cone.top_radius = 0.0
		cone.bottom_radius = 0.06
		cone.height = 0.22
		cone.material = mat
		spike.mesh = cone
		spike.position = Vector3(-half_w * 0.5 + float(i) * half_w * 0.2, 0.16, 0.0)
		strip.add_child(spike)
	strip.global_transform = Transform3D(
		Basis.looking_at(dir, Vector3.UP), pos + lat * (half_w * 0.5) * side + Vector3.UP * 0.2
	)
	strip.body_entered.connect(_on_spike_hit.bind(strip))
	add_child(strip)
	_spikes.append(strip)


func _on_spike_hit(body: Node3D, strip: Area3D) -> void:
	if body != player:
		return
	if player.has_method("puncture_wheels"):
		player.puncture_wheels()
	life = maxf(life - 12.0, 0.0)
	_flash_center("PNEU FURADO!")
	strip.queue_free()
	_spikes.erase(strip)


func _check_collisions(delta: float) -> void:
	_last_hit += delta
	if _last_hit < 0.6:
		return
	var speed := player.linear_velocity.length()
	for body in player.get_colliding_bodies():
		if body is StaticBody3D and speed > 9.0:
			_apply_damage(speed * 0.55, "BATIDA!")
			return
		if body is AnimatableBody3D and speed > 4.0:
			_apply_damage(speed * 0.9, "ACIDENTE!")
			return
		if body in police and speed > 3.0:
			_apply_damage(8.0, "PANCADA DA POLÍCIA!")
			return


func _apply_damage(amount: float, label: String) -> void:
	life = maxf(life - clampf(amount, 4.0, 30.0), 0.0)
	_last_hit = 0.0
	_flash_center(label)


func _flash_center(text: String) -> void:
	_labels["center"].text = text
	var timer := get_tree().create_timer(1.2)
	timer.timeout.connect(
		func() -> void:
			if phase == "race":
				_labels["center"].text = ""
	)


func _update_respawn(delta: float) -> void:
	for car in racers:
		var flipped := car.global_transform.basis.y.dot(Vector3.UP) < 0.15
		var closest := track.closest_route_point_xz(car.global_position.x, car.global_position.z)
		var off_track := (
			Vector2(car.global_position.x, car.global_position.z).distance_to(
				Vector2(closest.x, closest.z)
			)
			> track.road_half_width_at(race_progress(car)) + 9.0
		)
		var fell := (
			car.global_position.y
			< track.height_at(car.global_position.x, car.global_position.z) - 12.0
		)
		# Encalhado: chassi apoiado no asfalto sem velocidade (TRG baixo).
		var beached := (
			car.linear_velocity.length() < 0.5 and not car.get_colliding_bodies().is_empty()
		)
		var stuck := flipped or off_track or fell or beached
		_flip_timers[car] = _flip_timers[car] + delta if stuck else 0.0
		if _flip_timers[car] > 2.5:
			_respawn(car)


func _respawn(car: VehicleBody3D) -> void:
	var s := clampf(race_progress(car), 10.0, track.track_len - 10.0)
	var pos := track.point_at(s)
	var ahead := track.point_at(s + 3.0)
	car.linear_velocity = Vector3.ZERO
	car.angular_velocity = Vector3.ZERO
	car.global_transform = Transform3D(
		Basis.looking_at(pos - ahead, Vector3.UP), pos + Vector3.UP * 1.2
	)
	_flip_timers[car] = 0.0


func _finish(won: bool) -> void:
	phase = "finished"
	player.veh_state = STATE_MENU
	var def: Dictionary = GameState.track_def()
	var msg: String
	if mode == GameState.MODE_CHASE:
		msg = (
			(
				"VOCÊ ESCAPOU! Chegou a %s\nTempo: %s  Vida: %d%%"
				% [def["city_b"], _fmt_time(race_time), int(life)]
			)
			if won
			else "PEGO PELA POLÍCIA!\nO Idea não aguentou..."
		)
	else:
		var ranking := _ranked()
		var lines: Array[String] = []
		for i in ranking.size():
			lines.append("%dº  %s" % [i + 1, ranking[i].name])
		msg = (
			"CHEGOU EM %s!\nTempo: %s\n%s" % [def["city_b"], _fmt_time(race_time), "\n".join(lines)]
		)
	GameState.last_results = [msg]
	_labels["center"].text = msg + "\n\n[Enter] de novo   [Esc] menu"


func _ranked() -> Array:
	var arr := racers.duplicate()
	arr.sort_custom(func(a, b): return race_progress(a) > race_progress(b))
	return arr


func _build_camera() -> void:
	var cam := ChaseCamera.new()
	cam.name = "ChaseCam"
	cam.target = player
	add_child(cam)
	cam.global_transform = player.global_transform.translated(Vector3(0, 3, 8))
	cam.current = true


func _build_hud() -> void:
	var hud := CanvasLayer.new()
	hud.name = "HUD"
	add_child(hud)
	var specs := {
		"speed": [Vector2(24, -70), 34],
		"dist": [Vector2(24, 24), 24],
		"pos": [Vector2(-200, 24), 28],
		"time": [Vector2(-200, 62), 20],
		"center": [Vector2.ZERO, 44],
	}
	for key: String in specs:
		var lbl := Label.new()
		lbl.name = key
		lbl.add_theme_font_size_override("font_size", int(specs[key][1]))
		lbl.add_theme_color_override("font_outline_color", Color.BLACK)
		lbl.add_theme_constant_override("outline_size", 6)
		hud.add_child(lbl)
		var offset: Vector2 = specs[key][0]
		if key == "center":
			lbl.set_anchors_preset(Control.PRESET_CENTER)
			lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			lbl.grow_horizontal = Control.GROW_DIRECTION_BOTH
			lbl.grow_vertical = Control.GROW_DIRECTION_BOTH
		else:
			var preset := Control.PRESET_TOP_LEFT
			if offset.y < 0:
				preset = Control.PRESET_BOTTOM_LEFT
			elif offset.x < 0:
				preset = Control.PRESET_TOP_RIGHT
			lbl.set_anchors_preset(preset)
			lbl.position = offset
		_labels[key] = lbl
	if mode == GameState.MODE_CHASE:
		var bg := ColorRect.new()
		bg.color = Color(0, 0, 0, 0.5)
		bg.set_anchors_preset(Control.PRESET_TOP_LEFT)
		bg.position = Vector2(24, 64)
		bg.size = Vector2(260, 22)
		hud.add_child(bg)
		_life_bar = ColorRect.new()
		_life_bar.color = Color(0.15, 0.85, 0.25)
		_life_bar.position = Vector2(2, 2)
		_life_bar.size = Vector2(256, 18)
		bg.add_child(_life_bar)


func _update_hud() -> void:
	var kmh := player.linear_velocity.length() * 3.6
	_labels["speed"].text = "%d km/h" % int(kmh)
	var remaining := maxf(track.finish_s - race_progress(player), 0.0)
	_labels["dist"].text = "Faltam %.1f km" % (remaining / 1000.0)
	_labels["time"].text = _fmt_time(race_time)
	if mode == GameState.MODE_CHASE:
		var nearest := 9999.0
		for cop in police:
			nearest = minf(nearest, cop.global_position.distance_to(player.global_position))
		_labels["pos"].text = "Polícia a %dm" % int(nearest)
		if _life_bar:
			_life_bar.size.x = 256.0 * life / MAX_LIFE
			_life_bar.color = (Color(0.15, 0.85, 0.25) if life > 40.0 else Color(0.9, 0.25, 0.1))
	else:
		var ranking := _ranked()
		_labels["pos"].text = "%dº/%d" % [ranking.find(player) + 1, racers.size()]


func _capture_frame(delta: float) -> void:
	if _shot_dir == "":
		return
	_shot_timer -= delta
	if _shot_timer > 0.0:
		return
	_shot_timer = 1.5
	var img := get_viewport().get_texture().get_image()
	img.save_png("%s/%s_%s_%02d.png" % [_shot_dir, GameState.selected_track, mode, _shot_n])
	_shot_n += 1


func _print_test_report() -> void:
	var report := {
		"track": GameState.selected_track,
		"mode": mode,
		"track_len": snappedf(track.track_len, 0.1),
		"life": life,
		"police": police.size(),
		"traffic": traffic.get_child_count(),
		"spikes": _spikes.size(),
		"speeds": racers.map(func(c): return snappedf(c.linear_velocity.length() * 3.6, 0.1)),
		"car_y": racers.map(func(c): return snappedf(c.global_position.y, 0.01)),
		"ground_y": racers.map(func(c): return snappedf(_ground_under(c), 0.01)),
		"touching":
		racers.map(func(c): return c.get_colliding_bodies().map(func(b): return str(b.name))),
		"progress": racers.map(func(c): return snappedf(race_progress(c), 0.1)),
	}
	print("TEST_REPORT ", JSON.stringify(report))


func _ground_under(car: VehicleBody3D) -> float:
	return track.height_at(car.global_position.x, car.global_position.z)


func _fmt_time(t: float) -> String:
	return "%d:%05.2f" % [int(t / 60.0), fmod(t, 60.0)]


func _unhandled_input(event: InputEvent) -> void:
	if phase != "finished" or not event is InputEventKey or not event.pressed:
		return
	if event.keycode == KEY_ENTER:
		get_tree().reload_current_scene()
	elif event.keycode == KEY_ESCAPE:
		get_tree().change_scene_to_file("res://scenes/menu.tscn")

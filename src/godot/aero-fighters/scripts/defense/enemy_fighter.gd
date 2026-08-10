class_name EnemyFighter
extends Node3D
## EnemyFighter — caça de ataque do modo defesa (port de enemy-fighters.js).
## Ciclo: ingress → attack-run (release 330→120 m; mísseis ar-solo ou rajada
## no jogador) → egress (5,5 s com jinks) → re-ingress; sai após 2 corridas.
## Clearance de terreno 15 m (6 m no mergulho). Evasão dura ao ser travado.

signal died(fighter: EnemyFighter)

enum State { INGRESS, ATTACK, EGRESS, LEAVE, FALLING }

var state: State = State.INGRESS
var hp := 10
var speed := 110.0
var dead := false
var target_kind := "city" # city | base | battery | player
var target_pos := Vector3.ZERO
var battery_ref: Node3D = null # quando target_kind == "battery"
var runs := 0
var anti_player := false

var _heading := 0.0
var _egress_t := 0.0
var _burst_t := 0.0
var _released := false
var _evade_t := 0.0
var _fall_sink := 60.0
var _fall_trail_t := 0.0
var _surface: Callable
var _fx: FxManager
var _director: Node
var _rng := RandomNumberGenerator.new()


static func create(director: Node, surface_fn: Callable, fx: FxManager,
		rng: RandomNumberGenerator) -> EnemyFighter:
	var f := EnemyFighter.new()
	f._director = director
	f._surface = surface_fn
	f._fx = fx
	f._rng = rng
	f.speed = rng.randf_range(GameConfig.AAF_SPD_MIN, GameConfig.AAF_SPD_MAX)
	f.hp = rng.randi_range(GameConfig.AAF_HP_MIN, GameConfig.AAF_HP_MAX)
	# Spawn a 2.300 m (±10%) — ARCO FRONTAL ±45° do eixo bateria→cidade
	# (~0,96 rad; Wave L3: os inimigos vêm de UMA direção). Bandas de
	# altitude (Wave M2): ~metade baixa (120-180 m), ~metade alta (300-350 m)
	var front := atan2(GameConfig.AA_LOOK_AT.y - GameConfig.AA_SOLDIER_POS.y,
		GameConfig.AA_LOOK_AT.x - GameConfig.AA_SOLDIER_POS.x)
	var ang := front + (rng.randf() * 2.0 - 1.0) * GameConfig.AAD_DIR_ARC
	var dist := GameConfig.AAF_SPAWN_DIST * rng.randf_range(0.9, 1.1)
	var alt := rng.randf_range(GameConfig.AAF_ALT_LOW_MIN, GameConfig.AAF_ALT_LOW_MAX) \
		if rng.randf() < 0.5 else rng.randf_range(GameConfig.AAF_ALT_HIGH_MIN, GameConfig.AAF_ALT_HIGH_MAX)
	var center := Vector3(-250, 0, 250) # centro da cidade
	f.position = center + Vector3(cos(ang) * dist, alt, sin(ang) * dist)
	f._heading = atan2(center.x - f.position.x, center.z - f.position.z) + PI # rumo ao centro
	# Visual: silhueta de caça em UMA malha fundida (Wave I) ESCALADA 2,2× +
	# ponto de brilho de motor de dia (Wave M2 — "não vejo os inimigos, só os
	# quadrados"): legibilidade arcade vence realismo a 2,3 km
	var mi := MeshInstance3D.new()
	mi.mesh = _fighter_mesh()
	mi.material_override = _fighter_material()
	mi.scale = Vector3.ONE * 2.2
	f.add_child(mi)
	var glow := MeshInstance3D.new()
	var gm := SphereMesh.new()
	gm.radius = 1.1
	gm.height = 2.2
	gm.radial_segments = 6
	gm.rings = 4
	glow.mesh = gm
	glow.material_override = _glow_material()
	glow.position = Vector3(0, 0, 4.0) # exaustão
	mi.add_child(glow)
	f._assign_target()
	return f


## Malha fundida do caça (1 draw call): fuselagem, nariz, asas, deriva dupla,
## canopy — vértices escuros; o brilho vem do material emissivo compartilhado.
static func _fighter_mesh() -> ArrayMesh:
	if _mesh_cache == null:
		var acc := HordeFormation.MeshAccum.new()
		var dark := Color(0.22, 0.07, 0.06)
		var darker := Color(0.16, 0.05, 0.045)
		acc.cyl(0.45, 0.7, 6.0, 8, Vector3(0, 0, 0.5), dark, Vector3(PI / 2, 0, 0)) # fuselagem
		acc.cyl(0.03, 0.45, 2.2, 8, Vector3(0, 0, -3.6), dark, Vector3(PI / 2, 0, 0)) # nariz
		acc.box(Vector3(5.2, 0.15, 1.7), Vector3(0, 0, 0.9), darker) # asas em flecha
		acc.box(Vector3(0.9, 0.5, 1.0), Vector3(0, 0.45, -1.6), darker) # canopy
		acc.box(Vector3(0.15, 1.1, 0.9), Vector3(-0.55, 0.55, 3.2), darker) # deriva dupla
		acc.box(Vector3(0.15, 1.1, 0.9), Vector3(0.55, 0.55, 3.2), darker)
		acc.box(Vector3(0.8, 0.6, 0.5), Vector3(0, 0, 3.6), Color(0.9, 0.45, 0.2)) # exaustão
		_mesh_cache = acc.build()
	return _mesh_cache


static func _fighter_material() -> StandardMaterial3D:
	if _mat_cache == null:
		_mat_cache = StandardMaterial3D.new()
		_mat_cache.vertex_color_use_as_albedo = true
		_mat_cache.roughness = 0.7
		_mat_cache.emission_enabled = true
		_mat_cache.emission = Color(0.55, 0.12, 0.10)
		_mat_cache.emission_energy_multiplier = 1.6 # Wave M2 — silhueta quente no céu
	return _mat_cache


## Brilho laranja da exaustão (K6/M2 — ponto luminoso lendo no horizonte DE DIA).
static func _glow_material() -> StandardMaterial3D:
	if _glow_mat_cache == null:
		_glow_mat_cache = StandardMaterial3D.new()
		_glow_mat_cache.albedo_color = Color(0.95, 0.55, 0.18)
		_glow_mat_cache.emission_enabled = true
		_glow_mat_cache.emission = Color(1.0, 0.60, 0.18)
		_glow_mat_cache.emission_energy_multiplier = 4.0
		_glow_mat_cache.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	return _glow_mat_cache


static var _mesh_cache: ArrayMesh = null
static var _mat_cache: StandardMaterial3D = null
static var _glow_mat_cache: StandardMaterial3D = null


func _assign_target() -> void:
	var roll := _rng.randf()
	var w := GameConfig.AAF_TARGET_WEIGHTS
	var center := Vector3(-250, 0, 250)
	if roll < w.city:
		target_kind = "city"
		target_pos = center + Vector3(_rng.randf_range(-100, 100), 0, _rng.randf_range(-100, 100))
	elif roll < w.city + w.base:
		target_kind = "base"
		target_pos = Vector3(GameConfig.AIRPORT_POS.x, 0, GameConfig.AIRPORT_POS.y)
	elif roll < w.city + w.base + w.battery and not _director.batteries.is_empty():
		target_kind = "battery"
		battery_ref = _director.batteries[_rng.randi() % _director.batteries.size()]
		target_pos = battery_ref.global_position
	else:
		target_kind = "player"
	anti_player = target_kind == "player"
	target_pos.y = _surface.call(target_pos.x, target_pos.z)


func damage(amount: float) -> void:
	if dead:
		return
	hp -= amount
	if hp <= 0:
		dead = true
		state = State.FALLING
		_fall_sink = _rng.randf_range(26.0, 115.0)
		GameState.score += GameConfig.AA_SCORE_KILL
		_director.kills += 1
		died.emit(self)
		# Bola de fogo no abate (Wave G/K6/M2 — legível da bateria a 2+ km)
		if _fx:
			_fx.explosion(global_position, 3.2)


## Evasão dura (chaff/flare + 2,4 s a 2,6 rad/s) — chamada ao ser travada.
func start_evade() -> void:
	if not dead:
		_evade_t = GameConfig.AAF_EVADE_TIME


func _physics_process(delta: float) -> void:
	var dt := minf(delta, 0.1)
	match state:
		State.FALLING:
			_update_falling(dt)
		_:
			_update_flight(dt)


func _update_flight(dt: float) -> void:
	var desired := _heading
	var turret: Node3D = GameState.player
	match state:
		State.INGRESS:
			var goal := target_pos
			if target_kind == "player" and turret:
				goal = turret.global_position
			desired = atan2(goal.x - position.x, goal.z - position.z) + PI
			if Vector2(position.x, position.z).distance_to(Vector2(goal.x, goal.z)) < GameConfig.AAF_ATTACK_OPEN:
				state = State.ATTACK
				_released = false
		State.ATTACK:
			var goal := target_pos
			if target_kind == "player" and turret:
				goal = turret.global_position
			var dist := Vector2(position.x, position.z).distance_to(Vector2(goal.x, goal.z))
			desired = atan2(goal.x - position.x, goal.z - position.z) + PI
			# Janela de release 330→120 m
			if not _released and dist < GameConfig.AAF_RELEASE_FAR:
				_released = true
				if target_kind == "player":
					_burst_t = GameConfig.AAF_GUN_BURST_TIME
				else:
					_director.launch_ordnance(self, target_pos, target_kind, battery_ref)
			if _burst_t > 0.0 and turret:
				_burst_t -= dt
				_director.fire_strafe_tracer(self, turret)
			if dist < GameConfig.AAF_RELEASE_NEAR:
				runs += 1
				state = State.EGRESS
				_egress_t = GameConfig.AAF_EGRESS_TIME
		State.EGRESS:
			_egress_t -= dt
			# Jinks ±0,9 rad
			desired = _heading + sin(Time.get_ticks_msec() / 300.0) * GameConfig.AAF_JINK
			if _egress_t <= 0.0:
				if runs >= GameConfig.AAF_RUNS_MAX:
					state = State.LEAVE
				else:
					state = State.INGRESS
					_assign_target()
		State.LEAVE:
			desired = _heading
			if position.distance_to(Vector3(-250, position.y, 250)) > GameConfig.AAF_SPAWN_DIST * 1.1:
				queue_free()
				return
	# Evasão dura sobrepõe o rumo
	var turn_rate := 1.2
	if _evade_t > 0.0:
		_evade_t -= dt
		turn_rate = GameConfig.AAF_EVADE_RATE
		desired += sin(_evade_t * 8.0) * 1.2
	# Steering de rumo
	var diff := wrapf(desired - _heading, -PI, PI)
	_heading += clampf(diff, -turn_rate * dt, turn_rate * dt)
	# Movimento (convenção: heading h → frente (-sin h, -cos h))
	var dir := Vector3(-sin(_heading), 0, -cos(_heading))
	position += dir * speed * dt
	# Mergulho na corrida de ataque ao solo; clearance de terreno
	var clear := GameConfig.AAF_TERRAIN_CLEAR_DIVE if state == State.ATTACK else GameConfig.AAF_TERRAIN_CLEAR
	var min_y: float = _surface.call(position.x, position.z) + clear
	var cruise_y := min_y + 60.0
	if state == State.ATTACK:
		cruise_y = min_y + 10.0
	position.y = lerpf(position.y, maxf(min_y, cruise_y), minf(1.0, 1.5 * dt))
	position.y = maxf(position.y, min_y)
	rotation.y = _heading


func _update_falling(dt: float) -> void:
	# Queda (espiral) + tumble
	_heading += 2.0 * dt
	rotation.y = _heading
	rotate_z(1.5 * dt)
	position += Vector3(-sin(_heading), 0, -cos(_heading)) * speed * 0.4 * dt
	position.y -= _fall_sink * dt
	# Destroço em chamas: esteira fumaça+fogo DENSA até o chão (web fall-trail —
	# Wave M2: "a explosão, a fumaça, o fogo" — coluna grossa que se lê a 2 km)
	_fall_trail_t -= dt
	if _fall_trail_t <= 0.0:
		_fall_trail_t = 0.035
		if _fx:
			_fx.trail_puff(position)
			_fx.trail_puff(position + Vector3(randf_range(-2, 2), randf_range(-2, 2), randf_range(-2, 2)))
			_fx.muzzle_flash(position, 1.4)
	var surf: float = _surface.call(position.x, position.z)
	if position.y <= surf + 2.0:
		if _fx:
			_fx.mega_explosion(Vector3(position.x, surf, position.z), 4.0)
		queue_free()

class_name AlliedFighter
extends Node3D
## AlliedFighter — caça amigo do modo defesa (Wave L4 — "coloque baterias e
## caças amigos"): 2-3 jatos aliados patrulham o perímetro da bateria e
## interceptam caças inimigos, priorizando os que miram o jogador e os do
## hemisfério traseiro. Mesma malha fundida do EnemyFighter (1 draw call) com
## material aliado azul; tracers visíveis + explosão de abate. Aliados não
## morrem (a guerra paralela é visual — paridade wingmen.js do web).

enum State { PATROL, INTERCEPT }

var state: State = State.PATROL

var _heading := 0.0
var _speed := 95.0
var _slot := 0
var _orbit_a := 0.0
var _target: Node3D = null
var _fire_t := 0.0
var _surface: Callable
var _fx: FxManager
var _director: Node
var _rng := RandomNumberGenerator.new()

static var _mat_cache: StandardMaterial3D = null


static func create(director: Node, surface_fn: Callable, fx: FxManager,
		rng: RandomNumberGenerator, slot: int) -> AlliedFighter:
	var f := AlliedFighter.new()
	f._director = director
	f._surface = surface_fn
	f._fx = fx
	f._rng = rng
	f._slot = slot
	f._orbit_a = rng.randf() * TAU
	f._speed = rng.randf_range(88.0, 104.0)
	# Nasce em patrulha no anel de 700 m em torno da bateria
	var anchor := f._patrol_point()
	f.position = anchor
	f._heading = f._orbit_a + PI / 2 # tangente ao anel
	var mi := MeshInstance3D.new()
	mi.mesh = EnemyFighter._fighter_mesh()
	mi.material_override = f._allied_material()
	mi.scale = Vector3.ONE * 1.25
	f.add_child(mi)
	var glow := MeshInstance3D.new()
	var gm := SphereMesh.new()
	gm.radius = 0.7
	gm.height = 1.4
	gm.radial_segments = 6
	gm.rings = 4
	glow.mesh = gm
	glow.material_override = EnemyFighter._glow_material()
	glow.position = Vector3(0, 0, 4.0) # exaustão
	mi.add_child(glow)
	return f


## Material aliado: azul-aço emissivo suave (distinto do vermelho inimigo).
static func _allied_material() -> StandardMaterial3D:
	if _mat_cache == null:
		_mat_cache = StandardMaterial3D.new()
		_mat_cache.albedo_color = Color(0.30, 0.42, 0.62)
		_mat_cache.roughness = 0.6
		_mat_cache.emission_enabled = true
		_mat_cache.emission = Color(0.15, 0.30, 0.60)
		_mat_cache.emission_energy_multiplier = 0.8
	return _mat_cache


## Ponto de patrulha: anel de 700 m em torno da bateria, altitude cruzeiro.
func _patrol_point() -> Vector3:
	var a := _orbit_a + _slot * (TAU / 3.0)
	var x: float = GameConfig.AA_SOLDIER_POS.x + cos(a) * 700.0
	var z: float = GameConfig.AA_SOLDIER_POS.y + sin(a) * 700.0
	var y: float = (_surface.call(x, z) if _surface.is_valid() else 0.0) + 210.0
	return Vector3(x, y, z)


## Escolhe o alvo: caça anti-jogador > caça no hemisfério traseiro > mais
## próximo, em até 1.700 m do aliado.
func _pick_target() -> Node3D:
	var best: Node3D = null
	var best_score := -INF
	var rear_axis := AlliedBattery._rear_axis()
	for e in _director.fighters:
		if not is_instance_valid(e) or e.dead:
			continue
		var d: float = global_position.distance_to(e.global_position)
		if d > 1700.0:
			continue
		var score := -d
		if e.target_kind == "player":
			score += 4000.0 # quem mira o artilheiro cai primeiro
		else:
			var bearing := Vector2(e.global_position.x - GameConfig.AA_SOLDIER_POS.x,
				e.global_position.z - GameConfig.AA_SOLDIER_POS.y)
			if bearing.length() > 1.0 and bearing.normalized().dot(rear_axis) >= 0.0:
				score += 2000.0 # hemisfério traseiro
		if score > best_score:
			best_score = score
			best = e
	return best


func _physics_process(delta: float) -> void:
	if not GameState.running or GameState.paused:
		return
	var dt := minf(delta, 0.1)
	# (Re)aquisição: em patrulha procura alvo; em interceptação revalida
	if state == State.PATROL:
		_target = _pick_target()
		if _target != null:
			state = State.INTERCEPT
	elif not is_instance_valid(_target) or _target.dead:
		_target = null
		state = State.PATROL
	# Rumo desejado
	var desired := _heading
	if state == State.INTERCEPT:
		var goal: Vector3 = _target.global_position
		desired = atan2(goal.x - position.x, goal.z - position.z) + PI
		_update_fire(dt, goal)
	else:
		_orbit_a += dt * (_speed / 700.0) * 0.6 # deriva lenta do anel
		var goal := _patrol_point()
		desired = atan2(goal.x - position.x, goal.z - position.z) + PI
	# Steering de rumo (mesmo modelo do EnemyFighter)
	var diff := wrapf(desired - _heading, -PI, PI)
	_heading += clampf(diff, -1.4 * dt, 1.4 * dt)
	var dir := Vector3(-sin(_heading), 0, -cos(_heading))
	position += dir * _speed * dt
	# Altitude: persegue a do alvo na interceptação; cruzeiro na patrulha
	var min_y: float = (_surface.call(position.x, position.z) if _surface.is_valid() else 0.0) + 15.0
	var cruise_y := min_y + 120.0
	if state == State.INTERCEPT:
		cruise_y = _target.global_position.y
	position.y = lerpf(position.y, maxf(min_y, cruise_y), minf(1.0, 1.8 * dt))
	position.y = maxf(position.y, min_y)
	rotation.y = _heading


## Tracers de interceptação (visuais) + roll de abate quando colado no alvo.
func _update_fire(dt: float, goal: Vector3) -> void:
	var d: float = global_position.distance_to(goal)
	if d > 420.0:
		return
	_fire_t -= dt
	if _fire_t > 0.0:
		return
	_fire_t = 0.45
	if _fx:
		# Rajada: flash no nariz + puffs de impacto perto do alvo (tracers)
		_fx.muzzle_flash(global_position + Vector3(0, 0, -3).rotated(Vector3.UP, _heading), 0.6)
		_fx.smoke_puff(goal + Vector3(_rng.randf_range(-14, 14),
			_rng.randf_range(-8, 8), _rng.randf_range(-14, 14)))
	if d < 260.0 and _rng.randf() < 0.22:
		_target.damage(999) # abate — explosão + queda em chamas pelo EnemyFighter
		_target = null
		state = State.PATROL

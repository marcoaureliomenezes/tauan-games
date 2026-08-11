class_name CampaignDirector
extends Node
## CampaignDirector — diretor da campanha Inhaúma (port de campaign.js +
## city-war.js + updateFormationFire). Ato 1 "SALVAR INHAÚMA": artilharia +
## colunas de invasão seedadas; coluna que chega = Inhaúma cai (reset do ato,
## guarnição intocada). Ato 2 "LIBERTE CACHOEIRA": varrer a guarnição.

signal act_advanced(act: int)
signal inhauma_fallen
signal victory

# Rotas templates validadas do web (config.js CAMPAIGN.columnRoutes/artilleryRoutes)
const ROUTE_NORTH := [Vector2(-940, 520), Vector2(-800, 220), Vector2(-760, -80),
	Vector2(-740, -480), Vector2(-300, -520), Vector2(-40, -200)]
const ROUTE_FAR_NORTH := [Vector2(-940, 520), Vector2(-800, 220), Vector2(-760, -80),
	Vector2(-740, -480), Vector2(-500, -700), Vector2(-200, -760), Vector2(100, -500), Vector2(200, -200)]
const ROUTE_ROAD := [Vector2(-1250, 610), Vector2(-1250, 450), Vector2(-1180, 300),
	Vector2(-960, 280), Vector2(-800, 220), Vector2(-760, -80), Vector2(-740, -480),
	Vector2(-300, -520), Vector2(-40, -200)] # MG-060 aprox. + roadTail (TODO: estrada real)
const ARTILLERY_ROUTES := [
	[Vector2(-940, 520), Vector2(-800, 220), Vector2(-900, -100), Vector2(-1100, -500)],
	[Vector2(-940, 520), Vector2(-800, 220), Vector2(-760, -80), Vector2(-800, -800)],
	[Vector2(-940, 520), Vector2(-800, 220), Vector2(-760, -80), Vector2(-740, -480), Vector2(-1000, -650)],
]
const COLUMNS := [["supplyConvoy", 5], ["troopColumn", 8], ["armoredColumn", 10], ["tankPlatoon", 12]]

var act := 1
var t := 0.0
var failed := false
var won := false
var formations: Array[Formation] = []
var garrison: Array[Formation] = []

var _pending: Array[Dictionary] = []
var _act_total := 0
var _surface: Callable
var _fx: FxManager
var _rng := RandomNumberGenerator.new()
var _parent: Node3D
var _shells: Array[Dictionary] = [] # city-war: obuses em voo


func setup(parent: Node3D, surface_fn: Callable, fx: FxManager, garrison_formations: Array[Formation]) -> void:
	_parent = parent
	_surface = surface_fn
	_fx = fx
	garrison = garrison_formations
	_rng.seed = 42 # determinismo é contrato (web: rng derivado da seed)
	_build_schedule()


func _build_schedule() -> void:
	_pending.clear()
	formations.clear()
	act = 1
	t = 0.0
	failed = false
	var at := GameConfig.CAMP_ACT1_FIRST_SPAWN
	for i in GameConfig.CAMP_ACT1_ARTILLERY.batteries:
		var size: int = _rng.randi_range(GameConfig.CAMP_ACT1_ARTILLERY.units_min,
			GameConfig.CAMP_ACT1_ARTILLERY.units_max)
		_pending.append({"type": "artilleryBattery", "size": size, "route": ARTILLERY_ROUTES[i], "at": at})
		at += _rng.randf_range(GameConfig.CAMP_ACT1_INTERVAL_MIN, GameConfig.CAMP_ACT1_INTERVAL_MAX)
	var routes := [ROUTE_NORTH, ROUTE_ROAD, ROUTE_FAR_NORTH]
	for col in COLUMNS:
		_pending.append({"type": col[0], "size": col[1], "route": routes[_rng.randi() % 3], "at": at})
		at += _rng.randf_range(GameConfig.CAMP_ACT1_INTERVAL_MIN, GameConfig.CAMP_ACT1_INTERVAL_MAX)
	_act_total = _pending.reduce(func(sum, e): return sum + e.size, 0)
	GameState.targets_total = _act_total
	GameState.targets_destroyed = 0
	GameState.campaign_act = 1


func _process(delta: float) -> void:
	if not GameState.running or GameState.paused or failed or won:
		return
	var dt := minf(delta, 0.1)
	t += dt
	while not _pending.is_empty() and _pending[0].at <= t:
		_spawn(_pending.pop_front())
	for f in formations:
		if is_instance_valid(f):
			f.update(dt)
	for f in garrison:
		if is_instance_valid(f):
			f.update(dt)
	_update_enemy_fire(dt)
	_update_city_war(dt)
	# Invasão bem-sucedida: qualquer coluna do Ato 1 que completa o path
	if act == 1 and formations.any(func(f): return is_instance_valid(f) and f.state == "arrived"):
		failed = true
		GameState.inhauma_fallen = true
		inhauma_fallen.emit()
		return
	# Contadores do ato
	var group := formations if act == 1 else garrison
	var destroyed := 0
	var total := 0
	for f in group:
		if not is_instance_valid(f):
			continue
		for m in f.members:
			total += 1
			if not is_instance_valid(m) or m.dead:
				destroyed += 1
		# membros mortos já foram compactados; soma os que morreram
	var alive_members := 0
	for f in group:
		if is_instance_valid(f):
			alive_members += f.alive_count()
	if act == 1:
		GameState.targets_destroyed = _act_total - alive_members - _pending.reduce(func(s, e): return s + e.size, 0)
		GameState.targets_total = _act_total
		if _pending.is_empty() and alive_members == 0 and not formations.is_empty():
			_advance_act()
	else:
		GameState.targets_destroyed = GameState.targets_total - alive_members
		if alive_members == 0:
			won = true
			GameState.cachoeira_liberated = true
			victory.emit()


func _advance_act() -> void:
	act = 2
	var total := 0
	for f in garrison:
		if is_instance_valid(f):
			total += f.alive_count()
	GameState.targets_total = total
	GameState.targets_destroyed = 0
	GameState.campaign_act = 2
	act_advanced.emit(2)


## Reset do Ato 1 após "INHAÚMA CAIU" — guarnição NUNCA é tocada.
func reset_campaign() -> void:
	for f in formations:
		if is_instance_valid(f):
			f.queue_free()
	for s in _shells:
		if is_instance_valid(s.mesh):
			s.mesh.queue_free()
	_shells.clear()
	_build_schedule()


func _spawn(entry: Dictionary) -> void:
	var f := Formation.create(entry.type, entry.size, entry.route, _surface, _rng,
		"campaign-act1-%s" % entry.type)
	_parent.add_child(f)
	formations.append(f)


# ---------------------------------------------------------------------------
# Fogo inimigo de formação (updateFormationFire — modelo probabilístico)
# ---------------------------------------------------------------------------
func _update_enemy_fire(dt: float) -> void:
	var jet: Jet = GameState.player as Jet
	if jet == null or jet.state != Jet.State.AIRBORNE:
		return
	for target in GameState.targets:
		if target.dead or target.fire_kind == "" or target.fire_range <= 0.0:
			continue
		var to: Vector3 = jet.global_position - target.global_position
		var dist := to.length()
		if dist > target.fire_range or dist < 0.001:
			continue
		target.fire_timer -= dt
		if target.fire_timer > 0.0:
			continue
		target.fire_timer = target.fire_interval + _rng.randf() * 0.5
		var dir := to / dist
		if _rng.randf() >= _hit_probability(dist, target.fire_kind):
			# MISS seedado: gira a mira 2-6° num plano perpendicular
			var a := deg_to_rad(_rng.randf_range(GameConfig.EF_MISS_SPREAD_MIN_DEG, GameConfig.EF_MISS_SPREAD_MAX_DEG))
			var perp := Vector3(-dir.z, 0, dir.x).normalized()
			if perp.length() < 0.001:
				perp = Vector3.RIGHT
			var tan_v := tan(a) * (1.0 if _rng.randf() < 0.5 else -1.0)
			dir = (dir + perp * tan_v + Vector3(0, (_rng.randf() - 0.5) * tan_v, 0)).normalized()
		var muzzle_y := 1.8 if target.fire_kind == "aa" else 2.0
		EnemyBullet.fire_from(_parent, target.global_position + dir * 2.0 + Vector3(0, muzzle_y, 0),
			dir, _surface)


func _hit_probability(dist: float, cls: String) -> float:
	if cls == "aa":
		return maxf(GameConfig.EF_AA_FLOOR, minf(GameConfig.EF_AA_P0,
			GameConfig.EF_AA_P0 - maxf(0.0, dist / GameConfig.EF_NEAR_R - 1.0) * GameConfig.EF_AA_DECAY))
	return maxf(GameConfig.EF_GND_FLOOR, minf(GameConfig.EF_GND_P0,
		GameConfig.EF_GND_P0 - maxf(0.0, dist / GameConfig.EF_NEAR_R - 1.0) * GameConfig.EF_GND_DECAY))


# ---------------------------------------------------------------------------
# Guerra urbana (city-war.js): artilharia 'deployed' bombardeia os prédios
# ---------------------------------------------------------------------------
func _update_city_war(dt: float) -> void:
	# Disparo das baterias posicionadas
	for f in formations:
		if not is_instance_valid(f) or f.state != "deployed":
			continue
		for m in f.members:
			if not is_instance_valid(m) or m.type != "fArtillery":
				continue
			m.fire_timer -= dt
			if m.fire_timer <= 0.0:
				m.fire_timer = _rng.randf_range(GameConfig.CAMP_ACT1_ARTILLERY.cycle_min,
					GameConfig.CAMP_ACT1_ARTILLERY.cycle_max)
				_fire_shell(m)
	# Voo dos obuses (arco balístico simples)
	for i in range(_shells.size() - 1, -1, -1):
		var s := _shells[i]
		s.t += dt
		var k: float = minf(s.t / s.dur, 1.0)
		if not is_instance_valid(s.mesh):
			_shells.remove_at(i)
			continue
		var pos: Vector3 = s.from.lerp(s.to, k)
		pos.y += sin(k * PI) * s.arc
		s.mesh.position = pos
		if k >= 1.0:
			if _fx:
				_fx.explosion(s.to, 1.5)
			s.mesh.queue_free()
			_shells.remove_at(i)


func _fire_shell(unit: Target) -> void:
	# Alvo: ponto aleatório no downtown de Inhaúma
	var c := GameConfig.MAP_DOWNTOWN
	var a := _rng.randf() * TAU
	var r := _rng.randf() * GameConfig.MAP_DOWNTOWN_R
	var to := Vector3(c.x + cos(a) * r, 0, c.y + sin(a) * r)
	to.y = _surface.call(to.x, to.z)
	var mesh := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.8
	sphere.height = 1.6
	mesh.mesh = sphere
	_parent.add_child(mesh)
	mesh.position = unit.global_position
	_shells.append({"mesh": mesh, "from": unit.global_position, "to": to,
		"t": 0.0, "dur": _rng.randf_range(GameConfig.CAMP_ACT1_ARTILLERY.flight_min,
			GameConfig.CAMP_ACT1_ARTILLERY.flight_max), "arc": 120.0})

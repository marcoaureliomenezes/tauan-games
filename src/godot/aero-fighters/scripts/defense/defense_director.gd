class_name DefenseDirector
extends Node
## DefenseDirector — diretor de spawn infinito do modo defesa (port de
## defense-director.js — no web ficou especificado mas NÃO integrado; aqui já
## nasce integrado): intervalo 6 s ×0,93 a cada 5 kills (piso 1,5 s),
## esquadrilhas 1→4 por degraus 0/12/30/60 kills, cap 10 vivos, streaks a cada 10.

signal squadron_spawned(size: int)
signal horde_spawned
signal horde_wiped
signal horde_arrived

var fighters: Array[EnemyFighter] = []
var ordnance: Array[EnemyOrdnance] = []
var batteries: Array[AlliedBattery] = []
var allies: Array[AlliedFighter] = []
var kills := 0

var _parent: Node3D
var _surface: Callable
var _fx: FxManager
var _rng := RandomNumberGenerator.new()
var _spawn_t := GameConfig.AADIR_INTERVAL
var _horde: HordeFormation = null
var _horde_t := GameConfig.HORDE_FIRST_S


func setup(parent: Node3D, surface_fn: Callable, fx: FxManager) -> void:
	_parent = parent
	_surface = surface_fn
	_fx = fx
	_rng.seed = 4242
	_spawn_batteries()
	_spawn_allied_fighters()


func _process(delta: float) -> void:
	if not GameState.running or GameState.paused:
		return
	var dt := minf(delta, 0.1)
	# Limpa mortos/liberados (in-place, sem alocar — perf Wave B)
	for i in range(fighters.size() - 1, -1, -1):
		if not is_instance_valid(fighters[i]):
			fighters.remove_at(i)
	for i in range(ordnance.size() - 1, -1, -1):
		if not is_instance_valid(ordnance[i]):
			ordnance.remove_at(i)
	# Spawn escalonado
	_spawn_t -= dt
	if _spawn_t <= 0.0 and fighters.size() < GameConfig.AADIR_MAX_ALIVE:
		var ramp_steps := int(kills / GameConfig.AADIR_RAMP_EVERY)
		_spawn_t = maxf(GameConfig.AADIR_INTERVAL_FLOOR,
			GameConfig.AADIR_INTERVAL * pow(GameConfig.AADIR_RAMP, ramp_steps))
		var squad := _squadron_size()
		for i in mini(squad, GameConfig.AADIR_MAX_ALIVE - fighters.size()):
			_spawn_fighter()
		squadron_spawned.emit(squad)
	# Agenda da horda (stepHorde do web — 1 ativa por vez)
	if _horde == null:
		_horde_t -= dt
		if _horde_t <= 0.0:
			_horde_t += GameConfig.HORDE_CYCLE_S
			_spawn_horde()
	elif _horde.alive_count() == 0:
		_horde.queue_free()
		_horde = null
		horde_wiped.emit()
	elif _horde.arrived:
		var c := _horde.centroid()
		if _fx:
			_fx.mega_explosion(c, 3.0)
		GameState.city_integrity = maxf(0.0, GameState.city_integrity - GameConfig.HORDE_CITY_DAMAGE)
		_horde.queue_free()
		_horde = null
		horde_arrived.emit()
		if GameState.city_integrity <= 0.0:
			GameState.game_over.emit("INHAÚMA CAIU")
	_update_threat_alarm()


## A horda ativa (null entre ciclos).
func horde() -> HordeFormation:
	return _horde


## ETA da chegada da horda à cidade (s).
func horde_eta() -> float:
	return _horde.eta() if _horde != null else 0.0


## Bússola seedada (rng()*2π — NÃO quantizada em setores); retry evita o rio.
func _spawn_horde() -> void:
	var river_check := Callable()
	var m: Variant = _parent.get("map")
	if m != null and m.heightmap != null:
		river_check = m.heightmap.river().is_channel
	_horde = HordeFormation.create(_rng.randf() * TAU, _surface, _fx, river_check)
	if _horde:
		_parent.add_child(_horde)
		horde_spawned.emit()


func _squadron_size() -> int:
	var size := 1
	for step in GameConfig.AADIR_SQUAD_STEPS:
		if kills >= step:
			size += 1
	return mini(size, 4)


func _spawn_fighter() -> void:
	var f := EnemyFighter.create(self, _surface, _fx, _rng)
	_parent.add_child(f)
	fighters.append(f)


func launch_ordnance(from: Node3D, target_pos: Vector3, kind: String, battery: Node3D) -> void:
	# 1-2 mísseis ar-solo por corrida de ataque
	for i in _rng.randi_range(1, 2):
		var o := EnemyOrdnance.create(
			from.global_position + Vector3(_rng.randf_range(-8, 8), -2, _rng.randf_range(-8, 8)),
			target_pos + Vector3(_rng.randf_range(-12, 12), 0, _rng.randf_range(-12, 12)),
			kind, battery, _surface, _fx)
		_parent.add_child(o)
		ordnance.append(o)


## Rajada do caça contra o artilheiro (tracer a 11/s; acerto só se o tracer
## passa a ≤2,5 m — paridade web stepEnemyTracer; antes 22% a ≤10 m ≈ 3 HP
## por corrida = "morte súbita" sem telegrafagem).
func fire_strafe_tracer(from: Node3D, turret: Node3D) -> void:
	var dir: Vector3 = (turret.global_position - from.global_position).normalized()
	dir = (dir + Vector3(_rng.randf_range(-1, 1), _rng.randf_range(-0.3, 0.3), _rng.randf_range(-1, 1)) * 0.02).normalized()
	# Amostra o ponto de passagem: só acerta se passa a ≤2,5 m do artilheiro
	var to_turret: Vector3 = turret.global_position - from.global_position
	var along := to_turret.dot(dir)
	var closest: float = (to_turret - dir * along).length()
	if closest <= GameConfig.AA_TRACER_HIT_R:
		turret.hit(1)
	if _fx and _rng.randf() < 0.3:
		_fx.smoke_puff(turret.global_position + Vector3(_rng.randf_range(-6, 6), 0, _rng.randf_range(-6, 6)))


func _spawn_batteries() -> void:
	# 3-5 baterias: 1-2 no morro (perto do jogador), resto na base aérea
	var count := _rng.randi_range(GameConfig.AAB_COUNT_MIN, GameConfig.AAB_COUNT_MAX)
	var soldier := GameConfig.AA_SOLDIER_POS
	var spots: Array[Vector2] = []
	for i in mini(2, count):
		spots.append(soldier + Vector2(_rng.randf_range(-120, 120), _rng.randf_range(-80, 80)))
	var base := GameConfig.AIRPORT_POS
	while spots.size() < count:
		spots.append(base + Vector2(_rng.randf_range(-150, 150), _rng.randf_range(-250, 250)))
	for s in spots:
		var b := AlliedBattery.create(self, _fx,
			Vector3(s.x, _surface.call(s.x, s.y), s.y), _rng)
		_parent.add_child(b)
		batteries.append(b)
	# Retaguarda dedicada (PORT-GODOT §D.3): SOLDIER + rearAxis·340 = (-954,7,-758,7)
	var rear_axis := AlliedBattery._rear_axis()
	var rp: Vector2 = GameConfig.AA_SOLDIER_POS + rear_axis * GameConfig.REAR_BATT_DIST
	var rear := AlliedBattery.create(self, _fx,
		Vector3(rp.x, _surface.call(rp.x, rp.y), rp.y), _rng, true)
	_parent.add_child(rear)
	batteries.append(rear)


## Caças amigos (Wave L4 — "caças aliados abatendo qualquer avião na minha
## retaguarda"): patrulha em anel + interceptação, prioridade anti-jogador/trás.
func _spawn_allied_fighters() -> void:
	for i in GameConfig.ALLIED_FTR_COUNT:
		var f := AlliedFighter.create(self, _surface, _fx, _rng, i)
		_parent.add_child(f)
		allies.append(f)


## Alarme de míssil incoming (HUD): ordenança anti-jogador em voo.
func incoming_threat() -> bool:
	for o in ordnance:
		if is_instance_valid(o) and o.anti_player and not o.dead:
			return true
	return false


var _threat_was_active := false


func _update_threat_alarm() -> void:
	var active := incoming_threat()
	if active and not _threat_was_active:
		AudioManager.play("incoming", -4.0)
	_threat_was_active = active

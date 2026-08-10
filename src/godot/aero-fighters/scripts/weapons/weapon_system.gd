class_name WeaponSystem
extends Node3D
## WeaponSystem — arsenal do caça (port de projectiles.js + crosshair.js):
## canhão contínuo, lock-on (cone ±15°/1.600 m/0,35 s), mísseis leve/pesado/
## nuke/rod com estoques de GameState, coleta de pickups.

signal lock_progress(target: Node3D, p: float) # candidato + 0..1 (1 = locked)

var jet: Jet
var _surface: Callable
var _fx: FxManager
var _cannon_t := 0.0
var _lock_target: Target = null
var _lock_timer := 0.0
var _locked := false
var _beep_t := 0.0


func setup(p_jet: Jet, surface_fn: Callable, fx: FxManager) -> void:
	jet = p_jet
	_surface = surface_fn
	_fx = fx


func _physics_process(delta: float) -> void:
	if not GameState.running or GameState.paused or jet == null:
		return
	if jet.state != Jet.State.AIRBORNE:
		return
	var dt := minf(delta, 0.1)
	_update_lock(dt)
	_update_cannon(dt)
	if Input.is_action_just_pressed("missile_light"):
		_fire_missile(Projectile.Kind.LIGHT)
	if Input.is_action_just_pressed("missile_heavy"):
		_fire_missile(Projectile.Kind.HEAVY)
	if Input.is_action_just_pressed("missile_nuke"):
		_fire_missile(Projectile.Kind.NUKE)
	if Input.is_action_just_pressed("missile_rod"):
		_fire_rod()


## Lock-on: alvo mais central dentro de cone ±15° até 1.600 m; 0,35 s contínuos.
func _update_lock(dt: float) -> void:
	var fwd := -jet.basis.z
	var best: Target = null
	var best_angle := deg_to_rad(GameConfig.LOCK_CONE_DEG)
	for e in GameState.targets:
		if e.dead:
			continue
		var to: Vector3 = e.global_position - jet.global_position
		if to.length() > GameConfig.LOCK_RANGE:
			continue
		var ang := fwd.angle_to(to.normalized())
		if ang < best_angle:
			best_angle = ang
			best = e
	if best != null and best == _lock_target:
		_lock_timer += dt
	else:
		_lock_target = best
		_lock_timer = 0.0
	var now_locked := _lock_target != null and _lock_timer >= GameConfig.LOCK_TIME
	_locked = now_locked
	# HUD: candidato + fração a cada frame (padrão lock_progress da Wave A)
	lock_progress.emit(_lock_target,
		clampf(_lock_timer / GameConfig.LOCK_TIME, 0.0, 1.0) if _lock_target != null else 0.0)
	# Beeps (crosshair.js): 0,45 s procurando / 0,12 s travado, tom mais agudo
	if _lock_target != null:
		_beep_t -= dt
		if _beep_t <= 0.0:
			_beep_t = GameConfig.LOCK_BEEP_LOCKED if _locked else GameConfig.LOCK_BEEP_SEEK
			AudioManager.play("lock_on" if _locked else "lock_search", -12.0)
	else:
		_beep_t = 0.0


func _update_cannon(dt: float) -> void:
	_cannon_t -= dt
	if not Input.is_action_pressed("fire_cannon") or _cannon_t > 0.0:
		return
	_cannon_t = GameConfig.CANNON_INTERVAL
	AudioManager.play("cannon", -10.0)
	# 2 balas por tiro, saem do centerline para bater na mira (regra do web)
	for i in GameConfig.CANNON_BULLETS_PER_SHOT:
		var b := Projectile.bullet(
			jet.to_global(Vector3(0, 0, -GameConfig.CANNON_NOSE_SPAWN)),
			-jet.basis.z * (GameConfig.CANNON_SPD + jet.speed))
		b.setup(_surface, _fx)
		add_child(b)
	# Flash nas asas (±0,91 m — config do web)
	if _fx:
		_fx.muzzle_flash(jet.to_global(Vector3(GameConfig.CANNON_WING_OFFSET, 0, -2.0)), 0.8)
		_fx.muzzle_flash(jet.to_global(Vector3(-GameConfig.CANNON_WING_OFFSET, 0, -2.0)), 0.8)


func _fire_missile(p_kind: Projectile.Kind) -> void:
	# Estoques (leve é infinito desde T-C-08)
	match p_kind:
		Projectile.Kind.HEAVY:
			if GameState.heavy_missiles <= 0:
				return
		Projectile.Kind.NUKE:
			if GameState.nukes <= 0:
				return
	# Leve/pesado requerem lock; nuke dispara mesmo sem
	var tgt: Target = null
	if p_kind == Projectile.Kind.NUKE:
		tgt = _lock_target if _locked else null
	else:
		if not _locked or _lock_target == null:
			return
		tgt = _lock_target
	var m := Projectile.missile(p_kind, jet.to_global(_spawn_offset(p_kind)),
		-jet.basis.z * _exit_speed(p_kind) + jet.velocity_hint(), tgt)
	m.setup(_surface, _fx)
	add_child(m)
	AudioManager.play("missile", -12.0, 0.7)
	match p_kind:
		Projectile.Kind.HEAVY:
			GameState.heavy_missiles -= 1
		Projectile.Kind.NUKE:
			GameState.nukes -= 1


var _side := 1


## Posição do trilho de lançamento (pylons do loadout, alternando as asas).
func _spawn_offset(p_kind: Projectile.Kind) -> Vector3:
	_side = -_side
	match p_kind:
		Projectile.Kind.LIGHT:
			return Vector3(_side * 0.9, -0.15, 0.4)
		Projectile.Kind.HEAVY:
			return Vector3(_side * 1.1, -0.18, 0.55)
		Projectile.Kind.NUKE:
			return Vector3(0, -0.35, 0.5) # centerline ventral
	return Vector3(_side * 1.79, -0.08, 0.7) # rod: wingtip


func _fire_rod() -> void:
	if GameState.rods <= 0:
		return
	# Cadeia: até 3 alvos mais próximos dentro de 760 m (rod-missiles.js)
	var candidates: Array[Target] = []
	for e in GameState.targets:
		if not e.dead and jet.global_position.distance_to(e.global_position) < GameConfig.ROD_CHAIN_RANGE:
			candidates.append(e)
	candidates.sort_custom(func(a, b):
		return jet.global_position.distance_squared_to(a.global_position) \
			< jet.global_position.distance_squared_to(b.global_position))
	if candidates.is_empty():
		return
	var first := candidates[0]
	var rod := Projectile.missile(Projectile.Kind.ROD, jet.to_global(_spawn_offset(Projectile.Kind.ROD)),
		-jet.basis.z * GameConfig.ROD_EXIT_SPD + jet.velocity_hint(), first)
	rod.will_hit = true # rod não tem hit-roll — sempre acerta a cadeia
	for i in range(1, mini(candidates.size(), GameConfig.ROD_CHAIN_MAX)):
		rod.chain.append(candidates[i])
	rod.setup(_surface, _fx)
	add_child(rod)
	GameState.rods -= 1


func _exit_speed(p_kind: Projectile.Kind) -> float:
	match p_kind:
		Projectile.Kind.LIGHT:
			return GameConfig.MSL_LIGHT_EXIT_SPD
		Projectile.Kind.HEAVY:
			return GameConfig.MSL_HEAVY_EXIT_SPD
		Projectile.Kind.NUKE:
			return GameConfig.NUKE_EXIT_SPD
	return 80.0


func is_locked() -> bool:
	return _locked


func locked_target() -> Target:
	return _lock_target if _locked else null

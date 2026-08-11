class_name Wingman
extends Node3D
## Wingman — jato aliado (port de wingmen.js): voa em formação com o jogador,
## dispara mísseis contra a frente inimiga, estaciona ao lado no solo.
## Visual: F-35 azul. HP 3 (balas inimigas derrubam — queda com wobble).

signal downed(wingman: Wingman)

var hp := 3
var dead := false

var _jet: Jet
var _offset := Vector3.ZERO
var _surface: Callable
var _fx: FxManager
var _fire_t := 0.0
var _rng := RandomNumberGenerator.new()


func setup(jet: Jet, offset: Vector3, surface_fn: Callable, fx: FxManager) -> void:
	_jet = jet
	_offset = offset
	_surface = surface_fn
	_fx = fx
	_rng.seed = int(offset.x * 100) + 999
	var mesh := JetMesh.build()
	for mi in mesh.find_children("*", "MeshInstance3D"):
		var mat: StandardMaterial3D = mi.material_override.duplicate()
		mat.albedo_color = Color(0.25, 0.45, 0.75) # azul aliado
		mi.material_override = mat
	add_child(mesh)
	position = jet.position + offset
	jet.respawned.connect(_on_jet_respawn)


func _physics_process(delta: float) -> void:
	if dead or _jet == null or not GameState.running or GameState.paused:
		return
	var dt := minf(delta, 0.1)
	if _jet.state == Jet.State.AIRBORNE:
		# Formação: posição de referência atrás do jogador, com lag suave
		var target_pos: Vector3 = _jet.to_global(_offset)
		position = position.lerp(target_pos, minf(1.0, 2.2 * dt))
		# Clearance de terreno
		var min_y: float = _surface.call(position.x, position.z) + 12.0
		position.y = maxf(position.y, min_y)
		# Orientação segue o jogador com suavização
		quaternion = quaternion.slerp(_jet.quaternion, minf(1.0, 3.0 * dt))
		_update_fire(dt)
	else:
		# No solo: estaciona ao lado do jogador
		var park: Vector3 = _jet.position + Vector3(_offset.x * 0.6, 0, 8.0 * sign(_offset.x))
		position = position.lerp(park, minf(1.0, 2.0 * dt))
		position.y = _surface.call(position.x, position.z) + 0.9
		rotation = Vector3.ZERO


func _update_fire(dt: float) -> void:
	_fire_t -= dt
	if _fire_t > 0.0:
		return
	_fire_t = _rng.randf_range(2.6, 4.2)
	# Alvo: formação inimiga mais próxima em 1.200 m
	var best: Target = null
	var best_d := 1200.0
	for t in GameState.targets:
		if t.dead or not t.is_unit:
			continue
		var d: float = global_position.distance_to(t.global_position)
		if d < best_d:
			best_d = d
			best = t
	if best == null:
		return
	var m := Projectile.missile(Projectile.Kind.LIGHT, global_position + Vector3(0, -0.5, -3),
		(best.global_position - global_position).normalized() * 120.0, best)
	m.will_hit = true # aliados sempre acertam (a guerra paralela do web é visual)
	m.setup(_surface, _fx)
	get_parent().add_child(m)
	AudioManager.play("missile", -14.0, 0.7)


func hit(damage: int = 1) -> void:
	if dead:
		return
	hp -= damage
	if hp <= 0:
		dead = true
		downed.emit(self)
		if _fx:
			_fx.explosion(global_position, 2.0)
		queue_free()


func _on_jet_respawn() -> void:
	if not dead:
		position = _jet.position + _offset

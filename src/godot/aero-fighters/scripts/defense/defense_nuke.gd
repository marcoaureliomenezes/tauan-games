class_name DefenseNuke
extends Node3D
## DefenseNuke — nuke tática da bateria (port de weapons-v1.js T-W-05):
## arco balístico de 1,4 s → glide guiado sobre o ponto de mira (cruzeiro
## +130 m, mergulho terminal a 260 m) → NuclearFx + wipe de caças em 150 m.

var velocity := Vector3.ZERO
var life := GameConfig.AAD_NUKE_LIFE
var _t := 0.0
var _trail_t := 0.0
var _aim := Vector3.ZERO
var _surface: Callable
var _fx: FxManager
var _director: Node


static func create(pos: Vector3, dir: Vector3, aim: Vector3, surface_fn: Callable,
		fx: FxManager, director: Node) -> DefenseNuke:
	var n := DefenseNuke.new()
	n.position = pos
	n._aim = aim
	n._surface = surface_fn
	n._fx = fx
	n._director = director
	n.velocity = (dir + Vector3(0, GameConfig.AAD_NUKE_ARC_LIFT, 0)).normalized() \
		* GameConfig.AAD_NUKE_SPD
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.35
	mesh.bottom_radius = 0.35
	mesh.height = 3.2
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.rotation_degrees.x = 90
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.16, 0.23, 0.16)
	mi.material_override = mat
	n.add_child(mi)
	return n


func _physics_process(delta: float) -> void:
	var dt := minf(delta, 0.1)
	_t += dt
	life -= dt
	if life <= 0.0:
		_detonate()
		return
	var flat := Vector2(_aim.x - position.x, _aim.z - position.z).length()
	if _t < GameConfig.AAD_NUKE_ARC_S:
		velocity.y -= GameConfig.AAD_NUKE_GRAVITY * dt
	else:
		# Glide: cruzeiro alto sobre a mira; mergulho terminal a 260 m
		var goal := _aim
		if flat > GameConfig.AAD_NUKE_TERMINAL:
			goal = _aim + Vector3(0, GameConfig.AAD_NUKE_CRUISE_ALT, 0)
		var desired := (goal - position).normalized() * GameConfig.AAD_NUKE_SPD
		velocity = velocity.move_toward(desired, GameConfig.AAD_NUKE_LAT_ACCEL * dt)
	position += velocity * dt
	# Esteira de fumaça da nuke (Wave G — legível da bateria) + chama na cabeça (L2)
	_trail_t -= dt
	if _trail_t <= 0.0:
		_trail_t = 0.06
		if _fx:
			_fx.trail_puff(global_position)
			_fx.muzzle_flash(global_position, 0.7)
	if velocity.length_squared() > 0.01:
		look_at(global_position + velocity.normalized(), Vector3.UP)
	var ground: float = _surface.call(position.x, position.z) if _surface.is_valid() else 0.0
	if position.y <= ground + 2.0 or (flat < 20.0 and position.y <= _aim.y + 12.0):
		_detonate()


func _detonate() -> void:
	NuclearFx.detonate(get_parent(), global_position, _surface)
	# Wipe de caças num raio de 150 m (web NUKE_RADIUS da defesa)
	if _director != null:
		for f in _director.fighters:
			if not is_instance_valid(f) or f.dead:
				continue
			if global_position.distance_to(f.global_position) < GameConfig.AAD_NUKE_RADIUS:
				f.damage(999)
		# Wipe da horda no mesmo raio (web onNukeImpact)
		if _director.has_method("horde") and _director.horde() != null:
			_director.horde().kill_within(global_position, GameConfig.AAD_NUKE_RADIUS)
	queue_free()

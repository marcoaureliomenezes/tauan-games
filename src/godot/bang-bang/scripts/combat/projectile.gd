# projectile.gd — projétil VISÍVEL e rápido (SPEC do operador: ver o tiro e a
# trajetória). Voa a ~250 m/s com tracer brilhante; no impacto aplica dano,
# sangue e knockback. Espingarda: pelotes com queda de dano por distância.
extends Node3D

const SPEED := 250.0
const MAX_RANGE := 300.0

var dir := Vector3.ZERO
var damage := 1.0
var shooter: Node3D = null
var falloff_start := -1.0   # <0 = sem queda
var falloff_end := 0.0
var _traveled := 0.0


func setup(origin: Vector3, direction: Vector3, dmg: float, p_shooter: Node3D,
		p_falloff_start := -1.0, p_falloff_end := 0.0) -> void:
	global_position = origin
	dir = direction.normalized()
	damage = dmg
	shooter = p_shooter
	falloff_start = p_falloff_start
	falloff_end = p_falloff_end
	# tracer: bastão alongado brilhante na direção do voo
	var t := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.05, 0.05, 0.85)
	t.mesh = bm
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(1.0, 0.9, 0.55)
	m.emission_enabled = true
	m.emission = Color(1.0, 0.8, 0.4)
	m.emission_energy_multiplier = 3.0
	t.material_override = m
	add_child(t)
	look_at(origin + dir, Vector3.UP if absf(dir.y) < 0.99 else Vector3.RIGHT)

func _physics_process(dt: float) -> void:
	var step: float = SPEED * dt
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(global_position, global_position + dir * step, 1, [shooter] if shooter else [])
	var hit := space.intersect_ray(q)
	if not hit.is_empty():
		var impact: Vector3 = hit["position"]
		_traveled += global_position.distance_to(impact)
		var dmg := damage
		if falloff_start >= 0.0 and _traveled > falloff_start:
			dmg = maxf(0.1, damage * (1.0 - (_traveled - falloff_start) / maxf(1.0, falloff_end - falloff_start)))
		var target = hit["collider"]
		if target and target.has_method("apply_damage"):
			target.apply_damage(dmg, impact, dir)
			spawn_blood(get_parent(), impact, dir)
		else:
			# impacto em terreno/madeira/rocha: nuvem de poeira (não sangue)
			spawn_puff(get_parent(), impact, dir)
		queue_free()
		return
	global_position += dir * step
	_traveled += step
	if _traveled > MAX_RANGE:
		queue_free()

# poeira: burst terroso one-shot no ponto de impacto (alvos não-vivos)
static func spawn_puff(parent: Node, pos: Vector3, pdir: Vector3) -> void:
	var bp := GPUParticles3D.new()
	bp.amount = 10
	bp.lifetime = 0.5
	bp.one_shot = true
	bp.explosiveness = 0.95
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	pm.emission_shape_scale = Vector3(0.06, 0.06, 0.06)
	pm.direction = -pdir * 0.4 + Vector3(0, 0.8, 0)
	pm.spread = 60.0
	pm.initial_velocity_min = 1.0
	pm.initial_velocity_max = 2.6
	pm.gravity = Vector3(0, -3.0, 0)
	pm.scale_min = 0.10
	pm.scale_max = 0.30
	pm.color = Color(0.62, 0.53, 0.4, 0.7)
	bp.process_material = pm
	parent.add_child(bp)
	bp.global_position = pos
	bp.emitting = true
	var tw := bp.create_tween()
	tw.tween_interval(1.0)
	tw.tween_callback(bp.queue_free)

# sangue: burst vermelho one-shot no ponto de impacto
static func spawn_blood(parent: Node, pos: Vector3, pdir: Vector3) -> void:
	var bp := GPUParticles3D.new()
	bp.amount = 14
	bp.lifetime = 0.55
	bp.one_shot = true
	bp.explosiveness = 0.9
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	pm.emission_shape_scale = Vector3(0.08, 0.08, 0.08)
	pm.direction = pdir * 0.6 + Vector3(0, 0.7, 0)
	pm.spread = 45.0
	pm.initial_velocity_min = 1.5
	pm.initial_velocity_max = 4.0
	pm.gravity = Vector3(0, -9.0, 0)
	pm.scale_min = 0.06
	pm.scale_max = 0.16
	pm.color = Color(0.55, 0.04, 0.03, 0.9)
	bp.process_material = pm
	parent.add_child(bp)
	bp.global_position = pos
	bp.emitting = true
	# auto-remove
	var tw := bp.create_tween()
	tw.tween_interval(1.2)
	tw.tween_callback(bp.queue_free)

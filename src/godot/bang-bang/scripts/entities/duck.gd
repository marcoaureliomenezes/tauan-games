# duck.gd — pato do lago (dinâmica de caça): bando voando em círculo sobre o
# lago; 1 tiro derruba; abatido em voo CAI em balística até o solo.
extends "res://scripts/entities/entity.gd"

const FLY_SPEED := 9.0
const FALL_GRAV := 12.0

var center := Vector3.ZERO     # centro do lago (world)
var radius := 40.0
var ang := 0.0
var ang_speed := 0.0
var fly_h := 14.0
var _vy := 0.0
var _kx := 0.0
var _kz := 0.0
var _spin := 0.0

func _init() -> void:
	kind = &"duck"
	hp = 1.0   # 1 tiro abate
	collision_layer = 1
	collision_mask = 0
	var shape := CollisionShape3D.new()
	var sph := SphereShape3D.new()
	sph.radius = 0.45
	shape.shape = sph
	add_child(shape)

func setup_flock(p_center: Vector3, p_radius: float, p_ang: float, p_speed: float, p_h: float) -> void:
	center = p_center
	radius = p_radius
	ang = p_ang
	ang_speed = p_speed
	fly_h = p_h
	state = &"flying"

func _on_killed() -> void:
	# abatido em voo: QUEDA balística + empurrão na direção do tiro
	state = &"falling"
	_vy = 0.0
	_kx = _fling.x * 4.0
	_kz = _fling.z * 4.0
	_spin = randf_range(3.0, 7.0) * (1.0 if randf() > 0.5 else -1.0)

func _physics_process(dt: float) -> void:
	match state:
		&"flying":
			ang += ang_speed * dt
			var p := center + Vector3(cos(ang) * radius, 0, sin(ang) * radius)
			p.y = center.y + fly_h + sin(ang * 5.0) * 1.5
			# orienta na tangente do círculo
			var dir := Vector3(-sin(ang), 0, cos(ang)) * signf(ang_speed)
			rotation.y = atan2(-dir.x, -dir.z)
			global_position = p
		&"falling":
			_vy -= FALL_GRAV * dt
			global_position += Vector3(_kx, _vy, _kz) * dt
			rotation.z += _spin * dt
			if terrain and terrain.has_method("height_at"):
				var gy: float = terrain.height_at(global_position.x, global_position.z)
				if global_position.y <= gy + 0.2:
					global_position.y = gy + 0.2
					state = &"dead"
					rotation.z = PI / 2   # caído de lado no chão
					died.emit(self)
					print("DUCK_DOWN ", global_position)

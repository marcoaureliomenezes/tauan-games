## missile.gd — Homing missile. RigidBody3D that tracks nearest target.
extends RigidBody3D

const DAMAGE_LIGHT: int = 4
const DAMAGE_HEAVY: int = 20
const CLOSE_RANGE: float = 40.0

var _targets: Array[Node3D] = []
var _missile_type: String = "light"
var _lifetime: float = 0.0
var _speed: float = 80.0
var _tracking_speed: float = 130.0
var _turn_rate: float = 0.30
var _close_turn_rate: float = 0.55
var _max_life: float = 6.0
var _locked_target: Node3D = null
var _damage: int = 4

func init(direction: Vector3, targets: Array[Node3D], missile_type: String) -> void:
	_missile_type = missile_type
	_targets = targets
	gravity_scale = 0.0
	linear_velocity = direction.normalized() * _get_init_speed()
	_configure_for_type(missile_type)

func _configure_for_type(t: String) -> void:
	match t:
		"light":
			_speed = 80.0
			_tracking_speed = 130.0
			_turn_rate = 0.30
			_close_turn_rate = 0.55
			_max_life = 6.0
			_damage = 4
		"heavy":
			_speed = 65.0
			_tracking_speed = 100.0
			_turn_rate = 0.22
			_close_turn_rate = 0.45
			_max_life = 8.0
			_damage = 20

func _get_init_speed() -> float:
	match _missile_type:
		"light":  return 80.0
		"heavy":  return 65.0
		_:        return 80.0

func _ready() -> void:
	_build_mesh()
	_build_collision()
	collision_layer = 2
	collision_mask = 4
	connect("body_entered", _on_body_entered)

func _physics_process(delta: float) -> void:
	_lifetime += delta
	if _lifetime >= _max_life:
		queue_free()
		return

	# Find or keep locked target
	if not is_instance_valid(_locked_target):
		_locked_target = _find_nearest_target()
	if not is_instance_valid(_locked_target):
		# Fly straight
		linear_velocity = linear_velocity.normalized() * _tracking_speed
		return

	# Homing logic
	var to_target: Vector3 = (_locked_target.global_position - global_position).normalized()
	var dist: float = global_position.distance_to(_locked_target.global_position)
	var turn: float = _close_turn_rate if dist < CLOSE_RANGE else _turn_rate
	var current_dir: Vector3 = linear_velocity.normalized()
	var new_dir: Vector3 = current_dir.lerp(to_target, turn).normalized()
	linear_velocity = new_dir * _tracking_speed

func _find_nearest_target() -> Node3D:
	var nearest: Node3D = null
	var nearest_dist: float = 1200.0  # search range
	for t in _targets:
		if not is_instance_valid(t):
			continue
		var d: float = global_position.distance_to(t.global_position)
		if d < nearest_dist:
			nearest_dist = d
			nearest = t
	return nearest

func get_damage() -> int:
	return _damage

func _on_body_entered(body: Node3D) -> void:
	queue_free()

func _build_mesh() -> void:
	var mi = MeshInstance3D.new()
	var mesh = CylinderMesh.new()
	mesh.top_radius = 0.08
	mesh.bottom_radius = 0.12
	mesh.height = 1.2
	mi.mesh = mesh
	mi.rotation_degrees.x = 90.0
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.533, 0.533, 0.627)
	mi.material_override = mat
	add_child(mi)

func _build_collision() -> void:
	var shape = CollisionShape3D.new()
	var cap = CapsuleShape3D.new()
	cap.radius = 0.15
	cap.height = 1.2
	shape.shape = cap
	shape.rotation_degrees.x = 90.0
	add_child(shape)

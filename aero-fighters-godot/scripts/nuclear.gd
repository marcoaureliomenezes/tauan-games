## nuclear.gd — Nuclear missile. Massive AoE blast radius 180m.
extends RigidBody3D

const BLAST_RADIUS: float = 180.0
const PLAYER_KILL_RADIUS: float = 80.0
const PLAYER_DAMAGE_RADIUS: float = 200.0
const DAMAGE: int = 4000
const INIT_SPD: float = 60.0
const TRACKING_SPD: float = 85.0
const TURN_RATE: float = 0.18
const CLOSE_TURN_RATE: float = 0.38
const CLOSE_RANGE: float = 40.0
const MAX_LIFE: float = 12.0

var _targets: Array[Node3D] = []
var _lifetime: float = 0.0
var _locked_target: Node3D = null

func init(direction: Vector3, targets: Array[Node3D], _missile_type: String) -> void:
	_targets = targets
	gravity_scale = 0.0
	linear_velocity = direction.normalized() * INIT_SPD

func _ready() -> void:
	_build_mesh()
	_build_collision()
	collision_layer = 2
	collision_mask = 4
	connect("body_entered", _on_body_entered)

func _physics_process(delta: float) -> void:
	_lifetime += delta
	if _lifetime >= MAX_LIFE:
		_detonate()
		return

	# Homing
	if not is_instance_valid(_locked_target):
		_locked_target = _find_nearest_target()
	if not is_instance_valid(_locked_target):
		linear_velocity = linear_velocity.normalized() * TRACKING_SPD
		return

	var to_target: Vector3 = (_locked_target.global_position - global_position).normalized()
	var dist: float = global_position.distance_to(_locked_target.global_position)
	var turn: float = CLOSE_TURN_RATE if dist < CLOSE_RANGE else TURN_RATE
	var new_dir: Vector3 = linear_velocity.normalized().lerp(to_target, turn).normalized()
	linear_velocity = new_dir * TRACKING_SPD

func _find_nearest_target() -> Node3D:
	var nearest: Node3D = null
	var nearest_dist: float = 1500.0
	for t in _targets:
		if not is_instance_valid(t):
			continue
		var d: float = global_position.distance_to(t.global_position)
		if d < nearest_dist:
			nearest_dist = d
			nearest = t
	return nearest

func get_damage() -> int:
	return DAMAGE

func _on_body_entered(_body: Node3D) -> void:
	_detonate()

func _detonate() -> void:
	# Kill all targets within blast radius
	for t in _targets:
		if not is_instance_valid(t):
			continue
		var dist: float = global_position.distance_to(t.global_position)
		if dist <= BLAST_RADIUS and t.has_method("_destroy"):
			t._destroy()

	# Check player damage
	var player_pos: Vector3 = MissionManager.get_player_position()
	var player_dist: float = global_position.distance_to(player_pos)
	if player_dist <= PLAYER_KILL_RADIUS:
		# Instant kill
		var player = MissionManager.player_node
		if player and player.has_method("apply_hit"):
			player.apply_hit()
			player.apply_hit()
			player.apply_hit()
	elif player_dist <= PLAYER_DAMAGE_RADIUS:
		var player = MissionManager.player_node
		if player and player.has_method("apply_hit"):
			player.apply_hit()

	queue_free()

func _build_mesh() -> void:
	var mi = MeshInstance3D.new()
	var mesh = CylinderMesh.new()
	mesh.top_radius = 0.14
	mesh.bottom_radius = 0.14
	mesh.height = 1.8
	mi.mesh = mesh
	mi.rotation_degrees.x = 90.0
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.102, 0.227, 0.071)
	mat.emission_enabled = true
	mat.emission = Color(0.3, 0.8, 0.1) * 0.3
	mi.material_override = mat
	add_child(mi)

func _build_collision() -> void:
	var shape = CollisionShape3D.new()
	var cap = CapsuleShape3D.new()
	cap.radius = 0.2
	cap.height = 1.8
	shape.shape = cap
	shape.rotation_degrees.x = 90.0
	add_child(shape)

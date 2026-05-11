## target_convoy.gd — Moving convoy of 5 military trucks.
extends Node3D

signal target_destroyed

const HP: int = 12
const MOVE_SPEED: float = 8.0
const PATROL_RANGE: float = 120.0

var current_hp: int = HP
var start_pos: Vector3
var move_dir: float = 1.0

func _ready() -> void:
	_build_mesh()
	_build_hit_area()
	start_pos = global_position

func set_mission_cycle(cycle: int) -> void:
	current_hp = HP + (cycle - 1) * 3

func _physics_process(delta: float) -> void:
	if not GameState.running or GameState.paused:
		return
	# Patrol back and forth along Z axis
	global_position.z += MOVE_SPEED * move_dir * delta
	if abs(global_position.z - start_pos.z) > PATROL_RANGE:
		move_dir *= -1.0

func _build_hit_area() -> void:
	var area = Area3D.new()
	area.name = "HitArea"
	var ashape = CollisionShape3D.new()
	var abox = BoxShape3D.new()
	abox.size = Vector3(40.0, 4.0, 5.0)
	ashape.shape = abox
	ashape.position = Vector3(0.0, 2.0, 0.0)
	area.add_child(ashape)
	area.collision_layer = 4
	area.collision_mask = 2
	area.connect("body_entered", _on_hit)
	add_child(area)

func _on_hit(body: Node3D) -> void:
	if not body.has_method("get_damage"):
		return
	current_hp -= body.get_damage()
	body.queue_free()
	if current_hp <= 0:
		_destroy()

func _destroy() -> void:
	target_destroyed.emit()
	queue_free()

func _build_mesh() -> void:
	var cab_mat = StandardMaterial3D.new()
	cab_mat.albedo_color = Color(0.29, 0.314, 0.251)
	var cargo_mat = StandardMaterial3D.new()
	cargo_mat.albedo_color = Color(0.22, 0.25, 0.18)

	# 5 trucks evenly spaced
	for i in range(5):
		var offset_x: float = float(i - 2) * 8.0
		# Cab
		_add_box(Vector3(offset_x - 1.5, 1.5, 0.0), Vector3(2.5, 2.0, 2.0), cab_mat)
		# Cargo bed
		_add_box(Vector3(offset_x + 1.0, 1.0, 0.0), Vector3(3.5, 1.5, 2.0), cargo_mat)
		# Wheels (simplified as flat boxes)
		_add_box(Vector3(offset_x - 1.5, 0.3, 1.0), Vector3(0.6, 0.6, 0.3), cab_mat)
		_add_box(Vector3(offset_x - 1.5, 0.3, -1.0), Vector3(0.6, 0.6, 0.3), cab_mat)

func _add_box(pos: Vector3, size: Vector3, mat: Material) -> void:
	var mi = MeshInstance3D.new()
	var mesh = BoxMesh.new()
	mesh.size = size
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	add_child(mi)

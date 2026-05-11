## target_building.gd — Multi-story building target.
extends StaticBody3D

signal target_destroyed

const HP: int = 14

var current_hp: int = HP

func _ready() -> void:
	_build_mesh()
	_build_collision()
	_build_hit_area()

func set_mission_cycle(cycle: int) -> void:
	current_hp = HP + (cycle - 1) * 3

func _build_collision() -> void:
	var shape = CollisionShape3D.new()
	var box = BoxShape3D.new()
	box.size = Vector3(8.0, 14.0, 8.0)
	shape.shape = box
	shape.position = Vector3(0.0, 7.0, 0.0)
	add_child(shape)

func _build_hit_area() -> void:
	var area = Area3D.new()
	area.name = "HitArea"
	var ashape = CollisionShape3D.new()
	var abox = BoxShape3D.new()
	abox.size = Vector3(10.0, 16.0, 10.0)
	ashape.shape = abox
	ashape.position = Vector3(0.0, 8.0, 0.0)
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
	var wall_mat = StandardMaterial3D.new()
	wall_mat.albedo_color = Color(0.333, 0.282, 0.251)
	var win_mat = StandardMaterial3D.new()
	win_mat.albedo_color = Color(1.0, 0.8, 0.4)
	win_mat.emission_enabled = true
	win_mat.emission = Color(1.0, 0.8, 0.4) * 0.5
	var dark_mat = StandardMaterial3D.new()
	dark_mat.albedo_color = Color(0.165, 0.165, 0.165)

	# Tower
	_add_box(Vector3(0.0, 4.5, 0.0), Vector3(4.0, 9.0, 4.0), wall_mat)
	# Windows (4 floors, 3 columns)
	for floor_i in range(4):
		for col_i in range(-1, 2):
			_add_box(
				Vector3(float(col_i) * 1.0, 2.0 + float(floor_i) * 2.0, -2.05),
				Vector3(0.5, 0.6, 0.05),
				win_mat
			)
	# Roof
	_add_box(Vector3(0.0, 9.2, 0.0), Vector3(4.4, 0.4, 4.4), dark_mat)
	# Antenna
	_add_box(Vector3(0.0, 11.2, 0.0), Vector3(0.1, 3.5, 0.1), dark_mat)
	# Lower extension
	_add_box(Vector3(-3.0, 1.0, -2.0), Vector3(3.0, 2.0, 3.0), wall_mat)

func _add_box(pos: Vector3, size: Vector3, mat: Material) -> void:
	var mi = MeshInstance3D.new()
	var mesh = BoxMesh.new()
	mesh.size = size
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	add_child(mi)

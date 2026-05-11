## target_factory.gd — Factory target with 3 smokestacks.
extends StaticBody3D

signal target_destroyed

const HP: int = 20

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
	box.size = Vector3(12.0, 9.0, 12.0)
	shape.shape = box
	shape.position = Vector3(0.0, 4.0, 0.0)
	add_child(shape)

func _build_hit_area() -> void:
	var area = Area3D.new()
	area.name = "HitArea"
	var ashape = CollisionShape3D.new()
	var abox = BoxShape3D.new()
	abox.size = Vector3(14.0, 11.0, 14.0)
	ashape.shape = abox
	ashape.position = Vector3(0.0, 5.5, 0.0)
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
	wall_mat.albedo_color = Color(0.4, 0.353, 0.29)
	var roof_mat = StandardMaterial3D.new()
	roof_mat.albedo_color = Color(0.227, 0.208, 0.188)
	var metal_mat = StandardMaterial3D.new()
	metal_mat.albedo_color = Color(0.165, 0.165, 0.165)

	# Main warehouse
	_add_box(Vector3(0.0, 2.0, 0.0), Vector3(6.0, 4.0, 10.0), wall_mat)
	_add_box(Vector3(0.0, 4.2, 0.0), Vector3(6.4, 0.4, 10.4), roof_mat)
	# Smokestacks
	for i in range(-1, 2):
		_add_box(Vector3(float(i) * 1.5, 6.0, -3.0), Vector3(1.0, 4.0, 1.0), metal_mat)
	# Annex building
	_add_box(Vector3(-4.5, 1.25, 3.0), Vector3(3.0, 2.5, 4.0), wall_mat)
	_add_box(Vector3(-4.5, 2.65, 3.0), Vector3(3.3, 0.3, 4.3), roof_mat)

func _add_box(pos: Vector3, size: Vector3, mat: Material) -> void:
	var mi = MeshInstance3D.new()
	var mesh = BoxMesh.new()
	mesh.size = size
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	add_child(mi)

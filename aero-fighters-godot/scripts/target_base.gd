## target_base.gd — Military base target. StaticBody3D with Area3D for hit detection.
extends StaticBody3D

signal target_destroyed

const HP: int = 28

var current_hp: int = HP
var mission_cycle: int = 1

func _ready() -> void:
	_build_mesh()
	_build_collision()
	_build_hit_area()

func set_mission_cycle(cycle: int) -> void:
	mission_cycle = cycle
	# Bonus HP per cycle
	current_hp = HP + (cycle - 1) * 3

func _build_collision() -> void:
	var shape = CollisionShape3D.new()
	var box = BoxShape3D.new()
	box.size = Vector3(16.0, 6.0, 12.0)
	shape.shape = box
	shape.position = Vector3(0.0, 3.0, 0.0)
	add_child(shape)

func _build_hit_area() -> void:
	var area = Area3D.new()
	area.name = "HitArea"
	var ashape = CollisionShape3D.new()
	var abox = BoxShape3D.new()
	abox.size = Vector3(18.0, 8.0, 14.0)
	ashape.shape = abox
	ashape.position = Vector3(0.0, 4.0, 0.0)
	area.add_child(ashape)
	area.collision_layer = 4   # layer 3 = targets
	area.collision_mask = 2    # mask 2 = projectiles
	area.connect("body_entered", _on_hit)
	add_child(area)

func _on_hit(body: Node3D) -> void:
	if not body.has_method("get_damage"):
		return
	var dmg: int = body.get_damage()
	current_hp -= dmg
	body.queue_free()
	if current_hp <= 0:
		_destroy()

func _destroy() -> void:
	target_destroyed.emit()
	queue_free()

func _build_mesh() -> void:
	var wall_mat = StandardMaterial3D.new()
	wall_mat.albedo_color = Color(0.29, 0.29, 0.23)
	var roof_mat = StandardMaterial3D.new()
	roof_mat.albedo_color = Color(0.23, 0.22, 0.165)
	var metal_mat = StandardMaterial3D.new()
	metal_mat.albedo_color = Color(0.165, 0.165, 0.188)

	# Main building
	_add_box(Vector3(0.0, 1.5, 0.0), Vector3(8.0, 3.0, 5.0), wall_mat)
	_add_box(Vector3(0.0, 3.2, 0.0), Vector3(8.4, 0.4, 5.4), roof_mat)
	# Side wing
	_add_box(Vector3(-6.0, 1.0, -3.0), Vector3(4.0, 2.0, 4.0), wall_mat)
	_add_box(Vector3(-6.0, 2.15, -3.0), Vector3(4.3, 0.3, 4.3), roof_mat)
	# Storage
	_add_box(Vector3(5.0, 1.25, 4.0), Vector3(3.0, 2.5, 3.0), wall_mat)
	# Radar tower (cylinder via capsule approximation)
	_add_box(Vector3(0.0, 2.5, 4.0), Vector3(0.8, 5.0, 0.8), metal_mat)
	# Radar dish
	_add_box(Vector3(0.0, 5.2, 4.0), Vector3(3.2, 0.3, 3.2), metal_mat)
	# Flag pole
	_add_box(Vector3(6.0, 1.75, -4.0), Vector3(0.12, 3.5, 0.12), metal_mat)
	# Flag
	var flag_mat = StandardMaterial3D.new()
	flag_mat.albedo_color = Color(0.533, 0.0, 0.102)
	_add_box(Vector3(6.0, 3.0, -3.5), Vector3(0.05, 0.6, 1.0), flag_mat)
	# Sandbags
	for i in range(-2, 3):
		_add_box(Vector3(float(i) * 1.5, 0.2, -3.0), Vector3(0.8, 0.4, 0.6), roof_mat)

func _add_box(pos: Vector3, size: Vector3, mat: Material) -> void:
	var mi = MeshInstance3D.new()
	var mesh = BoxMesh.new()
	mesh.size = size
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	add_child(mi)

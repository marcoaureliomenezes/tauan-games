## target_aa_gun.gd — Anti-aircraft gun. Rotates to track player, fires enemy bullets.
extends StaticBody3D

signal target_destroyed

const HP: int = 6
const AA_RANGE: float = 220.0
const BASE_FIRE_INTERVAL: float = 1.7
const CYCLE_SPEEDUP: float = 0.15
const MAX_SPEEDUP: float = 0.7
const TRACK_SPEED: float = 2.0  # rad/s rotation toward player

var current_hp: int = HP
var fire_timer: float = 0.0
var fire_interval: float = BASE_FIRE_INTERVAL
var turret_node: Node3D = null

func _ready() -> void:
	_build_mesh()
	_build_collision()
	_build_hit_area()

func set_mission_cycle(cycle: int) -> void:
	current_hp = HP + (cycle - 1) * 3
	var speedup: float = minf((cycle - 1) * CYCLE_SPEEDUP, MAX_SPEEDUP)
	fire_interval = BASE_FIRE_INTERVAL - speedup

func _physics_process(delta: float) -> void:
	if not GameState.running or GameState.paused:
		return
	var player_pos: Vector3 = MissionManager.get_player_position()
	var dist: float = global_position.distance_to(player_pos)

	if dist > AA_RANGE:
		return

	# Track player with turret
	if turret_node:
		var dir_to_player: Vector3 = (player_pos - turret_node.global_position).normalized()
		var target_angle: float = atan2(dir_to_player.x, dir_to_player.z)
		var current_angle: float = turret_node.global_rotation.y
		var angle_diff: float = wrapf(target_angle - current_angle, -PI, PI)
		turret_node.global_rotation.y += sign(angle_diff) * minf(abs(angle_diff), TRACK_SPEED * delta)

	# Fire
	fire_timer -= delta
	if fire_timer <= 0.0:
		fire_timer = fire_interval
		_fire_at_player(player_pos)

func _fire_at_player(player_pos: Vector3) -> void:
	var muzzle_pos: Vector3 = global_position + Vector3(0.0, 3.5, 0.0)
	var dir: Vector3 = (player_pos - muzzle_pos).normalized()
	# Add lead prediction and inaccuracy
	dir += Vector3(randf_range(-0.08, 0.08), randf_range(-0.04, 0.04), randf_range(-0.08, 0.08))
	dir = dir.normalized()
	MissionManager.spawn_enemy_bullet(muzzle_pos, dir)

func _build_collision() -> void:
	var shape = CollisionShape3D.new()
	var box = BoxShape3D.new()
	box.size = Vector3(4.0, 4.0, 4.0)
	shape.shape = box
	shape.position = Vector3(0.0, 2.0, 0.0)
	add_child(shape)

func _build_hit_area() -> void:
	var area = Area3D.new()
	area.name = "HitArea"
	var ashape = CollisionShape3D.new()
	var abox = BoxShape3D.new()
	abox.size = Vector3(6.0, 6.0, 6.0)
	ashape.shape = abox
	ashape.position = Vector3(0.0, 3.0, 0.0)
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
	var metal_mat = StandardMaterial3D.new()
	metal_mat.albedo_color = Color(0.22, 0.22, 0.22)
	var dark_mat = StandardMaterial3D.new()
	dark_mat.albedo_color = Color(0.15, 0.15, 0.15)

	# Base platform
	_add_box(Vector3(0.0, 0.3, 0.0), Vector3(3.0, 0.6, 3.0), metal_mat)

	# Turret body (rotates)
	turret_node = Node3D.new()
	turret_node.name = "Turret"
	add_child(turret_node)
	turret_node.position = Vector3(0.0, 1.0, 0.0)

	var barrel_base = MeshInstance3D.new()
	var bb_mesh = BoxMesh.new()
	bb_mesh.size = Vector3(1.5, 1.5, 1.5)
	barrel_base.mesh = bb_mesh
	barrel_base.material_override = metal_mat
	barrel_base.position = Vector3(0.0, 0.5, 0.0)
	turret_node.add_child(barrel_base)

	# Twin barrels
	for sx in [-0.35, 0.35]:
		var barrel = MeshInstance3D.new()
		var b_mesh = BoxMesh.new()
		b_mesh.size = Vector3(0.2, 0.2, 2.5)
		barrel.mesh = b_mesh
		barrel.material_override = dark_mat
		barrel.position = Vector3(sx, 0.5, -1.5)
		turret_node.add_child(barrel)

func _add_box(pos: Vector3, size: Vector3, mat: Material) -> void:
	var mi = MeshInstance3D.new()
	var mesh = BoxMesh.new()
	mesh.size = size
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	add_child(mi)

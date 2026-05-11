## mission_manager.gd — Autoload singleton for mission flow and terrain queries.
## Tracks active targets, spawning, and mission progression.
extends Node

# --- References (set by Main.tscn after ready) ---
var player_node: Node3D = null
var targets_root: Node3D = null
var island_data: Array = []  # filled by island_generator after generation

# --- Preloaded scenes ---
const BASE_SCENE = preload("res://scenes/targets/Base.tscn")
const FACTORY_SCENE = preload("res://scenes/targets/Factory.tscn")
const BUILDING_SCENE = preload("res://scenes/targets/Building.tscn")
const CONVOY_SCENE = preload("res://scenes/targets/Convoy.tscn")
const AAGUN_SCENE = preload("res://scenes/targets/AAGun.tscn")
const BULLET_SCENE = preload("res://scenes/weapons/Bullet.tscn")
const MISSILE_SCENE = preload("res://scenes/weapons/Missile.tscn")
const NUCLEAR_SCENE = preload("res://scenes/weapons/Nuclear.tscn")

var active_targets: Array[Node3D] = []
var active_projectiles: Array[Node3D] = []

signal all_targets_destroyed

func _ready() -> void:
	GameState.connect("mission_started", _on_mission_started)

func _on_mission_started(mission_num: int) -> void:
	spawn_mission(mission_num)

func target_count_for_mission(m: int) -> int:
	var sizes: Array = [8, 12, 16]
	if m <= sizes.size():
		return sizes[m - 1]
	return sizes[sizes.size() - 1]

func spawn_mission(mission_num: int) -> void:
	clear_targets()
	GameState.targets_destroyed = 0

	var layout: Array = _get_layout(GameState.active_map)
	var count: int = mini(target_count_for_mission(mission_num), layout.size())

	for i in range(count):
		var entry = layout[i]
		var island_idx: int = entry[0]
		var dx: float = float(entry[1])
		var dz: float = float(entry[2])
		var type_str: String = entry[3]
		_spawn_target(island_idx, dx, dz, type_str)

	GameState.targets_total = active_targets.size()

func _get_layout(map_name: String) -> Array:
	match map_name:
		"desert":
			return Config.TARGET_LAYOUT_DESERT
		"rio":
			return Config.TARGET_LAYOUT_RIO
		_:
			return Config.TARGET_LAYOUT_ISLANDS

func _spawn_target(island_idx: int, dx: float, dz: float, type_str: String) -> void:
	var world_pos: Vector3
	if island_idx == -1:
		world_pos = Vector3(dx, 0.0, dz)
		world_pos.y = _ground_height(world_pos.x, world_pos.z) + 0.5
	else:
		var center: Vector2 = _get_island_center(island_idx)
		world_pos = Vector3(center.x + dx, 0.0, center.y + dz)
		world_pos.y = get_terrain_height(world_pos.x, world_pos.z) + 0.5

	var scene: PackedScene = _get_scene_for_type(type_str)
	if scene == null:
		return
	var instance: Node3D = scene.instantiate()
	if targets_root:
		targets_root.add_child(instance)
	else:
		get_tree().current_scene.add_child(instance)
	instance.global_position = world_pos
	if instance.has_method("set_mission_cycle"):
		instance.set_mission_cycle(GameState.cycle)
	active_targets.append(instance)
	# Connect destroyed signal
	if instance.has_signal("target_destroyed"):
		instance.connect("target_destroyed", _on_target_destroyed.bind(type_str))

func _get_scene_for_type(type_str: String) -> PackedScene:
	match type_str:
		"base":     return BASE_SCENE
		"factory":  return FACTORY_SCENE
		"building": return BUILDING_SCENE
		"convoy":   return CONVOY_SCENE
		"aaGun":    return AAGUN_SCENE
		"warship":  return BASE_SCENE  # warship reuses base mesh for now
		_:          return null

func _get_island_center(idx: int) -> Vector2:
	if idx < Config.ISLAND_DEFS.size():
		var def: Array = Config.ISLAND_DEFS[idx]
		return Vector2(def[0], def[1])
	return Vector2.ZERO

func clear_targets() -> void:
	for t in active_targets:
		if is_instance_valid(t):
			t.queue_free()
	active_targets.clear()

func clear_projectiles() -> void:
	for p in active_projectiles:
		if is_instance_valid(p):
			p.queue_free()
	active_projectiles.clear()

func _on_target_destroyed(type_str: String) -> void:
	GameState.targets_destroyed += 1
	GameState.kills += 1
	var points: int = _points_for_type(type_str)
	GameState.add_score(points)
	GameState.target_destroyed.emit(type_str, points)
	# Remove from active list
	active_targets = active_targets.filter(func(t): return is_instance_valid(t) and not t.is_queued_for_deletion())
	_check_mission_complete()

func _points_for_type(type_str: String) -> int:
	match type_str:
		"base":     return Config.TARGET_BASE_SCORE
		"factory":  return Config.TARGET_FACTORY_SCORE
		"building": return Config.TARGET_BUILDING_SCORE
		"convoy":   return Config.TARGET_CONVOY_SCORE
		"aaGun":    return Config.TARGET_AAGUN_SCORE
		"warship":  return Config.TARGET_WARSHIP_SCORE
		_:          return 100

func _check_mission_complete() -> void:
	if not GameState.running or GameState.mission_complete_shown:
		return
	if GameState.targets_total == 0:
		return
	if GameState.targets_destroyed >= GameState.targets_total:
		GameState.mission_complete_shown = true
		all_targets_destroyed.emit()
		GameState.mission_complete.emit()

## Returns terrain height at world XZ. Used by player crash detection.
func get_terrain_height(world_x: float, world_z: float) -> float:
	# Query island data filled by island_generator
	var highest: float = -999.0
	for isl in island_data:
		var cx: float = isl.center_x
		var cz: float = isl.center_z
		var radius: float = isl.radius
		var peak: float = isl.peak_height
		var dx: float = world_x - cx
		var dz: float = world_z - cz
		var dist2: float = dx * dx + dz * dz
		var r2: float = radius * radius
		if dist2 < r2:
			var norm_dist: float = sqrt(dist2) / radius
			var h: float = (1.0 - norm_dist * norm_dist * 1.35) * peak
			if h > highest:
				highest = h
	return maxf(0.0, highest)

func _ground_height(x: float, z: float) -> float:
	return get_terrain_height(x, z)

## Spawn bullet from player
func spawn_bullet(pos: Vector3, dir: Vector3) -> void:
	var b: Node3D = BULLET_SCENE.instantiate()
	get_tree().current_scene.add_child(b)
	b.global_position = pos
	if b.has_method("init"):
		b.init(dir, false)
	active_projectiles.append(b)

## Spawn missile from player
func spawn_missile(pos: Vector3, dir: Vector3, missile_type: String) -> void:
	var scene: PackedScene = MISSILE_SCENE
	if missile_type == "nuclear":
		scene = NUCLEAR_SCENE
	var m: Node3D = scene.instantiate()
	get_tree().current_scene.add_child(m)
	m.global_position = pos
	if m.has_method("init"):
		m.init(dir, active_targets, missile_type)
	active_projectiles.append(m)

## Called by AA guns to spawn enemy bullets
func spawn_enemy_bullet(pos: Vector3, dir: Vector3) -> void:
	var b: Node3D = BULLET_SCENE.instantiate()
	get_tree().current_scene.add_child(b)
	b.global_position = pos
	if b.has_method("init"):
		b.init(dir, true)
	active_projectiles.append(b)

func get_player_position() -> Vector3:
	if player_node and is_instance_valid(player_node):
		return player_node.global_position
	return Vector3.ZERO

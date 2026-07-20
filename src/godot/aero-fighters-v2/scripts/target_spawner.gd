extends Node
# target_spawner.gd — Wires target instances to MissionManager at level start.
# Attach to a Node child of Main.tscn (or to Main itself).
# On _ready(): finds all nodes in the "targets" group and registers them with
# MissionManager. Handles cycle restart on MissionManager.mission_started.
# T-G-19 (Wave 4).

# Scenes to respawn on next cycle — stored as PackedScene refs keyed by target type
var _target_scene_refs: Dictionary = {}
# Spawn positions (world-space) keyed by target type, carried over from initial placement
var _spawn_positions: Dictionary = {}
# Parent node under which new instances are added
var _targets_root: Node3D = null


func _ready() -> void:
	_targets_root = get_tree().root.find_child("Targets", true, false)
	if _targets_root == null:
		push_warning("[target_spawner] 'Targets' node not found in scene tree — skipping registration. " +
			"T-G-20 must add a Node3D named 'Targets' as a child of Main.tscn.")
		return

	_register_all_targets()

	# Listen for next-cycle signal to respawn
	if MissionManager.has_signal("mission_started"):
		MissionManager.mission_started.connect(_on_mission_started)

	print("[target_spawner] ready — registered %d targets" % MissionManager.alive_targets.size())


# ────────────────────────────────────────────────────────────────────────────────
# Registration
# ────────────────────────────────────────────────────────────────────────────────

func _register_all_targets() -> void:
	for child in _targets_root.get_children():
		if not is_instance_valid(child):
			continue
		MissionManager.register_target(child)
		# Cache scene file + position for respawn
		var scene_path: String = child.scene_file_path
		var target_type: String = _infer_target_type(child)
		if scene_path != "":
			_target_scene_refs[target_type] = scene_path
		_spawn_positions[target_type] = child.global_position


# ────────────────────────────────────────────────────────────────────────────────
# Cycle restart
# ────────────────────────────────────────────────────────────────────────────────

func _on_mission_started(cycle: int) -> void:
	print("[target_spawner] cycle %d — respawning targets" % cycle)
	MissionManager.alive_targets.clear()

	# Remove any surviving targets from previous cycle
	if _targets_root:
		for child in _targets_root.get_children():
			child.queue_free()
		# Wait one frame so freed nodes are gone before re-instantiating
		await get_tree().process_frame

	# Respawn each known target type
	for target_type in _target_scene_refs.keys():
		var scene_path: String = _target_scene_refs[target_type]
		var packed: PackedScene = load(scene_path)
		if packed == null:
			push_warning("[target_spawner] could not load scene: %s" % scene_path)
			continue
		var instance: Node3D = packed.instantiate()
		_targets_root.add_child(instance)

		# Restore spawn position
		if _spawn_positions.has(target_type):
			instance.global_position = _spawn_positions[target_type]

		# Scale HP by difficulty multiplier if target exposes set_hp
		var hp_mult: float = MissionManager.get_difficulty_multiplier_hp()
		if instance.has_method("set_hp"):
			# MissionConfig base HP * multiplier
			var base_hp: int = _get_base_hp(target_type)
			instance.set_hp(int(ceil(base_hp * hp_mult)))

		MissionManager.register_target(instance)
		print("[target_spawner] spawned %s at %s (hp_mult=%.2f)" % [
			target_type, str(instance.global_position), hp_mult
		])


# ────────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────────

func _infer_target_type(node: Node) -> String:
	var n: String = node.name.to_lower()
	if "factory" in n:
		return "factory"
	if "base" in n:
		return "base"
	if "aa" in n or "gun" in n or "cluster" in n:
		return "aa_cluster"
	return node.name


func _get_base_hp(target_type: String) -> int:
	if GameConfig == null or GameConfig.mission == null:
		match target_type:
			"factory": return 20
			"base": return 28
			_: return 6
	match target_type:
		"factory": return GameConfig.mission.factory_hp
		"base": return GameConfig.mission.base_hp
		_: return GameConfig.mission.aa_gun_hp

extends Node3D
class_name AAGun
# aa_gun.gd — Single AA gun in the cluster.
# Implements FR-V2-G-06: fires back at player, range 220 m, base interval 1.7 s.
# Attach to each of the 3 StaticBody3D sub-gun nodes inside aa_cluster.tscn.
# T-G-19 (Wave 4).

signal destroyed(target_type: String, score_value: int)

@export var range_m: float = 220.0
@export var base_interval_s: float = 1.7
@export var max_hp: int = 6

var hp: int
var current_interval: float
var _timer: float = 0.0
var _target_player: Node3D = null


func _ready() -> void:
	hp = max_hp
	current_interval = base_interval_s * MissionManager.get_difficulty_multiplier_aa_interval()
	_target_player = get_tree().get_first_node_in_group("player")
	print("[aa_gun] ready at %s — hp=%d  interval=%.2f s  range=%.0f m" % [
		name, hp, current_interval, range_m
	])


func _physics_process(delta: float) -> void:
	if _target_player == null or hp <= 0:
		return
	if not is_instance_valid(_target_player):
		_target_player = get_tree().get_first_node_in_group("player")
		return

	var dist: float = global_position.distance_to(_target_player.global_position)
	if dist > range_m:
		return

	_timer += delta
	if _timer >= current_interval:
		_timer = 0.0
		_fire_at_player()


# ────────────────────────────────────────────────────────────────────────────────
# Firing
# ────────────────────────────────────────────────────────────────────────────────

func _fire_at_player() -> void:
	var aa_proj_scene: PackedScene = preload("res://scenes/AAProjectile.tscn")
	var proj: Node = aa_proj_scene.instantiate()
	var direction: Vector3 = (_target_player.global_position - global_position).normalized()
	proj.global_position = global_position
	# AAProjectile expects a velocity set before it enters the tree;
	# set it after add_child via the launch() method.
	get_tree().current_scene.add_child(proj)
	if proj.has_method("launch"):
		proj.launch(direction)
	print("[aa_gun] fired at player from %s (dist=%.0f m)" % [name, global_position.distance_to(_target_player.global_position)])


# ────────────────────────────────────────────────────────────────────────────────
# Damage interface — called by bullet.gd on hit
# ────────────────────────────────────────────────────────────────────────────────

func take_damage(amount: int) -> bool:
	if hp <= 0:
		return false
	hp -= amount
	print("[aa_gun] %s hit — hp=%d" % [name, hp])
	if hp <= 0:
		destroyed.emit("aa_gun", MissionManager.TARGET_SCORE["aa_gun"])
		queue_free()
		return true
	return false

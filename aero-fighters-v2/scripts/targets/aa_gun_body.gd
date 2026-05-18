extends StaticBody3D
class_name AAGunBody
# aa_gun_body.gd — Hit-volume bridge for an AA gun sub-target.
#
# Why this exists: the combat agent's `scripts/aa_gun.gd` (T-G-19 lane)
# extends Node3D — it owns firing logic, range/interval timers, and the
# `take_damage()` / `destroyed` signal for an AA gun. But the player's
# bullet (Area3D with `body_entered`) hits the StaticBody3D parent, not the
# Node3D child. Godot also refuses to attach a Node3D-typed script directly
# to a StaticBody3D node.
#
# This thin bridge sits on the StaticBody3D so bullets find a `take_damage`
# method, and forwards the call to the aa_gun.gd child. It also re-emits the
# child's `destroyed` signal at the StaticBody3D level so MissionManager +
# aa_cluster.gd can observe both the body group and the firing logic.
#
# Lifecycle: when aa_gun.gd queue_free()s itself on kill, its parent (this
# StaticBody3D) is also freed so the hit-volume disappears.
#
# Per T-G-20 (Wave 4).

signal destroyed(target_type: String, score_value: int)

const AA_GUN_CHILD_NAME: String = "Gun"

var _gun: Node = null


func _ready() -> void:
	add_to_group("target")
	_gun = get_node_or_null(AA_GUN_CHILD_NAME)
	if _gun and _gun.has_signal("destroyed"):
		_gun.destroyed.connect(_on_gun_destroyed)
	# Echo a ready line that matches the contract verification expected by the
	# headless boot smoke test.
	var hp_val: int = -1
	if _gun and "hp" in _gun:
		hp_val = _gun.hp
	print("[aa_gun_body] %s ready hp=%d" % [name, hp_val])


func take_damage(amount: int) -> bool:
	if _gun == null:
		return false
	if _gun.has_method("take_damage"):
		return _gun.take_damage(amount)
	return false


func _on_gun_destroyed(target_type: String, score_value: int) -> void:
	destroyed.emit(target_type, score_value)
	# The Gun child queue_free()s itself on kill (see aa_gun.gd).
	# Free this body too so the hit volume goes away.
	queue_free()

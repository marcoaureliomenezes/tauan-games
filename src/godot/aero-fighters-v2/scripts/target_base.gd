class_name TargetBase
extends StaticBody3D
# target_base.gd — shared base class for static ground targets (factory + base).
# Implements the contract the combat agent's bullet.gd + MissionManager expect:
#   - method  take_damage(amount: int) -> bool      (returns true on kill)
#   - signal  destroyed(target_type: String, score_value: int)
#   - group   "target"                              (added via add_to_group)
#
# The AA-cluster's individual sub-guns use scripts/aa_gun.gd directly (not this
# base), because each sub-gun also fires back at the player; the cluster root
# (Node3D) is just an assembly point and is NOT a TargetBase.
#
# Per FR-V2-G-05/06/07 and T-G-20 (Wave 4).

signal destroyed(target_type: String, score_value: int)

@export var max_hp: int = 20
@export var target_type: String = "generic"
@export var score_value: int = 600

var hp: int


func _ready() -> void:
	add_to_group("target")
	# Difficulty scaling — MissionManager.get_difficulty_multiplier_hp() returns
	# pow(1.15, cycle - 1). On cycle 1 it returns 1.0 → unchanged HP.
	var hp_mult: float = 1.0
	if Engine.has_singleton("MissionManager") or _has_mission_manager_autoload():
		hp_mult = MissionManager.get_difficulty_multiplier_hp()
	hp = int(round(float(max_hp) * hp_mult))
	# Register with MissionManager so the win-condition can fire.
	if _has_mission_manager_autoload() and MissionManager.has_method("register_target"):
		MissionManager.register_target(self)
	print("[%s] ready hp=%d (base=%d × %.2f)" % [target_type, hp, max_hp, hp_mult])


func take_damage(amount: int) -> bool:
	if hp <= 0:
		return false
	hp -= amount
	_on_damaged(amount)
	if hp <= 0:
		_on_destroyed()
		return true
	return false


# ────────────────────────────────────────────────────────────────────────────────
# Override hooks (subclasses customize FX + multi-stage logic)
# ────────────────────────────────────────────────────────────────────────────────

func _on_damaged(_amount: int) -> void:
	# Override in subclasses for partial-damage FX (e.g. base.gd destroys radar
	# dish at HP ≤ 50%).
	pass


func _on_destroyed() -> void:
	destroyed.emit(target_type, score_value)
	_play_destruction_fx()
	queue_free()


func _play_destruction_fx() -> void:
	# Override in subclasses for type-specific FX. Real GPUParticles3D systems
	# are deferred to Wave 5; Wave 4 only logs the event.
	print("[%s] destroyed (score=%d)" % [target_type, score_value])


# ────────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────────

func _has_mission_manager_autoload() -> bool:
	# MissionManager is registered as Autoload in project.godot but headless boot
	# may not always have it; guard cheaply.
	return typeof(MissionManager) == TYPE_OBJECT and MissionManager != null

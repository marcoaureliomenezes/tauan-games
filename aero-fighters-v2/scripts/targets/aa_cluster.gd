extends Node3D
class_name AAGunCluster
# aa_cluster.gd — Assembly orchestrator for a 3-sub-gun AA emplacement.
# The cluster root is a Node3D (NOT a TargetBase); each sub-gun is an
# individual StaticBody3D with scripts/aa_gun.gd attached (authored under
# T-G-19 / combat lane). Each sub-gun is a separate target from the
# MissionManager's perspective — when ALL 3 are destroyed, the cluster is
# considered fully destroyed.
#
# Per FR-V2-G-06/07 and T-G-20 (Wave 4).
#
# This orchestrator's only job is:
#   1. Add itself to group "target_cluster" for easy discovery.
#   2. Track when all 3 sub-guns have emitted their `destroyed` signals.
#   3. Emit a single `cluster_destroyed` signal for HUD/Telemetry consumers.

signal cluster_destroyed
# `destroyed` matches the contract MissionManager.register_target() listens for.
# Emitted ONCE — when the last sub-gun goes down — with score = sum of all 3 guns.
signal destroyed(target_type: String, score_value: int)

@export var target_type: String = "aa_cluster"

var _alive_guns: int = 0
var _accrued_score: int = 0


func _ready() -> void:
	add_to_group("target_cluster")
	add_to_group("target")  # satisfies T-G-20 brief: cluster root in "target" group
	# Hook the destroyed signal from each direct child that has the aa_gun.gd
	# script attached (group membership via the script's own _ready).
	for child in get_children():
		if child is StaticBody3D and child.has_signal("destroyed"):
			child.destroyed.connect(_on_subgun_destroyed)
			_alive_guns += 1
	print("[aa_cluster] ready — %d sub-guns wired" % _alive_guns)


func _on_subgun_destroyed(subgun_type: String, score_value: int) -> void:
	_alive_guns -= 1
	_accrued_score += score_value
	print("[aa_cluster] sub-gun destroyed (%s +%d) — %d remaining" % [
		subgun_type, score_value, _alive_guns
	])
	if _alive_guns <= 0:
		cluster_destroyed.emit()
		# Emit `destroyed` at the cluster level so MissionManager.register_target
		# (which connected to this signal at level start) credits the full
		# cluster kill. Score = sum of all 3 sub-guns (3 × 250 = 750).
		destroyed.emit(target_type, _accrued_score)
		print("[aa_cluster] all sub-guns destroyed — cluster cleared (total score=%d)" % _accrued_score)
		queue_free()


# ────────────────────────────────────────────────────────────────────────────────
# Damage interface — the cluster ROOT does NOT take direct damage; bullets pass
# through the Node3D and hit individual sub-gun StaticBody3Ds via aa_gun_body.gd.
# This method exists only to satisfy the T-G-20 contract (`take_damage` on every
# target root) and to keep MissionManager / external systems from crashing if
# they probe it generically.
# ────────────────────────────────────────────────────────────────────────────────

func take_damage(_amount: int) -> bool:
	# No-op at the cluster level — damage is applied to sub-guns directly.
	# Return false (not destroyed) so callers don't double-count.
	return false

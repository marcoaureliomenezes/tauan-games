extends Node
# MissionManager — Autoload singleton
# Implements FR-V2-G-07 / FR-V2-G-18: 1-cycle mission loop, 3-target win condition,
# +1 difficulty per cycle.
# T-G-19 (Wave 4): full state machine replacing Wave 1 stub.

signal mission_started(cycle: int)
signal mission_complete(cycle: int, total_score: int)
signal cycle_advanced(cycle: int)
signal target_destroyed(target_type: String, score_value: int)

const TARGET_SCORE: Dictionary = {
	"factory": 600,
	"base": 800,
	"aa_gun": 250
}

var cycle: int = 1
var alive_targets: Array = []
var total_score: int = 0
var hp_multiplier: float = 1.0
var aa_interval_multiplier: float = 1.0

# Difficulty coefficients — read from MissionConfig.tres on _ready
var hp_difficulty_coef: float = 1.15
var aa_interval_coef: float = 0.92


func _ready() -> void:
	if GameConfig and GameConfig.mission:
		hp_difficulty_coef = GameConfig.mission.difficulty_hp_coef
		aa_interval_coef = GameConfig.mission.difficulty_aa_interval_coef
	print("[MissionManager] ready — cycle %d (hp_coef=%.2f, aa_coef=%.2f)" % [
		cycle, hp_difficulty_coef, aa_interval_coef
	])


# ────────────────────────────────────────────────────────────────────────────────
# Target registration
# ────────────────────────────────────────────────────────────────────────────────

func register_target(target: Node) -> void:
	if not alive_targets.has(target):
		alive_targets.append(target)
		if target.has_signal("destroyed"):
			target.destroyed.connect(_on_target_destroyed)
		print("[MissionManager] registered target: %s (total=%d)" % [
			target.name, alive_targets.size()
		])


# ────────────────────────────────────────────────────────────────────────────────
# Signal handlers
# ────────────────────────────────────────────────────────────────────────────────

func _on_target_destroyed(target_type: String, score_value: int) -> void:
	total_score += score_value
	target_destroyed.emit(target_type, score_value)
	print("[MissionManager] target destroyed: %s (+%d) total_score=%d" % [
		target_type, score_value, total_score
	])
	# Prune invalid/freed targets from alive list
	alive_targets = alive_targets.filter(
		func(t): return is_instance_valid(t) and not t.is_queued_for_deletion()
	)
	if alive_targets.is_empty():
		_complete_mission()


# ────────────────────────────────────────────────────────────────────────────────
# Mission completion + next cycle
# ────────────────────────────────────────────────────────────────────────────────

func _complete_mission() -> void:
	print("[MissionManager] MISSION %d COMPLETE — score %d" % [cycle, total_score])
	mission_complete.emit(cycle, total_score)
	await get_tree().create_timer(3.0).timeout
	cycle += 1
	_start_next_cycle()


func _start_next_cycle() -> void:
	# Update difficulty multipliers for the new cycle
	hp_multiplier = get_difficulty_multiplier_hp()
	aa_interval_multiplier = get_difficulty_multiplier_aa_interval()
	cycle_advanced.emit(cycle)
	mission_started.emit(cycle)
	print("[MissionManager] starting cycle %d — HP coef=%.3f  AA interval coef=%.3f" % [
		cycle, hp_multiplier, aa_interval_multiplier
	])


# ────────────────────────────────────────────────────────────────────────────────
# Difficulty helpers (used by aa_gun.gd + target scripts)
# ────────────────────────────────────────────────────────────────────────────────

func get_difficulty_multiplier_hp() -> float:
	return pow(hp_difficulty_coef, cycle - 1)


func get_difficulty_multiplier_aa_interval() -> float:
	return pow(aa_interval_coef, cycle - 1)

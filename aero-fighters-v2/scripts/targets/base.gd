extends "res://scripts/target_base.gd"
class_name TargetMilitaryBase
# base.gd — Military base target.
# Implements FR-V2-G-05/07: HP 28, multi-stage destruction.
#
# Multi-stage logic:
#   - On the first damage event that drops HP ≤ 50% of max (HP ≤ 14): the
#     radar dish + post sub-assembly is freed and a "radar destroyed" sub-event
#     is logged (Wave 5 will spawn a small explosion FX here).
#   - On HP ≤ 0: full destruction → emits destroyed signal, frees the whole
#     target, MissionManager prunes it from alive_targets.
#
# Per T-G-20 (Wave 4).

const NAME_RADAR_POST: String = "RadarPost"
const NAME_RADAR_DISH: String = "RadarDish"

var _radar_destroyed: bool = false


func _init() -> void:
	max_hp = 28
	target_type = "base"
	score_value = 800


func _on_damaged(_amount: int) -> void:
	if _radar_destroyed:
		return
	# Radar sub-event fires when HP first drops at or below half of CURRENT max
	# (post-scaling). We snapshot the threshold from `hp` at the time of
	# _ready — i.e. half of the scaled max.
	var threshold: int = int(round(float(max_hp) * MissionManager.get_difficulty_multiplier_hp() * 0.5))
	if hp <= threshold:
		_destroy_radar()


func _destroy_radar() -> void:
	_radar_destroyed = true
	var post: Node = get_node_or_null(NAME_RADAR_POST)
	var dish: Node = get_node_or_null(NAME_RADAR_DISH)
	if post:
		post.queue_free()
	if dish:
		dish.queue_free()
	# Wave-5-pending: small GPUParticles3D burst at the radar position.
	print("[base] radar destroyed (sub-event, hp=%d)" % hp)


func _play_destruction_fx() -> void:
	# Wave-5-pending: layered GPUParticles3D — building collapse + smoke.
	print("[base] destroyed — building collapse (score=%d)" % score_value)

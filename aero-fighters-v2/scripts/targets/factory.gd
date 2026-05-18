extends "res://scripts/target_base.gd"
class_name TargetFactory
# factory.gd — Industrial factory target.
# Implements FR-V2-G-05/07: HP 20, single-stage mega-explosion on kill.
# Geometry assembled in scenes/Targets/Factory.tscn (main building + 3 stacks
# + annex). Per T-G-20 (Wave 4).
#
# Wave 4 logs the destruction event; Wave 5 wires the actual GPUParticles3D
# fireball + smoke + debris layers (≈ 4 s total).

func _init() -> void:
	max_hp = 20
	target_type = "factory"
	score_value = 600


func _play_destruction_fx() -> void:
	# Wave-5-pending: layered GPUParticles3D — fireball + smoke + debris.
	print("[factory] mega-explosion! (score=%d)" % score_value)

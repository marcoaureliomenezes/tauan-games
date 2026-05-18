extends Node
# MissionManager — Autoload singleton
# Implements FR-V2-G-07 / FR-V2-G-18: 1-cycle mission loop, 3-target win condition,
# +1 difficulty per cycle.
# Full implementation in T-G-19 (Wave 4).

signal mission_complete
signal cycle_advanced(cycle: int)
signal target_destroyed(target_type: String)

var cycle: int = 1
var alive_targets: Array = []
var hp_multiplier: float = 1.0
var aa_interval_multiplier: float = 1.0


func _ready() -> void:
	print("[MissionManager] ready — cycle %d" % cycle)

extends Node
# GameConfig — Autoload singleton
# Loads GameConfig.tres and MissionConfig.tres on boot.
# Access globally: GameConfig.cfg, GameConfig.mission
# Implemented in T-G-05 (Wave 1).

var cfg = null
var mission = null


func _ready() -> void:
	cfg = load("res://Content/Data/GameConfig.tres")
	if cfg:
		print("[GameConfig] loaded GameConfig.tres — origin=(%.4f, %.4f) spawn_h=%.1f m" % [
			cfg.origin_latitude, cfg.origin_longitude, cfg.spawn_height_m
		])
	else:
		print("[GameConfig] WARNING: GameConfig.tres not found")

	mission = load("res://Content/Data/MissionConfig.tres")
	if mission:
		print("[GameConfig] loaded MissionConfig.tres — factory_hp=%d base_hp=%d aa_gun_hp=%d" % [
			mission.factory_hp, mission.base_hp, mission.aa_gun_hp
		])
	else:
		print("[GameConfig] WARNING: MissionConfig.tres not found")

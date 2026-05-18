extends Node
# GameConfig — Autoload singleton
# Loads GameConfig.tres on boot and exposes as GameConfig.cfg for global read access.
# Full implementation (resource wire-up) in T-G-05 (Wave 1).

var cfg = null


func _ready() -> void:
	cfg = load("res://Content/Data/GameConfig.tres")
	if cfg:
		print("[GameConfig] loaded GameConfig.tres")
	else:
		print("[GameConfig] WARNING: GameConfig.tres not found — run T-G-05 to create it")

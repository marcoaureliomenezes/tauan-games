extends Node
# Telemetry — Autoload singleton
# Optional frame-time / event sampling for determinism harness and test fixtures.
# Implements --test-mode CLI flag detection + Ctrl+T shortcut per FR-V2-G-15.
# Full implementation in T-G-21 (Wave 5).

var test_mode: bool = false


func _ready() -> void:
	if "--test-mode" in OS.get_cmdline_args():
		test_mode = true
		_apply_test_overrides()
	print("[Telemetry] ready — test_mode=%s" % test_mode)


func _apply_test_overrides() -> void:
	Engine.time_scale = 1.0
	Engine.physics_ticks_per_second = 60
	print("[Telemetry] test-mode overrides applied")

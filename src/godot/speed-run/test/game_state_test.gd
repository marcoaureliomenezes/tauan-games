class_name GameStateTest
extends GdUnitTestSuite
## Valida o contrato das definições das rotas cidade-a-cidade.

const REQUIRED_KEYS := [
	"title",
	"city_a",
	"city_b",
	"segments",
	"seed",
	"amplitude",
	"base_scale",
	"sun_energy_lux",
	"sun_temperature",
	"sun_angle",
	"fog_density",
	"horizon_color",
	"low_color",
	"high_color",
	"peak_color",
	"tree_color",
	"tree_count",
	"points",
]

const GameStateScript := preload("res://scripts/game_state.gd")


func test_has_two_routes() -> void:
	assert_int(GameStateScript.ROUTES.size()).is_equal(2)


func test_track_defs_are_complete() -> void:
	for key: String in GameStateScript.ROUTES:
		var def: Dictionary = GameStateScript.ROUTES[key]
		for req: String in REQUIRED_KEYS:
			(
				assert_bool(def.has(req))
				. override_failure_message("pista '%s' sem chave '%s'" % [key, req])
				. is_true()
			)
		assert_int((def["points"] as Array).size()).is_greater_equal(8)
		assert_float(float((def["segments"] as Array).back()["until"])).is_equal(1.0)

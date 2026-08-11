class_name RouteBuilderTest
extends GdUnitTestSuite
## Constrói cada rota cidade-a-cidade de verdade e valida invariantes.

const GameStateScript := preload("res://scripts/game_state.gd")


func _build(track_key: String) -> RouteBuilder:
	var route: RouteBuilder = auto_free(RouteBuilder.new())
	add_child(route)
	route.build(GameStateScript.ROUTES[track_key])
	return route


func test_routes_are_open_point_to_point() -> void:
	for key: String in GameStateScript.ROUTES:
		var route := _build(key)
		(
			assert_float(route.track_len)
			. override_failure_message("rota '%s' curta demais" % key)
			. is_greater(1500.0)
		)
		var start := route.point_at(0.0)
		var finish := route.point_at(route.track_len)
		(
			assert_float(start.distance_to(finish))
			. override_failure_message(
				"rota '%s' não é ponto-a-ponto (início e fim próximos)" % key
			)
			. is_greater(500.0)
		)
		route.queue_free()


func test_segment_types_follow_definition() -> void:
	var route := _build("serra")
	assert_str(route.segment_type_at(route.track_len * 0.1)).is_equal("dual")
	assert_str(route.segment_type_at(route.track_len * 0.45)).is_equal("single")
	assert_str(route.segment_type_at(route.track_len * 0.58)).is_equal("dirt")
	assert_str(route.segment_type_at(route.track_len * 0.64)).is_equal("ford")
	route.queue_free()


func test_roads_generated_per_run() -> void:
	var route := _build("sertao")
	var manager := route.get_node("RoadManager")
	(
		assert_int(manager.get_child_count())
		. override_failure_message("esperava um RoadContainer por trecho tipado")
		. is_equal((GameStateScript.ROUTES["sertao"]["segments"] as Array).size())
	)
	route.queue_free()


func test_terrain_is_flat_under_road() -> void:
	var route := _build("serra")
	for i in 8:
		var s := route.track_len * float(i) / 8.0
		var p := route.point_at(s)
		var ground := route.height_at(p.x, p.z)
		(
			assert_float(absf(ground - p.y))
			. override_failure_message("terreno não nivelado sob a rota em s=%.0f" % s)
			. is_less(1.2)
		)
	route.queue_free()


func test_start_grid_is_on_road() -> void:
	var route := _build("serra")
	for slot in 4:
		var t := route.start_grid_transform(slot)
		var closest := route.curve.get_closest_point(t.origin)
		var lateral := Vector2(t.origin.x, t.origin.z).distance_to(Vector2(closest.x, closest.z))
		assert_float(lateral).override_failure_message("slot %d fora da pista" % slot).is_less(
			route.road_half_width_at(0.0)
		)
	route.queue_free()

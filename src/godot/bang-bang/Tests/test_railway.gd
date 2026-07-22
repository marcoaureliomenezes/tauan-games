# test_railway.gd — T-BB-07: trilho fechado, trem em loop, fumaça.
extends SceneTree

const BangTerrainScript = preload("res://scripts/world/terrain.gd")
const BangRailwayScript = preload("res://scripts/world/railway.gd")

var failures := 0

func _init() -> void:
	_run.call_deferred()

func check(cond: bool, msg: String) -> void:
	if cond:
		print("ok — ", msg)
	else:
		failures += 1
		print("FALHOU — ", msg)

func _run() -> void:
	var root := Node3D.new()
	get_root().add_child(root)
	var terrain = BangTerrainScript.new()
	root.add_child(terrain)
	await terrain.build(1876)

	var railway = BangRailwayScript.new()
	root.add_child(railway)
	railway.build(terrain, 1876)

	check(railway.path.curve.closed, "trilho em loop fechado")
	check(railway.path.curve.get_baked_length() > 1500.0, "trilho longo (%.0f m)" % railway.path.curve.get_baked_length())
	var engine = railway.train.get_node_or_null("Engine")
	check(engine != null, "locomotiva presente")
	check(railway.train.get_child_count() >= 4, "locomotiva + 3 vagões (%d)" % railway.train.get_child_count())
	check(railway.smoke != null and railway.smoke.amount > 0, "fumaça da chaminé")

	# alturas do trilho acompanham o relevo (sem degrau brusco)
	var max_step := 0.0
	var c: Curve3D = railway.path.curve
	for i in range(c.point_count):
		var d: float = absf(c.get_point_position(i).y - c.get_point_position((i + 1) % c.point_count).y)
		max_step = maxf(max_step, d)
	check(max_step < 25.0, "trilho suavizado (degrau máx=%.1f m)" % max_step)

	# trem anda e dá a volta (progresso cresce continuamente)
	var p0: float = railway.follow.progress
	var frames := 0
	while railway.follow.progress - p0 < 50.0 and frames < 1200:
		await process_frame
		frames += 1
	var p1: float = railway.follow.progress
	check(p1 - p0 >= 50.0, "trem avança 50 m no loop (%.0f→%.0f m em %d frames)" % [p0, p1, frames])

	var verdict := "ALL_TESTS_PASSED" if failures == 0 else "TESTS_FAILED=%d" % failures
	print(verdict)
	quit(failures)

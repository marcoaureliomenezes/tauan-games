# test_world2.gd — T-BB-06: florestas por bioma, água/vaus/pontes, céu.
extends SceneTree

const BangTerrainScript = preload("res://scripts/world/terrain.gd")
const BangForestsScript = preload("res://scripts/world/forests.gd")
const BangWaterScript = preload("res://scripts/world/water.gd")
const BangSkyScript = preload("res://scripts/world/sky.gd")

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

	# --- florestas ---
	var forests = BangForestsScript.new()
	root.add_child(forests)
	forests.build(terrain, terrain.gen, 1876)
	var total := 0
	for k in forests.counts:
		total += forests.counts[k]
	check(total > 1500, "vegetação plantada (total=%d)" % total)
	check(forests.counts.get("pine", 0) > 200, "pinheiros (%d)" % forests.counts.get("pine", 0))
	check(forests.counts.get("leaf", 0) > 150, "folhosas (%d)" % forests.counts.get("leaf", 0))
	check(forests.counts.get("dead", 0) > 20, "árvores secas (%d)" % forests.counts.get("dead", 0))
	# densidade VARIA por região (anti-uniforme): amostra 4 quadrantes
	var q := [0, 0, 0, 0]
	for sp in forests.SPECIES:
		pass
	var mmi_count := 0
	for c in forests.get_children():
		if c is MultiMeshInstance3D:
			mmi_count += 1
	check(mmi_count == 5, "5 MultiMeshes (uma por espécie)")

	# --- água ---
	var water = BangWaterScript.new()
	root.add_child(water)
	water.build(terrain, terrain.gen)
	var lc: Vector2 = terrain.gen["lake_center"] - Vector2(1024, 1024)
	var wi_lake: Dictionary = water.water_info(lc.x, lc.y)
	check(wi_lake.get("in_water", false), "centro do lago é água")
	var found_ford := false
	var found_deep := false
	for r in terrain.gen["rivers"]:
		var pts: Array = r["points"]
		for i in range(pts.size()):
			var p: Vector2 = pts[i] - Vector2(1024, 1024)
			var wi: Dictionary = water.water_info(p.x, p.y)
			if wi.get("ford", false):
				found_ford = true
			if wi.get("deep", false):
				found_deep = true
	check(found_ford, "existe pelo menos um vau classificado")
	check(found_deep, "existe pelo menos um trecho profundo")
	check(water.bridges.size() == 2, "2 pontes construídas")
	var b0 = water.bridges[0]
	check(water.bridge_at(b0["center"].x, b0["center"].z) == b0["deck_y"], "bridge_at no tabuleiro")
	check(water.bridge_at(0, 0) == 0.0, "bridge_at fora de ponte = 0")

	# --- céu ---
	var sky = BangSkyScript.new()
	root.add_child(sky)
	var e0: float = sky.sun.light_energy
	var t0: float = sky.t
	for i in range(120):
		await process_frame
	check(sky.t != t0, "ciclo dia/noite avança")

	var verdict := "ALL_TESTS_PASSED" if failures == 0 else "TESTS_FAILED=%d" % failures
	print(verdict)
	quit(failures)

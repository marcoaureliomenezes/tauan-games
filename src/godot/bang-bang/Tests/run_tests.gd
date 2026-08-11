# run_tests.gd — suite headless do bang-bang (roda com godot --headless -s).
# T-BB-02: determinismo do heightfield, rios monotônicos, lago, build do Terrain3D.
extends SceneTree

const TerrainGen = preload("res://scripts/world/terrain_gen.gd")
const BangTerrainScript = preload("res://scripts/world/terrain.gd")

var failures := 0

func check(cond: bool, msg: String) -> void:
	if cond:
		print("ok — ", msg)
	else:
		failures += 1
		print("FALHOU — ", msg)

func _init() -> void:
	_run.call_deferred()

func _run() -> void:
	# 1) determinismo
	var g1 := TerrainGen.generate(1876)
	var g2 := TerrainGen.generate(1876)
	var g3 := TerrainGen.generate(999)
	check(TerrainGen.hash_heights(g1["heights"]) == TerrainGen.hash_heights(g2["heights"]),
		"heightfield determinístico (mesma seed ⇒ mesmo hash)")
	check(TerrainGen.hash_heights(g1["heights"]) != TerrainGen.hash_heights(g3["heights"]),
		"seeds diferentes ⇒ terrenos diferentes")

	# 2) rios monotônicos a jusante
	for r in g1["rivers"]:
		var bed: PackedFloat32Array = r["bed"]
		var mono := true
		for i in range(1, bed.size()):
			if bed[i] > bed[i - 1] + 0.001:
				mono = false
		check(mono, "leito de rio monotônico (nunca sobe a jusante)")

	# 3) lago plano abaixo de lake_y
	var lc: Vector2 = g1["lake_center"]
	var ly: float = g1["lake_y"]
	var gx := int(lc.x / (g1["size_m"] / (g1["grid"] - 1)))
	var gz := int(lc.y / (g1["size_m"] / (g1["grid"] - 1)))
	check(g1["heights"][gz * g1["grid"] + gx] <= ly, "fundo do lago abaixo do nível da água")

	# 4) build real do Terrain3D
	# (em modo -s o autoload não existe: registra o singleton Game na mão)
	var game_state = preload("res://scripts/state.gd").new()
	game_state.name = "Game"
	get_root().add_child(game_state)
	var root := Node3D.new()
	get_root().add_child(root)
	var t = BangTerrainScript.new()
	root.add_child(t)
	await t.build(1876)
	check(t.terrain != null and t.terrain.data != null, "Terrain3D instanciado com dados")
	await process_frame
	await process_frame
	var h_center = t.height_at(0, 0)
	check(h_center > -10.0 and h_center < 300.0, "height_at plausível no centro (%.1f m)" % h_center)
	var h_lake = t.height_at(lc.x - 1024.0, lc.y - 1024.0)
	check(h_lake <= ly + 0.5, "height_at no lago ≈ nível (%.1f m)" % h_lake)

	var verdict := "ALL_TESTS_PASSED" if failures == 0 else "TESTS_FAILED=%d" % failures
	print(verdict)
	quit(failures)

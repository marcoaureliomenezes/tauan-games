# test_entities.gd — T-BB-08: assentamentos + entidades + fluxo captura/caça.
extends SceneTree

const BangTerrainScript = preload("res://scripts/world/terrain.gd")
const BangSettlementsScript = preload("res://scripts/settlements/settlements.gd")
const BangEntitiesScript = preload("res://scripts/entities/entities.gd")

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
	var gs = get_root().get_node_or_null("Game")
	if gs == null:
		gs = preload("res://scripts/state.gd").new()
		gs.name = "Game"
		get_root().add_child(gs)
	gs.phase = &"playing"

	var root := Node3D.new()
	get_root().add_child(root)
	var terrain = BangTerrainScript.new()
	root.add_child(terrain)
	await terrain.build(1876)

	var settlements = BangSettlementsScript.new()
	root.add_child(settlements)
	settlements.build(terrain, 1876)
	check(settlements.sites["towns"].size() == 2, "2 cidades")
	check(settlements.sites["villages"].size() == 2, "2 aldeias")
	check(settlements.get_node_or_null("Town1") != null, "cidade 1 construída")
	check(settlements.get_node_or_null("Village1") != null, "aldeia 1 construída")
	check(settlements.get_node_or_null("Camp") != null, "acampamento construído")

	var entities = BangEntitiesScript.new()
	root.add_child(entities)
	entities.build(terrain, settlements, 1876)
	check(entities.bandits.size() == 5, "5 bandidos (%d)" % entities.bandits.size())
	check(entities.deer.size() >= 12, "veados ≥12 (%d)" % entities.deer.size())
	check(entities.snakes.size() == 12, "12 cobras")
	check(entities.archers.size() == 16, "16 arqueiros (8×2)")
	check(entities.eagles.size() == 4, "4 águias")

	# --- fluxo bandido: tiro → rendição → captura [E] ---
	var b = entities.bandits[0]
	gs.player["pos"] = b.global_position + Vector3(2, 0, 0)   # ≤4 m
	b.apply_damage(34.0, b.global_position)
	check(b.state == &"surrender", "1 tiro → rendição")
	var before: int = gs.bandits_captured
	Input.action_press("interact")
	for i in range(3):
		await physics_frame
	Input.action_release("interact")
	check(gs.bandits_captured == before + 1, "[E] ≤4 m → captura (contador)")

	# --- fluxo veado: 1 tiro → carcaça ---
	var d = entities.deer[0]
	d.apply_damage(34.0, d.global_position)
	check(d.carcass, "veado abatido vira carcaça")

	# --- arqueiro atira quando o jogador se aproxima ---
	gs.player["pos"] = entities.archers[0].global_position + Vector3(10, 0, 0)
	var shot := false
	for i in range(240):
		await physics_frame
	# ARCHER_SHOOT é impresso; checa estado aggro
	check(entities.archers[0].state == &"aggro", "arqueiro em aggro <40 m")

	var verdict := "ALL_TESTS_PASSED" if failures == 0 else "TESTS_FAILED=%d" % failures
	print(verdict)
	quit(failures)

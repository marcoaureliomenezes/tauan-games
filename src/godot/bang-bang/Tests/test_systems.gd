# test_systems.gd — T-BB-09: sobrevivência, morte/respawn, vitória, HUD, mapa.
extends SceneTree

const BangSurvivalScript = preload("res://scripts/systems/survival.gd")
const BangGameFlowScript = preload("res://scripts/systems/game_flow.gd")
const BangHudScript = preload("res://scripts/ui/hud.gd")
const BangMapScript = preload("res://scripts/ui/map.gd")
const BangTerrainScript = preload("res://scripts/world/terrain.gd")
const DeerScript = preload("res://scripts/entities/deer.gd")

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
	gs.player["food"] = 100.0
	gs.player["hp"] = 100.0

	var root := Node3D.new()
	get_root().add_child(root)
	var terrain = BangTerrainScript.new()
	root.add_child(terrain)
	await terrain.build(1876)

	# --- survival: comida drena + fome morde HP ---
	var survival = BangSurvivalScript.new()
	root.add_child(survival)
	survival.setup(Vector3(500, 0, 500), null)
	var f0: float = gs.player["food"]
	await process_frame
	await process_frame
	check(gs.player["food"] < f0, "comida drena (%.1f)" % gs.player["food"])
	gs.player["food"] = 0.0
	var h0: float = gs.player["hp"]
	for i in range(60):
		await process_frame
	check(gs.player["hp"] < h0, "fome zero → HP cai (%.1f)" % gs.player["hp"])

	# --- cura do acampamento ---
	gs.player["hp"] = 40.0
	gs.player["pos"] = Vector3(500, 0, 500)
	for i in range(60):
		await process_frame
	check(gs.player["hp"] > 40.0, "acampamento cura (%.1f)" % gs.player["hp"])

	# --- morte → game over → respawn ---
	var rider = Node3D.new()
	root.add_child(rider)
	rider.set("speed", 0.0)
	var overlay := Control.new()
	root.add_child(overlay)
	var label := RichTextLabel.new()
	overlay.add_child(label)
	var flow = BangGameFlowScript.new()
	root.add_child(flow)
	flow.setup(Vector3(500, 0, 500), rider, overlay, label)
	# longe do acampamento (a cura de lá ressuscitaria antes do game over)
	gs.player["pos"] = Vector3(0, 0, 0)
	gs.player["hp"] = 0.0
	await process_frame
	await process_frame
	check(gs.phase == &"gameover" and overlay.visible, "morte → game over")
	Input.action_press("jump")
	await physics_frame
	Input.action_release("jump")
	await process_frame
	await process_frame
	check(gs.phase == &"playing" and gs.player["hp"] == 100.0, "respawn com HP/food (hp=%.0f food=%.0f)" % [gs.player["hp"], gs.player["food"]])
	check(gs.player["food"] > 49.0, "respawn com comida 50")

	# --- vitória 5/5 ---
	gs.bandits_captured = 5
	await process_frame
	check(gs.phase == &"victory", "5/5 → tela de vitória")
	Input.action_press("jump")
	await physics_frame
	Input.action_release("jump")
	check(gs.phase == &"playing", "continuar após vitória")

	# --- HUD ---
	var hud = BangHudScript.new()
	root.add_child(hud)
	for i in range(3):
		await process_frame
	check(hud.bars.size() == 3, "HUD com 3 barras")
	print("HUD_LABEL=[", hud.weapon_label.text, "]")
	check(hud.weapon_label.text.contains("REVÓLVER"), "HUD mostra arma")

	# --- mapa ---
	var map = BangMapScript.new()
	root.add_child(map)
	map.setup(terrain.gen, null, null, null, null)
	check(map.texture != null, "textura do mapa construída")
	var p := map.world_to_map(0, 0)
	check(absf(p.x - 128.0) < 1.0 and absf(p.y - 128.0) < 1.0, "world_to_map centro")

	var verdict := "ALL_TESTS_PASSED" if failures == 0 else "TESTS_FAILED=%d" % failures
	print(verdict)
	quit(failures)

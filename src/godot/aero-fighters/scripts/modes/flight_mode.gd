class_name FlightMode
extends Node3D
## FlightMode — modo caça (ataque ar-terra) sobre Inhaúma.
## Orquestra: mapa + jato + câmera + HUD + pausa/game-over.

const MAP_SCENE := preload("res://scenes/maps/inhauma_map.tscn")

var map: InhaumaMap
var jet: Jet
var camera: FlightCamera
var hud: FlightHud
var fx: FxManager
var weapons: WeaponSystem
var campaign: CampaignDirector
var _over := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS # precisa receber input durante a pausa
	GameState.mode = GameState.Mode.FLIGHT
	GameState.running = true
	map = MAP_SCENE.instantiate()
	add_child(map)
	fx = FxManager.new()
	add_child(fx)
	Target.register_fx(fx)
	jet = Jet.new()
	jet.name = "PlayerJet"
	add_child(jet)
	jet.setup(map.surface_height, map.water_level_at)
	GameState.player = jet
	weapons = WeaponSystem.new()
	weapons.setup(jet, map.surface_fast, fx) # projéteis: grade rápida (perf)
	add_child(weapons)
	# Wingmen: 2 aliados em formação (wingmen.js)
	for offset in [Vector3(-18, 2, 14), Vector3(18, 2, 14)]:
		var w := Wingman.new()
		add_child(w)
		w.setup(jet, offset, map.surface_fast, fx)
	camera = FlightCamera.new()
	camera.jet = jet
	add_child(camera)
	hud = FlightHud.new()
	hud.jet = jet
	add_child(hud)
	weapons.lock_progress.connect(hud.set_lock_progress)
	jet.mayday_started.connect(func():
		camera.shake(6.0)
		hud.show_message("⚠ MAYDAY MAYDAY", 2.5))
	jet.crashed.connect(func(reason):
		camera.shake(8.0)
		if reason == "water":
			hud.show_message("AFUNDOU NO MAR", 3.0))
	jet.landed.connect(func():
		hud.show_message("POUSO COMPLETO — REARMANDO", 2.5))
	GameState.game_over.connect(_on_game_over)
	# Campanha: guarnição de Cachoeira (persistente) + diretor dos Atos 1/2
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	var garrison := Garrison.build(self, map.surface_height, map.heightmap, rng)
	campaign = CampaignDirector.new()
	add_child(campaign)
	campaign.setup(self, map.surface_height, fx, garrison)
	campaign.act_advanced.connect(func(act):
		if act == 2:
			hud.show_message("INHAÚMA DEFENDIDA\nAGORA LIBERTE CACHOEIRA DA PRATA", 4.0))
	campaign.inhauma_fallen.connect(_on_inhauma_fallen)
	campaign.victory.connect(func():
		hud.show_message("CACHOEIRA DA PRATA LIBERTADA — VITÓRIA\nSCORE %d" % GameState.score, 8.0))
	hud.show_message("ATO 1 — SALVAR INHAÚMA", 4.0)


func _on_inhauma_fallen() -> void:
	hud.show_message("INHAÚMA CAIU\nUma coluna inimiga chegou à cidade", 4.0)
	camera.shake(8.0)
	await get_tree().create_timer(4.0).timeout
	# Reset do Ato 1 (guarnição intocada) + jato de volta à pista
	GameState.inhauma_fallen = false
	campaign.reset_campaign()
	jet.respawn()
	hud.show_message("ATO 1 — SALVAR INHAÚMA", 3.0)


func _unhandled_input(event: InputEvent) -> void:
	if _over:
		if event.is_action_pressed("start_game") or event.is_action_pressed("fire_cannon"):
			GameState.reset_state()
			get_tree().reload_current_scene()
		return
	if event.is_action_pressed("pause_game") or event.is_action_pressed("ui_cancel"):
		GameState.paused = not GameState.paused
		get_tree().paused = GameState.paused
		if GameState.paused:
			hud.show_message("PAUSA", 9999.0)
		else:
			hud.show_message("", 0.01)
	elif event.is_action_pressed("mute"):
		GameState.muted = not GameState.muted


func _on_game_over(reason: String) -> void:
	_over = true
	GameState.running = false
	hud.show_message("GAME OVER — %s\nSCORE %d\n(Enter p/ recomeçar)" % [reason.to_upper(), GameState.score], 9999.0)

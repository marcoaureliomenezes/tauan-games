class_name DefenseMode
extends Node3D
## DefenseMode — modo bateria antiaérea defendendo Inhaúma.
## Orquestra: mapa + artilheiro + diretor infinito + HUD + pausa/game-over.

const MAP_SCENE := preload("res://scenes/maps/inhauma_map.tscn")

var map: InhaumaMap
var turret: AaTurret
var director: DefenseDirector
var hud: DefenseHud
var fx: FxManager
var _over := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	GameState.mode = GameState.Mode.DEFENSE
	GameState.running = true
	GameState.city_integrity = 1.0
	map = MAP_SCENE.instantiate()
	add_child(map)
	# Fog da defesa mais longo que o do voo (web inhauma-defense: Fog 1100/3400) —
	# caças spawnam a 2,3 km e precisam ficar visíveis contra o céu
	var env: Environment = map.get_node("WorldEnvironment").environment
	env.fog_depth_begin = GameConfig.AAD_FOG_NEAR
	env.fog_depth_end = GameConfig.AAD_FOG_FAR
	fx = FxManager.new()
	add_child(fx)
	director = DefenseDirector.new()
	add_child(director)
	director.setup(self, map.surface_fast, fx) # caças/ordenança: grade rápida (perf)
	turret = AaTurret.new()
	turret.name = "AaTurret"
	add_child(turret)
	turret.setup(map.surface_height, fx, director) # artilheiro: cadeia exata
	turret.surface_fast = map.surface_fast # projéteis: grade rápida
	GameState.player = turret
	hud = DefenseHud.new()
	hud.turret = turret
	hud.director = director
	add_child(hud)
	hud.minimap.director = director
	turret.lock_progress.connect(hud.set_lock_progress)
	turret.player_hit.connect(hud.show_hit_flash)
	director.squadron_spawned.connect(func(size):
		if size >= 3:
			hud.show_message("⚠ ESQUADRILHA INIMIGA ×%d" % size, 2.0))
	director.horde_spawned.connect(func():
		hud.show_message("⚠ HORDA NO HORIZONTE\ndestrua antes que chegue a Inhaúma — NUKE no T", 3.5))
	director.horde_wiped.connect(func():
		hud.show_message("HORDA VARRIDA", 2.2))
	director.horde_arrived.connect(func():
		hud.show_message("A HORDA ENTROU EM INHAÚMA\nintegridade −30%", 3.0))
	GameState.game_over.connect(_on_game_over)
	hud.show_message("DEFENDA INHAÚMA\nBateria antiaérea em posição", 4.0)


func _unhandled_input(event: InputEvent) -> void:
	if _over:
		if event.is_action_pressed("start_game") or event.is_action_pressed("fire_cannon"):
			GameState.reset_state()
			get_tree().reload_current_scene()
		return
	if event.is_action_pressed("pause_game"):
		GameState.paused = not GameState.paused
		get_tree().paused = GameState.paused
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if GameState.paused else Input.MOUSE_MODE_CAPTURED
		if GameState.paused:
			hud.show_message("PAUSA", 9999.0)
		else:
			hud.show_message("", 0.01)
	elif event.is_action_pressed("ui_cancel"):
		# Esc sai do pointer lock (clique recaptura) — como no web
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	elif event.is_action_pressed("mute"):
		GameState.muted = not GameState.muted


func _on_game_over(reason: String) -> void:
	_over = true
	GameState.running = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	hud.show_message("%s\nSCORE %d\n(Enter p/ recomeçar)" % [reason, GameState.score], 9999.0)

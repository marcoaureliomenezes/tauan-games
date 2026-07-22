# main.gd — entry point: boot, overlay de start, estados de fluxo.
# CONTRATO: writer de Game.phase (compartilhado com systems/game_flow.gd)
extends Node

const BangHudScript = preload("res://scripts/ui/hud.gd")
const BangMapScript = preload("res://scripts/ui/map.gd")
const BangAudioScript = preload("res://scripts/ui/audio.gd")
const BangSurvivalScript = preload("res://scripts/systems/survival.gd")
const BangGameFlowScript = preload("res://scripts/systems/game_flow.gd")

const OVERLAY_TEXT := "[center][b]BANG-BANG[/b]\n\nVelho Oeste aberto — capture os 5 bandidos.\n\nWASD cavalga · Shift galope · Space salto\nMouse mira · LMB atira · 1/2 troca arma · R recarga\nF mira precisa · E interage · M mapa · V câmera\n\n[b]Clique para começar[/b][/center]"

@onready var _overlay: Control = $UI/StartOverlay
@onready var _label: RichTextLabel = $UI/StartOverlay/Panel/Center/RichTextLabel

func _ready() -> void:
	Game.phase = &"start"
	_label.text = OVERLAY_TEXT
	_overlay.visible = true
	_wire_systems()
	# Em headless/CI começa direto (sem clique possível).
	if DisplayServer.get_name() == "headless" or OS.has_feature("dedicated_server"):
		_begin()
	print("BANGBANG_BOOT_OK")

func _wire_systems() -> void:
	var world = $World
	var player = $Player
	var camp: Vector3 = world.settlements.sites["camp"]
	var rider = player.rider
	var hud = BangHudScript.new()
	hud.name = "HUD"
	add_child(hud)
	var map = BangMapScript.new()
	map.name = "Map"
	add_child(map)
	map.setup(world.terrain.gen, world.entities, world.settlements, rider, world.railway)
	var survival = BangSurvivalScript.new()
	survival.name = "Survival"
	add_child(survival)
	survival.setup(camp, world.entities)
	var flow = BangGameFlowScript.new()
	flow.name = "GameFlow"
	add_child(flow)
	flow.setup(camp, rider, _overlay, _label)
	# áudio: tiro do combat → gerador sintetizado
	var audio = BangAudioScript.new()
	audio.name = "Audio"
	add_child(audio)
	var combat = rider.get_node_or_null("Combat")
	if combat and combat.has_signal("fired"):
		combat.fired.connect(func(w, origin, _dir): audio.shot(origin, w == &"shotgun"))
	print("SYSTEMS_WIRED")

func _unhandled_input(event: InputEvent) -> void:
	if Game.phase == &"start" and event is InputEventMouseButton and event.pressed:
		_begin()

func _begin() -> void:
	Game.phase = &"playing"
	_overlay.visible = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

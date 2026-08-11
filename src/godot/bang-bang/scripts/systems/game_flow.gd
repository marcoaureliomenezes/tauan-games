# game_flow.gd — morte → game over → respawn no acampamento (revólver carregado,
# comida 50); 5/5 → tela de vitória + continuar; pausa com Esc.
class_name BangGameFlow
extends Node3D

var camp_pos := Vector3.ZERO
var rider: Node3D = null
var overlay: Control = null
var _label: RichTextLabel = null
var _dead := false
var _won := false

func setup(p_camp_pos: Vector3, p_rider: Node3D, p_overlay: Control, p_label: RichTextLabel) -> void:
	camp_pos = p_camp_pos
	rider = p_rider
	overlay = p_overlay
	_label = p_label
	overlay.visible = false

func _process(_dt: float) -> void:
	var g = get_node_or_null("/root/Game")
	if g == null:
		return
	# vitória 5/5
	if not _won and g.bandits_captured >= g.BANDITS_TOTAL:
		_won = true
		g.phase = &"victory"
		_label.text = "[center][b]🏆 TODOS OS BANDIDOS CAPTURADOS![/b]\n\nO Velho Oeste está seguro… por enquanto.\n\n[Espaço] continuar no mundo[/center]"
		overlay.visible = true
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		print("VICTORY")
	# morte
	if not _dead and g.player["hp"] <= 0.0:
		_dead = true
		g.phase = &"gameover"
		_label.text = "[center][b]☠ VOCÊ MORREU[/b]\n\n[Espaço] respawn no acampamento[/center]"
		overlay.visible = true
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		print("GAME_OVER")
	# respawn / continuar
	if (g.phase == &"gameover" or g.phase == &"victory") and Input.is_action_just_pressed("jump"):
		if g.phase == &"gameover":
			_respawn(g)
		else:
			g.phase = &"playing"
			overlay.visible = false
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	# pausa
	if g.phase == &"playing" and Input.is_action_just_pressed("pause"):
		g.phase = &"paused"
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	elif g.phase == &"paused" and Input.is_action_just_pressed("pause"):
		g.phase = &"playing"
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _respawn(g) -> void:
	g.player["hp"] = 100.0
	g.player["food"] = 50.0
	g.player["stamina"] = 100.0
	g.player["carrying"] = false
	g.player["revolver_ammo"] = 8
	g.player["reloading"] = false
	if rider:
		rider.global_position = camp_pos + Vector3(2, 0.5, 2)
		if rider.get("vel"):
			rider.vel = Vector3.ZERO
		if rider.get("speed") != null:
			rider.speed = 0.0
	_dead = false
	g.phase = &"playing"
	overlay.visible = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	print("RESPAWNED")

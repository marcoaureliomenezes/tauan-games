class_name FlightHud
extends CanvasLayer
## FlightHud — HUD do modo caça (port de hud.js): MISSÃO/ATO, vidas, dano,
## SCORE, armamento, SPD/THR/ALT, STALL, crosshair, mensagens.

var jet: Jet

var _lbl_mission: Label
var _lbl_score: Label
var _lbl_weapons: Label
var _lbl_flight: Label
var _lbl_warn: Label
var _lbl_msg: Label
var _lbl_lock: Label
var _lock_box: LockBox


func _ready() -> void:
	_lbl_mission = _make_label(Vector2(16, 12), HORIZONTAL_ALIGNMENT_LEFT)
	_lbl_score = _make_label(Vector2(-416, 12), HORIZONTAL_ALIGNMENT_RIGHT)
	_lbl_score.anchor_left = 1.0
	_lbl_score.anchor_right = 1.0
	_lbl_weapons = _make_label(Vector2(16, -64), HORIZONTAL_ALIGNMENT_LEFT)
	_lbl_weapons.anchor_top = 1.0
	_lbl_weapons.anchor_bottom = 1.0
	_lbl_flight = _make_label(Vector2(-316, -64), HORIZONTAL_ALIGNMENT_RIGHT)
	_lbl_flight.anchor_left = 1.0
	_lbl_flight.anchor_right = 1.0
	_lbl_flight.anchor_top = 1.0
	_lbl_flight.anchor_bottom = 1.0
	_lbl_warn = _make_label(Vector2(0, -140), HORIZONTAL_ALIGNMENT_CENTER)
	_lbl_warn.anchor_left = 0.5
	_lbl_warn.anchor_right = 0.5
	_lbl_warn.anchor_top = 0.5
	_lbl_warn.anchor_bottom = 0.5
	_lbl_warn.add_theme_color_override("font_color", Color(1, 0.3, 0.2))
	_lbl_msg = _make_label(Vector2(0, -220), HORIZONTAL_ALIGNMENT_CENTER)
	_lbl_msg.anchor_left = 0.5
	_lbl_msg.anchor_right = 0.5
	_lbl_msg.anchor_top = 0.5
	_lbl_msg.anchor_bottom = 0.5
	_lbl_msg.add_theme_font_size_override("font_size", 42)
	# Minimapa (ui/minimap.js)
	add_child(MinimapHud.new())
	# Retícula do canhão (círculo + 4 ticks — web crosshair.js:49-56)
	add_child(CannonReticle.new())
	# Caixa de lock do míssil (traço amarelo procurando → sólida vermelha travado)
	_lock_box = LockBox.new()
	add_child(_lock_box)
	_lbl_lock = _make_label(Vector2(0, 60), HORIZONTAL_ALIGNMENT_CENTER)
	_lbl_lock.anchor_left = 0.5
	_lbl_lock.anchor_right = 0.5
	_lbl_lock.anchor_top = 0.5
	_lbl_lock.anchor_bottom = 0.5


## Caixa de lock projetada sobre o alvo a cada frame (web crosshair.js:141-162,
## mesmo padrão do lock_progress da Wave A): traço amarelo #ffcc44 procurando
## → sólido vermelho #ff3333 travado; texto "◌ N s" → "◉ LOCKED"; escondida
## sem candidato ou com o alvo atrás da câmera.
func set_lock_progress(target: Node3D, p: float) -> void:
	if target == null or not is_instance_valid(target):
		_lock_box.visible = false
		_lbl_lock.text = ""
		return
	var cam := get_viewport().get_camera_3d()
	if cam == null or cam.is_position_behind(target.global_position):
		_lock_box.visible = false
		_lbl_lock.text = ""
		return
	_lock_box.locked = p >= 1.0
	_lock_box.position = cam.unproject_position(target.global_position) - Vector2(32, 32)
	_lock_box.visible = true
	_lock_box.queue_redraw()
	if p >= 1.0:
		_lbl_lock.text = "◉ LOCKED"
		_lbl_lock.add_theme_color_override("font_color", Color8(0xff, 0x33, 0x33))
	else:
		_lbl_lock.text = "◌ %.2fs" % ((1.0 - p) * GameConfig.LOCK_TIME)
		_lbl_lock.add_theme_color_override("font_color", Color8(0xff, 0xcc, 0x44))


var _hud_t := 0.0


func _process(delta: float) -> void:
	if jet == null:
		return
	# Texto/format a 10 Hz (perf Wave B) — era string building a cada frame
	_hud_t -= delta
	if _hud_t > 0.0:
		return
	_hud_t = 0.1
	var act := ""
	if GameState.campaign_act == 1:
		act = "ATO 1 — SALVAR INHAÚMA"
	elif GameState.campaign_act == 2:
		act = "ATO 2 — LIBERTE CACHOEIRA"
	_lbl_mission.text = "%s\nVIDAS %s   DANO %s" % [
		act, "♥".repeat(maxi(GameState.lives, 0)), "■".repeat(maxi(jet.hp, 0))]
	_lbl_score.text = "SCORE %d   ALVOS %d/%d" % [
		GameState.score, GameState.targets_destroyed, GameState.targets_total]
	_lbl_weapons.text = "MSLS ∞   HVY %d   ☢ %d   R %d" % [
		GameState.heavy_missiles, GameState.nukes, GameState.rods]
	var alt := jet.position.y
	_lbl_flight.text = "SPD %.0f   THR %d%%   ALT %.0f m" % [
		jet.speed, roundi(jet.throttle * 100.0), alt]
	_lbl_warn.text = "⚠ STALL" if jet.stalled and alt > 120.0 else ""


func show_message(text: String, seconds: float = 3.0) -> void:
	_lbl_msg.text = text
	var tw := create_tween()
	tw.tween_interval(seconds)
	tw.tween_callback(func(): _lbl_msg.text = "")


func _make_label(pos: Vector2, align: HorizontalAlignment) -> Label:
	var l := Label.new()
	l.position = pos
	l.horizontal_alignment = align
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE # não engolir o mouse-look
	l.add_theme_font_size_override("font_size", 20)
	l.add_theme_color_override("font_color", Color(0.85, 1.0, 0.85))
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("shadow_offset_x", 2)
	l.add_theme_constant_override("shadow_offset_y", 2)
	add_child(l)
	return l


## Retícula fixa do canhão (web crosshair.js:49-56): círculo r14 + ponto
## central r3 + 4 ticks (14→22 px), branca 85%, no centro da tela.
class CannonReticle:
	extends Control

	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		anchor_left = 0.5
		anchor_right = 0.5
		anchor_top = 0.5
		anchor_bottom = 0.5
		custom_minimum_size = Vector2(44, 44)
		size = Vector2(44, 44)
		position = Vector2(-22, -22)

	func _draw() -> void:
		var c := Vector2(22, 22)
		var col := Color(1, 1, 1, 0.85)
		draw_arc(c, 14, 0, TAU, 32, col, 1.5)
		draw_circle(c, 3, Color(1, 1, 1, 0.9))
		for d in [Vector2(0, -1), Vector2(0, 1), Vector2(-1, 0), Vector2(1, 0)]:
			draw_line(c + d * 14, c + d * 22, col, 1.5)


## Caixa de lock 52×52 + 4 ticks externos (web crosshair.js:64-72): amarela
## TRACEJADA #ffcc44 procurando → SÓLIDA vermelha #ff3333 travado.
class LockBox:
	extends Control

	var locked := false

	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		custom_minimum_size = Vector2(64, 64)
		size = Vector2(64, 64)
		visible = false

	func _draw() -> void:
		var c := Vector2(32, 32)
		var col := Color8(0xff, 0x33, 0x33) if locked else Color8(0xff, 0xcc, 0x44)
		if locked:
			draw_rect(Rect2(c - Vector2(26, 26), Vector2(52, 52)), col, false, 2.0)
		else:
			for side in [
				[Vector2(-1, -1), Vector2(1, -1)], [Vector2(1, -1), Vector2(1, 1)],
				[Vector2(1, 1), Vector2(-1, 1)], [Vector2(-1, 1), Vector2(-1, -1)],
			]:
				_dashed_line(c + side[0] * 26.0, c + side[1] * 26.0, col)
		for d in [Vector2(0, -1), Vector2(0, 1), Vector2(-1, 0), Vector2(1, 0)]:
			draw_line(c + d * 22, c + d * 32, col, 2.0)

	# Traço 8 px / espaço 4 px (stroke-dasharray 8 4 do web)
	func _dashed_line(a: Vector2, b: Vector2, col: Color) -> void:
		var len := a.distance_to(b)
		var n := int(len / 12.0) + 1
		for i in n:
			var t0 := i * 12.0 / len
			var t1 := minf((i * 12.0 + 8.0) / len, 1.0)
			if t0 < 1.0:
				draw_line(a.lerp(b, t0), a.lerp(b, t1), col, 2.0)

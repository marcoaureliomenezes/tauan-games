class_name DefenseHud
extends CanvasLayer
## DefenseHud — HUD do modo defesa (port do overlay inhauma-defense):
## SCORE, INHAÚMA %, HEAT em 8 degraus + ⚠OVERHEAT, AA n ↻, ARMA, vidas/HP,
## quadrado de lock projetado sobre o caça (46→20 px), "⚠ MÍSSIL INCOMING".

var turret: AaTurret
var director: DefenseDirector

var _lbl_score: Label
var _lbl_city: Label
var _lbl_heat: Label
var _lbl_weapon: Label
var _lbl_hp: Label
var _lbl_warn: Label
var _lbl_msg: Label
var _lbl_heading: Label
var _lock_rect: Panel
var _lock_sb: StyleBoxFlat
var minimap: MinimapHud
var _hit_rect: ColorRect
var _chevrons: ChevronLayer


func _ready() -> void:
	_lbl_score = _label(Vector2(16, 12), HORIZONTAL_ALIGNMENT_LEFT)
	_lbl_city = _label(Vector2(16, 40), HORIZONTAL_ALIGNMENT_LEFT)
	_lbl_hp = _label(Vector2(16, 68), HORIZONTAL_ALIGNMENT_LEFT)
	_lbl_heat = _label(Vector2(-316, 12), HORIZONTAL_ALIGNMENT_RIGHT)
	_lbl_heat.anchor_left = 1.0
	_lbl_heat.anchor_right = 1.0
	_lbl_weapon = _label(Vector2(-316, 40), HORIZONTAL_ALIGNMENT_RIGHT)
	_lbl_weapon.anchor_left = 1.0
	_lbl_weapon.anchor_right = 1.0
	_lbl_warn = _label(Vector2(0, -160), HORIZONTAL_ALIGNMENT_CENTER)
	_lbl_warn.anchor_left = 0.5
	_lbl_warn.anchor_right = 0.5
	_lbl_warn.anchor_top = 0.5
	_lbl_warn.anchor_bottom = 0.5
	_lbl_warn.add_theme_color_override("font_color", Color(1, 0.25, 0.2))
	_lbl_warn.add_theme_font_size_override("font_size", 26)
	_lbl_msg = _label(Vector2(0, -240), HORIZONTAL_ALIGNMENT_CENTER)
	_lbl_msg.anchor_left = 0.5
	_lbl_msg.anchor_right = 0.5
	_lbl_msg.anchor_top = 0.5
	_lbl_msg.anchor_bottom = 0.5
	_lbl_msg.add_theme_font_size_override("font_size", 42)
	# Faixa de rumo (Wave L6): proa da mira em graus + cardeal mais próximo,
	# topo-centro — "está muito ruim para identificar as direções"
	_lbl_heading = _label(Vector2(0, 8), HORIZONTAL_ALIGNMENT_CENTER)
	_lbl_heading.anchor_left = 0.5
	_lbl_heading.anchor_right = 0.5
	_lbl_heading.add_theme_font_size_override("font_size", 22)
	_lbl_heading.add_theme_color_override("font_color", Color(1.0, 0.95, 0.6))
	# Retículo central
	var cross := Label.new()
	cross.text = "+"
	cross.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cross.add_theme_font_size_override("font_size", 30)
	cross.add_theme_color_override("font_color", Color(0.9, 0.9, 0.9, 0.85))
	cross.anchor_left = 0.5
	cross.anchor_right = 0.5
	cross.anchor_top = 0.5
	cross.anchor_bottom = 0.5
	cross.position = Vector2(-9, -20)
	add_child(cross)
	# Quadrado de lock (borda 2 px sem fill, fecha 46→20 px sobre o alvo)
	_lock_rect = Panel.new()
	_lock_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_lock_sb = StyleBoxFlat.new()
	_lock_sb.draw_center = false
	_lock_sb.border_width_left = 2
	_lock_sb.border_width_top = 2
	_lock_sb.border_width_right = 2
	_lock_sb.border_width_bottom = 2
	_lock_rect.add_theme_stylebox_override("panel", _lock_sb)
	_lock_rect.visible = false
	add_child(_lock_rect)
	# Minimapa
	minimap = MinimapHud.new()
	add_child(minimap)
	# Vinheta de dano (K5): flash vermelho em tela cheia ao levar hit
	_hit_rect = ColorRect.new()
	_hit_rect.color = Color(1, 0.1, 0.05, 0.0)
	_hit_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_hit_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_hit_rect)
	# Chevrons de borda (K7)
	_chevrons = ChevronLayer.new()
	add_child(_chevrons)


## Flash de dano (0,45 s) — chamado pelo signal player_hit da bateria.
func show_hit_flash() -> void:
	_hit_rect.color = Color(1, 0.1, 0.05, 0.38)
	var tw := create_tween()
	tw.tween_property(_hit_rect, "color:a", 0.0, 0.45)


var _hud_t := 0.0


func _process(delta: float) -> void:
	if turret == null:
		return
	# Texto/format a 10 Hz (perf Wave B) — era string building a cada frame
	_hud_t -= delta
	if _hud_t > 0.0:
		return
	_hud_t = 0.1
	_lbl_score.text = "SCORE %d" % GameState.score
	var pct := int(GameState.city_integrity * 100.0)
	_lbl_city.text = "INHAÚMA %d%%" % pct
	_lbl_city.add_theme_color_override("font_color",
		Color(0.4, 0.7, 1) if pct > 60 else (Color(1, 0.85, 0.3) if pct > 30 else Color(1, 0.3, 0.25)))
	_lbl_hp.text = "VIDAS %s   HP %s" % ["♥".repeat(maxi(turret.lives, 0)), "■".repeat(maxi(turret.hp, 0))]
	var blocks := int(turret.heat * 8.0)
	_lbl_heat.text = "HEAT %s%s" % ["▮".repeat(blocks) + "▯".repeat(8 - blocks),
		"  ⚠OVERHEAT" if turret.overheated else ""]
	_lbl_heat.add_theme_color_override("font_color", Color(1, 0.4, 0.2) if turret.overheated else Color(0.85, 1, 0.85))
	var nuke_txt := "   ☢ %ds" % int(ceil(turret.nuke_cd)) if turret.nuke_cd > 0.0 else "   ☢ OK"
	_lbl_weapon.text = "AA %d ↻   ARMA: %s%s" % [turret.aa_stock,
		"MÍSSIL AA" if turret.weapon == 1 else ".50", nuke_txt]
	# Rumo da mira (frente = (-sin yaw, -cos yaw); 0°=N, 90°=Leste)
	var fwd := Vector2(-sin(turret.yaw), -cos(turret.yaw))
	var deg := wrapf(rad_to_deg(atan2(fwd.x, -fwd.y)), 0.0, 360.0)
	const CARDAIS := ["N", "NE", "L", "SE", "S", "SO", "O", "NO"]
	_lbl_heading.text = "%03d° %s" % [int(deg), CARDAIS[int((deg + 22.5) / 45.0) % 8]]
	# Aviso: horda (pisca, com ETA) tem prioridade sobre míssil incoming
	var warn := ""
	if director and director.horde() != null:
		if int(Time.get_ticks_msec() / 280) % 2 == 0:
			warn = "⚠ HORDA NO HORIZONTE — %ds" % int(director.horde_eta())
	elif director and director.incoming_threat():
		warn = "⚠ MÍSSIL INCOMING"
	_lbl_warn.text = warn
	# K7: chevrons de borda — horda (laranja) + caça anti-jogador (vermelho)
	var pts: Array = []
	if director and director.horde() != null:
		pts.append({"pos": director.horde().centroid(), "color": Color(1.0, 0.6, 0.15)})
	if director:
		var anti: Node3D = null
		var anti_d := INF
		for f in director.fighters:
			if not is_instance_valid(f) or f.dead or f.target_kind != "player":
				continue
			var d: float = f.global_position.distance_squared_to(turret.global_position)
			if d < anti_d:
				anti_d = d
				anti = f
		if anti:
			pts.append({"pos": anti.global_position, "color": Color(1.0, 0.25, 0.2)})
	_chevrons.points = pts


## Chevrons de borda para ameaças fora da tela (K7 — pedido do operador,
## desvio deliberado do web): triângulo na borda apontando para a ameaça.
class ChevronLayer:
	extends Control

	var points: Array = []

	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		set_anchors_preset(Control.PRESET_FULL_RECT)

	func _process(_delta: float) -> void:
		queue_redraw()

	func _draw() -> void:
		var cam := get_viewport().get_camera_3d()
		if cam == null:
			return
		var center := size * 0.5
		for p in points:
			var wp: Vector3 = p.pos
			var sp := cam.unproject_position(wp)
			var behind := cam.is_position_behind(wp)
			var on_screen := not behind and sp.x >= 0 and sp.x <= size.x and sp.y >= 0 and sp.y <= size.y
			if on_screen:
				continue
			var dir := sp - center
			if behind:
				dir = -dir
			if dir.length() < 1.0:
				dir = Vector2(0, -1)
			dir = dir.normalized()
			var edge := center + dir * (minf(center.x, center.y) * 0.86)
			var perp := Vector2(-dir.y, dir.x)
			var tri := PackedVector2Array([edge + dir * 14.0, edge - dir * 8.0 + perp * 8.0,
				edge - dir * 8.0 - perp * 8.0])
			draw_colored_polygon(tri, p.color)


## Quadrado de lock projetado sobre o caça a cada frame (mira por FASES,
## T-W-08): amarelo #ffe08a nas fases amarelas, vermelho #ff5544 na vermelha;
## fecha 46→20 px com a fração do ciclo (phaseT/4,5); escondido sem candidato
## ou com o alvo atrás da câmera.
func set_lock_progress(target: Node3D, p: float, red: bool) -> void:
	if target == null or not is_instance_valid(target):
		_lock_rect.visible = false
		return
	var cam := get_viewport().get_camera_3d()
	if cam == null or cam.is_position_behind(target.global_position):
		_lock_rect.visible = false
		return
	var size := lerpf(GameConfig.AAMSL_LOCK_BOX_FROM, GameConfig.AAMSL_LOCK_BOX_TO, p)
	_lock_rect.position = cam.unproject_position(target.global_position) - Vector2(size, size) * 0.5
	_lock_rect.size = Vector2(size, size)
	_lock_sb.border_color = Color8(0xff, 0x55, 0x44) if red else Color8(0xff, 0xe0, 0x8a)
	_lock_rect.visible = true


func show_message(text: String, seconds: float = 3.0) -> void:
	_lbl_msg.text = text
	var tw := create_tween()
	tw.tween_interval(seconds)
	tw.tween_callback(func(): _lbl_msg.text = "")


func _label(pos: Vector2, align: HorizontalAlignment) -> Label:
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

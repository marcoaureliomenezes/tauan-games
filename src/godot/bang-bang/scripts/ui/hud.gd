# hud.gd — HUD (SPEC §7): barras HP/STA/COMIDA, arma+munição, contador de
# bandidos, prompt contextual [E], flash de dano, indicador de carcaça.
class_name BangHud
extends CanvasLayer

var bars := {}
var weapon_label: Label
var crosshair: Label
var bandits_label: Label
var prompt_label: Label
var flash: ColorRect
var _hp_prev := 100.0

func _ready() -> void:
	var root_v := VBoxContainer.new()
	root_v.set_anchors_preset(Control.PRESET_TOP_LEFT)
	root_v.position = Vector2(14, 12)
	add_child(root_v)
	for spec in [["hp", "HP", Color(0.9, 0.25, 0.2)], ["stamina", "STA", Color(0.25, 0.75, 0.4)], ["food", "COMIDA", Color(0.9, 0.7, 0.2)]]:
		var row := HBoxContainer.new()
		var name_l := Label.new()
		name_l.text = spec[1] + " "
		name_l.add_theme_font_size_override("font_size", 16)
		row.add_child(name_l)
		var bar := ProgressBar.new()
		bar.max_value = 100
		bar.value = 100
		bar.custom_minimum_size = Vector2(150, 14)
		bar.show_percentage = false
		row.add_child(bar)
		root_v.add_child(row)
		bars[spec[0]] = bar
	weapon_label = Label.new()
	weapon_label.add_theme_font_size_override("font_size", 18)
	root_v.add_child(weapon_label)
	bandits_label = Label.new()
	bandits_label.add_theme_font_size_override("font_size", 18)
	root_v.add_child(bandits_label)
	# mira discreta no centro da tela (não se move com o mouse)
	crosshair = Label.new()
	crosshair.text = "+"
	crosshair.modulate = Color(1, 1, 1, 0.55)
	crosshair.add_theme_font_size_override("font_size", 22)
	crosshair.set_anchors_preset(Control.PRESET_CENTER)
	crosshair.position -= Vector2(6, 12)
	add_child(crosshair)
	prompt_label = Label.new()
	prompt_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	prompt_label.position = Vector2(-140, -70)
	prompt_label.add_theme_font_size_override("font_size", 20)
	add_child(prompt_label)
	flash = ColorRect.new()
	flash.color = Color(1, 0, 0, 0)
	flash.set_anchors_preset(Control.PRESET_FULL_RECT)
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(flash)
	print("HUD_READY")

func _process(dt: float) -> void:
	var g = get_node_or_null("/root/Game")
	if g == null:
		return
	bars["hp"].value = g.player["hp"]
	bars["stamina"].value = g.player["stamina"]
	bars["food"].value = g.player["food"]
	var wname := "REVÓLVER" if g.player["weapon"] == &"revolver" else "ESPINGARDA 12"
	var ammo := "∞" if g.player["weapon"] == &"shotgun" else ("%d/8%s" % [g.player["revolver_ammo"], " (recarregando…)" if g.player["reloading"] else ""])
	weapon_label.text = "%s  %s" % [wname, ammo]
	bandits_label.text = "BANDIDOS: %d/%d%s" % [g.bandits_captured, g.BANDITS_TOTAL, "  🦌 carregando" if g.player["carrying"] else ""]
	# indicador de mira travada [F]
	var lk: StringName = g.player.get("lock_name", &"")
	if lk != &"":
		bandits_label.text += "   🎯 MIRA: " + str(lk)
	# prompt contextual
	var prompt := ""
	if g.player["carrying"]:
		prompt = "[E] entregar caça na fogueira"
	elif g.player["hp"] < _hp_prev - 0.5:
		pass
	prompt_label.text = prompt
	# flash de dano
	if g.player["hp"] < _hp_prev - 0.5:
		flash.color = Color(1, 0, 0, 0.35)
	_hp_prev = g.player["hp"]
	flash.color.a = maxf(0.0, flash.color.a - dt * 1.2)

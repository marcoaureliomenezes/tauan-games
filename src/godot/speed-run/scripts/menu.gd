extends Control
## Menu principal: escolha da VISÃO (corrida ou perseguição) e da rota A→B.

var _mode_buttons := {}

@onready var list: VBoxContainer = %TrackList
@onready var mode_row: HBoxContainer = %ModeRow
@onready var subtitle: Label = %Subtitle


func _ready() -> void:
	for mode: Array in [
		[GameState.MODE_RACE, "🏁 Corrida"], [GameState.MODE_CHASE, "🚨 Perseguição"]
	]:
		var btn := Button.new()
		btn.text = mode[1]
		btn.toggle_mode = true
		btn.add_theme_font_size_override("font_size", 24)
		btn.pressed.connect(_set_mode.bind(mode[0]))
		mode_row.add_child(btn)
		_mode_buttons[mode[0]] = btn
	_set_mode(GameState.selected_mode)
	for key: String in GameState.ROUTES:
		var btn := Button.new()
		btn.text = GameState.ROUTES[key]["title"]
		btn.add_theme_font_size_override("font_size", 26)
		btn.pressed.connect(_start.bind(key))
		list.add_child(btn)
	if OS.get_environment("CORRIDA_TEST") == "1":
		var wanted_mode := OS.get_environment("CORRIDA_MODE")
		if wanted_mode in [GameState.MODE_RACE, GameState.MODE_CHASE]:
			_set_mode(wanted_mode)
		var wanted := OS.get_environment("CORRIDA_TRACK")
		_start.call_deferred(wanted if wanted in GameState.ROUTES else "serra")


func _set_mode(mode: String) -> void:
	GameState.selected_mode = mode
	for key: String in _mode_buttons:
		_mode_buttons[key].button_pressed = key == mode
	subtitle.text = (
		"Corra de cidade em cidade contra os rivais"
		if mode == GameState.MODE_RACE
		else "Fuja da polícia e chegue vivo à próxima cidade"
	)


func _start(track_key: String) -> void:
	GameState.selected_track = track_key
	get_tree().change_scene_to_file("res://scenes/race.tscn")

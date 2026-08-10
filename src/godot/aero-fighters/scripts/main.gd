extends Node3D
## Main — entry point. Orquestrador: seleção de mapa/modo → instancia o modo.
## Equivalente ao main.js do web-game (window.selectMap).

const MODES := {
	"inhauma_attack": "res://scenes/modes/flight_mode.tscn",
	"inhauma_defense": "res://scenes/modes/defense_mode.tscn",
}

@onready var _map_select: Control = $UI/MapSelect


func _ready() -> void:
	GameState.mode = GameState.Mode.MAP_SELECT
	$UI/MapSelect/Panel/VBox/BtnAttack.pressed.connect(select_map.bind("inhauma_attack"))
	$UI/MapSelect/Panel/VBox/BtnDefense.pressed.connect(select_map.bind("inhauma_defense"))


## Equivalente a window.selectMap(mapKey) do web-game.
func select_map(map_key: String) -> void:
	GameState.reset_state()
	GameState.map_key = map_key
	var scene_path: String = MODES.get(map_key, "")
	if scene_path.is_empty() or not ResourceLoader.exists(scene_path):
		push_warning("Modo '%s' ainda não implementado (%s)" % [map_key, scene_path])
		$UI/MapSelect/Panel/VBox/Status.text = "Modo '%s' em construção" % map_key
		return
	_map_select.hide()
	# O mapa tem o próprio sol animado — apaga o sol estático do menu (perf:
	# dois DirectionalLight3D com sombra = 2× shadow pass em iGPU)
	$Sun.visible = false
	var mode_scene: Node = load(scene_path).instantiate()
	add_child(mode_scene)
	GameState.running = true

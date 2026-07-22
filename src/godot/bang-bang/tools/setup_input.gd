# setup_input.gd — grava o input map da SPEC §3 em project.godot (roda 1×).
# Uso: godot4 --headless --path src/godot/bang-bang -s res://tools/setup_input.gd
extends SceneTree

const ACTIONS := {
	"move_forward": [KEY_W],
	"move_back": [KEY_S],
	"turn_left": [KEY_A],
	"turn_right": [KEY_D],
	"gallop": [KEY_SHIFT],
	"jump": [KEY_SPACE],
	"ads": [KEY_F],
	"reload": [KEY_R],
	"weapon_1": [KEY_1],
	"weapon_2": [KEY_2],
	"weapon_toggle": [KEY_Q],
	"interact": [KEY_E],
	"map": [KEY_M],
	"camera_toggle": [KEY_V],
	"pause": [KEY_ESCAPE],
}

const MOUSE_ACTIONS := {
	"fire": MOUSE_BUTTON_LEFT,
}

func _init() -> void:
	for action in ACTIONS:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		for key in ACTIONS[action]:
			var exists := false
			for e in InputMap.action_get_events(action):
				if e is InputEventKey and e.physical_keycode == key:
					exists = true
			if not exists:
				var ev := InputEventKey.new()
				ev.physical_keycode = key
				InputMap.action_add_event(action, ev)
	for action in MOUSE_ACTIONS:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		var exists := false
		for e in InputMap.action_get_events(action):
			if e is InputEventMouseButton and e.button_index == MOUSE_ACTIONS[action]:
				exists = true
		if not exists:
			var ev := InputEventMouseButton.new()
			ev.button_index = MOUSE_ACTIONS[action]
			InputMap.action_add_event(action, ev)
	var err := ProjectSettings.save()
	print("INPUT_MAP_SAVED err=", err, " actions=", InputMap.get_actions().size())
	quit()

## minimap.gd — Radar/minimap overlay drawn via SubViewport or Control.
## Shows player position and active targets as dots.
extends Control

const MAP_SIZE: float = 120.0   # pixel size of minimap
const WORLD_SCALE: float = 0.025 # 1 world unit = 0.025 minimap pixels
const PLAYER_DOT_SIZE: float = 5.0
const TARGET_DOT_SIZE: float = 3.0

# Position: bottom-right corner
const MARGIN: float = 12.0

func _ready() -> void:
	set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	position = Vector2(-MAP_SIZE - MARGIN, -MAP_SIZE - MARGIN)
	size = Vector2(MAP_SIZE, MAP_SIZE)

func _draw() -> void:
	# Background
	draw_rect(Rect2(Vector2.ZERO, Vector2(MAP_SIZE, MAP_SIZE)), Color(0.0, 0.0, 0.0, 0.55))
	draw_rect(Rect2(Vector2.ZERO, Vector2(MAP_SIZE, MAP_SIZE)), Color(0.3, 1.0, 0.4, 0.4), false, 1.5)

	var half: float = MAP_SIZE * 0.5
	var player_node = MissionManager.player_node
	if not player_node or not is_instance_valid(player_node):
		return
	var player_pos: Vector3 = player_node.global_position

	# Targets (red dots)
	for t in MissionManager.active_targets:
		if not is_instance_valid(t):
			continue
		var tp: Vector3 = t.global_position
		var dx: float = (tp.x - player_pos.x) * WORLD_SCALE + half
		var dz: float = (tp.z - player_pos.z) * WORLD_SCALE + half
		if dx >= 0 and dx <= MAP_SIZE and dz >= 0 and dz <= MAP_SIZE:
			draw_circle(Vector2(dx, dz), TARGET_DOT_SIZE, Color(1.0, 0.2, 0.2, 0.9))

	# Player (green dot at center)
	draw_circle(Vector2(half, half), PLAYER_DOT_SIZE, Color(0.2, 1.0, 0.4, 1.0))

func _process(_delta: float) -> void:
	queue_redraw()

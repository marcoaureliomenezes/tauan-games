class_name MinimapHud
extends Control
## MinimapHud — minimapa 180 px (port de ui/minimap.js): fundo verde escuro,
## raio 2.000 m, jogador (seta), alvos (vermelho), aeroporto (branco),
## Inhaúma (azul), Cachoeira (laranja).

const SIZE := 180.0
const RANGE := 2000.0

var director: Node = null # DefenseDirector (modo defesa) — blips dos caças

var _redraw_t := 0.0


func _ready() -> void:
	custom_minimum_size = Vector2(SIZE, SIZE)
	size = Vector2(SIZE, SIZE)
	anchor_left = 1.0
	anchor_right = 1.0
	anchor_top = 1.0
	anchor_bottom = 1.0
	offset_left = -SIZE - 12
	offset_top = -SIZE - 12
	offset_right = -12
	offset_bottom = -12
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _process(delta: float) -> void:
	# Redraw a 10 Hz (perf Wave B) — era queue_redraw() a cada frame
	_redraw_t -= delta
	if _redraw_t > 0.0:
		return
	_redraw_t = 0.1
	queue_redraw()


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, Vector2(SIZE, SIZE)), Color(0.05, 0.12, 0.05, 0.75))
	draw_rect(Rect2(Vector2.ZERO, Vector2(SIZE, SIZE)), Color(0.3, 0.6, 0.3, 0.9), false, 2.0)
	var player: Node3D = GameState.player
	if player == null:
		return
	var center := Vector2(SIZE, SIZE) * 0.5
	var pp := Vector2(player.global_position.x, player.global_position.z)
	var to_map: Callable = func(wx: float, wz: float) -> Vector2:
		return center + (Vector2(wx, wz) - pp) / RANGE * (SIZE * 0.5)
	# Aeroporto (traço branco)
	var ap: Vector2 = to_map.call(GameConfig.AIRPORT_POS.x, GameConfig.AIRPORT_POS.y)
	draw_line(ap + Vector2(-4, 0), ap + Vector2(4, 0), Color.WHITE, 2.0)
	# Inhaúma (azul) e Cachoeira (laranja)
	_dot(to_map.call(GameConfig.MAP_DOWNTOWN.x, GameConfig.MAP_DOWNTOWN.y), Color(0.4, 0.6, 1.0), 3.0)
	_dot(to_map.call(GameConfig.CACHOEIRA_CENTER.x, GameConfig.CACHOEIRA_CENTER.y), Color(1.0, 0.6, 0.2), 3.0)
	# Alvos (vermelho)
	for t in GameState.targets:
		if t.dead:
			continue
		var d: Vector2 = to_map.call(t.global_position.x, t.global_position.z)
		if (d - center).length() < SIZE * 0.52:
			_dot(d, Color(1.0, 0.25, 0.2), 2.5)
	# Caças inimigos do modo defesa (vermelho-vivo)
	if director != null:
		for f in director.fighters:
			if not is_instance_valid(f) or f.dead:
				continue
			var d: Vector2 = to_map.call(f.global_position.x, f.global_position.z)
			if (d - center).length() < SIZE * 0.52:
				_dot(d, Color(1.0, 0.35, 0.15), 2.5)
		# Horda terrestre (marrom-laranja, distinta dos caças)
		if director.has_method("horde") and director.horde() != null:
			for p in director.horde().blip_positions():
				var d: Vector2 = to_map.call(p.x, p.z)
				if (d - center).length() < SIZE * 0.52:
					_dot(d, Color(0.85, 0.55, 0.25), 2.0)
	# Letras cardinais nas bordas (Wave L6 — legibilidade de direção; o mapa é
	# norte-up: -z = N em cima, +x = Leste à direita)
	var font := ThemeDB.fallback_font
	var fc := Color(0.95, 0.95, 0.85, 0.95)
	draw_string(font, Vector2(center.x - 4, 14), "N", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, fc)
	draw_string(font, Vector2(center.x - 4, SIZE - 6), "S", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, fc)
	draw_string(font, Vector2(SIZE - 14, center.y + 5), "L", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, fc)
	draw_string(font, Vector2(7, center.y + 5), "O", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, fc)
	# Jogador (seta na direção do heading)
	var fwd := -player.global_basis.z
	var dir := Vector2(fwd.x, fwd.z).normalized()
	var tip := center + dir * 8.0
	var side := Vector2(-dir.y, dir.x) * 4.0
	draw_colored_polygon(PackedVector2Array([tip, center - dir * 6.0 + side, center - dir * 3.0,
		center - dir * 6.0 - side]), Color(0.4, 1.0, 0.4))


func _dot(at: Vector2, color: Color, r: float) -> void:
	draw_circle(at, r, color)

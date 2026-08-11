# map.gd — mapa fullscreen [M] (relevo hipsométrico + rios/lago + marcadores
# vivos) e minimapa circular (SPEC §7).
class_name BangMap
extends CanvasLayer

const TEX_SIZE := 256

var gen: Dictionary = {}
var texture: ImageTexture
var fullscreen: Control
var mini: Control
var _markers := {}   # name → ColorRect (fullscreen)
var _mini_markers := {}
var entities: Node = null
var settlements: Node = null
var rider: Node3D = null
var railway: Node = null

func setup(p_gen: Dictionary, p_entities: Node, p_settlements: Node, p_rider: Node3D, p_railway: Node) -> void:
	gen = p_gen
	entities = p_entities
	settlements = p_settlements
	rider = p_rider
	railway = p_railway
	_build_texture()
	_build_fullscreen()
	_build_minimap()

# mundo (-1024..1024) → pixels do mapa (0..TEX_SIZE)
func world_to_map(x: float, z: float) -> Vector2:
	return Vector2((x + 1024.0) / 2048.0 * TEX_SIZE, (z + 1024.0) / 2048.0 * TEX_SIZE)

func _build_texture() -> void:
	var img := Image.create(TEX_SIZE, TEX_SIZE, false, Image.FORMAT_RGB8)
	var grid: int = gen["grid"]
	var h_min := 999.0
	var h_max := -999.0
	for h in gen["heights"]:
		h_min = minf(h_min, h)
		h_max = maxf(h_max, h)
	for py in range(TEX_SIZE):
		for px in range(TEX_SIZE):
			var gx := int(float(px) / TEX_SIZE * (grid - 1))
			var gz := int(float(py) / TEX_SIZE * (grid - 1))
			var h: float = gen["heights"][gz * grid + gx]
			var t := clampf((h - h_min) / maxf(h_max - h_min, 0.01), 0.0, 1.0)
			var c := Color(0.2, 0.45, 0.2).lerp(Color(0.55, 0.45, 0.3), smoothstep(0.15, 0.6, t))
			if t > 0.75:
				c = c.lerp(Color(0.85, 0.85, 0.9), smoothstep(0.75, 0.95, t))
			img.set_pixel(px, py, c)
	# rios em azul
	for r in gen["rivers"]:
		for p in r["points"]:
			var m := world_to_map(p.x - 1024, p.y - 1024)
			for dy in range(-1, 2):
				for dx in range(-1, 2):
					img.set_pixel(int(m.x) + dx, int(m.y) + dy, Color(0.15, 0.35, 0.65))
	# lago
	var lc: Vector2 = gen["lake_center"]
	var lm := world_to_map(lc.x - 1024, lc.y - 1024)
	for dy in range(-4, 5):
		for dx in range(-4, 5):
			if dx * dx + dy * dy <= 16:
				img.set_pixel(int(lm.x) + dx, int(lm.y) + dy, Color(0.1, 0.3, 0.6))
	texture = ImageTexture.create_from_image(img)
	print("MAP_TEXTURE_BUILT")

func _marker(parent: Control, color: Color, size := 6) -> ColorRect:
	var m := ColorRect.new()
	m.color = color
	m.custom_minimum_size = Vector2(size, size)
	parent.add_child(m)
	return m

func _build_fullscreen() -> void:
	fullscreen = Control.new()
	fullscreen.set_anchors_preset(Control.PRESET_FULL_RECT)
	fullscreen.visible = false
	add_child(fullscreen)
	var bg := ColorRect.new()
	bg.color = Color(0, 0, 0, 0.85)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	fullscreen.add_child(bg)
	var tr := TextureRect.new()
	tr.texture = texture
	tr.set_anchors_preset(Control.PRESET_CENTER)
	tr.custom_minimum_size = Vector2(640, 640)
	tr.position = Vector2(-320, -320)
	tr.stretch_mode = TextureRect.STRETCH_SCALE
	fullscreen.add_child(tr)
	var layer := Control.new()
	tr.add_child(layer)
	layer.name = "Markers"
	_markers["player"] = _marker(layer, Color(0.3, 1, 0.6))
	_markers["camp"] = _marker(layer, Color(1, 0.6, 0.2))
	for i in range(2):
		_markers["town%d" % i] = _marker(layer, Color(0.9, 0.9, 0.3))
		_markers["village%d" % i] = _marker(layer, Color(0.9, 0.4, 0.3))
	for i in range(5):
		_markers["bandit%d" % i] = _marker(layer, Color(1, 0.1, 0.1), 5)
	_markers["train"] = _marker(layer, Color(0.8, 0.8, 0.8), 5)

func _build_minimap() -> void:
	mini = Control.new()
	add_child(mini)
	var tr := TextureRect.new()
	tr.texture = texture
	tr.custom_minimum_size = Vector2(180, 180)
	tr.stretch_mode = TextureRect.STRETCH_SCALE
	mini.add_child(tr)
	mini.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	mini.position = Vector2(-196, -196)
	var layer := Control.new()
	tr.add_child(layer)
	layer.name = "Markers"
	_mini_markers["player"] = _marker(layer, Color(0.3, 1, 0.6), 5)
	_mini_markers["camp"] = _marker(layer, Color(1, 0.6, 0.2), 5)

func _place(m: ColorRect, x: float, z: float, scale_factor: float) -> void:
	var p := world_to_map(x, z) * scale_factor
	m.position = p - m.custom_minimum_size * 0.5

func _process(_dt: float) -> void:
	var g = get_node_or_null("/root/Game")
	if g == null or rider == null:
		return
	if Input.is_action_just_pressed("map"):
		fullscreen.visible = not fullscreen.visible
	# fullscreen (640 px = 2.5× o TEX_SIZE)
	var fs := 640.0 / TEX_SIZE
	_place(_markers["player"], rider.global_position.x, rider.global_position.z, fs)
	var camp: Vector3 = settlements.sites["camp"]
	_place(_markers["camp"], camp.x, camp.z, fs)
	for i in range(2):
		_place(_markers["town%d" % i], settlements.sites["towns"][i].x, settlements.sites["towns"][i].z, fs)
		_place(_markers["village%d" % i], settlements.sites["villages"][i].x, settlements.sites["villages"][i].z, fs)
	for i in range(min(5, entities.bandits.size())):
		var m: ColorRect = _markers["bandit%d" % i]
		if i < entities.bandits.size() and is_instance_valid(entities.bandits[i]):
			m.visible = true
			_place(m, entities.bandits[i].global_position.x, entities.bandits[i].global_position.z, fs)
		else:
			m.visible = false
	if railway:
		_place(_markers["train"], railway.train_pos.x, railway.train_pos.z, fs)
	# minimapa (180 px ≈ 0.703×)
	var ms := 180.0 / TEX_SIZE
	_place(_mini_markers["player"], rider.global_position.x, rider.global_position.z, ms)
	_place(_mini_markers["camp"], camp.x, camp.z, ms)

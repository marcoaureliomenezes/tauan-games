# make_terrain_textures.gd — gera PNGs tileáveis (grama/terra/rocha) em
# res://assets/textures/terrain/. Rodar UMA vez: godot4 --headless --path . -s res://tools/make_terrain_textures.gd
extends SceneTree

func _init() -> void:
	DirAccess.make_dir_recursive_absolute("res://assets/textures/terrain")
	_make("grass", Color(0.44, 0.43, 0.20), Color(0.55, 0.51, 0.24), Color(0.42, 0.36, 0.18), 101)  # capim seco de pradaria
	_make("dirt", Color(0.42, 0.32, 0.20), Color(0.52, 0.42, 0.28), Color(0.36, 0.26, 0.16), 202)
	_make("rock", Color(0.42, 0.40, 0.38), Color(0.55, 0.53, 0.50), Color(0.32, 0.30, 0.29), 303)
	print("TERRAIN_TEXTURES_DONE")
	quit()

# blobs com distância modular → tileável sem costura
func _make(name: String, c0: Color, c1: Color, c2: Color, seed_: int) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_
	var size := 256
	var acc: Array = []
	acc.resize(size * size)
	for i in range(size * size):
		acc[i] = Vector3(c0.r, c0.g, c0.b)
	for i in range(2600):
		var cx := rng.randf() * size
		var cy := rng.randf() * size
		var r := rng.randf_range(2.0, 9.0)
		var col := c1 if rng.randf() < 0.8 else c2
		var str_ := rng.randf_range(0.25, 0.6)
		var ri := int(ceil(r))
		for dy in range(-ri, ri + 1):
			for dx in range(-ri, ri + 1):
				var d := sqrt(dx * dx + dy * dy) / r
				if d > 1.0:
					continue
				var w := (1.0 - d * d) * str_
				var px := (int(cx) + dx + size) % size
				var py := (int(cy) + dy + size) % size
				var idx: int = py * size + px
				var a: Vector3 = acc[idx]
				acc[idx] = a.lerp(Vector3(col.r, col.g, col.b), w)
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	for y in range(size):
		for x in range(size):
			var a: Vector3 = acc[y * size + x]
			img.set_pixel(x, y, Color(a.x, a.y, a.z))
	img.save_png("res://assets/textures/terrain/" + name + ".png")
	print("TEX ", name)

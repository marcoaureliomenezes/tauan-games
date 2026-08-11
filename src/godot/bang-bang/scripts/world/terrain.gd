# terrain.gd — constrói o Terrain3D a partir do TerrainGen (determinístico).
# Cena: res://scenes/world/terrain.tscn — instanciada por world.gd.
class_name BangTerrain
extends Node3D

const TerrainGen = preload("res://scripts/world/terrain_gen.gd")

var terrain: Terrain3D
var gen: Dictionary = {}
var _terrain_assets: Terrain3DAssets = null

func build(world_seed: int) -> void:
	gen = TerrainGen.generate(world_seed)
	var grid: int = gen["grid"]
	var heights: PackedFloat32Array = gen["heights"]

	# Alturas (RF, metros — offset 0, scale 1)
	var h_img := Image.create(grid, grid, false, Image.FORMAT_RF)
	for gz in range(grid):
		for gx in range(grid):
			h_img.set_pixel(gx, gz, Color(heights[gz * grid + gx], 0, 0))

	# Control map: AUTO shader em todo o terreno (textura por slope/altura —
	# grama no vale, rocha nas encostas, neve acima de SNOW_LINE).
	# bit 22 (auto) = 0x00400000 → bytes RGBA8 (r=0, g=0, b=64, a=0)
	var c_img := Image.create(grid, grid, false, Image.FORMAT_RGBA8)
	c_img.fill(Color(0, 0, 64.0 / 255.0, 0))

	# Color map: branco (sem tint)
	var col_img := Image.create(grid, grid, false, Image.FORMAT_RGBA8)
	col_img.fill(Color.WHITE)

	# data precisa de um diretório existente para ser criado (get_data() só
	# retorna objeto depois de set_data_directory com o dir presente)
	DirAccess.make_dir_recursive_absolute("user://bangbag_terrain")
	terrain = Terrain3D.new()
	terrain.name = "Terrain3D"
	terrain.data_directory = "user://bangbag_terrain"
	# região 2048 (cobre o mundo inteiro 2048×2048 m em spacing 1)
	if terrain.get("region_size") != null:
		terrain.set("region_size", 2048)
	# texturas do AUTO shader (0 = base/grama, 1 = encosta/rocha) — sem elas o
	# terreno renderiza checkerboard. IMPORTANTE: atribuir DEPOIS do data/import,
	# que recria os assets.
	_terrain_assets = Terrain3DAssets.new()
	var grass := Terrain3DTextureAsset.new()
	grass.albedo_texture = _load_tex("res://assets/textures/terrain/grass.png")
	var rock := Terrain3DTextureAsset.new()
	rock.albedo_texture = _load_tex("res://assets/textures/terrain/rock.png")
	_terrain_assets.set_texture(0, grass)
	_terrain_assets.set_texture(1, rock)
	add_child(terrain)
	var guard := 0
	while terrain.get_data() == null and guard < 10:
		await get_tree().process_frame
		guard += 1
	# importa (posiciona o canto em -1024,-1024 → mundo centrado na origem)
	terrain.get_data().import_images([h_img, c_img, col_img], Vector3(-1024, 0, -1024), 0.0, 1.0)
	# assets/material DEPOIS do import (o data recria os assets ao inicializar)
	terrain.assets = _terrain_assets
	if terrain.material:
		terrain.material.auto_shader = true
	# autoload Game existe no jogo; em modo -s (testes) pode não existir
	var g = get_node_or_null("/root/Game")
	if g:
		g.world_ready = true
	print("TERRAIN_BUILT grid=", grid, " regions ok")

# Consulta de altura para gameplay/testes (x,z em metros de mundo, origem no centro).
func height_at(x: float, z: float) -> float:
	if terrain and terrain.data:
		return terrain.data.get_height(Vector3(x, 0, z))
	return 0.0

# load() de PNG falha sem import prévio em modo -s; Image.load_from_file resolve
func _load_tex(path: String) -> ImageTexture:
	var img := Image.new()
	if img.load(path) != OK:
		print("TERRAIN_WARN: textura ausente ", path)
		return null
	return ImageTexture.create_from_image(img)

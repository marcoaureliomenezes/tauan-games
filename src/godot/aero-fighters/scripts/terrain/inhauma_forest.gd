class_name InhaumaForest
extends Node3D
## InhaumaForest — floresta instanciada por banda de altitude (port simplificado
## de inhauma-scene.js forests): pinheiro 70-420 m, folhosa 10-110, moita 7-60,
## seca 300-620. 3 MultiMeshes (1 draw call cada). Exclusões: shelves urbanos,
## aeroporto, canal do rio, encostas íngremes.

var heightmap: InhaumaHeightmap


func _init(p_heightmap: InhaumaHeightmap = null) -> void:
	heightmap = p_heightmap


static func corridors_half_width(roads: InhaumaRoads, c: int) -> float:
	return roads.corridors[c].width * 0.5


func _ready() -> void:
	if heightmap == null:
		heightmap = InhaumaHeightmap.new()
	var rng := RandomNumberGenerator.new()
	rng.seed = 777
	# Espécies: [mesh, escala_base, cor] — baixo-poli (perf Wave E1: os defaults
	# de CylinderMesh/SphereMesh são 64 segmentos ≈ milhares de tris POR ÁRVORE;
	# com milhares de instâncias isso quebra iGPU — web usa cones/esferas low-poly)
	var pine_mesh := CylinderMesh.new()
	pine_mesh.top_radius = 0.1
	pine_mesh.bottom_radius = 2.2
	pine_mesh.height = 10.0
	pine_mesh.radial_segments = 8
	var leafy_mesh := SphereMesh.new()
	leafy_mesh.radius = 2.8
	leafy_mesh.height = 5.6
	leafy_mesh.radial_segments = 8
	leafy_mesh.rings = 4
	var meshes := {
		"pine": [pine_mesh, Color(0.12, 0.28, 0.12)],
		"leafy": [leafy_mesh, Color(0.22, 0.42, 0.16)],
		"dry": [leafy_mesh, Color(0.45, 0.42, 0.25)],
	}
	var tiles := {} # "species_tx_tz" -> Array[Transform3D] (bins p/ frustum culling)
	var town := GameConfig.MAP_TOWN_SHELF.grow(20)
	var cach := GameConfig.CACHOEIRA_SHELF.grow(20)
	var river := heightmap.river()
	# Grade de amostragem na região jogável (~6 km²), jitter por célula
	var step := 26.0
	var cx0 := -3100.0
	var cz0 := -2900.0
	var nx := int(6200.0 / step)
	var nz := int(6400.0 / step)
	for iz in nz:
		for ix in nx:
			var x := cx0 + ix * step + rng.randf_range(-9, 9)
			var z := cz0 + iz * step + rng.randf_range(-9, 9)
			var p := Vector2(x, z)
			if town.has_point(p) or cach.has_point(p):
				continue
			# Vista limpa da bateria AA (nenhuma árvore tampando o artilheiro)
			if p.distance_to(GameConfig.HILL_POS) < GameConfig.HILL_FOREST_KEEPOUT_M:
				continue
			if InhaumaHeightmap.AIRPORT_BOUNDS.grow(150).has_point(p):
				continue
			var h: float = heightmap.height_fast(x, z)
			if h < 7.0 or h > GameConfig.BIOME_TREE_LINE:
				continue
			# Densidade por banda (floresta densa < 48 m, esparsa acima) — rola
			# ANTES das consultas caras (slope/rio) para cortar custo de boot
			var density := 0.55 if h < GameConfig.BIOME_FOREST_MAX else 0.22
			if rng.randf() > density:
				continue
			if heightmap.slope_fast(x, z) > 0.6:
				continue
			if river.is_channel(x, z):
				continue
			# Fora do leito das estradas (web: nearAnyRoad)
			var road := heightmap.roads()._nearest(x, z)
			if road.x >= 0.0 and road.z < corridors_half_width(heightmap.roads(), int(road.x)) + 6.0:
				continue
			var species := "pine" if h >= 70.0 else "leafy"
			if h >= 300.0:
				species = "dry"
			var s := rng.randf_range(0.7, 1.3)
			var t := Transform3D(Basis.from_scale(Vector3(s, s, s)), Vector3(x, h, z))
			# Bins espaciais 4×4 por espécie (Wave I: UM MultiMesh por espécie
			# desenhava TODAS as árvores sempre — sem culling por instância)
			var key := "%s_%d_%d" % [species, int((x - cx0) / 1550.0), int((z - cz0) / 1600.0)]
			if not tiles.has(key):
				tiles[key] = []
			tiles[key].append(t)
	for key in tiles:
		var list: Array = tiles[key]
		var species: String = key.get_slice("_", 0)
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_colors = true
		mm.mesh = meshes[species][0]
		mm.instance_count = list.size()
		var base_color: Color = meshes[species][1]
		for i in list.size():
			mm.set_instance_transform(i, list[i])
			mm.set_instance_color(i, base_color.lerp(base_color * 1.12, rng.randf()))
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.name = "Forest_%s" % key
		mmi.material_override = _forest_material()
		# Árvores fora do shadow pass (Wave I: milhares de instâncias no mapa de
		# 250 m por nada — a floresta mal projeta sombra perto da bateria)
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		# Corte por distância: além de 2,5 km o tile some (Wave I — opaque pass era
		# o gargalo; no fog de defesa a 2,5 km já está ~60% encoberto)
		mmi.visibility_range_end = 2500.0
		add_child(mmi)


static func _forest_material() -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.95
	return mat

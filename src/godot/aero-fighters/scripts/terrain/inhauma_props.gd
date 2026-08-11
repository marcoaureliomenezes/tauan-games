class_name InhaumaProps
extends Node3D
## InhaumaProps — elementos urbanos e estruturas do mapa Inhaúma/Cachoeira.
## Port de inhauma-city.js (tipologia low/mid/tower com setback, fachadas com
## janelas + emissive noturno, telhados de 2 águas terracota, keep-outs e
## terraceamento de buildTownCluster), airport.js, buildFactories e
## buildNuclearPlant do web-game. Casas/prédios via MultiMesh instanciado.
## TODO(v0.2): pontes, vapor da usina.

var heightmap: InhaumaHeightmap

const AIRPORT_KEEPOUT := Vector2(-560, 320)
const AIRPORT_KEEPOUT_R := 220.0

var _night_mats: Array[StandardMaterial3D] = []


## Chamado pelo mapa: fator de luz do dia (1 = dia, 0 = noite).
func set_daylight(daylight: float) -> void:
	for m in _night_mats:
		m.emission_energy_multiplier = lerpf(1.8, 0.0, daylight)


func _init(p_heightmap: InhaumaHeightmap = null) -> void:
	heightmap = p_heightmap


func _ready() -> void:
	if heightmap == null:
		heightmap = InhaumaHeightmap.new()
	_build_town(GameConfig.MAP_TOWN_SHELF, 30.0, 26.0, 101, "inhauma")
	_build_town(GameConfig.CACHOEIRA_SHELF, 22.0, 20.0, 202, "cachoeira")
	_build_church(GameConfig.MAP_CHURCH, 1.0)
	_build_church(GameConfig.CACHOEIRA_CHURCH, 0.6) # igrejinha de Cachoeira
	_build_cachoeira_ground()
	_build_airport()
	_build_factories()
	_build_nuclear_plant()
	_build_river_ribbon()
	_build_roads()
	_build_bridges()
	# NOTA: sem plano d'água global — no web a água visível é SÓ a fita do rio
	# (o plano de 24 km cobria o aeródromo/cidade em cota 0-4,5 — bug visual).


## Tabuleiros + guardas + pilares das pontes rio×estrada (T-06 do web).
func _build_bridges() -> void:
	var roads := heightmap.roads()
	for cr in roads.crossings:
		var c: Dictionary = roads.corridors[cr.c]
		var g := Node3D.new()
		g.name = "Bridge_%s" % c.id
		var yaw := atan2(cr.dir.x, cr.dir.y)
		# Tabuleiro
		var deck := _box(Vector3(c.width + 2.0, 0.8, cr.length), Color(0.28, 0.29, 0.31))
		deck.position = Vector3(cr.center.x, cr.deck_h - 0.4, cr.center.y)
		deck.rotation.y = yaw
		g.add_child(deck)
		# Guardas laterais
		for side in [-1.0, 1.0]:
			var perp: Vector2 = Vector2(-cr.dir.y, cr.dir.x) * side * (c.width * 0.5 + 0.6)
			var rail := _box(Vector3(0.4, 1.0, cr.length), Color(0.6, 0.6, 0.62))
			rail.position = Vector3(cr.center.x + perp.x, cr.deck_h + 0.5, cr.center.y + perp.y)
			rail.rotation.y = yaw
			g.add_child(rail)
		# Pilares até o relevo natural (leito do rio)
		var n_pillars := maxi(2, int(cr.length / 24.0))
		for i in n_pillars:
			var t: float = (float(i) / maxi(n_pillars - 1, 1) - 0.5) * (cr.length - 8.0)
			var px: float = cr.center.x + cr.dir.x * t
			var pz: float = cr.center.y + cr.dir.y * t
			var ground: float = heightmap.sample_dem(px, pz)
			var ph: float = cr.deck_h - ground
			var pillar := _cyl(1.2, 1.6, ph, Color(0.45, 0.44, 0.42))
			pillar.position = Vector3(px, ground + ph * 0.5, pz)
			g.add_child(pillar)
		add_child(g)


## Fitas das estradas (inhauma-road-render.js): ribbon por corredor na cota do
## leito +0,15; MG-238 com faixa central amarela (pista dupla).
func _build_roads() -> void:
	var roads := heightmap.roads()
	for c in roads.corridors:
		var pts: PackedVector2Array = c.points
		if pts.size() < 2:
			continue
		var verts := PackedVector3Array()
		var indices := PackedInt32Array()
		var half: float = c.width * 0.5
		for i in pts.size():
			var dir := Vector2(0, 1)
			if i < pts.size() - 1:
				dir = (pts[i + 1] - pts[i]).normalized()
			elif i > 0:
				dir = (pts[i] - pts[i - 1]).normalized()
			var perp := Vector2(-dir.y, dir.x) * half
			var y: float = c.heights[i] + 0.15
			verts.append(Vector3(pts[i].x - perp.x, y, pts[i].y - perp.y))
			verts.append(Vector3(pts[i].x + perp.x, y, pts[i].y + perp.y))
		for i in pts.size() - 1:
			var a := i * 2
			indices.append_array([a, a + 1, a + 2, a + 1, a + 3, a + 2])
		var mesh := _strip_mesh(verts, indices)
		var mi := MeshInstance3D.new()
		mi.mesh = mesh
		var mat := StandardMaterial3D.new()
		mat.albedo_color = InhaumaRoads.KIND_COLOR[c.kind]
		mat.roughness = 0.95
		mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		mi.material_override = mat
		mi.name = "Road_%s" % c.id
		add_child(mi)
		# Faixa central (pista dupla: amarela; demais: branca tracejada simples)
		if c.dual:
			var line_verts := PackedVector3Array()
			var line_idx := PackedInt32Array()
			for i in pts.size():
				var dir2 := Vector2(0, 1)
				if i < pts.size() - 1:
					dir2 = (pts[i + 1] - pts[i]).normalized()
				elif i > 0:
					dir2 = (pts[i] - pts[i - 1]).normalized()
				var perp2 := Vector2(-dir2.y, dir2.x) * 0.3
				var y2: float = c.heights[i] + 0.18
				line_verts.append(Vector3(pts[i].x - perp2.x, y2, pts[i].y - perp2.y))
				line_verts.append(Vector3(pts[i].x + perp2.x, y2, pts[i].y + perp2.y))
			for i in pts.size() - 1:
				var a := i * 2
				line_idx.append_array([a, a + 1, a + 2, a + 1, a + 3, a + 2])
			var lm := MeshInstance3D.new()
			lm.mesh = _strip_mesh(line_verts, line_idx)
			var lmat := StandardMaterial3D.new()
			lmat.albedo_color = Color(0.85, 0.75, 0.3)
			lm.material_override = lmat
			lm.name = "RoadLine_%s" % c.id
			add_child(lm)


func _strip_mesh(verts: PackedVector3Array, indices: PackedInt32Array) -> ArrayMesh:
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh


## Fita d'água contínua do rio (port de inhauma-river-ribbon.js, simplificado:
## faixa na cota da lâmina ao longo da polilinha de drenagem).
func _build_river_ribbon() -> void:
	var river := heightmap.river()
	var pts := river.polyline
	if pts.size() < 2:
		return
	var verts := PackedVector3Array()
	var indices := PackedInt32Array()
	var half := InhaumaRiver.HALF_WIDTH_M
	for i in pts.size():
		var p: Dictionary = pts[i]
		var dir := Vector2(0, 1)
		if i < pts.size() - 1:
			dir = (Vector2(pts[i + 1].x, pts[i + 1].z) - Vector2(p.x, p.z)).normalized()
		elif i > 0:
			dir = (Vector2(p.x, p.z) - Vector2(pts[i - 1].x, pts[i - 1].z)).normalized()
		var perp := Vector2(-dir.y, dir.x) * half
		var y: float = p.h - InhaumaRiver.WATER_BELOW_BANK_M
		verts.append(Vector3(p.x - perp.x, y, p.z - perp.y))
		verts.append(Vector3(p.x + perp.x, y, p.z + perp.y))
	for i in pts.size() - 1:
		var a := i * 2
		indices.append_array([a, a + 1, a + 2, a + 1, a + 3, a + 2])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var ribbon := MeshInstance3D.new()
	ribbon.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.2, 0.4, 0.5, 0.88)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.roughness = 0.12
	mat.metallic = 0.45
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	ribbon.material_override = mat
	ribbon.name = "RiverRibbon"
	add_child(ribbon)


## Malha de casas/prédios instanciados num shelf retangular — cidade VIVA:
## fachadas com janelas/portas (textura baked × paleta), telhados em pirâmide,
## chaminés (algumas com fumaça), ruas com calçadas, cercas, praça e campos.
const DOWNTOWN_PALETTE := [Color(0.624, 0.690, 0.761), Color(0.557, 0.635, 0.714),
	Color(0.682, 0.733, 0.780), Color(0.604, 0.659, 0.729), Color(0.714, 0.753, 0.792)]
const RESIDENTIAL_PALETTE := [Color(0.784, 0.604, 0.447), Color(0.824, 0.651, 0.494),
	Color(0.733, 0.561, 0.408), Color(0.812, 0.753, 0.635), Color(0.761, 0.580, 0.478)]
const ROOF_PALETTE := [Color(0.659, 0.337, 0.227), Color(0.612, 0.310, 0.212),
	Color(0.698, 0.376, 0.251), Color(0.561, 0.290, 0.200)]
const FENCE_PALETTE := [Color(0.85, 0.83, 0.78), Color(0.55, 0.45, 0.35), Color(0.65, 0.65, 0.62)]

static var _facades := {}


func _facade_material(kind: String) -> StandardMaterial3D:
	if _facades.is_empty():
		for k in ["low", "mid", "tower"]:
			_facades[k] = CityTexture.bake(k)
	var tex: Dictionary = _facades[kind]
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true # paleta × textura de fachada
	mat.albedo_texture = tex.albedo
	mat.roughness = 0.85
	# Janelas acesas à noite (emissive map casado — set_daylight liga)
	mat.emission_enabled = true
	mat.emission_texture = tex.emission
	mat.emission = Color(1.0, 0.78, 0.45)
	mat.emission_energy_multiplier = 0.0
	_night_mats.append(mat)
	return mat


static var _facade_box: ArrayMesh
static var _roof_prism: ArrayMesh


## Caixa unitária com UVs das faces de topo/base colapsadas num patch plano da
## textura de fachada (web makeFacadeBoxGeometry — o telhado não mostra janelas).
static func _facade_box_mesh() -> ArrayMesh:
	if _facade_box == null:
		var verts := PackedVector3Array()
		var normals := PackedVector3Array()
		var uvs := PackedVector2Array()
		var indices := PackedInt32Array()
		# [normal, c0, c1, c2, c3, é teto/base]
		var faces := [
			[Vector3.RIGHT, Vector3(0.5, -0.5, -0.5), Vector3(0.5, 0.5, -0.5), Vector3(0.5, 0.5, 0.5), Vector3(0.5, -0.5, 0.5), false],
			[Vector3.LEFT, Vector3(-0.5, -0.5, 0.5), Vector3(-0.5, 0.5, 0.5), Vector3(-0.5, 0.5, -0.5), Vector3(-0.5, -0.5, -0.5), false],
			[Vector3.UP, Vector3(-0.5, 0.5, 0.5), Vector3(0.5, 0.5, 0.5), Vector3(0.5, 0.5, -0.5), Vector3(-0.5, 0.5, -0.5), true],
			[Vector3.DOWN, Vector3(-0.5, -0.5, -0.5), Vector3(0.5, -0.5, -0.5), Vector3(0.5, -0.5, 0.5), Vector3(-0.5, -0.5, 0.5), true],
			[Vector3.BACK, Vector3(0.5, -0.5, 0.5), Vector3(0.5, 0.5, 0.5), Vector3(-0.5, 0.5, 0.5), Vector3(-0.5, -0.5, 0.5), false],
			[Vector3.FORWARD, Vector3(-0.5, -0.5, -0.5), Vector3(-0.5, 0.5, -0.5), Vector3(0.5, 0.5, -0.5), Vector3(0.5, -0.5, -0.5), false],
		]
		for f in faces:
			var base := verts.size()
			var fuvs := [Vector2(0.02, 0.02), Vector2(0.02, 0.02), Vector2(0.02, 0.02), Vector2(0.02, 0.02)] if f[5] \
				else [Vector2(0, 1), Vector2(0, 0), Vector2(1, 0), Vector2(1, 1)]
			for i in 4:
				verts.append(f[1 + i])
				normals.append(f[0])
				uvs.append(fuvs[i])
			indices.append_array([base, base + 1, base + 2, base, base + 2, base + 3])
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = verts
		arrays[Mesh.ARRAY_NORMAL] = normals
		arrays[Mesh.ARRAY_TEX_UV] = uvs
		arrays[Mesh.ARRAY_INDEX] = indices
		_facade_box = ArrayMesh.new()
		_facade_box.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return _facade_box


## Prisma de 2 águas unitário (web makeRoofPrismGeometry): cumeeira ao longo
## de X, ápice y=+0,5, base y=-0,5, sem face inferior. 4 quads/tris (14 tris... 5).
static func _roof_prism_mesh() -> ArrayMesh:
	if _roof_prism == null:
		var verts := PackedVector3Array()
		var normals := PackedVector3Array()
		var indices := PackedInt32Array()
		var a := Vector3(-0.5, -0.5, -0.5)
		var b := Vector3(0.5, -0.5, -0.5)
		var c := Vector3(0.5, -0.5, 0.5)
		var d := Vector3(-0.5, -0.5, 0.5)
		var e := Vector3(-0.5, 0.5, 0)
		var f := Vector3(0.5, 0.5, 0)
		for quad in [[a, b, f, e], [c, d, e, f]]:
			var base := verts.size()
			var n: Vector3 = (quad[1] - quad[0]).cross(quad[2] - quad[0]).normalized()
			for q in quad:
				verts.append(q)
				normals.append(n)
			indices.append_array([base, base + 1, base + 2, base, base + 2, base + 3])
		# Empenas (triângulos das pontas)
		for tri in [[b, c, f], [d, a, e]]:
			var base := verts.size()
			var n: Vector3 = (tri[1] - tri[0]).cross(tri[2] - tri[0]).normalized()
			for q in tri:
				verts.append(q)
				normals.append(n)
			indices.append_array([base, base + 1, base + 2])
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = verts
		arrays[Mesh.ARRAY_NORMAL] = normals
		arrays[Mesh.ARRAY_INDEX] = indices
		_roof_prism = ArrayMesh.new()
		_roof_prism.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return _roof_prism


## Grade de quarteirões (port de buildTownCluster + typology do inhauma-city.js):
## keep-outs duros (aeroporto, morro, marcos, estrada, rio, encosta), lotes
## vazios determinísticos, afinamento por inclinação, terraceamento −0,35 m,
## tipologia por distrito (torre com setback / mid / low com telhado 2 águas).
const SHELF_FLAT_SLOPE_MAX_DENSITY := 0.12
const SHELF_MAX_SLOPE := 0.35
const TERRACE_CUT_M := 0.35
const ROAD_KEEPOUT_M := 12.0
const RIVER_KEEPOUT_M := 35.0 # HALF_WIDTH 20 + 15 (web riverKeepOut)
const FIELD_POS := [Vector2(-410, -60), Vector2(-250, -40)] # campos de futebol


func _build_town(shelf: Rect2, step_x: float, step_z: float, seed: int, town: String) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var center := GameConfig.MAP_DOWNTOWN if town == "inhauma" else GameConfig.CACHOEIRA_CENTER
	var blocks: Array[Dictionary] = []
	var x: float = shelf.position.x + step_x * 0.5
	while x < shelf.end.x:
		var z: float = shelf.position.y + step_z * 0.5
		while z < shelf.end.y:
			if not _town_keep_out(x, z, town, rng):
				var rr := Vector2(x - center.x, z - center.y).length()
				blocks.append(_town_block(x, z, rr, town))
			z += step_z
		x += step_x
	_build_town_meshes(blocks, rng, seed)
	_build_streets(shelf, step_x, step_z)
	if town == "inhauma":
		_build_praca()
		_build_fields()


## Keep-outs duros + variedade (web buildTownCluster, mesma ordem de checagens).
func _town_keep_out(x: float, z: float, town: String, rng: RandomNumberGenerator) -> bool:
	var p := Vector2(x, z)
	if p.distance_to(AIRPORT_KEEPOUT) < AIRPORT_KEEPOUT_R:
		return true
	if p.distance_to(GameConfig.HILL_POS) < GameConfig.HILL_TOWN_KEEPOUT_M:
		return true
	if p.distance_to(GameConfig.NUCLEAR_PLANT) < 200.0: # complexo industrial (K8)
		return true
	if town == "inhauma":
		if p.distance_to(GameConfig.MAP_CHURCH) < 55.0:
			return true
		if p.distance_to(Vector2(-330, -70)) < 30.0: # torre da igreja
			return true
		if p.distance_to(GameConfig.MAP_PRACA) < 48.0:
			return true
		for f in FIELD_POS:
			if p.distance_to(f) < 75.0:
				return true
	else:
		if p.distance_to(GameConfig.CACHOEIRA_CHURCH) < 30.0:
			return true
		if p.distance_to(GameConfig.CACHOEIRA_PRACA) < 26.0:
			return true
		# Nenhum lote sobre as duas ruas centrais do shelf
		if absf(x - GameConfig.CACHOEIRA_CENTER.x) < 8.0:
			return true
		if absf(z - GameConfig.CACHOEIRA_PRACA.y) < 8.0:
			return true
	var road := heightmap.roads()._nearest(x, z)
	if road.x >= 0.0 and road.z < heightmap.roads().corridors[int(road.x)].width * 0.5 + ROAD_KEEPOUT_M:
		return true
	var river := heightmap.river().nearest_on_river(x, z)
	if river.x >= 0.0 and river.x < RIVER_KEEPOUT_M:
		return true
	if heightmap.height_at(x, z) < GameConfig.MAP_WATER_Y + 1.0:
		return true
	var slope := heightmap.slope_fast(x, z)
	if slope > SHELF_MAX_SLOPE:
		return true
	if absi(int(x * 7 + z * 13)) % 5 == 0: # lotes vazios (variedade visual)
		return true
	# Afina a densidade conforme a inclinação sobe acima do patamar plano
	if slope > SHELF_FLAT_SLOPE_MAX_DENSITY:
		var thin := (slope - SHELF_FLAT_SLOPE_MAX_DENSITY) / (SHELF_MAX_SLOPE - SHELF_FLAT_SLOPE_MAX_DENSITY)
		if rng.randf() < thin:
			return true
	return false


## Tipologia por distrito (hash por coordenada — determinístico, sem rng).
func _town_block(x: float, z: float, rr: float, town: String) -> Dictionary:
	var hkey := absi(int(x * 5 + z * 3))
	var kind := "low"
	var h := 0.0
	var downtown := false
	if town == "inhauma":
		downtown = rr < GameConfig.MAP_DOWNTOWN_R
		if downtown and rr < 110.0 and hkey % 3 == 0:
			kind = "tower"
			h = 30.0 + hkey % 17
		elif downtown:
			kind = "mid"
			h = 15.0 + hkey % 12
		else:
			h = 6.5 + absi(int(x * 3 + z)) % 5
	else:
		downtown = rr < 80.0
		if downtown and hkey % 4 == 0:
			kind = "mid"
			h = 12.0 + hkey % 8
		else:
			h = 6.0 + absi(int(x * 3 + z)) % 5
	var w := 11.0 + absi(int(x)) % 6
	var d := 9.0 + absi(int(z)) % 5
	return {"x": x, "z": z, "gh": _terraced_pad(x, z, w, d), "h": h,
		"w": w, "d": d, "kind": kind, "downtown": downtown}


## Base nivelada do terraceamento: média dos 4 cantos −0,35 m (web T-09).
func _terraced_pad(x: float, z: float, w: float, d: float) -> float:
	var hx := w * 0.5
	var hz := d * 0.5
	var avg := (heightmap.height_at(x - hx, z - hz) + heightmap.height_at(x + hx, z - hz)
		+ heightmap.height_at(x - hx, z + hz) + heightmap.height_at(x + hx, z + hz)) / 4.0
	return avg - TERRACE_CUT_M


## Paleta determinística por coordenada (web hashPick).
static func _hash_pick(list: Array, x: float, z: float) -> Color:
	return list[absi(int(x * 7 + z * 13)) % list.size()]


func _build_town_meshes(blocks: Array[Dictionary], rng: RandomNumberGenerator, seed: int) -> void:
	var facade := _facade_box_mesh()
	var chimney_mesh := BoxMesh.new()
	chimney_mesh.size = Vector3(0.5, 1.2, 0.5)
	var fence_mesh := BoxMesh.new()
	fence_mesh.size = Vector3.ONE
	var low_mm := _new_multimesh(facade)
	var mid_mm := _new_multimesh(facade)
	var tower_mm := _new_multimesh(facade)
	var roofs_mm := _new_multimesh(_roof_prism_mesh())
	var chimneys_mm := _new_multimesh(chimney_mesh)
	var fences_mm := _new_multimesh(fence_mesh)
	var low_t: Array[Transform3D] = []
	var mid_t: Array[Transform3D] = []
	var tower_t: Array[Transform3D] = []
	var roofs_t: Array[Transform3D] = []
	var chimneys_t: Array[Transform3D] = []
	var fences_t: Array[Transform3D] = []
	var low_c: Array[Color] = []
	var mid_c: Array[Color] = []
	var tower_c: Array[Color] = []
	var roofs_c: Array[Color] = []
	var chimneys_c: Array[Color] = []
	var fences_c: Array[Color] = []
	var smokes: Array[Vector3] = []
	for b in blocks:
		var bx: float = b.x
		var bz: float = b.z
		var gh: float = b.gh
		var h: float = b.h
		var w: float = b.w
		var d: float = b.d
		var col := _hash_pick(DOWNTOWN_PALETTE, bx, bz) if b.downtown \
			else _hash_pick(RESIDENTIAL_PALETTE, bx, bz)
		match b.kind:
			"tower":
				# 2 caixas empilhadas com setback (web: base 62%, cap ×0,72)
				var hb := h * 0.62
				tower_t.append(Transform3D(Basis.from_scale(Vector3(w, hb, d)),
					Vector3(bx, gh + hb * 0.5, bz)))
				tower_c.append(col)
				tower_t.append(Transform3D(Basis.from_scale(Vector3(w * 0.72, h - hb, d * 0.72)),
					Vector3(bx, gh + hb + (h - hb) * 0.5, bz)))
				tower_c.append(col)
			"mid":
				mid_t.append(Transform3D(Basis.from_scale(Vector3(w, h, d)),
					Vector3(bx, gh + h * 0.5, bz)))
				mid_c.append(col)
			_:
				low_t.append(Transform3D(Basis.from_scale(Vector3(w, h, d)),
					Vector3(bx, gh + h * 0.5, bz)))
				low_c.append(col)
				# Telhado de 2 águas (cumeeira ao longo do eixo maior) — terracota
				var roof_h := minf(w, d) * 0.28
				var yaw := 0.0 if w >= d else PI / 2
				roofs_t.append(Transform3D(Basis.from_euler(Vector3(0, yaw, 0)) \
					* Basis.from_scale(Vector3(maxf(w, d) * 1.08, roof_h, minf(w, d) * 1.08)),
					Vector3(bx, gh + h + roof_h * 0.5, bz)))
				roofs_c.append(_hash_pick(ROOF_PALETTE, bx, bz))
				# Chaminé (~45%); ~1 em 3 com fumaça
				if rng.randf() < 0.45:
					var cp := Vector3(bx + w * 0.28, gh + h + roof_h * 0.4, bz + d * 0.2)
					chimneys_t.append(Transform3D(Basis.IDENTITY, cp))
					chimneys_c.append(Color(0.45, 0.30, 0.25))
					if rng.randf() < 0.33:
						smokes.append(cp + Vector3(0, 0.8, 0))
				# Cerca ao redor do lote (~40%)
				if rng.randf() < 0.4:
					var fc: Color = FENCE_PALETTE[rng.randi() % FENCE_PALETTE.size()]
					var lot := Vector2(w + 3.0, d + 3.0) * 0.5
					var fy := gh + 0.45
					for seg in [
						[Vector3(bx, fy, bz - lot.y), Vector3(lot.x * 2, 0.9, 0.12)],
						[Vector3(bx, fy, bz + lot.y), Vector3(lot.x * 2, 0.9, 0.12)],
						[Vector3(bx - lot.x, fy, bz), Vector3(0.12, 0.9, lot.y * 2)],
						[Vector3(bx + lot.x, fy, bz), Vector3(0.12, 0.9, lot.y * 2)],
					]:
						fences_t.append(Transform3D(Basis.from_scale(seg[1]), seg[0]))
						fences_c.append(fc)
	_fill_multimesh(low_mm, low_t, low_c)
	_fill_multimesh(mid_mm, mid_t, mid_c)
	_fill_multimesh(tower_mm, tower_t, tower_c)
	_fill_multimesh(roofs_mm, roofs_t, roofs_c)
	_fill_multimesh(chimneys_mm, chimneys_t, chimneys_c)
	_fill_multimesh(fences_mm, fences_t, fences_c)
	_add_mmi(low_mm, "CityLow_%d" % seed, _facade_material("low"))
	_add_mmi(mid_mm, "CityMid_%d" % seed, _facade_material("mid"))
	_add_mmi(tower_mm, "CityTower_%d" % seed, _facade_material("tower"))
	var vcmat := StandardMaterial3D.new()
	vcmat.vertex_color_use_as_albedo = true
	vcmat.roughness = 0.9
	vcmat.cull_mode = BaseMaterial3D.CULL_DISABLED
	_add_mmi(roofs_mm, "CityRoofs_%d" % seed, vcmat)
	_add_mmi(chimneys_mm, "CityChimneys_%d" % seed, vcmat)
	_add_mmi(fences_mm, "CityFences_%d" % seed, vcmat)
	# Cap de fumaças de chaminé (perf Wave B): fixo em 8 por cidade
	while smokes.size() > 4:
		smokes.remove_at(rng.randi() % smokes.size())
	for sp in smokes:
		_spawn_chimney_smoke(sp)


func _add_mmi(mm: MultiMesh, name: String, mat: Material) -> void:
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.name = name
	mmi.material_override = mat
	# Cidade fora do shadow pass (Wave I: shadow map cobre só 250 m da câmera —
	# a cidade nunca entra; submeter milhares de instâncias era custo morto)
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mmi)


## Coluna de fumaça de chaminé (loop, fumaça Kenney — prop-fire do web).
func _spawn_chimney_smoke(pos: Vector3) -> void:
	var p := GPUParticles3D.new()
	p.amount = 10
	p.lifetime = 3.5
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	pm.emission_sphere_radius = 0.3
	pm.direction = Vector3.UP
	pm.spread = 12.0
	pm.initial_velocity_min = 1.2
	pm.initial_velocity_max = 2.2
	pm.gravity = Vector3.ZERO
	pm.scale_min = 0.8
	pm.scale_max = 2.2
	var grad := Gradient.new()
	grad.set_color(0, Color(0.35, 0.35, 0.35, 0.55))
	grad.set_color(1, Color(0.65, 0.65, 0.65, 0.0))
	var gt := GradientTexture1D.new()
	gt.gradient = grad
	pm.color_ramp = gt
	p.process_material = pm
	var mesh := QuadMesh.new()
	mesh.size = Vector2.ONE
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = load("res://addons/kenney_particle_pack/circle_05.png")
	mat.vertex_color_use_as_albedo = true
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mesh.material = mat
	p.draw_pass_1 = mesh
	add_child(p)
	p.global_position = pos
	p.emitting = true


## Ruas do bairro (grade a cada 3 lotes) com calçadas — ribbons segmentados
## que ACOMPANHAM o terreno (1 mesh por cidade; era caixa única em cota fixa).
func _build_streets(shelf: Rect2, step_x: float, step_z: float) -> void:
	var verts := PackedVector3Array()
	var colors := PackedColorArray()
	var indices := PackedInt32Array()
	var asphalt := Color(0.19, 0.19, 0.21)
	var sidewalk := Color(0.55, 0.54, 0.50)
	# Ruas verticais (ao longo de Z) e horizontais (ao longo de X) a cada 3 lotes
	var k := 1
	while shelf.position.x + k * 3 * step_x < shelf.end.x - 4:
		var sx: float = shelf.position.x + k * 3 * step_x
		_street_ribbon(verts, colors, indices, Vector2(sx, shelf.position.y + 4),
			Vector2(sx, shelf.end.y - 4), 7.0, asphalt, sidewalk)
		k += 1
	k = 1
	while shelf.position.y + k * 3 * step_z < shelf.end.y - 4:
		var sz: float = shelf.position.y + k * 3 * step_z
		_street_ribbon(verts, colors, indices, Vector2(shelf.position.x + 4, sz),
			Vector2(shelf.end.x - 4, sz), 7.0, asphalt, sidewalk)
		k += 1
	if indices.is_empty():
		return
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_COLOR] = colors
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.95
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = mat
	mi.name = "CityStreets"
	add_child(mi)


## Faixa de rua segmentada a cada ~18 m, cada amostra na cota local do terreno
## (asfalto + 2 calçadas; segmentos perto do aeroporto são pulados).
func _street_ribbon(verts: PackedVector3Array, colors: PackedColorArray,
		indices: PackedInt32Array, a: Vector2, b: Vector2, width: float,
		asphalt: Color, sidewalk: Color) -> void:
	var length := a.distance_to(b)
	var dir := (b - a).normalized()
	var perp := Vector2(-dir.y, dir.x)
	var hw := width * 0.5
	var steps := maxi(1, int(length / 18.0))
	var prev_valid := false
	var prev_pts: Array = []
	for i in steps + 1:
		var p := a + dir * (length * i / steps)
		var y: float = heightmap.height_at(p.x, p.y) + 0.06
		var valid := p.distance_to(AIRPORT_KEEPOUT) >= AIRPORT_KEEPOUT_R * 0.8
		var pts := [
			Vector3(p.x - perp.x * (hw + 2.0), y + 0.02, p.y - perp.y * (hw + 2.0)),
			Vector3(p.x - perp.x * hw, y, p.y - perp.y * hw),
			Vector3(p.x + perp.x * hw, y, p.y + perp.y * hw),
			Vector3(p.x + perp.x * (hw + 2.0), y + 0.02, p.y + perp.y * (hw + 2.0)),
		]
		if valid and prev_valid:
			for band in [[0, 1, sidewalk], [1, 2, asphalt], [2, 3, sidewalk]]:
				var base := verts.size()
				verts.append(prev_pts[band[0]])
				verts.append(pts[band[0]])
				verts.append(pts[band[1]])
				verts.append(prev_pts[band[1]])
				for j in 4:
					colors.append(band[2])
				indices.append_array([base, base + 1, base + 2, base, base + 2, base + 3])
		prev_valid = valid
		prev_pts = pts


## Chão urbano de Cachoeira: praça + duas ruas centrais de 9 m cruzando o
## shelf (web buildCachoeira — o shelf é nivelado, planos em cota única).
func _build_cachoeira_ground() -> void:
	var praca := GameConfig.CACHOEIRA_PRACA
	var py: float = heightmap.height_at(praca.x, praca.y)
	var sq := _box(Vector3(40, 0.15, 32), Color(0.44, 0.55, 0.38))
	sq.position = Vector3(praca.x, py + 0.22, praca.y)
	add_child(sq)
	var c := GameConfig.CACHOEIRA_CENTER
	var shelf := GameConfig.CACHOEIRA_SHELF
	var sy: float = heightmap.height_at(c.x, c.y)
	var asphalt := Color(0.29, 0.29, 0.28)
	var ns := _box(Vector3(9, 0.12, shelf.size.y - 12), asphalt)
	ns.position = Vector3(c.x, sy + 0.18, c.y)
	add_child(ns)
	var ew := _box(Vector3(shelf.size.x - 12, 0.12, 9), asphalt)
	ew.position = Vector3(c.x, sy + 0.18, praca.y)
	add_child(ew)


## Praça central (pavimento, fonte, bancos, árvores).
func _build_praca() -> void:
	var c := GameConfig.MAP_PRACA
	var y: float = heightmap.height_at(c.x, c.y)
	var pave := _box(Vector3(46, 0.15, 46), Color(0.68, 0.63, 0.55))
	pave.position = Vector3(c.x, y + 0.08, c.y)
	add_child(pave)
	# Fonte central (base + água)
	var fbase := _cyl(3.2, 3.6, 1.2, Color(0.60, 0.58, 0.54))
	fbase.position = Vector3(c.x, y + 0.7, c.y)
	add_child(fbase)
	var fwater := _cyl(2.6, 2.6, 0.2, Color(0.25, 0.5, 0.65))
	fwater.position = Vector3(c.x, y + 1.25, c.y)
	add_child(fwater)
	# Bancos nos 4 cantos
	for bpos in [Vector2(-14, -14), Vector2(14, -14), Vector2(-14, 14), Vector2(14, 14)]:
		var bench := _box(Vector3(3.0, 0.5, 0.9), Color(0.45, 0.32, 0.20))
		bench.position = Vector3(c.x + bpos.x, y + 0.4, c.y + bpos.y)
		add_child(bench)
	# Árvores da praça (folhosas)
	for tpos in [Vector2(-18, 18), Vector2(18, 18), Vector2(-18, -18), Vector2(18, -18)]:
		var trunk := _cyl(0.25, 0.35, 2.2, Color(0.35, 0.25, 0.15))
		trunk.position = Vector3(c.x + tpos.x, y + 1.1, c.y + tpos.y)
		add_child(trunk)
		var crown_mesh := SphereMesh.new()
		crown_mesh.radius = 2.4
		crown_mesh.height = 4.8
		var crown := MeshInstance3D.new()
		crown.mesh = crown_mesh
		var cmat := StandardMaterial3D.new()
		cmat.albedo_color = Color(0.20, 0.45, 0.18)
		cmat.roughness = 0.95
		crown.material_override = cmat
		crown.position = Vector3(c.x + tpos.x, y + 3.8, c.y + tpos.y)
		add_child(crown)


## Campos de futebol (gramado, linhas, gols) — posições do web.
func _build_fields() -> void:
	for fpos in [Vector2(-410, -60), Vector2(-250, -40)]:
		var y: float = heightmap.height_at(fpos.x, fpos.y)
		var pitch := _box(Vector3(44, 0.12, 70), Color(0.10, 0.45, 0.12))
		pitch.position = Vector3(fpos.x, y + 0.06, fpos.y)
		add_child(pitch)
		# Linhas: contorno + meio de campo
		var lw := 0.4
		for line in [
			[Vector3(fpos.x, y + 0.14, fpos.y - 35), Vector3(44, 0.02, lw)],
			[Vector3(fpos.x, y + 0.14, fpos.y + 35), Vector3(44, 0.02, lw)],
			[Vector3(fpos.x - 22, y + 0.14, fpos.y), Vector3(lw, 0.02, 70)],
			[Vector3(fpos.x + 22, y + 0.14, fpos.y), Vector3(lw, 0.02, 70)],
			[Vector3(fpos.x, y + 0.14, fpos.y), Vector3(44, 0.02, lw)],
		]:
			var l := _box(line[1], Color(0.9, 0.9, 0.9))
			l.position = line[0]
			add_child(l)
		# Gols nas duas pontas
		for gz in [-1.0, 1.0]:
			var goal_z: float = fpos.y + gz * 34.0
			for gx in [-3.5, 3.5]:
				var post := _box(Vector3(0.25, 2.4, 0.25), Color(0.95, 0.95, 0.95))
				post.position = Vector3(fpos.x + gx, y + 1.2, goal_z)
				add_child(post)
			var crossbar := _box(Vector3(7.25, 0.25, 0.25), Color(0.95, 0.95, 0.95))
			crossbar.position = Vector3(fpos.x, y + 2.4, goal_z)
			add_child(crossbar)


func _new_multimesh(mesh: Mesh) -> MultiMesh:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = mesh
	return mm


func _fill_multimesh(mm: MultiMesh, transforms: Array[Transform3D], colors: Array[Color]) -> void:
	mm.instance_count = transforms.size()
	for i in transforms.size():
		mm.set_instance_transform(i, transforms[i])
		mm.set_instance_color(i, colors[i])


func _build_church(at: Vector2, scale_f: float) -> void:
	var g := Node3D.new()
	g.name = "Church"
	var y: float = heightmap.height_at(at.x, at.y)
	var body := _box(Vector3(14, 10, 22) * scale_f, Color(0.88, 0.85, 0.78))
	body.position = Vector3(at.x, y + 5 * scale_f, at.y)
	var tower := _box(Vector3(6, 22, 6) * scale_f, Color(0.85, 0.82, 0.75))
	tower.position = Vector3(at.x + 8 * scale_f, y + 11 * scale_f, at.y - 8 * scale_f)
	var spire_mesh := CylinderMesh.new()
	spire_mesh.top_radius = 0.2 * scale_f
	spire_mesh.bottom_radius = 3.4 * scale_f
	spire_mesh.height = 8 * scale_f
	var spire := MeshInstance3D.new()
	spire.mesh = spire_mesh
	spire.position = Vector3(at.x + 8 * scale_f, y + 26 * scale_f, at.y - 8 * scale_f)
	for m in [body, tower, spire]:
		g.add_child(m)
	add_child(g)


func _build_airport() -> void:
	var c := GameConfig.AIRPORT_POS
	var y := 0.08 # elevation 0 da clareira + offset anti z-fight
	# Heading 0 = pista ao longo de Z (norte-sul): 52 de largura × 620 de pista
	var runway := _box(Vector3(GameConfig.AIRPORT_RUNWAY.y, 0.15, GameConfig.AIRPORT_RUNWAY.x),
		Color(0.10, 0.10, 0.11)) # asfalto quase preto como no web
	runway.position = Vector3(c.x, y, c.y)
	var taxi := _box(Vector3(30, 0.15, 160), Color(0.16, 0.16, 0.17))
	taxi.position = Vector3(GameConfig.AIRPORT_TAXIWAY.x, y, GameConfig.AIRPORT_TAXIWAY.y)
	var service := _box(Vector3(GameConfig.AIRPORT_SERVICE_SIZE.x, 0.15, GameConfig.AIRPORT_SERVICE_SIZE.y),
		Color(0.22, 0.22, 0.23))
	service.position = Vector3(GameConfig.AIRPORT_SERVICE.x, y, GameConfig.AIRPORT_SERVICE.y)
	# Faixa central da pista
	var stripe := _box(Vector3(1.2, 0.18, GameConfig.AIRPORT_RUNWAY.x - 40), Color(0.85, 0.85, 0.8))
	stripe.position = Vector3(c.x, y + 0.02, c.y)
	for m in [runway, taxi, service, stripe]:
		add_child(m)
	# Luzes de borda ciano (assinatura visual da pista no web)
	var light_mesh := BoxMesh.new()
	light_mesh.size = Vector3(0.9, 0.7, 0.9)
	var lights_mm := _new_multimesh(light_mesh)
	var lts: Array[Transform3D] = []
	var lcs: Array[Color] = []
	var half_w := GameConfig.AIRPORT_RUNWAY.y * 0.5 + 1.5 # 52/2 nas laterais (X)
	var half_l := GameConfig.AIRPORT_RUNWAY.x * 0.5 # 620/2 ao longo (Z)
	var z: float = c.y - half_l + 10.0
	while z < c.y + half_l:
		for sx in [-1.0, 1.0]:
			lts.append(Transform3D(Basis.IDENTITY, Vector3(c.x + sx * half_w, y + 0.4, z)))
			lcs.append(Color(0.3, 1.0, 0.9))
		z += 40.0
	_fill_multimesh(lights_mm, lts, lcs)
	var lights_mmi := MultiMeshInstance3D.new()
	lights_mmi.multimesh = lights_mm
	lights_mmi.name = "RunwayLights"
	var lmat := StandardMaterial3D.new()
	lmat.emission_enabled = true
	lmat.emission = Color(0.3, 1.0, 0.9)
	lmat.emission_energy_multiplier = 2.5
	lights_mmi.material_override = lmat
	add_child(lights_mmi)


func _build_factories() -> void:
	for fpos in GameConfig.FACTORIES:
		var y: float = heightmap.height_at(fpos.x, fpos.y)
		var g := Node3D.new()
		g.name = "Factory"
		var shed := _box(Vector3(70, 22, 44), Color(0.55, 0.56, 0.58))
		shed.position = Vector3(fpos.x, y + 11, fpos.y)
		g.add_child(shed)
		for i in 3:
			var chim := CylinderMesh.new()
			chim.top_radius = 2.0
			chim.bottom_radius = 2.6
			chim.height = 30.0
			var c := MeshInstance3D.new()
			c.mesh = chim
			c.position = Vector3(fpos.x - 24 + i * 24, y + 15, fpos.y - 28)
			g.add_child(c)
		for i in 2:
			var tank_mesh := CylinderMesh.new()
			tank_mesh.top_radius = 8.0
			tank_mesh.bottom_radius = 8.0
			tank_mesh.height = 10.0
			var t := MeshInstance3D.new()
			t.mesh = tank_mesh
			t.position = Vector3(fpos.x - 20 + i * 40, y + 5, fpos.y + 34)
			g.add_child(t)
		add_child(g)


## Complexo industrial nuclear (K8 — "trabalhar duro na usina, outros prédios
## ao redor"): torres + domo + contenção + casa de turbinas + galpões + pátio
## de transformadores + chaminés + tubulação + cerca. Boxes/cilindros em
## MultiMesh com cores (carbonização do firestorm cobre o complexo).
func _build_nuclear_plant() -> void:
	var p := GameConfig.NUCLEAR_PLANT
	var y: float = heightmap.height_at(p.x, p.y)
	var g := Node3D.new()
	g.name = "NuclearPlant"
	var white := Color(0.85, 0.85, 0.82)
	var grey := Color(0.55, 0.57, 0.58)
	var dark := Color(0.30, 0.31, 0.33)
	var accent := Color(0.75, 0.55, 0.25)
	# Peças únicas: torres de resfriamento + domo do reator
	for ox in [-55.0, 55.0]:
		var tower_mesh := CylinderMesh.new()
		tower_mesh.top_radius = 25.0
		tower_mesh.bottom_radius = 34.0
		tower_mesh.height = 70.0
		var tower := MeshInstance3D.new()
		tower.mesh = tower_mesh
		tower.position = Vector3(p.x + ox, y + 35, p.y)
		g.add_child(tower)
	var dome_mesh := SphereMesh.new()
	dome_mesh.radius = 20.0
	dome_mesh.height = 40.0
	var dome := MeshInstance3D.new()
	dome.mesh = dome_mesh
	dome.position = Vector3(p.x, y + 14, p.y - 80)
	g.add_child(dome)
	for m in g.get_children():
		if m is MeshInstance3D:
			var mat := StandardMaterial3D.new()
			mat.albedo_color = white
			mat.roughness = 0.85
			m.material_override = mat
	# Instanciado (1 draw call por malha, cores por instância)
	var box_mm := _new_multimesh(BoxMesh.new())
	var cyl_mesh := CylinderMesh.new()
	cyl_mesh.radial_segments = 8
	var cyl_mm := _new_multimesh(cyl_mesh)
	var bt: Array[Transform3D] = []
	var bc: Array[Color] = []
	var ct: Array[Transform3D] = []
	var cc: Array[Color] = []
	var y_at := func(x: float, z: float) -> float: return heightmap.height_at(x, z)
	var box_at := func(px: float, pz: float, size: Vector3, col: Color, yaw := 0.0) -> void:
		var gy: float = y_at.call(px, pz)
		bt.append(Transform3D(Basis.from_euler(Vector3(0, yaw, 0)) * Basis.from_scale(size),
			Vector3(px, gy + size.y * 0.5, pz)))
		bc.append(col)
	var cyl_at := func(px: float, pz: float, r: float, h: float, col: Color, yaw := 0.0) -> void:
		var gy: float = y_at.call(px, pz)
		ct.append(Transform3D(Basis.from_euler(Vector3(0, yaw, 0)) * Basis.from_scale(Vector3(r * 2, h, r * 2)),
			Vector3(px, gy + h * 0.5, pz)))
		cc.append(col)
	# Contenção + casa de turbinas + galpões + administração
	box_at.call(p.x + 34, p.y - 80, Vector3(30, 28, 30), grey)
	box_at.call(p.x, p.y + 30, Vector3(70, 18, 30), grey)
	box_at.call(p.x - 70, p.y + 70, Vector3(40, 12, 20), dark)
	box_at.call(p.x - 70, p.y + 98, Vector3(40, 12, 20), dark)
	box_at.call(p.x + 60, p.y + 75, Vector3(20, 10, 12), grey, 0.3)
	# Pátio de transformadores (grade de caixas + 2 tanques)
	for i in 8:
		box_at.call(p.x + 40 + (i % 4) * 9.0, p.y + 30 + int(i / 4) * 9.0,
			Vector3(3, 4, 4), accent if i % 3 == 0 else dark)
	cyl_at.call(p.x + 85, p.y + 45, 4.0, 9.0, grey)
	cyl_at.call(p.x + 95, p.y + 45, 4.0, 9.0, grey)
	# Chaminés (2, com fumaça) + tubulação
	for cx in [p.x - 30, p.x - 42]:
		cyl_at.call(cx, p.y - 20, 2.2, 45.0, Color(0.6, 0.35, 0.25))
		_spawn_chimney_smoke(Vector3(cx, y_at.call(cx, p.y - 20) + 46.0, p.y - 20))
	for i in 3:
		cyl_at.call(p.x - 10 + i * 12.0, p.y - 40, 0.8, 24.0, dark, PI / 2)
	# Cerca do perímetro (postes finos nos 4 lados)
	var half := Vector2(120, 110)
	for i in range(-6, 7):
		if i % 2 == 0:
			box_at.call(p.x + i * 20.0, p.y - half.y, Vector3(0.4, 2.2, 0.4), dark)
			box_at.call(p.x + i * 20.0, p.y + half.y, Vector3(0.4, 2.2, 0.4), dark)
			box_at.call(p.x - half.x, p.y + i * 18.0, Vector3(0.4, 2.2, 0.4), dark)
			box_at.call(p.x + half.x, p.y + i * 18.0, Vector3(0.4, 2.2, 0.4), dark)
	_fill_multimesh(box_mm, bt, bc)
	_fill_multimesh(cyl_mm, ct, cc)
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.85
	_add_mmi(box_mm, "IndBoxes", mat)
	_add_mmi(cyl_mm, "IndCyls", mat)
	add_child(g)


func _build_water() -> void:
	var plane := PlaneMesh.new()
	plane.size = Vector2(24000, 24000)
	var water := MeshInstance3D.new()
	water.mesh = plane
	water.position = Vector3(0, GameConfig.MAP_WATER_Y, 0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.16, 0.34, 0.45, 0.85)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.roughness = 0.15
	mat.metallic = 0.4
	water.material_override = mat
	water.name = "Water"
	add_child(water)


func _box(size: Vector3, color: Color) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.9
	mi.material_override = mat
	return mi


func _cyl(top: float, bottom: float, height: float, color: Color) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.top_radius = top
	mesh.bottom_radius = bottom
	mesh.height = height
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.9
	mi.material_override = mat
	return mi

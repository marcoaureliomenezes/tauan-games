# forests.gd — florestas com DESIGN (SPEC §M-03): 5 espécies em MultiMesh,
# densidade por bioma (encosta úmida × vale × árido), clusters com ruído de
# agrupamento, variação de escala/rotação/tinta. NADA de distribuição uniforme.
class_name BangForests
extends Node3D

const SPECIES := [
	{ "key": "pine", "file": "res://assets/models/vegetation/pine_tree.tscn",
	  "count": 900, "scale": [0.8, 1.5], "tint": [Color(0.85, 1.0, 0.85), Color(1.05, 1.05, 1.0)] },
	{ "key": "leaf", "file": "res://assets/models/vegetation/tree.tscn",
	  "count": 650, "scale": [0.8, 1.4], "tint": [Color(0.9, 1.0, 0.85), Color(1.05, 1.0, 0.9)] },
	{ "key": "dead", "file": "res://assets/models/vegetation/dead_branch.tscn",
	  "count": 160, "scale": [0.9, 1.6], "tint": [Color(1.0, 0.95, 0.85), Color(1.0, 1.0, 1.0)] },
	{ "key": "bush", "file": "res://assets/models/vegetation/bush.tscn",
	  "count": 380, "scale": [0.9, 1.8], "tint": [Color(0.9, 1.0, 0.9), Color(1.0, 1.0, 1.0)] },
	{ "key": "grass", "file": "res://assets/models/vegetation/grass.tscn",
	  "count": 3200, "scale": [0.8, 1.6], "tint": [Color(0.85, 1.0, 0.8), Color(1.0, 1.0, 0.9)] },
]

var terrain: Node = null
var gen: Dictionary = {}
var counts := {}   # key → instâncias realmente plantadas (diagnóstico/testes)

var _density := FastNoiseLite.new()
var _cluster := FastNoiseLite.new()
var _moist := FastNoiseLite.new()
var _rng := RandomNumberGenerator.new()

func build(p_terrain: Node, p_gen: Dictionary, world_seed: int) -> void:
	terrain = p_terrain
	gen = p_gen
	_rng.seed = world_seed
	for n in [_density, _cluster, _moist]:
		n.fractal_octaves = 3
	_density.seed = world_seed + 31
	_cluster.seed = world_seed + 37
	_moist.seed = world_seed + 41
	_density.frequency = 0.002
	_cluster.frequency = 0.006
	_moist.frequency = 0.0015
	for sp in SPECIES:
		_scatter_species(sp)

# densidade-alvo da espécie num ponto (0..1) — regras de bioma
func _target_density(key: String, x: float, z: float, h: float, slope: float) -> float:
	var moist := _moist.get_noise_2d(x, z) * 0.5 + 0.5
	var cl := _cluster.get_noise_2d(x, z) * 0.5 + 0.5
	match key:
		"pine":
			# encostas úmidas nas montanhas, em bosques (cluster alto)
			return clampf(slope * 1.6, 0.0, 1.0) * moist * smoothstep(0.45, 0.7, cl)
		"leaf":
			# vale (baixo, plano), prefere perto de água mas não dentro
			var valley := 1.0 - clampf(h / 60.0, 0.0, 1.0)
			return valley * (1.0 - slope) * smoothstep(0.35, 0.65, cl)
		"dead":
			# zonas áridas (seca), espalhadas
			return (1.0 - moist) * 0.6
		"bush":
			return (1.0 - slope * 0.7) * smoothstep(0.4, 0.6, _density.get_noise_2d(x, z) * 0.5 + 0.5)
		"grass":
			var valley2 := 1.0 - clampf(h / 50.0, 0.0, 1.0)
			return valley2 * (1.0 - slope * 0.5) * smoothstep(0.3, 0.55, cl)
	return 0.0

func _scatter_species(sp: Dictionary) -> void:
	var mesh_res = load(sp["file"])
	if mesh_res == null:
		print("FOREST_WARN: modelo ausente ", sp["file"])
		return
	var mesh: Mesh = null
	if mesh_res is PackedScene:
		var inst = mesh_res.instantiate()
		mesh = _first_mesh(inst)
		inst.queue_free()
	elif mesh_res is Mesh:
		mesh = mesh_res
	if mesh == null:
		print("FOREST_WARN: sem malha em ", sp["file"])
		return
	# os materiais convertidos vêm em branco e os meshes NÃO têm vertex-color —
	# aplica albedo por espécie (a tinta por instância do MultiMesh varia em cima)
	var albedos := {
		"pine": Color(0.16, 0.34, 0.14),
		"leaf": Color(0.24, 0.42, 0.16),
		"dead": Color(0.45, 0.40, 0.33),
		"bush": Color(0.22, 0.40, 0.18),
		"grass": Color(0.40, 0.50, 0.22),
	}
	for si in range(mesh.get_surface_count()):
		var sm := StandardMaterial3D.new()
		sm.albedo_color = albedos.get(sp["key"], Color(0.3, 0.4, 0.2))
		sm.roughness = 1.0
		mesh.surface_set_material(si, sm)

	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = mesh
	var transforms: Array[Transform3D] = []
	var colors: Array[Color] = []
	var half := 1024.0
	var attempts: int = sp["count"] * 6
	var step := 2048.0 / 64.0
	for i in range(attempts):
		var gx := _rng.randi_range(0, 63)
		var gz := _rng.randi_range(0, 63)
		var x := -half + (gx + _rng.randf()) * step
		var z := -half + (gz + _rng.randf()) * step
		var h: float = terrain.height_at(x, z)
		var hx: float = terrain.height_at(x + 3, z) - terrain.height_at(x - 3, z)
		var hz: float = terrain.height_at(x, z + 3) - terrain.height_at(x, z - 3)
		var slope := clampf(Vector2(hx, hz).length() / 6.0, 0.0, 1.0)
		if _target_density(sp["key"], x, z, h, slope) < _rng.randf():
			continue
		if _in_water(x, z, h):
			continue
		var s: float = _rng.randf_range(sp["scale"][0], sp["scale"][1])
		var t := Transform3D(Basis(Vector3.UP, _rng.randf() * TAU).scaled(Vector3(s, s, s)), Vector3(x, h, z))
		transforms.append(t)
		var c0: Color = sp["tint"][0]
		var c1: Color = sp["tint"][1]
		colors.append(c0.lerp(c1, _rng.randf()))
		if transforms.size() >= sp["count"]:
			break
	mm.instance_count = transforms.size()
	mm.visible_instance_count = transforms.size()
	for i in range(transforms.size()):
		mm.set_instance_transform(i, transforms[i])
		mm.set_instance_color(i, colors[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.name = "Forest_" + sp["key"]
	mmi.multimesh = mm
	add_child(mmi)
	counts[sp["key"]] = transforms.size()
	print("FOREST_PLANTED ", sp["key"], "=", transforms.size())

func _first_mesh(n: Node) -> Mesh:
	if n is MeshInstance3D:
		return n.mesh
	for c in n.get_children():
		var m := _first_mesh(c)
		if m:
			return m
	return null

func _in_water(x: float, z: float, h: float) -> bool:
	# dentro do canal do rio ou do lago
	if h <= gen["lake_y"] + 0.5:
		return true
	for r in gen["rivers"]:
		for p in r["points"]:
			if Vector2(x + 1024, z + 1024).distance_to(p) < 7.0:
				return true
	return false

# entities.gd — orquestrador das entidades vivas (SPEC §6): spawns
# determinísticos de bandidos, veados, cobras, águias, arqueiros e NPCs.
class_name BangEntities
extends Node3D

const BanditScript = preload("res://scripts/entities/bandit.gd")
const DeerScript = preload("res://scripts/entities/deer.gd")
const SnakeScript = preload("res://scripts/entities/snake.gd")
const ArcherScript = preload("res://scripts/entities/archer.gd")
const EagleScript = preload("res://scripts/entities/eagle.gd")
const DuckScript = preload("res://scripts/entities/duck.gd")

var terrain: Node = null
var bandits: Array = []
var deer: Array = []
var snakes: Array = []
var archers: Array = []
var eagles: Array = []
var npcs: Array = []
var ducks: Array = []

func build(p_terrain: Node, settlements: Node, world_seed: int) -> void:
	terrain = p_terrain
	var rng := RandomNumberGenerator.new()
	rng.seed = world_seed + 909
	var camp: Vector3 = settlements.sites["camp"]
	# 5 bandidos: ≥200 m entre si, ≥250 m do acampamento
	var placed: Array = []
	var guard := 0
	while bandits.size() < 5 and guard < 200:
		guard += 1
		var p := _scatter(rng, 700)
		if p.distance_to(camp) < 250.0:
			continue
		var ok := true
		for q in placed:
			if p.distance_to(q) < 200.0:
				ok = false
		if not ok:
			continue
		placed.append(p)
		_spawn_actor(BanditScript, "res://assets/models/actors/Cowboy.tscn", p, bandits)
	# 3 bandos de veados (4–6 por bando)
	for herd in range(3):
		var c := _scatter(rng, 620)
		for i in range(rng.randi_range(4, 6)):
			var p := c + Vector3(rng.randf_range(-15, 15), 0, rng.randf_range(-15, 15))
			p.y = terrain.height_at(p.x, p.z)
			_spawn_actor(DeerScript, "res://assets/models/actors/Deer.tscn", p, deer)
	# 12 cobras (zonas rochosas — mais para a borda)
	for i in range(12):
		var p := _scatter(rng, 780)
		_spawn_actor(SnakeScript, "res://assets/models/actors/Snake.tscn", p, snakes)
	# 4 águias
	for i in range(4):
		var e = EagleScript.new()
		e.center = _scatter(rng, 500)
		e.height = 45.0 + rng.randf() * 20.0
		var model = load("res://assets/models/actors/Eagle.tscn").instantiate()
		e.add_child(model)
		add_child(e)
		eagles.append(e)
	# 8 arqueiros por aldeia
	for vi in range(2):
		var vc: Vector3 = settlements.sites["villages"][vi]
		for i in range(8):
			var a := TAU * i / 8
			var p := vc + Vector3(cos(a) * 14.0, 0, sin(a) * 14.0)
			p.y = terrain.height_at(p.x, p.z)
			_spawn_actor(ArcherScript, "res://assets/models/actors/Native.tscn", p, archers)
	# 4 NPCs passeando por cidade
	for ti in range(2):
		var tc: Vector3 = settlements.sites["towns"][ti]
		for i in range(4):
			var p := tc + Vector3(rng.randf_range(-3, 3), 0, rng.randf_range(-14, 14))
			p.y = terrain.height_at(p.x, p.z)
			var model_path := "res://assets/models/actors/Cowboy.tscn" if i % 2 == 0 else "res://assets/models/actors/Woman.tscn"
			_spawn_actor(BanditScript, model_path, p, npcs)   # NPC passeia (mesmo wander)
	# bando de 10 patos sobre o lago (caça: 1 tiro, cai em balística)
	var lake_c2: Vector2 = p_terrain.gen["lake_center"] - Vector2(1024, 1024)
	var lake_pos := Vector3(lake_c2.x, p_terrain.gen["lake_y"], lake_c2.y)
	for i in range(10):
		var d = DuckScript.new()
		d.setup(p_terrain)
		d.setup_flock(lake_pos, 30.0 + rng.randf() * 25.0, rng.randf() * TAU,
			rng.randf_range(0.18, 0.30) * (1.0 if i % 2 == 0 else -1.0), rng.randf_range(10.0, 18.0))
		var dmodel = load("res://assets/models/actors/Eagle.tscn").instantiate()
		dmodel.scale = Vector3(0.55, 0.55, 0.55)   # sem asset de pato — águia menor
		d.add_child(dmodel)
		add_child(d)
		ducks.append(d)
	print("ENTITIES_BUILT bandits=%d deer=%d snakes=%d archers=%d eagles=%d npcs=%d ducks=%d" % [
		bandits.size(), deer.size(), snakes.size(), archers.size(), eagles.size(), npcs.size(), ducks.size()])

func _scatter(rng: RandomNumberGenerator, radius: float) -> Vector3:
	var a := rng.randf() * TAU
	var r := rng.randf() * radius
	var x := cos(a) * r
	var z := sin(a) * r
	return Vector3(x, terrain.height_at(x, z), z)

func _spawn_actor(script: GDScript, model_path: String, pos: Vector3, list: Array) -> void:
	var e = script.new()
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.5
	cap.height = 1.8
	shape.shape = cap
	shape.position.y = 0.9
	e.add_child(shape)
	var model = load(model_path)
	if model:
		var m = model.instantiate()
		e.add_child(m)
		var ap = m.get_node_or_null("AnimationPlayer") as AnimationPlayer
		if ap == null:
			ap = _find_anim(m)
		e.anim = ap
	add_child(e)
	e.setup(terrain)
	e.global_position = pos
	list.append(e)

func _find_anim(n: Node) -> AnimationPlayer:
	if n is AnimationPlayer:
		return n
	for c in n.get_children():
		var a := _find_anim(c)
		if a:
			return a
	return null

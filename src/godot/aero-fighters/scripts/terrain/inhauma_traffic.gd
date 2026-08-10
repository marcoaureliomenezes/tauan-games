class_name InhaumaTraffic
extends Node3D
## InhaumaTraffic — carros circulando nos corredores (port simplificado de
## inhauma-traffic.js): MG-238 com uma mão por pista (dual), demais bidirecional.
## ~40 veículos em 1 MultiMesh (transforms atualizados por frame).

const CARS_PER_CORRIDOR := 8
const BODY_COLORS := [Color(0.75, 0.75, 0.78), Color(0.65, 0.15, 0.12), Color(0.15, 0.25, 0.55),
	Color(0.85, 0.75, 0.3), Color(0.25, 0.25, 0.28), Color(0.9, 0.9, 0.9)]

var _cars: Array[Dictionary] = [] # {c, d, dir, speed, lane}
var _mm: MultiMesh
var _roads: InhaumaRoads
var _surface: Callable


func _init(roads: InhaumaRoads, surface_fn: Callable) -> void:
	_roads = roads
	_surface = surface_fn


func _ready() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 31337
	var speeds := {"highway": 22.0, "regional": 16.0, "street": 12.0}
	for ci in _roads.corridors.size():
		var c: Dictionary = _roads.corridors[ci]
		if c.points.size() < 4:
			continue
		var spd: float = speeds.get(c.kind, 14.0)
		for i in CARS_PER_CORRIDOR:
			var dir := 1 if i % 2 == 0 else -1
			var lane := 3.5 * dir if c.dual else 1.8 * dir
			_cars.append({"c": ci, "d": rng.randf() * c.heights.size(),
				"dir": dir, "speed": spd * rng.randf_range(0.85, 1.15), "lane": lane,
				"color": BODY_COLORS[rng.randi() % BODY_COLORS.size()]})
	# MultiMesh de carros (caixa + cabine via cor)
	var mesh := BoxMesh.new()
	mesh.size = Vector3(1.9, 1.3, 4.2)
	_mm = MultiMesh.new()
	_mm.transform_format = MultiMesh.TRANSFORM_3D
	_mm.use_colors = true
	_mm.mesh = mesh
	_mm.instance_count = _cars.size()
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = _mm
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.4
	mat.metallic = 0.3
	mmi.material_override = mat
	mmi.name = "Traffic"
	add_child(mmi)
	for i in _cars.size():
		_mm.set_instance_color(i, _cars[i].color)
	_update_cars(0.0)


func _physics_process(delta: float) -> void:
	# Transforms do MultiMesh no tick de FÍSICA (Wave G: em _process disparava
	# "[Physics interpolation] triggered from outside physics process" c/ backtrace
	# a cada frame em builds debug)
	if GameState.paused:
		return
	_update_cars(delta)


func _update_cars(dt: float) -> void:
	for i in _cars.size():
		var car := _cars[i]
		var c: Dictionary = _roads.corridors[car.c]
		var n: int = c.points.size()
		car.d = fposmod(car.d + car.dir * car.speed * dt / 12.0, n) # pontos a cada ~12 m
		var i0 := int(car.d) % n
		var i1 := (i0 + 1) % n
		var t: float = car.d - int(car.d)
		var p: Vector2 = c.points[i0].lerp(c.points[i1], t)
		var h: float = lerpf(c.heights[i0], c.heights[i1], t)
		var dir2: Vector2 = (c.points[i1] - c.points[i0]).normalized() * car.dir
		var perp: Vector2 = Vector2(-dir2.y, dir2.x) * car.lane
		var yaw := atan2(dir2.x, dir2.y)
		var basis := Basis(Vector3.UP, yaw)
		_mm.set_instance_transform(i, Transform3D(basis,
			Vector3(p.x + perp.x, h + 0.7, p.y + perp.y)))

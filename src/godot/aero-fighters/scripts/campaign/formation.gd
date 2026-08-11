class_name Formation
extends Node3D
## Formation — formação militar (port de formations/formation.js, simplificado:
## rotas são templates pré-validados do web — sem validação de exclusões v0.1;
## rio/estradas reais entram com o polish do mapa).
## Membros são Targets (fluxo de dano/score/homing já existente).
## Estados: transit → arrived (invasão!) | deployed (artilharia) | static | loop.

const DEFS := {
	"supplyConvoy": {"spacing": 16.0, "moving": true, "units": ["fTruck"]},
	"tankPlatoon": {"spacing": 18.0, "moving": true, "units": ["fTank"]},
	"armoredColumn": {"spacing": 17.0, "moving": true, "units": ["fTank", "fApc"]},
	"troopColumn": {"spacing": 9.0, "moving": true, "units": ["fTroops", "fTroops", "fTroops", "fTroops", "fApc"]},
	"artilleryBattery": {"spacing": 16.0, "moving": true, "deploys": true, "units": ["fArtillery", "fArtillery", "fArtillery", "fTruck"]},
	"encampment": {"spacing": 12.0, "moving": false, "units": ["fTank", "fApc", "fTruck", "fTroops"]},
	"samSite": {"spacing": 14.0, "moving": false, "units": ["fSam", "fAaGun", "fAaGun"]},
	"aaNest": {"spacing": 10.0, "moving": false, "units": ["fAaGun"]},
}

var id := ""
var type := ""
var state := "transit" # transit | deployed | arrived | static
var loop := false
var members: Array[Target] = []
var path_length := 0.0
var progress := 0.0
var speed := 0.0
var max_back := 0.0

var _points: PackedVector2Array # path denso (4 m)
var _cum: PackedFloat32Array
var _surface: Callable


## path: Array de Vector2 (waypoints esparsos). surface_fn(x,z) -> float.
## Para formações estáticas, path = [âncora]. rng obrigatório (determinismo).
static func create(p_type: String, size: int, path: Array, surface_fn: Callable,
		rng: RandomNumberGenerator, p_id := "", p_loop := false) -> Formation:
	var def: Dictionary = DEFS[p_type]
	var f := Formation.new()
	f.id = p_id if p_id else "%s#%d" % [p_type, randi()]
	f.type = p_type
	f.loop = p_loop
	f._surface = surface_fn
	var n := clampi(size, 5, 25)
	var units: Array = def.units
	var spacing: float = def.spacing
	# Membros
	for i in n:
		var unit: String = units[i % units.size()]
		var t := Target.create(unit, Vector3.ZERO)
		f.members.append(t)
		f.add_child(t)
		t.fire_timer = 1.0 + rng.randf() * 2.0
		f.max_back = maxf(f.max_back, i * spacing)
	f.speed = INF
	for m in f.members:
		f.speed = minf(f.speed, m.unit_speed)
	if def.moving:
		f._densify(path)
		f.progress = f.max_back # nasce inteira sobre o path
		f._place()
	else:
		f.state = "static"
		# Cluster estático: anel de ângulo áureo com jitter seedado
		var anchor: Vector2 = path[0]
		for i in f.members.size():
			var r: float = spacing * (0.6 + 1.1 * sqrt(i))
			var a: float = i * 2.399963 + rng.randf_range(-0.25, 0.25)
			var x: float = anchor.x + cos(a) * r
			var z: float = anchor.y + sin(a) * r
			var m := f.members[i]
			m.position = Vector3(x, surface_fn.call(x, z) + m.unit_alt, z)
			m.rotation.y = rng.randf() * TAU
	return f


## Patrulha aérea em circuito fechado (path fecha: último ponto = primeiro).
static func create_air_patrol(unit: String, path: Array, surface_fn: Callable,
		p_id := "") -> Formation:
	var f := Formation.new()
	f.id = p_id
	f.type = "airPatrol"
	f.loop = true
	f._surface = surface_fn
	var t := Target.create(unit, Vector3.ZERO)
	f.members.append(t)
	f.add_child(t)
	t.fire_timer = 1.0 + randf() * 2.0
	f.speed = t.unit_speed
	f.max_back = 0.0
	f._densify(path)
	f.progress = 0.0
	f._place()
	return f


func _densify(waypoints: Array) -> void:
	const STEP := 4.0
	_points.clear()
	for i in range(1, waypoints.size()):
		var a: Vector2 = waypoints[i - 1]
		var b: Vector2 = waypoints[i]
		var steps := maxi(1, int(a.distance_to(b) / STEP))
		for s in steps:
			_points.append(a.lerp(b, float(s) / steps))
	_points.append(waypoints[waypoints.size() - 1])
	_cum = PackedFloat32Array([0.0])
	for i in range(1, _points.size()):
		_cum.append(_cum[i - 1] + _points[i].distance_to(_points[i - 1]))
	path_length = _cum[_cum.size() - 1]


func _sample(d: float) -> Dictionary:
	d = clampf(d, 0.0, path_length - 0.001)
	var i := 0
	while i < _cum.size() - 2 and _cum[i + 1] < d:
		i += 1
	var t: float = (d - _cum[i]) / maxf(_cum[i + 1] - _cum[i], 0.001)
	var p := _points[i].lerp(_points[i + 1], t)
	var dir := (_points[i + 1] - _points[i]).normalized()
	return {"p": p, "dir": dir}


func _place() -> void:
	var idx := 0
	for m in members:
		if not is_instance_valid(m):
			continue
		var d := progress - idx * (max_back / maxf(members.size() - 1.0, 1.0)) if members.size() > 1 else progress
		d = clampf(d, 0.0, path_length - 0.001)
		var s := _sample(d)
		var y: float = _surface.call(s.p.x, s.p.y) + m.unit_alt
		m.position = Vector3(s.p.x, y, s.p.y)
		if s.dir.length() > 0.01:
			m.rotation.y = atan2(s.dir.x, s.dir.y)
		idx += 1


func update(dt: float) -> void:
	# Compacta membros mortos (wrecks somem com o Target; fileiras fecham)
	members = members.filter(func(m): return is_instance_valid(m))
	if members.is_empty():
		speed = 0.0
		return
	if state != "transit":
		return
	progress += speed * dt
	if progress >= path_length + max_back:
		if loop:
			progress -= path_length
		else:
			progress = path_length + max_back
			state = "deployed" if DEFS[type].get("deploys", false) else "arrived"
			if state == "deployed":
				_place()
			return
	_place()


func alive_count() -> int:
	return members.size()


func is_air() -> bool:
	return type == "airPatrol"

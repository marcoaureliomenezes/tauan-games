class_name TrafficManager
extends Node3D
## Tráfego ambiente da rodovia: caminhões (tanque, baú, cegonha), ambulâncias e
## carros comuns transitando nos DOIS sentidos. Não disputam a corrida, mas são
## sólidos — colisão com eles é acidente.

const KINDS := ["tanque", "bau", "cegonha", "ambulancia", "carro", "carro", "carro"]

var route: RouteBuilder
var density := 14

var _vehicles: Array[Dictionary] = []


func setup(p_route: RouteBuilder, seed_val: int) -> void:
	route = p_route
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_val
	for i in density:
		var kind: String = KINDS[rng.randi() % KINDS.size()]
		var body := AnimatableBody3D.new()
		body.name = "Traffic%d_%s" % [i, kind]
		body.sync_to_physics = true
		var visual := VehicleFactory.build_traffic_vehicle(kind, rng)
		body.add_child(visual)
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		var is_truck := kind in ["tanque", "bau", "cegonha"]
		box.size = Vector3(2.2, 2.6, 9.0) if is_truck else Vector3(1.8, 1.6, 4.2)
		shape.shape = box
		shape.position = Vector3(0, box.size.y * 0.5, -0.6 if is_truck else 0.0)
		body.add_child(shape)
		if kind == "ambulancia":
			var bar := VehicleLightbar.new()
			body.add_child(bar)
		add_child(body)
		var reverse := rng.randf() < 0.5
		(
			_vehicles
			. append(
				{
					"body": body,
					"s": rng.randf_range(120.0, route.track_len - 120.0),
					"dir": -1.0 if reverse else 1.0,
					"speed":
					rng.randf_range(9.0, 16.0) if is_truck else rng.randf_range(13.0, 21.0),
				}
			)
		)
	for v in _vehicles:
		_place(v)


func _physics_process(delta: float) -> void:
	for v in _vehicles:
		v["s"] += v["dir"] * v["speed"] * delta
		if v["s"] > route.track_len - 40.0:
			v["s"] = 50.0
		elif v["s"] < 40.0:
			v["s"] = route.track_len - 50.0
		_place(v)


func _place(v: Dictionary) -> void:
	var s: float = v["s"]
	var reverse: bool = v["dir"] < 0.0
	var pos := route.point_at(s)
	var ahead := route.point_at(clampf(s + v["dir"] * 3.0, 0.0, route.track_len))
	if ahead.distance_to(pos) < 0.2:
		return
	var travel := (ahead - pos).normalized()
	# Mão direita do próprio sentido de deslocamento.
	var lateral := travel.cross(Vector3.UP).normalized() * route.lane_center_offset(s)
	var body: AnimatableBody3D = v["body"]
	# Nariz dos visuais no +Z: -Z aponta para trás do deslocamento.
	body.global_transform = Transform3D(
		Basis.looking_at(pos - ahead, Vector3.UP), pos + lateral + Vector3.UP * 0.1
	)

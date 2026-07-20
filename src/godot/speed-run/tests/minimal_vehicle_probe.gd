extends SceneTree
## Repro mínimo: VehicleBody3D + 4 rodas sobre um chão plano, engine_force fixo.
## Uso: godot4 --headless -s tests/minimal_vehicle_probe.gd

var car: VehicleBody3D
var ticks := 0


func _initialize() -> void:
	var ground := StaticBody3D.new()
	var gshape := CollisionShape3D.new()
	var gbox := BoxShape3D.new()
	gbox.size = Vector3(200, 1, 200)
	gshape.shape = gbox
	ground.add_child(gshape)
	ground.position.y = -0.5
	root.add_child(ground)

	car = VehicleBody3D.new()
	car.mass = 100.0
	var cshape := CollisionShape3D.new()
	var cbox := BoxShape3D.new()
	cbox.size = Vector3(2, 0.8, 4)
	cshape.shape = cbox
	car.add_child(cshape)
	for i in 4:
		var w := VehicleWheel3D.new()
		w.position = Vector3(1.0 if i % 2 == 0 else -1.0, -0.2, 1.5 if i < 2 else -1.5)
		w.use_as_traction = i >= 2
		w.use_as_steering = i < 2
		w.wheel_radius = 0.4
		w.suspension_travel = 0.3
		car.add_child(w)
	car.position.y = 1.0
	root.add_child(car)
	car.engine_force = 500.0


func _physics_process(_delta: float) -> bool:
	ticks += 1
	car.engine_force = 500.0
	if ticks % 120 == 0:
		var touching := 0
		for w in car.get_children():
			if w is VehicleWheel3D and w.is_in_contact():
				touching += 1
		print(
			(
				"t=%d speed=%.2f y=%.2f wheels=%d"
				% [ticks, car.linear_velocity.length(), car.global_position.y, touching]
			)
		)
	return ticks >= 600

# probe.gd — sonda EMPÍRICA das convenções do VehicleBody3D em chão plano:
# sinal do engine_force (frente = -Z?), sinal do steering (positivo = esquerda?)
# e estabilidade (carro quica/voa parado?). Roda headless e imprime medições.
extends Node3D

const CarF := preload("res://scripts/car_factory.gd")

var car: VehicleBody3D
var t := 0.0
var phase := 0
var start_pos := Vector3.ZERO
var max_y := 0.0

func _ready() -> void:
	var ground := StaticBody3D.new()
	var col := CollisionShape3D.new()
	col.shape = WorldBoundaryShape3D.new()
	ground.add_child(col)
	add_child(ground)
	car = CarF.build("idea")
	car.global_transform = Transform3D(Basis(), Vector3(0, 1.0, 0))  # frente = -Z global
	add_child(car)

func _physics_process(delta: float) -> void:
	t += delta
	max_y = maxf(max_y, car.global_position.y)
	if phase == 0 and t > 1.5:            # assentou
		print("SETTLE y=%.3f maxy=%.3f vel=%.3f" % [
			car.global_position.y, max_y, car.linear_velocity.length()])
		start_pos = car.global_position
		max_y = 0.0
		phase = 1
	elif phase == 1:
		car.engine_force = 3000.0          # POSITIVO: para onde anda?
		if t > 4.5:
			var d := car.global_position - start_pos
			var fwd := -car.global_transform.basis.z
			print("ENGINE+ dz=%.2f dx=%.2f along_fwd=%.2f speed=%.2f" % [
				d.z, d.x, d.dot(fwd), car.linear_velocity.length()])
			phase = 2
	elif phase == 2:
		car.steering = 0.4                 # POSITIVO: vira para onde?
		if t > 7.0:
			var d2 := car.global_position - start_pos
			print("STEER+ dx=%.2f dz=%.2f heading_y=%.2f maxy=%.3f" % [
				d2.x, d2.z, car.rotation.y, max_y])
			_setup_ram()
			phase = 3
	elif phase == 3:
		# TRANSFERÊNCIA DE MOMENTO: A (idea, em movimento) abalroa B (pickup,
		# parada). p = m·v deve se conservar aproximadamente na normal.
		car.engine_force = 0.0
		if t > 10.0:
			var va := car.linear_velocity.length()
			var vb := target.linear_velocity.length()
			var pa: float = car.mass * va
			var pb: float = target.mass * vb
			print("RAM after: vA=%.2f vB=%.2f  pA=%.0f pB=%.0f pSum=%.0f (p0=%.0f)" % [
				va, vb, pa, pb, pa + pb, _p0])
			print("RAM %s" % ("PASS" if vb > 2.0 else "FAIL: B não se moveu"))
			get_tree().quit(0 if vb > 2.0 else 1)

var target: VehicleBody3D
var _p0 := 0.0

func _setup_ram() -> void:
	car.steering = 0.0
	car.rotation = Vector3.ZERO
	car.global_position = Vector3(0, 0.5, 0)
	car.linear_velocity = Vector3(0, 0, -22)   # 80 km/h para -Z
	car.angular_velocity = Vector3.ZERO
	_p0 = car.mass * 22.0
	target = CarF.build("pickup")
	target.global_transform = Transform3D(Basis(), Vector3(0, 0.5, -18))
	add_child(target)
	print("RAM before: A(idea %.0fkg)@22m/s → B(pickup %.0fkg)@0" % [car.mass, target.mass])

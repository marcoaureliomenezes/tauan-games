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
			get_tree().quit(0)

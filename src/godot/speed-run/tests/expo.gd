# expo.gd — vitrine da réplica: 4 vistas paradas p/ validação visual
extends Node3D
const CarF := preload("res://scripts/car_factory.gd")
var cam: Camera3D
var car: VehicleBody3D
var t := 0.0
var shot := 0
var views := [
	[Vector3(5.5, 1.5, 3.5), Vector3(0, 0.8, 0)],    # 3/4 frente
	[Vector3(6.0, 1.2, 0.0), Vector3(0, 0.8, 0)],    # lateral
	[Vector3(4.5, 1.6, -4.5), Vector3(0, 0.9, 0)],   # 3/4 traseira
	[Vector3(0.0, 1.3, -6.0), Vector3(0, 0.9, 0)],   # traseira (estepe)
]
func _ready() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	var sky := Sky.new(); var sm := ProceduralSkyMaterial.new()
	sky.sky_material = sm
	e.background_mode = Environment.BG_SKY; e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.environment = e; add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-45, 140, 0); sun.shadow_enabled = true
	add_child(sun)
	var ground := StaticBody3D.new()
	var gc := CollisionShape3D.new(); gc.shape = WorldBoundaryShape3D.new()
	ground.add_child(gc)
	var gm := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(60, 60)
	var mat := StandardMaterial3D.new(); mat.albedo_color = Color(0.45, 0.47, 0.44)
	gm.mesh = pm; gm.mesh.surface_set_material(0, mat)
	ground.add_child(gm); add_child(ground)
	car = CarF.build("idea")
	car.global_position = Vector3(0, 0.6, 0)
	add_child(car)
	cam = Camera3D.new(); cam.fov = 45; add_child(cam)
func _process(delta: float) -> void:
	t += delta
	var idx := mini(shot, views.size() - 1)
	cam.global_position = views[idx][0]
	cam.look_at(views[idx][1])
	if t > 1.2 + shot * 1.0 and shot < views.size():
		var dir := OS.get_environment("CORRIDA_SHOT")
		if dir != "":
			get_viewport().get_texture().get_image().save_png("%s/expo-%d.png" % [dir, shot])
		shot += 1
		if shot >= views.size():
			get_tree().quit(0)

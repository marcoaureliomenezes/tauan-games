# shot_closeup.gd — closes de QA: pernas/cascos, sela/pernas do cowboy, braço de tiro
extends SceneTree
const OUT := "/home/marco/workspace/dadaia/.dadaia/tmp/kimi/20260719/gallery/"
func _init():
	_run.call_deferred()
func _snap(vp, name):
	for i in range(4):
		await process_frame
	print("DBG cam=", (get_root().get_child(1) if false else null), " pos=", _cam_pos)
	vp.get_texture().get_image().save_png(OUT + name + ".png")
	print("SHOT ", name)

var _cam_pos := Vector3.ZERO
func _run() -> void:
	var vp := SubViewport.new()
	vp.size = Vector2i(1000, 700)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	get_root().add_child(vp)
	var root := Node3D.new()
	vp.add_child(root)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, -30, 0)
	root.add_child(sun)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.5, 0.65, 0.8)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.75, 0.75, 0.75)
	env.environment = e
	root.add_child(env)
	var ground := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(40, 40)
	ground.mesh = pm
	root.add_child(ground)
	var hm = load("res://assets/models/horseman.tscn").instantiate()
	root.add_child(hm)
	var anim: AnimationPlayer = hm.get_node("AnimationPlayer")
	var gun: AnimationPlayer = hm.get_node("RiderFollow/Rider/AnimationPlayer")
	gun.play(&"CharacterArmature|Idle", 0.1)
	var cam := Camera3D.new()
	root.add_child(cam)
	cam.current = true
	# WALK a meio da passada
	anim.play(&"AnimalArmature|Walk", 0.0)
	for i in range(25):
		await process_frame
	# 1) close nas pernas da frente (lado)
	cam.global_position = Vector3(2.2, 0.7, 1.2)
	cam.look_at(Vector3(0, 0.6, 1.2))
	_cam_pos = cam.global_position
	await _snap(vp, "close_legs_walk")
	# 2) close 3/4 frontal cavaleiro (sela, pernas, chapéu)
	cam.global_position = Vector3(2.4, 2.0, 2.6)
	cam.look_at(Vector3(0, 1.5, 0))
	_cam_pos = cam.global_position
	await _snap(vp, "close_rider_34")
	# 3) close traseira (pernas nos estribos, sela)
	cam.global_position = Vector3(1.8, 1.6, -2.6)
	cam.look_at(Vector3(0, 1.4, 0))
	await _snap(vp, "close_rider_back")
	# 4) braço de tiro (Idle_Gun_Pointing) de perto
	gun.play(&"CharacterArmature|Idle_Gun_Pointing", 0.1)
	anim.play(&"AnimalArmature|Idle", 0.1)
	for i in range(20):
		await process_frame
	cam.global_position = Vector3(1.6, 2.0, 1.6)
	cam.look_at(Vector3(0, 1.9, 0.3))
	await _snap(vp, "close_gun_arm")
	# 5) galope a meio do salto — pernas/cascos
	anim.play(&"AnimalArmature|Gallop", 0.0)
	for i in range(14):
		await process_frame
	cam.global_position = Vector3(3.0, 0.9, 0.6)
	cam.look_at(Vector3(0, 0.9, 0.3))
	await _snap(vp, "close_gallop_legs")
	quit()

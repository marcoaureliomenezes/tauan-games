extends SceneTree
const OUT := "/home/marco/workspace/dadaia/.dadaia/tmp/kimi/20260719/gallery/"
func _init():
	_run.call_deferred()
func _run() -> void:
	DirAccess.make_dir_recursive_absolute(OUT)
	var vp := SubViewport.new()
	vp.name = "SubViewport"
	vp.size = Vector2i(900, 700)
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
	e.ambient_light_color = Color(0.7, 0.7, 0.7)
	env.environment = e
	root.add_child(env)
	var ground := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(40, 40)
	ground.mesh = pm
	root.add_child(ground)
	var hm = load("res://assets/models/horseman.tscn").instantiate()
	root.add_child(hm)
	var anim: AnimationPlayer = null
	for c in hm.get_children():
		if c is AnimationPlayer:
			anim = c
	if anim:
		anim.play(&"AnimalArmature|Idle", 0.1)
	# player do cowboy: Idle (pernas em pose de montaria, braços animam)
	var rider = hm.find_child("Rider", true, false)
	if rider:
		for c in rider.get_children():
			if c is AnimationPlayer:
				c.play(&"CharacterArmature|Idle", 0.1)
	var cam := Camera3D.new()
	root.add_child(cam)
	cam.current = true
	for i in range(30):
		await process_frame
	var angles := {"side": PI / 2, "back": PI, "q34": -PI / 4, "front": 0.0}
	for aname in angles:
		var a: float = angles[aname]
		cam.global_position = Vector3(sin(a) * 4.5, 1.8, cos(a) * 4.5)
		cam.look_at(Vector3(0, 1.2, 0))
		await process_frame
		await process_frame
		var img: Image = vp.get_texture().get_image()
		img.save_png(OUT + "quick_" + aname + ".png")
		print("SHOT ", aname)
	quit()

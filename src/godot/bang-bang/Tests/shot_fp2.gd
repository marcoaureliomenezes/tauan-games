# shot_fp2.gd — lê as transforms REAIS de cam1/cam3 do rig e replica numa
# câmera de debug (captura confiável) para validar o enquadramento.
extends SceneTree
const OUT := "/home/marco/workspace/dadaia/.dadaia/tmp/kimi/20260719/gallery/"
var vp: SubViewport
var dbg: Camera3D
var rig = null
func _init():
	_run.call_deferred()
func _snap(name):
	rig.cam1.current = false
	rig.cam3.current = false
	dbg.current = true
	await process_frame
	await process_frame
	print("CAMNOW ", name, " cam=", vp.get_camera_3d(), " dbgpos=", dbg.global_position)
	vp.get_texture().get_image().save_png(OUT + name + ".png")
	print("SHOT ", name)
func _run() -> void:
	vp = SubViewport.new()
	vp.size = Vector2i(1152, 648)
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
	e.background_color = Color(0.6, 0.7, 0.85)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.7, 0.7, 0.7)
	env.environment = e
	root.add_child(env)
	var ground := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(60, 60)
	var gm := StandardMaterial3D.new()
	gm.albedo_color = Color(0.55, 0.5, 0.3)
	ground.material_override = gm
	ground.mesh = pm
	root.add_child(ground)
	var PlayerScript = preload("res://scripts/player/player.gd")
	var player = PlayerScript.new()
	root.add_child(player)
	for i in range(30):
		await process_frame
	var rider = player.rider
	rig = rider.get_node("CameraRig")
	rig.pitch = 0.08
	for i in range(10):
		await process_frame
	dbg = Camera3D.new()
	dbg.far = 500.0
	dbg.fov = 70.0
	root.add_child(dbg)
	print("IDS dbg=", dbg.get_instance_id(), " cam3=", rig.cam3.get_instance_id(), " cam1=", rig.cam1.get_instance_id())
	# replica EXATA da cam3 (zoom default / min / max)
	for spec in [["qa3_third_default", 6.5], ["qa3_third_zoom_min", 2.5], ["qa3_third_zoom_max", 9.0]]:
		rig.cam3_arm.spring_length = spec[1]
		await process_frame
		await process_frame
		dbg.global_transform = rig.cam3.global_transform
		dbg.current = true
		await _snap(spec[0])
	# replica EXATA da cam1 (1ª pessoa) — com o braço em pose de mira
	var gun: AnimationPlayer = rider.get_node("Horseman/RiderFollow/Rider/AnimationPlayer")
	gun.play(&"CharacterArmature|Idle_Gun_Pointing", 0.1)
	rig.first_person = true
	rig._apply_mode()
	# variante espingarda: visibilidade via weapon no Game
	var g = get_root().get_node_or_null("Game")
	if g:
		g.player["weapon"] = &"shotgun"
	dbg.global_transform = rig.cam1.global_transform
	dbg.current = true
	for i in range(10):
		await process_frame
	await _snap("qa3_first_shotgun")
	if g:
		g.player["weapon"] = &"revolver"
	dbg.global_transform = rig.cam1.global_transform
	dbg.current = true
	for i in range(3):
		await process_frame
	for i in range(12):
		await process_frame
	print("DBG cam1 world=", rig.cam1.global_position, " fwd=", -rig.cam1.global_transform.basis.z)
	dbg.global_transform = rig.cam1.global_transform
	dbg.current = true
	await _snap("qa3_first_revolver")
	print("FP2_DONE")
	quit()

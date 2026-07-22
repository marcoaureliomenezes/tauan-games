extends SceneTree
const OUT := "/home/marco/workspace/dadaia/.dadaia/tmp/kimi/20260719/gallery/"
var vp: SubViewport
func _init():
	_run.call_deferred()
func _run() -> void:
	vp = SubViewport.new()
	vp.size = Vector2i(1152, 648)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	get_root().add_child(vp)
	var main = load("res://scenes/main.tscn").instantiate()
	vp.add_child(main)
	for i in range(90):
		await process_frame
	print("STAGE world ready")
	main._begin()
	for i in range(30):
		await process_frame
	var rider = main.get_node("Player").rider
	var world = main.get_node("World")
	rider.global_position = Vector3(0, world.terrain.height_at(0, 0) + 0.1, 0)
	rider.rotation.y = 0.0
	var rig = rider.get_node("CameraRig")
	rig.pitch = 0.1
	print("STAGE rider pos")
	for i in range(30):
		await process_frame
		if i % 5 == 0:
			print("STAGE frame ", i)
	print("STAGE snap1")
	_snap("qa_third_default")
	# zoom mínimo e máximo
	rig.cam3_arm.spring_length = 2.5
	for i in range(5):
		await process_frame
	_snap("qa_third_zoom_min")
	rig.cam3_arm.spring_length = 9.0
	for i in range(5):
		await process_frame
	_snap("qa_third_zoom_max")
	# 1ª pessoa
	rig.first_person = true
	rig._apply_mode()
	for i in range(20):
		await process_frame
	_snap("qa_first_revolver")
	# espingarda na 1ª
	Input.action_press("weapon_2")
	await process_frame
	Input.action_release("weapon_2")
	for i in range(15):
		await process_frame
	_snap("qa_first_shotgun")
	Input.action_press("weapon_1")
	await process_frame
	Input.action_release("weapon_1")
	# veado à frente + trava + tiro: projétil em voo e sangue
	var combat = rider.get_node("Combat")
	var deer = world.entities.deer[0]
	deer.global_position = rider.global_position + Vector3(0, 0, 25.0)
	combat.lock_target = deer
	var g = get_root().get_node("Game")
	g.player["lock_target"] = deer
	for i in range(25):
		await process_frame
	_snap("qa_lock_deer_third")
	combat._cool = 0.0
	combat._try_fire()
	await physics_frame
	await physics_frame
	await physics_frame
	_snap("qa_projectile_flight")
	for i in range(30):
		await physics_frame
	_snap("qa_blood_hit")
	print("QA_DONE")
	quit()
func _snap(name: String) -> void:
	var img: Image = vp.get_texture().get_image()
	img.save_png(OUT + name + ".png")
	print("SHOT ", name)

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
	for i in range(150):
		await process_frame
	main._begin()
	for i in range(30):
		await process_frame
	var rider = main.get_node("Player").rider
	var world = main.get_node("World")
	var lc: Vector2 = world.terrain.gen["lake_center"] - Vector2(1024, 1024)
	# margem do lago, olhando para o bando
	rider.global_position = Vector3(lc.x + 70, world.terrain.height_at(lc.x + 70, lc.y) + 0.1, lc.y)
	rider.rotation.y = -PI / 2   # olhar para -x (o lago)
	var rig = rider.get_node("CameraRig")
	rig.yaw = PI / 2
	rig.pitch = 0.12
	for i in range(40):
		await process_frame
	_snap("game_lake_ducks")
	# trava num pato e deixa a câmera acompanhar
	var combat = rider.get_node_or_null("Combat")
	var ducks = world.entities.ducks
	if combat and ducks.size() > 0:
		combat.lock_target = ducks[0]
		var g = get_root().get_node("Game")
		g.player["lock_target"] = ducks[0]
		g.player["lock_name"] = &"pato"
		for i in range(40):
			await process_frame
		_snap("game_lock_duck")
	print("HUNT_SHOTS_DONE")
	quit()
func _snap(name: String) -> void:
	var img: Image = vp.get_texture().get_image()
	img.save_png(OUT + name + ".png")
	print("SHOT ", name)

# probe_motion.gd — valida EM JOGO: W = frente real, pernas do cavalo animando
# em loop durante o galope, e captura um frame em movimento.
extends SceneTree
const OUT := "/home/marco/workspace/dadaia/.dadaia/tmp/kimi/20260719/gallery/"

var vp: SubViewport

func _init():
	_run.call_deferred()

func _run() -> void:
	vp = SubViewport.new()
	vp.name = "ShotVP"
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
	var hskel: Skeleton3D = rider.get_node_or_null("Horseman/RootNode/AnimalArmature/Skeleton3D")
	var leg := hskel.find_bone("FrontLowerLeg.L")
	var start: Vector3 = rider.global_position
	var fwd: Vector3 = rider.global_transform.basis.z
	# segura W + Shift (galope)
	Input.action_press("move_forward")
	Input.action_press("gallop")
	var prev := Vector3.ZERO
	var moves := 0
	for i in range(150):
		await process_frame
		var p: Vector3 = (hskel.global_transform * hskel.get_bone_global_pose(leg)).origin
		if i > 0 and p.distance_to(prev) > 0.01:
			moves += 1
		prev = p
		if i == 100:
			_snap("game_gallop_moving")
	Input.action_release("move_forward")
	Input.action_release("gallop")
	var disp: Vector3 = rider.global_position - start
	var dot := disp.normalized().dot(fwd)
	print("MOTION leg_frames=", moves, "/149")
	print("MOTION disp=", disp, " len=", disp.length(), " fwd_dot=", dot)
	print("MOTION gait=", rider.gait, " speed=", rider.speed)
	quit()

func _snap(name: String) -> void:
	var img: Image = vp.get_texture().get_image()
	img.save_png(OUT + name + ".png")
	print("SHOT ", name)

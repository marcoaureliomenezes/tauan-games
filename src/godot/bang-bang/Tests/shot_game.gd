# shot_game.gd — captura as visões REAIS do jogo (3ª e 1ª pessoa) rodando a cena
# main DENTRO de um SubViewport próprio (o root viewport congela frames em modo -s).
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
	for i in range(60):
		await process_frame
	var rider = main.get_node("Player").rider
	var world = main.get_node("World")
	var t0 := Vector3(0, 0, 0)   # pradaria aberta — sem NPCs na frente da câmera
	rider.global_position = Vector3(t0.x, world.terrain.height_at(t0.x, t0.z) + 0.1, t0.z)
	rider.rotation.y = PI
	for i in range(30):
		await process_frame
	print("DBG vp_cam=", vp.get_camera_3d())
	await _snap("game_third_person")
	# teste decisivo: esconde o modelo do jogador — se a figura some, é o cowboy
	rider.get_node("Horseman").visible = false
	await _snap("game_third_person_nohidden")
	rider.get_node("Horseman").visible = true
	# 1ª pessoa
	var rig = rider.get_node_or_null("CameraRig")
	if rig:
		rig.yaw = PI   # olha para onde o cavalo aponta (rotation.y = PI acima)
		rig.first_person = true
		rig._apply_mode()
	for i in range(30):
		await process_frame
	await _snap("game_first_person")
	print("GAME_SHOTS_DONE")
	quit()

func _snap(name: String) -> void:
	await process_frame
	await process_frame
	var img: Image = vp.get_texture().get_image()
	img.save_png(OUT + name + ".png")
	print("SHOT ", name)

# gallery.gd — galeria de aceitação visual (T-BB-10): captura PNGs do
# personagem (poses × ângulos × câmeras) e do mundo (floresta, rio+ponte,
# trem, cidade, acampamento, lago). Rodar COM display:
#   DISPLAY=:0 godot4 --path src/godot/bang-bang -s res://Tests/gallery.gd
extends SceneTree

const BangTerrainScript = preload("res://scripts/world/terrain.gd")
const BangForestsScript = preload("res://scripts/world/forests.gd")
const BangWaterScript = preload("res://scripts/world/water.gd")
const BangSkyScript = preload("res://scripts/world/sky.gd")
const BangRailwayScript = preload("res://scripts/world/railway.gd")
const BangSettlementsScript = preload("res://scripts/settlements/settlements.gd")
const BangEntitiesScript = preload("res://scripts/entities/entities.gd")

const OUT := "/home/marco/workspace/dadaia/.dadaia/tmp/kimi/20260719/gallery/"

var cam: Camera3D
var rider
var terrain
var shots := 0

func _init() -> void:
	_run.call_deferred()

func snap(name: String) -> void:
	await process_frame
	await process_frame
	var img: Image = get_root().get_node("SubViewport").get_texture().get_image()
	img.save_png(OUT + name + ".png")
	shots += 1
	print("SHOT ", name)

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(OUT)
	var gs = get_root().get_node_or_null("Game")
	if gs == null:
		gs = preload("res://scripts/state.gd").new()
		gs.name = "Game"
		get_root().add_child(gs)
	gs.phase = &"playing"

	var vp := SubViewport.new()
	vp.name = "SubViewport"
	vp.size = Vector2i(1152, 648)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	get_root().add_child(vp)
	var root := Node3D.new()
	vp.add_child(root)
	terrain = BangTerrainScript.new()
	root.add_child(terrain)
	await terrain.build(1876)
	var water = BangWaterScript.new()
	root.add_child(water)
	water.build(terrain, terrain.gen)
	var forests = BangForestsScript.new()
	root.add_child(forests)
	forests.build(terrain, terrain.gen, 1876)
	var sky = BangSkyScript.new()
	root.add_child(sky)
	var railway = BangRailwayScript.new()
	root.add_child(railway)
	railway.build(terrain, 1876)
	var settlements = BangSettlementsScript.new()
	root.add_child(settlements)
	settlements.build(terrain, 1876)
	var entities = BangEntitiesScript.new()
	root.add_child(entities)
	entities.build(terrain, settlements, 1876)

	cam = Camera3D.new()
	cam.far = 2500.0
	root.add_child(cam)
	cam.current = true

	# --- HORSEMAN: poses × ângulos ---
	var hm = load("res://assets/models/horseman.tscn").instantiate()
	root.add_child(hm)
	var gy: float = terrain.height_at(0, 0)
	hm.global_position = Vector3(0, gy, 0)
	var anim: AnimationPlayer = _find_anim(hm)
	# player do COWBOY: o mesmo que o jogo usa (player.gd → RiderFollow/Rider/AnimationPlayer)
	var gun := hm.get_node_or_null("RiderFollow/Rider/AnimationPlayer") as AnimationPlayer
	var poses := {
		"idle": &"AnimalArmature|Idle",
		"walk": &"AnimalArmature|Walk",
		"gallop": &"AnimalArmature|Gallop",
		"gun": &"AnimalArmature|Idle",
	}
	var angles := ["front", "left", "back", "q34"]
	for pname in poses:
		anim.play(poses[pname], 0.1)
		# o player do cowboy toca Idle em TODAS as poses (pernas ficam na pose
		# de montaria — fcurves de pernas removidas no asset; braços animam)
		if pname == "gun":
			gun.play(&"CharacterArmature|Idle_Gun_Pointing", 0.1)
		else:
			gun.play(&"CharacterArmature|Idle", 0.1)
		print("GUN playing=", gun.is_playing(), " current=", gun.current_animation)
		for i in range(20):
			await process_frame
		for ai in range(angles.size()):
			var a: float = [-0.5, PI / 2, PI, -PI / 4][ai]
			var p: Vector3 = hm.global_position + Vector3(sin(a) * 5.5, 2.2, cos(a) * 5.5)
			cam.global_position = p
			cam.look_at(hm.global_position + Vector3(0, 1.4, 0))
			await snap("horseman_%s_%s" % [pname, angles[ai]])
	hm.queue_free()

	# --- MUNDO: floresta, rio+ponte, trem, cidade, acampamento, lago ---
	await _world_shot("forest", Vector3(60, 0, 60), Vector3(120, 0, -80))
	var b0 = water.bridges[0]["center"]
	await _world_shot("river_bridge", b0 + Vector3(14, 6, 14), b0)
	await _world_shot("train", railway.train_pos + Vector3(10, 6, 10), railway.train_pos)
	var t0: Vector3 = settlements.sites["towns"][0]
	# câmera no meio da rua principal, em altura de cavaleiro
	var t0y: float = terrain.height_at(t0.x, t0.z + 26.0)
	await _world_shot("town", Vector3(t0.x, t0y + 2.6, t0.z + 26.0), Vector3(t0.x, t0y + 2.0, t0.z - 18.0))
	var camp: Vector3 = settlements.sites["camp"]
	await _world_shot("camp", camp + Vector3(8, 4, 8), camp)
	var lc: Vector2 = terrain.gen["lake_center"] - Vector2(1024, 1024)
	await _world_shot("lake", Vector3(lc.x + 60, 30, lc.y + 60), Vector3(lc.x, terrain.gen["lake_y"], lc.y))
	await _world_shot("valley", Vector3(0, 60, 120), Vector3(0, 10, -200))

	print("GALLERY_DONE shots=", shots)
	quit()

func _find_skel(n: Node) -> Skeleton3D:
	if n is Skeleton3D:
		return n
	for c in n.get_children():
		var s = _find_skel(c)
		if s:
			return s
	return null

func _find_anim(n: Node) -> AnimationPlayer:
	if n is AnimationPlayer:
		return n
	for c in n.get_children():
		var a = _find_anim(c)
		if a:
			return a
	return null

func _world_shot(name: String, from: Vector3, to: Vector3) -> void:
	from.y = maxf(from.y, terrain.height_at(from.x, from.z) + 3.0)
	cam.global_position = from
	cam.look_at(to)
	await process_frame
	await process_frame
	await snap(name)

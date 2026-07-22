extends SceneTree
func _init():
	var ok := 0
	for f in ["TrainEngine", "TrainWagon"]:
		var doc := GLTFDocument.new()
		var state := GLTFState.new()
		var err := doc.append_from_file("res://assets/models/train/" + f + ".glb", state)
		if err != OK:
			print("FAIL ", f, err)
			continue
		var root = doc.generate_scene(state)
		root.name = f
		var ps := PackedScene.new()
		ps.pack(root)
		ResourceSaver.save(ps, "res://assets/models/train/" + f + ".tscn")
		ok += 1
	print("TRAIN_CONVERTED ok=", ok)
	quit(ok != 2)

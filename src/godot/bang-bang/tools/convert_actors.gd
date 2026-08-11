extends SceneTree
func _init():
	var ok := 0
	var fail := 0
	for f in ["Cowboy", "Woman", "Native", "Deer", "Snake", "Eagle"]:
		var doc := GLTFDocument.new()
		var state := GLTFState.new()
		var err := doc.append_from_file("res://assets/models/actors/" + f + ".glb", state)
		if err != OK:
			print("FAIL ", f, err)
			fail += 1
			continue
		var root = doc.generate_scene(state)
		root.name = f
		var ps := PackedScene.new()
		ps.pack(root)
		ResourceSaver.save(ps, "res://assets/models/actors/" + f + ".tscn")
		ok += 1
	print("ACTORS_CONVERTED ok=", ok, " fail=", fail)
	quit(fail)

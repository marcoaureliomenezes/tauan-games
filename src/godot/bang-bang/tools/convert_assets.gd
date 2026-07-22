# converte todos os .glb de um diretório para .tscn (sem depender do import)
extends SceneTree
func _init():
	var dir := "res://assets/models/vegetation"
	var da := DirAccess.open(dir)
	var ok := 0
	var fail := 0
	for f in da.get_files():
		if not f.ends_with(".glb"):
			continue
		var doc := GLTFDocument.new()
		var state := GLTFState.new()
		var err := doc.append_from_file(dir + "/" + f, state)
		if err != OK:
			print("CONVERT_FAIL ", f, " err=", err)
			fail += 1
			continue
		var root = doc.generate_scene(state)
		root.name = f.get_basename()
		var ps := PackedScene.new()
		ps.pack(root)
		var out := dir + "/" + f.get_basename() + ".tscn"
		ResourceSaver.save(ps, out)
		ok += 1
	print("CONVERTED ok=", ok, " fail=", fail)
	quit(fail)

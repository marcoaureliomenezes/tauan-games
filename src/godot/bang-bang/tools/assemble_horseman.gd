# assemble_horseman.gd — monta horseman.tscn: Horse.tscn (0.55) + actors/Cowboy.tscn
# montado no osso Torso2 via RiderFollow (merge de armaduras no Blender corrompia clips).
extends SceneTree

func _gltf_to_tscn(glb: String, tscn: String) -> int:
	var doc := GLTFDocument.new()
	var state := GLTFState.new()
	var err := doc.append_from_file(glb, state)
	if err != OK:
		return err
	var root = doc.generate_scene(state)
	root.name = glb.get_file().get_basename()
	var ps := PackedScene.new()
	ps.pack(root)
	return ResourceSaver.save(ps, tscn)

func _find_skel(n: Node) -> Skeleton3D:
	if n is Skeleton3D:
		return n
	for c in n.get_children():
		var s = _find_skel(c)
		if s:
			return s
	return null

func _own_rec(n: Node, owner: Node) -> void:
	n.owner = owner
	for c in n.get_children():
		_own_rec(c, owner)

func _init() -> void:
	_run.call_deferred()

func _run() -> void:
	var err := _gltf_to_tscn("res://assets/models/actors/Horse.glb", "res://assets/models/actors/Horse.tscn")
	if err != OK:
		print("HORSE_CONVERT_FAIL ", err)
		quit(1)
	var horse = load("res://assets/models/actors/Horse.tscn").instantiate()
	horse.name = "Horseman"
	# cavalo vem ~1.8× grande demais (withers 2.74m) — escala para ~1.51m
	var model := horse.get_node_or_null("RootNode") as Node3D
	if model:
		model.scale = Vector3(0.55, 0.55, 0.55)
	var skel: Skeleton3D = _find_skel(horse)
	var bone := skel.find_bone("Back")
	var cowboy = load("res://assets/models/actors/Cowboy.tscn").instantiate()
	cowboy.name = "Rider"
	var follow = load("res://scripts/player/rider_follow.gd").new()
	follow.name = "RiderFollow"
	horse.add_child(follow)
	follow.add_child(_make_saddle())
	follow.add_child(cowboy)

	# owner é OBRIGATÓRIO para entrar no pack (nós criados em código nascem sem)
	_own_rec(horse, horse)
	var ps := PackedScene.new()
	ps.pack(horse)
	err = ResourceSaver.save(ps, "res://assets/models/horseman.tscn")
	print("HORSEMAN_ASSEMBLED err=", err)
	quit(err != OK)

# sela western (couro): assento, espaldar, pommel com chifre, abas laterais,
# estribos — filha do RiderFollow (segue o osso Torso2 animado, base limpa)
func _make_saddle() -> Node3D:
	var root := Node3D.new()
	root.name = "Saddle"
	var leather := StandardMaterial3D.new()
	leather.albedo_color = Color(0.30, 0.19, 0.10)
	leather.roughness = 0.85
	var leather_d := StandardMaterial3D.new()
	leather_d.albedo_color = Color(0.20, 0.12, 0.06)
	leather_d.roughness = 0.9
	var metal := StandardMaterial3D.new()
	metal.albedo_color = Color(0.45, 0.42, 0.38)
	metal.metallic = 0.7
	metal.roughness = 0.4
	# geometria MEDIDA ao vivo (MCP): lombo do cavalo em y-mundo ≈1.70, barril
	# meia-largura ≈0.30, pés do cowboy no estribo em (±0.36, 1.18, 0.16).
	# A origem do RiderFollow fica em y-mundo ≈0.90 (up_offset -0.60): todo
	# local abaixo = world − 0.90. A sela ASSENTA no lombo, nada flutua.
	# manta sob a sela (bordas aparecem)
	_box(root, Vector3(0.60, 0.045, 0.80), Vector3(0, 0.81, 0.02), leather_d)
	# assento contornado
	_box(root, Vector3(0.46, 0.08, 0.58), Vector3(0, 0.86, 0.0), leather)
	# espaldar (cantle) atrás
	_box(root, Vector3(0.40, 0.13, 0.08), Vector3(0, 0.94, -0.30), leather)
	# pommel + chifre à frente
	_box(root, Vector3(0.12, 0.10, 0.10), Vector3(0, 0.93, 0.27), leather)
	var horn := MeshInstance3D.new()
	var hc := CylinderMesh.new()
	hc.top_radius = 0.028
	hc.bottom_radius = 0.04
	hc.height = 0.12
	horn.mesh = hc
	horn.material_override = leather_d
	horn.position = Vector3(0, 1.02, 0.29)
	root.add_child(horn)
	# abas (flaps) descendo pelas LATERAIS do barril + correia e estribo na
	# altura exata do pé do cowboy (FOOT_TARGET do rider_follow.gd)
	for side in [-1.0, 1.0]:
		var flap := _box(root, Vector3(0.045, 0.50, 0.44), Vector3(side * 0.30, 0.54, 0.02), leather)
		flap.rotation.z = side * -0.10
		# correia do estribo
		_box(root, Vector3(0.035, 0.36, 0.06), Vector3(side * 0.31, 0.52, 0.14), leather_d)
		# estribo (o pé pisa aqui)
		_box(root, Vector3(0.13, 0.03, 0.16), Vector3(side * 0.33, 0.26, 0.16), metal)
	return root

func _box(parent: Node, size: Vector3, pos: Vector3, mat: Material) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	m.mesh = b
	m.material_override = mat
	m.position = pos
	parent.add_child(m)
	return m

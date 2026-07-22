# settlements.gd — assentamentos (SPEC §M-07): 2 cidades (5 fachadas nomeadas
# com props, NPCs passeando, carroça), 2 aldeias indígenas (tendas/totem/
# fogueira + arqueiros), acampamento do jogador (fogueira/tenda/caixotes).
# Posições determinísticas derivadas da seed.
class_name BangSettlements
extends Node3D

const TOWN_BUILDINGS := ["SALOON", "BANK", "HOTEL", "STORE", "SHERIFF"]

var terrain: Node = null
var sites := {}   # { "towns": [Vector3], "villages": [Vector3], "camp": Vector3 }

var _wood := StandardMaterial3D.new()
var _wood_dark := StandardMaterial3D.new()

func build(p_terrain: Node, world_seed: int) -> void:
	terrain = p_terrain
	_wood.albedo_color = Color(0.55, 0.4, 0.25)
	_wood.roughness = 0.85
	_wood_dark.albedo_color = Color(0.35, 0.22, 0.12)
	_wood_dark.roughness = 0.9
	var rng := RandomNumberGenerator.new()
	rng.seed = world_seed + 555
	# posições: cidades no vale (afastadas entre si e do centro), aldeias mais
	# para as bordas, acampamento perto do centro-sul
	sites = {
		"towns": [_pick(rng, 420, 0.25), _pick(rng, 420, 0.75)],
		"villages": [_pick(rng, 640, 0.1), _pick(rng, 640, 0.6)],
		"camp": _pick(rng, 180, 0.4),
	}
	for i in range(2):
		_build_town(sites["towns"][i], i, rng)
		_build_village(sites["villages"][i], i, rng)
	_build_camp(sites["camp"])
	print("SETTLEMENTS_BUILT towns=2 villages=2 camp=1")

func _pick(rng: RandomNumberGenerator, radius: float, frac: float) -> Vector3:
	var a := frac * TAU + rng.randf() * 0.6
	var r := radius * (0.8 + rng.randf() * 0.4)
	var x := cos(a) * r
	var z := sin(a) * r
	return Vector3(x, terrain.height_at(x, z), z)

func _false_front(name: String, w: float, h: float, d: float, mat: Material) -> StaticBody3D:
	var b := StaticBody3D.new()
	b.name = "Building_" + name
	var mesh := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(w, h, d)
	mesh.mesh = bm
	mesh.material_override = mat
	mesh.position.y = h * 0.5
	b.add_child(mesh)
	# telhado de duas águas (prisma) — mata o visual "caixote"
	var roof := MeshInstance3D.new()
	var rm := PrismMesh.new()
	rm.size = Vector3(w + 0.7, 1.9, d + 0.7)
	rm.left_to_right = 0.5
	roof.mesh = rm
	roof.material_override = _wood_dark
	roof.position = Vector3(0, h + 0.95, 0)
	roof.rotation.y = PI / 2
	b.add_child(roof)
	# falso-front (placa acima do telhado)
	var ff := MeshInstance3D.new()
	var fm := BoxMesh.new()
	fm.size = Vector3(w + 0.3, 1.2, 0.3)
	ff.mesh = fm
	ff.material_override = _wood_dark
	ff.position = Vector3(0, h + 0.5, -d * 0.5)
	b.add_child(ff)
	# placa com o nome
	var sign := Label3D.new()
	sign.text = name
	sign.font_size = 64
	sign.pixel_size = 0.012
	sign.position = Vector3(0, h + 0.55, -d * 0.5 - 0.2)
	sign.rotation.y = PI
	b.add_child(sign)
	# alpendre: cobertura + pilares na fachada (-z é a frente)
	var awn := MeshInstance3D.new()
	var am := BoxMesh.new()
	am.size = Vector3(w + 0.2, 0.15, 2.2)
	awn.mesh = am
	awn.material_override = _wood_dark
	awn.position = Vector3(0, 2.9, -d * 0.5 - 1.0)
	b.add_child(awn)
	for px in [-w * 0.38, 0.0, w * 0.38]:
		var post := MeshInstance3D.new()
		var pm := CylinderMesh.new()
		pm.top_radius = 0.09
		pm.bottom_radius = 0.11
		pm.height = 2.9
		post.mesh = pm
		post.material_override = _wood_dark
		post.position = Vector3(px, 1.45, -d * 0.5 - 1.9)
		b.add_child(post)
	# porta + janelas (insets escuros na fachada)
	var door := MeshInstance3D.new()
	var dm := BoxMesh.new()
	dm.size = Vector3(1.2, 2.3, 0.12)
	door.mesh = dm
	door.material_override = _wood_dark
	door.position = Vector3(0, 1.15, -d * 0.5 - 0.03)
	b.add_child(door)
	var glass := StandardMaterial3D.new()
	glass.albedo_color = Color(0.65, 0.75, 0.8)
	for wx in [-w * 0.3, w * 0.3]:
		var win := MeshInstance3D.new()
		var wm := BoxMesh.new()
		wm.size = Vector3(1.0, 1.1, 0.12)
		win.mesh = wm
		win.material_override = glass
		win.position = Vector3(wx, 1.7, -d * 0.5 - 0.03)
		b.add_child(win)
	# colisão
	var col := CollisionShape3D.new()
	var cs := BoxShape3D.new()
	cs.size = Vector3(w, h, d)
	col.shape = cs
	col.position.y = h * 0.5
	b.add_child(col)
	return b

func _prop_barrel() -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.45
	cm.bottom_radius = 0.5
	cm.height = 0.9
	m.mesh = cm
	m.material_override = _wood_dark
	return m

func _build_town(center: Vector3, idx: int, rng: RandomNumberGenerator) -> void:
	var town := Node3D.new()
	town.name = "Town%d" % (idx + 1)
	add_child(town)
	# rua principal: 5 fachadas alternando lados
	for i in range(TOWN_BUILDINGS.size()):
		var side := 1.0 if i % 2 == 0 else -1.0
		# tom de madeira variado por prédio
		var wall: StandardMaterial3D = _wood.duplicate()
		wall.albedo_color = Color(0.55, 0.4, 0.25).lerp(Color(0.45, 0.3, 0.28), rng.randf() * 0.7)
		var b := _false_front(TOWN_BUILDINGS[i], 7.0, 4.5 + (i % 2), 6.0, wall)
		var bx := center.x + side * 9.0
		var bz := center.z - 16.0 + i * 8.0
		b.position = Vector3(bx, terrain.height_at(bx, bz), bz)
		b.rotation.y = -side * PI / 2
		town.add_child(b)
		if i % 2 == 1:
			var barrel := _prop_barrel()
			barrel.position = b.position + Vector3(-side * 4.5, 0.45, 1.5)
			town.add_child(barrel)
	print("TOWN_BUILT ", town.name)

func _teepee(h: float) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.05
	cm.bottom_radius = 2.2
	cm.height = h
	m.mesh = cm
	var hide := StandardMaterial3D.new()
	hide.albedo_color = Color(0.75, 0.62, 0.45)
	hide.roughness = 0.95
	m.material_override = hide
	return m

func _totem() -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.35
	cm.bottom_radius = 0.45
	cm.height = 4.0
	m.mesh = cm
	var paint := StandardMaterial3D.new()
	paint.albedo_color = Color(0.6, 0.2, 0.15)
	m.material_override = paint
	return m

func _campfire() -> Node3D:
	var f := Node3D.new()
	f.name = "Campfire"
	var light := OmniLight3D.new()
	light.light_color = Color(1.0, 0.6, 0.3)
	light.light_energy = 1.6
	light.omni_range = 9.0
	light.position.y = 0.8
	f.add_child(light)
	var stones := MeshInstance3D.new()
	var rm := CylinderMesh.new()
	rm.top_radius = 0.7
	rm.bottom_radius = 0.9
	rm.height = 0.3
	stones.mesh = rm
	stones.material_override = _wood_dark
	stones.position.y = 0.15
	f.add_child(stones)
	return f

func _build_village(center: Vector3, idx: int, _rng: RandomNumberGenerator) -> void:
	var v := Node3D.new()
	v.name = "Village%d" % (idx + 1)
	add_child(v)
	for i in range(5):
		var a := TAU * i / 5
		var tp := _teepee(3.2)
		var px := center.x + cos(a) * 10.0
		var pz := center.z + sin(a) * 10.0
		tp.position = Vector3(px, terrain.height_at(px, pz) + 1.6, pz)
		v.add_child(tp)
	var tot := _totem()
	tot.position = Vector3(center.x, terrain.height_at(center.x, center.z) + 2.0, center.z)
	v.add_child(tot)
	var fire := _campfire()
	fire.position = Vector3(center.x + 3.0, terrain.height_at(center.x + 3.0, center.z), center.z)
	v.add_child(fire)
	print("VILLAGE_BUILT ", v.name)

func _build_camp(center: Vector3) -> void:
	var camp := Node3D.new()
	camp.name = "Camp"
	add_child(camp)
	var fire := _campfire()
	fire.position = center
	camp.add_child(fire)
	# tenda
	var tent := MeshInstance3D.new()
	var tm := PrismMesh.new()
	tm.size = Vector3(3.0, 2.2, 2.6)
	tent.mesh = tm
	var canvas := StandardMaterial3D.new()
	canvas.albedo_color = Color(0.8, 0.72, 0.55)
	tent.material_override = canvas
	tent.position = center + Vector3(3.5, 1.1, 1.0)
	camp.add_child(tent)
	# caixotes
	for i in range(2):
		var crate := MeshInstance3D.new()
		var cm := BoxMesh.new()
		cm.size = Vector3(0.9, 0.9, 0.9)
		crate.mesh = cm
		crate.material_override = _wood
		crate.position = center + Vector3(-2.5 + i * 1.1, 0.45, 2.0)
		camp.add_child(crate)
	print("CAMP_BUILT")

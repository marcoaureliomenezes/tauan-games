class_name VehicleFactory
extends Object
## Fábrica de visuais de veículos low-poly.
##
## Réplica do Fiat Idea Adventure 2013 (carro do jogador — requisito fixo):
## dimensões reais 4,15 x 1,75 x 1,72 m, entre-eixos 2,51 m, rodas Ø0,67 m
## (205/70 R15), prata Bari #A6A9AD, capô curto com para-brisa contínuo,
## traseira vertical com ESTEPE EXTERNO com capa "Y" cinza-escura, rack de
## teto e cladding plástico preto. Convenção M.A.V.S: nariz no +Z.

const SILVER := Color("a6a9ad")
const SILVER_DARK := Color("6e7175")
const TUNGSTEN := Color("4a4c4e")
const PLASTIC := Color("1e1e1e")
const GLASS := Color(0.14, 0.17, 0.2, 0.92)


static func _box(
	parent: Node3D, size: Vector3, pos: Vector3, color: Color, unshaded := false
) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	if color.a < 1.0:
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if unshaded:
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.roughness = 0.4
	mat.metallic = 0.35
	mesh.material = mat
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = pos
	parent.add_child(mi)
	return mi


static func _cyl(
	parent: Node3D, radius: float, height: float, pos: Vector3, color: Color, axis_z := false
) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.6
	mesh.material = mat
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	if axis_z:
		mi.rotation_degrees.x = 90.0
	mi.position = pos
	parent.add_child(mi)
	return mi


static func build_idea_adventure() -> Node3D:
	var root := Node3D.new()
	root.name = "IdeaAdventure"
	# Corpo inferior (prata) — 4,15 m de comprimento, traseira quase vertical.
	_box(root, Vector3(1.7, 0.52, 4.05), Vector3(0, 0.62, 0.05), SILVER)
	# Capô curto e caído (frente = +Z).
	_box(root, Vector3(1.62, 0.16, 0.78), Vector3(0, 0.94, 1.62), SILVER)
	# Greenhouse alto: cabine de teto quase plano.
	_box(root, Vector3(1.56, 0.62, 2.5), Vector3(0, 1.28, -0.32), SILVER)
	# Para-brisa contínuo com o capô (muito inclinado) — prisma.
	var ws := PrismMesh.new()
	ws.size = Vector3(1.54, 0.62, 0.95)
	var ws_mat := StandardMaterial3D.new()
	ws_mat.albedo_color = GLASS
	ws_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ws.material = ws_mat
	var ws_mi := MeshInstance3D.new()
	ws_mi.mesh = ws
	ws_mi.rotation_degrees = Vector3(0, 180, 0)
	ws_mi.position = Vector3(0, 1.28, 1.4)
	root.add_child(ws_mi)
	# Janelas laterais (3 por lado) e vigia traseira.
	for side: float in [-1.0, 1.0]:
		_box(root, Vector3(0.04, 0.4, 0.95), Vector3(side * 0.79, 1.35, 0.35), GLASS)
		_box(root, Vector3(0.04, 0.4, 0.85), Vector3(side * 0.79, 1.35, -0.68), GLASS)
		_box(root, Vector3(0.04, 0.34, 0.4), Vector3(side * 0.79, 1.32, -1.32), GLASS)
	_box(root, Vector3(1.3, 0.44, 0.05), Vector3(0, 1.34, -1.58), GLASS)
	# Cladding preto: saias, para-choques e caixas de roda (Adventure).
	_box(root, Vector3(1.74, 0.2, 4.12), Vector3(0, 0.34, 0.05), PLASTIC)
	_box(root, Vector3(1.76, 0.34, 0.3), Vector3(0, 0.5, 2.0), PLASTIC)
	_box(root, Vector3(1.76, 0.34, 0.26), Vector3(0, 0.5, -1.95), PLASTIC)
	for wheel_z: float in [1.255, -1.255]:
		for side: float in [-1.0, 1.0]:
			_box(root, Vector3(0.08, 0.3, 0.9), Vector3(side * 0.86, 0.55, wheel_z), PLASTIC)
	# Rack de teto longitudinal (2 barras) + defletor traseiro.
	for side: float in [-0.55, 0.55]:
		_box(root, Vector3(0.08, 0.09, 2.2), Vector3(side, 1.66, -0.25), PLASTIC)
	_box(root, Vector3(1.4, 0.08, 0.3), Vector3(0, 1.64, -1.45), PLASTIC)
	# ESTEPE EXTERNO na traseira com capa "Y" tungstênio (marca registrada).
	var spare := Node3D.new()
	spare.position = Vector3(0.12, 0.88, -2.16)
	root.add_child(spare)
	_cyl(spare, 0.335, 0.24, Vector3.ZERO, Color(0.08, 0.08, 0.08), true)
	_cyl(spare, 0.22, 0.26, Vector3(0, 0, 0.02), TUNGSTEN, true)
	_box(spare, Vector3(0.1, 0.4, 0.05), Vector3(0, -0.18, 0.1), TUNGSTEN)
	# Faróis afilados com máscara negra + neblina redondos; grade e logo.
	for side: float in [-1.0, 1.0]:
		_box(
			root,
			Vector3(0.42, 0.12, 0.06),
			Vector3(side * 0.55, 1.0, 2.02),
			Color(0.85, 0.87, 0.82),
			true
		)
		_cyl(root, 0.07, 0.05, Vector3(side * 0.55, 0.52, 2.16), Color(0.95, 0.95, 0.8), true)
		# Lanternas traseiras verticais altas (fumê).
		_box(
			root, Vector3(0.14, 0.5, 0.06), Vector3(side * 0.72, 1.12, -1.99), Color(0.45, 0.1, 0.1)
		)
	_box(root, Vector3(0.7, 0.16, 0.05), Vector3(0, 0.78, 2.06), Color(0.2, 0.2, 0.22))
	_cyl(root, 0.07, 0.04, Vector3(0, 0.78, 2.1), Color(0.72, 0.1, 0.1), true)
	# Retrovisores pretos.
	for side: float in [-1.0, 1.0]:
		_box(root, Vector3(0.2, 0.14, 0.1), Vector3(side * 0.92, 1.22, 0.86), PLASTIC)
	return root


static func build_police_body() -> Node3D:
	var root := Node3D.new()
	root.name = "PoliceBody"
	var white := Color(0.92, 0.93, 0.95)
	_box(root, Vector3(1.72, 0.5, 4.3), Vector3(0, 0.6, 0), white)
	_box(root, Vector3(1.55, 0.5, 2.1), Vector3(0, 1.1, -0.2), white)
	for side: float in [-1.0, 1.0]:
		_box(root, Vector3(0.04, 0.34, 1.7), Vector3(side * 0.78, 1.14, -0.2), GLASS)
	_box(root, Vector3(1.3, 0.36, 0.05), Vector3(0, 1.12, 0.9), GLASS)
	_box(root, Vector3(1.3, 0.36, 0.05), Vector3(0, 1.12, -1.28), GLASS)
	# Faixa "POLÍCIA" escura nas portas.
	_box(root, Vector3(1.76, 0.24, 2.2), Vector3(0, 0.62, -0.1), Color(0.12, 0.14, 0.3))
	_box(root, Vector3(1.74, 0.16, 4.34), Vector3(0, 0.32, 0), PLASTIC)
	# Giroflex (as luzes piscam via VehicleLightbar).
	var bar := Node3D.new()
	bar.name = "Lightbar"
	bar.position = Vector3(0, 1.44, -0.2)
	root.add_child(bar)
	_box(bar, Vector3(0.9, 0.12, 0.3), Vector3.ZERO, Color(0.1, 0.1, 0.1))
	var red := _box(
		bar, Vector3(0.4, 0.14, 0.28), Vector3(-0.24, 0.02, 0), Color(1, 0.05, 0.05), true
	)
	red.name = "RedLight"
	var blue := _box(
		bar, Vector3(0.4, 0.14, 0.28), Vector3(0.24, 0.02, 0), Color(0.1, 0.2, 1), true
	)
	blue.name = "BlueLight"
	return root


static func build_traffic_vehicle(kind: String, rng: RandomNumberGenerator) -> Node3D:
	var root := Node3D.new()
	root.name = "Traffic_%s" % kind
	match kind:
		"tanque":
			_truck_cab(root, Color(0.75, 0.2, 0.15))
			_cyl(root, 1.05, 6.2, Vector3(0, 1.7, -1.6), Color(0.8, 0.8, 0.82))
			_truck_wheels(root, 6)
		"bau":
			_truck_cab(root, Color(0.2, 0.4, 0.7))
			_box(root, Vector3(2.3, 2.6, 6.4), Vector3(0, 1.9, -1.7), Color(0.88, 0.88, 0.9))
			_truck_wheels(root, 6)
		"cegonha":
			_truck_cab(root, Color(0.85, 0.6, 0.1))
			_box(root, Vector3(2.2, 0.16, 7.2), Vector3(0, 1.1, -2.0), Color(0.55, 0.55, 0.58))
			_box(root, Vector3(2.2, 0.16, 7.2), Vector3(0, 2.5, -2.0), Color(0.55, 0.55, 0.58))
			for deck: float in [1.35, 2.75]:
				for zi in 3:
					var c := Color.from_hsv(rng.randf(), 0.55, 0.85)
					_box(root, Vector3(1.6, 0.5, 1.9), Vector3(0, deck, -4.3 + float(zi) * 2.3), c)
			_truck_wheels(root, 6)
		"ambulancia":
			_truck_cab(root, Color(0.93, 0.94, 0.95))
			_box(root, Vector3(2.1, 2.0, 3.6), Vector3(0, 1.6, -1.2), Color(0.95, 0.96, 0.97))
			_box(root, Vector3(2.12, 0.5, 3.62), Vector3(0, 1.2, -1.2), Color(0.85, 0.1, 0.1))
			_box(
				root, Vector3(0.16, 0.6, 0.6), Vector3(1.06, 1.9, -1.2), Color(0.85, 0.1, 0.1), true
			)
			_box(
				root, Vector3(0.6, 0.16, 0.6), Vector3(1.06, 1.9, -1.2), Color(0.85, 0.1, 0.1), true
			)
			var bar := _box(
				root, Vector3(0.8, 0.12, 0.3), Vector3(0, 2.72, 0.6), Color(0.9, 0.1, 0.1), true
			)
			bar.name = "RedLight"
			_truck_wheels(root, 4)
		_:
			var c := Color.from_hsv(
				rng.randf(), rng.randf_range(0.3, 0.7), rng.randf_range(0.5, 0.9)
			)
			_box(root, Vector3(1.7, 0.5, 4.0), Vector3(0, 0.6, 0), c)
			_box(root, Vector3(1.5, 0.45, 1.9), Vector3(0, 1.05, -0.1), c.darkened(0.1))
			for side: float in [-1.0, 1.0]:
				_box(root, Vector3(0.04, 0.3, 1.5), Vector3(side * 0.76, 1.08, -0.1), GLASS)
			_car_wheels(root)
	return root


static func _truck_cab(root: Node3D, color: Color) -> void:
	_box(root, Vector3(2.2, 1.9, 1.9), Vector3(0, 1.5, 2.6), color)
	_box(root, Vector3(1.9, 0.7, 0.06), Vector3(0, 1.85, 3.56), GLASS)
	_box(root, Vector3(2.3, 0.5, 8.6), Vector3(0, 0.5, -0.6), Color(0.2, 0.2, 0.22))


static func _truck_wheels(root: Node3D, count: int) -> void:
	var zs := [2.6, -0.8, -3.4] if count >= 6 else [2.4, -2.2]
	for z: float in zs:
		for side: float in [-1.05, 1.05]:
			var w := _cyl(root, 0.52, 0.36, Vector3(side, 0.52, z), Color(0.07, 0.07, 0.07))
			w.rotation_degrees.z = 90.0


static func _car_wheels(root: Node3D) -> void:
	for z: float in [1.3, -1.3]:
		for side: float in [-0.82, 0.82]:
			var w := _cyl(root, 0.34, 0.24, Vector3(side, 0.34, z), Color(0.07, 0.07, 0.07))
			w.rotation_degrees.z = 90.0


static func swap_body(car: VehicleBody3D, body: Node3D) -> void:
	# Esconde a malha original (TRG) e instala o visual novo na mesma origem.
	var col := car.get_node_or_null("CollisionShape3D")
	if col:
		for child in col.get_children():
			if child is MeshInstance3D:
				child.visible = false
	car.add_child(body)
	body.position = Vector3(0, -0.28, 0)


static func fit_idea_wheelbase(car: VehicleBody3D) -> void:
	# Ajusta as rodas do TRG para o entre-eixos real do Idea (2,51 m).
	for w: VehicleWheel3D in car.find_children("*", "VehicleWheel3D", false, false):
		var p := w.position
		p.z = 1.255 if p.z > 0.0 else -1.255
		p.x = 0.78 * signf(p.x)
		w.position = p

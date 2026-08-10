class_name JetMesh
extends RefCounted
## JetMesh — F-35 Lightning II procedural, port fiel de player.js#buildJet +
## buildWingLoadout do web-game (mesmas dimensões/materiais, ~4 m de comprimento).
## Inclui: LERX/chines, DSI, canopy-bolha, asas delta trapezoidais, V-tails,
## stabilators, nozzle com glow, plume de pós-combustor, navlights, trem de
## pouso retrátil e loadout visível (4 leves + 2 pesados + 1 nuclear).

const C_GREY := Color(0.176, 0.188, 0.216) # jetGrey 0x2d3037
const C_DARK := Color(0.110, 0.118, 0.137) # jetDark 0x1c1e23
const C_PANEL := Color(0.227, 0.239, 0.267) # jetPanel 0x3a3d44
const C_GLASS := Color(0.165, 0.290, 0.416) # canopy 0x2a4a6a
const C_EXHAUST := Color(1.0, 0.44, 0.13) # exhaustOrange 0xff7020
const C_FLAME := Color(1.0, 0.87, 0.4) # flameYellow 0xffdd66


static func build() -> Node3D:
	var jet := Node3D.new()
	jet.name = "JetMesh"
	var grey := _pbr(C_GREY)
	var dark := _pbr(C_DARK)
	var panel := _pbr(C_PANEL)
	# Nariz afiado (radome facetado)
	var nose := _cyl(0.24, 0.0, 1.85, grey, 8)
	nose.rotation_degrees.x = 90
	nose.position = Vector3(0, 0, -1.78)
	jet.add_child(nose)
	# Fuselagem dianteira
	var fwd := _box(Vector3(0.60, 0.40, 1.2), panel)
	fwd.position = Vector3(0, 0, -0.55)
	jet.add_child(fwd)
	# LERX/chines + bossas DSI
	for sx in [-1.0, 1.0]:
		var chine := _box(Vector3(0.55, 0.06, 1.35), _pbr(C_DARK))
		chine.position = Vector3(sx * 0.42, -0.04, -0.15)
		chine.rotation.y = -sx * 0.32
		jet.add_child(chine)
		var dsi := _sphere(0.17, grey)
		dsi.scale = Vector3(0.8, 0.7, 1.2)
		dsi.position = Vector3(sx * 0.36, -0.08, -0.3)
		jet.add_child(dsi)
	# Canopy: frame + bolha de vidro fumê
	var frame := _box(Vector3(0.46, 0.05, 0.78), dark)
	frame.position = Vector3(0, 0.18, -0.65)
	jet.add_child(frame)
	var bubble := _sphere(0.30, _glass())
	bubble.scale = Vector3(0.72, 0.55, 1.35)
	bubble.position = Vector3(0, 0.28, -0.63)
	jet.add_child(bubble)
	# Espinha dorsal
	var spine := _box(Vector3(0.34, 0.14, 1.35), panel)
	spine.position = Vector3(0, 0.26, 0.35)
	jet.add_child(spine)
	# Centro + cauda
	var mid := _box(Vector3(0.95, 0.52, 1.4), grey)
	mid.position = Vector3(0, 0, 0.45)
	jet.add_child(mid)
	var aft := _box(Vector3(0.62, 0.45, 0.85), dark)
	aft.position = Vector3(0, 0, 1.5)
	jet.add_child(aft)
	# Asas delta trapezoidais (placas, dois lados)
	var wing_verts := PackedVector3Array([
		Vector3(0, 0, -0.42), Vector3(1.95, 0, 0.70), Vector3(1.95, 0, 1.05), Vector3(0, 0, 0.92)])
	for sx in [1.0, -1.0]:
		var w := _plate(wing_verts, sx, _pbr(C_GREY, true))
		w.position = Vector3(0, -0.04, 0.35)
		jet.add_child(w)
		var wb := _plate(wing_verts, sx, _pbr(C_DARK, true))
		wb.position = Vector3(0, -0.12, 0.35)
		jet.add_child(wb)
	# V-tails (cant 0,42 rad)
	for sx in [-1.0, 1.0]:
		var tail := _box(Vector3(0.055, 0.78, 0.62), grey)
		tail.position = Vector3(sx * 0.30, 0.34, 1.45)
		tail.rotation.z = -sx * 0.42
		jet.add_child(tail)
	# Stabilators
	var stab_verts := PackedVector3Array([
		Vector3(0, 0, 1.4), Vector3(0.85, 0, 1.7), Vector3(0.85, 0, 2.05), Vector3(0, 0, 1.95)])
	for sx in [1.0, -1.0]:
		var s := _plate(stab_verts, sx, _pbr(C_DARK, true))
		s.position = Vector3(0, 0.05, 0)
		jet.add_child(s)
	# Exhaust: anel + pétalas do nozzle + glow + chama
	var ring := _cyl(0.30, 0.28, 0.45, dark, 16)
	ring.rotation_degrees.x = 90
	ring.position = Vector3(0, 0, 2.05)
	jet.add_child(ring)
	var nozzle := _cyl(0.24, 0.30, 0.28, dark, 12)
	nozzle.rotation_degrees.x = 90
	nozzle.position = Vector3(0, 0, 2.30)
	jet.add_child(nozzle)
	var glow := _cyl(0.25, 0.22, 0.35, _basic(C_EXHAUST), 12)
	glow.rotation_degrees.x = 90
	glow.position = Vector3(0, 0, 2.1)
	glow.name = "ExhGlow"
	jet.add_child(glow)
	var flame := _cyl(0.18, 0.12, 0.25, _basic(C_FLAME), 8)
	flame.rotation_degrees.x = 90
	flame.position = Vector3(0, 0, 2.15)
	flame.name = "ExhFlame"
	jet.add_child(flame)
	# Plume de pós-combustor (oculto; ligado por throttle no jet.gd)
	var plume := _cyl(0.15, 0.02, 0.85, _basic(C_FLAME), 10)
	plume.rotation_degrees.x = 90
	plume.position = Vector3(0, 0, 2.45)
	plume.visible = false
	plume.name = "Afterburner"
	jet.add_child(plume)
	# Intake ventral
	var intake := _box(Vector3(0.55, 0.18, 0.55), dark)
	intake.position = Vector3(0, -0.32, -0.25)
	jet.add_child(intake)
	# Pylons de ponta de asa
	for sx in [-1.79, 1.79]:
		var pyl := _box(Vector3(0.08, 0.12, 0.6), dark)
		pyl.position = Vector3(sx, -0.08, 0.7)
		jet.add_child(pyl)
	# Navlights + strobe
	var nav_g := _light(Color(0.0, 1.0, 0.27), 0.08)
	nav_g.position = Vector3(-2.17, 0, 0.4)
	jet.add_child(nav_g)
	var nav_r := _light(Color(1.0, 0.13, 0.0), 0.08)
	nav_r.position = Vector3(2.17, 0, 0.4)
	jet.add_child(nav_r)
	var strobe := _light(Color.WHITE, 0.06)
	strobe.name = "Strobe"
	strobe.position = Vector3(0, 0.12, 1.1)
	jet.add_child(strobe)
	# Trem de pouso (3 pernas, retrátil)
	var gear := Node3D.new()
	gear.name = "Gear"
	gear.add_child(_gear_leg(0, -1.0, 0.52))
	gear.add_child(_gear_leg(-0.55, 0.6, 0.55))
	gear.add_child(_gear_leg(0.55, 0.6, 0.55))
	jet.add_child(gear)
	# Loadout visível nas asas
	_build_loadout(jet)
	# Sombras em todos os meshes
	for mi in jet.find_children("*", "MeshInstance3D"):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	return jet


# ---------------------------------------------------------------------------
# Loadout (buildWingLoadout): 4 leves + 2 pesados + 1 nuclear centerline
# ---------------------------------------------------------------------------
static func _build_loadout(jet: Node3D) -> void:
	var light_mat := _pbr(Color(0.53, 0.56, 0.63))
	var heavy_mat := _pbr(Color(0.29, 0.29, 0.32))
	var fin_mat := _pbr(Color(0.42, 0.43, 0.48), true)
	var pylon_mat := _pbr(Color(0.23, 0.23, 0.26))
	var seeker_mat := _basic(Color(0.07, 0.13, 0.2))
	# Leves: 2 por asa
	var light_group := Node3D.new()
	light_group.name = "LoadoutLight"
	var light_pos := [[-0.9, -0.15, 0.4], [-1.5, -0.12, 0.3], [0.9, -0.15, 0.4], [1.5, -0.12, 0.3]]
	for p in light_pos:
		var pos := Vector3(p[0], p[1], p[2])
		var body := _cyl(0.07, 0.06, 0.9, light_mat, 6)
		body.rotation_degrees.x = 90
		body.position = pos
		light_group.add_child(body)
		_missile_detail(light_group, pos, 0.45, 0.065, light_mat, fin_mat, seeker_mat, true)
		var pyl := _box(Vector3(0.04, 0.11, 0.05), pylon_mat)
		pyl.position = pos + Vector3(0, 0.08, 0)
		light_group.add_child(pyl)
	jet.add_child(light_group)
	# Pesados: 1 por asa
	var heavy_group := Node3D.new()
	heavy_group.name = "LoadoutHeavy"
	for p in [[-1.1, -0.18, 0.55], [1.1, -0.18, 0.55]]:
		var pos := Vector3(p[0], p[1], p[2])
		var body := _cyl(0.10, 0.09, 1.2, heavy_mat, 6)
		body.rotation_degrees.x = 90
		body.position = pos
		heavy_group.add_child(body)
		_missile_detail(heavy_group, pos, 0.60, 0.095, heavy_mat, fin_mat, seeker_mat, false)
		var pyl := _box(Vector3(0.05, 0.12, 0.06), pylon_mat)
		pyl.position = pos + Vector3(0, 0.09, 0)
		heavy_group.add_child(pyl)
	jet.add_child(heavy_group)
	# Nuclear: centerline ventral com faixa vermelha
	var nuke_group := Node3D.new()
	nuke_group.name = "LoadoutNuke"
	var npos := Vector3(0, -0.35, 0.5)
	var nbody := _cyl(0.14, 0.14, 1.5, _basic(Color(0.10, 0.23, 0.07)), 6)
	nbody.rotation_degrees.x = 90
	nbody.position = npos
	nuke_group.add_child(nbody)
	var band := _cyl(0.156, 0.156, 0.09, _basic(Color(1.0, 0.13, 0.0)), 12)
	band.rotation_degrees.x = 90
	band.position = npos + Vector3(0, 0, -0.14)
	nuke_group.add_child(band)
	var npyl := _box(Vector3(0.08, 0.10, 0.14), pylon_mat)
	npyl.position = npos + Vector3(0, 0.12, 0)
	nuke_group.add_child(npyl)
	jet.add_child(nuke_group)


## Nosecone + seeker IR + aletas cruciformes na cauda do míssil.
static func _missile_detail(parent: Node3D, pos: Vector3, half_len: float, body_r: float,
		mat: Material, fin_mat: Material, seeker_mat: Material, with_seeker: bool) -> void:
	var nh := half_len * 0.48
	var nose := _cyl(0.0, body_r * 1.05, nh, mat, 6)
	nose.rotation_degrees.x = 90
	nose.position = pos + Vector3(0, 0, -half_len - nh * 0.5)
	parent.add_child(nose)
	if with_seeker:
		var dome := _sphere(body_r * 0.72, seeker_mat)
		dome.position = pos + Vector3(0, 0, -half_len - nh - body_r * 0.25)
		parent.add_child(dome)
	var fl := half_len * 0.52
	var fs := body_r * 3.8
	var tail_z := pos.z + half_len - fl * 0.5
	var hfin := _box(Vector3(fs, 0.024, fl), fin_mat)
	hfin.position = Vector3(pos.x, pos.y, tail_z)
	parent.add_child(hfin)
	var vfin := _box(Vector3(0.024, fs, fl), fin_mat)
	vfin.position = Vector3(pos.x, pos.y, tail_z)
	parent.add_child(vfin)


# ---------------------------------------------------------------------------
# Primitivas
# ---------------------------------------------------------------------------
static func _gear_leg(x: float, z: float, length: float) -> Node3D:
	var leg := Node3D.new()
	leg.position = Vector3(x, -0.22, z)
	var strut := _cyl(0.055, 0.045, length, _pbr(Color(0.60, 0.63, 0.66)), 6)
	strut.position = Vector3(0, -length * 0.5, 0)
	leg.add_child(strut)
	var wheel := _cyl(0.16, 0.16, 0.12, _pbr(Color(0.06, 0.06, 0.07)), 10)
	wheel.rotation_degrees.z = 90
	wheel.position = Vector3(0, -length, 0)
	leg.add_child(wheel)
	return leg


static func _box(size: Vector3, mat: Material) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	return mi


static func _cyl(top: float, bottom: float, height: float, mat: Material, sides := 12) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.top_radius = top
	mesh.bottom_radius = bottom
	mesh.height = height
	mesh.radial_segments = sides
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	return mi


static func _sphere(radius: float, mat: Material) -> MeshInstance3D:
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = 10
	mesh.rings = 8
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	return mi


## Placa trapezoidal plana (asa/stab) — vértices espelhados em X por `sign`.
static func _plate(verts: PackedVector3Array, sign: float, mat: Material) -> MeshInstance3D:
	var v := PackedVector3Array()
	for p in verts:
		v.append(Vector3(p.x * sign, p.y, p.z))
	var indices := PackedInt32Array([0, 1, 2, 0, 2, 3])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = v
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	return mi


static func _light(color: Color, radius: float) -> MeshInstance3D:
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = _basic(color, 4.0)
	return mi


static func _pbr(color: Color, double_side := false) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.metallic = 0.55
	mat.roughness = 0.42
	if double_side:
		mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	return mat


static func _glass() -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = C_GLASS
	mat.metallic = 0.9
	mat.roughness = 0.08
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color.a = 0.92
	return mat


static func _basic(color: Color, energy := 1.0) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if energy > 1.0:
		mat.emission_enabled = true
		mat.emission = color
		mat.emission_energy_multiplier = energy
	return mat

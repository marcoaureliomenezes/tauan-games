# car_factory.gd — monta um VehicleBody3D completo a partir dos GLB Quaternius
# (CC0, vendor/models). Física = VehicleBody3D/VehicleWheel3D nativos do Godot
# (raycast vehicle real: suspensão, atrito de pneu, transferência de peso).
#
# GOTCHA herdado do three.js: os nós de RODA dos GLB ficam na origem do modelo
# com a geometria deslocada até o cubo. Aqui cada VehicleWheel3D recebe a malha
# da roda dianteira-esquerda CENTRADA (offset = -centro do AABB) e espelhada
# para o lado direito — o Godot gira/esterça o visual da roda sozinho.
class_name CarFactory

const CATALOG := {
	"idea": {
		"name": "Idea Adventure 2013 Dual Logic", "model": "SUV",
		"color": Color(0.61, 0.63, 0.66), "mass": 1280.0,
		"engine": 5200.0, "brake": 55.0, "steer": 0.55, "top": 46.0, "grip": 3.4,
	},
	"muscle": {
		"name": "Thunder V8", "model": "SportsCarB",
		"color": Color(0.69, 0.13, 0.19), "mass": 1550.0,
		"engine": 7600.0, "brake": 52.0, "steer": 0.45, "top": 58.0, "grip": 3.0,
	},
	"exotic": {
		"name": "Velocità GT", "model": "SportsCarA",
		"color": Color(0.94, 0.75, 0.13), "mass": 1300.0,
		"engine": 7800.0, "brake": 62.0, "steer": 0.55, "top": 62.0, "grip": 3.9,
	},
	"concept": {
		"name": "Neon 2049", "model": "SportsCarC",
		"color": Color(0.19, 0.78, 0.75), "mass": 1350.0,
		"engine": 6800.0, "brake": 58.0, "steer": 0.5, "top": 55.0, "grip": 3.6,
	},
	"pickup": {
		"name": "Mule Pickup", "model": "PickupTruck",
		"color": Color(0.16, 0.35, 0.63), "mass": 1900.0,
		"engine": 6000.0, "brake": 50.0, "steer": 0.48, "top": 44.0, "grip": 3.2,
	},
}

const CAR_LEN := 4.3


static func build(key: String) -> VehicleBody3D:
	var def: Dictionary = CATALOG[key]
	var body := VehicleBody3D.new()
	body.name = key
	body.mass = def["mass"]
	body.set_meta("def", def)

	var glb: Node3D = load("res://assets/cars/%s.glb" % def["model"]).instantiate()
	var info := _analyze(glb)
	var s: float = CAR_LEN / info["length"]

	# --- visual da carroceria (sem as rodas do GLB) ---
	var visual := Node3D.new()
	visual.name = "Visual"
	for mi in info["body_meshes"]:
		var inst := MeshInstance3D.new()
		inst.mesh = mi.mesh
		_recolor(inst, mi, def["color"])
		visual.add_child(inst)
	# frente dos GLB é +Z; frente do Godot é -Z → gira π e escala
	visual.transform = Transform3D(Basis.from_euler(Vector3(0, PI, 0)).scaled(Vector3(s, s, s)),
		Vector3(0, -info["base_y"] * s - 0.30, 0))
	body.add_child(visual)

	# --- colisor da carroceria ---
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(info["width"] * s, info["height"] * s * 0.7, CAR_LEN * 0.94)
	shape.shape = box
	shape.position = Vector3(0, info["height"] * s * 0.35 - 0.30 + 0.05, 0)
	body.add_child(shape)

	# --- rodas (VehicleWheel3D) ---
	var wr: float = info["wheel_radius"] * s
	var wx: float = info["wheel_x"] * s
	var zf: float = -info["wheel_zf"] * s     # GLB +Z (frente) → Godot -Z
	var zr: float = -info["wheel_zr"] * s
	var wy: float = wr - 0.30 + 0.10          # centro da roda ≈ raio acima do chão + curso
	for w in [
		{"n": "WFL", "p": Vector3(wx, wy, zf), "steer": true, "mirror": false},
		{"n": "WFR", "p": Vector3(-wx, wy, zf), "steer": true, "mirror": true},
		{"n": "WRL", "p": Vector3(wx, wy, zr), "steer": false, "mirror": false},
		{"n": "WRR", "p": Vector3(-wx, wy, zr), "steer": false, "mirror": true},
	]:
		var wheel := VehicleWheel3D.new()
		wheel.name = w["n"]
		wheel.position = w["p"]
		wheel.use_as_steering = w["steer"]
		wheel.use_as_traction = true          # tração integral: arcade estável
		wheel.wheel_radius = wr
		wheel.wheel_rest_length = 0.18
		wheel.suspension_travel = 0.22
		wheel.suspension_stiffness = 48.0
		wheel.damping_compression = 4.2
		wheel.damping_relaxation = 4.6
		wheel.wheel_friction_slip = def["grip"]
		wheel.wheel_roll_influence = 0.06     # baixo = difícil capotar em curva
		var wm := MeshInstance3D.new()
		wm.mesh = info["wheel_mesh"]
		# roda direita = roda esquerda girada 180° (winding intacto, sem escala negativa)
		var wb := Basis.from_euler(Vector3(0, 0.0 if w["mirror"] else PI, 0)).scaled(Vector3(s, s, s))
		wm.transform = Transform3D(wb, -(wb * Vector3(info["wheel_center"])))
		wheel.add_child(wm)
		body.add_child(wheel)

	body.center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	body.center_of_mass = Vector3(0, -0.18, 0)   # baixo = estável (anti-capote)
	glb.queue_free()
	return body


# Extrai do GLB: malhas da carroceria, UMA malha de roda (dianteira esq.) com o
# centro do seu AABB, raio/posições das rodas e dimensões gerais.
static func _analyze(glb: Node3D) -> Dictionary:
	var body_meshes: Array[MeshInstance3D] = []
	var fl_meshes: Array[Mesh] = []
	var fl_aabb: AABB
	var back_aabb: AABB
	var has_back := false
	var total: AABB
	var has_total := false
	for mi in glb.find_children("*", "MeshInstance3D", true, false):
		var nm: String = mi.name + mi.get_parent().name
		var ab: AABB = mi.get_aabb()
		if has_total:
			total = total.merge(ab)
		else:
			total = ab
			has_total = true
		if nm.containsn("wheel"):
			# dianteira ESQUERDA (pneu + calota); "FrontWheel_L" do pickup também
			if (nm.containsn("front") and (nm.containsn("left") or nm.containsn("_l"))
					and not nm.containsn("right")):
				fl_aabb = ab if fl_meshes.is_empty() else fl_aabb.merge(ab)
				fl_meshes.append(mi.mesh)
			elif nm.containsn("back"):
				back_aabb = ab if not has_back else back_aabb.merge(ab)
				has_back = true
		else:
			body_meshes.append(mi)
	# junta pneu+calota numa ArrayMesh única para o visual da roda
	var st := SurfaceTool.new()
	var wheel_mesh := ArrayMesh.new()
	for m in fl_meshes:
		for i in m.get_surface_count():
			st.clear()
			st.create_from(m, i)
			wheel_mesh = st.commit(wheel_mesh)
			wheel_mesh.surface_set_material(wheel_mesh.get_surface_count() - 1,
				m.surface_get_material(i))
	var flc := fl_aabb.get_center()
	var wheel_zr: float = back_aabb.get_center().z if has_back else -flc.z
	return {
		"body_meshes": body_meshes,
		"wheel_mesh": wheel_mesh,
		"wheel_center": flc,
		"wheel_radius": fl_aabb.size.y / 2.0,
		"wheel_x": absf(flc.x),
		"wheel_zf": flc.z,
		"wheel_zr": wheel_zr,
		"length": total.size.z,
		"width": total.size.x,
		"height": total.size.y,
		"base_y": total.position.y,
	}


static func _recolor(inst: MeshInstance3D, src: MeshInstance3D, color: Color) -> void:
	var mesh: Mesh = src.mesh
	for i in mesh.get_surface_count():
		var m := mesh.surface_get_material(i)
		if m is BaseMaterial3D:
			var c: Color = m.albedo_color
			if c.s < 0.25 or c.v < 0.08:      # neutro/escuro (vidro, pneu, cromado): mantém
				continue
			var nm2: BaseMaterial3D = m.duplicate()
			nm2.albedo_color = color
			nm2.metallic = 0.55
			nm2.roughness = 0.35
			inst.set_surface_override_material(i, nm2)

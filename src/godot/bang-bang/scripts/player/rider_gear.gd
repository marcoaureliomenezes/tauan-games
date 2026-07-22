# rider_gear.gd — visual de cowboy: chapéu (osso Head, acompanha a cabeça),
# botas (recolore a malha Adventurer_Feet) e esporas (fixas no RiderFollow na
# posição exata do estribo — os pés são PINADOS lá pelo rider_follow.gd).
# Filho do RiderFollow; montado pelo player.gd.
extends Node3D

const FOOT_X := 0.36        # = FOOT_TARGET do rider_follow.gd (rider-local)
const FOOT_Y := 1.18
const FOOT_Z := 0.16
const FOLLOW_Y := 0.90      # origem do follow em y-mundo (up_offset -0.60)

func _ready() -> void:
	_hat()
	_boots()
	for side in [-1.0, 1.0]:
		_spur(side)

func _leather(dark := false) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.16, 0.10, 0.06) if dark else Color(0.35, 0.22, 0.11)
	m.roughness = 0.85
	return m

func _metal() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.72, 0.70, 0.66)
	m.metallic = 0.85
	m.roughness = 0.35
	return m

# chapéu de cowboy no osso Head: aba larga + copa. O osso herda a escala ×100
# da CharacterArmature — contrapõe com escala pequena (mesmo truque da arma).
func _hat() -> void:
	var skel := get_node_or_null("../Rider/RootNode/CharacterArmature/Skeleton3D") as Skeleton3D
	if skel == null:
		print("GEAR_WARN: esqueleto do cowboy não achado")
		return
	var att := BoneAttachment3D.new()
	att.bone_name = "Head"
	skel.add_child(att)
	var hat := Node3D.new()
	hat.name = "Hat"
	var brim := MeshInstance3D.new()
	var bm := CylinderMesh.new()
	bm.top_radius = 0.30
	bm.bottom_radius = 0.32
	bm.height = 0.035
	brim.mesh = bm
	brim.material_override = _leather()
	hat.add_child(brim)
	var crown := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.13
	cm.bottom_radius = 0.155
	cm.height = 0.17
	crown.mesh = cm
	crown.position = Vector3(0, 0.10, 0)
	crown.material_override = _leather()
	hat.add_child(crown)
	# faixa escura na base da copa
	var band := MeshInstance3D.new()
	var am := CylinderMesh.new()
	am.top_radius = 0.16
	am.bottom_radius = 0.165
	am.height = 0.045
	band.mesh = am
	band.position = Vector3(0, 0.04, 0)
	band.material_override = _leather(true)
	hat.add_child(band)
	hat.scale = Vector3(0.007, 0.007, 0.007)
	hat.position = Vector3(0, 0.0016, 0.0004)   # topo da cabeça (osso ×100)
	att.add_child(hat)

# botas: a malha dos pés do Adventurer vira couro escuro
func _boots() -> void:
	var feet := get_parent().find_children("Adventurer_Feet", "MeshInstance3D", true, false)
	for f in feet:
		f.material_override = _leather(true)

# espora: banda no calcanhar + haste com roseta, atrás do estribo
func _spur(side: float) -> void:
	var s := Node3D.new()
	s.name = "SpurL" if side > 0 else "SpurR"
	# follow-local = rider-local − FOLLOW_Y no eixo y
	s.position = Vector3(FOOT_X * side + 0.01 * side, FOOT_Y - FOLLOW_Y + 0.04, FOOT_Z - 0.10)
	var band := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.055, 0.05, 0.025)
	band.mesh = bm
	band.material_override = _metal()
	s.add_child(band)
	var shank := MeshInstance3D.new()
	var sm := BoxMesh.new()
	sm.size = Vector3(0.015, 0.015, 0.05)
	shank.mesh = sm
	shank.position = Vector3(0, 0, -0.035)
	shank.material_override = _metal()
	s.add_child(shank)
	var rowel := MeshInstance3D.new()
	var rm := CylinderMesh.new()
	rm.top_radius = 0.028
	rm.bottom_radius = 0.028
	rm.height = 0.008
	rowel.mesh = rm
	rowel.rotation_degrees = Vector3(0, 0, 90)
	rowel.position = Vector3(0, 0, -0.065)
	rowel.material_override = _metal()
	s.add_child(rowel)
	add_child(s)

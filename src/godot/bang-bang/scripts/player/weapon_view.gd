# weapon_view.gd — modelos de arma na mão do cowboy (Wrist.R).
# Revólver (1 mão) e espingarda 12 (2 mãos); alterna com Game.player["weapon"].
# Filho do Rider (cowboy) — montado pelo player.gd.
extends Node3D

var _attach: BoneAttachment3D = null
var _revolver: Node3D = null
var _shotgun: Node3D = null

func _ready() -> void:
	# path explícito (o _find_skel genérico pegava um esqueleto fantasma e a
	# arma nunca aparecia)
	var cskel := get_parent().get_node_or_null("RootNode/CharacterArmature/Skeleton3D") as Skeleton3D
	if cskel == null:
		print("WV_WARN: esqueleto do cowboy não achado")
		return
	_attach = BoneAttachment3D.new()
	_attach.bone_name = "Wrist.R"
	cskel.add_child(_attach)
	_revolver = _make_revolver()
	_shotgun = _make_shotgun()
	# o osso herda a escala ×100 da CharacterArmature — contrapõe. 0.013 dá um
	# revólver de ~26 cm e espingarda ~0.9 m (0.007 dava 13 cm: invisível em jogo)
	for w in [_revolver, _shotgun]:
		w.scale = Vector3(0.013, 0.013, 0.013)
		w.rotation_degrees = Vector3(-90, 0, 0)   # cano ao longo da mão (empírico)
	_attach.add_child(_revolver)
	_attach.add_child(_shotgun)

func _process(_dt: float) -> void:
	var g = get_node_or_null("/root/Game")
	var w: StringName = g.player.get("weapon", &"revolver") if g else &"revolver"
	if _revolver:
		_revolver.visible = (w == &"revolver")
	if _shotgun:
		_shotgun.visible = (w == &"shotgun")

# posição de MUNDO da boca do cano da arma ativa (origem visível do disparo)
func muzzle_world() -> Vector3:
	var w: Node3D = _revolver if (_revolver and _revolver.visible) else _shotgun
	if w == null:
		return global_position
	var tip := Vector3(0, 0.02, -0.24) if w == _revolver else Vector3(0, 0.02, -0.78)
	return w.global_transform * tip

# flash de boca: luz + clarão por ~90 ms na ponta do cano
func flash() -> void:
	var w: Node3D = _revolver if (_revolver and _revolver.visible) else _shotgun
	if w == null:
		return
	var tip := Vector3(0, 0.02, -0.24) if w == _revolver else Vector3(0, 0.02, -0.78)
	var fl := Node3D.new()
	w.add_child(fl)
	fl.position = tip
	var light := OmniLight3D.new()
	light.light_color = Color(1.0, 0.75, 0.35)
	light.light_energy = 6.0
	light.omni_range = 3.0
	fl.add_child(light)
	var m := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.06
	sm.height = 0.12
	m.mesh = sm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.85, 0.4)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.7, 0.25)
	mat.emission_energy_multiplier = 8.0
	m.material_override = mat
	fl.add_child(m)
	var tw := fl.create_tween()
	tw.tween_interval(0.09)
	tw.tween_callback(fl.queue_free)

func _find_skel(n: Node) -> Skeleton3D:
	if n is Skeleton3D:
		return n
	for c in n.get_children():
		var s = _find_skel(c)
		if s:
			return s
	return null

func _metal() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.16, 0.16, 0.18)
	m.metallic = 0.8
	m.roughness = 0.35
	return m

func _wood() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.32, 0.20, 0.10)
	m.roughness = 0.8
	return m

func _box(parent: Node, size: Vector3, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	mi.mesh = b
	mi.material_override = mat
	mi.position = pos
	parent.add_child(mi)
	return mi

# o pulso aponta os dedos para -Z local (empírico); ajustes finos no render
func _make_revolver() -> Node3D:
	var r := Node3D.new()
	r.name = "Revolver"
	# cano + tambor + cão (metal) e empunhadura (madeira)
	_box(r, Vector3(0.035, 0.04, 0.19), Vector3(0, 0.02, -0.13), _metal())          # cano
	_box(r, Vector3(0.045, 0.06, 0.07), Vector3(0, 0.01, -0.02), _metal())         # tambor
	_box(r, Vector3(0.03, 0.03, 0.03), Vector3(0, 0.045, 0.03), _metal())          # cão
	_box(r, Vector3(0.035, 0.09, 0.05), Vector3(0, -0.05, 0.03), _wood())          # empunhadura
	return r

func _make_shotgun() -> Node3D:
	var sg := Node3D.new()
	sg.name = "Shotgun"
	# cano duplo longo + bombeado + coronha de madeira
	_box(sg, Vector3(0.045, 0.045, 0.72), Vector3(0, 0.02, -0.40), _metal())       # canos
	_box(sg, Vector3(0.05, 0.05, 0.16), Vector3(0, -0.01, -0.35), _wood())         # bombeado (pump)
	_box(sg, Vector3(0.05, 0.09, 0.22), Vector3(0, -0.03, 0.06), _wood())          # coronha
	return sg

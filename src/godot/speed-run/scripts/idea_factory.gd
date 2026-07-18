# idea_factory.gd — RÉPLICA do Fiat Idea Adventure 2013 Dualogic PRATA
# (o carro do Marco). Construída por LOFT paramétrico nas MEDIDAS REAIS
# (pesquisa 2026-07-18): 4,21×1,75×1,81 m, entre-eixos 2,511 m, 1.325 kg.
# Traços Adventure reproduzidos: monovolume alto de capô curto, rack de teto
# em "V" preto, cladding plástico preto até meia-porta, para-choques robustos
# escuros com faróis de neblina, ESTEPE com capa na tampa traseira,
# retrovisores com repetidor, prata metálico (Prata Bari).
class_name IdeaFactory

const LEN := 4.21
const HALF_W := 0.87       # largura 1,75 m
const WHEELBASE := 2.511

# estações do loft: [z da frente (0→LEN), roofY, beltY, halfW]
const STATIONS := [
	[0.00, 0.92, 0.60, 0.80],
	[0.12, 1.00, 0.66, 0.85],
	[0.50, 1.04, 0.72, 0.86],
	[1.05, 1.08, 0.84, HALF_W],   # fim do capô curto
	[1.30, 1.18, 1.02, HALF_W],   # base do para-brisa
	[1.70, 1.55, 1.02, HALF_W],   # para-brisa inclinado
	[2.00, 1.62, 1.02, HALF_W],   # início do teto
	[3.30, 1.63, 1.02, HALF_W],   # teto quase plano
	[3.75, 1.58, 1.02, 0.85],
	[4.05, 1.46, 1.00, 0.80],
	[4.21, 0.92, 0.86, 0.76],     # tampa traseira quase vertical
]
const GLASS_Z0 := 1.32     # começo do vidro (para-brisa)
const GLASS_Z1 := 4.02     # vigia traseira


static func build_visual() -> Node3D:
	var root := Node3D.new()
	root.name = "IdeaAdventure"

	var silver := StandardMaterial3D.new()
	silver.albedo_color = Color(0.72, 0.73, 0.75)   # Prata Bari
	silver.metallic = 0.85
	silver.roughness = 0.32
	var black := StandardMaterial3D.new()
	black.albedo_color = Color(0.10, 0.10, 0.11)    # plástico Adventure
	black.roughness = 0.85
	var glass := StandardMaterial3D.new()
	glass.albedo_color = Color(0.08, 0.10, 0.12)
	glass.metallic = 0.9
	glass.roughness = 0.08

	var sts := {
		"silver": SurfaceTool.new(), "black": SurfaceTool.new(), "glass": SurfaceTool.new(),
	}
	for k in sts:
		sts[k].begin(Mesh.PRIMITIVE_TRIANGLES)

	var rings: Array = []
	for s in STATIONS:
		rings.append(_ring(s[0], s[1], s[2], s[3]))
	for i in rings.size() - 1:
		_loft(sts, rings[i], rings[i + 1],
			(STATIONS[i][0] + STATIONS[i + 1][0]) / 2.0)
	_cap(sts["silver"], rings[0], true)             # face frontal (prata)
	_cap(sts["silver"], rings[rings.size() - 1], false)  # tampa traseira (prata)

	for k in sts:
		var st: SurfaceTool = sts[k]
		st.generate_normals()
		var mesh := st.commit()
		if mesh.get_surface_count() == 0:
			continue
		mesh.surface_set_material(0, {"silver": silver, "black": black, "glass": glass}[k])
		var mi := MeshInstance3D.new()
		mi.mesh = mesh
		root.add_child(mi)

	_details(root, silver, black)
	# modelo construído com z=0 na FRENTE e crescendo p/ trás; centralizar põe
	# a frente em -Z, que JÁ é o forward do Godot — sem rotação extra.
	root.position = Vector3(0, 0, -LEN / 2.0)
	var wrap := Node3D.new()
	wrap.name = "IdeaWrap"
	wrap.add_child(root)
	return wrap


# anel do loft no plano z: pontos da direita p/ esquerda (fechado embaixo)
static func _ring(z: float, roof: float, belt: float, w: float) -> Array:
	var tumble := 0.80                                # vidros inclinam p/ dentro
	return [
		Vector3(-w * 0.60, 0.30, z),                  # 0 assoalho esq
		Vector3(-w, 0.52, z),                         # 1 saia esq
		Vector3(-w, belt, z),                         # 2 cintura esq
		Vector3(-w * tumble, roof - 0.03, z),         # 3 topo do vidro esq
		Vector3(-w * 0.34, roof, z),                  # 4 teto esq
		Vector3(w * 0.34, roof, z),                   # 5 teto dir
		Vector3(w * tumble, roof - 0.03, z),          # 6 topo do vidro dir
		Vector3(w, belt, z),                          # 7 cintura dir
		Vector3(w, 0.52, z),                          # 8 saia dir
		Vector3(w * 0.60, 0.30, z),                   # 9 assoalho dir
	]

# faixa de material por segmento do anel: 0-1/8-9 preto (saia+assoalho),
# 1-2/7-8 prata OU preto (cladding baixo e para-choques), 2-3/6-7 vidro na
# faixa da cabine, teto prata.
static func _seg_mat(seg: int, z: float, y: float) -> String:
	if seg in [0, 8]:
		return "black"
	if seg in [1, 7]:
		if (z < 0.55 and y < 0.9) or (z > 3.95 and y < 0.95) or y < 0.62:
			return "black"                            # para-choques + cladding
		return "silver"
	if seg in [2, 6]:
		if z > GLASS_Z0 and z < GLASS_Z1:
			return "glass"
		return "silver"
	return "silver"

static func _loft(sts: Dictionary, a: Array, b: Array, zmid: float) -> void:
	for seg in a.size() - 1:
		var ymid: float = (a[seg].y + a[seg + 1].y + b[seg].y + b[seg + 1].y) / 4.0
		var st: SurfaceTool = sts[_seg_mat(seg, zmid, ymid)]
		st.add_vertex(a[seg]); st.add_vertex(a[seg + 1]); st.add_vertex(b[seg])
		st.add_vertex(b[seg]); st.add_vertex(a[seg + 1]); st.add_vertex(b[seg + 1])
	# fundo
	var st2: SurfaceTool = sts["black"]
	st2.add_vertex(a[0]); st2.add_vertex(b[0]); st2.add_vertex(a[a.size() - 1])
	st2.add_vertex(a[a.size() - 1]); st2.add_vertex(b[0]); st2.add_vertex(b[b.size() - 1])

static func _cap(st: SurfaceTool, ring: Array, front: bool) -> void:
	var c := Vector3.ZERO
	for p in ring:
		c += p
	c /= ring.size()
	for i in ring.size() - 1:
		if front:
			st.add_vertex(c); st.add_vertex(ring[i]); st.add_vertex(ring[i + 1])
		else:
			st.add_vertex(c); st.add_vertex(ring[i + 1]); st.add_vertex(ring[i])

# detalhes Adventure: rack em V, estepe na tampa, neblina, faróis, lanternas,
# retrovisores com repetidor, grade + badge, skid plate, placa.
static func _details(root: Node3D, silver: StandardMaterial3D, black: StandardMaterial3D) -> void:
	var red := StandardMaterial3D.new()
	red.albedo_color = Color(0.75, 0.08, 0.08)
	red.emission_enabled = true
	red.emission = Color(0.4, 0.02, 0.02)
	var light := StandardMaterial3D.new()
	light.albedo_color = Color(0.92, 0.93, 0.9)
	light.emission_enabled = true
	light.emission = Color(0.55, 0.55, 0.5)
	var amber := StandardMaterial3D.new()
	amber.albedo_color = Color(0.95, 0.65, 0.15)

	# rack de teto em "V" (Adventure) — 2 longarinas pretas convergindo à frente
	for side in [-1.0, 1.0]:
		var rail := MeshInstance3D.new()
		var bar := BoxMesh.new()
		bar.size = Vector3(0.07, 0.07, 2.05)
		bar.material = black
		rail.mesh = bar
		rail.position = Vector3(side * 0.52, 1.70, 2.85)
		rail.rotation.y = side * 0.055                 # o "V"
		root.add_child(rail)
		for zz in [1.95, 3.7]:
			var foot := MeshInstance3D.new()
			var fb := BoxMesh.new()
			fb.size = Vector3(0.09, 0.08, 0.16)
			fb.material = black
			foot.mesh = fb
			foot.position = Vector3(side * (0.52 + (0.06 if zz < 3 else -0.02)), 1.645, zz)
			root.add_child(foot)

	# ESTEPE com capa na tampa traseira (marca registrada do Adventure)
	var spare := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.31; cyl.bottom_radius = 0.31; cyl.height = 0.15
	cyl.material = black
	spare.mesh = cyl
	spare.rotation.x = PI / 2
	spare.position = Vector3(0, 0.98, 4.27)
	root.add_child(spare)
	var cover := MeshInstance3D.new()
	var cc := CylinderMesh.new()
	cc.top_radius = 0.20; cc.bottom_radius = 0.20; cc.height = 0.155
	cc.material = silver
	cover.mesh = cc
	cover.rotation.x = PI / 2
	cover.position = Vector3(0, 0.98, 4.275)
	root.add_child(cover)

	# faróis (frente, contornando o canto) + neblina no para-choque
	for side in [-1.0, 1.0]:
		var hl := MeshInstance3D.new()
		var hb := BoxMesh.new()
		hb.size = Vector3(0.26, 0.12, 0.08)
		hb.material = light
		hl.mesh = hb
		hl.position = Vector3(side * 0.55, 0.82, 0.10)
		hl.rotation.y = side * -0.25
		root.add_child(hl)
		var fog := MeshInstance3D.new()
		var fc := CylinderMesh.new()
		fc.top_radius = 0.055; fc.bottom_radius = 0.055; fc.height = 0.04
		fc.material = light
		fog.mesh = fc
		fog.rotation.x = PI / 2
		fog.position = Vector3(side * 0.55, 0.44, 0.10)
		root.add_child(fog)
		# lanternas traseiras verticais
		var tl := MeshInstance3D.new()
		var tb := BoxMesh.new()
		tb.size = Vector3(0.10, 0.34, 0.06)
		tb.material = red
		tl.mesh = tb
		tl.position = Vector3(side * 0.74, 1.16, 4.19)
		root.add_child(tl)
		# retrovisores com repetidor (seta âmbar)
		var mir := MeshInstance3D.new()
		var mb := BoxMesh.new()
		mb.size = Vector3(0.20, 0.13, 0.07)
		mb.material = black
		mir.mesh = mb
		mir.position = Vector3(side * 1.00, 1.14, 1.48)
		root.add_child(mir)
		var rep := MeshInstance3D.new()
		var rb := BoxMesh.new()
		rb.size = Vector3(0.10, 0.025, 0.02)
		rb.material = amber
		rep.mesh = rb
		rep.position = Vector3(side * 1.00, 1.12, 1.44)
		root.add_child(rep)

	# grade escura + badge FIAT vermelho
	var grille := MeshInstance3D.new()
	var gb := BoxMesh.new()
	gb.size = Vector3(0.55, 0.10, 0.04)
	gb.material = black
	grille.mesh = gb
	grille.position = Vector3(0, 0.74, 0.10)
	root.add_child(grille)
	var badge := MeshInstance3D.new()
	var bc := CylinderMesh.new()
	bc.top_radius = 0.055; bc.bottom_radius = 0.055; bc.height = 0.03
	bc.material = red
	badge.mesh = bc
	badge.rotation.x = PI / 2
	badge.position = Vector3(0, 0.74, 0.115)
	root.add_child(badge)

	# skid plate prateado sob o para-choque (Adventure)
	# para-choques robustos pretos (Adventure) + skid prata embutido
	for zz in [0.10, 4.11]:
		var bump := MeshInstance3D.new()
		var bb := BoxMesh.new()
		bb.size = Vector3(1.58, 0.36, 0.36)
		bb.material = black
		bump.mesh = bb
		bump.position = Vector3(0, 0.42, zz + (0.08 if zz < 1.0 else -0.08))
		root.add_child(bump)
		var skid := MeshInstance3D.new()
		var sb := BoxMesh.new()
		sb.size = Vector3(0.66, 0.12, 0.30)
		sb.material = silver
		skid.mesh = sb
		skid.position = Vector3(0, 0.30, zz)
		root.add_child(skid)

	# placa
	var plate := MeshInstance3D.new()
	var pb := BoxMesh.new()
	pb.size = Vector3(0.40, 0.13, 0.02)
	var pmat := StandardMaterial3D.new()
	pmat.albedo_color = Color(0.85, 0.87, 0.9)
	pb.material = pmat
	plate.mesh = pb
	plate.position = Vector3(0, 0.46, 0.115)
	root.add_child(plate)

# water.gd — rios (fitas com shader de fluxo), lago, vaus/profundos e pontes.
# water_info(x,z): classificação de vau/profundo para a locomoção (SPEC §M-04).
# bridge_at(x,z) → altura do tabuleiro se dentro de uma ponte (0 = fora).
class_name BangWater
extends Node3D

const RIVER_W := 7.0
const FORD_MAX_DEPTH := 1.2
const WATER_SHADER := """
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_disabled, diffuse_burley, specular_schlick_ggx;
uniform vec4 color_shallow : source_color = vec4(0.35, 0.58, 0.66, 0.7);
uniform vec4 color_deep : source_color = vec4(0.12, 0.34, 0.48, 0.8);
uniform float speed = 0.6;
void vertex() {
	VERTEX.y += sin(VERTEX.x * 0.8 + TIME * 1.4) * 0.08 + cos(VERTEX.z * 0.6 + TIME * 1.1) * 0.08;
}
void fragment() {
	float flow = sin(UV.y * 40.0 - TIME * speed * 6.0) * 0.5 + 0.5;
	vec4 c = mix(color_deep, color_shallow, 0.35 + flow * 0.35);
	ALBEDO = c.rgb;
	ALPHA = c.a;
	ROUGHNESS = 0.15;
	SPECULAR = 0.6;
}
"""

var gen: Dictionary = {}
var terrain: Node = null
var water_mat: ShaderMaterial
var bridges: Array = []   # { center: Vector3, half: Vector2, deck_y: float }

func build(p_terrain: Node, p_gen: Dictionary) -> void:
	terrain = p_terrain
	gen = p_gen
	var sh := Shader.new()
	sh.code = WATER_SHADER
	water_mat = ShaderMaterial.new()
	water_mat.shader = sh
	for r in gen["rivers"]:
		_build_river_ribbon(r)
	_build_lake()
	_build_bridges()

func _gen_to_world(p: Vector2) -> Vector2:
	return p - Vector2(1024, 1024)

func _build_river_ribbon(r: Dictionary) -> void:
	var pts: Array = r["points"]
	var bed: PackedFloat32Array = r["bed"]
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
	for i in range(pts.size()):
		var p: Vector2 = _gen_to_world(pts[i])
		var dir := Vector2.ZERO
		if i < pts.size() - 1:
			dir = (_gen_to_world(pts[i + 1]) - p).normalized()
		else:
			dir = (p - _gen_to_world(pts[i - 1])).normalized()
		var perp := Vector2(-dir.y, dir.x) * (RIVER_W * 0.5)
		var y := bed[i] + 0.35
		st.set_uv(Vector2(0, i * 0.25))
		st.set_normal(Vector3.UP)
		st.add_vertex(Vector3(p.x - perp.x, y, p.y - perp.y))
		st.set_uv(Vector2(1, i * 0.25))
		st.set_normal(Vector3.UP)
		st.add_vertex(Vector3(p.x + perp.x, y, p.y + perp.y))
	# generate_normals() não aceita TRIANGLE_STRIP — normais manuais (UP) acima
	var mi := MeshInstance3D.new()
	mi.name = "River"
	mi.mesh = st.commit()
	mi.material_override = water_mat
	add_child(mi)

func _build_lake() -> void:
	var c: Vector2 = _gen_to_world(gen["lake_center"])
	var plane := PlaneMesh.new()
	plane.size = Vector2(150, 150)
	var mi := MeshInstance3D.new()
	mi.name = "Lake"
	mi.mesh = plane
	mi.material_override = water_mat
	mi.position = Vector3(c.x, gen["lake_y"] + 0.3, c.y)
	add_child(mi)

func _build_bridges() -> void:
	# 1 ponte por rio, no ponto médio do curso
	for ri in range(gen["rivers"].size()):
		var r = gen["rivers"][ri]
		var i := int(r["points"].size() * 0.55)
		var p: Vector2 = _gen_to_world(r["points"][i])
		# tabuleiro no nível das margens (canal tem ~4.5m de profundidade)
		var deck_y: float = r["bed"][i] + 4.9
		var dir := Vector2(0, 1)
		if i < r["points"].size() - 1:
			dir = (_gen_to_world(r["points"][i + 1]) - p).normalized()
		var perp := Vector2(-dir.y, dir.x)
		var b := _make_bridge_mesh(perp)
		b.position = Vector3(p.x, deck_y, p.y)
		add_child(b)
		bridges.append({
			"center": Vector3(p.x, deck_y, p.y),
			"dir": perp,
			"half": Vector2(3.0, 12.0),
			"deck_y": deck_y,
		})

func _make_bridge_mesh(dir: Vector2) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = "Bridge"
	var wood := StandardMaterial3D.new()
	wood.albedo_color = Color(0.45, 0.3, 0.18)
	wood.roughness = 0.9
	# tabuleiro (24 m — vence o canal de 20 m com apoio nas margens)
	var deck := MeshInstance3D.new()
	var dm := BoxMesh.new()
	dm.size = Vector3(6.0, 0.4, 24.0)
	deck.mesh = dm
	deck.material_override = wood
	body.add_child(deck)
	# trilhos laterais
	for s in [-1.0, 1.0]:
		var rail := MeshInstance3D.new()
		var rm := BoxMesh.new()
		rm.size = Vector3(0.3, 1.0, 24.0)
		rail.mesh = rm
		rail.material_override = wood
		rail.position = Vector3(s * 2.85, 0.7, 0)
		body.add_child(rail)
	# pilares de sustentação (descem até o fundo do canal)
	for s in [-6.0, 6.0]:
		var post := MeshInstance3D.new()
		var pm := BoxMesh.new()
		pm.size = Vector3(4.5, 5.2, 0.8)
		post.mesh = pm
		post.material_override = wood
		post.position = Vector3(0, -2.6, s)
		body.add_child(post)
	# colisão do tabuleiro
	var col := CollisionShape3D.new()
	var cs := BoxShape3D.new()
	cs.size = Vector3(6.0, 0.4, 24.0)
	col.shape = cs
	body.add_child(col)
	# orienta o tabuleiro perpendicular ao rio
	var ang := atan2(dir.x, dir.y)
	body.rotation.y = ang
	return body

# classificação para a locomoção: {} | {in_water, ford, deep}
func water_info(x: float, z: float) -> Dictionary:
	var h: float = terrain.height_at(x, z)
	if h <= gen["lake_y"] + 0.5:
		var depth: float = gen["lake_y"] - h + 0.5
		return { "in_water": true, "ford": depth <= FORD_MAX_DEPTH, "deep": depth > FORD_MAX_DEPTH, "depth": depth }
	for r in gen["rivers"]:
		var pts: Array = r["points"]
		var bed: PackedFloat32Array = r["bed"]
		for i in range(pts.size()):
			var p: Vector2 = _gen_to_world(pts[i])
			if Vector2(x, z).distance_to(p) < RIVER_W * 0.5:
				var depth2: float = bed[i] + 0.35 - h
				if depth2 > 0.0:
					# vaus alternados: segmentos pares = vau
					var ford := (i % 4) < 2 and depth2 <= FORD_MAX_DEPTH
					return { "in_water": true, "ford": ford, "deep": depth2 > FORD_MAX_DEPTH, "depth": depth2 }
	return {}

# altura do tabuleiro se (x,z) está numa ponte; 0 = fora
func bridge_at(x: float, z: float) -> float:
	for b in bridges:
		var d := Vector2(x, z) - Vector2(b["center"].x, b["center"].z)
		var dir: Vector2 = b["dir"]
		var along := absf(d.dot(dir))
		var across := absf(d.dot(Vector2(-dir.y, dir.x)))
		if along <= b["half"].y and across <= b["half"].x:
			return b["deck_y"]
	return 0.0

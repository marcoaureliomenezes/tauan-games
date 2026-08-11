class_name Garrison
extends RefCounted
## Garrison — guarnição de ocupação de Cachoeira da Prata (port de
## inhauma-garrison.js): patrulha aérea (zepelim + 2 helicópteros), 3 ninhos
## de AA nos morros (anel 300-800 m), 2 colunas blindadas na MG-060 (laço
## ida-e-volta), QG (encampment 8 + samSite 6) ao norte do shelf.
## TODO(v0.2): trecho real da MG-060 quando as estradas forem portadas —
## hoje a coluna circula numa polilinha aproximada em x≈-1250.

const AA_CANDIDATES := 80
const AA_MIN_HEIGHT_M := 14.0
const AA_MAX_SLOPE := 0.55
# Trechos da MG-060 que margeiam a cidade (inhauma-garrison.js ARMOR_SEGMENTS)
const ARMOR_SEGMENTS := [[400.0, 640.0], [560.0, 780.0]]
const MG060_X := -1250.0


static func build(parent: Node3D, surface_fn: Callable, heightmap: InhaumaHeightmap,
		rng: RandomNumberGenerator) -> Array[Formation]:
	var out: Array[Formation] = []
	var c := GameConfig.CACHOEIRA_CENTER
	var g := GameConfig.GARRISON

	# 1) Patrulha aérea: zepelim alto (r=210), helicópteros baixos (r=130/155)
	for i in g.zeppelins:
		var f := Formation.create_air_patrol("fZeppelin",
			_air_loop(c, 210.0, 10, rng), surface_fn, "cachoeira-zeppelin-%d" % i)
		parent.add_child(f)
		out.append(f)
	for i in g.helicopters:
		var center := c + Vector2(rng.randf_range(-70, 70), rng.randf_range(-70, 70))
		var f := Formation.create_air_patrol("fHelicopter",
			_air_loop(center, 130.0 + i * 25.0, 8, rng), surface_fn, "cachoeira-heli-%d" % i)
		parent.add_child(f)
		out.append(f)

	# 2) Ninhos de AA nos morros ao redor
	var hilltops := _pick_aa_hilltops(surface_fn, heightmap, rng, g.aa_nests.count)
	for i in hilltops.size():
		var f := Formation.create("aaNest", g.aa_nests.guns_each, [hilltops[i]],
			surface_fn, rng, "cachoeira-aa-%d" % i)
		parent.add_child(f)
		out.append(f)

	# 3) Blindados circulando nos trechos da MG-060 (laço ida-e-volta)
	for i in mini(g.armored_columns.count, ARMOR_SEGMENTS.size()):
		var seg: Array = ARMOR_SEGMENTS[i]
		var path := _road_out_and_back(seg[0], seg[1])
		var f := Formation.create("armoredColumn", g.armored_columns.units, path,
			surface_fn, rng, "cachoeira-armor-%d" % i, true)
		parent.add_child(f)
		out.append(f)

	# 4) QG: encampment + samSite ao norte do shelf (z = minZ - 70 / minZ - 55)
	var shelf := GameConfig.CACHOEIRA_SHELF
	var hq := c + Vector2(rng.randf_range(-15, 15), shelf.position.y - c.y - 70 + rng.randf_range(-10, 10))
	var f_hq := Formation.create("encampment", g.hq.encampment, [hq], surface_fn, rng, "cachoeira-hq")
	parent.add_child(f_hq)
	out.append(f_hq)
	var sam := c + Vector2(85 + rng.randf_range(-10, 10), shelf.position.y - c.y - 55 + rng.randf_range(-8, 8))
	var f_sam := Formation.create("samSite", g.hq.sam_site, [sam], surface_fn, rng, "cachoeira-hq-sam")
	parent.add_child(f_sam)
	out.append(f_sam)
	return out


static func _air_loop(center: Vector2, radius: float, n: int, rng: RandomNumberGenerator) -> Array:
	var pts := []
	var phase := rng.randf() * TAU
	for i in n:
		var a := phase + (float(i) / n) * TAU
		var r := radius * rng.randf_range(0.85, 1.15)
		pts.append(center + Vector2(cos(a), sin(a)) * r)
	pts.append(pts[0]) # fecha o circuito
	return pts


static func _road_out_and_back(z_min: float, z_max: float) -> Array:
	var seg := []
	var z := z_min
	while z <= z_max:
		seg.append(Vector2(MG060_X, z))
		z += 40.0
	var path := seg.duplicate()
	for i in range(seg.size() - 2, -1, -1):
		path.append(seg[i])
	return path


static func _pick_aa_hilltops(surface_fn: Callable, heightmap: InhaumaHeightmap,
		rng: RandomNumberGenerator, count: int) -> Array[Vector2]:
	var c := GameConfig.CACHOEIRA_CENTER
	var ring := GameConfig.GARRISON.aa_nests
	var shelf := GameConfig.CACHOEIRA_SHELF.grow(40)
	var candidates: Array[Dictionary] = []
	for i in AA_CANDIDATES:
		var a := rng.randf() * TAU
		var r := rng.randf_range(ring.ring_min, ring.ring_max)
		var p := c + Vector2(cos(a), sin(a)) * r
		if shelf.has_point(p):
			continue
		var h: float = surface_fn.call(p.x, p.y)
		if h < AA_MIN_HEIGHT_M:
			continue
		if heightmap.slope_at(p.x, p.y) > AA_MAX_SLOPE:
			continue
		candidates.append({"p": p, "h": h})
	candidates.sort_custom(func(a, b): return a.h > b.h)
	var picked: Array[Vector2] = []
	for cand in candidates:
		if picked.size() >= count:
			break
		var ok := true
		for q in picked:
			if q.distance_to(cand.p) < ring.min_sep:
				ok = false
				break
		if ok:
			picked.append(cand.p)
	return picked

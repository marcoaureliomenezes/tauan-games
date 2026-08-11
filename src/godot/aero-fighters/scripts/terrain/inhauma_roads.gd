class_name InhaumaRoads
extends RefCounted
## InhaumaRoads — corredores autorais do web (inhauma-road-defs.js): MG-238
## (pista dupla), Anel de Inhaúma, AMG-0360, MG-060 (cidade). Catmull-Rom puro
## a 12 m. Fornece: leito de estrada (flatten na cadeia de altura) e polilinhas
## para as fitas visuais. Tráfego: TODO(v0.3).

const SAMPLE_STEP := 12.0
const BED_BLEND_M := 12.0
const KIND_COLOR := {
	"highway": Color(0.251, 0.263, 0.290), # 0x40434a
	"regional": Color(0.286, 0.298, 0.322), # 0x494c52
	"street": Color(0.325, 0.337, 0.361), # 0x53565c
}

const CORRIDORS := [
	{"id": "mg-238", "kind": "highway", "width": 15.0, "closed": false, "dual": true,
		"control": [[-300, 15], [-90, -30], [220, -10], [560, -40], [880, -70],
			[1160, -180], [1320, -330], [1330, -150], [1335, -70]]},
	{"id": "anel-inhauma", "kind": "regional", "width": 11.0, "closed": true,
		"control": [[60, -285], [225, -270], [165, -185], [-10, -110], [-90, -95],
			[-165, -80], [-150, -230], [-30, -290]]},
	{"id": "amg-0360", "kind": "street", "width": 8.0, "closed": false,
		"control": [[120, -260], [220, -480], [280, -720], [220, -950], [100, -1150]]},
	{"id": "mg-060", "kind": "regional", "width": 9.0, "closed": false,
		"control": [[-841, -567], [-800, -320], [-780, -120], [-795, 20]]},
	# MG-060 de Cachoeira (aprox. da osm-mg-060 do web — guarnição circula nela)
	{"id": "mg-060-cachoeira", "kind": "regional", "width": 9.0, "closed": false,
		"control": [[-1250, 800], [-1250, 640], [-1250, 500], [-1250, 380], [-1245, 300]]},
]

# Por corredor: {points: PackedVector2Array, heights: PackedFloat32Array, width, kind, dual, closed}
var corridors: Array[Dictionary] = []
# Cruzamentos rio×estrada: {c, i0, i1, center: Vector2, deck_h, dir: Vector2, length}
var crossings: Array[Dictionary] = []

# Índice espacial plano (mesmo padrão do rio): células de 200 m ±6.000 m
const IDX_REGION := 6000.0
const IDX_CELL := 200.0
const IDX_SIDE := 60
var _idx: Array = [] # por célula: Array de [corredor, ponto]
var _river: InhaumaRiver


func _init(heightmap: InhaumaHeightmap) -> void:
	_river = heightmap.river()
	_idx.resize(IDX_SIDE * IDX_SIDE)
	for i in _idx.size():
		_idx[i] = []
	for c in CORRIDORS:
		var pts := _sample_corridor(c.control, c.closed)
		# Perfil de altura: natural suavizado (janela móvel) — estrada dirigível
		var hs := PackedFloat32Array()
		hs.resize(pts.size())
		for i in pts.size():
			hs[i] = heightmap.height_at(pts[i].x, pts[i].y)
		var smoothed := PackedFloat32Array()
		smoothed.resize(pts.size())
		var win := 8
		for i in pts.size():
			var sum := 0.0
			var cnt := 0
			for j in range(maxi(0, i - win), mini(pts.size() - 1, i + win) + 1):
				sum += hs[j]
				cnt += 1
			smoothed[i] = sum / cnt
		corridors.append({"points": pts, "heights": smoothed, "width": c.width,
			"kind": c.kind, "dual": c.get("dual", false), "closed": c.closed, "id": c.id})
		# Indexa
		for i in pts.size():
			var cx := int((pts[i].x + IDX_REGION) / IDX_CELL)
			var cz := int((pts[i].y + IDX_REGION) / IDX_CELL)
			if cx < 0 or cz < 0 or cx >= IDX_SIDE or cz >= IDX_SIDE:
				continue
			_idx[cx + cz * IDX_SIDE].append([corridors.size() - 1, i])
	_detect_crossings()


## Acha trechos de corredor que cruzam o canal do rio (ponte — T-06 do web).
func _detect_crossings() -> void:
	for ci in corridors.size():
		var c: Dictionary = corridors[ci]
		var start := -1
		for i in c.points.size():
			var in_channel := _river.is_channel(c.points[i].x, c.points[i].y)
			if in_channel and start < 0:
				start = i
			elif not in_channel and start >= 0:
				_add_crossing(ci, start, i - 1)
				start = -1
		if start >= 0:
			_add_crossing(ci, start, c.points.size() - 1)


func _add_crossing(ci: int, i0: int, i1: int) -> void:
	var c: Dictionary = corridors[ci]
	var length := 0.0
	for i in range(i0, i1):
		length += c.points[i].distance_to(c.points[i + 1])
	if length < 8.0:
		return
	var mid := (i0 + i1) / 2
	var deck_h: float = maxf(c.heights[maxi(i0 - 2, 0)], c.heights[mini(i1 + 2, c.heights.size() - 1)]) + 1.0
	var dir: Vector2 = (c.points[mini(i1 + 1, c.points.size() - 1)] - c.points[maxi(i0 - 1, 0)]).normalized()
	crossings.append({"c": ci, "i0": i0, "i1": i1, "center": c.points[mid],
		"deck_h": deck_h, "dir": dir, "length": length + 20.0})
	# Nivela o leito da estrada no tabuleiro (bridgeDeckHeightAt do web)
	for i in range(i0, i1 + 1):
		c.heights[i] = deck_h


## Cota do tabuleiro se (x,z) está sobre uma ponte (-1 fora).
func deck_at(x: float, z: float) -> float:
	for cr in crossings:
		var to_p := Vector2(x, z) - (cr.center as Vector2)
		if absf(to_p.dot(cr.dir)) <= cr.length * 0.5 \
				and absf(to_p.dot(Vector2(-cr.dir.y, cr.dir.x))) <= corridors[cr.c].width * 0.5 + 6.0:
			return cr.deck_h
	return -1.0


## Leito de estrada: mesma posição na cadeia do web (depois de tudo, antes das pontes).
func road_bed_at(x: float, z: float, h: float) -> float:
	var info := _nearest(x, z)
	if info.x < 0.0:
		return h
	var half: float = corridors[int(info.x)].width * 0.5
	if info.z >= half + BED_BLEND_M:
		return h
	var road_h: float = corridors[int(info.x)].heights[int(info.y)]
	var t: float = 1.0 if info.z <= half else 1.0 - (info.z - half) / BED_BLEND_M
	var k: float = t * t * (3.0 - 2.0 * t)
	return h * (1.0 - k) + road_h * k


## Estrada mais próxima: Vector3(corredor, ponto, dist); corredor = -1 se nenhuma.
## Escalar (sem Dictionary) — está na cadeia de altura, chamada milhões de vezes.
func _nearest(x: float, z: float) -> Vector3:
	if x < -IDX_REGION or x > IDX_REGION or z < -IDX_REGION or z > IDX_REGION:
		return Vector3(-1, 0, 0)
	var cx := int((x + IDX_REGION) / IDX_CELL)
	var cz := int((z + IDX_REGION) / IDX_CELL)
	var best_d := INF
	var best_c := -1
	var best_i := 0
	for dcx in range(-1, 2):
		for dcz in range(-1, 2):
			var ccx: int = cx + dcx
			var ccz: int = cz + dcz
			if ccx < 0 or ccz < 0 or ccx >= IDX_SIDE or ccz >= IDX_SIDE:
				continue
			for entry in _idx[ccx + ccz * IDX_SIDE]:
				var p: Vector2 = corridors[entry[0]].points[entry[1]]
				var d := Vector2(x - p.x, z - p.y).length()
				if d < best_d:
					best_d = d
					best_c = entry[0]
					best_i = entry[1]
	if best_c < 0:
		return Vector3(-1, 0, 0)
	return Vector3(best_c, best_i, best_d)


## Amostra Catmull-Rom uniforme pelos pontos de controle (port de sampleCorridor).
func _sample_corridor(control: Array, closed: bool) -> PackedVector2Array:
	var n := control.size()
	var pt := func(i: int) -> Vector2:
		if closed:
			var c: Array = control[((i % n) + n) % n]
			return Vector2(c[0], c[1])
		var c: Array = control[clampi(i, 0, n - 1)]
		return Vector2(c[0], c[1])
	var out := PackedVector2Array()
	var seg_count := n if closed else n - 1
	for i in seg_count:
		var p0: Vector2 = pt.call(i - 1)
		var p1: Vector2 = pt.call(i)
		var p2: Vector2 = pt.call(i + 1)
		var p3: Vector2 = pt.call(i + 2)
		var steps := maxi(2, ceili(p1.distance_to(p2) / SAMPLE_STEP))
		for s in steps:
			var t := float(s) / steps
			out.append(Vector2(_catmull(p0.x, p1.x, p2.x, p3.x, t), _catmull(p0.y, p1.y, p2.y, p3.y, t)))
	if closed:
		out.append(out[0])
	else:
		var last: Array = control[n - 1]
		out.append(Vector2(last[0], last[1]))
	return out


static func _catmull(p0: float, p1: float, p2: float, p3: float, t: float) -> float:
	var t2 := t * t
	var t3 := t2 * t
	return 0.5 * (2.0 * p1 + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
		+ (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3)

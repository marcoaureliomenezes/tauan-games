class_name InhaumaRiver
extends RefCounted
## InhaumaRiver — rio de Inhaúma derivado da DRENAGEM do DEM real (port de
## maps/inhauma-river.js): flood-fill do corredor de vale (<190 m), cabeceira
## (ponto mais alto) → foz (mais baixo) por Dijkstra de menor custo de subida,
## filtro de descida monotônica. Determinístico (sem RNG).

const SEARCH_RANGE_M := 5000.0
const MASK_STEP_M := 80.0
const VALLEY_CEILING_M := 190.0
const CLIMB_PENALTY := 200.0

const HALF_WIDTH_M := 20.0 # canal molhado (40 m total)
const BANK_BLEND_M := 26.0 # rampa de margem suave
const CARVE_DEPTH_M := 3.0 # leito sob a margem natural
const WATER_BELOW_BANK_M := 0.6

var polyline: Array[Dictionary] = [] # [{x, z, h}] cabeceira → foz

var _hm: InhaumaHeightmap
# Índice espacial em array plano (Dictionary era o gargalo do boot):
# região ±6.000 m em células de 200 m → 60×60 células, cada uma uma Array de
# índices de segmento da polilinha.
const IDX_REGION := 6000.0
const IDX_CELL := 200.0
const IDX_SIDE := 60
var _idx: Array = []


func _init(hm: InhaumaHeightmap) -> void:
	_hm = hm
	_trace()
	_build_index()


# ---------------------------------------------------------------------------
# Traçado (uma vez, no boot)
# ---------------------------------------------------------------------------
func _trace() -> void:
	var bounds := _hm.dem_bounds()
	var min_x: float = maxf(bounds.position.x, -SEARCH_RANGE_M)
	var max_x: float = minf(bounds.end.x, SEARCH_RANGE_M)
	var min_z: float = maxf(bounds.position.y, -SEARCH_RANGE_M)
	var max_z: float = minf(bounds.end.y, SEARCH_RANGE_M)
	var nx_lo := ceili(min_x / MASK_STEP_M)
	var nx_hi := floori(max_x / MASK_STEP_M)
	var nz_lo := ceili(min_z / MASK_STEP_M)
	var nz_hi := floori(max_z / MASK_STEP_M)
	var width := nx_hi - nx_lo + 1
	var height := nz_hi - nz_lo + 1
	var key := func(ix, iz): return (ix - nx_lo) + (iz - nz_lo) * width
	var in_bounds := func(ix, iz): return ix >= nx_lo and ix <= nx_hi and iz >= nz_lo and iz <= nz_hi
	var wx := func(ix): return ix * MASK_STEP_M
	var wz := func(iz): return iz * MASK_STEP_M
	# Flood-fill 4-conexo a partir da origem, abaixo do teto do vale
	var mask := PackedByteArray()
	mask.resize(width * height)
	if not in_bounds.call(0, 0):
		push_warning("InhaumaRiver: origem fora dos bounds do DEM")
		return
	var stack := [[0, 0]]
	mask[key.call(0, 0)] = 1
	while not stack.is_empty():
		var c: Array = stack.pop_back()
		for d in [[1, 0], [-1, 0], [0, 1], [0, -1]]:
			var nx: int = c[0] + d[0]
			var nz: int = c[1] + d[1]
			if not in_bounds.call(nx, nz):
				continue
			var k: int = key.call(nx, nz)
			if mask[k] != 0:
				continue
			if _hm.sample_dem(wx.call(nx), wz.call(nz)) < VALLEY_CEILING_M:
				mask[k] = 1
				stack.append([nx, nz])
			else:
				mask[k] = 2
	# Cabeceira (mais alto) e foz (mais baixo) dentro da máscara
	var head := Vector2i(-1, -1)
	var mouth := Vector2i(-1, -1)
	var head_h := -INF
	var mouth_h := INF
	for iz in range(nz_lo, nz_hi + 1):
		for ix in range(nx_lo, nx_hi + 1):
			if mask[key.call(ix, iz)] != 1:
				continue
			var h: float = _hm.sample_dem(wx.call(ix), wz.call(iz))
			if h > head_h:
				head_h = h
				head = Vector2i(ix, iz)
			if h < mouth_h:
				mouth_h = h
				mouth = Vector2i(ix, iz)
	if head == Vector2i(-1, -1):
		push_warning("InhaumaRiver: máscara do vale vazia")
		return
	# Dijkstra 8-conexo: custo = distância + penalidade forte por subida
	var costs := {}
	var prev := {}
	var heap: Array = [[0.0, head]] # min-heap [custo, cell]
	costs[head] = 0.0
	var dirs := [[1, 0, 1.0], [-1, 0, 1.0], [0, 1, 1.0], [0, -1, 1.0],
		[1, 1, 1.41421356], [1, -1, 1.41421356], [-1, 1, 1.41421356], [-1, -1, 1.41421356]]
	var found := false
	while not heap.is_empty():
		var top := _heap_pop(heap)
		var cost: float = top[0]
		var cell: Vector2i = top[1]
		if cell == mouth:
			found = true
			break
		if cost > costs.get(cell, INF):
			continue
		var h1: float = _hm.sample_dem(wx.call(cell.x), wz.call(cell.y))
		for d in dirs:
			var n := Vector2i(cell.x + d[0], cell.y + d[1])
			if not in_bounds.call(n.x, n.y) or mask[key.call(n.x, n.y)] != 1:
				continue
			var h2: float = _hm.sample_dem(wx.call(n.x), wz.call(n.y))
			var nc: float = cost + d[2] + maxf(0.0, h2 - h1) * CLIMB_PENALTY
			if nc < costs.get(n, INF):
				costs[n] = nc
				prev[n] = cell
				_heap_push(heap, [nc, n])
	if not found:
		push_warning("InhaumaRiver: sem caminho cabeceira→foz")
		return
	# Reconstrói e filtra para descida monotônica
	var raw: Array[Vector2i] = []
	var cur := mouth
	while cur != head:
		raw.push_front(cur)
		cur = prev[cur]
	raw.push_front(head)
	var last_h := INF
	for cell in raw:
		var h: float = _hm.sample_dem(wx.call(cell.x), wz.call(cell.y))
		if h <= last_h + 0.000001:
			polyline.append({"x": wx.call(cell.x), "z": wz.call(cell.y), "h": h})
			last_h = h


static func _heap_push(heap: Array, item: Array) -> void:
	heap.append(item)
	var i := heap.size() - 1
	while i > 0:
		var p := (i - 1) >> 1
		if heap[p][0] <= heap[i][0]:
			break
		var tmp = heap[p]
		heap[p] = heap[i]
		heap[i] = tmp
		i = p


static func _heap_pop(heap: Array) -> Array:
	var top = heap[0]
	var last = heap.pop_back()
	if not heap.is_empty():
		heap[0] = last
		var i := 0
		while true:
			var l := i * 2 + 1
			var r := l + 1
			var m := i
			if l < heap.size() and heap[l][0] < heap[m][0]:
				m = l
			if r < heap.size() and heap[r][0] < heap[m][0]:
				m = r
			if m == i:
				break
			var tmp = heap[m]
			heap[m] = heap[i]
			heap[i] = tmp
			i = m
	return top


# ---------------------------------------------------------------------------
# Consultas (índice espacial por buckets de 200 m)
# ---------------------------------------------------------------------------
func _build_index() -> void:
	_idx.resize(IDX_SIDE * IDX_SIDE)
	for i in _idx.size():
		_idx[i] = []
	for i in range(polyline.size() - 1):
		var a := polyline[i]
		var b := polyline[i + 1]
		var steps := int(Vector2(a.x, a.z).distance_to(Vector2(b.x, b.z)) / 100.0) + 1
		for s in range(steps + 1):
			var p := Vector2(a.x, a.z).lerp(Vector2(b.x, b.z), float(s) / steps)
			var cx := int((p.x + IDX_REGION) / IDX_CELL)
			var cz := int((p.y + IDX_REGION) / IDX_CELL)
			if cx < 0 or cz < 0 or cx >= IDX_SIDE or cz >= IDX_SIDE:
				continue
			var cell: Array = _idx[cx + cz * IDX_SIDE]
			if cell.is_empty() or cell[cell.size() - 1] != i:
				cell.append(i)


## Menor distância de (x,z) ao rio + altura da margem natural no ponto mais
## próximo: Vector2(dist, bank_h); dist = -1 se não houver rio por perto.
## Escalar (sem Dictionary) — está na cadeia de altura, chamada milhões de vezes.
func nearest_on_river(x: float, z: float) -> Vector2:
	if x < -IDX_REGION or x > IDX_REGION or z < -IDX_REGION or z > IDX_REGION:
		return Vector2(-1, 0)
	var cx := int((x + IDX_REGION) / IDX_CELL)
	var cz := int((z + IDX_REGION) / IDX_CELL)
	var best_d := INF
	var best_h := 0.0
	for dcx in range(-1, 2):
		for dcz in range(-1, 2):
			var ccx: int = cx + dcx
			var ccz: int = cz + dcz
			if ccx < 0 or ccz < 0 or ccx >= IDX_SIDE or ccz >= IDX_SIDE:
				continue
			for i in _idx[ccx + ccz * IDX_SIDE]:
				var a := polyline[i]
				var b := polyline[i + 1]
				var dx: float = b.x - a.x
				var dz: float = b.z - a.z
				var len2: float = dx * dx + dz * dz
				if len2 < 0.0001:
					continue
				var t := clampf(((x - a.x) * dx + (z - a.z) * dz) / len2, 0.0, 1.0)
				var px: float = a.x + t * dx
				var pz: float = a.z + t * dz
				var dist := Vector2(x - px, z - pz).length()
				if dist < best_d:
					best_d = dist
					best_h = a.h + (b.h - a.h) * t
	if best_d == INF:
		return Vector2(-1, 0)
	return Vector2(best_d, best_h)


## Altura entalhada (canal raso + margens suaves) — mesma posição na cadeia do web.
func carve_at(x: float, z: float, h: float) -> float:
	var info := nearest_on_river(x, z)
	if info.x < 0.0:
		return h
	var influence := HALF_WIDTH_M + BANK_BLEND_M
	if info.x >= influence:
		return h
	var bed: float = info.y - CARVE_DEPTH_M
	var inside_t: float = 1.0 if info.x <= HALF_WIDTH_M \
		else 1.0 - (info.x - HALF_WIDTH_M) / BANK_BLEND_M
	var k := inside_t * inside_t * (3.0 - 2.0 * inside_t)
	return h * (1.0 - k) + bed * k


## Cota da lâmina d'água na margem mais próxima (-1 se longe do rio).
func water_level_at(x: float, z: float) -> float:
	var info := nearest_on_river(x, z)
	if info.x < 0.0 or info.x > HALF_WIDTH_M:
		return -1.0
	return info.y - WATER_BELOW_BANK_M


func is_channel(x: float, z: float) -> bool:
	var info := nearest_on_river(x, z)
	return info.x >= 0.0 and info.x <= HALF_WIDTH_M

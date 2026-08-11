# terrain_gen.gd — Gerador DETERMINÍSTICO do heightfield do bang-bang (seed 1876).
# Funções puras (sem cena): gera a grade de alturas + rios monotônicos + lago.
# Layout (SPEC §M-02): vale central fBm (~26 m), anel de montanhas ridged com
# viés norte (~215 m), 2 rios descendo a 1 lago comum, neve no alto.
class_name TerrainGen
extends RefCounted

const SIZE_M := 2048.0          # mundo quadrado (m)
const GRID := 2049              # vértices por lado (1 m/vértice, região 2048)
const VALLEY_AMP := 26.0
const RIM_MAX := 215.0
const SNOW_LINE := 118.0
const RIVER_HALF_W := 10.0      # meia-largura do canal escavado (m)

# --- Ruídos ---
static func _noise(seed: int, freq: float, octaves: int, fractal_type: int) -> FastNoiseLite:
	var n := FastNoiseLite.new()
	n.seed = seed
	n.frequency = freq
	n.fractal_octaves = octaves
	n.fractal_type = fractal_type
	return n

# Traça UM rio: da nascente ao lago, meandro por ruído, leito monotônico.
# Retorna { points: Array[Vector2] (x,z em metros), bed: PackedFloat32Array (m) }
static func _trace_river(spring: Vector2, lake: Vector2, bed_start: float, bed_end: float, seed: int) -> Dictionary:
	var meander := _noise(seed, 0.002, 3, FastNoiseLite.FRACTAL_FBM)
	var pts: Array[Vector2] = []
	var steps := 48
	for i in range(steps + 1):
		var t := float(i) / steps
		var p: Vector2 = spring.lerp(lake, t)
		var dir: Vector2 = (lake - spring).normalized()
		var perp := Vector2(-dir.y, dir.x)
		var w := sin(t * PI)
		p += perp * meander.get_noise_2dv(p) * 160.0 * w
		pts.append(p)
	var bed := PackedFloat32Array()
	bed.resize(steps + 1)
	var mn := bed_start
	for i in range(steps + 1):
		var t := float(i) / steps
		var target := lerpf(bed_start, bed_end, pow(t, 0.8))
		mn = minf(mn, target)
		bed[i] = mn
	return { "points": pts, "bed": bed }

static func generate(world_seed: int) -> Dictionary:
	var valley := _noise(world_seed, 0.004, 5, FastNoiseLite.FRACTAL_FBM)
	var rim := _noise(world_seed + 7, 0.003, 4, FastNoiseLite.FRACTAL_RIDGED)

	var lake_c := Vector2(SIZE_M * 0.62, SIZE_M * 0.55)
	var lake_y := 6.0

	var rivers := [
		_trace_river(Vector2(SIZE_M * 0.30, SIZE_M * 0.06), lake_c, 60.0, lake_y, world_seed + 101),
		_trace_river(Vector2(SIZE_M * 0.05, SIZE_M * 0.35), lake_c, 80.0, lake_y, world_seed + 202),
	]

	var step := SIZE_M / (GRID - 1)
	var heights := PackedFloat32Array()
	heights.resize(GRID * GRID)
	var cx := SIZE_M * 0.5
	# 1) base: vale fBm + anel ridged (ruído puro)
	for gz in range(GRID):
		var wz := gz * step
		for gx in range(GRID):
			var wx := gx * step
			var h := (valley.get_noise_2d(wx, wz) * 0.5 + 0.5) * VALLEY_AMP
			var d := Vector2(wx, wz).distance_to(Vector2(cx, cx)) / cx
			var north_bias := lerpf(1.0, 1.45, clampf((cx - wz) / cx, 0.0, 1.0))
			var mask := smoothstep(0.55, 0.95, d) * north_bias
			h += rim.get_noise_2d(wx, wz) * RIM_MAX * mask
			heights[gz * GRID + gx] = h
	# 2) rios: escava o canal diretamente na grade (vizinhança de cada ponto)
	var r_cells := int(RIVER_HALF_W / step) + 1
	for r in rivers:
		var pts: Array = r["points"]
		var bed: PackedFloat32Array = r["bed"]
		for i in range(pts.size()):
			var p: Vector2 = pts[i]
			var pgx := int(p.x / step)
			var pgz := int(p.y / step)
			for dz in range(-r_cells, r_cells + 1):
				for dx in range(-r_cells, r_cells + 1):
					var gx := pgx + dx
					var gz := pgz + dz
					if gx < 0 or gz < 0 or gx >= GRID or gz >= GRID:
						continue
					var dd := Vector2(gx * step, gz * step).distance_to(p)
					if dd < RIVER_HALF_W:
						var prof := 1.0 - dd / RIVER_HALF_W
						var idx := gz * GRID + gx
						# canal em V: FUNDO no centro (bed), subindo ~4.5m até
						# as margens — a água (bed+0.35) fica acima do fundo
						heights[idx] = minf(heights[idx], bed[i] + (1.0 - prof) * (1.0 - prof) * 4.5)
	# 3) lago: cuba plana
	var lake_cells := int(70.0 / step) + 1
	var lgx := int(lake_c.x / step)
	var lgz := int(lake_c.y / step)
	for dz in range(-lake_cells, lake_cells + 1):
		for dx in range(-lake_cells, lake_cells + 1):
			var gx := lgx + dx
			var gz := lgz + dz
			if gx < 0 or gz < 0 or gx >= GRID or gz >= GRID:
				continue
			var dl := Vector2(gx * step, gz * step).distance_to(lake_c)
			if dl < 70.0:
				var idx := gz * GRID + gx
				heights[idx] = minf(heights[idx], lake_y - 2.0 + smoothstep(50.0, 64.0, dl) * 4.0)
	return {
		"heights": heights,
		"grid": GRID,
		"size_m": SIZE_M,
		"lake_center": lake_c,
		"lake_y": lake_y,
		"rivers": rivers,
		"snow_line": SNOW_LINE,
	}

# Hash FNV-1a da grade (prova de determinismo em teste).
static func hash_heights(heights: PackedFloat32Array) -> int:
	var h := 2166136261
	for v in heights:
		var b := var_to_bytes(v)
		for byte in b:
			h = (h ^ byte) * 16777619 & 0x7fffffff
	return h

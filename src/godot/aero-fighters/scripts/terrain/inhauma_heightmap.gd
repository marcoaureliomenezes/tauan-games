class_name InhaumaHeightmap
extends RefCounted
## InhaumaHeightmap — sampler do DEM real (port de maps/heightmap-sampler.js +
## inhauma-scene.js#inhaumaBaseHeight do web-game).
##
## Cadeia de altura (mesma ordem do web):
##   DEM bilinear → micro-ruído ±3 m → cristas ridged (rampa 480→1100 m) →
##   morro da bateria AA (cosseno elíptico) → piso 0 → shelf nivelado de
##   Cachoeira → clareira do aeroporto.
## TODO(v0.2): entalhe do rio, leito de estradas, tabuleiros de ponte,
## continuação procedural além da borda do DEM (web: ridged-FBM ancorado).

const META_PATH := "res://assets/heightmap/heightmap.json"
const U16_PATH := "res://assets/heightmap/heightmap.u16"

# Cristas ríspidas (inhauma-scene.js:156-167)
const CREST_RAMP_START_M := 480.0
const CREST_RAMP_PEAK_M := 1100.0
const CREST_MAX_AMP_M := 65.0
const CREST_DETAIL2_AMP_M := 15.0
# Corredor de visada bateria→cidade (Wave G; Wave M5 alargou: "na frente da
# bateria existe um barranco... devo ter 100% do campo de visão do terreno
# abaixo"): corte pleno até ±20°, feather a ±38°
const SIGHTLINE_HALF_IN := 0.3491 # rad (20°)
const SIGHTLINE_HALF_OUT := 0.6632 # rad (38°)
# Shelf de Cachoeira (PORT-GODOT §D.4: nivelado em 71 m, feather 45 m)
const CACHOEIRA_SHELF_H := 71.0
const CACHOEIRA_FEATHER_M := 45.0
# Clareira do aeroporto (landing-zones.js: inner 55 / outer 140, elevation 0)
const AIRPORT_ELEVATION := 0.0
const AIRPORT_CLEAR_INNER := 55.0
const AIRPORT_CLEAR_OUTER := 140.0
# Bounds do aeroporto (união runway+taxiway+serviceZone de airport.js)
const AIRPORT_BOUNDS := Rect2(-598, 10, 76, 620)

var _w := 0
var _h := 0
var _data: PackedByteArray
var _min_h := 0.0
var _max_h := 0.0
var _px_size := 11.0
var _origin := Vector2.ZERO

var _detail := FastNoiseLite.new()
var _crest := FastNoiseLite.new()
var _crest2 := FastNoiseLite.new()
var _river: InhaumaRiver
var _roads: InhaumaRoads

# Grade rápida de altura (perf Wave E1): consumidores POR FRAME (caças, balas,
# mísseis, wingmen) interpolam esta grade bilinear em vez da cadeia completa
# DEM+ruído+cristas+rio+estradas. Construída 1× (com estradas na cadeia).
const FAST_GRID_N := 257 # 256×256 células (passo 25 m)
const FAST_GRID_BOUNDS := Rect2(-3500, -2900, 6400, 6400)
var _fast_grid := PackedFloat32Array()


## Bounds do DEM em coords de mundo (como demBounds() do web).
func dem_bounds() -> Rect2:
	var min_x := (0.0 - _origin.x) * _px_size
	var min_z := (0.0 - _origin.y) * _px_size
	return Rect2(min_x, min_z, (_w - 1) * _px_size, (_h - 1) * _px_size)


## Rio traçado da drenagem do DEM (lazy — custo único de boot).
func river() -> InhaumaRiver:
	if _river == null:
		_river = InhaumaRiver.new(self)
	return _river


## Estradas (lazy — o construtor amostra height_at ANTES de _roads existir,
## então o perfil sai da altura natural sem leito, como no web).
func roads() -> InhaumaRoads:
	if _roads == null:
		_roads = InhaumaRoads.new(self)
	return _roads


func _init() -> void:
	var meta: Dictionary = JSON.parse_string(
		FileAccess.get_file_as_string(META_PATH))
	_w = meta.dims.width
	_h = meta.dims.height
	_min_h = meta.heightRange.min
	_max_h = meta.heightRange.max
	_px_size = meta.gamePxSize
	_origin = Vector2(meta.originPixel.px, meta.originPixel.py)
	_data = FileAccess.get_file_as_bytes(U16_PATH)
	assert(_data.size() == _w * _h * 2, "heightmap.u16 com tamanho inesperado")
	# Ruído determinístico (sementes fixas — mesma superfície a cada boot)
	_detail.seed = 101
	_detail.frequency = 0.045
	_detail.fractal_octaves = 3
	_crest.seed = 202
	_crest.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	_crest.frequency = 1.0 / 200.0
	_crest.fractal_type = FastNoiseLite.FRACTAL_RIDGED
	_crest.fractal_octaves = 4
	_crest2.seed = 303
	_crest2.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	_crest2.frequency = 1.0 / 90.0
	_crest2.fractal_type = FastNoiseLite.FRACTAL_RIDGED
	_crest2.fractal_octaves = 3


static func _smoothstep(t: float) -> float:
	return t * t * (3.0 - 2.0 * t)


func _dequant(q: int) -> float:
	return _min_h + (float(q) / 65535.0) * (_max_h - _min_h)


func _pixel_height(px: int, py: int) -> float:
	px = clampi(px, 0, _w - 1)
	py = clampi(py, 0, _h - 1)
	return _dequant(_data.decode_u16((py * _w + px) * 2))


## Altura crua do DEM (m) em coords de mundo — bilinear, borda clampada.
func sample_dem(x: float, z: float) -> float:
	var fx: float = _origin.x + x / _px_size
	var fy: float = _origin.y + z / _px_size
	var x0 := clampi(int(floor(fx)), 0, _w - 2)
	var y0 := clampi(int(floor(fy)), 0, _h - 2)
	var tx: float = clampf(fx - x0, 0.0, 1.0)
	var ty: float = clampf(fy - y0, 0.0, 1.0)
	var h00 := _pixel_height(x0, y0)
	var h10 := _pixel_height(x0 + 1, y0)
	var h01 := _pixel_height(x0, y0 + 1)
	var h11 := _pixel_height(x0 + 1, y0 + 1)
	var h0: float = h00 + (h10 - h00) * tx
	var h1: float = h01 + (h11 - h01) * tx
	return h0 + (h1 - h0) * ty


## Altura final da superfície (m) — a "verdade de superfície única" do jogo.
## Colisão, malha visual e assentamento de objetos TODOS amostram esta função.
func height_at(x: float, z: float) -> float:
	var dem := sample_dem(x, z)
	# Micro-relevo ±3 m (inhaumaDetailNoise)
	var h: float = dem + _detail.get_noise_2d(x + 8000.0, z - 5000.0) * 3.0
	# Cristas ríspidas acima da linha de rocha — só somam, rampa pela cota crua
	var t := clampf((dem - CREST_RAMP_START_M) / (CREST_RAMP_PEAK_M - CREST_RAMP_START_M), 0.0, 1.0)
	if t > 0.0:
		var ramp := _smoothstep(t)
		var ridge: float = (_crest.get_noise_2d(x + 44000.0, z - 38000.0) + 1.0) * 0.5
		var ridge2: float = (_crest2.get_noise_2d(x - 91000.0, z + 27000.0) + 1.0) * 0.5
		h += ramp * (ridge * CREST_MAX_AMP_M + ridge2 * CREST_DETAIL2_AMP_M)
	# Morro da bateria AA (T-D-01) — com CORREDOR DE VISADA (Wave G/M5): a saia
	# frontal do morro é cortada num cone ±20° (feather ±38°) rumo à cidade
	h += _hill_contribution(x, z) * (1.0 - _sightline_cut(x, z))
	# Entalhe do rio (derivado da drenagem do DEM)
	h = river().carve_at(x, z, h)
	# Piso em 0 (leito de rio/lago; a lâmina d'água cobre)
	h = maxf(h, 0.0)
	# Shelf nivelado de Cachoeira da Prata
	h = _cachoeira_shelf_level(x, z, h)
	# Clareira do aeroporto
	h = _airport_clearing(x, z, h)
	# Leito de estrada (último, como inhaumaContinuousHeight do web)
	if _roads != null:
		h = _roads.road_bed_at(x, z, h)
		# Tabuleiro de ponte segura a cota sobre o rio (bridgeDeckHeightAt)
		var dh := _roads.deck_at(x, z)
		if dh > 0.0:
			h = maxf(h, dh)
	return h


## Morro da bateria AA 2.5× (inhauma-scene.js#hillContribution, PORT-GODOT §D.1):
## perfil cosseno elíptico em HILL_POS — zero fora da elipse unitária.
func _hill_contribution(x: float, z: float) -> float:
	var t := Vector2((x - GameConfig.HILL_POS.x) / GameConfig.HILL_RADIUS_X_M,
		(z - GameConfig.HILL_POS.y) / GameConfig.HILL_RADIUS_Z_M).length()
	if t >= 1.0:
		return 0.0
	return GameConfig.HILL_PEAK_M * (1.0 + cos(PI * t)) / 2.0


## Corte do corredor de visada bateria→cidade (Wave G alargado na Wave M5 —
## "a faixa de chão à frente tapa a cidade / o barranco em frente à bateria"):
## 1,0 no eixo (±20°), feather até 0 em ±38° — a saia frontal do morro deixa
## de ocluir o shelf, o terreno abaixo e o campo de batalha.
func _sightline_cut(x: float, z: float) -> float:
	var dx := x - GameConfig.HILL_POS.x
	var dz := z - GameConfig.HILL_POS.y
	if Vector2(dx, dz).length() < 1.0:
		return 0.0
	var front := atan2(GameConfig.AA_LOOK_AT.y - GameConfig.HILL_POS.y,
		GameConfig.AA_LOOK_AT.x - GameConfig.HILL_POS.x)
	var ang := absf(wrapf(atan2(dz, dx) - front, -PI, PI))
	if ang >= SIGHTLINE_HALF_OUT:
		return 0.0
	var t := clampf((ang - SIGHTLINE_HALF_IN) / (SIGHTLINE_HALF_OUT - SIGHTLINE_HALF_IN), 0.0, 1.0)
	return 1.0 - _smoothstep(t)


func _cachoeira_shelf_level(x: float, z: float, h: float) -> float:
	var s := GameConfig.CACHOEIRA_SHELF
	var dx: float = maxf(s.position.x - x, maxf(0.0, x - s.end.x))
	var dz: float = maxf(s.position.y - z, maxf(0.0, z - s.end.y))
	var d := Vector2(dx, dz).length()
	if d >= CACHOEIRA_FEATHER_M:
		return h
	return h + (CACHOEIRA_SHELF_H - h) * _smoothstep(1.0 - d / CACHOEIRA_FEATHER_M)


func _airport_clearing(x: float, z: float, h: float) -> float:
	var b := AIRPORT_BOUNDS
	var dx: float = maxf(b.position.x - x, maxf(0.0, x - b.end.x))
	var dz: float = maxf(b.position.y - z, maxf(0.0, z - b.end.y))
	var d := Vector2(dx, dz).length()
	if d >= AIRPORT_CLEAR_OUTER:
		return h
	var f := 1.0
	if d > AIRPORT_CLEAR_INNER:
		f = 1.0 - _smoothstep((d - AIRPORT_CLEAR_INNER) / (AIRPORT_CLEAR_OUTER - AIRPORT_CLEAR_INNER))
	return h * (1.0 - f) + AIRPORT_ELEVATION * f


## Inclinação local (|gradiente|, adimensional) — diferença central.
func slope_at(x: float, z: float) -> float:
	var step := _px_size
	var dhdx: float = (height_at(x + step, z) - height_at(x - step, z)) / (2.0 * step)
	var dhdz: float = (height_at(x, z + step) - height_at(x, z - step)) / (2.0 * step)
	return Vector2(dhdx, dhdz).length()


## Altura aproximada por grade bilinear pré-computada (erro típico < 0,5 m).
## Para consumidores POR FRAME; colocação visual exata continua em height_at.
func height_fast(x: float, z: float) -> float:
	if _fast_grid.is_empty():
		_build_fast_grid()
	var fx: float = (x - FAST_GRID_BOUNDS.position.x) / FAST_GRID_BOUNDS.size.x * (FAST_GRID_N - 1)
	var fz: float = (z - FAST_GRID_BOUNDS.position.y) / FAST_GRID_BOUNDS.size.y * (FAST_GRID_N - 1)
	var x0 := clampi(int(floor(fx)), 0, FAST_GRID_N - 2)
	var z0 := clampi(int(floor(fz)), 0, FAST_GRID_N - 2)
	var tx := clampf(fx - x0, 0.0, 1.0)
	var tz := clampf(fz - z0, 0.0, 1.0)
	var h00 := _fast_grid[z0 * FAST_GRID_N + x0]
	var h10 := _fast_grid[z0 * FAST_GRID_N + x0 + 1]
	var h01 := _fast_grid[(z0 + 1) * FAST_GRID_N + x0]
	var h11 := _fast_grid[(z0 + 1) * FAST_GRID_N + x0 + 1]
	var h0: float = h00 + (h10 - h00) * tx
	var h1: float = h01 + (h11 - h01) * tx
	return h0 + (h1 - h0) * tz


## Inclinação pela grade rápida (4 leituras de array — sem cadeia de altura).
func slope_fast(x: float, z: float) -> float:
	var step := 25.0
	var dhdx: float = (height_fast(x + step, z) - height_fast(x - step, z)) / (2.0 * step)
	var dhdz: float = (height_fast(x, z + step) - height_fast(x, z - step)) / (2.0 * step)
	return Vector2(dhdx, dhdz).length()


## Amostra a cadeia completa 1× por célula (chamar DEPOIS de roads() existir,
## para o leito de estrada entrar na grade).
func _build_fast_grid() -> void:
	_fast_grid.resize(FAST_GRID_N * FAST_GRID_N)
	for iz in FAST_GRID_N:
		for ix in FAST_GRID_N:
			_fast_grid[iz * FAST_GRID_N + ix] = height_at(
				FAST_GRID_BOUNDS.position.x + float(ix) / (FAST_GRID_N - 1) * FAST_GRID_BOUNDS.size.x,
				FAST_GRID_BOUNDS.position.y + float(iz) / (FAST_GRID_N - 1) * FAST_GRID_BOUNDS.size.y)

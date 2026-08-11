class_name InhaumaMap
extends Node3D
## InhaumaMap — cena-mãe do mapa Inhaúma/Cachoeira da Prata.
## Compõe: terreno (DEM) + props urbanos + céu/fog/ciclo de dia.
## Os modos de jogo (flight/defense) instanciam esta cena e amostram
## `heightmap.height_at(x, z)` como verdade de superfície única.

var heightmap: InhaumaHeightmap
var terrain: InhaumaTerrain
var props: InhaumaProps

# Ciclo dia/noite (~5 min — DAY_CYCLE_SPEED do web)
var _day_phase := 0.35 # começa de dia
@onready var _sun: DirectionalLight3D = $Sun
@onready var _env: WorldEnvironment = $WorldEnvironment


func _ready() -> void:
	heightmap = InhaumaHeightmap.new()
	heightmap.roads() # traça rio+estradas ANTES do terreno (leito entra na cadeia)
	heightmap.height_fast(0.0, 0.0) # pré-constrói a grade rápida COM estradas
	terrain = InhaumaTerrain.new(heightmap)
	add_child(terrain)
	props = InhaumaProps.new(heightmap)
	add_child(props)
	add_child(InhaumaForest.new(heightmap))
	add_child(InhaumaBackdrop.new())
	add_child(InhaumaTraffic.new(heightmap.roads(), heightmap.height_at))
	_setup_environment()


func _process(delta: float) -> void:
	_day_phase = fposmod(_day_phase + delta * GameConfig.DAY_CYCLE_SPEED, 1.0)
	# Sol: fase 0,25 = nascente, 0,5 = zênite, 0,75 = poente. Rotação quantizada
	# (~0,3°) — cada grau novo invalida a sky (Wave I); a luz é contínua
	var sun_angle := (_day_phase - 0.25) * TAU
	var q_angle := roundf(sun_angle / 0.005) * 0.005
	if q_angle != _sun_angle_q:
		_sun_angle_q = q_angle
		_sun.rotation.x = -q_angle
	var daylight := clampf(sin(sun_angle), 0.0, 1.0)
	# Noite com piso de visibilidade (web: lua 0x8899cc + janelas acesas)
	_sun.light_energy = lerpf(0.18, 1.2, daylight)
	_sun.light_color = Color(0.53, 0.60, 0.80).lerp(Color(1.0, 0.98, 0.87), daylight)
	# Environment só quando o degrau de 2% muda (Wave I: escrever no env todo
	# frame invalidava a sky — ver _setup_environment)
	var dl := roundf(daylight * 50.0) / 50.0
	if dl != _env_daylight and _env.environment:
		_env_daylight = dl
		_env.environment.background_energy_multiplier = lerpf(0.25, 1.0, dl)
		_env.environment.ambient_light_energy = lerpf(0.35, 0.75, dl)
	if props:
		props.set_daylight(daylight)


var _env_daylight := -1.0
var _sun_angle_q := INF


func _setup_environment() -> void:
	var env := Environment.new()
	var sky := Sky.new()
	var sky_mat := ProceduralSkyMaterial.new()
	# Céu do web: horizonte azul-claro 0x90c8f0, zênite mais profundo
	sky_mat.sky_top_color = Color(0.30, 0.56, 0.88)
	sky_mat.sky_horizon_color = Color(0.565, 0.784, 0.941) # 0x90c8f0
	sky_mat.sky_curve = 0.09
	sky_mat.ground_horizon_color = Color(0.565, 0.784, 0.941)
	sky_mat.ground_bottom_color = Color(0.35, 0.42, 0.38)
	sky_mat.ground_curve = 0.06
	sky_mat.sun_angle_max = 30.0
	sky_mat.sun_curve = 0.05
	sky.sky_material = sky_mat
	# Radiance map MINÚSCULO (Wave I): "Setup Sky" custava 40-70 ms por frame
	# porque o sol animado re-assava o cubemap 256 todo frame. O fundo (gradiente
	# + sol) renderiza do material em full-res independentemente — o cubemap só
	# alimenta ambiente/reflexos, e o ambiente agora é cor fixa.
	sky.radiance_size = Sky.RADIANCE_SIZE_32
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	# Ambiente por COR fixa (não AMBIENT_SOURCE_SKY): o radiance map da sky
	# procedural era RE-ASSADO a cada frame ("Setup Sky" 40-70 ms no gpu-profile!)
	# porque o ciclo dia/noite sujava o Environment por frame. A sky continua de
	# fundo (Render Sky ~0,3 ms); o ambiente vira cor modulada pelo ciclo.
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.55, 0.65, 0.80)
	env.ambient_light_energy = 0.75
	# Sol quente do web (0xfffaaa; laranja 0xff9038 no baixo)
	_sun.light_color = Color(1.0, 0.98, 0.87)
	# Fog de distância em profundidade linear (web: Fog 900/2600 m no voo,
	# 1100/3400 na defesa — cor 0xb6d0c4), sutil, sem tingir o céu
	env.fog_enabled = true
	env.fog_mode = Environment.FOG_MODE_DEPTH
	env.fog_depth_begin = GameConfig.FOG_NEAR
	env.fog_depth_end = GameConfig.FOG_FAR
	env.fog_light_color = GameConfig.FOG_COLOR
	env.fog_sky_affect = 0.25
	env.fog_sun_scatter = 0.3
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.05
	# SSAO/SSIL DESLIGADOS (perf Wave B): custo brutal em iGPU (Iris Xe) —
	# 1 FPS a 1080p com os dois ativos. Ambient do céu já dá o volume da cena.
	$WorldEnvironment.environment = env


## Cota da lâmina d'água do rio em (x,z) (-1 se fora do canal).
func water_level_at(x: float, z: float) -> float:
	return heightmap.river().water_level_at(x, z)


## Verdade de superfície única para gameplay (voo, alvos, artilharia).
func surface_height(x: float, z: float) -> float:
	return heightmap.height_at(x, z)


## Superfície aproximada (grade bilinear) para consumidores POR FRAME —
## caças, ordenança, balas, mísseis (perf Wave E1; erro típico < 0,5 m).
func surface_fast(x: float, z: float) -> float:
	return heightmap.height_fast(x, z)

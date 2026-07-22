# sky.gd — céu dia/noite 600 s (SPEC §M-05): sol móvel com sombras, névoa
# por horário, pôr-do-sol quente, noite azulada.
class_name BangSky
extends Node3D

const DAY_LENGTH := 600.0

var t := 0.32          # começa meio da manhã
var sun: DirectionalLight3D
var env: WorldEnvironment

func _ready() -> void:
	env = WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var psm := ProceduralSkyMaterial.new()
	# faroeste árido: zênite azul-forte, horizonte quente empoeirado
	psm.sky_top_color = Color(0.22, 0.44, 0.78)
	psm.sky_horizon_color = Color(0.83, 0.80, 0.68)
	psm.ground_bottom_color = Color(0.55, 0.45, 0.3)
	psm.ground_horizon_color = Color(0.83, 0.80, 0.68)
	psm.sun_angle_max = 12.0
	sky.sky_material = psm
	e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	e.fog_enabled = true
	e.fog_density = 0.0011     # ar mais seco: menos névoa
	e.fog_sky_affect = 0.5
	env.environment = e
	add_child(env)

	sun = DirectionalLight3D.new()
	sun.name = "Sun"
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	sun.directional_shadow_max_distance = 220.0
	add_child(sun)
	_build_clouds()
	_apply()

# nuvens: clusters de esferas achatadas brancas, deriva lenta (estilo do jogo)
func _build_clouds() -> void:
	var clouds := Node3D.new()
	clouds.name = "Clouds"
	add_child(clouds)
	var rng := RandomNumberGenerator.new()
	rng.seed = 77
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.98, 0.97, 0.94)
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	for i in range(14):
		var cl := Node3D.new()
		cl.position = Vector3(rng.randf_range(-900, 900), rng.randf_range(190, 280), rng.randf_range(-900, 900))
		var blobs := rng.randi_range(3, 5)
		for j in range(blobs):
			var s := MeshInstance3D.new()
			var sm := SphereMesh.new()
			sm.radial_segments = 12
			sm.rings = 6
			s.mesh = sm
			s.material_override = mat
			s.scale = Vector3(rng.randf_range(18, 42), rng.randf_range(5, 9), rng.randf_range(14, 30))
			s.position = Vector3(rng.randf_range(-30, 30), rng.randf_range(-3, 3), rng.randf_range(-14, 14))
			cl.add_child(s)
		clouds.add_child(cl)

func _process(dt: float) -> void:
	t = fmod(t + dt / DAY_LENGTH, 1.0)
	_apply()
	# deriva das nuvens (vento oeste→leste, lento)
	var clouds := get_node_or_null("Clouds")
	if clouds:
		for cl in clouds.get_children():
			cl.position.x += dt * 2.2
			if cl.position.x > 950.0:
				cl.position.x = -950.0

func _apply() -> void:
	# ângulo solar: 0.25 = nascer (leste), 0.5 = zênite, 0.75 = pôr (oeste)
	var ang := (t - 0.25) * TAU
	var elev := sin(ang)                       # -1..1
	var azim := cos(ang)
	sun.rotation = Vector3(-acos(clampf(elev, -1.0, 1.0)) * 0.9, atan2(azim, 0.35), 0)
	var day := clampf(elev * 2.2 + 0.15, 0.0, 1.0)
	var sunset := clampf(1.0 - absf(elev) * 3.2, 0.0, 1.0) * stepify(elev > -0.15)
	sun.light_energy = 1.45 * day + 0.02
	sun.light_color = Color(1.0, 0.96, 0.88).lerp(Color(1.0, 0.55, 0.3), sunset).lerp(Color(0.25, 0.35, 0.6), 1.0 - clampf(day + sunset, 0.0, 1.0))
	var e := env.environment
	e.fog_light_color = Color(0.62, 0.72, 0.82).lerp(Color(0.9, 0.55, 0.4), sunset).lerp(Color(0.03, 0.05, 0.1), 1.0 - day)
	e.ambient_light_energy = 0.25 + 0.55 * day

func stepify(c: bool) -> float:
	return 1.0 if c else 0.0

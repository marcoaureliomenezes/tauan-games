## sky_controller.gd — Day/night cycle controller.
## Full cycle every ~5 minutes of game time (DAY_CYCLE_SPEED = 0.003).
## Controls DirectionalLight3D direction + WorldEnvironment sky colors.
extends Node3D

const DAY_CYCLE_SPEED: float = 0.003
const CYCLE_DURATION: float = 1.0 / DAY_CYCLE_SPEED  # ~333s = ~5.5 min

@onready var sun: DirectionalLight3D = $Sun
@onready var env: WorldEnvironment = $WorldEnv

var _day_phase: float = 0.2  # 0..1 — start near sunrise

# Color keyframes: [dawn, day, dusk, night]
const SKY_TOP_COLORS: Array = [
	Color(0.55, 0.27, 0.10),  # dawn
	Color(0.34, 0.58, 0.93),  # day
	Color(0.55, 0.20, 0.05),  # dusk
	Color(0.02, 0.02, 0.08),  # night
]
const SKY_HORIZON_COLORS: Array = [
	Color(0.95, 0.55, 0.20),  # dawn
	Color(0.67, 0.84, 1.00),  # day
	Color(0.95, 0.35, 0.08),  # dusk
	Color(0.04, 0.06, 0.14),  # night
]
const SUN_ENERGIES: Array = [0.8, 1.6, 0.7, 0.0]
const AMBIENT_ENERGIES: Array = [0.4, 0.6, 0.3, 0.1]

func _ready() -> void:
	if not sun:
		sun = DirectionalLight3D.new()
		sun.name = "Sun"
		add_child(sun)
	if not env:
		env = WorldEnvironment.new()
		env.name = "WorldEnv"
		var environment = Environment.new()
		var sky = Sky.new()
		environment.sky = sky
		environment.background_mode = Environment.BG_SKY
		env.environment = environment
		add_child(env)
	_apply_phase(_day_phase)

func _process(delta: float) -> void:
	_day_phase = fmod(_day_phase + delta * DAY_CYCLE_SPEED, 1.0)
	_apply_phase(_day_phase)

func _apply_phase(phase: float) -> void:
	# Map phase 0..1 to 4 segments
	var seg: int = int(phase * 4.0) % 4
	var seg_t: float = fmod(phase * 4.0, 1.0)
	var next_seg: int = (seg + 1) % 4

	var sky_top: Color = SKY_TOP_COLORS[seg].lerp(SKY_TOP_COLORS[next_seg], seg_t)
	var sky_horizon: Color = SKY_HORIZON_COLORS[seg].lerp(SKY_HORIZON_COLORS[next_seg], seg_t)
	var sun_energy: float = lerp(SUN_ENERGIES[seg], SUN_ENERGIES[next_seg], seg_t)
	var ambient: float = lerp(AMBIENT_ENERGIES[seg], AMBIENT_ENERGIES[next_seg], seg_t)

	# Sun position — orbit around Y axis
	var sun_angle: float = phase * TAU - PI * 0.5
	if sun:
		sun.rotation_degrees = Vector3(-45.0 - sin(sun_angle) * 45.0, rad_to_deg(sun_angle), 0.0)
		sun.light_energy = sun_energy
		sun.light_color = sky_horizon.lerp(Color.WHITE, 0.5)

	if env and env.environment:
		env.environment.ambient_light_energy = ambient
		env.environment.ambient_light_color = sky_top
		# Fog
		env.environment.fog_enabled = true
		env.environment.fog_density = 0.0015
		env.environment.fog_light_color = sky_horizon

extends Resource
class_name GameConfigResource
# GameConfigResource — custom Resource class for world origin, spawn, and flight constants.
# Implements FR-V2-G-04 flight constants ported from v1 aero-fighters/src/config.js PLAYER block.
# Instantiated as Content/Data/GameConfig.tres.

# --- World Origin (WGS84 center of the 20 km Inhauma terrain) ---
@export var origin_latitude: float = -19.47
@export var origin_longitude: float = -44.46
@export var origin_height_m: float = 800.0

# --- Player spawn position (WGS84, airborne per AC-V2-G-03) ---
@export var spawn_latitude: float = -19.47
@export var spawn_longitude: float = -44.46
@export var spawn_height_m: float = 2095.0

# --- Inhauma bounding box half-extent (degrees) ---
@export var bbox_half_deg: float = 0.20

# --- FR-V2-G-04 arcade flight constants (ported from v1 config.js PLAYER block) ---
@export var max_speed: float = 80.0        # m/s — MAX_SPD
@export var min_speed: float = 8.0         # m/s — MIN_SPD
@export var stall_speed: float = 10.0      # m/s — STALL_THRESHOLD
@export var gravity: float = 14.0          # m/s^2 — GRAVITY (arcade, not 9.81)
@export var pitch_rate: float = 1.45       # rad/s — PITCH_RATE
@export var roll_rate: float = 2.30        # rad/s — ROLL_RATE
@export var yaw_rate: float = 0.80         # rad/s — YAW_RATE
@export var throttle_up_rate: float = 15.0 # m/s^2 — acceleration per full throttle
@export var throttle_down_rate: float = 8.0 # m/s^2 — deceleration per zero throttle
@export var mountain_buffer: float = 5.0  # m — MOUNTAIN_BUFFER (crash detection AGL floor)

## config.gd — All game constants. Edit here to tune feel.
## Mirrors Three.js config.js constants exactly.
extends Node

# --- Player flight physics ---
const PITCH_RATE: float = 1.45      # rad/s
const ROLL_RATE: float = 2.30       # rad/s
const YAW_RATE: float = 0.80        # rad/s
const RUDDER_FACTOR: float = 0.65   # multiplier for pure yaw (Q/E)
const GRAVITY: float = 14.0         # m/s²
const STALL_SPD: float = 10.0       # m/s — HUD flashes STALL below this
const MAX_SPD: float = 80.0         # m/s
const MIN_SPD: float = 8.0          # m/s
const THROTTLE_UP_RATE: float = 1.3
const THROTTLE_DN_RATE: float = 0.9
const CONVERGE_RATE: float = 1.6
const START_HEIGHT: float = 80.0
const SEA_CRASH_Y: float = 3.0
const MOUNTAIN_BUFFER: float = 2.5

# --- Cannon ---
const CANNON_RATE: float = 0.08     # seconds between shots (12.5/s)
const BULLET_SPD: float = 110.0     # m/s
const BULLET_LIFE: float = 2.0      # seconds
const WING_OFFSET: float = 0.91
const MUZZLE_OFFSET: float = 3.08

# --- Missiles Light (X key) ---
const MISSILE_LIGHT_MAX: int = 100
const MISSILE_LIGHT_INIT_SPD: float = 80.0
const MISSILE_LIGHT_TRACK_SPD: float = 130.0
const MISSILE_LIGHT_TURN_RATE: float = 0.30
const MISSILE_LIGHT_CLOSE_TURN: float = 0.55
const MISSILE_LIGHT_LIFE: float = 6.0
const MISSILE_LIGHT_DAMAGE: int = 4
const MISSILE_LIGHT_RANGE: float = 1200.0

# --- Missiles Heavy (B key — mapped as alternate fire) ---
const MISSILE_HEAVY_MAX: int = 10
const MISSILE_HEAVY_INIT_SPD: float = 65.0
const MISSILE_HEAVY_TRACK_SPD: float = 100.0
const MISSILE_HEAVY_TURN_RATE: float = 0.22
const MISSILE_HEAVY_CLOSE_TURN: float = 0.45
const MISSILE_HEAVY_LIFE: float = 8.0
const MISSILE_HEAVY_DAMAGE: int = 20
const MISSILE_HEAVY_RANGE: float = 1500.0

# --- Nuclear Missile (N key) ---
const MISSILE_NUC_MAX: int = 3
const MISSILE_NUC_INIT_SPD: float = 60.0
const MISSILE_NUC_TRACK_SPD: float = 85.0
const MISSILE_NUC_TURN_RATE: float = 0.18
const MISSILE_NUC_CLOSE_TURN: float = 0.38
const MISSILE_NUC_LIFE: float = 12.0
const MISSILE_NUC_DAMAGE: int = 4000
const MISSILE_NUC_BLAST_RADIUS: float = 180.0
const MISSILE_NUC_PLAYER_KILL_RADIUS: float = 80.0
const MISSILE_NUC_PLAYER_DAMAGE_RADIUS: float = 200.0

# --- Barrel Roll ---
const ROLL_DUR: float = 0.5
const ROLL_COOLDOWN: float = 1.5

# --- Target HP / score ---
const TARGET_BASE_HP: int = 28
const TARGET_BASE_SCORE: int = 800

const TARGET_FACTORY_HP: int = 20
const TARGET_FACTORY_SCORE: int = 600

const TARGET_BUILDING_HP: int = 14
const TARGET_BUILDING_SCORE: int = 450

const TARGET_CONVOY_HP: int = 12
const TARGET_CONVOY_SCORE: int = 380

const TARGET_AAGUN_HP: int = 6
const TARGET_AAGUN_SCORE: int = 250

const TARGET_WARSHIP_HP: int = 35
const TARGET_WARSHIP_SCORE: int = 1200

# --- AA Gun ---
const AA_RANGE: float = 220.0
const AA_BASE_INTERVAL: float = 1.7
const AA_CYCLE_SPEEDUP: float = 0.15
const AA_MAX_SPEEDUP: float = 0.7

# --- Mission ---
const WAVE_SIZES: Array = [8, 12, 16]
const MISSION_COMPLETE_DELAY: float = 2.4
const MISSION_NEXT_OVERLAY: float = 2.2

# --- World ---
const OCEAN_SIZE: float = 10000.0
const FOG_NEAR: float = 300.0
const FOG_FAR: float = 700.0
const CLOUD_COUNT: int = 60

# --- Day/night cycle ---
const DAY_CYCLE_SPEED: float = 0.003  # full cycle ~5 min

# --- Colors (hex as Color) ---
const COLOR_JET_GREY: Color = Color(0.176, 0.188, 0.216)
const COLOR_JET_DARK: Color = Color(0.11, 0.118, 0.137)
const COLOR_EXHAUST: Color = Color(1.0, 0.439, 0.125)
const COLOR_FLAME: Color = Color(1.0, 0.867, 0.4)
const COLOR_BULLET: Color = Color(1.0, 1.0, 1.0)
const COLOR_BULLET_ENEMY: Color = Color(1.0, 0.314, 0.314)
const COLOR_EXPLOSION: Color = Color(1.0, 0.667, 0.188)

# --- Island definitions: [center_x, center_z, radius, peak_height] ---
const ISLAND_DEFS: Array = [
	[100.0, -320.0, 70.0, 55.0],
	[-360.0, -580.0, 95.0, 78.0],
	[520.0, -480.0, 58.0, 42.0],
	[-120.0, -920.0, 115.0, 94.0],
	[620.0, -830.0, 68.0, 52.0],
	[-540.0, -420.0, 50.0, 36.0],
	[240.0, -1180.0, 105.0, 88.0],
	[-70.0, -1480.0, 62.0, 50.0],
	[820.0, -1080.0, 82.0, 66.0],
	[-700.0, -980.0, 78.0, 62.0],
	[350.0, -650.0, 55.0, 40.0],
	[-430.0, -1300.0, 90.0, 72.0],
	[-800.0, 400.0, 115.0, 95.0],
	[600.0, -1500.0, 120.0, 108.0],
	[950.0, 200.0, 65.0, 45.0],
	[-200.0, 800.0, 55.0, 38.0],
	[400.0, 650.0, 38.0, 22.0],
	[-700.0, -900.0, 42.0, 18.0],
]

# --- Target layouts: [island_idx, dx, dz, type_string] ---
# island_idx = -1 means absolute world coords (dx, dz)
const TARGET_LAYOUT_ISLANDS: Array = [
	[3, 0, 0, "base"],
	[3, 30, 15, "aaGun"],
	[3, -30, 20, "aaGun"],
	[1, 0, 0, "factory"],
	[6, 0, 0, "base"],
	[11, 0, 0, "building"],
	[2, 0, 0, "convoy"],
	[7, 0, 0, "convoy"],
	[0, 0, 0, "base"],
	[0, 22, 18, "aaGun"],
	[8, 0, 0, "factory"],
	[10, 0, 0, "building"],
	[4, 0, 0, "factory"],
	[9, 0, 0, "building"],
	[6, 30, 10, "aaGun"],
	[11, 22, 10, "aaGun"],
	[-1, -500, -700, "warship"],
	[-1, 500, -900, "warship"],
	[-1, -300, -1400, "warship"],
]

const TARGET_LAYOUT_DESERT: Array = [
	[0, 0, 0, "base"],
	[0, 30, -20, "aaGun"],
	[1, 0, 0, "factory"],
	[2, 0, 0, "factory"],
	[2, 25, 10, "aaGun"],
	[3, 0, 0, "aaGun"],
	[4, 0, 0, "base"],
	[4, 20, 20, "aaGun"],
	[-1, 200, -100, "convoy"],
	[-1, -300, 200, "convoy"],
	[5, 0, 0, "building"],
	[6, 0, 0, "aaGun"],
]

const TARGET_LAYOUT_RIO: Array = [
	[-1, 150, 300, "warship"],
	[-1, -100, 400, "warship"],
	[-1, 300, 500, "warship"],
	[1, 0, 0, "base"],
	[0, 0, 0, "aaGun"],
	[3, 0, 0, "base"],
	[5, 10, 10, "aaGun"],
	[5, -10, 15, "building"],
	[6, 0, 0, "factory"],
	[6, 20, -10, "aaGun"],
	[7, 0, 0, "building"],
	[7, -15, 10, "aaGun"],
]

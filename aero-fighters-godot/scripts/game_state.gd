## game_state.gd — Global singleton holding all mutable game state.
## Autoloaded as "GameState". All modules read/write here — no circular deps.
extends Node

# --- Game flow ---
var running: bool = false
var paused: bool = false
var active_map: String = "islands"  # "islands" | "desert" | "rio"

# --- Player state ---
var score: int = 0
var kills: int = 0
var cycle: int = 1  # current mission number

# --- Player stats ---
var player_lives: int = 3
var player_speed: float = 30.0
var player_throttle: float = 0.5
var player_stalled: bool = false
var player_missiles_light: int = 100
var player_missiles_heavy: int = 10
var player_missiles_nuclear: int = 3
var player_dead: bool = false

# --- Mission ---
var targets_destroyed: int = 0
var targets_total: int = 0

# --- Flags ---
var invincibility_time: float = 0.0
var roll_timer: float = 0.0
var roll_cooldown: float = 0.0
var roll_dir: int = 1
var crash_freeze_time: float = 0.0
var shake_time: float = 0.0
var mission_failed: bool = false
var mission_complete_shown: bool = false
var cannon_cooldown: float = 0.0
var game_time: float = 0.0  # seconds elapsed since game start

# --- Signals ---
signal score_changed(new_score: int)
signal lives_changed(new_lives: int)
signal mission_started(mission_num: int)
signal mission_complete
signal game_over_signal(reason: String)
signal target_destroyed(target_type: String, points: int)

func _ready() -> void:
	reset()

func reset() -> void:
	running = false
	paused = false
	score = 0
	kills = 0
	cycle = 1
	player_lives = 3
	player_speed = 30.0
	player_throttle = 0.5
	player_stalled = false
	player_missiles_light = 100
	player_missiles_heavy = 10
	player_missiles_nuclear = 3
	player_dead = false
	targets_destroyed = 0
	targets_total = 0
	invincibility_time = 0.0
	roll_timer = 0.0
	roll_cooldown = 0.0
	roll_dir = 1
	crash_freeze_time = 0.0
	shake_time = 0.0
	mission_failed = false
	mission_complete_shown = false
	cannon_cooldown = 0.0
	game_time = 0.0

func add_score(points: int) -> void:
	score += points
	score_changed.emit(score)

func lose_life() -> void:
	player_lives -= 1
	lives_changed.emit(player_lives)

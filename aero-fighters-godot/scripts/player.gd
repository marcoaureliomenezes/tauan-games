## player.gd — F-35 flight physics. CharacterBody3D with manual quaternion-based 6DOF.
## Physics mirrors Three.js player.js exactly: same constants, same ordering contract.
## ORDERING CONTRACT: throttle/speed/stalled updated FIRST; position updated LAST.
extends CharacterBody3D

# --- Constants (from config.gd) ---
const PITCH_RATE: float = 1.45
const ROLL_RATE: float = 2.30
const YAW_RATE: float = 0.80
const RUDDER_FACTOR: float = 0.65
const GRAVITY: float = 14.0
const STALL_SPD: float = 10.0
const MAX_SPD: float = 80.0
const MIN_SPD: float = 8.0
const THROTTLE_UP_RATE: float = 1.3
const THROTTLE_DN_RATE: float = 0.9
const CONVERGE_RATE: float = 1.6
const SEA_CRASH_Y: float = 3.0
const ROLL_DUR: float = 0.5
const ROLL_COOLDOWN: float = 1.5
const CANNON_RATE: float = 0.08
const BULLET_SPD: float = 110.0
const MUZZLE_OFFSET: float = 3.08
const WING_OFFSET: float = 0.91

# --- Signals ---
signal crashed(reason: String)
signal fired_cannon(position: Vector3, direction: Vector3, from_wing: int)
signal fired_missile(position: Vector3, direction: Vector3, missile_type: String)

# --- References (set from Main.tscn) ---
@onready var exhaust_glow: MeshInstance3D = $Fuselage/ExhaustGlow
@onready var exhaust_flame: MeshInstance3D = $Fuselage/ExhaustFlame
@onready var strobe_light: MeshInstance3D = $Fuselage/Strobe
@onready var nav_green: MeshInstance3D = $Fuselage/NavGreen
@onready var nav_red: MeshInstance3D = $Fuselage/NavRed

func _ready() -> void:
	global_position = Vector3(0.0, 80.0, 0.0)
	# Start pointed forward (-Z)
	global_rotation = Vector3.ZERO

func _physics_process(delta: float) -> void:
	if not GameState.running or GameState.paused:
		return
	if GameState.crash_freeze_time > 0.0:
		GameState.crash_freeze_time -= delta
		return

	# --- ORDERING CONTRACT PART 1: throttle / speed / stalled FIRST ---
	_update_throttle(delta)
	_update_speed(delta)

	# Cooldowns
	if GameState.invincibility_time > 0.0:
		GameState.invincibility_time -= delta
	if GameState.roll_cooldown > 0.0:
		GameState.roll_cooldown -= delta
	if GameState.cannon_cooldown > 0.0:
		GameState.cannon_cooldown -= delta
	if GameState.shake_time > 0.0:
		GameState.shake_time -= delta

	# --- Rotations (quaternion-based, local axes) ---
	_apply_rotations(delta)

	# --- Movement: forward + gravity + lift ---
	_apply_movement(delta)

	# --- Terrain collision ---
	_check_terrain()

	# --- Visual feedback ---
	_update_visuals(delta)

	# --- Weapons ---
	_handle_weapons()

func _update_throttle(delta: float) -> void:
	if Input.is_action_pressed("throttle_up"):
		GameState.player_throttle = minf(1.0, GameState.player_throttle + delta * THROTTLE_UP_RATE)
	if Input.is_action_pressed("throttle_down"):
		GameState.player_throttle = maxf(0.05, GameState.player_throttle - delta * THROTTLE_DN_RATE)

func _update_speed(delta: float) -> void:
	var target_speed: float = MIN_SPD + GameState.player_throttle * (MAX_SPD - MIN_SPD)
	GameState.player_speed += (target_speed - GameState.player_speed) * minf(1.0, delta * CONVERGE_RATE)
	GameState.player_speed = maxf(2.0, GameState.player_speed)
	GameState.player_stalled = GameState.player_speed < STALL_SPD

func _apply_rotations(delta: float) -> void:
	# Barrel roll overrides normal roll
	if GameState.roll_timer > 0.0:
		GameState.roll_timer -= delta
		var roll_amount: float = (PI * 2.0 / ROLL_DUR) * delta * float(GameState.roll_dir)
		rotate_object_local(Vector3.FORWARD, roll_amount)
		return

	# Pitch (Arrow Up = nose up = negative local X rotation; Down = nose down = positive)
	if Input.is_action_pressed("pitch_up"):
		rotate_object_local(Vector3.RIGHT, -PITCH_RATE * delta)
	if Input.is_action_pressed("pitch_down"):
		rotate_object_local(Vector3.RIGHT, PITCH_RATE * delta)

	# Roll + coordinated yaw (banking turns)
	if Input.is_action_pressed("roll_left"):
		rotate_object_local(Vector3.FORWARD, ROLL_RATE * delta)
		# Coordinated yaw in world space
		rotate(Vector3.UP, YAW_RATE * delta)
	if Input.is_action_pressed("roll_right"):
		rotate_object_local(Vector3.FORWARD, -ROLL_RATE * delta)
		rotate(Vector3.UP, -YAW_RATE * delta)

	# Rudder — pure yaw in world space
	if Input.is_action_pressed("yaw_left"):
		rotate(Vector3.UP, YAW_RATE * RUDDER_FACTOR * delta)
	if Input.is_action_pressed("yaw_right"):
		rotate(Vector3.UP, -YAW_RATE * RUDDER_FACTOR * delta)

	# Barrel roll trigger
	if Input.is_action_just_pressed("barrel_roll"):
		_start_barrel_roll()

func _start_barrel_roll() -> void:
	if GameState.roll_timer > 0.0 or GameState.roll_cooldown > 0.0:
		return
	GameState.roll_timer = ROLL_DUR
	GameState.roll_cooldown = ROLL_COOLDOWN
	GameState.roll_dir *= -1

func _apply_movement(delta: float) -> void:
	# Forward vector is -Z in local space
	var forward: Vector3 = -global_transform.basis.z.normalized()
	global_position += forward * GameState.player_speed * delta

	# Gravity always pulls down
	global_position.y -= GRAVITY * delta

	# Lift counters gravity when not stalled
	if not GameState.player_stalled:
		var lift_factor: float = minf(GameState.player_speed / (MIN_SPD * 2.5), 1.0)
		var up: Vector3 = global_transform.basis.y.normalized()
		global_position += up * GRAVITY * lift_factor * delta

func _check_terrain() -> void:
	if global_position.y < SEA_CRASH_Y:
		_do_crash("SEA")
		return

	# Check island terrain collision via MissionManager
	var terrain_y: float = MissionManager.get_terrain_height(global_position.x, global_position.z)
	if terrain_y > 0.0 and global_position.y < terrain_y + 2.5:
		_do_crash("MOUNTAIN")

func _do_crash(reason: String) -> void:
	if GameState.mission_failed:
		return
	visible = false
	GameState.crash_freeze_time = 2.5
	crashed.emit(reason)

func _update_visuals(delta: float) -> void:
	GameState.game_time += delta
	var burn: float = 0.55 + GameState.player_throttle * 1.05
	if exhaust_glow:
		exhaust_glow.scale = Vector3(burn, burn, burn)
	if exhaust_flame:
		var flicker: float = 0.9 + randf() * 0.2
		exhaust_flame.scale = Vector3(burn, burn, burn * flicker)
	if strobe_light:
		strobe_light.visible = sin(GameState.game_time * PI * 2.0 * 1.2) > 0.8
	if nav_green:
		nav_green.visible = true
	if nav_red:
		nav_red.visible = true

func _handle_weapons() -> void:
	if Input.is_action_pressed("fire_cannon") and GameState.cannon_cooldown <= 0.0:
		GameState.cannon_cooldown = CANNON_RATE
		var fwd: Vector3 = -global_transform.basis.z.normalized()
		var muzzle: Vector3 = global_position + fwd * MUZZLE_OFFSET
		# Alternate wings
		var wing_side: int = 1 if fmod(GameState.game_time * 12.5, 2.0) < 1.0 else -1
		fired_cannon.emit(muzzle, fwd, wing_side)

	if Input.is_action_just_pressed("fire_missile") and GameState.player_missiles_light > 0:
		GameState.player_missiles_light -= 1
		var fwd: Vector3 = -global_transform.basis.z.normalized()
		fired_missile.emit(global_position, fwd, "light")

	if Input.is_action_just_pressed("fire_nuclear") and GameState.player_missiles_nuclear > 0:
		GameState.player_missiles_nuclear -= 1
		var fwd: Vector3 = -global_transform.basis.z.normalized()
		fired_missile.emit(global_position, fwd, "nuclear")

func respawn() -> void:
	global_position = Vector3(0.0, 80.0, 0.0)
	global_rotation = Vector3.ZERO
	visible = true
	GameState.player_speed = 25.0
	GameState.player_throttle = 0.5
	GameState.player_stalled = false
	GameState.roll_timer = 0.0
	GameState.roll_cooldown = 0.0

func apply_hit() -> void:
	if GameState.invincibility_time > 0.0 or GameState.roll_timer > 0.0:
		return
	GameState.lose_life()
	GameState.invincibility_time = 1.8
	GameState.shake_time = 0.35

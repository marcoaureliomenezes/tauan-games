extends Node
# flight_arcade.gd — Arcade flight model for RigidBody3D player pawn.
# Implements FR-V2-G-04: throttle / pitch / roll / yaw with v1 constants.
# Attach to Player (RigidBody3D) root or as a child Node.
# Physics integration runs in _integrate_forces() for deterministic per-tick control.

# ────────────────────────────────────────────────────────────────────────────────
# Constants (ported from v1 aero-fighters/src/config.js PLAYER block)
# ────────────────────────────────────────────────────────────────────────────────
const MAX_SPD: float = 80.0          # m/s — maximum speed at full throttle
const MIN_SPD: float = 8.0           # m/s — minimum sustained flight speed
const STALL_SPD: float = 10.0        # m/s — stall threshold
const GRAVITY: float = 14.0          # m/s² — arcade gravity (overrides world default)
const PITCH_RATE: float = 1.45       # rad/s — nose rotation rate
const ROLL_RATE: float = 2.30        # rad/s — roll rotation rate
const YAW_RATE: float = 0.80         # rad/s — yaw rotation rate
const THROTTLE_UP_RATE: float = 15.0 # m/s² — speed gain per full throttle
const THROTTLE_DOWN_RATE: float = 8.0 # m/s² — speed loss per zero throttle
const MOUNTAIN_BUFFER: float = 5.0   # m — crash detection AGL floor

# Derived: max thrust coefficient converts throttle [0..1] → speed m/s²
const MAX_THRUST: float = THROTTLE_UP_RATE

# Pitch axis inverted (sim-style): pitch_up action → nose DOWN
const PITCH_INVERT: float = -1.0

# Boundary spring — impulse applied when exceeding 20 km from origin (FR-V2-G-19)
const BOUNDARY_RADIUS: float = 20000.0 # m
const BOUNDARY_SPRING: float = 6.0    # m/s² per meter of overshoot

# ────────────────────────────────────────────────────────────────────────────────
# State
# ────────────────────────────────────────────────────────────────────────────────
enum FlightState { NORMAL, STALLED, CRASHED }

var current_speed: float = 0.0     # m/s — current airspeed
var current_throttle: float = 0.5  # 0..1 — current throttle setting
var state: FlightState = FlightState.NORMAL

# Stall auto-recovery: automatically pitches nose down
const STALL_RECOVERY_PITCH: float = 0.6  # rad/s nose-down when stalled

# Reference to parent RigidBody3D — set in _ready()
var _body: RigidBody3D = null


func _ready() -> void:
	_body = get_parent() as RigidBody3D
	if _body == null:
		push_error("[flight_arcade] Parent must be RigidBody3D")
		return

	# Load constants from GameConfig if available (overrides local defaults)
	if GameConfig and GameConfig.cfg:
		var cfg = GameConfig.cfg
		# Constants are already baked into const above; GameConfig carries same values.
		# Use spawn speed so we don't immediately stall.
		current_speed = cfg.min_speed * 1.5
	else:
		current_speed = MIN_SPD * 1.5

	# Disable default Godot gravity on the RigidBody3D — we apply arcade gravity manually.
	_body.gravity_scale = 0.0
	# Lock rotation so physics engine doesn't tumble us; we drive rotation ourselves.
	_body.lock_rotation = false
	_body.linear_damp = 0.0
	_body.angular_damp = 5.0

	print("[flight_arcade] ready — speed=%.1f m/s throttle=%.2f state=%s" % [
		current_speed, current_throttle, FlightState.keys()[state]
	])


func _physics_process(delta: float) -> void:
	if _body == null or state == FlightState.CRASHED:
		return

	_handle_throttle(delta)
	_handle_stall()
	_handle_rotation(delta)


# Called by RigidBody3D's _integrate_forces — apply linear velocity directly.
# This is wired from player_controller.gd which overrides _integrate_forces.
func apply_forces(state_info: PhysicsDirectBodyState3D) -> void:
	if _body == null or state == FlightState.CRASHED:
		return

	var dt: float = state_info.step
	var forward: Vector3 = -_body.global_transform.basis.z  # Godot -Z is forward

	# Current speed from physics state magnitude (projected on forward)
	var vel: Vector3 = state_info.linear_velocity
	current_speed = vel.dot(forward)

	# ── Thrust & gravity ──
	var target_speed: float = current_throttle * MAX_SPD
	if current_speed < target_speed:
		current_speed += THROTTLE_UP_RATE * current_throttle * dt
	else:
		current_speed -= THROTTLE_DOWN_RATE * (1.0 - current_throttle) * dt
	current_speed = clampf(current_speed, 0.0, MAX_SPD)

	# Apply gravity (arcade: downward always)
	var gravity_vec: Vector3 = Vector3.DOWN * GRAVITY

	# Lift: counteracts gravity proportional to speed / max_speed when not stalled
	var lift_factor: float = 0.0
	if state == FlightState.NORMAL:
		lift_factor = clampf(current_speed / MAX_SPD, 0.0, 1.0)
	var lift_vec: Vector3 = Vector3.UP * GRAVITY * lift_factor

	# Thrust vector
	var thrust_vec: Vector3 = forward * current_speed

	# Boundary spring (FR-V2-G-19) — push back when > 20 km from origin
	var horiz_pos: Vector3 = Vector3(_body.global_position.x, 0.0, _body.global_position.z)
	var horiz_dist: float = horiz_pos.length()
	var spring_vec: Vector3 = Vector3.ZERO
	if horiz_dist > BOUNDARY_RADIUS:
		var overshoot: float = horiz_dist - BOUNDARY_RADIUS
		spring_vec = -horiz_pos.normalized() * overshoot * BOUNDARY_SPRING

	# Compose final linear velocity
	var new_vel: Vector3 = thrust_vec + (gravity_vec + lift_vec) * dt + spring_vec * dt
	state_info.linear_velocity = new_vel


# ────────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ────────────────────────────────────────────────────────────────────────────────

func _handle_throttle(delta: float) -> void:
	var throttle_input: float = 0.0
	if Input.is_action_pressed("throttle_up"):
		throttle_input += 1.0
	if Input.is_action_pressed("throttle_down"):
		throttle_input -= 1.0
	current_throttle += throttle_input * delta * 0.5
	current_throttle = clampf(current_throttle, 0.0, 1.0)


func _handle_stall() -> void:
	match state:
		FlightState.NORMAL:
			if current_speed < STALL_SPD:
				state = FlightState.STALLED
				print("[flight_arcade] STALL — speed=%.1f" % current_speed)
		FlightState.STALLED:
			if current_speed >= STALL_SPD + 2.0:  # 2 m/s hysteresis before recovering
				state = FlightState.NORMAL
				print("[flight_arcade] STALL RECOVERY — speed=%.1f" % current_speed)


func _handle_rotation(delta: float) -> void:
	if _body == null:
		return

	var pitch_input: float = 0.0
	var roll_input: float = 0.0
	var yaw_input: float = 0.0

	if Input.is_action_pressed("pitch_up"):
		pitch_input += 1.0 * PITCH_INVERT  # sim-style: pitch_up → nose down
	if Input.is_action_pressed("pitch_down"):
		pitch_input -= 1.0 * PITCH_INVERT

	if Input.is_action_pressed("roll_left"):
		roll_input -= 1.0
	if Input.is_action_pressed("roll_right"):
		roll_input += 1.0

	if Input.is_action_pressed("yaw_left"):
		yaw_input += 1.0
	if Input.is_action_pressed("yaw_right"):
		yaw_input -= 1.0

	# Stall: auto-recovery dive — pitch nose down regardless of input
	if state == FlightState.STALLED:
		pitch_input = STALL_RECOVERY_PITCH / PITCH_RATE  # normalized, will be multiplied below

	# Build angular velocity in local space, then transform to world space
	var local_angular: Vector3 = Vector3(
		pitch_input * PITCH_RATE,
		yaw_input * YAW_RATE,
		roll_input * ROLL_RATE
	)
	_body.angular_velocity = _body.global_transform.basis * local_angular

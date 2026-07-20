extends Node3D
# crash_detector.gd — Ground-proximity and sea-level crash detection.
# Implements FR-V2-G-08: ray query down from pawn; crash when AGL < MOUNTAIN_BUFFER.
# Attach as a child Node3D of Player.tscn.
# Also updates HUD altitude AGL via signal so hud.gd uses AGL not absolute Y.
# T-G-19 (Wave 4).

signal crashed(reason: String)
signal agl_updated(agl_m: float)

# ────────────────────────────────────────────────────────────────────────────────
# Constants
# ────────────────────────────────────────────────────────────────────────────────
const MOUNTAIN_BUFFER: float = 5.0       # m AGL — crash threshold
const SEA_LEVEL: float = 0.0             # m — crash if below this (backstop)
const RAY_LENGTH: float = 5000.0         # m — downward ray extent
const INHAUMA_MIN_ELEV: float = 645.0    # m — SRTM floor fallback when terrain missing

# ────────────────────────────────────────────────────────────────────────────────
# State
# ────────────────────────────────────────────────────────────────────────────────
var _crashed: bool = false
var _agl: float = INHAUMA_MIN_ELEV       # last computed AGL (m)

# References
var _body: RigidBody3D = null
var _flight: Node = null
var _space_state: PhysicsDirectSpaceState3D = null


func _ready() -> void:
	_body = get_parent() as RigidBody3D
	if _body == null:
		push_error("[crash_detector] Parent must be RigidBody3D")
		return
	_flight = _body.find_child("FlightArcade", true, false)
	print("[crash_detector] ready — buffer=%.1f m  ray=%.0f m  fallback_elev=%.0f m" % [
		MOUNTAIN_BUFFER, RAY_LENGTH, INHAUMA_MIN_ELEV
	])


func _physics_process(_delta: float) -> void:
	if _body == null or _crashed:
		return

	_space_state = _body.get_world_3d().direct_space_state

	var pawn_pos: Vector3 = _body.global_position

	# ── Below-sea backstop ──
	if pawn_pos.y < SEA_LEVEL:
		_trigger_crash("BELOW_SEA", pawn_pos)
		return

	# ── Downward ray query ──
	var ground_alt: float = _compute_ground_altitude(pawn_pos)
	_agl = pawn_pos.y - ground_alt
	agl_updated.emit(_agl)

	if _agl < MOUNTAIN_BUFFER:
		_trigger_crash("MOUNTAIN", pawn_pos)


# ────────────────────────────────────────────────────────────────────────────────
# Ground altitude via ray
# ────────────────────────────────────────────────────────────────────────────────

func _compute_ground_altitude(pawn_pos: Vector3) -> float:
	if _space_state == null:
		return INHAUMA_MIN_ELEV

	var query := PhysicsRayQueryParameters3D.create(
		pawn_pos,
		pawn_pos + Vector3.DOWN * RAY_LENGTH
	)
	query.exclude = [_body.get_rid()]
	query.collision_mask = 1  # WorldStatic layer

	var result: Dictionary = _space_state.intersect_ray(query)
	if result.is_empty():
		# Ray missed everything — use SRTM fallback floor
		return INHAUMA_MIN_ELEV

	return result["position"].y


# ────────────────────────────────────────────────────────────────────────────────
# Crash handling
# ────────────────────────────────────────────────────────────────────────────────

func _trigger_crash(reason: String, pos: Vector3) -> void:
	if _crashed:
		return
	_crashed = true

	print("[crash_detector] CRASHED — reason=%s  pos=(%.0f, %.0f, %.0f)  AGL=%.1f m" % [
		reason, pos.x, pos.y, pos.z, _agl
	])

	# Stop flight input
	if _flight and "state" in _flight:
		_flight.state = _flight.FlightState.CRASHED

	# Zero throttle
	if _flight and "current_throttle" in _flight:
		_flight.current_throttle = 0.0

	# Zero velocity
	if _body:
		_body.linear_velocity = Vector3.ZERO
		_body.angular_velocity = Vector3.ZERO

	crashed.emit(reason)


# ────────────────────────────────────────────────────────────────────────────────
# Respawn (R key)
# ────────────────────────────────────────────────────────────────────────────────

func _unhandled_input(event: InputEvent) -> void:
	if _crashed and event is InputEventKey:
		var key_event: InputEventKey = event as InputEventKey
		if key_event.pressed and key_event.physical_keycode == KEY_R:
			_respawn()


func _respawn() -> void:
	_crashed = false
	print("[crash_detector] RESPAWN")

	# Reset position to spawn height
	var spawn_h: float = 2095.0
	if GameConfig and GameConfig.cfg:
		spawn_h = GameConfig.cfg.spawn_height_m

	if _body:
		_body.global_position = Vector3(0.0, spawn_h, 0.0)
		_body.global_rotation = Vector3.ZERO
		_body.linear_velocity = Vector3(0.0, 0.0, -12.0)
		_body.angular_velocity = Vector3.ZERO

	if _flight and "state" in _flight:
		_flight.state = _flight.FlightState.NORMAL

	if _flight and "current_throttle" in _flight:
		_flight.current_throttle = 0.5

	if _flight and "current_speed" in _flight:
		_flight.current_speed = 12.0


# ────────────────────────────────────────────────────────────────────────────────
# AGL accessor (for HUD polling)
# ────────────────────────────────────────────────────────────────────────────────

func get_agl() -> float:
	return _agl

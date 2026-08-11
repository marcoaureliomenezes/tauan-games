extends RigidBody3D
# player_controller.gd — Attached to Player (RigidBody3D) root.
# Handles spawn positioning, initial velocity, and delegates physics to flight_arcade.gd.
# Implements FR-V2-G-03/04: pawn spawn per AC-V2-G-03 + arcade flight integration.

# ────────────────────────────────────────────────────────────────────────────────
# Spawn constants
# ────────────────────────────────────────────────────────────────────────────────
const SPAWN_HEIGHT_M: float = 2095.0  # m above world origin (AC-V2-G-03)
const SPAWN_INITIAL_SPEED_FACTOR: float = 1.5  # × min_speed at spawn so we don't stall

# ────────────────────────────────────────────────────────────────────────────────
# Child references
# ────────────────────────────────────────────────────────────────────────────────
@onready var flight_arcade: Node = $FlightArcade
@onready var camera_controller: Node = $CameraController


func _ready() -> void:
	# Position at spawn height above world origin — terrain-independent.
	# Actual AGL will be computed by crash_detector.gd once Terrain3D is materialized.
	var spawn_h: float = SPAWN_HEIGHT_M
	if GameConfig and GameConfig.cfg:
		spawn_h = GameConfig.cfg.spawn_height_m

	global_position = Vector3(0.0, spawn_h, 0.0)

	# Face forward (nose pointing toward -Z in Godot convention)
	global_rotation = Vector3.ZERO

	# Set initial forward velocity to avoid immediate stall
	var initial_speed: float = 12.0  # MIN_SPD * 1.5 = 8 * 1.5
	if GameConfig and GameConfig.cfg:
		initial_speed = GameConfig.cfg.min_speed * SPAWN_INITIAL_SPEED_FACTOR

	# Godot forward is -Z; apply initial velocity so pawn moves forward
	linear_velocity = Vector3(0.0, 0.0, -initial_speed)

	# Wire crash_detector.crashed → HUD.show_crashed
	var crash_det: Node = find_child("CrashDetector", true, false)
	if crash_det and crash_det.has_signal("crashed"):
		crash_det.crashed.connect(_on_crashed)

	print("[player_controller] spawned at h=%.1f m — initial_vel=%.1f m/s forward" % [
		spawn_h, initial_speed
	])


func _on_crashed(_reason: String) -> void:
	var hud: Node = get_tree().root.find_child("HUD", true, false)
	if hud and hud.has_method("show_crashed"):
		hud.show_crashed()


func _integrate_forces(state: PhysicsDirectBodyState3D) -> void:
	# Delegate force application to flight_arcade each physics tick.
	if flight_arcade and flight_arcade.has_method("apply_forces"):
		flight_arcade.apply_forces(state)

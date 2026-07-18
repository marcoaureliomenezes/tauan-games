extends Node3D
# camera_controller.gd — Two-camera system for the player pawn.
# Implements FR-V2-G-09: Chase camera (default SpringArm3D) + Cockpit camera (Camera3D).
# cycle_camera action toggles between the two.

enum CameraMode { CHASE, COCKPIT }

# ────────────────────────────────────────────────────────────────────────────────
# SpringArm config constants
# ────────────────────────────────────────────────────────────────────────────────
const SPRING_LENGTH: float = 12.0   # m — camera arm length behind aircraft
const SPRING_HEIGHT: float = 4.0    # m — vertical offset above aircraft root
const CHASE_SMOOTH: float = 8.0     # lerp factor for chase camera rotation smoothing

var _mode: CameraMode = CameraMode.CHASE
var _player_body: RigidBody3D = null

# ────────────────────────────────────────────────────────────────────────────────
# Camera references (set up as children in Player.tscn)
# ────────────────────────────────────────────────────────────────────────────────
@onready var chase_spring_arm: SpringArm3D = $ChaseSpringArm
@onready var chase_camera: Camera3D = $ChaseSpringArm/ChaseCamera
@onready var cockpit_camera: Camera3D = $CockpitCamera


func _ready() -> void:
	_player_body = get_parent() as RigidBody3D

	# Configure SpringArm3D
	if chase_spring_arm:
		chase_spring_arm.spring_length = SPRING_LENGTH
		chase_spring_arm.position = Vector3(0.0, SPRING_HEIGHT, 0.0)
		# Angle the arm backward and slightly upward (look toward aircraft from behind)
		chase_spring_arm.rotation_degrees = Vector3(-10.0, 0.0, 0.0)

	# Chase is active by default
	_set_camera_mode(CameraMode.CHASE)

	print("[camera_controller] ready — default mode: CHASE")


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("cycle_camera"):
		match _mode:
			CameraMode.CHASE:
				_set_camera_mode(CameraMode.COCKPIT)
			CameraMode.COCKPIT:
				_set_camera_mode(CameraMode.CHASE)


func _physics_process(_delta: float) -> void:
	# Chase camera: spring arm inherits parent transform automatically in Godot.
	# Additional smoothing on the spring arm rotation to prevent jarring snaps.
	if _mode == CameraMode.CHASE and chase_spring_arm:
		# Keep spring arm facing the same horizontal direction as the aircraft
		# but with slight lag. The SpringArm3D parent (CameraController Node3D)
		# is a direct child of the Player, so rotation is relative.
		pass  # SpringArm3D child-of-Player handles this automatically


# ────────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ────────────────────────────────────────────────────────────────────────────────

func _set_camera_mode(new_mode: CameraMode) -> void:
	_mode = new_mode
	match _mode:
		CameraMode.CHASE:
			if chase_camera:
				chase_camera.current = true
			if cockpit_camera:
				cockpit_camera.current = false
			print("[camera_controller] switched to CHASE")
		CameraMode.COCKPIT:
			if cockpit_camera:
				cockpit_camera.current = true
			if chase_camera:
				chase_camera.current = false
			print("[camera_controller] switched to COCKPIT")


# Public query for HUD or other systems
func get_active_camera() -> Camera3D:
	match _mode:
		CameraMode.CHASE:
			return chase_camera
		CameraMode.COCKPIT:
			return cockpit_camera
	return chase_camera

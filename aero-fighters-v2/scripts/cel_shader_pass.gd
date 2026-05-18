## cel_shader_pass.gd
## Controller for the screen-space cel-shader pass (T-G-10 / FR-V2-G-11).
##
## Architecture:
##   Godot 4 canvas_item shaders cannot read depth or normal-roughness buffers;
##   those hints are only available in spatial shaders (Forward+ only).
##   We use a QuadMesh (MeshInstance3D "CelPass") with a spatial shader.
##   At _ready this script:
##     1. Finds the active Camera3D in the scene tree.
##     2. Reparents "CelPass" to that camera so it stays in clip space.
##     3. Positions the quad at z = -(near + 0.01) so it covers the viewport
##        and renders over all other 3D geometry.
##     4. Scales the quad to match the camera frustum at that near-plane z.
##
##   Limitation: only one Camera3D may be active at a time.  If camera
##   is cycled (Chase ↔ Cockpit), call _attach_to_camera() again from
##   camera_controller.gd via the signal below.
##
## Usage in scenes/CelShaderPass.tscn:
##   Root: Node3D (this script)
##   Child: MeshInstance3D named "CelPass" with QuadMesh + ShaderMaterial

extends Node3D

## Emitted after the quad is successfully attached to a camera.
signal attached_to_camera(camera: Camera3D)

# The CelPass MeshInstance3D child.
@onready var _cel_mesh: MeshInstance3D = $CelPass

# The camera the quad is currently parented to.
var _active_camera: Camera3D = null

const NEAR_OFFSET: float = 0.01  # metres past the near-plane


func _ready() -> void:
	call_deferred("_attach_to_camera")


## Finds the active Camera3D and reparents the quad to it.
## Safe to call multiple times (e.g. after a camera switch).
func _attach_to_camera() -> void:
	var camera: Camera3D = get_viewport().get_camera_3d()
	if camera == null:
		push_warning("[CelShaderPass] No active Camera3D found — deferring attachment.")
		# Retry next frame so the player scene has time to activate its camera.
		await get_tree().process_frame
		camera = get_viewport().get_camera_3d()

	if camera == null:
		push_error("[CelShaderPass] Still no active Camera3D after one-frame delay.")
		return

	if _active_camera == camera:
		return  # Already attached — nothing to do.

	# Reparent the quad to the camera without changing world transform.
	var world_transform: Transform3D = _cel_mesh.global_transform
	_cel_mesh.reparent(camera, false)

	_active_camera = camera
	_position_quad(camera)
	attached_to_camera.emit(camera)
	print("[CelShaderPass] attached CelPass quad to Camera3D '%s'." % camera.name)


## Positions and scales the quad to exactly cover the near-plane of the camera.
func _position_quad(camera: Camera3D) -> void:
	var near: float = camera.near + NEAR_OFFSET

	# Half-height of the frustum at distance `near`.
	var half_fov_y: float = deg_to_rad(camera.fov) * 0.5
	var half_h: float = near * tan(half_fov_y)
	var half_w: float = half_h * camera.get_viewport().get_visible_rect().size.aspect()

	_cel_mesh.position = Vector3(0.0, 0.0, -near)
	_cel_mesh.scale    = Vector3(half_w * 2.0, half_h * 2.0, 1.0)


## Called by camera_controller.gd when the active camera changes.
func on_camera_changed() -> void:
	_attach_to_camera()

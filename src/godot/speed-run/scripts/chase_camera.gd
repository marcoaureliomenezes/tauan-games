class_name ChaseCamera
extends Camera3D
## Câmera de perseguição suave com look-ahead e FOV que abre com a velocidade.

@export var target: VehicleBody3D
@export var distance := 7.5
@export var height := 3.2
@export var stiffness := 5.0

var _velocity_fov := 70.0


func _ready() -> void:
	# Mesma máscara da câmera do M.A.V.S: esconde a layer 10 (sprites de minimapa).
	cull_mask = 1048063


func _physics_process(delta: float) -> void:
	if target == null:
		return
	# Carros M.A.V.S andam para +Z (nariz invertido da convenção Godot).
	var fwd := target.global_transform.basis.z
	fwd.y = 0.0
	if fwd.length() < 0.01:
		fwd = Vector3.FORWARD
	fwd = fwd.normalized()
	var desired := target.global_position - fwd * distance + Vector3.UP * height
	global_position = global_position.lerp(desired, clampf(stiffness * delta, 0.0, 1.0))
	look_at(target.global_position + fwd * 4.0 + Vector3.UP * 1.2, Vector3.UP)
	var speed := target.linear_velocity.length()
	_velocity_fov = lerpf(_velocity_fov, 70.0 + clampf(speed * 0.35, 0.0, 22.0), 3.0 * delta)
	fov = _velocity_fov

# camera_rig.gd — câmeras do homem-a-cavalo (SPEC §P-05/§3).
# O rig orbita o rider pelo mouse (yaw+pitch) INDEPENDENTE do rumo do cavalo.
# 1ª pessoa: nos olhos do cowboy (cabeça do cavalo e rédeas visíveis abaixo).
# 3ª pessoa: SpringArm3D atrás e acima com colisão. Toggle [V].
class_name CameraRig
extends Node3D

const MOUSE_SENS := 0.0022
const PITCH_MIN := -0.02   # JAMAIS abaixo do horizonte (ver o chão por dentro = bug)
const PITCH_MAX := 0.9     # mouse só levanta a visão (olhar para cima)
const CAM3_DISTANCE := 6.5
const CAM3_MIN := 2.5    # scroll: limite MÍNIMO de aproximação
const CAM3_MAX := 9.0    # scroll: limite MÁXIMO de afastamento
const HEAD_HEIGHT := 2.1
const FOV_NORMAL := 70.0
const FOV_ADS := 46.0

var yaw := PI   # começa ATRÁS do cavalo (modelo olha para +Z)
var pitch := 0.05
var first_person := false
var ads := false

var cam1: Camera3D
var cam3_arm: SpringArm3D
var cam3: Camera3D
@onready var rider = get_parent()

func _ready() -> void:
	cam1 = Camera3D.new()
	cam1.name = "Cam1P"
	cam1.fov = 70.0
	cam1.near = 0.08
	add_child(cam1)
	cam1.position = Vector3(0, 0.32, -0.35)  # olhos: cabeça baixa no quadro E braço/arma visíveis embaixo

	cam3_arm = SpringArm3D.new()
	cam3_arm.name = "Cam3Arm"
	cam3_arm.spring_length = CAM3_DISTANCE
	cam3_arm.margin = 0.4
	add_child(cam3_arm)
	# o braço não pode colidir com o PRÓPRIO rider (senão encurta para ~1m)
	if get_parent() is CollisionObject3D:
		cam3_arm.add_excluded_object(get_parent().get_rid())
	cam3 = Camera3D.new()
	cam3.name = "Cam3P"
	cam3.fov = 70.0
	cam3_arm.add_child(cam3)

	# começa em 3ª pessoa (o jogador VÊ o personagem — aceitação visual primeiro)
	_apply_mode()

	# _input (não _unhandled_input): roda ANTES da GUI — um Control com
	# mouse_filter STOP (ex.: container do minimapa) não pode comer o evento
func _input(event: InputEvent) -> void:
	# scroll: zoom da 3ª pessoa com limites claros
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			cam3_arm.spring_length = clampf(cam3_arm.spring_length - 0.6, CAM3_MIN, CAM3_MAX)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			cam3_arm.spring_length = clampf(cam3_arm.spring_length + 0.6, CAM3_MIN, CAM3_MAX)
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		# nova câmera: mouse NÃO gira em yaw (olha-se sempre para frente —
		# gira-se o CAVALO com A/D); mouse só levanta/desce a visão até o horizonte
		pitch = clampf(pitch - event.relative.y * MOUSE_SENS, PITCH_MIN, PITCH_MAX)
	if event.is_action_pressed("camera_toggle"):
		first_person = not first_person
		_apply_mode()

func _apply_mode() -> void:
	cam1.current = first_person
	cam3.current = not first_person

func active_camera() -> Camera3D:
	return cam1 if first_person else cam3

func _process(dt: float) -> void:
	# ADS [F] (só revólver): zoom 70→46 suave
	var g = get_node_or_null("/root/Game")
	var want_ads: bool = Input.is_action_pressed("ads") and (g == null or g.player.get("weapon", &"revolver") == &"revolver")
	ads = want_ads
	var fov_target := FOV_ADS if ads else FOV_NORMAL
	cam1.fov = lerpf(cam1.fov, fov_target, minf(1.0, 10.0 * dt))
	cam3.fov = lerpf(cam3.fov, fov_target, minf(1.0, 10.0 * dt))
	# yaw SEMPRE atrás do cavalo (frente = rumo do corpo; gira com A/D)
	yaw = rider.global_rotation.y + PI
	# mira travada [F]: a câmera acompanha o alvo (dinâmica de caça)
	var lt = g.player.get("lock_target") if g else null
	if lt != null and is_instance_valid(lt) and lt is Node3D:
		var head: Vector3 = rider.global_position + Vector3(0, HEAD_HEIGHT, 0)
		var dir: Vector3 = (lt.global_position - head).normalized()
		var want_yaw := atan2(-dir.x, -dir.z)
		var want_pitch := maxf(0.0, asin(clampf(dir.y, -1.0, 1.0)))
		yaw = lerp_angle(yaw, want_yaw, minf(1.0, 10.0 * dt))
		pitch = lerpf(pitch, want_pitch, minf(1.0, 10.0 * dt))
	pitch = clampf(pitch, PITCH_MIN, PITCH_MAX)
	# rig centrado na cabeça do rider; yaw+pitch do mouse definem o olhar
	var p: Vector3 = rider.global_position + Vector3(0, HEAD_HEIGHT, 0)
	global_transform = Transform3D(Basis.from_euler(Vector3(pitch, yaw, 0)), p)

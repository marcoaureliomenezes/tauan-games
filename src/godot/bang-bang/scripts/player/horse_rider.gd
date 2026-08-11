# horse_rider.gd — CharacterBody3D do homem-a-cavalo (SPEC §3/§6).
# Gaits stop/walk/trot/gallop com aceleração suave, estamina, salto balístico,
# alinhamento ao declive do terreno e colisão física. Controles CS: W/S frente/
# ré, A/D giro; o mouse NÃO interfere no rumo (mira é da câmera, camera_rig.gd).
class_name HorseRider
extends CharacterBody3D

const WALK_SPEED := 2.2
const TROT_SPEED := 6.0
const GALLOP_SPEED := 14.0
const BACK_SPEED := 2.0
const ACCEL := 8.0
const BRAKE := 10.0
const TURN_WALK := 2.2      # rad/s
const TURN_TROT := 1.6
const TURN_GALLOP := 1.0
const JUMP_VEL := 7.0       # ~1.6 m de ápice com a gravidade abaixo
const GRAVITY := 24.0

const STA_MAX := 100.0
const STA_GALLOP := 22.0
const STA_REGEN := 9.0
const STA_LOCK := 25.0
const STA_JUMP := 5.0

var speed := 0.0
var stamina := STA_MAX
var _sta_locked := false
var _vy := 0.0
var _ground_y := 0.0
var _jumping := false
var terrain: Node = null     # BangTerrain (height_at)
var gait: StringName = &"stop"
var gun_anim: AnimationPlayer = null   # clips do cowboy (player.gd injeta)

@onready var rig: Node3D = $Horseman if has_node("Horseman") else null
@onready var anim: AnimationPlayer = _find_anim()

func _ready() -> void:
	_dust_setup()

func _apply_loops() -> void:
	# os clips do pack vêm com loop NONE — sem loop o cavalo "congela" depois de 1 ciclo
	for p in [[anim, &"AnimalArmature|Idle"], [anim, &"AnimalArmature|Walk"], [anim, &"AnimalArmature|Gallop"], [gun_anim, &"CharacterArmature|Idle"]]:
		var ap: AnimationPlayer = p[0]
		if ap and ap.has_animation(p[1]):
			ap.get_animation(p[1]).loop_mode = Animation.LOOP_LINEAR

func _find_anim() -> AnimationPlayer:
	return get_node_or_null("Horseman/AnimationPlayer") as AnimationPlayer

func setup(p_terrain: Node) -> void:
	terrain = p_terrain

func _playing() -> bool:
	# autoload Game existe no jogo; em modo -s (testes) assume "jogando"
	var g = get_node_or_null("/root/Game")
	return g == null or g.is_playing()

func _write_state() -> void:
	var g = get_node_or_null("/root/Game")
	if g:
		g.player["pos"] = global_position
		g.player["speed"] = speed
		g.player["gait"] = gait
		g.player["stamina"] = stamina

func _physics_process(dt: float) -> void:
	if not _playing():
		return
	var fwd_input := Input.get_action_strength("move_forward") - Input.get_action_strength("move_back")
	var turn_input := Input.get_action_strength("turn_left") - Input.get_action_strength("turn_right")
	var want_gallop := Input.is_action_pressed("gallop") and not _sta_locked and stamina > 0

	# --- velocidade-alvo por gait ---
	var target := 0.0
	if fwd_input > 0:
		target = GALLOP_SPEED if want_gallop else TROT_SPEED
	elif fwd_input < 0:
		target = -BACK_SPEED
	var rate := ACCEL if absf(target) > absf(speed) else BRAKE
	speed = move_toward(speed, target, rate * dt)

	# --- giro (A/D) com taxa por velocidade ---
	var sp := absf(speed)
	var turn_rate := TURN_WALK if sp < TROT_SPEED else (TURN_TROT if sp < GALLOP_SPEED else TURN_GALLOP)
	rotate_y(turn_input * turn_rate * dt * signf(speed if absf(speed) > 0.1 else 1.0))

	# --- estamina ---
	if want_gallop and speed > TROT_SPEED * 0.9:
		stamina = maxf(0.0, stamina - STA_GALLOP * dt)
		if stamina <= 0.01:
			_sta_locked = true
	else:
		stamina = minf(STA_MAX, stamina + STA_REGEN * dt)
		if _sta_locked and stamina >= STA_LOCK:
			_sta_locked = false

	# --- chão/terreno + salto ---
	var ground := _ground_height()
	var on_floor := _grounded() and _vy <= 0.01
	if Input.is_action_just_pressed("jump") and on_floor and stamina >= STA_JUMP:
		_vy = JUMP_VEL
		_jumping = true
		stamina -= STA_JUMP
		_play(&"AnimalArmature|Gallop_Jump")
	if not on_floor or _vy > 0.01:
		_vy -= GRAVITY * dt
	elif global_position.y < ground:
		global_position.y = ground
		_vy = 0.0
		_jumping = false

	# --- move ---
	# o modelo do cavalo "olha" para +Z (glb) — frente do corpo é +basis.z
	velocity = global_transform.basis.z * speed
	velocity.y = _vy
	move_and_slide()

	# --- alinha ao declive (leve) ---
	_align_to_slope(dt)

	# --- gait + animação ---
	var new_gait := &"stop"
	if absf(speed) > 0.3:
		new_gait = &"walk" if sp < TROT_SPEED * 0.6 else (&"trot" if sp < GALLOP_SPEED * 0.7 else &"gallop")
	elif fwd_input < -0.1:
		new_gait = &"walk"
	if new_gait != gait:
		gait = new_gait
		match gait:
			&"stop": _play(&"AnimalArmature|Idle")
			&"walk": _play(&"AnimalArmature|Walk")
			&"trot": _play(&"AnimalArmature|Walk", 1.6)
			&"gallop": _play(&"AnimalArmature|Gallop")
	# estado público
	_write_state()

	# --- casco (som por passada) + poeira ---
	var sp_now := absf(speed)
	if on_floor and sp_now > 0.5:
		_stride_t -= dt
		if _stride_t <= 0.0:
			_stride_t = clampf(1.9 / sp_now, 0.17, 0.6)
			_hoof_sound()
	else:
		_stride_t = 0.0
	if _dust:
		_dust.emitting = on_floor and sp_now > TROT_SPEED * 0.7
		if _dust.emitting:
			_dust.amount_ratio = clampf(sp_now / GALLOP_SPEED, 0.4, 1.0)


	# --- pose de MIRA do cowboy (braço acompanha a ação de atirar/mirar) ---
	if gun_anim:
		if Input.is_action_just_pressed("fire") and gun_anim.has_animation(&"CharacterArmature|Gun_Shoot"):
			gun_anim.play(&"CharacterArmature|Gun_Shoot", 0.1)
		elif (Input.is_action_pressed("ads") or Input.is_action_pressed("fire")) and gun_anim.has_animation(&"CharacterArmature|Idle_Gun_Pointing"):
			if gun_anim.current_animation != &"CharacterArmature|Idle_Gun_Pointing":
				gun_anim.play(&"CharacterArmature|Idle_Gun_Pointing", 0.2)
		else:
			# idle do braço: em 1ª pessoa segura a arma à vista (Idle_Gun);
			# em 3ª, braço relaxado — NUNCA interrompe o Gun_Shoot em execução
			var rig_cam = get_node_or_null("CameraRig")
			var fp: bool = rig_cam != null and rig_cam.get("first_person")
			var idle_clip := &"CharacterArmature|Idle_Gun_Pointing" if fp else &"CharacterArmature|Idle"   # 1ª pessoa: mão+arma no quadro
			var cur := gun_anim.current_animation
			var is_idle_variant: bool = cur in [&"CharacterArmature|Idle", &"CharacterArmature|Idle_Gun"]
			if gun_anim.has_animation(idle_clip) and cur != idle_clip and (not gun_anim.is_playing() or is_idle_variant):
				gun_anim.play(idle_clip, 0.2)

func _ground_height() -> float:
	if terrain and terrain.has_method("height_at"):
		return terrain.height_at(global_position.x, global_position.z)
	return 0.0

# Contato com o chão por raycast (robusto — Terrain3D nem sempre reporta
# is_on_floor() para CharacterBody3D parado).
func _grounded() -> bool:
	var space := get_world_3d().direct_space_state
	var from := global_position + Vector3(0, 0.3, 0)
	var to := global_position + Vector3(0, -0.6, 0)
	var q := PhysicsRayQueryParameters3D.create(from, to, 1, [self])
	return space.intersect_ray(q).size() > 0

func _align_to_slope(dt: float) -> void:
	if not terrain or not terrain.has_method("height_at"):
		return
	var p := global_position
	var hx: float = terrain.height_at(p.x + 1.5, p.z) - terrain.height_at(p.x - 1.5, p.z)
	var hz: float = terrain.height_at(p.x, p.z + 1.5) - terrain.height_at(p.x, p.z - 1.5)
	var n := Vector3(-hx, 3.0, -hz).normalized()
	var up := global_transform.basis.y
	var tilt := up.slerp(n, minf(1.0, 6.0 * dt))
	if tilt.length_squared() > 0.001:
		var b := global_transform.basis
		b.y = tilt.normalized()
		b.x = b.y.cross(b.z).normalized()
		b.z = b.x.cross(b.y).normalized()
		global_transform.basis = b.orthonormalized()

func _play(clip: StringName, speed_scale := 1.0) -> void:
	# anim é resolvido LAZY: no _ready o Horseman ainda não foi adicionado pelo
	# player.gd, então @onready ficava null e NENHUMA animação tocava (era o
	# "cavalo não mexe as pernas" do operador)
	if anim == null:
		anim = _find_anim()
		_apply_loops()
	if anim and anim.has_animation(clip):
		if anim.current_animation != clip:
			anim.play(clip, 0.25, speed_scale)

# --- efeitos de galope: poeira nos cascos + som de passada ---
var _stride_t := 0.0
var _dust: GPUParticles3D = null
var _audio: Node = null

func _hoof_sound() -> void:
	if _audio == null:
		_audio = get_node_or_null("/root/Main/Audio")
	if _audio and _audio.has_method("hoof"):
		_audio.hoof(global_position)

func _dust_setup() -> void:
	_dust = GPUParticles3D.new()
	_dust.name = "HoofDust"
	_dust.amount = 40
	_dust.lifetime = 0.9
	_dust.emitting = false
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	pm.emission_shape_scale = Vector3(0.6, 0.15, 0.9)
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 35.0
	pm.initial_velocity_min = 0.8
	pm.initial_velocity_max = 2.2
	pm.gravity = Vector3(0, -1.2, 0)
	pm.scale_min = 0.35
	pm.scale_max = 1.4
	pm.color = Color(0.62, 0.53, 0.4, 0.45)   # poeira de pradaria
	_dust.process_material = pm
	_dust.position = Vector3(0, 0.12, -0.4)   # altura dos cascos
	add_child(_dust)

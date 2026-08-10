class_name AaTurret
extends Node3D
## AaTurret — artilheiro da bateria antiaérea (port de turret-player.js +
## turret-camera.js + turret-weapons.js). Posição fixa no topo do morro 2.5×
## (-760,-480, cota ~250 m), gimbal yaw livre / pitch -20°..85°, câmera
## over-shoulder com zoom, .50 balística com calor (histerese) + míssil AA
## com navegação proporcional.

signal hp_changed(hp: int)
signal player_hit # K5: feedback de dano (vinheta vermelha no HUD)
signal overheat_changed(heat: float)
signal weapon_changed(name: String)
signal lock_progress(target: Node3D, p: float, red: bool) # candidato + fração do ciclo + fase vermelha

# Bateria compacta no enquadramento (Wave E1 — web: cano entra baixo-esquerda)
const BARREL_SCREEN_SCALE := 0.75
const BARREL_OFFSET := Vector3(-0.30, -0.42, 0.45)

var hp := GameConfig.AA_HP
var lives := GameConfig.AA_LIVES
var heat := 0.0
var overheated := false
var weapon := 0 # 0 = .50, 1 = míssil AA
var aa_stock := GameConfig.AAMSL_STOCK
var yaw := 0.0
var pitch := 0.0

var _yaw_pivot: Node3D
var _pitch_pivot: Node3D
var _camera: Camera3D
var _barrel_mg: Node3D
var _barrel_aa: Node3D
var surface_fast: Callable # grade rápida p/ projéteis (perf Wave E1)
var _surface: Callable
var _fx: FxManager
var _director: Node # DefenseDirector (listas de caças/ordenança)
var _fire_t := 0.0
var _reload_t := 0.0
var _regen_t := 0.0
var _lock_target: Node3D = null
var _phase_t := 0.0 # s no ciclo de fases (0..4,5)
var _shots_fired := 0 # mísseis no alvo (o 5º solta a mira)
var _hold_t := 0.0 # carência após quebra de feixe
var _fire_queue := 0 # X pressionados dentro da cadência (cap 4)
var _beep_t := 0.0
var _zoom := false
var nuke_cd := 0.0 # recarga da nuke tática (HUD mostra a contagem)
var _aa_cd := 0.0
var _heavy_cd := 0.0
var _recoil := 0.0
var _cam_kick := 0.0


func setup(surface_fn: Callable, fx: FxManager, director: Node) -> void:
	_surface = surface_fn
	_fx = fx
	_director = director
	var pos := GameConfig.AA_SOLDIER_POS
	var y: float = surface_fn.call(pos.x, pos.y)
	position = Vector3(pos.x, y + GameConfig.AA_EYE_HEIGHT, pos.y)
	# Olha para o centro da cidade (convenção: frente = (-sin yaw, -cos yaw))
	var look := GameConfig.AA_LOOK_AT
	yaw = atan2(pos.x - look.x, pos.y - look.y)
	# Pitch inicial -12°: do topo (250 m) o shelf inteiro da cidade entra no
	# enquadramento com FOV 62 (centro da cidade fica ~15° abaixo do horizonte)
	pitch = deg_to_rad(-12.0)
	_yaw_pivot = Node3D.new()
	add_child(_yaw_pivot)
	_pitch_pivot = Node3D.new()
	_yaw_pivot.add_child(_pitch_pivot)
	_camera = Camera3D.new()
	_camera.current = true
	_camera.fov = GameConfig.AA_FOV
	_pitch_pivot.add_child(_camera)
	_camera.position = Vector3(0, GameConfig.AA_CAM_UP, GameConfig.AA_CAM_BACK)
	_build_battery_mesh()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	weapon_changed.emit(".50")


## Malha da bateria (port de fx.js#makeDefenseBatteryMesh): base + pedestal,
## .50 MG e lançador AA no pivô de pitch (na troca, o inativo gira 90° p/ o
## lado), 8 sacos de areia — SEM chapa de proteção (horizonte 100% livre).
func _build_battery_mesh() -> void:
	var metal := StandardMaterial3D.new()
	metal.albedo_color = Color8(0x3a, 0x40, 0x34)
	metal.roughness = 0.7
	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color8(0x24, 0x28, 0x22)
	dark.roughness = 0.9
	# Base + pedestal (giram com o yaw do gimbal, pés no solo: -EYE_HEIGHT)
	var base := MeshInstance3D.new()
	var base_mesh := CylinderMesh.new()
	base_mesh.top_radius = 2.2
	base_mesh.bottom_radius = 2.6
	base_mesh.height = 0.6
	base_mesh.radial_segments = 10
	base.mesh = base_mesh
	base.material_override = dark
	base.position = Vector3(0, -GameConfig.AA_EYE_HEIGHT + 0.3, 0)
	_yaw_pivot.add_child(base)
	var pedestal := MeshInstance3D.new()
	var ped_mesh := CylinderMesh.new()
	ped_mesh.top_radius = 0.55
	ped_mesh.bottom_radius = 0.75
	ped_mesh.height = 1.0
	ped_mesh.radial_segments = 8
	pedestal.mesh = ped_mesh
	pedestal.material_override = metal
	pedestal.position = Vector3(0, -GameConfig.AA_EYE_HEIGHT + 1.1, 0)
	_yaw_pivot.add_child(pedestal)
	# Cano longo da .50 (muzzle em z ≈ -6,1 no espaço do pivô de pitch)
	_barrel_mg = Node3D.new()
	_barrel_mg.scale = Vector3.ONE * BARREL_SCREEN_SCALE
	_barrel_mg.position = BARREL_OFFSET
	_pitch_pivot.add_child(_barrel_mg)
	var breech := _box(Vector3(0.5, 0.45, 1.0), dark)
	breech.position = Vector3(0, 0, 0.5)
	_barrel_mg.add_child(breech)
	var tube := _tube(0.09, 0.12, 6.0, 8, metal)
	tube.position = Vector3(0, 0, -2.6)
	_barrel_mg.add_child(tube)
	var brake := _tube(0.17, 0.17, 0.5, 8, dark)
	brake.position = Vector3(0, 0, -5.55)
	_barrel_mg.add_child(brake)
	# Tubo do lançador AA com trilhos (muzzle em z ≈ -3,6) — nasce a 90° (MG ativa)
	_barrel_aa = Node3D.new()
	_barrel_aa.rotation.y = PI / 2
	_barrel_aa.scale = Vector3.ONE * BARREL_SCREEN_SCALE
	_barrel_aa.position = BARREL_OFFSET
	_pitch_pivot.add_child(_barrel_aa)
	var aa_tube := _tube(0.28, 0.34, 3.6, 10, dark)
	aa_tube.position = Vector3(0, 0, -1.6)
	_barrel_aa.add_child(aa_tube)
	for sx in [-0.42, 0.42]:
		var rail := _box(Vector3(0.1, 0.1, 3.2), metal)
		rail.position = Vector3(sx, 0.3, -1.5)
		_barrel_aa.add_child(rail)
	var aa_rear := _box(Vector3(0.8, 0.7, 0.9), metal)
	aa_rear.position = Vector3(0, 0, 0.6)
	_barrel_aa.add_child(aa_rear)
	# Anel de 8 sacos de areia (assinatura da posição no web)
	var sand := StandardMaterial3D.new()
	sand.albedo_color = Color8(0x8a, 0x7a, 0x58)
	sand.roughness = 1.0
	for i in 8:
		var a := (float(i) / 8) * TAU
		var bag := MeshInstance3D.new()
		var bag_mesh := SphereMesh.new()
		bag_mesh.radius = 0.55
		bag_mesh.height = 1.1
		bag_mesh.radial_segments = 6
		bag_mesh.rings = 5
		bag.mesh = bag_mesh
		bag.material_override = sand
		bag.scale.y = 0.55
		bag.position = Vector3(cos(a) * 3.1, -GameConfig.AA_EYE_HEIGHT + 0.28, sin(a) * 3.1)
		_yaw_pivot.add_child(bag)


static func _box(size: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var m := BoxMesh.new()
	m.size = size
	mi.mesh = m
	mi.material_override = mat
	return mi


## Cilindro deitado apontando -Z (frente do gimbal) — como rotation.x = π/2 no web.
static func _tube(r_top: float, r_bottom: float, length: float, segments: int,
		mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var m := CylinderMesh.new()
	m.top_radius = r_top
	m.bottom_radius = r_bottom
	m.height = length
	m.radial_segments = segments
	mi.mesh = m
	mi.material_override = mat
	mi.rotation.x = PI / 2
	return mi


func aim_dir() -> Vector3:
	return -_pitch_pivot.global_basis.z


## Superfície para projéteis (grade rápida quando disponível).
func _bullet_surface() -> Callable:
	return surface_fast if surface_fast.is_valid() else _surface


func _unhandled_input(event: InputEvent) -> void:
	if not GameState.running:
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		yaw -= event.relative.x * GameConfig.AA_MOUSE_SENS
		# Mouse pra cima = mira sobe (web turret-player.js: pitch - dy * sens)
		pitch = clampf(pitch - event.relative.y * GameConfig.AA_MOUSE_SENS,
			deg_to_rad(GameConfig.AA_PITCH_MIN), deg_to_rad(GameConfig.AA_PITCH_MAX))
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		if event.button_index == MOUSE_BUTTON_WHEEL_UP or event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_switch_weapon()
	if event.is_action_pressed("aa_weapon_1"):
		weapon = 0
		weapon_changed.emit(".50")
	if event.is_action_pressed("aa_weapon_2"):
		weapon = 1
		weapon_changed.emit("MÍSSIL AA")
	if event.is_action_pressed("missile_light"): # tecla X — fila anti-cadência (cap 4)
		_fire_queue = mini(_fire_queue + 1, GameConfig.AA_QUEUE_CAP)
	if event.is_action_pressed("missile_heavy") and _heavy_cd <= 0.0: # tecla B (1/s máx)
		if _fire_heavy():
			_heavy_cd = GameConfig.AAHV_CADENCE
	if event.is_action_pressed("missile_nuke") and nuke_cd <= 0.0: # tecla T (60 s de recarga)
		if _fire_nuke():
			nuke_cd = GameConfig.AAD_NUKE_CD


func _switch_weapon() -> void:
	weapon = 1 - weapon
	weapon_changed.emit("MÍSSIL AA" if weapon == 1 else ".50")


func _physics_process(delta: float) -> void:
	if not GameState.running or GameState.paused:
		return
	var dt := minf(delta, 0.1)
	_yaw_pivot.rotation.y = yaw
	_pitch_pivot.rotation.x = pitch
	# Troca de arma animada (web defense-mode.js:883-896): cano ativo a 0°,
	# inativo gira 90° p/ o lado, lerp ~0,2 s
	var swap_k := minf(1.0, 5.0 * dt)
	var mg_target := 0.0 if weapon == 0 else PI / 2
	_barrel_mg.rotation.y = lerpf(_barrel_mg.rotation.y, mg_target, swap_k)
	_barrel_aa.rotation.y = lerpf(_barrel_aa.rotation.y, PI / 2 - mg_target, swap_k)
	# Tranco do cano da .50: recuo rápido com retorno de mola + coice de câmera
	if _recoil > 0.0:
		_recoil = maxf(0.0, _recoil - dt * 7.0)
		_barrel_mg.position.z = BARREL_OFFSET.z + _recoil * GameConfig.AA50_RECOIL
	if _cam_kick > 0.0:
		_cam_kick = maxf(0.0, _cam_kick - dt * 0.025)
		_camera.rotation.x = _cam_kick
	# Cooldowns por tier de arma (X 2/s, B 1/s, T nuke 60 s)
	_aa_cd = maxf(0.0, _aa_cd - dt)
	_heavy_cd = maxf(0.0, _heavy_cd - dt)
	nuke_cd = maxf(0.0, nuke_cd - dt)
	# A câmera nunca entra no morro (web defense-mode.js:1019-1021)
	var cam_pos := _camera.global_position
	var cam_ground: float = _surface.call(cam_pos.x, cam_pos.z) + 0.6
	if cam_pos.y < cam_ground:
		cam_pos.y = cam_ground
		_camera.global_position = cam_pos
	# Zoom (RMB segurado)
	_zoom = Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT)
	var target_fov := GameConfig.AA_FOV_ZOOM if _zoom else GameConfig.AA_FOV
	_camera.fov = lerpf(_camera.fov, target_fov, minf(1.0, GameConfig.AA_ZOOM_LERP * dt))
	# Calor da .50 (histerese: rearma só aos 55%)
	heat = maxf(0.0, heat - GameConfig.AA50_COOL_RATE * dt)
	if overheated and heat <= GameConfig.AA50_REARM_AT:
		overheated = false
	overheat_changed.emit(heat)
	# Recarga do míssil AA (1 a cada 12 s)
	if aa_stock < GameConfig.AAMSL_STOCK:
		_reload_t += dt
		if _reload_t >= GameConfig.AAMSL_RELOAD:
			_reload_t = 0.0
			aa_stock += 1
	# Regen fora de combate: após 8 s, +1 HP a cada 4 s
	_regen_t += dt
	if _regen_t >= GameConfig.AA_REGEN_DELAY and hp < GameConfig.AA_HP:
		if fmod(_regen_t - GameConfig.AA_REGEN_DELAY, GameConfig.AA_REGEN_RATE) < dt:
			hp = mini(GameConfig.AA_HP, hp + 1)
			hp_changed.emit(hp)
	# Fogo da .50
	_fire_t -= dt
	if weapon == 0 and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) \
			and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and not overheated and _fire_t <= 0.0:
		_fire_50()
	# Lock por fases + cadência do X (segurar auto-dispersa; presses enfileiram)
	_update_lock(dt)
	if Input.is_action_pressed("missile_light") and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_try_fire_aa()
	while _fire_queue > 0:
		if not _try_fire_aa():
			break
		_fire_queue -= 1
	if _lock_target == null:
		_fire_queue = 0


func _fire_50() -> void:
	_fire_t = 1.0 / GameConfig.AA50_RATE
	heat += GameConfig.AA50_HEAT_PER_SHOT
	_recoil = 1.0 # tranco do cano
	_cam_kick = GameConfig.AA50_CAM_KICK
	AudioManager.play("aa50", -8.0)
	if heat >= 1.0:
		heat = 1.0
		overheated = true
		AudioManager.play("overheat", -2.0)
	var dir := aim_dir()
	# Dispersão
	dir = (dir + Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)) * GameConfig.AA50_SPREAD).normalized()
	var b := Aa50Bullet.create(_pitch_pivot.to_global(Vector3(0, 0, -6.1)), dir,
		GameConfig.AA50_SPD, _bullet_surface(), _fx, _director)
	get_parent().add_child(b)
	b.look_at(b.position + dir, Vector3.UP)


## Mira por FASES (port de weapons-v1.js#stepLockPhase): a caixa aparece na
## aquisição; ciclo amarelo(1,5 s, 50%) → vermelho(1,5 s, 80%) → amarelo(1,5 s,
## 50%); solta no fim do ciclo ou no 5º míssil. Quebra de feixe CONGELA a fase
## por até AA_LOCK_HOLD s; depois o ciclo reinicia no novo candidato.
func _update_lock(dt: float) -> void:
	if _director == null:
		_reset_lock()
		return
	if _lock_target != null and (not is_instance_valid(_lock_target) or _lock_target.dead):
		_reset_lock() # alvo morreu: ciclo reinicia (web resetLock)
	var candidate := _pick_lock_candidate()
	if candidate != _lock_target:
		if _lock_target != null and _hold_t < GameConfig.AA_LOCK_HOLD:
			_hold_t += dt # carência: fase congelada, mira mantida
		else:
			_lock_target = candidate
			_phase_t = 0.0
			_shots_fired = 0
			_hold_t = 0.0
	elif _lock_target != null:
		_hold_t = 0.0
		var prev_phase := _phase_index()
		_phase_t += dt
		if _phase_t >= GameConfig.LOCK_PHASE_S * 3.0 or _shots_fired >= GameConfig.LOCK_MAX_SHOTS:
			_reset_lock()
		elif prev_phase != 1 and _phase_index() == 1:
			# Entrada na fase VERMELHA: chaff/flare + evasão dura (web:930-933)
			if _lock_target.has_method("start_evade"):
				_lock_target.call("start_evade")
	# Beeps por fase (web updateLockBeeps): 0,42 s amarelo / 0,22 s vermelho.
	# Wave M4: bem mais suave e grave (−22 dB, pitch 0,7) — informa sem irritar
	if _lock_target != null:
		_beep_t -= dt
		if _beep_t <= 0.0:
			var red := _phase_index() == 1
			_beep_t = GameConfig.AAD_BEEP_RED if red else GameConfig.AAD_BEEP_YELLOW
			AudioManager.play("lock_on" if red else "lock_search", -22.0, 0.7)
	else:
		_beep_t = 0.0
	_emit_lock()


## Caça VIVO mais próximo dentro do cone ±12° (web pickLockTarget: distância,
## não ângulo — o quadrado aparece imediatamente na aquisição).
func _pick_lock_candidate() -> Node3D:
	var dir := aim_dir()
	var cone := deg_to_rad(GameConfig.AAMSL_LOCK_CONE_DEG)
	var best: Node3D = null
	var best_d2 := INF
	for f in _director.fighters:
		if not is_instance_valid(f) or f.dead:
			continue
		var to: Vector3 = f.global_position - global_position
		if dir.angle_to(to.normalized()) > cone:
			continue
		var d2 := to.length_squared()
		if d2 < best_d2:
			best_d2 = d2
			best = f
	return best


func _phase_index() -> int:
	return mini(int(_phase_t / GameConfig.LOCK_PHASE_S), 2)


func _hit_p() -> float:
	return GameConfig.LOCK_HIT_P[_phase_index()]


func _reset_lock() -> void:
	_lock_target = null
	_phase_t = 0.0
	_shots_fired = 0
	_hold_t = 0.0


func _emit_lock() -> void:
	if _lock_target == null:
		lock_progress.emit(null, 0.0, false)
	else:
		lock_progress.emit(_lock_target,
			clampf(_phase_t / (GameConfig.LOCK_PHASE_S * 3.0), 0.0, 1.0),
			_phase_index() == 1)


## Cadência do X: dispara se o cooldown zerou (qualquer fase permite o
## lançamento; o acerto sai do roll da fase — 50%/80%/50%).
func _try_fire_aa() -> bool:
	if _aa_cd > 0.0:
		return false
	if not _fire_aa_missile():
		return false
	_aa_cd = GameConfig.AAMSL_CADENCE
	return true


func _fire_aa_missile() -> bool:
	if aa_stock <= 0:
		return false
	aa_stock -= 1
	_reload_t = 0.0
	# K3: X SEMPRE dispara — com mira é homing (roll da fase + conta tiro);
	# sem mira sai reto (balístico, sem homing)
	var will_hit := true
	if _lock_target != null:
		_shots_fired += 1
		will_hit = randf() < _hit_p()
	var m := AaMissile.create(_pitch_pivot.to_global(Vector3(0, 0, -3.6)),
		aim_dir() * GameConfig.AAMSL_EXIT_SPD, _lock_target, _fx, _director,
		false, _bullet_surface(), will_hit)
	get_parent().add_child(m)
	AudioManager.play("missile", -12.0, 0.7)
	return true


## Míssil pesado (tier 'b' do web): com mira é homing (roll da fase + conta
## tiro); sem mira sai reto e vira BOMBA contra tropas (extensão do operador).
func _fire_heavy() -> bool:
	var will_hit := true
	if _lock_target != null:
		_shots_fired += 1
		will_hit = randf() < _hit_p()
	var m := AaMissile.create(_pitch_pivot.to_global(Vector3(0, 0, -3.6)),
		aim_dir() * GameConfig.AAMSL_EXIT_SPD, _lock_target, _fx, _director, true,
		_bullet_surface(), will_hit)
	get_parent().add_child(m)
	AudioManager.play("missile", -10.0, 0.7)
	return true


## Nuke tática (tecla T): arco + glide até o ponto de mira no terreno.
func _fire_nuke() -> bool:
	var n := DefenseNuke.create(_pitch_pivot.to_global(Vector3(0, 0, -3.6)),
		aim_dir(), _ground_aim_point(), _bullet_surface(), _fx, _director)
	get_parent().add_child(n)
	AudioManager.play("missile", -8.0, 0.65)
	return true


## Ponto onde o raio da mira encontra o terreno (web groundAimPoint — marcha
## de 25 m até 3 km sobre a grade rápida). Aim-assist (web defense-mode.js:
## 644-663): se a LINHA do raio passa a <250 m do centroide da horda, a mira
## retargeta para centroide + lead (marcha × tempo de voo rumo à cidade).
func _ground_aim_point() -> Vector3:
	var surf := _bullet_surface()
	var eye := _pitch_pivot.global_position
	var dir := aim_dir()
	if _director != null and _director.has_method("horde") and _director.horde() != null:
		var hc: Vector3 = _director.horde().centroid()
		# Wave M1: horda já DENTRO da cidade (≤400 m do centro) não recebe
		# aim-assist — a nuke nunca retargeta para o shelf urbano
		var city := Vector2(GameConfig.AA_LOOK_AT.x, GameConfig.AA_LOOK_AT.y)
		if Vector2(hc.x, hc.z).distance_to(city) < GameConfig.HORDE_AIM_ASSIST_CITY_R:
			pass # mira segue o raio do jogador (chão à frente), sem retarget
		else:
			var along: float = (hc - eye).dot(dir)
			if along > 0.0 and (eye + dir * along).distance_to(hc) < GameConfig.HORDE_AIM_ASSIST_R:
				var dc := Vector3(GameConfig.AA_LOOK_AT.x, 0, GameConfig.AA_LOOK_AT.y) - hc
				var dl := Vector2(dc.x, dc.z).length()
				if dl > 0.01:
					var flight_t := GameConfig.AAD_NUKE_ARC_S + dl / GameConfig.AAD_NUKE_SPD
					return hc + dc / dl * (GameConfig.HORDE_SPEED * flight_t)
	var p := eye
	for i in 120:
		p += dir * 25.0
		if surf.is_valid() and p.y <= float(surf.call(p.x, p.z)):
			break
	if surf.is_valid():
		return Vector3(p.x, surf.call(p.x, p.z), p.z)
	return p


## Dano ao artilheiro (míssil ≤26 m, tracer de rajada ≤2,5 m).
func hit(damage: int = 1) -> void:
	hp -= damage
	_regen_t = 0.0
	hp_changed.emit(hp)
	player_hit.emit()
	if hp <= 0:
		lives -= 1
		if _fx:
			_fx.explosion(global_position, 2.0)
		if lives <= 0:
			GameState.game_over.emit("BATERIA DESTRUÍDA")
		else:
			hp = GameConfig.AA_HP
			hp_changed.emit(hp)

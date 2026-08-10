class_name Jet
extends Node3D
## Jet — caça do jogador. Port fiel do modelo de voo arcade do web-game
## (player.js#updatePlayer): modelo de energia, stall, auto-trim, roll+yaw
## coordenado, decolagem/pouso, mayday, afundamento.
## A "verdade de superfície" vem de InhaumaMap.surface_height (mesh == colisão).

signal crashed(reason: String)
signal landed
signal mayday_started
signal respawned

enum State { TAKEOFF_ROLL, AIRBORNE, LANDING_ROLL, MAYDAY, SINKING }

var state: State = State.TAKEOFF_ROLL
var speed := 0.0
var throttle := 0.0
var stalled := false
var hp := GameConfig.P_HP_PER_LIFE
var invuln := 0.0
var mayday_timer := 0.0
var sinking_timer := 0.0

var _roll_timer := 0.0 # barrel roll
var _roll_dir := 1.0
var _roll_cooldown := 0.0
var _liftoff_carry := 0.0
var _liftoff_vsp := 0.0
var _pitch_spool := 0.0
var _rotate_spool := 0.0
var _surface: Callable # func(x, z) -> float — verdade de superfície
var _water_fn: Callable # func(x, z) -> float — cota do rio (-1 fora do canal)


func setup(surface_fn: Callable, water_fn: Callable = Callable()) -> void:
	_surface = surface_fn
	_water_fn = water_fn
	add_child(JetMesh.build())
	_cache_extras_refs()
	respawn()


## Refs dos extras do JetMesh resolvidas 1× (perf Wave B — _update_extras
## fazia ~6 get_node_or_null por tick de física).
func _cache_extras_refs() -> void:
	var jet_mesh := get_node_or_null("JetMesh")
	if jet_mesh == null:
		return
	_n_plume = jet_mesh.get_node_or_null("Afterburner")
	_n_glow = jet_mesh.get_node_or_null("ExhGlow")
	_n_flame = jet_mesh.get_node_or_null("ExhFlame")
	_n_strobe = jet_mesh.get_node_or_null("Strobe")
	_n_gear = jet_mesh.get_node_or_null("Gear")
	_n_heavy = jet_mesh.get_node_or_null("LoadoutHeavy")
	_n_nuke = jet_mesh.get_node_or_null("LoadoutNuke")


func respawn() -> void:
	# Spawn no início da pista (zona de toque), heading 0 (nariz para -Z)
	var c := GameConfig.AIRPORT_TOUCHDOWN
	position = Vector3(c.x, 0.9, c.y + GameConfig.AIRPORT_TOUCHDOWN_SIZE.y * 0.5)
	rotation = Vector3.ZERO
	speed = 0.0
	throttle = 0.0
	hp = GameConfig.P_HP_PER_LIFE
	state = State.TAKEOFF_ROLL
	invuln = GameConfig.P_RESPAWN_INVULN
	mayday_timer = 0.0
	sinking_timer = 0.0
	_liftoff_carry = 0.0
	_liftoff_vsp = 0.0
	GameState.heavy_missiles = GameConfig.MSL_HEAVY_STOCK
	GameState.nukes = GameConfig.NUKE_STOCK
	GameState.rods = GameConfig.ROD_STOCK
	respawned.emit()


func _physics_process(delta: float) -> void:
	_update_extras()
	if not GameState.running or GameState.paused:
		return
	var dt := minf(delta, 0.1) # dt capado como no web
	invuln = maxf(0.0, invuln - dt)
	_roll_cooldown = maxf(0.0, _roll_cooldown - dt)
	match state:
		State.TAKEOFF_ROLL, State.LANDING_ROLL:
			_update_ground(dt)
		State.AIRBORNE:
			_update_airborne(dt)
		State.MAYDAY:
			_update_mayday(dt)
		State.SINKING:
			_update_sinking(dt)


## Pós-combustor (a partir de military) + strobe 1,2 Hz + trem de pouso
## retrátil + loadout visível conforme o estoque (player.js:225-254, 738-747).
func _update_extras() -> void:
	var dt := get_physics_process_delta_time()
	# Plume: visível a partir de military, cresce até o afterburner
	if _n_plume:
		var ab := throttle >= GameConfig.P_THROTTLE_MIL_MAX
		_n_plume.visible = ab
		if ab:
			var intensity := (throttle - GameConfig.P_THROTTLE_MIL_MAX) / (1.0 - GameConfig.P_THROTTLE_MIL_MAX)
			var s := 0.35 + intensity * 1.3
			_n_plume.scale = Vector3(s, s * (0.9 + randf() * 0.15), s)
	# Glow/chama do exaustor acompanham o throttle (sempre)
	var burn := 0.55 + throttle * 1.05
	if _n_glow:
		_n_glow.scale = Vector3(burn, burn, burn)
	if _n_flame:
		_n_flame.scale = Vector3(burn, burn, burn * (0.9 + randf() * 0.2))
	# Strobe 1,2 Hz
	if _n_strobe:
		_n_strobe.visible = sin(Time.get_ticks_msec() / 1000.0 * TAU * 1.2) > 0.8
	# Trem de pouso: estende abaixo de 16 m sobre a superfície (WS-4)
	if _n_gear and _surface.is_valid():
		var want_deployed: bool = position.y - _surface.call(position.x, position.z) < 16.0
		_gear_k = clampf(_gear_k + ((1.0 if want_deployed else 0.0) - _gear_k) * minf(1.0, dt * 3.2), 0.04, 1.0)
		_n_gear.scale.y = _gear_k
		_n_gear.position.y = (1.0 - _gear_k) * 0.34
		_n_gear.visible = _gear_k > 0.07
	# Loadout: pesados (2) e nuclear (1) somem conforme o estoque
	_loadout_t += dt
	if _loadout_t >= 0.5:
		_loadout_t = 0.0
		if _n_heavy:
			# Convenção do web: visible = i < ceil(stock/5) → 10:2, 5-9:1, 0-4:0
			_set_group_visible(_n_heavy, int(ceil(GameState.heavy_missiles / 5.0)))
		if _n_nuke:
			_n_nuke.visible = GameState.nukes > 0


var _gear_k := 1.0
var _loadout_t := 0.0
# Refs cacheadas dos extras do JetMesh (perf Wave B) — preenchidas em setup()
var _n_plume: Node3D
var _n_glow: Node3D
var _n_flame: Node3D
var _n_strobe: Node3D
var _n_gear: Node3D
var _n_heavy: Node3D
var _n_nuke: Node3D


## heavy tem 2 mísseis (cada ~4 filhos de mesh); mostra os primeiros `n`.
func _set_group_visible(group: Node3D, n_visible: int) -> void:
	# Convenção do web: visible = i < ceil(stock/5) → 10:2, 5-9:1, 0-4:0
	var per_missile := group.get_child_count() / 2
	for i in group.get_child_count():
		group.get_child(i).visible = i < n_visible * per_missile


# ---------------------------------------------------------------------------
# Solo (corrida de decolagem / rolagem de pouso)
# ---------------------------------------------------------------------------
func _update_ground(dt: float) -> void:
	if Input.is_action_pressed("throttle_up"):
		throttle = minf(1.0, throttle + dt * GameConfig.P_THROTTLE_UP)
	if Input.is_action_pressed("throttle_down"):
		throttle = maxf(GameConfig.P_THROTTLE_FLOOR_GROUND, throttle - dt * GameConfig.P_THROTTLE_DOWN)
	# Spool-down suave na rolagem de pouso sem input
	if state == State.LANDING_ROLL and not Input.is_action_pressed("throttle_up") and throttle > 0.05:
		throttle += (0.05 - throttle) * minf(1.0, dt * 1.5)
	# Velocidade de solo converge para o throttle; na rolagem de pouso, freio
	var tgt := throttle * GameConfig.P_MAX_SPD
	if state == State.LANDING_ROLL and throttle <= 0.06:
		speed = maxf(0.0, speed - 12.0 * dt)
	else:
		speed += (tgt - speed) * minf(1.0, dt * GameConfig.P_SPD_CONVERGE)
	# Yaw no solo
	if Input.is_action_pressed("roll_left") or Input.is_action_pressed("yaw_left"):
		quaternion = Quaternion(Vector3.UP, GameConfig.P_COORD_YAW * GameConfig.P_GROUND_YAW * dt) * quaternion
	if Input.is_action_pressed("roll_right") or Input.is_action_pressed("yaw_right"):
		quaternion = Quaternion(Vector3.UP, -GameConfig.P_COORD_YAW * GameConfig.P_GROUND_YAW * dt) * quaternion
	position += -basis.z * speed * dt
	# Assentamento suave no piso (~0,3 s, amortecedor)
	var floor_y: float = _surface.call(position.x, position.z) + 0.9
	if _liftoff_vsp <= 0.0:
		var settle := 1.0 - exp(-dt * 7.0)
		position.y = maxf(floor_y, position.y + (floor_y - position.y) * settle)
	# Derrotação de atitude no solo (nariz/asas nivelam)
	if not Input.is_action_pressed("pitch_up") and not Input.is_action_pressed("pitch_down"):
		var e := quaternion.get_euler()
		if absf(e.x) > 0.002 or absf(e.z) > 0.002:
			var decay := maxf(0.0, 1.0 - 2.6 * dt)
			e.x *= decay
			e.z *= decay
			quaternion = Quaternion.from_euler(e)
	# Rotação de decolagem: >= V_ROTATE + input de pitch (↑ OU ↓)
	if state == State.TAKEOFF_ROLL and speed >= GameConfig.P_V_ROTATE \
			and (Input.is_action_pressed("pitch_up") or Input.is_action_pressed("pitch_down")):
		_pitch_spool = minf(1.0, _pitch_spool + dt / GameConfig.P_ROTATE_PITCH_SPOOL)
		quaternion = quaternion * Quaternion(basis.x.normalized(),
			GameConfig.P_PITCH_RATE * 0.35 * _pitch_spool * dt)
		_clamp_pitch()
		_liftoff_vsp += GameConfig.P_ROTATE_LIFT * dt
		position.y += _liftoff_vsp * dt
		_rotate_spool = minf(13.0, _rotate_spool + 26.0 * dt)
		speed = maxf(speed, minf(45.0, speed + _rotate_spool))
		if position.y - _surface.call(position.x, position.z) > GameConfig.P_LIFTOFF_ALT and _liftoff_vsp > 0.0:
			_liftoff_carry = _liftoff_vsp
			_liftoff_vsp = 0.0
			_pitch_spool = 0.0
			_rotate_spool = 0.0
			state = State.AIRBORNE
	# Fim da rolagem de pouso: parou → serviço → rearma e recoloca na pista
	if state == State.LANDING_ROLL and speed < 10.0:
		landed.emit()
		respawn()


# ---------------------------------------------------------------------------
# Voo (modelo de energia — player.js:615-707)
# ---------------------------------------------------------------------------
func _update_airborne(dt: float) -> void:
	if Input.is_action_pressed("throttle_up"):
		throttle = minf(1.0, throttle + dt * GameConfig.P_THROTTLE_UP)
	if Input.is_action_pressed("throttle_down"):
		throttle = maxf(GameConfig.P_THROTTLE_FLOOR_AIR, throttle - dt * GameConfig.P_THROTTLE_DOWN)
	var fwd := -basis.z
	var tgt := GameConfig.P_MIN_SPD + throttle * (GameConfig.P_MAX_SPD - GameConfig.P_MIN_SPD)
	tgt -= maxf(0.0, fwd.y - GameConfig.P_CLIMB_NOSE) * GameConfig.P_CLIMB_TRADE
	if position.y > GameConfig.P_CEILING:
		tgt *= maxf(0.35, 1.0 - (position.y - GameConfig.P_CEILING) / 2500.0)
	tgt = minf(tgt, GameConfig.P_MAX_SPD * GameConfig.P_DIVE_OVERSPEED)
	speed += (tgt - speed) * minf(1.0, dt * GameConfig.P_SPD_CONVERGE)
	speed = maxf(2.0, speed)
	stalled = speed < GameConfig.P_STALL_SPD
	var ctl := GameConfig.P_STALL_CTL if stalled else 1.0
	if stalled:
		quaternion = quaternion * Quaternion(basis.x.normalized(), -GameConfig.P_STALL_NOSE_DROP * dt)
		_clamp_pitch()
	# Pitch INVERTIDO (estilo simulador): pitch_up (↓/K) = nariz sobe.
	# Convenção Godot: +rotação em torno do X local = nariz sobe (frente -Z ganha +Y).
	if Input.is_action_pressed("pitch_up"):
		quaternion = quaternion * Quaternion(basis.x.normalized(), GameConfig.P_PITCH_RATE * ctl * dt)
	if Input.is_action_pressed("pitch_down"):
		quaternion = quaternion * Quaternion(basis.x.normalized(), -GameConfig.P_PITCH_RATE * ctl * dt)
	if Input.is_action_pressed("pitch_up") or Input.is_action_pressed("pitch_down"):
		_clamp_pitch()
	# Auto-trim
	elif not stalled and _roll_timer <= 0.0:
		var e := quaternion.get_euler()
		if absf(e.x) > 0.005:
			e.x *= maxf(0.0, 1.0 - GameConfig.P_AUTO_TRIM * dt)
			quaternion = Quaternion.from_euler(e)
	# Roll + yaw coordenado
	if Input.is_action_pressed("roll_left"):
		quaternion = quaternion * Quaternion(basis.z.normalized(), GameConfig.P_ROLL_RATE * ctl * dt)
		quaternion = Quaternion(Vector3.UP, GameConfig.P_COORD_YAW * ctl * dt) * quaternion
	if Input.is_action_pressed("roll_right"):
		quaternion = quaternion * Quaternion(basis.z.normalized(), -GameConfig.P_ROLL_RATE * ctl * dt)
		quaternion = Quaternion(Vector3.UP, -GameConfig.P_COORD_YAW * ctl * dt) * quaternion
	# Leme (yaw puro)
	if Input.is_action_pressed("yaw_left"):
		quaternion = Quaternion(Vector3.UP, GameConfig.P_COORD_YAW * GameConfig.P_RUDDER_FACTOR * dt) * quaternion
	if Input.is_action_pressed("yaw_right"):
		quaternion = Quaternion(Vector3.UP, -GameConfig.P_COORD_YAW * GameConfig.P_RUDDER_FACTOR * dt) * quaternion
	# Barrel roll (Shift): 0,5 s invencível, cooldown 1,5 s
	if Input.is_action_just_pressed("barrel_roll") and _roll_timer <= 0.0 and _roll_cooldown <= 0.0:
		_roll_timer = GameConfig.P_BARREL_TIME
		_roll_dir = -1.0 if Input.is_action_pressed("roll_right") else 1.0
		_roll_cooldown = GameConfig.P_BARREL_TIME + GameConfig.P_BARREL_COOLDOWN
	if _roll_timer > 0.0:
		_roll_timer -= dt
		quaternion = quaternion * Quaternion(basis.z.normalized(), (TAU / GameConfig.P_BARREL_TIME) * dt * _roll_dir)
	# Movimento: frente + gravidade/sustentação
	position += fwd * speed * dt
	position.y -= GameConfig.P_GRAVITY * dt
	if not stalled:
		var lift := minf(speed / (GameConfig.P_MIN_SPD * 2.5), 1.0)
		position.y += GameConfig.P_GRAVITY * lift * dt
		position.y += maxf(0.0, fwd.y) * speed * 0.42 * dt
	if _liftoff_carry > 0.01:
		position.y += _liftoff_carry * dt
		_liftoff_carry = maxf(0.0, _liftoff_carry - 11.0 * dt)
	_check_crash(dt)


func _check_crash(dt: float) -> void:
	var surf: float = _surface.call(position.x, position.z)
	# Rio: abaixo da lâmina d'água do canal → afunda
	if _water_fn.is_valid():
		var wl: float = _water_fn.call(position.x, position.z)
		if wl >= 0.0 and position.y < wl:
			state = State.SINKING
			sinking_timer = 4.2
			crashed.emit("water")
			return
	# "Mar": só fora da área do aeródromo (a clareira é cota 0 MAS NÃO é água —
	# sem este guarda o jato "afundava" ao pousar na própria pista)
	if position.y < GameConfig.P_WATER_Y and surf <= 0.5 and not _over_airport():
		state = State.SINKING
		sinking_timer = 4.2
		crashed.emit("water")
		return
	# Terreno: contato abaixo da margem de segurança
	if position.y < surf + 0.9:
		# climb > 0 = subindo; sink = quão rápido desce (m/s)
		var climb: float = -basis.z.y * speed
		var e := quaternion.get_euler()
		if _on_pavement() and speed <= GameConfig.P_LAND_MAX_SPD and climb > GameConfig.P_SINK_CRASH \
				and absf(e.z) < 0.6:
			# Pouso seguro → rolagem
			state = State.LANDING_ROLL
			position.y = surf + 0.9
			e.x = 0.0
			e.z = 0.0
			quaternion = Quaternion.from_euler(e)
			return
		if climb < GameConfig.P_SINK_CATASTROPHIC or absf(e.z) > GameConfig.P_CATASTROPHIC_ROLL:
			_start_mayday(true)
			return
		# Contato com montanha → mayday (missionRealism sempre ativo)
		_start_mayday(false)
		return


## Verdadeiro se sobre pavimento do aeródromo (pista/taxiway/serviço).
func _on_pavement() -> bool:
	var x := position.x
	var z := position.z
	var c := GameConfig.AIRPORT_POS
	if absf(x - c.x) <= GameConfig.AIRPORT_RUNWAY.x * 0.5 + 4.0 \
			and absf(z - c.y) <= GameConfig.AIRPORT_RUNWAY.y * 0.5 + 4.0:
		return true
	var t := GameConfig.AIRPORT_TAXIWAY
	if absf(x - t.x) <= 19.0 and absf(z - t.y) <= 84.0:
		return true
	var s := GameConfig.AIRPORT_SERVICE
	if absf(x - s.x) <= GameConfig.AIRPORT_SERVICE_SIZE.x * 0.5 + 4.0 \
			and absf(z - s.y) <= GameConfig.AIRPORT_SERVICE_SIZE.y * 0.5 + 4.0:
		return true
	return false


## Verdadeiro dentro da zona de clareira do aeródromo (retângulo + feather).
func _over_airport() -> bool:
	var b := InhaumaHeightmap.AIRPORT_BOUNDS.grow(InhaumaHeightmap.AIRPORT_CLEAR_OUTER)
	return b.has_point(Vector2(position.x, position.z))


func _start_mayday(fatal: bool) -> void:
	state = State.MAYDAY
	mayday_timer = 0.0
	invuln = 0.0
	mayday_started.emit()
	if fatal:
		mayday_timer = 999.0 # explosão imediata no primeiro update de mayday


func _update_mayday(dt: float) -> void:
	# Tumble progressivo + queda (player.js:573-612)
	var spin := 0.8 + maxf(0.0, (80.0 - position.y) / 80.0) * 1.8
	rotate_x((randf() - 0.4) * spin * dt)
	rotate_z((randf() - 0.5) * spin * dt)
	speed = maxf(8.0, speed - 20.0 * dt)
	position += -basis.z * speed * dt
	position.y -= GameConfig.P_GRAVITY * 4.0 * dt
	var surf: float = _surface.call(position.x, position.z)
	var grounded := false
	if position.y <= surf + 0.6:
		position.y = surf + 0.6
		grounded = true
		speed = maxf(6.0, speed - 35.0 * dt)
	mayday_timer += dt
	# Ejeção (J): antecipa o impacto
	if Input.is_action_just_pressed("eject"):
		mayday_timer = GameConfig.P_MAYDAY_MIN_FALL
	if grounded and mayday_timer >= GameConfig.P_MAYDAY_MIN_FALL:
		_lose_life("crash")


func _update_sinking(dt: float) -> void:
	sinking_timer -= dt
	speed = maxf(0.0, speed - 28.0 * dt)
	position += -basis.z * speed * dt * 0.35
	position.y = maxf(position.y - 1.1 * dt, -3.4)
	rotate_x(0.10 * dt)
	if sinking_timer <= 0.0:
		_lose_life("sank")


func _lose_life(reason: String) -> void:
	GameState.lives -= 1
	if GameState.lives <= 0:
		GameState.game_over.emit(reason)
		return
	respawn()


## Dano externo (balas/mísseis inimigos). Retorna true se o hit contou.
func hit(damage: int = 1) -> bool:
	if invuln > 0.0 or _roll_timer > 0.0 or state == State.MAYDAY:
		return false
	hp -= damage
	AudioManager.play("hit", -4.0)
	if hp <= 0:
		_start_mayday(false)
	else:
		invuln = GameConfig.P_HIT_INVULN
	return true


func _clamp_pitch() -> void:
	var e := quaternion.get_euler()
	e.x = clampf(e.x, GameConfig.P_PITCH_MIN, GameConfig.P_PITCH_MAX)
	quaternion = Quaternion.from_euler(e)


## Velocidade vetorial atual (herança de velocidade para projéteis).
func velocity_hint() -> Vector3:
	return -basis.z * speed

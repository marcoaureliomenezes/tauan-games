class_name AaMissile
extends Node3D
## AaMissile — míssil antiaéreo com navegação proporcional (port de
## turret-weapons.js): PN N=3, 220 m/s, aceleração lateral capada em 55 m/s²,
## saída do tubo a 60 m/s, vida 8 s (autodestruição = miss), espoleta de
## proximidade 6 m. T-W-08: will_hit=false mira num offset perpendicular 4-9 m
## (quase-acerto) e nunca aplica dano; órfãos retargetam no cone de 60°.

var velocity := Vector3.ZERO
var life := GameConfig.AAMSL_LIFE
var target: Node3D = null
var will_hit := true
var _miss_offset := Vector3.ZERO
var _fx: FxManager
var _director: Node
var _prev_los := Vector3.ZERO
var _heavy := false
var _trail_t := 0.0
var _glow_t := 0.0
var _surface: Callable


static func create(pos: Vector3, vel: Vector3, p_target: Node3D, fx: FxManager,
		director: Node, heavy := false, surface_fn := Callable(), will_hit := true) -> AaMissile:
	var m := AaMissile.new()
	m.position = pos
	m.velocity = vel
	m.target = p_target
	m.will_hit = will_hit
	m._fx = fx
	m._director = director
	m._heavy = heavy
	m._surface = surface_fn
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.18
	mesh.bottom_radius = 0.18
	mesh.height = 2.6
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.rotation_degrees.x = 90
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.8, 0.82, 0.85)
	if heavy: # tier 'b': 1,5× e corpo escuro 0x4a4a52 (web)
		mi.scale = Vector3.ONE * GameConfig.AAHV_SCALE
		mat.albedo_color = Color8(0x4a, 0x4a, 0x52)
	mi.material_override = mat
	m.add_child(mi)
	if p_target:
		m._prev_los = (p_target.global_position - pos).normalized()
	# MISS rolado (T-W-08): offset perpendicular à linha de tiro, 4–9 m
	if not will_hit and p_target:
		var t2 := Vector2(p_target.global_position.x - pos.x,
			p_target.global_position.z - pos.z)
		var perp := Vector2(-t2.y, t2.x)
		if perp.length() < 0.01:
			perp = Vector2(1, 0)
		else:
			perp = perp.normalized()
		var mag := randf_range(GameConfig.LOCK_MISS_OFFSET_MIN, GameConfig.LOCK_MISS_OFFSET_MAX)
		var side := -1.0 if randf() < 0.5 else 1.0
		m._miss_offset = Vector3(perp.x * mag * side,
			(randf() - 0.3) * mag * 0.6, perp.y * mag * side)
	return m


func _physics_process(delta: float) -> void:
	var dt := minf(delta, 0.1)
	life -= dt
	if life <= 0.0:
		_bomb_ground()
		if _fx:
			_fx.explosion(global_position, 0.5)
		queue_free()
		return
	# Esteira de fumaça em TODO míssil + brilho da cabeça (K4/M3 — a trilha TEM
	# que se ler da bateria a 2+ km; carência de 0,4 s p/ não empilhar no cano)
	_trail_t -= dt
	if _trail_t <= 0.0 and GameConfig.AAMSL_LIFE - life > 0.4:
		_trail_t = 0.06 # puffs espaçados ~13 m no cruzeiro — fita tracejada (M3)
		if _fx:
			_fx.trail_puff(global_position)
	_glow_t -= dt
	if _glow_t <= 0.0:
		_glow_t = 0.10
		if _fx:
			_fx.muzzle_flash(global_position, 1.2 if _heavy else 0.9)
	# Órfão (alvo morreu): retarget ao vivo mais próximo no cone de ~60°
	if target != null and (not is_instance_valid(target) or target.dead):
		target = _pick_retarget()
		_miss_offset = Vector3.ZERO # homing limpo no novo alvo (web T-W-03)
		will_hit = true
	if is_instance_valid(target) and not target.dead:
		# PN mira no ponto deslocado quando o roll deu MISS
		var aim: Vector3 = target.global_position + _miss_offset
		var los := (aim - global_position).normalized()
		var los_rate := (los - _prev_los) / maxf(dt, 0.0001)
		_prev_los = los
		# PN: aceleração lateral comandada = N * Vc * componente perpendicular de los_rate
		var closing := maxf(0.0, -velocity.normalized().dot(-los)) * velocity.length()
		var accel := GameConfig.AAMSL_PN_N * closing * (los_rate - los * los_rate.dot(los))
		if accel.length() > GameConfig.AAMSL_LATERAL_CAP:
			accel = accel.normalized() * GameConfig.AAMSL_LATERAL_CAP
		velocity += accel * dt
		velocity = velocity.normalized() * minf(velocity.length() + 200.0 * dt, GameConfig.AAMSL_SPD)
		# Espoleta de proximidade (ao ponto de mira — MISS nunca aplica dano)
		if global_position.distance_to(aim) < GameConfig.AAMSL_PROX_R:
			if will_hit:
				target.damage(999) # 1 míssil AA mata
			_bomb_ground()
			if _fx:
				_fx.explosion(global_position, 1.5)
			queue_free()
			return
		# MISS que já passou do alvo: autodestruição 0,6 s depois (quase-acerto)
		if not will_hit and life > 0.6:
			var to: Vector3 = target.global_position - global_position
			if to.dot(velocity) < 0.0:
				life = 0.6
	position += velocity * dt
	if velocity.length_squared() > 0.01:
		look_at(global_position + velocity.normalized(), Vector3.UP)
	# Bomba pesada: impacto em terra = wipe de tropas em 25 m (extensão do operador)
	if _heavy and _surface.is_valid() \
			and position.y <= float(_surface.call(position.x, position.z)) + 1.5:
		_bomb_ground()
		if _fx:
			_fx.explosion(global_position, 2.0)
		queue_free()


## Vivo mais próximo dentro do cone à frente do vetor velocidade (~60°).
func _pick_retarget() -> Node3D:
	if _director == null:
		return null
	var best: Node3D = null
	var best_d2 := INF
	var vm := velocity.length()
	for f in _director.fighters:
		if not is_instance_valid(f) or f.dead:
			continue
		var to: Vector3 = f.global_position - global_position
		var d2 := to.length_squared()
		if d2 < 0.001:
			continue
		if vm > 0.001 and velocity.normalized().angle_to(to.normalized()) > GameConfig.AAMSL_RETARGET_CONE:
			continue
		if d2 < best_d2:
			best_d2 = d2
			best = f
	return best


## Wipe de unidades da horda no raio da bomba (só pesada — a .50 e o AA leve
## continuam anti-aéreos puros, paridade com o web).
func _bomb_ground() -> void:
	if _heavy and _director != null and _director.has_method("horde") \
			and _director.horde() != null:
		_director.horde().kill_within(global_position, GameConfig.HORDE_BOMB_R)

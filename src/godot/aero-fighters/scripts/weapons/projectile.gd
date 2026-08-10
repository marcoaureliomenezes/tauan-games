class_name Projectile
extends Node3D
## Projectile — bala de canhão, míssil guiado, nuke ou rod cinético.
## Port de projectiles.js + rod-missiles.js: homing por lerp de velocidade,
## hit-roll 80% (miss = near-miss sem dano), re-target, proximidade por hit_r.

signal impacted(projectile: Projectile, pos: Vector3)

enum Kind { BULLET, LIGHT, HEAVY, NUKE, ROD }

var kind: Kind = Kind.BULLET
var velocity := Vector3.ZERO
var life := 2.0
var damage := 1.0
var target: Target = null
var will_hit := true
var chain: Array[Target] = [] # rod: fila de alvos perfurados
var turn_rate := 0.0
var turn_close := 0.0
var tracking_spd := 0.0

var _miss_offset := Vector3.ZERO
var _smoke_t := 0.0
var _surface: Callable
var _fx: FxManager


static func bullet(pos: Vector3, vel: Vector3) -> Projectile:
	var p := Projectile.new()
	p.kind = Kind.BULLET
	p.velocity = vel
	p.life = GameConfig.CANNON_LIFE
	p.damage = GameConfig.CANNON_DAMAGE
	p.position = pos
	p.add_child(p._tracer_mesh(Color(1.0, 0.85, 0.4), 0.12, 2.2))
	return p


static func missile(p_kind: Kind, pos: Vector3, vel: Vector3, p_target: Target) -> Projectile:
	var p := Projectile.new()
	p.kind = p_kind
	p.target = p_target
	p.position = pos
	match p_kind:
		Kind.LIGHT:
			p.life = GameConfig.MSL_LIGHT_LIFE
			p.damage = GameConfig.MSL_LIGHT_DAMAGE
			p.turn_rate = GameConfig.MSL_LIGHT_TURN
			p.turn_close = GameConfig.MSL_LIGHT_TURN_CLOSE
			p.tracking_spd = GameConfig.MSL_LIGHT_CRUISE
		Kind.HEAVY:
			p.life = GameConfig.MSL_HEAVY_LIFE
			p.damage = GameConfig.MSL_HEAVY_DAMAGE
			p.turn_rate = GameConfig.MSL_HEAVY_TURN
			p.turn_close = GameConfig.MSL_HEAVY_TURN_CLOSE
			p.tracking_spd = GameConfig.MSL_HEAVY_CRUISE
		Kind.NUKE:
			p.life = GameConfig.NUKE_LIFE
			p.damage = GameConfig.NUKE_DAMAGE
			p.turn_rate = GameConfig.NUKE_TURN
			p.turn_close = GameConfig.NUKE_TURN_CLOSE
			p.tracking_spd = GameConfig.NUKE_CRUISE
		Kind.ROD:
			p.life = 10.0
			p.damage = GameConfig.ROD_DAMAGE
			p.turn_rate = GameConfig.ROD_TURN
			p.turn_close = GameConfig.ROD_TURN
			p.tracking_spd = GameConfig.ROD_CRUISE
	p.velocity = vel
	# Hit-roll 80% (weapons-core.js) — decidido no disparo
	if p_kind in [Kind.LIGHT, Kind.HEAVY]:
		p.will_hit = randf() < GameConfig.MSL_HIT_ROLL
		if not p.will_hit and p_target:
			var off_dir := Vector3(randf_range(-1, 1), randf_range(0.2, 1), randf_range(-1, 1)).normalized()
			p._miss_offset = off_dir * p_target.hit_r * randf_range(
				GameConfig.MSL_NEARMISS_MIN, GameConfig.MSL_NEARMISS_MAX)
	var color: Color = {Kind.LIGHT: Color(0.7, 0.75, 0.8), Kind.HEAVY: Color(0.55, 0.55, 0.6),
		Kind.NUKE: Color(0.3, 0.7, 0.3), Kind.ROD: Color(0.9, 0.6, 0.2)}[p_kind]
	p.add_child(p._tracer_mesh(color, 0.35, 3.0))
	return p


func setup(surface_fn: Callable, fx: FxManager) -> void:
	_surface = surface_fn
	_fx = fx


func _physics_process(delta: float) -> void:
	var dt := minf(delta, 0.1)
	life -= dt
	if life <= 0.0:
		_impact(global_position, false)
		return
	if kind == Kind.BULLET:
		_update_bullet(dt)
	else:
		_update_missile(dt)


func _update_bullet(dt: float) -> void:
	position += velocity * dt
	if _hit_targets(damage):
		return
	if _surface.is_valid() and position.y < _surface.call(position.x, position.z):
		_impact(global_position, true)


func _update_missile(dt: float) -> void:
	# Re-target se o alvo morreu (projectiles.js:344-354)
	if target == null or target.dead:
		var near: Target = null
		var nd := INF
		for e in GameState.targets:
			if e.dead:
				continue
			var d: float = global_position.distance_squared_to(e.global_position)
			if d < nd:
				nd = d
				near = e
		if near != target:
			_miss_offset = Vector3.ZERO
		target = near
	if target:
		var dist := global_position.distance_to(target.global_position)
		# HIT-rolled sempre usa o turn agressivo; MISS usa boost só de perto
		var turn: float = turn_close if will_hit else (turn_close if dist < GameConfig.MSL_LIGHT_CLOSE_R else turn_rate)
		var aim := target.global_position + _miss_offset
		var desired := (aim - global_position).normalized() * tracking_spd
		velocity = velocity.lerp(desired, minf(1.0, turn * dt * 60.0))
		# MISS-rolled: passou do alvo → encurta a vida (quase-acerto visível)
		if not will_hit:
			var approaching: bool = (target.global_position - global_position).dot(velocity) > 0.0
			if not approaching and life > 0.6:
				life = 0.6
	position += velocity * dt
	if velocity.length_squared() > 0.01:
		look_at(global_position + velocity.normalized(), Vector3.UP)
	# Trilha de fumaça
	_smoke_t -= dt
	if _smoke_t <= 0.0:
		_smoke_t = GameConfig.MSL_HEAVY_SMOKE_INTERVAL if kind == Kind.HEAVY else GameConfig.MSL_SMOKE_INTERVAL
		if _fx:
			_fx.smoke_puff(global_position)
	# Proximidade do alvo — dano só para HIT-rolled (gate incondicional)
	if target and not target.dead and will_hit:
		if global_position.distance_to(target.global_position) < target.hit_r + 2.0:
			target.damage(damage)
			if kind == Kind.ROD and not chain.is_empty():
				# Rod perfura: próximo alvo da cadeia
				target = chain.pop_front()
				will_hit = true
				return
			_impact(global_position, true)
			return
	if kind == Kind.NUKE and _surface.is_valid() and position.y < _surface.call(position.x, position.z) + 2.0:
		_impact(global_position, true)
		return
	if _surface.is_valid() and position.y < _surface.call(position.x, position.z):
		_impact(global_position, true)


func _hit_targets(dmg: float) -> bool:
	for e in GameState.targets:
		if e.dead:
			continue
		if global_position.distance_squared_to(e.global_position) < (e.hit_r + 1.0) ** 2:
			e.damage(dmg)
			_impact(global_position, true)
			return true
	return false


func _impact(pos: Vector3, visual: bool) -> void:
	if visual and _fx:
		match kind:
			Kind.NUKE:
				# Pipeline nuclear completo (nuclear-fx.js) — flash duplo, fireball
				# FBM, cogumelo 60 s, shockwaves, cratera, firestorm. O dano fica
				# em _nuke_area_damage (constantes inalteradas: blast 760, 4000).
				NuclearFx.detonate(get_parent(), pos, _surface)
				_nuke_area_damage(pos)
			Kind.HEAVY:
				_fx.explosion(pos, GameConfig.MSL_HEAVY_EXPLOSION_SCALE)
			Kind.BULLET:
				pass # poeira de impacto: v0.2
			_:
				_fx.explosion(pos, 0.8)
	impacted.emit(self, pos)
	queue_free()


func _nuke_area_damage(pos: Vector3) -> void:
	# Dano com decaimento linear até a borda do raio
	for e in GameState.targets.duplicate():
		var d: float = pos.distance_to(e.global_position)
		if d < GameConfig.NUKE_RADIUS:
			e.damage(GameConfig.NUKE_DAMAGE * (1.0 - d / GameConfig.NUKE_RADIUS))
	# Consequências no jogador
	var player: Node3D = GameState.player
	if player:
		var dp: float = pos.distance_to(player.global_position)
		if dp < GameConfig.NUKE_PLAYER_KILL_R and player.has_method("hit"):
			player.hit(999)
		elif dp < GameConfig.NUKE_PLAYER_LIFE_R and player.has_method("hit"):
			player.hit(GameConfig.P_HP_PER_LIFE)


# Cache de mesh+material de tracers (perf Wave B): um CylinderMesh e um
# StandardMaterial3D por (cor, raio, comprimento), compartilhados por TODAS
# as balas/mísseis — antes cada projétil alocava os dois (25+/s no canhão).
static var _tracer_cache := {}


func _tracer_mesh(color: Color, radius: float, length: float) -> MeshInstance3D:
	var key := "%s_%s_%s" % [color.to_html(), radius, length]
	if not _tracer_cache.has(key):
		var mesh := CylinderMesh.new()
		mesh.top_radius = radius
		mesh.bottom_radius = radius
		mesh.height = length
		var mat := StandardMaterial3D.new()
		mat.albedo_color = color
		mat.emission_enabled = true
		mat.emission = color
		mat.emission_energy_multiplier = 3.0
		_tracer_cache[key] = [mesh, mat]
	var mi := MeshInstance3D.new()
	mi.mesh = _tracer_cache[key][0]
	mi.rotation_degrees.x = 90
	mi.material_override = _tracer_cache[key][1]
	return mi

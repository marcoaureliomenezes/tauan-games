class_name EnemyOrdnance
extends Node3D
## EnemyOrdnance — míssil ar-solo inimigo (port de enemy-ordnance.js): arco
## balístico (135 m/s, g=12) → mergulho terminal guiado a 260 m do alvo;
## raio de impacto 9 m; cidade = -5% integridade; bateria aliada = 8 de dano;
## jogador = 1 HP se ≤26 m. Interceptável pela .50 (raio 4 m, +250 pts).

var dead := false
var anti_player := false
var target_pos := Vector3.ZERO
var target_kind := "city"
var battery_ref: Node3D = null
var velocity := Vector3.ZERO
var life := GameConfig.AAORD_LIFE

var _surface: Callable
var _fx: FxManager
var _trail_t := 0.0
var _glow_t := 0.0


static func create(from: Vector3, p_target: Vector3, kind: String, battery: Node3D,
		surface_fn: Callable, fx: FxManager) -> EnemyOrdnance:
	var o := EnemyOrdnance.new()
	o.position = from
	o.target_pos = p_target
	o.target_kind = kind
	o.battery_ref = battery
	o.anti_player = kind == "player"
	o._surface = surface_fn
	o._fx = fx
	# Lançamento balístico: velocidade horizontal rumo ao alvo + componente vertical
	var flat := Vector3(p_target.x - from.x, 0, p_target.z - from.z)
	o.velocity = flat.normalized() * GameConfig.AAORD_SPD * 0.8 + Vector3(0, GameConfig.AAORD_SPD * 0.5, 0)
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.3
	mesh.bottom_radius = 0.3
	mesh.height = 3.0
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.rotation_degrees.x = 90
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.45, 0.4, 0.35)
	# Ponta quente emissiva (Wave M2 — o míssil inimigo TEM que se ver vindo)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.45, 0.15)
	mat.emission_energy_multiplier = 0.9
	mi.material_override = mat
	o.add_child(mi)
	return o


func _physics_process(delta: float) -> void:
	var dt := minf(delta, 0.1)
	life -= dt
	if life <= 0.0:
		_explode()
		return
	var to_target := target_pos - global_position
	# Mergulho terminal guiado a 260 m do alvo
	if to_target.length() < GameConfig.AAORD_TERMINAL_ALT:
		velocity = velocity.lerp(to_target.normalized() * GameConfig.AAORD_SPD * 1.4,
			minf(1.0, 2.5 * dt))
	else:
		velocity.y -= GameConfig.AAORD_G * dt
	position += velocity * dt
	# Esteira de fumaça + brilho da cabeça (Wave L2/M2 — TODA míssil/ordenança
	# deixa rastro contínuo e cabeça quente, legível da bateria a 500-2500 m)
	_trail_t -= dt
	if _trail_t <= 0.0:
		_trail_t = 0.06
		if _fx:
			_fx.trail_puff(global_position)
	_glow_t -= dt
	if _glow_t <= 0.0:
		_glow_t = 0.10
		if _fx:
			_fx.muzzle_flash(global_position, 0.85)
	if velocity.length_squared() > 0.01:
		look_at(global_position + velocity.normalized(), Vector3.UP)
	if position.y <= target_pos.y + 1.0 or to_target.length() < GameConfig.AAORD_IMPACT_R:
		_explode()


func _explode() -> void:
	if dead:
		return
	dead = true
	if _fx:
		_fx.explosion(global_position, 1.8)
	match target_kind:
		"city":
			# -5% de integridade de Inhaúma por impacto
			GameState.city_integrity = maxf(0.0, GameState.city_integrity - GameConfig.AAORD_CITY_DAMAGE)
			if GameState.city_integrity <= 0.0:
				GameState.game_over.emit("INHAÚMA CAIU")
		"battery":
			if is_instance_valid(battery_ref):
				battery_ref.damage(GameConfig.AAORD_BATTERY_DAMAGE)
		"player":
			var turret: Node3D = GameState.player
			if turret and global_position.distance_to(turret.global_position) <= GameConfig.AA_PLAYER_HIT_R:
				turret.hit(1)
	queue_free()


## Interceptado pela .50 do jogador.
func intercept() -> void:
	if dead:
		return
	dead = true
	if _fx:
		_fx.explosion(global_position, 1.0)
	queue_free()

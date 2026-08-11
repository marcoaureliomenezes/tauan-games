class_name Aa50Bullet
extends Node3D
## Aa50Bullet — bala .50 balística (port de turret-weapons.js): 450 m/s, queda
## 3,5 m/s², alcance 1.200 m, dano 1. Acerta caças inimigos e intercepta
## mísseis anti-jogador (+250 pts). Poeira no impacto no terreno.

var velocity := Vector3.ZERO
var life := GameConfig.AA50_RANGE / GameConfig.AA50_SPD
var _surface: Callable
var _fx: FxManager
var _director: Node

static var _tracer_count := 0
# Mesh+material compartilhados por todas as balas .50 (perf Wave B — cache
# estático por variante, em vez de alocar CylinderMesh+material a cada tiro)
static var _tracer_cache := {}


static func create(pos: Vector3, dir: Vector3, speed: float, surface_fn: Callable,
		fx: FxManager, director: Node) -> Aa50Bullet:
	var b := Aa50Bullet.new()
	b.position = pos
	b.velocity = dir * speed
	b._surface = surface_fn
	b._fx = fx
	b._director = director
	# Tracer 1-em-4 maior (mistura do web)
	_tracer_count += 1
	var big := _tracer_count % GameConfig.AA50_TRACER_MIX == 0
	var key := "big" if big else "small"
	if not _tracer_cache.has(key):
		var mesh := CylinderMesh.new()
		mesh.top_radius = 0.25 if big else 0.1
		mesh.bottom_radius = mesh.top_radius
		mesh.height = 3.5 if big else 2.0
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(1.0, 0.75, 0.3)
		mat.emission_enabled = true
		mat.emission = Color(1.0, 0.65, 0.2)
		mat.emission_energy_multiplier = 4.0
		_tracer_cache[key] = [mesh, mat]
	var mi := MeshInstance3D.new()
	mi.mesh = _tracer_cache[key][0]
	mi.rotation_degrees.x = 90
	mi.material_override = _tracer_cache[key][1]
	b.add_child(mi)
	return b


func _physics_process(delta: float) -> void:
	var dt := minf(delta, 0.1)
	life -= dt
	if life <= 0.0:
		queue_free()
		return
	velocity.y -= GameConfig.AA50_GRAVITY * dt
	position += velocity * dt
	if _director == null:
		return
	# Caças inimigos
	for f in _director.fighters:
		if not is_instance_valid(f) or f.dead:
			continue
		if position.distance_squared_to(f.global_position) < 36.0: # ~6 m de raio
			f.damage(GameConfig.AA50_DAMAGE)
			queue_free()
			return
	# Interceptação de mísseis anti-jogador (+250 pts, raio 4 m)
	for o in _director.ordnance:
		if not is_instance_valid(o) or o.dead or not o.anti_player:
			continue
		if position.distance_squared_to(o.global_position) < GameConfig.AAORD_INTERCEPT_R ** 2:
			o.intercept()
			GameState.score += GameConfig.AA_SCORE_INTERCEPT
			queue_free()
			return
	# Terreno: poeira
	if _surface.is_valid() and position.y < _surface.call(position.x, position.z):
		if _fx:
			_fx.smoke_puff(position)
		queue_free()

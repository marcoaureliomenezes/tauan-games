class_name EnemyBullet
extends Node3D
## EnemyBullet — tracer de formação contra o jato (port do fogo inimigo de
## formation.js + balas legadas): linha reta, sem lead, 80 m/s, vida 4,5 s,
## acerto num raio de 2 m do jato (dano 1 HP). Pool simples por cena.

var velocity := Vector3.ZERO
var life := GameConfig.EF_LIFE
var _surface: Callable

static var _pool: Array[EnemyBullet] = []


static func fire_from(parent: Node3D, pos: Vector3, dir: Vector3, surface_fn: Callable) -> void:
	var b: EnemyBullet
	if _pool.is_empty():
		b = EnemyBullet.new()
		var mesh := CylinderMesh.new()
		mesh.top_radius = 0.15
		mesh.bottom_radius = 0.15
		mesh.height = 2.4
		var mi := MeshInstance3D.new()
		mi.mesh = mesh
		mi.rotation_degrees.x = 90
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(1.0, 0.5, 0.25)
		mat.emission_enabled = true
		mat.emission = Color(1.0, 0.45, 0.2)
		mat.emission_energy_multiplier = 3.0
		mi.material_override = mat
		b.add_child(mi)
	else:
		b = _pool.pop_back()
	parent.add_child(b)
	b._surface = surface_fn
	b.position = pos
	b.velocity = dir * GameConfig.EF_SPD
	b.life = GameConfig.EF_LIFE
	b.look_at(pos + dir, Vector3.UP)
	b.set_physics_process(true)


func _physics_process(delta: float) -> void:
	var dt := minf(delta, 0.1)
	life -= dt
	if life <= 0.0:
		_recycle()
		return
	position += velocity * dt
	# Acerto no jato (raio 2 m)
	var player: Node3D = GameState.player
	if player and player is Jet and player.state == Jet.State.AIRBORNE:
		if position.distance_squared_to(player.global_position) < GameConfig.ENEMY_BULLET_HIT_R ** 2:
			player.hit(GameConfig.ENEMY_BULLET_DAMAGE)
			_recycle()
			return
	# Impacto no terreno
	if _surface.is_valid() and position.y < _surface.call(position.x, position.z):
		_recycle()


func _recycle() -> void:
	set_physics_process(false)
	get_parent().remove_child(self)
	_pool.append(self)

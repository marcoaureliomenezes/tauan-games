## bullet.gd — Cannon bullet. RigidBody3D moving at 110 m/s, 2s lifespan.
extends RigidBody3D

const BULLET_SPD: float = 110.0
const BULLET_LIFE: float = 2.0
const PLAYER_DAMAGE: int = 1
const DAMAGE: int = 1

var _is_enemy: bool = false
var _lifetime: float = 0.0
var _direction: Vector3 = Vector3.FORWARD

func init(direction: Vector3, is_enemy: bool) -> void:
	_direction = direction.normalized()
	_is_enemy = is_enemy
	linear_velocity = _direction * BULLET_SPD
	gravity_scale = 0.0

func _ready() -> void:
	_build_mesh()
	_build_collision()
	# Bullets don't collide with each other
	collision_layer = 2  # projectile layer
	if _is_enemy:
		collision_mask = 8   # player layer
	else:
		collision_mask = 4   # target layer

func _physics_process(delta: float) -> void:
	_lifetime += delta
	if _lifetime >= BULLET_LIFE:
		queue_free()

func get_damage() -> int:
	return DAMAGE

func _on_body_entered(body: Node3D) -> void:
	if _is_enemy and body.has_method("apply_hit"):
		body.apply_hit()
	queue_free()

func _build_mesh() -> void:
	var mi = MeshInstance3D.new()
	var mesh = SphereMesh.new()
	mesh.radius = 0.08
	mesh.height = 0.3
	mi.mesh = mesh
	var mat = StandardMaterial3D.new()
	if _is_enemy:
		mat.albedo_color = Color(1.0, 0.314, 0.314)
		mat.emission_enabled = true
		mat.emission = Color(1.0, 0.2, 0.2) * 2.0
	else:
		mat.albedo_color = Color(1.0, 1.0, 0.9)
		mat.emission_enabled = true
		mat.emission = Color(1.0, 1.0, 0.8) * 3.0
	mi.material_override = mat
	add_child(mi)

func _build_collision() -> void:
	var shape = CollisionShape3D.new()
	var sphere = SphereShape3D.new()
	sphere.radius = 0.15
	shape.shape = sphere
	add_child(shape)
	connect("body_entered", _on_body_entered)

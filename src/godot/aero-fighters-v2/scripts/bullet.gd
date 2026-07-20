extends Area3D
# bullet.gd — Player cannon projectile.
# Implements FR-V2-G-05: 110 m/s, 2.0 s lifetime, pool-managed (visible=false when idle).
# Created as part of T-G-19 (Wave 4).

signal hit(target: Node)

const SPEED: float = 110.0      # m/s
const LIFETIME: float = 2.0     # seconds

var _active: bool = false
var _velocity: Vector3 = Vector3.ZERO
var _timer: float = 0.0


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	_deactivate()


func _physics_process(delta: float) -> void:
	if not _active:
		return
	_timer += delta
	if _timer >= LIFETIME:
		_deactivate()
		return
	global_position += _velocity * delta


# ────────────────────────────────────────────────────────────────────────────────
# Pool interface — called by cannon.gd
# ────────────────────────────────────────────────────────────────────────────────

func fire(pos: Vector3, direction: Vector3) -> void:
	global_position = pos
	_velocity = direction.normalized() * SPEED
	_timer = 0.0
	_active = true
	visible = true
	set_deferred("monitorable", true)
	set_deferred("monitoring", true)


func _deactivate() -> void:
	_active = false
	visible = false
	set_deferred("monitoring", false)
	set_deferred("monitorable", false)


# ────────────────────────────────────────────────────────────────────────────────
# Collision handler
# ────────────────────────────────────────────────────────────────────────────────

func _on_body_entered(body: Node) -> void:
	if not _active:
		return
	# Skip hits on player itself
	if body.is_in_group("player"):
		return
	# Damage target if it has take_damage
	if body.has_method("take_damage"):
		body.take_damage(1)
	hit.emit(body)
	_deactivate()

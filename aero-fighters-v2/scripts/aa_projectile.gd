extends Area3D
# aa_projectile.gd — AA gun dumb-fire projectile.
# Implements FR-V2-G-06: slow red projectile fired by AA guns at the player.
# Uses Area3D (same as Bullet) + velocity-driven movement.
# T-G-19 (Wave 4).

const SPEED: float = 80.0       # m/s — slower than player cannon
const LIFETIME: float = 4.0     # seconds
const DAMAGE: int = 1           # damage dealt to player per hit

var _velocity: Vector3 = Vector3.ZERO
var _timer: float = 0.0
var _launched: bool = false


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func launch(direction: Vector3) -> void:
	_velocity = direction.normalized() * SPEED
	_launched = true


func _physics_process(delta: float) -> void:
	if not _launched:
		return
	_timer += delta
	if _timer >= LIFETIME:
		queue_free()
		return
	global_position += _velocity * delta


func _on_body_entered(body: Node) -> void:
	if not _launched:
		return
	if body.is_in_group("player"):
		# Deal damage if the player exposes take_player_hit; otherwise flash HUD
		if body.has_method("take_player_hit"):
			body.take_player_hit(DAMAGE)
		else:
			# Placeholder: trigger HUD boundary warning as a visual flash
			var hud: Node = get_tree().root.find_child("HUD", true, false)
			if hud and hud.has_node("Control/BoundaryWarning"):
				var label: Label = hud.get_node("Control/BoundaryWarning")
				label.visible = true
				await get_tree().create_timer(0.3).timeout
				label.visible = false
		queue_free()
	elif not body.is_in_group("bullet"):
		# Hit terrain or static geometry
		queue_free()

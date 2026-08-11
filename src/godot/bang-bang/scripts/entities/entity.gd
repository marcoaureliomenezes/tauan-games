# entities.gd — entidades vivas do mundo (SPEC §6): bandidos, veados, cobras,
# águias, arqueiros das aldeias. Cada uma com sua state machine pequena.
# Base comum: CharacterBody3D + apply_damage (revólver/espingarda do combat.gd).
# class_name BangEntity (registro global evitado em modo -s)
extends CharacterBody3D

const GRAV := 18.0

var kind: StringName = &""
var hp := 1.0
var terrain: Node = null
var anim: AnimationPlayer = null
var state: StringName = &"idle"
var _cool := 0.0
var _dir := Vector3.ZERO
var _timer := 0.0

signal died(entity)

func _enter_tree() -> void:
	add_to_group("huntable")

func setup(p_terrain: Node) -> void:
	terrain = p_terrain

var _fling := Vector3.ZERO   # impulso do tiro (knockback no abate)

func apply_damage(dmg: float, _point: Vector3, impulse := Vector3.ZERO) -> void:
	# hp é medido em TIROS: pato 1, veado 5, bandido 3 (dinâmica de caça)
	hp -= dmg
	_fling = impulse
	if hp <= 0.0:
		_on_killed()

func _on_killed() -> void:
	state = &"dead"
	died.emit(self)

func _ground_to_terrain(dt: float) -> void:
	if terrain and terrain.has_method("height_at"):
		var gy: float = terrain.height_at(global_position.x, global_position.z)
		global_position.y = move_toward(global_position.y, gy, GRAV * dt * 2.0)

func _wander(dt: float, speed: float) -> void:
	_timer -= dt
	if _timer <= 0.0:
		_timer = randf_range(1.5, 4.0)
		var a := randf() * TAU
		_dir = Vector3(cos(a), 0, sin(a)) if randf() > 0.3 else Vector3.ZERO
	if _dir != Vector3.ZERO:
		velocity = _dir * speed
		rotation.y = atan2(-_dir.x, -_dir.z)
	else:
		velocity = Vector3.ZERO
	velocity.y = -GRAV * dt
	move_and_slide()
	_ground_to_terrain(dt)

func _flee_from(dt: float, threat: Vector3, speed: float) -> void:
	var away: Vector3 = (global_position - threat)
	away.y = 0
	if away.length_squared() < 0.01:
		away = Vector3(1, 0, 0)
	away = away.normalized()
	velocity = away * speed
	rotation.y = atan2(-away.x, -away.z)
	velocity.y = -GRAV * dt
	move_and_slide()
	_ground_to_terrain(dt)

func _play(clip: StringName) -> void:
	if anim and anim.has_animation(clip) and anim.current_animation != clip:
		anim.play(clip, 0.2)

# deer.gd — veado (SPEC §5): graze/flee; 1 tiro → carcaça (carregável [E]).
class_name BangDeer
extends "res://scripts/entities/entity.gd"

const FLEE_RANGE := 30.0
const FLEE_SPEED := 9.0

var carcass := false

var _panic := Vector3.ZERO
var _panic_t := 0.0
var _fling_t := 0.0

func _init() -> void:
	kind = &"deer"
	hp = 5.0   # 5 tiros para abater
	add_to_group("deer")

func apply_damage(dmg: float, point: Vector3, impulse := Vector3.ZERO) -> void:
	super.apply_damage(dmg, point, impulse)
	# o BANDO inteiro se espanta e corre junto
	var g = get_node_or_null("/root/Game")
	var threat: Vector3 = g.player["pos"] if g else point
	for d in get_tree().get_nodes_in_group("deer"):
		if d != self and d.global_position.distance_to(global_position) < 60.0:
			d.startle(threat)

func startle(threat: Vector3) -> void:
	if state == &"carcass":
		return
	_panic = threat
	_panic_t = 5.0

func _on_killed() -> void:
	state = &"carcass"
	carcass = true
	rotation.z = PI / 2   # caído de lado
	_play(&"AnimalArmature|Death")
	# knockback: o corpo é jogado para trás pelo tiro
	if _fling != Vector3.ZERO:
		velocity = _fling * 5.0 + Vector3(0, 2.5, 0)
		_fling_t = 0.45

func _physics_process(dt: float) -> void:
	if state == &"carcass":
		if _fling_t > 0.0:
			_fling_t -= dt
			velocity.y -= GRAV * dt
			move_and_slide()
		_ground_to_terrain(dt)
		return
	var g = get_node_or_null("/root/Game")
	var ppos: Vector3 = g.player["pos"] if g else Vector3(99999, 0, 99999)
	if _panic_t > 0.0:
		_panic_t -= dt
		_flee_from(dt, _panic, FLEE_SPEED)
		_play(&"AnimalArmature|Gallop")
	elif global_position.distance_to(ppos) < FLEE_RANGE:
		_flee_from(dt, ppos, FLEE_SPEED)
		_play(&"AnimalArmature|Gallop")
	else:
		_wander(dt, 1.2)
		_play(&"AnimalArmature|Eating")

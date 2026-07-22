# bandit.gd — bandido foragido (SPEC §6): wander → flee (<50 m) → surrender
# (1 tiro) → captured ([E] ≤4 m). 5 espalhados pelo mapa.
class_name BangBandit
extends "res://scripts/entities/entity.gd"

const FLEE_RANGE := 50.0
const FLEE_SPEED := 8.0
const CAPTURE_RANGE := 4.0

var captured := false

func _init() -> void:
	kind = &"bandit"
	hp = 3.0   # 3 tiros → rendição

func _on_killed() -> void:
	# bandido NÃO morre: rende-se (3 tiros → rendição)
	hp = 0.0
	state = &"surrender"
	_play(&"CharacterArmature|Wave")

func _physics_process(dt: float) -> void:
	if captured or state == &"dead":
		return
	var g = get_node_or_null("/root/Game")
	var ppos: Vector3 = g.player["pos"] if g else Vector3(99999, 0, 99999)
	match state:
		&"surrender":
			# parado, mãos ao alto — esperando captura
			velocity = Vector3.ZERO
			move_and_slide()
			_ground_to_terrain(dt)
			if global_position.distance_to(ppos) <= CAPTURE_RANGE and Input.is_action_just_pressed("interact"):
				_capture()
		_:
			if global_position.distance_to(ppos) < FLEE_RANGE:
				state = &"flee"
			if state == &"flee":
				_flee_from(dt, ppos, FLEE_SPEED)
				_play(&"CharacterArmature|Run")
				if global_position.distance_to(ppos) > FLEE_RANGE * 1.6:
					state = &"idle"
			else:
				_wander(dt, 1.6)
				_play(&"CharacterArmature|Walk")

func _capture() -> void:
	captured = true
	state = &"captured"
	var g = get_node_or_null("/root/Game")
	if g:
		g.bandits_captured += 1
	print("BANDIT_CAPTURED ", g.bandits_captured if g else 1)
	queue_free()

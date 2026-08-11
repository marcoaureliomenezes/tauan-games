# snake.gd — cobra (SPEC §5): bote a ≤2,5 m, 8 de dano venenoso, cooldown 2 s.
class_name BangSnake
extends "res://scripts/entities/entity.gd"

const STRIKE_RANGE := 2.5
const STRIKE_DMG := 8.0
const STRIKE_CD := 2.0

func _init() -> void:
	kind = &"snake"
	hp = 1.0

func _physics_process(dt: float) -> void:
	if state == &"dead":
		return
	_cool = maxf(0.0, _cool - dt)
	var g = get_node_or_null("/root/Game")
	var ppos: Vector3 = g.player["pos"] if g else Vector3(99999, 0, 99999)
	var d := global_position.distance_to(ppos)
	if d <= STRIKE_RANGE and _cool <= 0.0:
		_cool = STRIKE_CD
		_play(&"Snake_Attack")
		if g:
			g.player["hp"] = maxf(0.0, g.player["hp"] - STRIKE_DMG)
			print("SNAKE_STRIKE hp=", g.player["hp"])
	elif d < 12.0:
		_flee_from(dt, ppos, 3.0)
	else:
		_wander(dt, 0.8)

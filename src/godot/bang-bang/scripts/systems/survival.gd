# survival.gd — sobrevivência (SPEC §5): comida drena 0,14/s, fome zero →
# −1 HP/s; caça: pegar carcaça [E] ≤3 m, entregar na fogueira [E] ≤10 m →
# +40 comida; acampamento cura +5 HP/s num raio de 6 m.
class_name BangSurvival
extends Node3D

const FOOD_DRAIN := 0.14
const STARVE_DMG := 1.0
const CAMP_HEAL := 5.0
const CAMP_RADIUS := 6.0
const PICKUP_RANGE := 3.0
const DELIVER_RANGE := 10.0
const FOOD_PER_DEER := 40.0

var camp_pos := Vector3.ZERO
var entities: Node = null

func setup(p_camp_pos: Vector3, p_entities: Node) -> void:
	camp_pos = p_camp_pos
	entities = p_entities

func _process(dt: float) -> void:
	var g = get_node_or_null("/root/Game")
	if g == null or not g.is_playing():
		return
	# comida drena
	g.player["food"] = maxf(0.0, g.player["food"] - FOOD_DRAIN * dt)
	if g.player["food"] <= 0.0:
		g.player["hp"] = maxf(0.0, g.player["hp"] - STARVE_DMG * dt)
	# cura do acampamento
	if g.player["pos"].distance_to(camp_pos) <= CAMP_RADIUS:
		g.player["hp"] = minf(100.0, g.player["hp"] + CAMP_HEAL * dt)
	# interações [E]
	if Input.is_action_just_pressed("interact"):
		if g.player["carrying"]:
			if g.player["pos"].distance_to(camp_pos) <= DELIVER_RANGE:
				g.player["carrying"] = false
				g.player["food"] = minf(100.0, g.player["food"] + FOOD_PER_DEER)
				print("DEER_DELIVERED food=", g.player["food"])
		else:
			var car := _nearest_carcass(g.player["pos"])
			if car:
				car.queue_free()
				g.player["carrying"] = true
				print("DEER_PICKED")

func _nearest_carcass(ppos: Vector3) -> Node:
	if entities == null:
		return null
	var best: Node = null
	var best_d := PICKUP_RANGE
	for d in entities.deer:
		if is_instance_valid(d) and d.carcass:
			var dist: float = d.global_position.distance_to(ppos)
			if dist <= best_d:
				best_d = dist
				best = d
	return best

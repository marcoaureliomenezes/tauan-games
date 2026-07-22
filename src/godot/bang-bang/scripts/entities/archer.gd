# archer.gd — arqueiro indígena (SPEC §5): aggro <40 m, flechas balísticas
# (28 m/s, gravidade, 6 de dano) a cada 2,5 s, alcance 55 m, 2 HP.
class_name BangArcher
extends "res://scripts/entities/entity.gd"

const AGGRO_RANGE := 40.0
const DEAGGRO_RANGE := 70.0
const SHOOT_RANGE := 55.0
const ARROW_SPEED := 28.0
const ARROW_DMG := 6.0
const SHOOT_CD := 2.5

var arrows: Node3D = null   # container para as flechas vivas

func _init() -> void:
	kind = &"archer"
	hp = 2.0

func _physics_process(dt: float) -> void:
	if state == &"dead":
		_ground_to_terrain(dt)
		return
	_cool = maxf(0.0, _cool - dt)
	var g = get_node_or_null("/root/Game")
	var ppos: Vector3 = g.player["pos"] if g else Vector3(99999, 0, 99999)
	var d := global_position.distance_to(ppos)
	if state != &"aggro" and d < AGGRO_RANGE:
		state = &"aggro"
	elif state == &"aggro" and d > DEAGGRO_RANGE:
		state = &"idle"
	if state == &"aggro":
		rotation.y = atan2(-(ppos.x - global_position.x), -(ppos.z - global_position.z))
		if d < SHOOT_RANGE and _cool <= 0.0:
			_cool = SHOOT_CD
			_shoot_arrow(ppos)
	else:
		_wander(dt, 1.0)

func _shoot_arrow(target: Vector3) -> void:
	if arrows == null:
		var scene = get_tree().current_scene
		arrows = scene.find_child("Entities", true, false) as Node3D if scene else null
	if arrows == null:
		arrows = get_parent() as Node3D
	if arrows == null:
		return
	var a := Area3D.new()
	a.name = "Arrow"
	var col := CollisionShape3D.new()
	var sph := SphereShape3D.new()
	sph.radius = 0.15
	col.shape = sph
	a.add_child(col)
	var mesh := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.06
	sm.height = 0.6
	mesh.mesh = sm
	a.add_child(mesh)
	# arco balístico simples: mira no peito com leve arco
	var from := global_position + Vector3(0, 1.5, 0)
	var tof := global_position.distance_to(target) / ARROW_SPEED
	var vel := (target - from) / maxf(tof, 0.01)
	vel.y += 0.5 * 9.8 * tof * 0.6
	a.set_meta("vel", vel)
	a.set_meta("life", 4.0)
	arrows.add_child(a)
	a.global_position = from
	a.body_entered.connect(_arrow_hit.bind(a))
	_play(&"CharacterArmature|Punch_Right")
	print("ARCHER_SHOOT")

func _arrow_hit(body: Node, arrow: Area3D) -> void:
	var g = get_node_or_null("/root/Game")
	if g and body.name == "HorseRider":
		g.player["hp"] = maxf(0.0, g.player["hp"] - ARROW_DMG)
	arrow.queue_free()

func _process(dt: float) -> void:
	# move as flechas vivas (balística)
	if arrows == null:
		return
	for a in arrows.get_children():
		if not a is Area3D or a.name != "Arrow":
			continue
		var vel: Vector3 = a.get_meta("vel")
		vel.y -= 9.8 * dt
		a.set_meta("vel", vel)
		a.global_position += vel * dt
		a.set_meta("life", a.get_meta("life") - dt)
		if a.get_meta("life") <= 0.0:
			a.queue_free()

# test_ballistics.gd — projéteis: dano no impacto, knockback, sangue, bando.
extends SceneTree

const ProjectileScript = preload("res://scripts/combat/projectile.gd")
const DeerScript = preload("res://scripts/entities/deer.gd")
const DuckScript = preload("res://scripts/entities/duck.gd")

var failures := 0

func check(cond: bool, msg: String) -> void:
	if cond:
		print("ok — ", msg)
	else:
		failures += 1
		print("FALHOU — ", msg)

class FakeTerrain extends Node:
	func height_at(_x: float, _z: float) -> float:
		return 0.0

func _init() -> void:
	_run.call_deferred()

func _add_capsule(e: CharacterBody3D) -> void:
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.5
	cap.height = 1.8
	shape.shape = cap
	shape.position.y = 0.9
	e.add_child(shape)

func _run() -> void:
	seed(7)
	var root := Node3D.new()
	get_root().add_child(root)
	var shooter := Node3D.new()
	root.add_child(shooter)

	# 1) projétil acerta e aplica dano + sangue (nó de partículas criado)
	var deer = DeerScript.new()
	_add_capsule(deer)
	deer.setup(FakeTerrain.new())
	deer.global_position = Vector3(0, 0.8, -15)
	root.add_child(deer)
	await process_frame
	var hp0: float = deer.hp
	var p = ProjectileScript.new()
	root.add_child(p)
	p.setup(Vector3(0, 0.8, 0), Vector3(0, 0, -1), 1.0, shooter)
	var frames := 0
	while is_instance_valid(p) and frames < 60:
		await physics_frame
		frames += 1
	check(deer.hp < hp0, "projétil acertou e aplicou dano (hp %.1f→%.1f, %d frames)" % [hp0, deer.hp, frames])
	var blood_found := false
	for c in root.get_children():
		if c is GPUParticles3D:
			blood_found = true
	check(blood_found, "sangue emitido no impacto")

	# 2) knockback: abate → carcaça é jogada para trás (+ bando espantado)
	var deer2 = DeerScript.new()
	_add_capsule(deer2)
	deer2.setup(FakeTerrain.new())
	deer2.global_position = Vector3(3, 0.8, -15)
	root.add_child(deer2)
	var deer3 = DeerScript.new()
	_add_capsule(deer3)
	deer3.setup(FakeTerrain.new())
	deer3.global_position = Vector3(8, 0.8, -15)
	root.add_child(deer3)
	await process_frame
	var z0: float = deer2.global_position.z
	deer2.apply_damage(99.0, deer2.global_position, Vector3(0, 0, -1))
	check(deer2.state == &"carcass", "veado abatido → carcaça")
	for i in range(30):
		await physics_frame
	check(deer2.global_position.z < z0 - 0.3, "knockback: corpo projetado para trás (Δz=%.2f)" % (deer2.global_position.z - z0))

	# 3) bando se espanta: o vizinho entrou em fuga quando o aliado foi atingido
	check(deer3._panic_t > 0.0, "bando espantado (vizinho em pânico)")

	# 4) pato: knockback horizontal na queda
	var duck = DuckScript.new()
	duck.setup(FakeTerrain.new())
	duck.global_position = Vector3(0, 20, 0)
	root.add_child(duck)
	duck.state = &"flying"
	var x0: float = duck.global_position.x
	duck.apply_damage(1.0, duck.global_position, Vector3(1, 0, 0))
	for i in range(20):
		await physics_frame
	check(duck.global_position.x > x0 + 0.3, "pato abatido: queda com empurrão (Δx=%.2f)" % (duck.global_position.x - x0))

	var verdict := "ALL_TESTS_PASSED" if failures == 0 else "TESTS_FAILED=%d" % failures
	print(verdict)
	quit(failures)

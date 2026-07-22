# test_hunt.gd — dinâmica de caça: trava de mira [F], 80% de acerto, HP em
# tiros (pato 1, veado 5, bandido 3), pato abatido caindo até o solo.
extends SceneTree

const BangCombatScript = preload("res://scripts/combat/combat.gd")
const DuckScript = preload("res://scripts/entities/duck.gd")
const DeerScript = preload("res://scripts/entities/deer.gd")
const BanditScript = preload("res://scripts/entities/bandit.gd")

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

func _run() -> void:
	seed(42)
	var root := Node3D.new()
	get_root().add_child(root)
	var rider := Node3D.new()
	root.add_child(rider)
	var cam := Camera3D.new()
	cam.global_position = Vector3(0, 2, 0)
	cam.look_at(Vector3(0, 2, -50))
	root.add_child(cam)
	var combat = BangCombatScript.new()
	root.add_child(combat)
	combat.setup(rider, func(): return cam)

	# 1) trava: pato dentro do cone à frente; veado fora do cone
	var duck = DuckScript.new()
	duck.setup(FakeTerrain.new())
	duck.global_position = Vector3(1.5, 2.5, -40)   # ~2° do centro
	root.add_child(duck)
	var deer = DeerScript.new()
	deer.setup(FakeTerrain.new())
	deer.global_position = Vector3(30, 2, -40)      # ~36° — fora do cone
	root.add_child(deer)
	await process_frame
	await process_frame
	combat._toggle_lock()
	check(combat.lock_target == duck, "F trava no alvo dentro do cone (pato)")
	combat._toggle_lock()
	check(combat.lock_target == null, "F de novo destrava")
	# retrava: um único toggle — o veado fora do cone continua ignorado
	combat._toggle_lock()
	check(combat.lock_target == duck, "retrava no pato (veado fora do cone ignorado)")

	# 2) trava [F] = tiro PRECISO (spec final do operador): projétil direto no alvo
	var duck2 = DuckScript.new()
	duck2.setup(FakeTerrain.new())
	duck2.global_position = Vector3(0, 2, -20)
	root.add_child(duck2)
	combat.lock_target = duck2
	combat._fire_locked(cam.global_position)
	var arrived := 0
	while duck2.hp > 0.0 and arrived < 120:
		await physics_frame
		arrived += 1
	check(duck2.hp <= 0.0, "tiro travado acerta o alvo (projétil preciso, %d frames)" % arrived)

	# 3) HP em tiros
	var d1 = DuckScript.new()
	d1.setup(FakeTerrain.new())
	root.add_child(d1)
	d1.apply_damage(1.0, Vector3.ZERO)
	check(d1.state == &"falling", "pato: 1 tiro → cai (falling)")
	var deer2 = DeerScript.new()
	deer2.setup(FakeTerrain.new())
	root.add_child(deer2)
	for i in range(4):
		deer2.apply_damage(1.0, Vector3.ZERO)
	check(deer2.state != &"carcass", "veado: 4 tiros ainda vivo")
	deer2.apply_damage(1.0, Vector3.ZERO)
	check(deer2.state == &"carcass", "veado: 5 tiros → carcaça")
	var b1 = BanditScript.new()
	b1.setup(FakeTerrain.new())
	root.add_child(b1)
	for i in range(3):
		b1.apply_damage(1.0, Vector3.ZERO)
	check(b1.state == &"surrender", "bandido: 3 tiros → rendição")

	# 4) pato abatido em voo cai até o solo
	var d2 = DuckScript.new()
	d2.setup(FakeTerrain.new())
	d2.global_position = Vector3(0, 20.0, 0)
	root.add_child(d2)
	d2.state = &"flying"
	d2.apply_damage(1.0, Vector3.ZERO)
	var frames := 0
	while d2.state != &"dead" and frames < 600:
		await physics_frame
		frames += 1
	check(d2.state == &"dead", "pato abatido chega ao solo (%d frames)" % frames)
	check(absf(d2.global_position.y - 0.2) < 0.5, "pato parou no chão (y=%.2f)" % d2.global_position.y)

	var verdict := "ALL_TESTS_PASSED" if failures == 0 else "TESTS_FAILED=%d" % failures
	print(verdict)
	quit(failures)

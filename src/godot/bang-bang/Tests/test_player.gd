# test_player.gd — T-BB-04: locomoção (gaits, estamina, salto) + câmeras.
extends SceneTree

const BangTerrainScript = preload("res://scripts/world/terrain.gd")
const HorseRiderScript = preload("res://scripts/player/horse_rider.gd")

var failures := 0

func _init() -> void:
	_run.call_deferred()

func check(cond: bool, msg: String) -> void:
	if cond:
		print("ok — ", msg)
	else:
		failures += 1
		print("FALHOU — ", msg)

func _run() -> void:
	var game_state = get_root().get_node_or_null("Game")
	if game_state == null:
		game_state = preload("res://scripts/state.gd").new()
		game_state.name = "Game"
		get_root().add_child(game_state)
	game_state.phase = &"playing"

	var root := Node3D.new()
	get_root().add_child(root)
	var terrain = BangTerrainScript.new()
	root.add_child(terrain)
	await terrain.build(1876)

	var rider = HorseRiderScript.new()
	root.add_child(rider)
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.7
	cap.height = 2.8
	shape.shape = cap
	shape.position = Vector3(0, 1.2, 0)
	rider.add_child(shape)
	rider.setup(terrain)
	rider.global_position = Vector3(0, terrain.height_at(0, 0) + 0.1, 0)

	# --- W → trote (14 → 6 m/s) ---
	Input.action_press("move_forward")
	for i in range(120):
		await physics_frame
	check(rider.speed > 4.5, "W acelera até o trote (v=%.1f)" % rider.speed)
	check(rider.gait == &"trot", "gait = trot")

	# --- Shift → galope drena estamina ---
	var sta0: float = rider.stamina
	Input.action_press("gallop")
	for i in range(90):
		await physics_frame
	check(rider.speed > 10.0, "galope > 10 m/s (v=%.1f)" % rider.speed)
	check(rider.stamina < sta0, "galope drena estamina (%.0f→%.0f)" % [sta0, rider.stamina])
	Input.action_release("gallop")

	# --- salto balístico ---
	var y0: float = rider.global_position.y
	Input.action_press("jump")
	await physics_frame
	Input.action_release("jump")
	var peak := y0
	for i in range(90):
		await physics_frame
		peak = maxf(peak, rider.global_position.y)
	check(peak > y0 + 0.8, "salto balístico (ápice=%.1f)" % peak)

	# --- solta tudo → para ---
	Input.action_release("move_forward")
	for i in range(120):
		await physics_frame
	check(absf(rider.speed) < 0.6, "solta W → para (v=%.1f)" % rider.speed)
	check(rider.gait == &"stop", "gait = stop")

	# --- terreno segue altura (não afunda/flutua) ---
	var dy: float = rider.global_position.y - terrain.height_at(rider.global_position.x, rider.global_position.z)
	check(absf(dy) < 1.5, "rider colado no terreno (dy=%.2f)" % dy)

	var verdict := "ALL_TESTS_PASSED" if failures == 0 else "TESTS_FAILED=%d" % failures
	print(verdict)
	quit(failures)

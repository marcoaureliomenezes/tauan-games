# test_combat.gd — T-BB-05: revólver (8/3s/preciso) + espingarda (leque ∝ dist).
extends SceneTree

const BangTerrainScript = preload("res://scripts/world/terrain.gd")
const HorseRiderScript = preload("res://scripts/player/horse_rider.gd")
const CameraRigScript = preload("res://scripts/player/camera_rig.gd")
const BangCombatScript = preload("res://scripts/combat/combat.gd")
const TargetScript = preload("res://Tests/damageable_target.gd")

var failures := 0

func _init() -> void:
	_run.call_deferred()

func check(cond: bool, msg: String) -> void:
	if cond:
		print("ok — ", msg)
	else:
		failures += 1
		print("FALHOU — ", msg)

func _aim_at(rig, from: Vector3, to: Vector3) -> void:
	var d: Vector3 = (to - from).normalized()
	rig.yaw = atan2(-d.x, -d.z)
	rig.pitch = asin(clampf(d.y, -1.0, 1.0))

func _run() -> void:
	var gs = get_root().get_node_or_null("Game")
	if gs == null:
		gs = preload("res://scripts/state.gd").new()
		gs.name = "Game"
		get_root().add_child(gs)
	gs.phase = &"playing"

	var root := Node3D.new()
	get_root().add_child(root)
	var terrain = BangTerrainScript.new()
	root.add_child(terrain)
	await terrain.build(1876)

	# rider + rig + combat
	var rider = HorseRiderScript.new()
	root.add_child(rider)
	var shape := CollisionShape3D.new()
	shape.shape = CapsuleShape3D.new()
	rider.add_child(shape)
	rider.setup(terrain)
	var gy: float = terrain.height_at(0, 0)
	rider.global_position = Vector3(0, gy + 0.1, 0)
	var rig = CameraRigScript.new()
	rider.add_child(rig)
	await process_frame
	var combat = BangCombatScript.new()
	rider.add_child(combat)
	combat.setup(rider, rig.active_camera)
	await process_frame
	# congela o rider (teste de mira, não de locomoção) — sem micro-drift
	rider.set_physics_process(false)

	# alvo a 30 m EXATAMENTE no raio da câmera (após o braço/câmera assentarem)
	for i in range(30):
		await process_frame
	var target = TargetScript.new()
	root.add_child(target)
	var box := CollisionShape3D.new()
	box.shape = BoxShape3D.new()
	target.add_child(box)
	var cam: Camera3D = rig.active_camera()
	var fwd: Vector3 = -cam.global_transform.basis.z.normalized()
	target.global_position = cam.global_position + fwd * 30.0
	# com yaw inicial PI o alvo pode cair atrás de uma elevação — sobe acima do terreno
	target.global_position.y = maxf(target.global_position.y, terrain.height_at(target.global_position.x, target.global_position.z) + 0.5)
	_aim_at(rig, cam.global_position, target.global_position)
	await process_frame
	await process_frame
	# depois do assentamento: posição/direção REAIS da câmera (braço moveu)
	var cam_pos: Vector3 = cam.global_position
	var cam_fwd: Vector3 = -cam.global_transform.basis.z.normalized()

	# --- REVÓLVER: 8 tiros precisos ---
	Input.action_press("fire")
	for i in range(200):
		await physics_frame
	Input.action_release("fire")
	check(target.hits.size() == 8, "8 balas do tambor acertaram (hits=%d)" % target.hits.size())
	check(combat.ammo == 0, "tambor zerado (ammo=%d)" % combat.ammo)
	if target.hits.size() > 0:
		var h0 = target.hits[0]
		check(absf(h0["dmg"] - 1.0) < 0.01, "dano 1 tiro (%.1f)" % h0["dmg"])
		# desvio perpendicular ao raio da câmera (erro PURO de mira↔impacto)
		var to_hit: Vector3 = h0["point"] - cam_pos
		var perp: float = (to_hit - cam_fwd * to_hit.dot(cam_fwd)).length()
		check(perp < 0.1, "impacto no raio da câmera (desvio=%.3f m)" % perp)

	# --- recarga automática infinita de 3 s ---
	Input.action_press("fire")
	await physics_frame
	Input.action_release("fire")
	check(combat.reloading, "recarga automática ao esvaziar")
	for i in range(230):
		await physics_frame
	check(combat.ammo == 8 and not combat.reloading, "recarga infinita em ~3 s (ammo=%d)" % combat.ammo)

	# --- ESPINGARDA: leque cresce com a distância (parede grande p/ medir) ---
	box.shape.size = Vector3(14, 14, 0.5)
	Input.action_press("weapon_2")
	await physics_frame
	Input.action_release("weapon_2")
	check(combat.weapon == &"shotgun", "troca para espingarda [2]")
	var near_hits := []
	var far_hits := []
	for dist in [8.0, 25.0]:
		target.hits.clear()
		var f2: Vector3 = -cam.global_transform.basis.z.normalized()
		target.global_position = cam.global_position + f2 * dist
		target.global_position.y = maxf(target.global_position.y, terrain.height_at(target.global_position.x, target.global_position.z) + 0.5)
		_aim_at(rig, cam.global_position, target.global_position)
		await process_frame
		await process_frame
		combat._cool = 0.0
		Input.action_press("fire")
		for i in range(5):
			await physics_frame
		Input.action_release("fire")
		# projéteis voam a 250 m/s — espera a chegada (25 m ≈ 6 frames)
		for i in range(20):
			await physics_frame
		for h in target.hits:
			if dist < 10.0:
				near_hits.append(h["point"].distance_to(target.global_position))
			else:
				far_hits.append(h["point"].distance_to(target.global_position))
	var near_spread := 0.0
	for e in near_hits:
		near_spread = maxf(near_spread, e)
	var far_spread := 0.0
	for e in far_hits:
		far_spread = maxf(far_spread, e)
	check(near_hits.size() > 3, "pelotes acertam de perto (%d)" % near_hits.size())
	check(far_spread > near_spread + 0.3, "leque ∝ distância (perto %.2f → longe %.2f)" % [near_spread, far_spread])

	# --- ADS (revólver) ---
	Input.action_press("weapon_1")
	await physics_frame
	Input.action_release("weapon_1")
	Input.action_press("ads")
	for i in range(40):
		await physics_frame
	check(rig.active_camera().fov < 50.0, "ADS zoom (fov=%.0f)" % rig.active_camera().fov)
	Input.action_release("ads")

	var verdict := "ALL_TESTS_PASSED" if failures == 0 else "TESTS_FAILED=%d" % failures
	print(verdict)
	quit(failures)

# player.gd — monta o homem-a-cavalo (HorseRider + horseman.tscn + CameraRig).
extends Node3D

const HorseRiderScript = preload("res://scripts/player/horse_rider.gd")
const CameraRigScript = preload("res://scripts/player/camera_rig.gd")
const BangCombatScript = preload("res://scripts/combat/combat.gd")
const WeaponViewScript = preload("res://scripts/player/weapon_view.gd")
const RiderGearScript = preload("res://scripts/player/rider_gear.gd")

var rider

func _ready() -> void:
	rider = HorseRiderScript.new()
	rider.name = "HorseRider"
	add_child(rider)

	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.7
	cap.height = 2.8
	shape.shape = cap
	shape.position = Vector3(0, 1.2, 0)
	rider.add_child(shape)

	var hm = load("res://assets/models/horseman.tscn").instantiate()
	hm.name = "Horseman"
	rider.add_child(hm)

	# AnimationPlayer do COWBOY (mira/tiro/idle dos braços): é o player que já
	# vem no modelo (RiderFollow/Rider/AnimationPlayer) — os tracks resolvem a
	# partir do Rider, então NÃO criar segundo player nem mudar root_node.
	# modelos de arma na mão do cowboy (revólver/espingarda)
	var rider_model: Node = hm.get_node_or_null("RiderFollow/Rider")
	if rider_model:
		var wv = WeaponViewScript.new()
		wv.name = "WeaponView"
		rider_model.add_child(wv)
	# chapéu + botas + esporas do cowboy (visual "uma coisa só" com o cavalo)
	var follow: Node = hm.get_node_or_null("RiderFollow")
	if follow:
		var gear = RiderGearScript.new()
		gear.name = "RiderGear"
		follow.add_child(gear)
	var cowboy_anim := hm.get_node_or_null("RiderFollow/Rider/AnimationPlayer") as AnimationPlayer
	if cowboy_anim:
		if cowboy_anim.has_animation(&"CharacterArmature|Idle"):
			cowboy_anim.get_animation(&"CharacterArmature|Idle").loop_mode = Animation.LOOP_LINEAR
		rider.set("gun_anim", cowboy_anim)

	var rig = CameraRigScript.new()
	rig.name = "CameraRig"
	rider.add_child(rig)

	# combate (revólver + espingarda — SPEC §4)
	var combat = BangCombatScript.new()
	combat.name = "Combat"
	rider.add_child(combat)
	combat.setup(rider, rig.active_camera)
	combat.view = rider.get_node_or_null("Horseman/RiderFollow/Rider/WeaponView")

	# terreno (World/Terrain) + spawn no vale
	var world = get_node_or_null("../World")
	if world and world.get("terrain"):
		rider.setup(world.terrain)
		var gy = world.terrain.height_at(0, 0)
		rider.global_position = Vector3(0, gy + 0.1, 0)
	print("PLAYER_READY")

class_name Pickup
extends Node3D
## Pickup — esfera coletável (verde = +3 mísseis pesados; ciano = +1 nuke).
## Coleta a <3 m do caça; vida 18 s; flutua e gira.

var is_nuke := false
var life := GameConfig.PICKUP_LIFE


static func create(nuke: bool, pos: Vector3) -> Pickup:
	var p := Pickup.new()
	p.is_nuke = nuke
	p.position = pos
	var mesh := SphereMesh.new()
	mesh.radius = 1.6
	mesh.height = 3.2
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.2, 1.0, 0.3) if not nuke else Color(0.2, 0.9, 1.0)
	mat.emission_enabled = true
	mat.emission = mat.albedo_color
	mat.emission_energy_multiplier = 2.0
	mi.material_override = mat
	p.add_child(mi)
	return p


func _process(delta: float) -> void:
	life -= delta
	if life <= 0.0:
		queue_free()
		return
	rotate_y(2.0 * delta)
	position.y += sin(Time.get_ticks_msec() / 400.0) * 0.01
	var player: Node3D = GameState.player
	if player and global_position.distance_to(player.global_position) < GameConfig.PICKUP_COLLECT_R + 2.0:
		if is_nuke:
			GameState.nukes += 1
		else:
			GameState.heavy_missiles += GameConfig.PICKUP_HEAVY_AMOUNT
		AudioManager.play("pickup", -4.0)
		queue_free()

## cloud_system.gd — Procedural cloud system. 60 clouds drifting slowly.
extends Node3D

const CLOUD_COUNT: int = 60
const CLOUD_MIN_Y: float = 60.0
const CLOUD_MAX_Y: float = 200.0
const CLOUD_SPREAD: float = 3000.0
const DRIFT_SPEED: float = 4.0
const CLOUD_RESET_X: float = 3200.0

var _clouds: Array[MeshInstance3D] = []

func _ready() -> void:
	_spawn_clouds()

func _spawn_clouds() -> void:
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 1.0, 1.0, 0.82)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA

	for i in range(CLOUD_COUNT):
		var cloud_group = _make_cloud(mat)
		cloud_group.position = Vector3(
			randf_range(-CLOUD_SPREAD, CLOUD_SPREAD),
			randf_range(CLOUD_MIN_Y, CLOUD_MAX_Y),
			randf_range(-CLOUD_SPREAD, CLOUD_SPREAD)
		)
		add_child(cloud_group)
		_clouds.append(cloud_group)

func _make_cloud(mat: Material) -> MeshInstance3D:
	# Composite cloud from 3-5 overlapping spheres
	var root = MeshInstance3D.new()
	var num_puffs: int = randi_range(3, 5)
	var base_scale: float = randf_range(15.0, 40.0)

	for j in range(num_puffs):
		var puff = MeshInstance3D.new()
		var sphere = SphereMesh.new()
		sphere.radius = 1.0
		sphere.height = 2.0
		puff.mesh = sphere
		puff.material_override = mat
		puff.position = Vector3(
			randf_range(-1.0, 1.0) * base_scale * 0.5,
			randf_range(-0.2, 0.2) * base_scale * 0.3,
			randf_range(-0.5, 0.5) * base_scale * 0.3
		)
		puff.scale = Vector3(
			base_scale * randf_range(0.6, 1.0),
			base_scale * randf_range(0.3, 0.6),
			base_scale * randf_range(0.5, 0.8)
		)
		root.add_child(puff)

	return root

func _process(delta: float) -> void:
	# Drift clouds westward, wrap around
	for cloud in _clouds:
		cloud.position.x += DRIFT_SPEED * delta
		if cloud.position.x > CLOUD_RESET_X:
			cloud.position.x = -CLOUD_RESET_X
			cloud.position.z = randf_range(-CLOUD_SPREAD, CLOUD_SPREAD)

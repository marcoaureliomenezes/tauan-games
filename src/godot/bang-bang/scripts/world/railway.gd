# railway.gd — ferrovia de produção (SPEC §M-06): loop fechado com trilhos,
# dormentes e lastro seguindo o relevo; trem a vapor (locomotiva + 3 vagões)
# em PathFollow3D a 12 m/s com fumaça de chaminé.
class_name BangRailway
extends Node3D

const RADIUS := 380.0
const TRAIN_SPEED := 12.0
const GAUGE := 1.5          # entre trilhos
const SLEEPER_STEP := 1.2

var terrain: Node = null
var path: Path3D
var follow: PathFollow3D
var train: Node3D
var smoke: GPUParticles3D
var train_pos := Vector3.ZERO

func build(p_terrain: Node, world_seed: int) -> void:
	terrain = p_terrain
	_build_path(world_seed)
	_build_rails()
	_build_train()

func _build_path(world_seed: int) -> void:
	path = Path3D.new()
	path.name = "RailPath"
	var curve := Curve3D.new()
	curve.closed = true
	var rng := RandomNumberGenerator.new()
	rng.seed = world_seed + 77
	var n := 16
	for i in range(n):
		var a := TAU * i / n
		var r := RADIUS * (0.85 + rng.randf() * 0.3)
		var x := cos(a) * r
		var z := sin(a) * r
		var y: float = terrain.height_at(x, z) + 0.25
		curve.add_point(Vector3(x, y, z))
	path.curve = curve
	add_child(path)
	# suaviza alturas (média móvel — trilho não escala penhas)
	for i in range(2):
		var ys := []
		for j in range(curve.point_count):
			var p0 := curve.get_point_position((j - 1 + curve.point_count) % curve.point_count)
			var p1 := curve.get_point_position(j)
			var p2 := curve.get_point_position((j + 1) % curve.point_count)
			ys.append((p0.y + p1.y * 2.0 + p2.y) / 4.0)
		for j in range(curve.point_count):
			var p := curve.get_point_position(j)
			p.y = ys[j]
			curve.set_point_position(j, p)

func _build_rails() -> void:
	var curve := path.curve
	var length := curve.get_baked_length()
	# dormentes
	var sleepers := MultiMesh.new()
	sleepers.transform_format = MultiMesh.TRANSFORM_3D
	var sm := BoxMesh.new()
	sm.size = Vector3(2.4, 0.12, 0.35)
	sleepers.mesh = sm
	var n_sleep := int(length / SLEEPER_STEP)
	sleepers.instance_count = n_sleep
	sleepers.visible_instance_count = n_sleep
	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color(0.25, 0.18, 0.12)
	for i in range(n_sleep):
		var d := i * SLEEPER_STEP
		var t := curve.sample_baked_with_rotation(d, true)
		t.origin.y += 0.06
		sleepers.set_instance_transform(i, t)
	var mmi := MultiMeshInstance3D.new()
	mmi.name = "Sleepers"
	mmi.multimesh = sleepers
	mmi.material_override = dark
	add_child(mmi)
	# trilhos (fitas verticais finas ao longo da curva, 2 lados)
	for side in [-1.0, 1.0]:
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
		var steps := int(length / 2.0)
		for i in range(steps + 1):
			var d := i * 2.0
			var t := curve.sample_baked_with_rotation(d, true)
			var off: Vector3 = t.basis.x * (GAUGE * 0.5 * side)
			var top := t.origin + off + Vector3(0, 0.22, 0)
			st.set_normal(Vector3.UP)
			st.add_vertex(top + Vector3(0, 0.07, 0))
			st.set_normal(Vector3.UP)
			st.add_vertex(top)
		# generate_normals() não aceita TRIANGLE_STRIP — normais manuais acima
		var rail := MeshInstance3D.new()
		rail.name = "Rail"
		rail.mesh = st.commit()
		var metal := StandardMaterial3D.new()
		metal.albedo_color = Color(0.4, 0.4, 0.42)
		metal.metallic = 0.8
		metal.roughness = 0.35
		rail.material_override = metal
		add_child(rail)

func _build_train() -> void:
	follow = PathFollow3D.new()
	follow.name = "TrainFollow"
	follow.loop = true
	follow.rotation_mode = PathFollow3D.ROTATION_ORIENTED
	path.add_child(follow)
	train = Node3D.new()
	train.name = "Train"
	follow.add_child(train)
	var engine_res = load("res://assets/models/train/TrainEngine.tscn")
	var wagon_res = load("res://assets/models/train/TrainWagon.tscn")
	if engine_res:
		var engine = engine_res.instantiate()
		engine.name = "Engine"
		train.add_child(engine)
		# chaminé com fumaça
		smoke = GPUParticles3D.new()
		smoke.name = "ChimneySmoke"
		smoke.amount = 48
		smoke.lifetime = 2.4
		var pm := ParticleProcessMaterial.new()
		pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
		pm.emission_shape_scale = Vector3(0.15, 0.15, 0.15)
		pm.direction = Vector3(0, 1, 0)
		pm.spread = 12.0
		pm.initial_velocity_min = 2.5
		pm.initial_velocity_max = 4.0
		pm.gravity = Vector3(0, 0.6, 0)
		pm.scale_min = 0.4
		pm.scale_max = 1.2
		pm.color = Color(0.75, 0.72, 0.7, 0.55)
		smoke.process_material = pm
		smoke.position = Vector3(0, 2.6, -1.2)
		engine.add_child(smoke)
	if wagon_res:
		for i in range(3):
			var w = wagon_res.instantiate()
			w.name = "Wagon%d" % (i + 1)
			w.position = Vector3(0, 0, 4.4 * (i + 1))
			train.add_child(w)
	print("RAILWAY_BUILT")

func _process(dt: float) -> void:
	if follow:
		follow.progress += TRAIN_SPEED * dt
		train_pos = follow.global_position

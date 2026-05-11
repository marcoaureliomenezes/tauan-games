## ocean.gd — Animated ocean plane using ArrayMesh for vertex updates.
## Same 3-wave formula as Three.js world.js.
extends MeshInstance3D

const OCEAN_SIZE: float = 10000.0
const SUBDIVISIONS: int = 64
const WAVE_SPEED: float = 0.6
const WAVE_AMP: float = 1.2

var _base_y: PackedFloat32Array
var _array_mesh: ArrayMesh
var _arrays: Array = []
var _time: float = 0.0
var _vertex_count: int

func _ready() -> void:
	_build_ocean()

func _build_ocean() -> void:
	var st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)

	var cell_size: float = OCEAN_SIZE / float(SUBDIVISIONS)
	var origin: float = -OCEAN_SIZE / 2.0

	# Build flat grid
	var verts: PackedVector3Array = []
	var normals: PackedVector3Array = []
	var uvs: PackedVector2Array = []
	var indices: PackedInt32Array = []

	for row in range(SUBDIVISIONS + 1):
		for col in range(SUBDIVISIONS + 1):
			var x: float = origin + col * cell_size
			var z: float = origin + row * cell_size
			verts.append(Vector3(x, 0.0, z))
			normals.append(Vector3.UP)
			uvs.append(Vector2(float(col) / SUBDIVISIONS, float(row) / SUBDIVISIONS))

	for row in range(SUBDIVISIONS):
		for col in range(SUBDIVISIONS):
			var i: int = row * (SUBDIVISIONS + 1) + col
			indices.append(i)
			indices.append(i + 1)
			indices.append(i + SUBDIVISIONS + 1)
			indices.append(i + 1)
			indices.append(i + SUBDIVISIONS + 2)
			indices.append(i + SUBDIVISIONS + 1)

	_arrays = []
	_arrays.resize(Mesh.ARRAY_MAX)
	_arrays[Mesh.ARRAY_VERTEX] = verts
	_arrays[Mesh.ARRAY_NORMAL] = normals
	_arrays[Mesh.ARRAY_TEX_UV] = uvs
	_arrays[Mesh.ARRAY_INDEX] = indices

	_base_y = PackedFloat32Array()
	for _v in verts:
		_base_y.append(0.0)
	_vertex_count = verts.size()

	_array_mesh = ArrayMesh.new()
	_array_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, _arrays)

	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.05, 0.18, 0.45, 0.88)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.metallic = 0.3
	mat.roughness = 0.2
	_array_mesh.surface_set_material(0, mat)

	mesh = _array_mesh

func _process(delta: float) -> void:
	_time += delta
	_update_waves()

func _update_waves() -> void:
	var verts: PackedVector3Array = _arrays[Mesh.ARRAY_VERTEX].duplicate()
	var t: float = _time

	for i in range(_vertex_count):
		var v: Vector3 = verts[i]
		# 3-wave superposition (same as Three.js)
		var y: float = WAVE_AMP * sin(v.x * 0.008 + t * WAVE_SPEED) \
			+ WAVE_AMP * 0.6 * sin(v.z * 0.012 + t * WAVE_SPEED * 0.7) \
			+ WAVE_AMP * 0.4 * sin((v.x + v.z) * 0.006 + t * WAVE_SPEED * 1.3)
		verts[i] = Vector3(v.x, y, v.z)

	_arrays[Mesh.ARRAY_VERTEX] = verts
	_array_mesh.clear_surfaces()
	_array_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, _arrays)
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.05, 0.18, 0.45, 0.88)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.metallic = 0.3
	mat.roughness = 0.2
	_array_mesh.surface_set_material(0, mat)

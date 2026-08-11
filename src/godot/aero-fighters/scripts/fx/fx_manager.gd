class_name FxManager
extends Node3D
## FxManager — explosões e efeitos (port de fx.js). Wave M3 REWRITE: os pools
## de GPUParticles3D (one_shot + restart/toggle) NÃO renderizam neste setup
## (Godot 4.7.1 Forward+ / Intel Xe — provado em matriz de variantes: só
## emissores contínuos e one_shot recém-criados com emitting=true aparecem).
## Agora os efeitos quentes vivem em 2 MultiMeshes de quads billboard
## (CPU, zero alocação por frame — mesmo padrão do firestorm do NuclearFx):
## SMOKE (alpha, circle_05) e FIRE (aditivo, flame_06). 1 draw call cada.
## Anéis/scorch/flash continuam MeshInstance/Tween (sempre renderizaram).

var _flash_layer: CanvasLayer
var _flash_rect: ColorRect

# Texturas Kenney Particle Pack (CC0)
const TEX_FLAME := preload("res://addons/kenney_particle_pack/flame_06.png")
const TEX_SMOKE := preload("res://addons/kenney_particle_pack/circle_05.png")
const TEX_SCORCH := preload("res://addons/kenney_particle_pack/scorch_01.png")

const SMOKE_N := 384 # esteiras de míssil/ordenança/nuke, poeira, fumaça escura
const FIRE_N := 192 # flashes, bolas de fogo, camadas aditivas de explosão

var _smoke_mm: MultiMesh
var _fire_mm: MultiMesh
var _smoke: Array[Dictionary] = [] # live: {p, v, life, max, s0, grow, c0, c1, rot, spin}
var _fire: Array[Dictionary] = []
var _smoke_free: Array[int] = []
var _fire_free: Array[int] = []


func _ready() -> void:
	_flash_layer = CanvasLayer.new()
	_flash_layer.layer = 100
	_flash_rect = ColorRect.new()
	_flash_rect.color = Color(1, 1, 1, 0)
	_flash_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_flash_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_flash_layer.add_child(_flash_rect)
	add_child(_flash_layer)
	_smoke_mm = _make_pool(SMOKE_N, TEX_SMOKE, false, "FxSmoke")
	_fire_mm = _make_pool(FIRE_N, TEX_FLAME, true, "FxFire")
	for i in SMOKE_N:
		_smoke_free.append(i)
	for i in FIRE_N:
		_fire_free.append(i)


## Pool de quads billboard em MultiMesh (1 draw call; transforms/cores por frame).
func _make_pool(count: int, tex: Texture2D, additive: bool, label: String) -> MultiMesh:
	var quad := QuadMesh.new()
	quad.size = Vector2(2, 2)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = quad
	mm.instance_count = count
	for i in count:
		mm.set_instance_transform(i, Transform3D(Basis.from_scale(Vector3.ZERO), Vector3.ZERO))
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = tex
	mat.vertex_color_use_as_albedo = true
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if additive:
		mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	var mmi := MultiMeshInstance3D.new()
	mmi.name = label
	mmi.multimesh = mm
	mmi.material_override = mat
	mmi.custom_aabb = AABB(Vector3(-4500, -300, -4500), Vector3(9000, 1600, 9000))
	add_child(mmi)
	return mm


## Spawna um puff no pool (SMOKE ou FIRE). c0/c1 = cor inicial/final (alpha
## incluso); s0 = raio inicial (m); grow = crescimento (m/s); spin = rad/s.
func _spawn(pool: int, pos: Vector3, vel: Vector3, life: float, s0: float,
		grow: float, c0: Color, c1: Color) -> void:
	var free := _smoke_free if pool == 0 else _fire_free
	if free.is_empty():
		return
	var i: int = free.pop_back()
	(_smoke if pool == 0 else _fire).append({"i": i, "p": pos, "v": vel,
		"life": life, "max": life, "s0": s0, "grow": grow, "c0": c0, "c1": c1,
		"rot": randf() * TAU, "spin": randf_range(-0.8, 0.8)})


func _process(delta: float) -> void:
	var dt := minf(delta, 0.1)
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	var cb := cam.global_basis
	_update_pool(_smoke, _smoke_mm, _smoke_free, cb, dt)
	_update_pool(_fire, _fire_mm, _fire_free, cb, dt)


func _update_pool(live: Array[Dictionary], mm: MultiMesh, free: Array[int],
		cb: Basis, dt: float) -> void:
	for j in range(live.size() - 1, -1, -1):
		var s: Dictionary = live[j]
		s.life -= dt
		if s.life <= 0.0:
			mm.set_instance_transform(s.i, Transform3D(Basis.from_scale(Vector3.ZERO), Vector3.ZERO))
			free.append(s.i)
			live.remove_at(j)
			continue
		s.p += s.v * dt
		s.rot += s.spin * dt
		var u: float = s.life / s.max # 1→0
		var r: float = s.s0 + s.grow * (s.max - s.life)
		var b := Basis(cb) * Basis(Vector3(0, 0, 1), s.rot)
		b = b.scaled(Vector3(r, r, r))
		mm.set_instance_transform(s.i, Transform3D(b, s.p))
		mm.set_instance_color(s.i, s.c0.lerp(s.c1, 1.0 - u))


# ---------------------------------------------------------------------------
# API pública (mesma de sempre — callers intactos)
# ---------------------------------------------------------------------------

## Explosão padrão (fx.js#explosion): fireball + faíscas + fumaça + anel no chão.
func explosion(pos: Vector3, scale: float = 1.0) -> void:
	AudioManager.play_far("explosion", pos, -10.0 + minf(scale, 4.0),
		(1.0 - minf(scale * 0.08, 0.3)) * 0.9)
	# Fireball (aditivo, sobe e expande)
	for i in maxi(4, int(10 * scale)):
		_spawn(1, pos + Vector3(randf_range(-1, 1), randf_range(0, 1.5), randf_range(-1, 1)) * scale,
			Vector3(randf_range(-4, 4), randf_range(2, 9) * scale, randf_range(-4, 4)),
			randf_range(0.5, 0.9), 1.6 * scale, 7.0 * scale,
			Color(1.0, 0.62, 0.12, 0.95), Color(0.85, 0.18, 0.02, 0.0))
	# Núcleo branco-quente (flash curto)
	for i in maxi(2, int(4 * scale)):
		_spawn(1, pos, Vector3(randf_range(-2, 2), randf_range(1, 4), randf_range(-2, 2)),
			randf_range(0.25, 0.45), 2.2 * scale, 9.0 * scale,
			Color(1.0, 0.92, 0.55, 1.0), Color(1.0, 0.5, 0.1, 0.0))
	# Fumaça escura (sobe devagar, vida longa — lê a 2 km)
	for i in maxi(3, int(7 * scale)):
		_spawn(0, pos + Vector3(0, 2 * scale, 0),
			Vector3(randf_range(-2, 2), randf_range(2, 5), randf_range(-2, 2)),
			randf_range(2.4, 4.0), 2.0 * scale, 3.2 * scale,
			Color(0.15, 0.15, 0.15, 0.9), Color(0.5, 0.5, 0.5, 0.0))
	if pos.y < 20.0:
		_spawn_ring(pos, 30.0 * scale, 0.6)


## Muzzle flash / brilho de cabeça de míssil — puff aditivo de vida curta.
func muzzle_flash(pos: Vector3, scale: float = 1.0) -> void:
	_spawn(1, pos, Vector3(0, 0.5, 0), 0.14, 2.2 * scale, 4.0 * scale,
		Color(1.0, 0.85, 0.4, 0.95), Color(1.0, 0.5, 0.1, 0.0))


## Marca de queimado no solo (crash, mega-explosões).
func scorch_mark(pos: Vector3, radius: float = 13.0) -> void:
	var mi := MeshInstance3D.new()
	var mesh := PlaneMesh.new()
	mesh.size = Vector2(radius * 2, radius * 2)
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = TEX_SCORCH
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mi.material_override = mat
	add_child(mi)
	mi.global_position = pos + Vector3(0, 0.3, 0)
	# Desvanece em ~90 s como no web
	var tw := mi.create_tween()
	tw.tween_interval(60.0)
	tw.tween_property(mat, "albedo_color:a", 0.0, 30.0)
	tw.tween_callback(mi.queue_free)


## Mega-explosão (bases, fábricas, crash, boss): escala 5 + sub-explosões retardadas.
func mega_explosion(pos: Vector3, scale: float = 5.0) -> void:
	AudioManager.play_far("mega", pos, -4.0, 0.65)
	explosion(pos, scale)
	_spawn_ring(pos, 80.0, 0.8)
	for i in 4:
		var delay := 0.3 + i * 0.25
		var offset := Vector3(randf_range(-14, 14), randf_range(0, 8), randf_range(-14, 14)) * scale * 0.2
		get_tree().create_timer(delay).timeout.connect(
			explosion.bind(pos + offset, scale * randf_range(0.3, 0.55)))


## Detonação nuclear: flash duplo + slow-mo + explosão gigante.
func nuclear_explosion(pos: Vector3) -> void:
	AudioManager.play("mega", 0.0, 0.7)
	flash(0.9)
	Engine.time_scale = GameConfig.NUKE_SLOWMO
	get_tree().create_timer(GameConfig.NUKE_SLOWMO_TIME, true, false, true).timeout.connect(
		func(): Engine.time_scale = 1.0)
	explosion(pos, 28.0)
	for i in 7:
		var delay := 0.8 + i * 0.35
		var offset := Vector3(randf_range(-1, 1), randf_range(0, 0.4), randf_range(-1, 1)) * 300.0
		get_tree().create_timer(delay).timeout.connect(explosion.bind(pos + offset, 6.0))
	get_tree().create_timer(GameConfig.NUKE_SLOWMO_TIME + 0.5, true, false, true).timeout.connect(flash.bind(0.5))


## Fumaça de dano/motor (puff único escuro).
func smoke_puff(pos: Vector3) -> void:
	_spawn(0, pos, Vector3(0, 1.5, 0), 1.6, 2.0, 4.0,
		Color(0.2, 0.2, 0.2, 0.7), Color(0.6, 0.6, 0.6, 0.0))


## Esteira de míssil (Wave G/K4/L2/M3): puffs DISCRETOS em fita tracejada —
## legível a 500-2500 m sem mesclar numa nuvem (web fx.js#spawnMissileSmoke).
func trail_puff(pos: Vector3) -> void:
	# Fumaça ESCURA (web fall-trail/T-D-10): contraste contra a névoa clara do
	# horizonte E o céu azul — branco e cinza-médio sumiam (diagnóstico M3)
	_spawn(0, pos, Vector3(randf_range(-0.6, 0.6), 0.8, randf_range(-0.6, 0.6)),
		randf_range(2.5, 3.2), 5.0, 4.5,
		Color(0.28, 0.28, 0.30, 0.9), Color(0.55, 0.55, 0.58, 0.0))


## Splash na água.
func splash(pos: Vector3, scale: float = 1.0) -> void:
	AudioManager.play("splash", -4.0)
	for i in int(20 * scale):
		_spawn(0, pos, Vector3(randf_range(-6, 6) * scale, randf_range(4, 12) * scale,
			randf_range(-6, 6) * scale), randf_range(0.8, 1.4), 1.2 * scale, 3.0 * scale,
			Color(0.8, 0.9, 0.95, 0.9), Color(0.6, 0.75, 0.85, 0.0))
	_spawn_ring(pos, 18.0 * scale, 0.8)


## Flash de tela cheia (nuke).
func flash(strength: float) -> void:
	_flash_rect.color = Color(1, 1, 1, strength)
	var tw := _flash_rect.create_tween()
	tw.tween_property(_flash_rect, "color:a", 0.0, 0.6)


func _spawn_ring(pos: Vector3, max_radius: float, duration: float) -> void:
	var mesh := TorusMesh.new()
	mesh.inner_radius = 0.85
	mesh.outer_radius = 1.0
	var ring := MeshInstance3D.new()
	ring.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.8, 0.5, 0.7)
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring.material_override = mat
	add_child(ring)
	ring.global_position = Vector3(pos.x, maxf(pos.y, 1.0), pos.z)
	ring.scale = Vector3.ONE * 0.5
	var tw := ring.create_tween()
	tw.set_parallel(true)
	tw.tween_property(ring, "scale", Vector3.ONE * max_radius, duration)
	tw.tween_property(mat, "albedo_color:a", 0.0, duration)
	tw.chain().tween_callback(ring.queue_free)

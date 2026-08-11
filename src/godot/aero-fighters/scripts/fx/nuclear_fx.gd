class_name NuclearFx
extends Node3D
## NuclearFx — pipeline completo da detonação nuclear (port de nuclear-fx.js +
## fx.js#nuclearExplosion + firestorm.js + applyNuclearShockwave/scorch/cratera
## de projectiles.js). Uso: NuclearFx.detonate(parent, pos, surface_height).
## Timeline: flash duplo → bursts/aneis → fireball FBM → cogumelo (copa+talo+
## saia, 1 draw call de billboards GPU) → firestorm 60 s fogo + 120 s fumaça →
## carbonizado permanente. O cogumelo se libera aos 60 s; o nó vive ~185 s por
## causa do firestorm e então se libera sozinho.

# ── Cogumelo (nuclear-fx.js) ──
const LIFETIME := 60.0
const CEILING := 950.0
const RISE_T := 45.0
const CAP_HALF_W := 330.0
const CAP_H := 140.0
const STEM_R := 95.0
const SKIRT_R := 420.0
const N_CAP := 64
const N_STEM := 46
const N_SKIRT := 24
const FIREBALL_R_BASE := 8.0
const FIREBALL_R_MAX := 130.0
const FIREBALL_GROW_T := 3.6
const FIREBALL_FADE_T := 9.0
const FIREBALL_RISE_BASE := 30.0
const FIREBALL_RISE_T := 5.5
const SHOCKWAVE_MAX_R := 750.0
const SHOCKWAVE_RATE := 220.0
const FIRE_STOPS := [Color(1, 1, 1), Color8(0xff, 0xee, 0x88),
	Color8(0xff, 0xaa, 0x30), Color8(0xff, 0x50, 0x20)]
# ── Firestorm (firestorm.js + NUKE_FIRESTORM do config.js) ──
const FS_RADIUS := 260.0 # 2× FIREBALL_R_MAX
const FS_FIRE_S := 60.0
const FS_TOTAL_S := 180.0 # 60 fogo + 120 fumaça
const FS_MAX_EMITTERS := 64
const FS_FLAME_POOL := 160
const FS_SMOKE_POOL := 120
const FS_FIRE_COLORS := [Color8(0xff, 0xdd, 0x66), Color8(0xff, 0xaa, 0x30),
	Color8(0xff, 0x50, 0x20)]
const FS_SMOKE_COLOR := Color(0.55, 0.55, 0.55)
const CHAR_STEP := 0.25 # s entre aplicações de carbonização (re-upa o buffer)

# ── Shader do fireball (port 1:1 de FIRE_VERT/FIRE_FRAG — FBM 5 oitavas com
# domain warping q→r→d, rampa blackbody, fresnel no limbo) ──
const FIRE_SHADER := """
shader_type spatial;
render_mode blend_add, depth_draw_never, cull_disabled, unshaded;

uniform float uTime;
uniform float uFade;
uniform float uDisp;

varying vec3 vN;
varying vec3 vNv;
varying vec3 vView;

// Hash sem seno (David Hoskins) — o hash clássico fract(sin()*43758) produz
// NaN no driver Intel ANV e a esfera INTEIRA some (K2).
float hash(vec3 p) {
	p = fract(p * 0.3183099 + vec3(0.1, 0.17, 0.13));
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 p) {
	vec3 i = floor(p); vec3 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float n000 = hash(i); float n100 = hash(i + vec3(1, 0, 0));
	float n010 = hash(i + vec3(0, 1, 0)); float n110 = hash(i + vec3(1, 1, 0));
	float n001 = hash(i + vec3(0, 0, 1)); float n101 = hash(i + vec3(1, 0, 1));
	float n011 = hash(i + vec3(0, 1, 1)); float n111 = hash(i + vec3(1, 1, 1));
	return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
		mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
float fbm(vec3 p) {
	float v = 0.0; float a = 0.5;
	for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
	return v;
}

void vertex() {
	vN = NORMAL;
	vNv = normalize((MODELVIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	vView = (MODELVIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	// Domain warp q→r→d: a superfície ferve em bolhas de plasma
	vec3 sp = NORMAL * 2.4 + vec3(0.0, -uTime * 0.60, 0.0);
	float q = fbm(sp);
	float r = fbm(sp + vec3(q) * 1.6 + vec3(0.0, -uTime * 0.35, uTime * 0.20));
	float d = fbm(sp + vec3(r) * 1.5);
	VERTEX = VERTEX * (1.0 + uDisp * (d - 0.5) * 0.70);
}

vec3 fireRamp(float x) {
	vec3 c = mix(vec3(0.05, 0.015, 0.008), vec3(0.80, 0.16, 0.03), smoothstep(0.0, 0.30, x));
	c = mix(c, vec3(1.0, 0.55, 0.10), smoothstep(0.30, 0.60, x));
	c = mix(c, vec3(1.0, 0.92, 0.55), smoothstep(0.60, 0.85, x));
	c = mix(c, vec3(1.0, 1.0, 1.0), smoothstep(0.85, 1.0, x));
	return c;
}

void fragment() {
	vec3 sp = vN * 3.0 + vec3(0.0, -uTime * 0.80, uTime * 0.15);
	float q = fbm(sp);
	float r = fbm(sp * 1.7 + vec3(q) * 2.0 + vec3(uTime * 0.10, -uTime * 0.40, 0.0));
	float n = fbm(sp + vec3(r) * 1.5);
	float heat = clamp(n * 1.90 + 0.22 - uTime * 0.075, 0.0, 1.0);
	vec3 c = fireRamp(heat);
	float fres = pow(1.0 - abs(dot(normalize(vNv), normalize(-vView))), 2.2);
	c += vec3(1.0, 0.45, 0.12) * fres * (0.35 + 0.65 * heat) * 0.9;
	ALBEDO = c;
	ALPHA = uFade * (0.35 + 0.65 * heat);
}
"""

# ── Shader dos puffs (copa+talo+saia em 1 draw call; port de PUFF_VERT/FRAG).
# INSTANCE_CUSTOM = aShape (ang/TAU, radF/1.2, (yF+0.2)/1.2, (scl-40)/220);
# COLOR = aSeed (seed, spin, drift, kind/2) — buffers de instância são RGBA8,
# então todos os dados vão normalizados 0..1 e decodificados no shader. ──
const PUFF_SHADER := """
shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_disabled, unshaded;

uniform sampler2D uMap : source_color, filter_linear_mipmap;
uniform float uTime;
uniform float uPlumeH;
uniform float uCapHalfW;
uniform float uCapH;
uniform float uStemR;
uniform float uSkirtR;
uniform vec2 uWob;
uniform vec3 uHot : source_color;
uniform vec3 uMid : source_color;
uniform vec3 uCool : source_color;
uniform float uTailFade;
uniform float uGroundY;

varying float vKind;
varying float vSeed;
varying float vYFrac;

void vertex() {
	vSeed = COLOR.r;
	float spin = COLOR.g * 2.0 - 1.0;
	float drift = (COLOR.b * 2.0 - 1.0) * 0.1;
	vKind = COLOR.a * 2.0;
	float ang = INSTANCE_CUSTOM.x * 6.2831 + uTime * drift;
	float radF = INSTANCE_CUSTOM.y * 1.2;
	float yF = INSTANCE_CUSTOM.z * 1.2 - 0.2;
	vYFrac = yF;
	float scl = 40.0 + INSTANCE_CUSTOM.w * 220.0;
	vec3 c;
	if (vKind < 0.5) {
		// COPA: casca de domo em volta do topo da pluma; pulso no raio
		float pulse = 1.0 + 0.06 * sin(uTime * (0.5 + vSeed) + vSeed * 17.0);
		float r = radF * uCapHalfW * pulse;
		float yy = uPlumeH + yF * uCapH;
		c = vec3(cos(ang) * r + uWob.x, yy, sin(ang) * r + uWob.y);
		scl *= (0.45 + 0.55 * (uCapHalfW / 330.0));
	} else if (vKind < 1.5) {
		// TALO: coluna que afunila na base e balança com a pluma
		float r = radF * uStemR * (0.62 + 0.48 * yF);
		float yy = yF * uPlumeH;
		float w = yF * yF;
		c = vec3(cos(ang) * r + uWob.x * w, yy, sin(ang) * r + uWob.y * w);
		scl *= (0.55 + 0.45 * (uPlumeH / 950.0));
	} else {
		// SAIA de poeira: anel baixo que varre para fora nos primeiros ~8 s
		float sweep = clamp(uTime / 8.0, 0.10, 1.0);
		float r = radF * uSkirtR * sweep;
		c = vec3(cos(ang) * r, 6.0 + yF * 26.0, sin(ang) * r);
		scl *= (0.5 + 0.9 * sweep);
	}
	c.y += uGroundY; // pluma nasce da cota do solo no epicentro
	// Billboard em view space (como o web): centro paramétrico + canto girado.
	// POSITION (clip space) — escrever VERTEX aqui aplicaria MODELVIEW 2×.
	vec4 view = MODELVIEW_MATRIX * vec4(c, 1.0);
	float sp = spin * uTime + vSeed * 6.2831;
	float cs = cos(sp); float sn = sin(sp);
	vec2 corner = VERTEX.xy * scl;
	POSITION = PROJECTION_MATRIX * (view + vec4(corner.x * cs - corner.y * sn,
		corner.x * sn + corner.y * cs, 0.0, 0.0));
}

void fragment() {
	float a = texture(uMap, UV).a;
	// Esfriamento: copa segura o calor mais que o talo; saia é poeira desde cedo
	float coolT = vKind < 0.5 ? uTime / 7.5 : vKind < 1.5 ? uTime / 4.5 : 1.2;
	float cool = clamp(coolT + vSeed * 0.25, 0.0, 1.0);
	vec3 c = mix(uHot, uMid, smoothstep(0.0, 0.55, cool));
	c = mix(c, uCool, smoothstep(0.55, 1.0, cool));
	c *= (0.82 + 0.50 * UV.y); // fake shading: topo claro, base em sombra
	if (vKind > 0.5 && vKind < 1.5) { c *= (0.80 + 0.20 * vYFrac); }
	float alpha = a * uTailFade * (vKind > 1.5 ? clamp(1.0 - (uTime - 14.0) / 12.0, 0.0, 0.85) : 0.92);
	if (alpha < 0.01) { discard; }
	ALBEDO = c;
	ALPHA = alpha;
}
"""

# Caches estáticos (compilados/gerados 1× por sessão)
static var _fire_shader: Shader
static var _puff_shader: Shader
static var _smoke_tex: ImageTexture
static var _ring_mesh: ArrayMesh
static var _puff_sphere: SphereMesh
static var _slowmo_active := false

var _t := 0.0
var _pos := Vector3.ZERO
var _ground_y := 0.0
var _surface: Callable
var _fx: FxManager
var _mushroom_done := false
# Visuais
var _fire: MeshInstance3D
var _fire_mat: ShaderMaterial
var _puffs: MultiMeshInstance3D
var _puff_mat: ShaderMaterial
var _shock_ring: MeshInstance3D
var _shock_mat: StandardMaterial3D
var _wilson: Array[MeshInstance3D] = []
var _wilson_mats: Array[StandardMaterial3D] = []
var _light: OmniLight3D
var _flash_layer: CanvasLayer
var _flash_rect: ColorRect
var _residual: GPUParticles3D
# Eventos agendados dos bursts iniciais: [[t, Callable], ...] ordenado por t
var _events: Array = []
var _ev_idx := 0
# Anéis de choque dos bursts (expandem e desvanecem)
var _rings: Array = []
# Firestorm
var _fs_emitters: Array = []
var _flame_mm: MultiMesh
var _smoke_mm: MultiMesh
var _flame_free: Array[int] = []
var _smoke_free: Array[int] = []
var _flames: Array = []
var _smokes: Array = []
var _mat_clones := {}


## API pública: detona a pipeline completa em `pos` (world) sob `parent`.
static func detonate(parent: Node3D, pos: Vector3, surface_fn: Callable) -> NuclearFx:
	var fx := NuclearFx.new()
	fx._pos = pos
	fx._surface = surface_fn
	parent.add_child(fx)
	fx.global_position = Vector3(pos.x, 0.0, pos.z) # conteúdo local usa alturas absolutas
	fx._begin()
	return fx


func _begin() -> void:
	_ground_y = maxf(_surface.call(_pos.x, _pos.z), 0.0) if _surface.is_valid() else _pos.y
	_fx = _find_fx(get_tree().current_scene)
	AudioManager.play("mega", -1.0, 0.5)
	_slowmo()
	_shake_camera()
	_build_flash()
	_build_fireball()
	_build_puffs()
	_build_shock_ring()
	_build_wilson()
	_build_light()
	_schedule_bursts()
	_spawn_scorch()
	_deform_crater()
	_build_residual_smoke()
	_collect_firestorm_emitters()
	_build_firestorm_pools()


# ---------------------------------------------------------------------------
# Setup dos visuais
# ---------------------------------------------------------------------------

func _build_flash() -> void:
	_flash_layer = CanvasLayer.new()
	_flash_layer.layer = 120
	_flash_rect = ColorRect.new()
	_flash_rect.color = Color(1, 1, 1, 1)
	_flash_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_flash_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_flash_layer.add_child(_flash_rect)
	add_child(_flash_layer)


func _build_fireball() -> void:
	if _fire_shader == null:
		_fire_shader = Shader.new()
		_fire_shader.code = FIRE_SHADER
	_fire_mat = ShaderMaterial.new()
	_fire_mat.shader = _fire_shader
	_fire_mat.set_shader_parameter("uDisp", 1.0)
	# Núcleo POR CIMA da fumaça (web renderOrder: fireball 3 > puffs 2) — sem
	# isso a copa (134 quads ~opacos empilhados) esconde a bola de fogo
	_fire_mat.render_priority = 1
	var mesh := SphereMesh.new()
	mesh.radius = 1.0
	mesh.height = 2.0
	mesh.radial_segments = 48
	mesh.rings = 32
	_fire = MeshInstance3D.new()
	_fire.mesh = mesh
	_fire.material_override = _fire_mat
	add_child(_fire)


## Cogumelo: 64 copa + 46 talo + 24 saia = 1 draw call, animação 100% na GPU.
func _build_puffs() -> void:
	if _puff_shader == null:
		_puff_shader = Shader.new()
		_puff_shader.code = PUFF_SHADER
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.use_custom_data = true
	var quad := QuadMesh.new()
	quad.size = Vector2(2, 2)
	mm.mesh = quad
	mm.instance_count = N_CAP + N_STEM + N_SKIRT
	var k := 0
	# COPA: domo — mais denso na borda (torus roll), alguns no miolo alto
	for i in N_CAP:
		var edge := i < int(N_CAP * 0.7)
		var ang := randf() * TAU
		var radF := 0.62 + randf() * 0.38 if edge else randf() * 0.55
		var yF := -0.20 + randf() * 0.60 if edge else 0.30 + randf() * 0.60
		_set_puff(mm, k, ang, radF, yF, 135.0 + randf() * 110.0,
			randf(), (randf() - 0.5) * 0.35, (randf() - 0.5) * 0.05, 0)
		k += 1
	# TALO: coluna em leve espiral
	for i in N_STEM:
		var ang := randf() * TAU
		var radF := 0.35 + randf() * 0.65
		var yF := 0.04 + (float(i) / N_STEM) * 0.90 + randf() * 0.05
		var drift: float = (1.0 if randf() < 0.5 else -1.0) * (0.04 + randf() * 0.05)
		_set_puff(mm, k, ang, radF, yF, 95.0 + randf() * 70.0,
			randf(), (randf() - 0.5) * 0.5, drift, 1)
		k += 1
	# SAIA: anel de poeira na base
	for i in N_SKIRT:
		var ang := (float(i) / N_SKIRT) * TAU + randf() * 0.4
		var radF := 0.75 + randf() * 0.35
		_set_puff(mm, k, ang, radF, randf(), 60.0 + randf() * 60.0,
			randf(), (randf() - 0.5) * 0.4, (randf() - 0.5) * 0.06, 2)
		k += 1
	_puff_mat = ShaderMaterial.new()
	_puff_mat.shader = _puff_shader
	_puff_mat.set_shader_parameter("uMap", _smoke_texture())
	_puff_mat.set_shader_parameter("uSkirtR", SKIRT_R)
	_puff_mat.set_shader_parameter("uGroundY", _ground_y)
	_puff_mat.set_shader_parameter("uHot", FIRE_STOPS[0])
	_puff_mat.set_shader_parameter("uMid", Color8(0xc4, 0xb6, 0xa4))
	_puff_mat.set_shader_parameter("uCool", Color8(0xbd, 0xb3, 0xa6))
	_puff_mat.set_shader_parameter("uTailFade", 1.0)
	_puffs = MultiMeshInstance3D.new()
	_puffs.name = "NukePuffs"
	_puffs.multimesh = mm
	_puffs.material_override = _puff_mat
	# Bounding estático mentiria — a shape é animada na GPU
	_puffs.custom_aabb = AABB(Vector3(-1200, -100, -1200), Vector3(2400, 2400, 2400))
	add_child(_puffs)


## Empacota aShape/aSeed/aKind normalizados 0..1 (buffer RGBA8 — ver PUFF_SHADER).
func _set_puff(mm: MultiMesh, i: int, ang: float, radF: float, yF: float,
		scl: float, seed: float, spin: float, drift: float, kind: int) -> void:
	mm.set_instance_transform(i, Transform3D.IDENTITY)
	mm.set_instance_custom_data(i, Color(ang / TAU, radF / 1.2,
		(yF + 0.2) / 1.2, (scl - 40.0) / 220.0))
	mm.set_instance_color(i, Color(seed, (spin + 1.0) * 0.5,
		(drift + 0.1) * 5.0, kind / 2.0))


func _build_shock_ring() -> void:
	_shock_mat = _ring_material(Color8(0xff, 0xf0, 0xaa))
	_shock_ring = MeshInstance3D.new()
	_shock_ring.mesh = _flat_ring_mesh()
	_shock_ring.material_override = _shock_mat
	_shock_ring.position.y = _ground_y + 0.5
	add_child(_shock_ring)


func _build_wilson() -> void:
	for i in 2:
		var mesh := TorusMesh.new()
		mesh.inner_radius = 0.945
		mesh.outer_radius = 1.055
		mesh.rings = 48
		mesh.ring_segments = 8
		var w := MeshInstance3D.new()
		w.mesh = mesh
		var mat := _ring_material(Color(1, 1, 1, 0))
		w.material_override = mat
		add_child(w)
		_wilson.append(w)
		_wilson_mats.append(mat)


func _build_light() -> void:
	_light = OmniLight3D.new()
	_light.light_color = Color8(0xff, 0xaa, 0x44)
	_light.light_energy = 8.0
	_light.omni_range = 2200.0
	_light.position.y = _ground_y + 60.0
	add_child(_light)


## Bursts iniciais (fx.js#nuclearExplosion): anéis + explosões agendadas.
func _schedule_bursts() -> void:
	var center := Vector3(_pos.x, _ground_y, _pos.z) - global_position
	_events.append([0.0, _burst_ring.bind(center, 280.0, Color(1, 1, 1))])
	_events.append([0.0, _burst_ring.bind(center + Vector3(0, 0.5, 0), 320.0, Color8(0xff, 0xdd, 0x88))])
	_events.append([0.0, _burst_explosion.bind(28.0, Vector3.ZERO)])
	_events.append([0.08, _burst_explosion.bind(18.0, Vector3.ZERO)])
	_events.append([0.3, _burst_explosion.bind(15.0, Vector3.ZERO)])
	_events.append([0.3, _burst_ring.bind(center, 480.0, Color8(0xff, 0xee, 0xaa))])
	_events.append([0.7, _burst_ring.bind(center, 700.0, Color8(0xdd, 0xcc, 0xaa))])
	# 7 explosões secundárias perto do epicentro (offset ±110 m), 0.8–3.0 s
	for i in 7:
		var delay := 0.8 + (float(i) / 7) * 2.0 + randf() * 0.3
		var off := Vector3(randf_range(-110, 110), 0, randf_range(-110, 110))
		_events.append([delay, _burst_explosion.bind(3.0 + randf() * 6.0, off)])
	_events.sort_custom(func(a, b): return a[0] < b[0])


func _burst_explosion(scale: float, local_off: Vector3) -> void:
	if _fx == null:
		return
	# Explosões na altura do impacto (ou do solo, o que for mais alto)
	_fx.explosion(Vector3(_pos.x, maxf(_pos.y, _ground_y), _pos.z) + local_off, scale)


func _burst_ring(local_pos: Vector3, max_r: float, color: Color) -> void:
	var mat := _ring_material(color)
	var mi := MeshInstance3D.new()
	mi.mesh = _flat_ring_mesh()
	mi.material_override = mat
	mi.position = local_pos
	add_child(mi)
	_rings.append({"mi": mi, "mat": mat, "t": 0.0, "dur": 0.8, "max_r": max_r,
		"alpha": color.a})


## Duas cicatrizes escuras no chão (0x0c0a08; raios 0.30×/0.525× do blast).
func _spawn_scorch() -> void:
	for spec in [[GameConfig.NUKE_RADIUS * 0.30, 0.62], [GameConfig.NUKE_RADIUS * 0.525, 0.24]]:
		var mesh := CylinderMesh.new()
		mesh.top_radius = spec[0]
		mesh.bottom_radius = spec[0]
		mesh.height = 0.05
		mesh.radial_segments = 32
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.albedo_color = Color(0.047, 0.039, 0.031, spec[1])
		var mi := MeshInstance3D.new()
		mi.mesh = mesh
		mi.material_override = mat
		mi.position.y = _ground_y + 0.3
		add_child(mi)
		# Persiste ~90 s, desvanece nos últimos 20 (web spawnScorchMark)
		var tw := mi.create_tween()
		tw.tween_interval(70.0)
		tw.tween_property(mat, "albedo_color:a", 0.0, 20.0)
		tw.tween_callback(mi.queue_free)


## Cratera: afunda os vértices dos chunks dentro do blast (dent máx 30 m no
## centro) e recomputa as normais. Simplificação: SÓ a malha visual — a
## função height_at (colisão) não muda, como no web.
func _deform_crater() -> void:
	var terrain := _find_terrain(get_tree().current_scene)
	if terrain == null:
		return
	var R := GameConfig.NUKE_RADIUS
	var n := InhaumaTerrain.CHUNK_VERTS + 1
	var step: float = InhaumaTerrain.CHUNK_SIZE / InhaumaTerrain.CHUNK_VERTS
	for mi in terrain.get_children():
		if not (mi is MeshInstance3D):
			continue
		var mesh: ArrayMesh = mi.mesh
		if mesh == null or mesh.get_surface_count() == 0:
			continue
		var arrays := mesh.surface_get_arrays(0)
		var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		if verts.size() != n * n:
			continue
		# Rejeição rápida: canto do chunk longe demais do epicentro
		if Vector2(verts[0].x - _pos.x, verts[0].z - _pos.z).length() > R + 1200.0:
			continue
		var changed := false
		for i in verts.size():
			var v := verts[i]
			var d := Vector2(v.x - _pos.x, v.z - _pos.z).length()
			if d < R:
				v.y -= (1.0 - d / R) * 30.0
				verts[i] = v
				changed = true
		if not changed:
			continue
		var normals := PackedVector3Array()
		normals.resize(n * n)
		for iz in n:
			for ix in n:
				var i := iz * n + ix
				var hxp: float = verts[iz * n + mini(ix + 1, n - 1)].y
				var hxm: float = verts[iz * n + maxi(ix - 1, 0)].y
				var hzp: float = verts[mini(iz + 1, n - 1) * n + ix].y
				var hzm: float = verts[maxi(iz - 1, 0) * n + ix].y
				normals[i] = Vector3(-(hxp - hxm) / (2.0 * step), 1.0,
					-(hzp - hzm) / (2.0 * step)).normalized()
		arrays[Mesh.ARRAY_VERTEX] = verts
		arrays[Mesh.ARRAY_NORMAL] = normals
		mesh.clear_surfaces()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)


## Coluna de fumaça residual no epicentro por 60 s (padrão chimney smoke).
func _build_residual_smoke() -> void:
	_residual = GPUParticles3D.new()
	_residual.amount = 10
	_residual.lifetime = 3.5
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	pm.emission_sphere_radius = 2.0
	pm.direction = Vector3.UP
	pm.spread = 10.0
	pm.initial_velocity_min = 3.0
	pm.initial_velocity_max = 5.5
	pm.gravity = Vector3.ZERO
	pm.scale_min = 2.0
	pm.scale_max = 5.0
	var grad := Gradient.new()
	grad.set_color(0, Color(0.30, 0.28, 0.26, 0.55))
	grad.set_color(1, Color(0.60, 0.58, 0.55, 0.0))
	var gt := GradientTexture1D.new()
	gt.gradient = grad
	pm.color_ramp = gt
	_residual.process_material = pm
	var mesh := QuadMesh.new()
	mesh.size = Vector2.ONE
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = _smoke_texture()
	mat.vertex_color_use_as_albedo = true
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mesh.material = mat
	_residual.draw_pass_1 = mesh
	add_child(_residual)
	_residual.position.y = _ground_y + 10.0
	_residual.emitting = true


# ---------------------------------------------------------------------------
# Firestorm (firestorm.js): coleta de inflamáveis + pools de chama/fumaça
# ---------------------------------------------------------------------------

## Todo inflamável dentro de 260 m: instâncias de MultiMesh com cor (floresta
## e cidade) + alvos. Cap 64 focos, prioridade aos mais próximos do epicentro.
func _collect_firestorm_emitters() -> void:
	var cands: Array = []
	var R2 := FS_RADIUS * FS_RADIUS
	_scan_mmis(get_tree().current_scene, R2, cands)
	for t in GameState.targets:
		var d2 := Vector2(t.global_position.x - _pos.x, t.global_position.z - _pos.z).length_squared()
		if d2 <= R2:
			cands.append({"pos": t.global_position + Vector3(0, 2, 0), "scale": 1.5,
				"d2": d2, "chars": _target_char_entries(t)})
	cands.sort_custom(func(a, b): return a.d2 < b.d2)
	for c in cands.slice(0, FS_MAX_EMITTERS):
		_fs_emitters.append({"pos": c.pos, "scale": c.scale, "t": 0.0,
			"cool": randf() * 0.1, "char_cool": 0.0, "char_k": -1.0, "chars": c.chars})


func _scan_mmis(node: Node, R2: float, cands: Array) -> void:
	if node is MultiMeshInstance3D and not node.name.begins_with("Nuke"):
		var mm: MultiMesh = node.multimesh
		if mm != null and mm.use_colors:
			var is_city := node.name.begins_with("City")
			for i in mm.instance_count:
				var wp: Vector3 = node.to_global(mm.get_instance_transform(i).origin)
				var d2 := Vector2(wp.x - _pos.x, wp.z - _pos.z).length_squared()
				if d2 <= R2:
					cands.append({"pos": wp, "scale": 1.8 if is_city else 1.0, "d2": d2,
						"chars": [{"mm": mm, "idx": i, "orig": mm.get_instance_color(i)}]})
	for c in node.get_children():
		_scan_mmis(c, R2, cands)


## Entradas de carbonização de um alvo (Group): materiais clonados 1× — os
## materiais são compartilhados por cache entre unidades (como no web).
func _target_char_entries(t: Node3D) -> Array:
	var out: Array = []
	for mi in t.find_children("*", "MeshInstance3D", true, false):
		var mat: Material = mi.material_override
		if mat == null:
			mat = mi.get_active_material(0)
		if mat == null or not (mat is StandardMaterial3D):
			continue
		if not _mat_clones.has(mat):
			var clone: StandardMaterial3D = mat.duplicate()
			_mat_clones[mat] = clone
			out.append({"mat": clone, "orig": clone.albedo_color})
		mi.material_override = _mat_clones[mat]
	return out


func _apply_char(em: Dictionary, k: float) -> void:
	for e in em.chars:
		if e.has("mm"):
			e.mm.set_instance_color(e.idx, e.orig.lerp(Color.BLACK, k))
		else:
			e.mat.albedo_color = e.orig.lerp(Color.BLACK, k)


## Pools de puffs do firestorm: 2 MultiMeshes (chama aditiva + fumaça), 1 draw
## call cada — transforms/cores atualizados por frame, zero alocação.
func _build_firestorm_pools() -> void:
	_flame_mm = _make_puff_pool(FS_FLAME_POOL, true)
	_smoke_mm = _make_puff_pool(FS_SMOKE_POOL, false)
	for i in FS_FLAME_POOL:
		_flame_free.append(i)
	for i in FS_SMOKE_POOL:
		_smoke_free.append(i)


func _make_puff_pool(count: int, additive: bool) -> MultiMesh:
	if _puff_sphere == null:
		_puff_sphere = SphereMesh.new()
		_puff_sphere.radius = 1.0
		_puff_sphere.height = 2.0
		_puff_sphere.radial_segments = 6
		_puff_sphere.rings = 5
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = _puff_sphere
	mm.instance_count = count
	for i in count:
		mm.set_instance_transform(i, Transform3D(Basis.from_scale(Vector3.ZERO), Vector3.ZERO))
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if additive:
		mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	var mmi := MultiMeshInstance3D.new()
	mmi.name = "NukeFirestormAdd" if additive else "NukeFirestormSmoke"
	mmi.multimesh = mm
	mmi.material_override = mat
	mmi.custom_aabb = AABB(Vector3(-FS_RADIUS - 30, -30, -FS_RADIUS - 30),
		Vector3((FS_RADIUS + 30) * 2, 120, (FS_RADIUS + 30) * 2))
	add_child(mmi)
	return mm


func _puff_flame(em: Dictionary) -> void:
	if _flame_free.is_empty():
		return
	var i: int = _flame_free.pop_back()
	# Wave L7: chamas 1,8× maiores/mais altas — o firestorm se lê da bateria
	var s0: float = (0.9 + randf() * 1.3) * em.scale * 1.8
	_flames.append({"i": i, "c": FS_FIRE_COLORS[randi() % FS_FIRE_COLORS.size()],
		"p": em.pos + Vector3(randf_range(-1.3, 1.3) * em.scale,
			randf() * 2.6 * em.scale, randf_range(-1.3, 1.3) * em.scale) - global_position,
		"vy": 5.0 + randf() * 6.0, "life": 0.55 + randf() * 0.4, "max": 0.95, "sc": s0})


func _puff_smoke(em: Dictionary) -> void:
	if _smoke_free.is_empty():
		return
	var i: int = _smoke_free.pop_back()
	var s0: float = 0.8 * em.scale
	_smokes.append({"i": i,
		"p": em.pos + Vector3(randf_range(-1, 1) * em.scale, em.scale,
			randf_range(-1, 1) * em.scale) - global_position,
		"vy": 2.2 + randf() * 1.2, "life": 2.4 + randf() * 1.2, "max": 3.6, "sc": s0})


func _update_firestorm(dt: float) -> void:
	for e in range(_fs_emitters.size() - 1, -1, -1):
		var em: Dictionary = _fs_emitters[e]
		em.t += dt
		var phase := 0 if em.t < FS_FIRE_S else (1 if em.t < FS_TOTAL_S else 2)
		if phase == 2:
			_apply_char(em, 1.0)
			_fs_emitters.remove_at(e)
			continue
		# Carbonização progressiva em passos de 0,25 s (re-upa o buffer inteiro)
		em.char_cool -= dt
		var k := 1.0 if phase == 1 else clampf(em.t / FS_FIRE_S, 0.0, 1.0)
		if em.char_cool <= 0.0 and k != em.char_k:
			em.char_cool = CHAR_STEP
			em.char_k = k
			_apply_char(em, k)
		em.cool -= dt
		if em.cool > 0.0:
			continue
		if phase == 0:
			em.cool = 0.07 + randf() * 0.08
			_puff_flame(em)
		else:
			em.cool = 0.55 + randf() * 0.45
			_puff_smoke(em)
	for j in range(_flames.size() - 1, -1, -1):
		var f: Dictionary = _flames[j]
		f.life -= dt
		if f.life <= 0.0:
			_flame_mm.set_instance_transform(f.i, Transform3D(Basis.from_scale(Vector3.ZERO), Vector3.ZERO))
			_flame_free.append(f.i)
			_flames.remove_at(j)
			continue
		f.p.y += f.vy * dt
		f.vy *= pow(0.96, dt * 60.0)
		var u := maxf(0.0, f.life / f.max)
		var s: float = f.sc * (0.6 + (1.0 - u) * 1.4)
		_flame_mm.set_instance_transform(f.i, Transform3D(Basis.from_scale(Vector3(s, s, s)), f.p))
		_flame_mm.set_instance_color(f.i, Color(f.c, u * 0.9))
	for j in range(_smokes.size() - 1, -1, -1):
		var s: Dictionary = _smokes[j]
		s.life -= dt
		if s.life <= 0.0:
			_smoke_mm.set_instance_transform(s.i, Transform3D(Basis.from_scale(Vector3.ZERO), Vector3.ZERO))
			_smoke_free.append(s.i)
			_smokes.remove_at(j)
			continue
		s.p.y += s.vy * dt
		s.vy *= pow(0.99, dt * 60.0)
		var u := maxf(0.0, s.life / s.max)
		var sc: float = s.sc * (1.0 + (1.0 - u) * 3.2)
		_smoke_mm.set_instance_transform(s.i, Transform3D(Basis.from_scale(Vector3(sc, sc, sc)), s.p))
		_smoke_mm.set_instance_color(s.i, Color(FS_SMOKE_COLOR, u * 0.5))


# ---------------------------------------------------------------------------
# Update central (updateNuclearFx + updateFirestorm do web)
# ---------------------------------------------------------------------------

func _process(delta: float) -> void:
	var dt := minf(delta, 0.1)
	_t += dt
	var t := _t
	# Eventos agendados dos bursts
	while _ev_idx < _events.size() and _events[_ev_idx][0] <= t:
		_events[_ev_idx][1].call()
		_ev_idx += 1
	# Anéis dos bursts
	for i in range(_rings.size() - 1, -1, -1):
		var r: Dictionary = _rings[i]
		r.t += dt
		var k: float = r.t / r.dur
		if k >= 1.0:
			r.mi.queue_free()
			_rings.remove_at(i)
			continue
		r.mi.scale = Vector3.ONE * (0.5 + k * r.max_r)
		r.mat.albedo_color.a = r.alpha * (1.0 - k)
	# Flash de tela: pulso inicial (fade de 2,5 s) + SEGUNDO pulso em t=0,15
	if _flash_rect:
		var a1 := maxf(0.0, 1.0 - maxf(0.0, t - 0.08) / 2.5)
		var a2 := maxf(0.0, 1.0 - (t - 0.15) / 2.5) if t >= 0.15 else 0.0
		_flash_rect.color = Color(1, 1, 1, maxf(a1, a2))
		if t > 2.8:
			_flash_layer.queue_free()
			_flash_rect = null
	if not _mushroom_done:
		_update_mushroom(t)
	_update_firestorm(dt)
	# Cogumelo termina aos 60 s (web LIFETIME); firestorm segue até 180 s
	if not _mushroom_done and t >= LIFETIME:
		_mushroom_done = true
		for n in [_fire, _puffs, _shock_ring, _light, _residual]:
			if is_instance_valid(n):
				n.queue_free()
		for w in _wilson:
			w.queue_free()
		_wilson.clear()
		_wilson_mats.clear()
	if t >= FS_TOTAL_S + 5.0:
		queue_free()


func _update_mushroom(t: float) -> void:
	# Subida da pluma: ease-out até o teto em RISE_T s, depois segura
	var rise := _plume_rise_fraction(t)
	var plume_h := rise * CEILING
	var wob_x := (sin(t * 0.9) * 8.0 + cos(t * 0.47) * 6.0) * (0.4 + rise)
	var wob_z := (cos(t * 0.73) * 7.0 + sin(t * 0.39) * 5.0) * (0.4 + rise)
	var tail_fade := maxf(0.0, 1.0 - (t - (LIFETIME - 15.0)) / 15.0) if t > LIFETIME - 15.0 else 1.0
	# Fireball: cresce eased ~3,6 s, sobe eased até o topo da pluma ~5,5 s, some ~9 s
	var fire_r := _fireball_growth(t)
	var fire_rise := _fireball_rise(t, plume_h)
	var fire_fade := _fireball_fade(t)
	_fire.position = Vector3(wob_x * 0.6, _ground_y + fire_rise, wob_z * 0.6)
	_fire.scale = Vector3.ONE * fire_r
	_fire_mat.set_shader_parameter("uTime", t)
	_fire_mat.set_shader_parameter("uFade", fire_fade)
	_fire.visible = fire_fade > 0.01
	# Puffs: só uniforms — a animação é toda na GPU
	_puff_mat.set_shader_parameter("uTime", t)
	_puff_mat.set_shader_parameter("uPlumeH", maxf(40.0, plume_h))
	_puff_mat.set_shader_parameter("uCapHalfW", 40.0 + rise * (CAP_HALF_W - 40.0))
	_puff_mat.set_shader_parameter("uCapH", 60.0 + rise * (CAP_H - 60.0))
	_puff_mat.set_shader_parameter("uStemR", 34.0 + rise * (STEM_R - 34.0))
	_puff_mat.set_shader_parameter("uWob", Vector2(wob_x, wob_z))
	# Copa herda a cor do fogo nos primeiros ~4,5 s (iluminada por dentro)
	_puff_mat.set_shader_parameter("uHot", _fire_color_at(minf(1.0, t / 4.5)))
	_puff_mat.set_shader_parameter("uTailFade", tail_fade)
	# Anéis de condensação (Wilson): expandem e somem em ~7 s
	for wi in _wilson.size():
		var w := _wilson[wi]
		var wt := t - 1.0 - wi * 1.6
		if wt < 0.0 or wt > 6.5:
			_wilson_mats[wi].albedo_color.a = 0.0
			continue
		var wr := 60.0 + wt * 90.0
		w.scale = Vector3.ONE * wr
		w.position.y = _ground_y + fire_rise * (0.55 + wi * 0.22)
		_wilson_mats[wi].albedo_color.a = 0.5 * sin(minf(1.0, wt / 6.5) * PI)
	# Shockwave de solo: varre até 750 m a 220 m/s e some
	_shock_ring.scale = Vector3.ONE * _shockwave_radius(t)
	_shock_mat.albedo_color.a = maxf(0.0, 0.85 - t * 0.24)
	# Luz transitória
	if t >= 3.2:
		_light.light_energy = 0.0
	else:
		_light.light_energy = 8.0 * (1.0 - t / 3.2)


# ---------------------------------------------------------------------------
# Curvas puras (nuclear-fx.js — port EXATO)
# ---------------------------------------------------------------------------

static func _plume_rise_fraction(t: float) -> float:
	var rise_lin := minf(1.0, t / RISE_T)
	return 1.0 - (1.0 - rise_lin) * (1.0 - rise_lin)


static func _fireball_growth(t: float) -> float:
	var u := clampf(t / FIREBALL_GROW_T, 0.0, 1.0)
	var eased := 1.0 - (1.0 - u) * (1.0 - u)
	return FIREBALL_R_BASE + eased * (FIREBALL_R_MAX - FIREBALL_R_BASE)


static func _fireball_fade(t: float) -> float:
	return maxf(0.0, 1.0 - t / FIREBALL_FADE_T)


static func _fireball_rise(t: float, plume_h: float) -> float:
	var u := clampf(t / FIREBALL_RISE_T, 0.0, 1.0)
	var eased := 1.0 - (1.0 - u) * (1.0 - u)
	var target := maxf(plume_h, FIREBALL_RISE_BASE)
	return FIREBALL_RISE_BASE + eased * (target - FIREBALL_RISE_BASE)


static func _shockwave_radius(t: float) -> float:
	return minf(SHOCKWAVE_MAX_R, t * SHOCKWAVE_RATE)


## Rampa de fogo: branco-quente → amarelo → laranja → vermelho (FIRE_STOPS).
static func _fire_color_at(u: float) -> Color:
	var n := FIRE_STOPS.size() - 1
	var c := clampf(u, 0.0, 1.0)
	var seg := clampi(int(floor(c * n)), 0, n - 1)
	var lt := clampf(c * n - seg, 0.0, 1.0)
	return FIRE_STOPS[seg].lerp(FIRE_STOPS[seg + 1], lt)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

## Slow-mo global 0,35× por 1,5 s (guard contra nukes sobrepostas).
func _slowmo() -> void:
	if _slowmo_active:
		return
	_slowmo_active = true
	Engine.time_scale = GameConfig.NUKE_SLOWMO
	get_tree().create_timer(GameConfig.NUKE_SLOWMO_TIME, true, false, true).timeout.connect(
		func():
			Engine.time_scale = 1.0
			_slowmo_active = false)


## Shake proporcional à distância do jogador (14×max(0.2, 1-d/680) por 5 s).
func _shake_camera() -> void:
	var player: Node3D = GameState.player
	if player == null:
		return
	var pd: float = _pos.distance_to(player.global_position)
	if pd >= GameConfig.NUKE_PLAYER_LIFE_R:
		return
	var intensity: float = GameConfig.NUKE_SHAKE * maxf(0.2, 1.0 - pd / GameConfig.NUKE_PLAYER_LIFE_R)
	var cam := get_viewport().get_camera_3d()
	if cam and cam.has_method("shake"):
		cam.shake(intensity)


func _ring_material(color: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.albedo_color = color
	mat.no_depth_test = false
	return mat


## Anel plano no plano XZ (RingGeometry(1, 1.06, 72) do web) — cache estático.
static func _flat_ring_mesh() -> ArrayMesh:
	if _ring_mesh:
		return _ring_mesh
	const SEGS := 72
	var verts := PackedVector3Array()
	var indices := PackedInt32Array()
	for i in SEGS:
		var a := (float(i) / SEGS) * TAU
		verts.append(Vector3(cos(a), 0, sin(a)))
		verts.append(Vector3(cos(a) * 1.06, 0, sin(a) * 1.06))
	for i in SEGS:
		var a := i * 2
		var b := (a + 2) % (SEGS * 2)
		indices.append_array([a, b, a + 1, b, b + 1, a + 1])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_INDEX] = indices
	_ring_mesh = ArrayMesh.new()
	_ring_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return _ring_mesh


## Textura procedural de puff de fumaça 128² (port de smokeTexture): 64 blobs
## radiais + falloff gaussiano central. Gerada 1× por sessão.
static func _smoke_texture() -> ImageTexture:
	if _smoke_tex:
		return _smoke_tex
	const S := 128
	var acc := PackedFloat32Array()
	acc.resize(S * S)
	# Acumula os blobs só dentro da caixa de cada um (evita 1M de iterações)
	for i in 64:
		var a := randf() * TAU
		var rr := pow(randf(), 1.6) * S * 0.30
		var cx := S * 0.5 + cos(a) * rr
		var cy := S * 0.5 + sin(a) * rr
		var r := S * (0.07 + randf() * 0.14)
		var al := 0.10 + randf() * 0.16
		for y in range(maxi(0, int(cy - r)), mini(S, int(cy + r) + 1)):
			for x in range(maxi(0, int(cx - r)), mini(S, int(cx + r) + 1)):
				var d := Vector2(x - cx, y - cy).length()
				if d < r:
					acc[y * S + x] += al * (1.0 - d / r)
	var img := Image.create(S, S, false, Image.FORMAT_RGBA8)
	for y in S:
		for x in S:
			var md := Vector2(x - S * 0.5, y - S * 0.5).length()
			var mask := 1.0 - smoothstep(S * 0.18, S * 0.5, md)
			img.set_pixel(x, y, Color(1, 1, 1, minf(acc[y * S + x], 1.0) * mask))
	_smoke_tex = ImageTexture.create_from_image(img)
	return _smoke_tex


func _find_terrain(node: Node) -> InhaumaTerrain:
	if node is InhaumaTerrain:
		return node
	for c in node.get_children():
		var found := _find_terrain(c)
		if found:
			return found
	return null


func _find_fx(node: Node) -> FxManager:
	if node is FxManager:
		return node
	for c in node.get_children():
		var found := _find_fx(c)
		if found:
			return found
	return null

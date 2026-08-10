class_name HordeFormation
extends Node3D
## HordeFormation — a horda (port de formations/formation.js + units.js +
## defense-mode.js#spawnHorde/updateHorde): batalhão de 28 unidades em BLOCO
## retangular (Wave L5 — "um quadrado de blindados e tropas, não uma linha
## reta"): 24 terrestres em grid 6×4 (ciclo tank/apc/truck/troops, espaçamento
## 20 m) + 4 helis flanqueando acima, marchando do horizonte (2 km) até
## Inhaúma a 24 m/s. 1 MultiMesh por tipo (5 draw calls), wreck congelado ao
## morrer (heli CAI no chão), y na grade rápida de altura, pitch ≤ ±0,32.

enum UnitType { TANK, APC, TRUCK, TROOPS, HELI }

const MAX_PITCH := 0.32
const RX90 := Vector3(PI / 2, 0, 0)
const RZ90 := Vector3(0, 0, PI / 2)
# Composição terrestre: 24 unidades no grid 6×4 → 6 tank, 6 apc, 6 truck, 6 troops
const CYCLE: Array[UnitType] = [UnitType.TANK, UnitType.APC, UnitType.TRUCK,
	UnitType.TROOPS]
const HELI_ALT_MIN := 25.0 # m sobre o terreno
const HELI_ALT_STEP := 5.0 # variação por índice (25-40 m)
const PAL := {
	"hull": Color8(0x4b, 0x51, 0x33), "armor": Color8(0x3d, 0x40, 0x29),
	"dark": Color8(0x16, 0x16, 0x13), "tire": Color8(0x10, 0x10, 0x10),
	"canvas": Color8(0x6f, 0x73, 0x55), "glass": Color8(0x7f, 0xd0, 0xff),
	"skin": Color8(0x9c, 0x84, 0x68), "cloth": Color8(0x55, 0x60, 0x3c),
	"accent": Color8(0x8f, 0x8a, 0x5e),
}

static var _mesh_cache := {} # UnitType -> ArrayMesh (vertex colors)
static var _mat: StandardMaterial3D

var arrived := false
var path_length := 0.0
var max_back := 0.0
var progress := 0.0
var _dust_t := 0.0

var _from := Vector2.ZERO
var _to := Vector2.ZERO
var _yaw := 0.0
var _surface: Callable
var _fx: FxManager
var _members: Array[Dictionary] = [] # {type, slot, offset_back, alive, pos, pitch, prev_y}
var _mms: Dictionary = {} # UnitType -> MultiMesh


## Monta a horda no ARCO FRONTAL ±45° do eixo bateria→cidade (Wave L3 — o
## operador VÊ a horda marchar do horizonte na direção que está olhando).
## Tenta até 6 rumos (π/3, re-clampado no arco) evitando spawn dentro do rio.
static func create(bearing: float, surface_fn: Callable, fx: FxManager,
		river_check: Callable) -> HordeFormation:
	var c := GameConfig.AA_LOOK_AT
	var front := atan2(c.y - GameConfig.AA_SOLDIER_POS.y, c.x - GameConfig.AA_SOLDIER_POS.x)
	# bearing aleatório do diretor → remapeado para o arco frontal ±45°
	var base := front + wrapf(bearing, -PI, PI) / 4.0
	for k in 6:
		var a := base + k * (PI / 3)
		a = front + clampf(wrapf(a - front, -PI, PI), -GameConfig.AAD_DIR_ARC, GameConfig.AAD_DIR_ARC)
		var from := c + Vector2(cos(a), sin(a)) * GameConfig.HORDE_DIST
		if river_check.is_valid() and river_check.call(from.x, from.y):
			continue # spawn dentro do rio — próximo rumo
		var h := HordeFormation.new()
		h._setup(from, c, surface_fn, fx)
		return h
	return null


func _setup(from: Vector2, to: Vector2, surface_fn: Callable, fx: FxManager) -> void:
	_from = from
	_to = to
	_surface = surface_fn
	_fx = fx
	path_length = from.distance_to(to)
	_yaw = atan2(-(to.x - from.x), -(to.y - from.y)) # frente -Z rumo à cidade
	# BLOCO retangular (Wave L5): terrestres no grid COLS×ROWS (lateral no eixo
	# perp, offset_back no eixo da marcha); helis flanqueiam acima do bloco
	var spacing: float = GameConfig.HORDE_SPACING
	var cols: int = GameConfig.HORDE_COLS
	var ground_n: int = GameConfig.HORDE_SIZE - GameConfig.HORDE_HELIS
	var counts := [0, 0, 0, 0, 0]
	for i in ground_n:
		var t: int = CYCLE[i % CYCLE.size()]
		var row := i / cols
		var col := i % cols
		_members.append({"type": t, "slot": counts[t], "offset_back": row * spacing,
			"alive": true, "pos": Vector3.ZERO, "pitch": 0.0, "prev_y": NAN,
			"altitude": 0.0, "side": (col - (cols - 1) * 0.5) * spacing})
		counts[t] += 1
	# Helis (Wave H/L5): 25-40 m de altitude, flanqueando o bloco (± fora das
	# laterais do grid), escalonados na profundidade da marcha
	for h in GameConfig.HORDE_HELIS:
		var alt := HELI_ALT_MIN + (h % 4) * HELI_ALT_STEP
		var side := (cols * 0.5 * spacing + 14.0 + (h % 2) * 12.0) * (1.0 if h % 2 == 0 else -1.0)
		_members.append({"type": UnitType.HELI, "slot": counts[UnitType.HELI],
			"offset_back": (h % 3) * spacing * 1.5, "alive": true, "pos": Vector3.ZERO,
			"pitch": 0.0, "prev_y": NAN, "altitude": alt, "side": side})
		counts[UnitType.HELI] += 1
	max_back = (ground_n / cols - 1) * spacing
	progress = max_back # o bloco já nasce inteiro sobre o path
	# 1 MultiMesh por tipo (1 draw call cada)
	if _mat == null:
		_mat = StandardMaterial3D.new()
		_mat.vertex_color_use_as_albedo = true
		_mat.roughness = 0.9
		_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var aabb := AABB(Vector3(minf(from.x, to.x) - 130, -20, minf(from.y, to.y) - 130),
		Vector3(absf(from.x - to.x) + 260, 400, absf(from.y - to.y) + 260))
	for t in 5:
		if counts[t] == 0:
			continue
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = _unit_mesh(t)
		mm.instance_count = counts[t]
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.material_override = _mat
		mmi.custom_aabb = aabb
		add_child(mmi)
		_mms[t] = mm
	_place_all()


func alive_count() -> int:
	var n := 0
	for m in _members:
		if m.alive:
			n += 1
	return n


## Centroide das unidades vivas (mira da nuke / explosão de chegada).
func centroid() -> Vector3:
	var c := Vector3.ZERO
	var n := 0
	for m in _members:
		if m.alive:
			c += m.pos
			n += 1
	return c / n if n > 0 else Vector3.ZERO


## ETA da chegada à cidade (web: (pathLength + maxBack - progress) / speed).
func eta() -> float:
	return maxf(0.0, (path_length + max_back - progress) / GameConfig.HORDE_SPEED)


## Posições das unidades vivas (blips do minimapa).
func blip_positions() -> Array[Vector3]:
	var out: Array[Vector3] = []
	for m in _members:
		if m.alive:
			out.append(m.pos)
	return out


## Wipe por raio (nuke 150 m / bomba pesada 25 m): mortos viram wreck congelado
## (a matriz da instância não é mais atualizada; HELI cai no chão) + explosão.
func kill_within(center: Vector3, radius: float) -> int:
	var killed := 0
	for m in _members:
		if not m.alive:
			continue
		if center.distance_to(m.pos) < radius:
			m.alive = false
			killed += 1
			GameState.score += GameConfig.HORDE_KILL_SCORE
			if m.type == UnitType.HELI:
				_wreck_fall(m)
			if _fx:
				_fx.explosion(m.pos + Vector3(0, 1.5, 0), 0.8)
	return killed


## Heli abatido: o wreck cai na cota do terreno (congelado lá, como os demais).
func _wreck_fall(m: Dictionary) -> void:
	var gy: float = _surface.call(m.pos.x, m.pos.z) if _surface.is_valid() else m.pos.y
	m.pos.y = gy
	_mms[m.type].set_instance_transform(m.slot,
		Transform3D(Basis.from_euler(Vector3(0.25, _yaw, 0)), m.pos))


func _physics_process(delta: float) -> void:
	if arrived or GameState.paused:
		return
	var dt := minf(delta, 0.1)
	progress += GameConfig.HORDE_SPEED * dt
	if progress >= path_length + max_back:
		progress = path_length + max_back
		arrived = true
	_place_all()
	# Poeira da marcha (K7): o bloco se lê no horizonte a 2 km
	_dust_t -= dt
	if _dust_t <= 0.0:
		_dust_t = 0.15
		_spawn_dust()


## 2 puffs de poeira por tick em unidades terrestres vivas aleatórias.
func _spawn_dust() -> void:
	if _fx == null:
		return
	for i in 2:
		var m: Dictionary = _members[randi() % _members.size()]
		if m.alive and m.altitude <= 0.0:
			_fx.trail_puff(m.pos + Vector3(randf_range(-4, 4), 2.5, randf_range(-4, 4)))


## Marcha por arc-length (path de 2 pontos): cada membro offset_back atrás na
## marcha e `side` no eixo perpendicular (bloco); y na grade rápida; pitch pela
## rampa percorrida, clampado ±0,32. Helis voam 25-40 m acima do terreno,
## flanqueando o bloco (sem pitch).
func _place_all() -> void:
	var path_dir := (_to - _from) / path_length
	var perp := Vector2(-path_dir.y, path_dir.x)
	for m in _members:
		if not m.alive:
			continue
		var d := clampf(progress - m.offset_back, 0.0, path_length - 0.001)
		var t := d / path_length
		var x: float = _from.x + (_to.x - _from.x) * t + perp.x * m.side
		var z: float = _from.y + (_to.y - _from.y) * t + perp.y * m.side
		var y: float = (_surface.call(x, z) if _surface.is_valid() else 0.0) + m.altitude
		if m.altitude <= 0.0 and not is_nan(m.prev_y):
			var moved: float = GameConfig.HORDE_SPEED * get_physics_process_delta_time()
			if moved > 0.05:
				m.pitch = clampf(atan2(y - m.prev_y, moved), -MAX_PITCH, MAX_PITCH)
		m.prev_y = y
		m.pos = Vector3(x, y, z)
		_mms[m.type].set_instance_transform(m.slot,
			Transform3D(Basis.from_euler(Vector3(m.pitch, _yaw, 0)), m.pos))


# ---------------------------------------------------------------------------
# Meshes das unidades (port de units.js — low-poly, vertex colors)
# ---------------------------------------------------------------------------

static func _unit_mesh(t: int) -> ArrayMesh:
	if _mesh_cache.has(t):
		return _mesh_cache[t]
	var acc := MeshAccum.new()
	match t:
		UnitType.TANK:
			acc.box(Vector3(0.7, 0.9, 5.4), Vector3(-1.7, 0.55, 0), PAL.dark)
			acc.box(Vector3(0.7, 0.9, 5.4), Vector3(1.7, 0.55, 0), PAL.dark)
			acc.box(Vector3(0.78, 0.32, 5.2), Vector3(-1.7, 1.12, 0), PAL.armor)
			acc.box(Vector3(0.78, 0.32, 5.2), Vector3(1.7, 1.12, 0), PAL.armor)
			acc.box(Vector3(3.2, 0.75, 4.7), Vector3(0, 1.05, 0), PAL.hull)
			acc.box(Vector3(3.2, 0.7, 1.5), Vector3(0, 1.02, -2.55), PAL.hull, Vector3(0.42, 0, 0))
			acc.box(Vector3(3.2, 0.35, 1.0), Vector3(0, 1.32, 2.1), PAL.armor)
			acc.cyl(0.95, 1.35, 0.8, 8, Vector3(0, 1.8, 0.3), PAL.armor)
			acc.box(Vector3(1.5, 0.6, 0.9), Vector3(0, 1.8, -0.75), PAL.armor)
			acc.box(Vector3(1.3, 0.5, 0.8), Vector3(0, 1.75, 1.35), PAL.dark)
			acc.cyl(0.13, 0.17, 3.5, 8, Vector3(0, 1.9, -2.55), PAL.dark, RX90)
			acc.cyl(0.23, 0.23, 0.55, 8, Vector3(0, 1.9, -4.15), PAL.dark, RX90)
			acc.cyl(0.34, 0.34, 0.14, 8, Vector3(0.45, 2.25, 0.35), PAL.dark)
		UnitType.APC:
			acc.box(Vector3(2.8, 1.1, 5.4), Vector3(0, 1.2, 0), PAL.hull)
			acc.box(Vector3(2.6, 0.7, 1.2), Vector3(0, 1.5, -2.6), PAL.armor, Vector3(0.4, 0, 0))
			acc.box(Vector3(2.2, 0.8, 2.0), Vector3(0, 2.05, -0.6), PAL.armor)
			acc.cyl(0.5, 0.6, 0.5, 8, Vector3(0, 2.55, -0.6), PAL.dark)
			acc.cyl(0.07, 0.08, 1.4, 6, Vector3(0, 2.6, -1.5), PAL.dark, RX90)
			acc.cyl(0.11, 0.11, 0.25, 6, Vector3(0, 2.6, -2.15), PAL.dark, RX90)
			acc.box(Vector3(0.15, 0.55, 4.6), Vector3(-1.42, 0.95, 0), PAL.armor)
			acc.box(Vector3(0.15, 0.55, 4.6), Vector3(1.42, 0.95, 0), PAL.armor)
			acc.cyl(0.3, 0.3, 0.1, 8, Vector3(0.5, 2.5, 0.6), PAL.dark)
			acc.box(Vector3(2.4, 0.5, 0.08), Vector3(0, 1.1, -3.15), PAL.accent, Vector3(-0.3, 0, 0))
			for wz in [-1.8, 0.0, 1.8]:
				acc.cyl(0.45, 0.45, 0.3, 8, Vector3(-1.45, 0.45, wz), PAL.tire, RZ90)
				acc.cyl(0.45, 0.45, 0.3, 8, Vector3(1.45, 0.45, wz), PAL.tire, RZ90)
		UnitType.TRUCK:
			acc.box(Vector3(2.0, 0.5, 6.4), Vector3(0, 0.75, 0), PAL.dark)
			acc.box(Vector3(1.9, 0.85, 1.3), Vector3(0, 1.35, -2.95), PAL.hull)
			acc.box(Vector3(2.0, 1.5, 1.6), Vector3(0, 1.75, -1.95), PAL.hull)
			acc.box(Vector3(1.8, 0.6, 0.08), Vector3(0, 2.05, -2.72), PAL.glass)
			acc.box(Vector3(2.1, 0.25, 0.2), Vector3(0, 0.85, -3.6), PAL.dark)
			acc.box(Vector3(2.2, 1.7, 3.8), Vector3(0, 1.85, 0.95), PAL.canvas)
			acc.box(Vector3(2.3, 0.12, 0.12), Vector3(0, 2.72, -0.3), PAL.accent)
			acc.box(Vector3(2.3, 0.12, 0.12), Vector3(0, 2.72, 0.95), PAL.accent)
			acc.box(Vector3(2.3, 0.12, 0.12), Vector3(0, 2.72, 2.2), PAL.accent)
			acc.cyl(0.3, 0.3, 1.1, 8, Vector3(1.05, 0.85, -0.6), PAL.dark, RX90)
			for wz in [-2.3, 0.7, 2.1]:
				acc.cyl(0.5, 0.5, 0.35, 8, Vector3(-1.15, 0.5, wz), PAL.tire, RZ90)
				acc.cyl(0.5, 0.5, 0.35, 8, Vector3(1.15, 0.5, wz), PAL.tire, RZ90)
		UnitType.TROOPS: # pelotão de 6 soldados fundido numa unidade
			for i in 6:
				var x := -0.6 if i % 2 == 0 else 0.6
				var z := (floori(i / 2.0) - 1) * 1.4
				acc.cyl(0.22, 0.28, 0.95, 6, Vector3(x, 0.75, z), PAL.cloth)
				acc.sph(0.17, 6, 4, Vector3(x, 1.42, z), PAL.skin)
				acc.sph(0.19, 6, 3, Vector3(x, 1.5, z), PAL.armor, Vector3(1, 0.75, 1))
				acc.box(Vector3(0.3, 0.4, 0.15), Vector3(x, 1.0, z + 0.22), PAL.canvas)
				acc.box(Vector3(0.08, 0.08, 0.9), Vector3(x + 0.25, 1.0, z - 0.1), PAL.dark)
		UnitType.HELI: # helicóptero de ataque compacto (Wave H — disco estático)
			acc.box(Vector3(2.2, 1.6, 4.5), Vector3(0, 1.2, 0), PAL.hull) # fuselagem
			acc.box(Vector3(1.8, 0.9, 1.2), Vector3(0, 1.5, -1.8), PAL.glass) # cockpit
			acc.box(Vector3(0.5, 0.5, 3.5), Vector3(0, 1.4, 3.6), PAL.hull) # cauda
			acc.box(Vector3(0.15, 1.2, 0.8), Vector3(0, 2.2, 5.2), PAL.armor) # deriva
			acc.cyl(0.15, 0.15, 0.6, 6, Vector3(0, 2.2, 0), PAL.dark) # mastro
			acc.cyl(3.2, 3.2, 0.08, 8, Vector3(0, 2.5, 0), PAL.dark) # disco do rotor
			acc.cyl(0.7, 0.7, 0.06, 6, Vector3(0.3, 1.8, 5.2), PAL.dark, RZ90) # rotor cauda
			acc.box(Vector3(3.4, 0.2, 0.9), Vector3(0, 1.1, -0.2), PAL.armor) # asas stub
			acc.box(Vector3(0.3, 0.5, 1.2), Vector3(-1.5, 0.9, -0.2), PAL.dark) # pylons
			acc.box(Vector3(0.3, 0.5, 1.2), Vector3(1.5, 0.9, -0.2), PAL.dark)
			acc.box(Vector3(0.15, 0.5, 0.15), Vector3(-0.8, 0.35, 0.9), PAL.dark) # patins
			acc.box(Vector3(0.15, 0.5, 0.15), Vector3(0.8, 0.35, 0.9), PAL.dark)
			acc.box(Vector3(0.15, 0.15, 3.0), Vector3(-0.8, 0.1, 0.3), PAL.dark)
			acc.box(Vector3(0.15, 0.15, 3.0), Vector3(0.8, 0.1, 0.3), PAL.dark)
	var mesh := acc.build()
	_mesh_cache[t] = mesh
	return mesh


## Acumulador de geometria com vertex colors (caixa/cilindro/esfera low-poly).
class MeshAccum:
	extends RefCounted
	var verts := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	var indices := PackedInt32Array()

	func _quad(b: Basis, pos: Vector3, color: Color,
			c0: Vector3, c1: Vector3, c2: Vector3, c3: Vector3) -> void:
		var base := verts.size()
		var n := (c1 - c0).cross(c2 - c0).normalized()
		for c in [c0, c1, c2, c3]:
			verts.append(b * c + pos)
			normals.append(b * n)
			colors.append(color)
		indices.append_array([base, base + 1, base + 2, base, base + 2, base + 3])

	func box(size: Vector3, pos: Vector3, color: Color, rot := Vector3.ZERO) -> void:
		var b := Basis.from_euler(rot)
		var hx := size.x * 0.5
		var hy := size.y * 0.5
		var hz := size.z * 0.5
		_quad(b, pos, color, Vector3(hx, -hy, -hz), Vector3(hx, hy, -hz), Vector3(hx, hy, hz), Vector3(hx, -hy, hz))
		_quad(b, pos, color, Vector3(-hx, -hy, hz), Vector3(-hx, hy, hz), Vector3(-hx, hy, -hz), Vector3(-hx, -hy, -hz))
		_quad(b, pos, color, Vector3(-hx, hy, hz), Vector3(hx, hy, hz), Vector3(hx, hy, -hz), Vector3(-hx, hy, -hz))
		_quad(b, pos, color, Vector3(-hx, -hy, -hz), Vector3(hx, -hy, -hz), Vector3(hx, -hy, hz), Vector3(-hx, -hy, hz))
		_quad(b, pos, color, Vector3(hx, -hy, hz), Vector3(hx, hy, hz), Vector3(-hx, hy, hz), Vector3(-hx, -hy, hz))
		_quad(b, pos, color, Vector3(-hx, -hy, -hz), Vector3(-hx, hy, -hz), Vector3(hx, hy, -hz), Vector3(hx, -hy, -hz))

	func cyl(rt: float, rb: float, h: float, segs: int, pos: Vector3, color: Color,
			rot := Vector3.ZERO) -> void:
		var b := Basis.from_euler(rot)
		var hy := h * 0.5
		for i in segs:
			var a0 := (float(i) / segs) * TAU
			var a1 := (float(i + 1) / segs) * TAU
			var p0 := Vector3(cos(a0) * rb, -hy, sin(a0) * rb)
			var p1 := Vector3(cos(a1) * rb, -hy, sin(a1) * rb)
			var p2 := Vector3(cos(a1) * rt, hy, sin(a1) * rt)
			var p3 := Vector3(cos(a0) * rt, hy, sin(a0) * rt)
			_quad(b, pos, color, p0, p1, p2, p3)
			# Tampa e fundo (triângulo em leque simplificado por quad degenerado)
			_quad(b, pos, color, Vector3(0, hy, 0), p3, p2, Vector3(0, hy, 0))
			_quad(b, pos, color, Vector3(0, -hy, 0), p1, p0, Vector3(0, -hy, 0))

	func sph(r: float, segs: int, rings: int, pos: Vector3, color: Color,
			scale := Vector3.ONE) -> void:
		for ri in rings:
			var phi0 := (float(ri) / rings) * PI
			var phi1 := (float(ri + 1) / rings) * PI
			for si in segs:
				var a0 := (float(si) / segs) * TAU
				var a1 := (float(si + 1) / segs) * TAU
				var q00 := _sp(r, phi0, a0) * scale
				var q01 := _sp(r, phi0, a1) * scale
				var q10 := _sp(r, phi1, a0) * scale
				var q11 := _sp(r, phi1, a1) * scale
				var base := verts.size()
				for q in [q00, q01, q11, q10]:
					verts.append(q + pos)
					normals.append(q.normalized())
					colors.append(color)
				indices.append_array([base, base + 1, base + 2, base, base + 2, base + 3])

	func _sp(r: float, phi: float, a: float) -> Vector3:
		return Vector3(cos(a) * sin(phi) * r, cos(phi) * r, sin(a) * sin(phi) * r)

	func build() -> ArrayMesh:
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = verts
		arrays[Mesh.ARRAY_NORMAL] = normals
		arrays[Mesh.ARRAY_COLOR] = colors
		arrays[Mesh.ARRAY_INDEX] = indices
		var mesh := ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		return mesh

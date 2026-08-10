class_name Target
extends Node3D
## Target — alvo terrestre/aéreo destrutível (port de targets.js).
## Visual procedural distintivo por tipo; stats de GameConfig.TARGETS/UNIT_STATS.
## Registra-se em GameState.targets (fonte para lock-on, mísseis e HUD).

signal died(target: Target)

var type := ""
var hp := 1.0
var max_hp := 1.0
var score_val := 0
var hit_r := 3.0
var drop_chance := 0.0
var dead := false
var is_unit := false # true = unidade de formação (UNIT_STATS)
# Unidades de formação: fogo inimigo + movimento (formation.js)
var fire_kind := "" # 'aa' | 'ground' | '' (desarmada)
var fire_range := 0.0
var fire_interval := 0.0
var fire_timer := 0.0
var unit_speed := 0.0
var unit_alt := 0.0

static var _fx: FxManager


static func register_fx(fx: FxManager) -> void:
	_fx = fx


static func create(p_type: String, pos: Vector3) -> Target:
	var t := Target.new()
	t.type = p_type
	var stats: Dictionary = GameConfig.TARGETS.get(p_type, {})
	t.is_unit = false
	if stats.is_empty():
		stats = GameConfig.UNIT_STATS.get(p_type, {})
		t.is_unit = true
	t.hp = stats.get("hp", 5)
	t.max_hp = t.hp
	t.score_val = stats.get("score", 100)
	t.hit_r = stats.get("hit_r", 3.0)
	t.drop_chance = stats.get("drop", 0.0)
	# Campos de unidade de formação (fogo inimigo + movimento)
	t.fire_range = stats.get("range", 0.0)
	t.fire_interval = stats.get("interval", 0.0)
	t.unit_speed = stats.get("speed", 0.0)
	t.unit_alt = stats.get("alt", 0.0)
	var weapon: String = stats.get("weapon", "")
	if weapon in ["aa", "sam"]:
		t.fire_kind = "aa"
	elif weapon in ["cannon", "mg"]:
		t.fire_kind = "ground"
	t.position = pos
	t.add_child(t._build_visual(p_type))
	return t


func _enter_tree() -> void:
	if not GameState.targets.has(self):
		GameState.targets.append(self)


func _exit_tree() -> void:
	GameState.targets.erase(self)


func damage(amount: float) -> void:
	if dead:
		return
	hp -= amount
	if hp <= 0.0:
		die()


func die() -> void:
	if dead:
		return
	dead = true
	GameState.targets.erase(self)
	GameState.targets_destroyed += 1
	GameState.add_score(score_val)
	if _fx:
		if type in ["base", "factory"] or score_val >= 800:
			_fx.mega_explosion(global_position)
		else:
			_fx.explosion(global_position, 1.6)
	# Drop de pickup (esfera verde = +3 pesados; ciano 5% = +1 nuke)
	if randf() < drop_chance:
		var is_nuke := randf() < GameConfig.PICKUP_NUKE_CHANCE
		var pickup := Pickup.create(is_nuke, global_position + Vector3(0, 6, 0))
		get_parent().add_child(pickup)
	died.emit(self)
	queue_free()


# ---------------------------------------------------------------------------
# Visuais procedurais por tipo
# ---------------------------------------------------------------------------
func _build_visual(p_type: String) -> Node3D:
	var g := Node3D.new()
	match p_type:
		"base":
			_box_to(g, Vector3(20, 6, 16), Color(0.35, 0.38, 0.32), Vector3(0, 3, 0))
			_box_to(g, Vector3(4, 14, 4), Color(0.42, 0.45, 0.38), Vector3(-7, 7, -5))
			_box_to(g, Vector3(4, 10, 4), Color(0.42, 0.45, 0.38), Vector3(7, 5, 5))
		"factory":
			_box_to(g, Vector3(24, 12, 16), Color(0.55, 0.56, 0.58), Vector3(0, 6, 0))
			for i in 3:
				_cyl_to(g, 1.2, 1.6, 16, Color(0.5, 0.3, 0.25), Vector3(-8 + i * 8, 14, -9))
		"building":
			_box_to(g, Vector3(9, 26, 9), Color(0.62, 0.64, 0.66), Vector3(0, 13, 0))
			_cyl_to(g, 0.1, 0.1, 6, Color(0.3, 0.3, 0.3), Vector3(0, 29, 0))
		"convoy", "armedConvoy":
			for i in 5:
				_box_to(g, Vector3(3, 2.5, 7), Color(0.3, 0.35, 0.25) if p_type == "convoy" else Color(0.35, 0.3, 0.2),
					Vector3(0, 1.4, (i - 2) * 9.0))
		"aaGun", "fAaGun":
			_cyl_to(g, 2.5, 3.0, 2.0, Color(0.4, 0.42, 0.38), Vector3(0, 1, 0))
			_box_to(g, Vector3(0.5, 0.5, 5.0), Color(0.25, 0.25, 0.25), Vector3(0, 2.4, -2))
		"tank", "fTank":
			_box_to(g, Vector3(3.5, 1.4, 6), Color(0.32, 0.36, 0.28), Vector3(0, 1, 0))
			_box_to(g, Vector3(2.2, 1.0, 2.6), Color(0.28, 0.32, 0.24), Vector3(0, 2.2, 0))
			_box_to(g, Vector3(0.3, 0.3, 5.0), Color(0.2, 0.2, 0.2), Vector3(0, 2.4, -3))
		"helicopter", "fHelicopter":
			_box_to(g, Vector3(2.5, 2.2, 6), Color(0.3, 0.33, 0.3), Vector3(0, 0, 0))
			_box_to(g, Vector3(11, 0.15, 0.6), Color(0.15, 0.15, 0.15), Vector3(0, 1.6, 0))
		"patrolAir", "fZeppelin":
			var blimp := SphereMesh.new()
			blimp.radius = 5.0
			blimp.height = 18.0
			var mi := MeshInstance3D.new()
			mi.mesh = blimp
			mi.material_override = _mat(Color(0.6, 0.55, 0.5))
			g.add_child(mi)
		"warship":
			_box_to(g, Vector3(8, 3, 30), Color(0.35, 0.38, 0.42), Vector3(0, 1, 0))
			_box_to(g, Vector3(4, 4, 6), Color(0.4, 0.43, 0.47), Vector3(0, 4, 3))
		"fSam":
			_box_to(g, Vector3(4, 2, 6), Color(0.36, 0.4, 0.3), Vector3(0, 1, 0))
			_box_to(g, Vector3(1.2, 1.2, 5.0), Color(0.5, 0.5, 0.48), Vector3(0, 3, 0))
		"fApc", "fTruck":
			_box_to(g, Vector3(3, 2.4, 7), Color(0.33, 0.37, 0.27), Vector3(0, 1.4, 0))
		"fTroops":
			for i in 4:
				_cyl_to(g, 0.4, 0.4, 1.8, Color(0.3, 0.32, 0.25), Vector3((i % 2) * 2.0 - 1, 0.9, (i / 2) * 2.0 - 1))
		"fArtillery":
			_box_to(g, Vector3(3.5, 1.6, 6), Color(0.34, 0.38, 0.28), Vector3(0, 1, 0))
			_box_to(g, Vector3(0.5, 0.5, 8.0), Color(0.22, 0.22, 0.22), Vector3(0, 2.6, -3))
		_:
			_box_to(g, Vector3(4, 4, 4), Color(0.5, 0.3, 0.3), Vector3(0, 2, 0))
	return g


func _box_to(g: Node3D, size: Vector3, color: Color, pos: Vector3) -> void:
	var mesh := BoxMesh.new()
	mesh.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = _mat(color)
	mi.position = pos
	g.add_child(mi)


func _cyl_to(g: Node3D, top: float, bottom: float, height: float, color: Color, pos: Vector3) -> void:
	var mesh := CylinderMesh.new()
	mesh.top_radius = top
	mesh.bottom_radius = bottom
	mesh.height = height
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = _mat(color)
	mi.position = pos
	g.add_child(mi)


static func _mat(color: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.85
	return mat

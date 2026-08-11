class_name AlliedBattery
extends Node3D
## AlliedBattery — bateria aliada (port de allied-batteries.js): HP 12, engaja
## a 620 m com tracers (2,4/s, dispersão alta, sem dano mecânico) + míssil
## ocasional (~5,5 s) com 7% de acerto (dano 5). Destruída = carcaça fumegante.
## Variante REAR GUARD (PORT-GODOT §D.3): alcance 900, acerto 55%, míssil a
## 3,5 s, alvo preferencial = caça anti-jogador ou no setor traseiro ±60°.

var hp := GameConfig.AAB_HP
var dead := false
var rear_guard := false
var _director: Node
var _fx: FxManager
var _rng := RandomNumberGenerator.new()
var _tracer_t := 0.0
var _msl_t := GameConfig.AAB_MSL_INTERVAL


static func create(director: Node, fx: FxManager, pos: Vector3, rng: RandomNumberGenerator,
		p_rear_guard := false) -> AlliedBattery:
	var b := AlliedBattery.new()
	b._director = director
	b._fx = fx
	b._rng = rng
	b.rear_guard = p_rear_guard
	b.position = pos
	var base := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = 1.4
	mesh.bottom_radius = 1.8
	mesh.height = 1.4
	base.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.3, 0.45, 0.35)
	base.material_override = mat
	base.position.y = 0.7
	b.add_child(base)
	return b


func damage(amount: float) -> void:
	if dead:
		return
	hp -= amount
	if hp <= 0:
		dead = true
		if _fx:
			_fx.explosion(global_position, 2.0)
		# Carcaça fumegante permanente
		for mi in find_children("*", "MeshInstance3D"):
			var mat: StandardMaterial3D = mi.material_override.duplicate()
			mat.albedo_color = Color(0.1, 0.1, 0.1)
			mi.material_override = mat


func _physics_process(delta: float) -> void:
	if dead or not GameState.running or GameState.paused:
		return
	var dt := minf(delta, 0.1)
	var range: float = GameConfig.REAR_BATT_RANGE if rear_guard else GameConfig.AAB_ENGAGE_R
	# Engaja o caça mais próximo em alcance; a retaguarda prioriza caças
	# anti-jogador ou dentro do setor traseiro (prioridade vence distância)
	var best: Node3D = null
	var best_d := range
	var rear_axis := _rear_axis()
	for f in _director.fighters:
		if not is_instance_valid(f) or f.dead:
			continue
		var d: float = global_position.distance_to(f.global_position)
		if rear_guard and d < GameConfig.REAR_BATT_RANGE and _is_rear_threat(f, rear_axis):
			best = f
			break
		if d < best_d:
			best_d = d
			best = f
	if best == null:
		return
	# Tracers de supressão (visuais, sem dano mecânico)
	_tracer_t -= dt
	if _tracer_t <= 0.0:
		_tracer_t = 1.0 / (GameConfig.REAR_BATT_RPS if rear_guard else GameConfig.AAB_TRACER_RATE)
		if _fx:
			var near: Vector3 = best.global_position + Vector3(
				_rng.randf_range(-40, 40), _rng.randf_range(-20, 20), _rng.randf_range(-40, 40))
			_fx.smoke_puff(near)
	# Míssil (retaguarda: 3,5 s e 55% de acerto; padrão: ~5,5 s e 7%)
	_msl_t -= dt
	if _msl_t <= 0.0:
		_msl_t = GameConfig.REAR_BATT_MSL_S if rear_guard else GameConfig.AAB_MSL_INTERVAL
		var hit_p := GameConfig.REAR_BATT_HIT_P if rear_guard else GameConfig.AAB_MSL_HIT_CHANCE
		if _rng.randf() < hit_p:
			best.damage(999 if rear_guard else GameConfig.AAB_MSL_DAMAGE)
			if _fx:
				_fx.explosion(best.global_position, 1.2)
		elif rear_guard and _fx:
			# Quase-acerto: curva com offset +24/+30 m (web allied-batteries.js)
			_fx.explosion(best.global_position + Vector3(24, 30, 0), 0.8)


## Eixo-traseiro unitário: normalize(SOLDIER_POS − LOOK_AT) (x/z).
static func _rear_axis() -> Vector2:
	return (GameConfig.AA_SOLDIER_POS - GameConfig.AA_LOOK_AT).normalized()


## Ameaça da retaguarda: caça mirando o jogador OU no setor ±60° do eixo-traseiro.
func _is_rear_threat(f: Node3D, rear_axis: Vector2) -> bool:
	if f.target_kind == "player":
		return true
	var bearing := Vector2(f.global_position.x - GameConfig.AA_SOLDIER_POS.x,
		f.global_position.z - GameConfig.AA_SOLDIER_POS.y)
	if bearing.length() < 1.0:
		return true
	return bearing.normalized().dot(rear_axis) >= GameConfig.REAR_BATT_SECTOR_COS

# combat.gd — revólver + espingarda 12 do cowboy (SPEC §4).
# TODOS os disparos saem do centro da câmera ativa (nunca do quadril) —
# fim do bug mira↔impacto da web. Revólver: 8 balas, recarga infinita 3,0 s,
# hitscan preciso. Espingarda: 7 pelotes em cone (raio de impacto ∝ distância),
# infinita, sem recarga.
class_name BangCombat
extends Node3D

const ProjectileScript = preload("res://scripts/combat/projectile.gd")

const REV_DAMAGE := 1.0    # dano em TIROS (pato 1, veado 5, bandido 3)
const REV_RANGE := 220.0
const REV_MAG := 8
const REV_RELOAD := 3.0
const REV_COOLDOWN := 0.35

const SG_PELLETS := 7
const SG_DAMAGE := 0.5     # pelote = meio tiro
const SG_RANGE := 60.0
const SG_SPREAD_RAD := 0.055      # ângulo do cone (raio de impacto ∝ distância)
const SG_COOLDOWN := 0.9
const SG_FALLOFF_START := 12.0    # dano cheio até aqui, depois cai

var weapon: StringName = &"revolver"
var ammo := REV_MAG
var reloading := false
var _cool := 0.0
var _cam: Callable = Callable()   # () → Camera3D ativa
var rider: Node3D
var view: Node = null             # WeaponView (boca do cano + flash) — player.gd injeta

# --- mira com trava [F] (dinâmica de caça) ---
var lock_target: Node3D = null
const LOCK_RANGE := 90.0
const LOCK_CONE := 0.26           # ~15° do centro da mira
const LOCK_HIT_CHANCE := 0.8      # 80% de acerto com mira travada

signal fired(weapon: StringName, origin: Vector3, dir: Vector3)
signal reloaded

func setup(p_rider: Node3D, cam_getter: Callable) -> void:
	rider = p_rider
	_cam = cam_getter

func _process(dt: float) -> void:
	_cool = maxf(0.0, _cool - dt)
	var g = get_node_or_null("/root/Game")
	if g and not g.is_playing():
		return
	if Input.is_action_just_pressed("weapon_1"):
		_switch(&"revolver")
	elif Input.is_action_just_pressed("weapon_2"):
		_switch(&"shotgun")
	elif Input.is_action_just_pressed("weapon_toggle"):
		_switch(&"shotgun" if weapon == &"revolver" else &"revolver")
	if Input.is_action_just_pressed("reload"):
		_start_reload()
	if Input.is_action_just_pressed("ads"):
		_toggle_lock()
	_validate_lock()
	if Input.is_action_pressed("fire"):
		_try_fire()

func _switch(w: StringName) -> void:
	if weapon == w:
		return
	weapon = w
	reloading = false
	var g = get_node_or_null("/root/Game")
	if g:
		g.player["weapon"] = weapon

func _start_reload() -> void:
	if weapon != &"revolver" or reloading or ammo == REV_MAG:
		return
	reloading = true
	var g = get_node_or_null("/root/Game")
	if g:
		g.player["reloading"] = true
	await get_tree().create_timer(REV_RELOAD).timeout
	ammo = REV_MAG
	reloading = false
	if g:
		g.player["reloading"] = false
		g.player["revolver_ammo"] = ammo
	reloaded.emit()

func _try_fire() -> void:
	if _cool > 0.0 or reloading:
		return
	var cam: Camera3D = _cam.call() if _cam.is_valid() else null
	if cam == null:
		return
	# MIRA pela câmera (o crosshair é a verdade), mas o projétil VISÍVEL nasce
	# na BOCA DO CANO da arma do cowboy e voa até o ponto mirado — o jogador vê
	# o cowboy apontar, o clarão no cano e a bala saindo da arma.
	var cam_origin := cam.global_position
	var cam_dir := -cam.global_transform.basis.z.normalized()
	var aim_point := _aim_point(cam_origin, cam_dir)
	var origin := cam_origin
	if view and view.has_method("muzzle_world"):
		origin = view.muzzle_world()
		view.flash()
	var dir := (aim_point - origin).normalized()
	if weapon == &"revolver":
		if ammo <= 0:
			_start_reload()
			return
		ammo -= 1
		_cool = REV_COOLDOWN
		if lock_target:
			_fire_locked(origin)
		else:
			_spawn_projectile(origin, dir, REV_DAMAGE)
		var g = get_node_or_null("/root/Game")
		if g:
			g.player["revolver_ammo"] = ammo
	else:
		_cool = SG_COOLDOWN
		if lock_target:
			_fire_locked(origin)
		else:
			for i in range(SG_PELLETS):
				var d := _cone_dir(dir, SG_SPREAD_RAD)
				_spawn_projectile(origin, d, SG_DAMAGE, SG_FALLOFF_START, SG_RANGE)
	fired.emit(weapon, origin, dir)

# ponto do mundo sob o crosshair: raycast da câmera; sem hit, ponto distante
func _aim_point(cam_origin: Vector3, cam_dir: Vector3) -> Vector3:
	var space := rider.get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(cam_origin, cam_origin + cam_dir * REV_RANGE, 1, [rider])
	var hit := space.intersect_ray(q)
	if hit.is_empty():
		return cam_origin + cam_dir * REV_RANGE
	return hit["position"]

# projétil visível e rápido (o jogador VÊ o tiro e a trajetória)
func _spawn_projectile(origin: Vector3, dir: Vector3, dmg: float, f_start := -1.0, f_end := 0.0) -> void:
	var p = ProjectileScript.new()
	var scene_root := get_tree().current_scene
	if scene_root == null:
		scene_root = get_tree().root
	scene_root.add_child(p)
	p.setup(origin + dir * 0.1, dir, dmg, rider, f_start, f_end)

# --- mira travada: F trava/destrava; tiro tem 80% de acerto ---
func _toggle_lock() -> void:
	if lock_target:
		_release_lock()
		return
	var cam: Camera3D = _cam.call() if _cam.is_valid() else null
	if cam == null:
		return
	var fwd := -cam.global_transform.basis.z.normalized()
	var best: Node3D = null
	var best_ang := LOCK_CONE
	for e in get_tree().get_nodes_in_group("huntable"):
		if not (e is Node3D) or e.get("state") in [&"dead", &"carcass", &"captured", &"surrender", &"falling"]:
			continue
		var to: Vector3 = e.global_position - cam.global_position
		var dist := to.length()
		if dist > LOCK_RANGE or dist < 1.0:
			continue
		var ang := fwd.angle_to(to / dist)
		if ang < best_ang:
			best_ang = ang
			best = e
	lock_target = best
	var g = get_node_or_null("/root/Game")
	if g:
		g.player["lock_target"] = lock_target
		g.player["lock_name"] = _target_label(lock_target) if lock_target else &""

func _validate_lock() -> void:
	if lock_target == null:
		return
	if not is_instance_valid(lock_target) or lock_target.get("state") in [&"dead", &"carcass", &"captured", &"falling"]:
		_release_lock()
		return
	if rider and lock_target.global_position.distance_to(rider.global_position) > LOCK_RANGE * 1.3:
		_release_lock()

func _release_lock() -> void:
	lock_target = null
	var g = get_node_or_null("/root/Game")
	if g:
		g.player["lock_target"] = null
		g.player["lock_name"] = &""

func _fire_locked(origin: Vector3) -> void:
	# mira travada [F] ⇒ tiro PRECISO: projétil direto no CENTRO do alvo
	# (offset por tipo: pato é pequeno — mirar no corpo, não acima dele)
	var k: StringName = lock_target.get("kind") if lock_target.get("kind") != null else &""
	var h := 0.15 if k == &"duck" else (0.8 if k in [&"deer", &"bandit"] else 0.4)
	var aim := lock_target.global_position + Vector3(0, h, 0)
	var from := origin
	if view and view.has_method("muzzle_world"):
		from = view.muzzle_world()
		view.flash()
	_spawn_projectile(from, (aim - from).normalized(), 1.0)

func _target_label(t: Node3D) -> StringName:
	if t == null:
		return &""
	var k: StringName = t.get("kind") if t.get("kind") != null else &""
	match k:
		&"duck": return &"pato"
		&"deer": return &"veado"
		&"bandit": return &"bandido"
	return k

func _cone_dir(dir: Vector3, angle: float) -> Vector3:
	# direção aleatória dentro do cone de meio-ângulo `angle` em torno de dir
	var a := randf() * TAU
	var r := sqrt(randf()) * angle
	var up := Vector3.UP if absf(dir.y) < 0.99 else Vector3.RIGHT
	var t1 := dir.cross(up).normalized()
	var t2 := dir.cross(t1).normalized()
	return (dir + t1 * cos(a) * r + t2 * sin(a) * r).normalized()

func _shoot_ray(origin: Vector3, dir: Vector3, max_range: float, damage: float, falloff := false) -> void:
	var space := rider.get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(origin, origin + dir * max_range, 1, [rider])
	var hit := space.intersect_ray(q)
	if hit.is_empty():
		return
	var dist: float = origin.distance_to(hit["position"])
	var dmg := damage
	if falloff and dist > SG_FALLOFF_START:
		dmg = maxf(2.0, damage * (1.0 - (dist - SG_FALLOFF_START) / (SG_RANGE - SG_FALLOFF_START)))
	var target = hit["collider"]
	if target and target.has_method("apply_damage"):
		target.apply_damage(dmg, hit["position"])

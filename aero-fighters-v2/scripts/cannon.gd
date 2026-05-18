extends Node3D
# cannon.gd — Player cannon system.
# Implements FR-V2-G-05: 12.5 rounds/sec, 30-bullet object pool, 110 m/s bullet speed.
# Attach as a child Node3D of Player.tscn; wire muzzle reference to $Aircraft/MuzzleSocket.
# T-G-19 (Wave 4).

const FIRE_RATE: float = 12.5          # rounds/sec
const FIRE_PERIOD: float = 1.0 / FIRE_RATE   # 0.08 s between shots
const POOL_SIZE: int = 30              # bullet pool size — no alloc at runtime

var _pool: Array = []
var _fire_timer: float = 0.0
var _ammo_fired: int = 0

# Muzzle socket — populated in _ready(); fallback to self position if missing
var _muzzle: Node3D = null


func _ready() -> void:
	_build_pool()
	# Try to find muzzle socket on the aircraft sub-scene
	_muzzle = _find_muzzle()
	print("[cannon] ready — pool_size=%d  fire_rate=%.1f r/s  muzzle=%s" % [
		POOL_SIZE, FIRE_RATE, str(_muzzle)
	])


func _physics_process(delta: float) -> void:
	if _fire_timer > 0.0:
		_fire_timer -= delta

	if Input.is_action_pressed("fire_cannon") and _fire_timer <= 0.0:
		_shoot()
		_fire_timer = FIRE_PERIOD


# ────────────────────────────────────────────────────────────────────────────────
# Pool management
# ────────────────────────────────────────────────────────────────────────────────

func _build_pool() -> void:
	var bullet_scene: PackedScene = preload("res://scenes/Bullet.tscn")
	for i in range(POOL_SIZE):
		var b = bullet_scene.instantiate()
		add_child(b)
		b.visible = false
		_pool.append(b)


func _get_free_bullet():
	for b in _pool:
		if not b._active:
			return b
	# All bullets busy — recycle oldest (no dynamic alloc)
	return _pool[0]


# ────────────────────────────────────────────────────────────────────────────────
# Firing
# ────────────────────────────────────────────────────────────────────────────────

func _shoot() -> void:
	var bullet = _get_free_bullet()
	var muzzle_pos: Vector3 = _muzzle.global_position if _muzzle else global_position
	# Forward direction: -Z in Godot convention, rotated with aircraft
	var owner_body: Node3D = get_parent() as Node3D
	var forward: Vector3 = -owner_body.global_transform.basis.z if owner_body else Vector3(0, 0, -1)
	bullet.fire(muzzle_pos, forward)
	_ammo_fired += 1


# ────────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────────

func _find_muzzle() -> Node3D:
	# Walk up to Player root, then search for MuzzleSocket in Aircraft sub-scene
	var root: Node = get_parent()
	if root == null:
		return null
	var aircraft: Node = root.find_child("Aircraft", true, false)
	if aircraft == null:
		return null
	var muzzle: Node = aircraft.find_child("MuzzleSocket", true, false)
	return muzzle as Node3D


func get_ammo_fired() -> int:
	return _ammo_fired

class_name FlightCamera
extends Camera3D
## FlightCamera — 5 modos de câmera do caça (tecla C), port de camera-modes.js:
## Chase (default) · Wide Chase · Cockpit/Nose · Flyby · Orbit.

const MODES := [
	{"offset": Vector3(0, 3, 5), "fov": 62.0, "lerp": 0.09}, # Chase
	{"offset": Vector3(0, 9, 16), "fov": 70.0, "lerp": 0.09}, # Wide Chase
	{"offset": Vector3(0, 0.6, -1.9), "fov": 58.0, "lerp": 1.0}, # Cockpit/Nose
	{"offset": Vector3(18, 7, 6), "fov": 64.0, "lerp": 0.05}, # Flyby
	{"offset": Vector3(14, 8, 14), "fov": 55.0, "lerp": 0.03}, # Orbit
]

var jet: Jet
var mode := 0
var _shake := 0.0


func _ready() -> void:
	current = true


func _process(delta: float) -> void:
	if jet == null:
		return
	if Input.is_action_just_pressed("camera_cycle"):
		mode = (mode + 1) % MODES.size()
	var m: Dictionary = MODES[mode]
	fov = m.fov
	var target_pos: Vector3 = jet.to_global(m.offset)
	var t: float = 1.0 - pow(1.0 - m.lerp, delta * 60.0) # lerp independente de fps
	global_position = global_position.lerp(target_pos, t)
	if mode == 2: # cockpit: olha junto com o nariz
		global_transform = global_transform.looking_at(
			jet.to_global(Vector3(0, 0.6, -100)), jet.basis.y)
	else:
		var up := jet.basis.y if mode == 0 else Vector3.UP
		var look_target := jet.global_position + jet.global_basis.y * 0.5
		var xf := global_transform.looking_at(look_target, up)
		global_transform = global_transform.interpolate_with(xf, maxf(t, 0.35))
	# Shake (explosões/hits): decay exponencial
	if _shake > 0.001:
		_shake = maxf(0.0, _shake - delta * 2.5)
		h_offset = randf_range(-_shake, _shake)
		v_offset = randf_range(-_shake, _shake)
	else:
		h_offset = 0.0
		v_offset = 0.0


func shake(intensity: float) -> void:
	_shake = maxf(_shake, intensity * 0.15)

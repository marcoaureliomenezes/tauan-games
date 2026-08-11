# eagle.gd — águia ambiental: círculos no céu (SPEC §R-13).
class_name BangEagle
extends Node3D

var center := Vector3.ZERO
var radius := 45.0
var ang := 0.0
var speed := 0.25
var height := 55.0

func _process(dt: float) -> void:
	ang += speed * dt
	var p := center + Vector3(cos(ang) * radius, 0, sin(ang) * radius)
	p.y = height + sin(ang * 3.0) * 3.0
	global_position = p
	rotation.y = -ang - PI / 2

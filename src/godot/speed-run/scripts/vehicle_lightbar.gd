class_name VehicleLightbar
extends Node3D
## Pisca as luzes RedLight/BlueLight de um giroflex alternadamente.

@export var period := 0.4

var _t := 0.0
var _red: MeshInstance3D
var _blue: MeshInstance3D


func _ready() -> void:
	_red = find_child("RedLight", true, false)
	_blue = find_child("BlueLight", true, false)


func _process(delta: float) -> void:
	_t += delta
	var on_red := fmod(_t, period * 2.0) < period
	if _red:
		_red.visible = on_red
	if _blue:
		_blue.visible = not on_red

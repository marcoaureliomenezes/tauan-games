# damageable_target.gd — alvo de teste que registra dano recebido.
extends StaticBody3D

var hits: Array = []

func apply_damage(dmg: float, point: Vector3, _impulse := Vector3.ZERO) -> void:
	hits.append({ "dmg": dmg, "point": point })

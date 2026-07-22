# rider_follow.gd — o Rider (cowboy) e a Saddle seguem o corpo do cavalo como
# UMA coisa só. Âncora rígida medida no 1º frame (nunca seguir osso animado:
# os clips de gait deformam o Torso2 e o cowboy afundava no corpo do cavalo).
#
# Pose de montaria por VETORES-ALVO em espaço do cavaleiro (não ângulos
# empíricos): o rig do Adventurer é IK — Foot.L/R e PT.L/R são filhos de Root,
# não da perna; pés têm de ser POSICIONADOS (set_bone_pose_position), e coxa/
# canela apontadas (aim) para o joelho/tornozelo. Medido ao vivo via MCP.
extends Node3D

var skel: Skeleton3D            # esqueleto do CAVALO (Torso2 = âncora)
var bone := -1
var up_offset := -0.60          # sela assenta no lombo (Torso2 y≈1.50 → origem 0.90)
var _anchor_local := Vector3.ZERO
var _cowboy: Skeleton3D = null  # esqueleto REAL do cowboy (há um fantasma no glb!)
var _shin_axis := {}            # eixo local da canela por lado (medido do rest)

# alvos da pose de montaria, em espaço LOCAL do HorseRider (+Z = frente).
# Lombo do cavalo y≈1.70, barril meia-largura ≈0.30: joelho abre para fora e
# desce; pé no estribo na LATERAL do barril.
const KNEE_TARGET := Vector3(0.31, 1.58, 0.44)
const FOOT_TARGET := Vector3(0.36, 1.18, 0.16)
const TOE_TARGET := Vector3(0.38, 1.10, 0.42)

func _ready() -> void:
	var hm := get_parent()
	skel = _find_skel(hm)
	if skel:
		bone = skel.find_bone("Torso2")
	# esqueleto do cowboy por PATH EXPLÍCITO: _find_skel genérico devolvia um
	# Skeleton3D fantasma fora da árvore (bug: a pose de montaria nunca aplicava
	# e os pés ficavam plantados DENTRO do corpo do cavalo)
	_cowboy = get_node_or_null("Rider/RootNode/CharacterArmature/Skeleton3D")
	_measure_shin_axes()
	_strip_leg_tracks(get_node_or_null("Rider"))
	await get_tree().process_frame
	await get_tree().process_frame
	if skel and bone >= 0:
		var bone_world := (skel.global_transform * skel.get_bone_global_pose(bone)).origin + Vector3(0, up_offset, 0)
		_anchor_local = get_parent().global_transform.affine_inverse() * bone_world

# os clips do pack animam pernas E alvos de IK (PT.*) — remove as trilhas em
# runtime para a pose de montaria não ser sobrescrita a cada frame
func _strip_leg_tracks(rider: Node) -> void:
	if rider == null:
		return
	var ap := rider.get_node_or_null("AnimationPlayer") as AnimationPlayer
	if ap == null:
		return
	for lib_name in ap.get_animation_library_list():
		var lib := ap.get_animation_library(lib_name)
		for aname in lib.get_animation_list():
			var anim := lib.get_animation(aname)
			for i in range(anim.get_track_count() - 1, -1, -1):
				var p := str(anim.track_get_path(i))
				for lb in ["UpperLeg", "LowerLeg", "Foot", "Toes", "PT."]:
					if lb in p:
						anim.remove_track(i)
						break

func _find_skel(n: Node) -> Skeleton3D:
	if n is Skeleton3D:
		return n
	for c in n.get_children():
		var s = _find_skel(c)
		if s:
			return s
	return null

func _process(_dt: float) -> void:
	# posição: âncora rígida no corpo (acompanha posição/rotação do cavalo,
	# nunca a deformação dos clips de gait)
	global_position = get_parent().global_transform * _anchor_local
	global_basis = get_parent().global_transform.basis.orthonormalized()
	_apply_ride_pose()

# pose de montaria RESOLVIDA a cada frame (barata: 10 ossos) — robusta contra
# qualquer trilha remanescente e contra retarget de clips
func _apply_ride_pose() -> void:
	if _cowboy == null:
		return
	var rr := get_parent() as Node3D          # HorseRider (frame de referência)
	var sk := _cowboy
	var skel_inv := sk.global_transform.affine_inverse()
	var root_pose := sk.get_bone_global_pose(sk.find_bone("Root"))
	for side in [["L", 1.0], ["R", -1.0]]:
		var sfx: String = side[0]
		var s: float = side[1]
		# pés (alvos IK filhos de Root): posição direta no estribo
		var fb := sk.find_bone("Foot." + sfx)
		var pt := sk.find_bone("PT." + sfx)
		if fb >= 0:
			var t: Vector3 = skel_inv * (rr.global_transform * Vector3(FOOT_TARGET.x * s, FOOT_TARGET.y, FOOT_TARGET.z))
			sk.set_bone_pose_position(fb, root_pose.affine_inverse() * t)
		if pt >= 0:
			var t2: Vector3 = skel_inv * (rr.global_transform * Vector3(TOE_TARGET.x * s, TOE_TARGET.y, TOE_TARGET.z))
			sk.set_bone_pose_position(pt, root_pose.affine_inverse() * t2)
		# coxa aponta do QUADRIL ao joelho-alvo; canela do joelho REAL ao tornozelo
		var hip: Vector3 = rr.global_transform.affine_inverse() * (sk.global_transform * sk.get_bone_global_pose(sk.find_bone("UpperLeg." + sfx))).origin
		_aim_bone(sk, rr, "UpperLeg." + sfx, "LowerLeg." + sfx,
			Vector3(KNEE_TARGET.x * s, KNEE_TARGET.y, KNEE_TARGET.z) - hip)
		if sk.has_method("force_update_all_dirty_bones"):
			sk.force_update_all_dirty_bones()
		var knee: Vector3 = get_parent().global_transform.affine_inverse() * (sk.global_transform * sk.get_bone_global_pose(sk.find_bone("LowerLeg." + sfx))).origin
		var ankle := Vector3(FOOT_TARGET.x * s, FOOT_TARGET.y + 0.05, FOOT_TARGET.z)
		_aim_bone(sk, rr, "LowerLeg." + sfx, "", (ankle - knee))

# eixo da canela no frame LOCAL do osso, medido da pose de DESCANSO da cadeia
# (LowerLeg→Foot no rest): o rig IK não garante que -Y corra ao longo do osso.
func _measure_shin_axes() -> void:
	if _cowboy == null:
		return
	var sk := _cowboy
	var rests := {}
	for i in range(sk.get_bone_count()):
		var p := sk.get_bone_parent(i)
		var parent_rest: Transform3D = rests.get(p, Transform3D()) if p >= 0 else Transform3D()
		rests[i] = parent_rest * sk.get_bone_rest(i)
	for sfx in ["L", "R"]:
		var lb := sk.find_bone("LowerLeg." + sfx)
		var fb := sk.find_bone("Foot." + sfx)
		if lb < 0 or fb < 0:
			continue
		var lr: Transform3D = rests[lb]
		var fr: Transform3D = rests[fb]
		var dir_skel := (fr.origin - lr.origin).normalized()
		_shin_axis["LowerLeg." + sfx] = lr.basis.get_rotation_quaternion().inverse() * dir_skel

# gira o osso para que (osso→filho) aponte em `desired` (espaço do HorseRider).
# child_name vazio: usa a direção atual do eixo do osso ao filho na cadeia rest.
func _aim_bone(sk: Skeleton3D, rr: Node3D, bone_name: String, child_name: String, desired: Vector3) -> void:
	var bi := sk.find_bone(bone_name)
	if bi < 0:
		return
	if sk.has_method("force_update_all_dirty_bones"):
		sk.force_update_all_dirty_bones()
	var gp := sk.get_bone_global_pose(bi)
	var cur_dir: Vector3
	if child_name != "":
		var ci := sk.find_bone(child_name)
		cur_dir = (sk.get_bone_global_pose(ci).origin - gp.origin).normalized()
	elif _shin_axis.has(bone_name):
		cur_dir = (gp.basis * _shin_axis[bone_name]).normalized()
	else:
		return
	if desired.length_squared() < 0.0001:
		return
	var des_skel := (sk.global_transform.affine_inverse().basis * (rr.global_transform.basis * desired)).normalized()
	if cur_dir.dot(des_skel) > 0.9999:
		return
	var delta := Quaternion(cur_dir, des_skel)
	var new_global := delta * gp.basis.get_rotation_quaternion()
	var pi := sk.get_bone_parent(bi)
	var parent_rot := sk.get_bone_global_pose(pi).basis.get_rotation_quaternion() if pi >= 0 else Quaternion()
	sk.set_bone_pose_rotation(bi, parent_rot.inverse() * new_global)

## main.gd — Game root script. Wires player signals, camera, and game flow.
extends Node3D

@onready var player: CharacterBody3D = $Player
@onready var camera_pivot: Node3D = $CameraPivot
@onready var camera: Camera3D = $CameraPivot/Camera3D
@onready var hud: CanvasLayer = $HUD
@onready var targets_root: Node3D = $Targets

const CAMERA_FOLLOW_LERP: float = 6.0
const CAMERA_OFFSET: Vector3 = Vector3(0.0, 4.0, 14.0)  # behind and above
const CAMERA_LOOK_OFFSET: Vector3 = Vector3(0.0, 0.0, -10.0)  # look ahead

func _ready() -> void:
	# Wire singletons to nodes
	MissionManager.player_node = player
	MissionManager.targets_root = targets_root

	# Connect player signals
	player.connect("crashed", _on_player_crashed)
	player.connect("fired_cannon", _on_player_fired_cannon)
	player.connect("fired_missile", _on_player_fired_missile)

	# Connect mission signals
	GameState.connect("game_over_signal", _on_game_over)
	MissionManager.connect("all_targets_destroyed", _on_all_targets_destroyed)
	GameState.connect("mission_complete", _on_mission_complete)

	# Show start overlay
	_show_start_screen()

func _show_start_screen() -> void:
	if hud and hud.has_method("show_overlay"):
		hud.show_overlay(
			"AERO FIGHTERS",
			"ARROW KEYS: pitch/roll  W/S: throttle  Q/E: yaw\nSPACE: cannon  X: missile  N: nuclear  SHIFT: barrel roll\n\nPress SPACE to start",
			0.0
		)

func _process(delta: float) -> void:
	# Start game on space while not running
	if not GameState.running and Input.is_action_just_pressed("fire_cannon"):
		_start_game()

	if not GameState.running:
		return

	# Pause toggle
	if Input.is_action_just_pressed("pause_game"):
		GameState.paused = not GameState.paused
		return

	if GameState.paused:
		return

	_update_camera(delta)
	_apply_camera_shake()

func _start_game() -> void:
	if hud and hud.has_method("hide_overlay"):
		hud.hide_overlay()
	GameState.reset()
	GameState.running = true
	MissionManager.spawn_mission(GameState.cycle)
	GameState.mission_started.emit(GameState.cycle)
	player.respawn()

func _update_camera(delta: float) -> void:
	# Camera follows player in local-space offset (behind and above)
	if not is_instance_valid(player):
		return
	var target_basis: Basis = player.global_transform.basis
	var target_pos: Vector3 = player.global_position + target_basis * CAMERA_OFFSET

	camera_pivot.global_position = camera_pivot.global_position.lerp(
		target_pos, CAMERA_FOLLOW_LERP * delta
	)

	# Look at a point ahead of the player
	var look_target: Vector3 = player.global_position + target_basis * CAMERA_LOOK_OFFSET
	camera_pivot.look_at(look_target, Vector3.UP)

func _apply_camera_shake() -> void:
	if GameState.shake_time > 0.0:
		var shake_mag: float = GameState.shake_time * 0.5
		camera.position = Vector3(
			randf_range(-shake_mag, shake_mag),
			randf_range(-shake_mag, shake_mag),
			0.0
		)
	else:
		camera.position = Vector3.ZERO

func _on_player_crashed(reason: String) -> void:
	var label: String = "IMPACT WITH SEA" if reason == "SEA" else "TERRAIN COLLISION"
	if hud and hud.has_method("show_overlay"):
		hud.show_overlay("AIRCRAFT DESTROYED", label + "\nPress SPACE to restart", 0.0)
	GameState.running = false
	GameState.mission_failed = true
	GameState.player_dead = true
	GameState.game_over_signal.emit(label)

func _on_player_fired_cannon(pos: Vector3, dir: Vector3, _wing: int) -> void:
	MissionManager.spawn_bullet(pos, dir)

func _on_player_fired_missile(pos: Vector3, dir: Vector3, missile_type: String) -> void:
	MissionManager.spawn_missile(pos, dir, missile_type)

func _on_game_over(reason: String) -> void:
	GameState.running = false

func _on_all_targets_destroyed() -> void:
	_advance_mission()

func _on_mission_complete() -> void:
	pass  # handled by all_targets_destroyed

func _advance_mission() -> void:
	GameState.cycle += 1
	GameState.mission_complete_shown = false
	if hud and hud.has_method("show_overlay"):
		hud.show_overlay(
			"MISSION COMPLETE",
			"Mission %d cleared — preparing next zone" % (GameState.cycle - 1),
			2.2
		)
	await get_tree().create_timer(2.4).timeout
	if not GameState.mission_failed:
		MissionManager.spawn_mission(GameState.cycle)
		GameState.targets_total = MissionManager.active_targets.size()
		GameState.mission_started.emit(GameState.cycle)

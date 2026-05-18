extends CanvasLayer
# hud.gd — Attached to HUD.tscn root (CanvasLayer).
# Implements FR-V2-G-10: 8 HUD elements polled from Player flight state each frame.
# Subscribes to MissionManager signals for mission progress updates.

# ────────────────────────────────────────────────────────────────────────────────
# Boundary threshold (FR-V2-G-19)
# ────────────────────────────────────────────────────────────────────────────────
const BOUNDARY_WARNING_DIST: float = 18000.0  # m — show warning at 18 km

# ────────────────────────────────────────────────────────────────────────────────
# Child node references (matched to HUD.tscn structure)
# ────────────────────────────────────────────────────────────────────────────────
@onready var airspeed_label: Label = $Control/Airspeed
@onready var altitude_label: Label = $Control/AltitudeAGL
@onready var throttle_label: Label = $Control/Throttle
@onready var ammo_label: Label = $Control/Ammo
@onready var crosshair: Control = $Control/Crosshair
@onready var score_label: Label = $Control/Score
@onready var mission_n_label: Label = $Control/MissionProgress/MissionN
@onready var target_icons_label: Label = $Control/MissionProgress/TargetIcons
@onready var boundary_warning: Label = $Control/BoundaryWarning

# ────────────────────────────────────────────────────────────────────────────────
# Tracked game state
# ────────────────────────────────────────────────────────────────────────────────
var _score: int = 0
var _mission_cycle: int = 1
var _factory_alive: bool = true
var _base_alive: bool = true
var _aa_alive: bool = true

# Flash timer for boundary warning
var _boundary_flash_timer: float = 0.0
const BOUNDARY_FLASH_PERIOD: float = 0.5  # s


func _ready() -> void:
	# Connect to MissionManager signals if available
	if MissionManager:
		if MissionManager.has_signal("target_destroyed"):
			MissionManager.target_destroyed.connect(_on_target_destroyed)
		if MissionManager.has_signal("cycle_advanced"):
			MissionManager.cycle_advanced.connect(_on_cycle_advanced)
		if MissionManager.has_signal("mission_complete"):
			MissionManager.mission_complete.connect(_on_mission_complete_with_score)

	_update_target_icons()
	print("[hud] ready — 8 elements wired")


func _process(delta: float) -> void:
	_poll_player(delta)
	_update_boundary_flash(delta)


# ────────────────────────────────────────────────────────────────────────────────
# Poll player state from scene tree
# ────────────────────────────────────────────────────────────────────────────────

func _poll_player(_delta: float) -> void:
	var player_node: Node = get_tree().get_first_node_in_group("player")
	if player_node == null:
		# Try direct path as fallback
		player_node = get_tree().root.find_child("Player", true, false)

	if player_node == null:
		return

	var flight: Node = player_node.find_child("FlightArcade", true, false)

	# Airspeed
	if flight and "current_speed" in flight:
		var spd: float = flight.current_speed
		if airspeed_label:
			airspeed_label.text = "SPD: %.0f m/s" % spd

	# Throttle
	if flight and "current_throttle" in flight:
		var thr: float = flight.current_throttle
		if throttle_label:
			throttle_label.text = "THR: %.0f%%" % (thr * 100.0)

	# Altitude AGL — prefer crash_detector.get_agl() for terrain-relative altitude.
	var agl: float = 0.0
	var crash_det: Node = player_node.find_child("CrashDetector", true, false)
	if crash_det and crash_det.has_method("get_agl"):
		agl = crash_det.get_agl()
	elif player_node is Node3D:
		agl = (player_node as Node3D).global_position.y
	if altitude_label:
		altitude_label.text = "ALT: %.0f m" % agl

	# Boundary warning distance (horizontal distance from origin)
	var pos_3d: Vector3 = Vector3.ZERO
	if player_node is Node3D:
		pos_3d = (player_node as Node3D).global_position
	var horiz_dist: float = Vector2(pos_3d.x, pos_3d.z).length()
	if boundary_warning:
		boundary_warning.visible = horiz_dist > BOUNDARY_WARNING_DIST


# ────────────────────────────────────────────────────────────────────────────────
# Boundary warning flash
# ────────────────────────────────────────────────────────────────────────────────

func _update_boundary_flash(delta: float) -> void:
	if boundary_warning and boundary_warning.visible:
		_boundary_flash_timer += delta
		if _boundary_flash_timer >= BOUNDARY_FLASH_PERIOD:
			_boundary_flash_timer = 0.0
			boundary_warning.visible = not boundary_warning.visible


# ────────────────────────────────────────────────────────────────────────────────
# MissionManager signal handlers
# ────────────────────────────────────────────────────────────────────────────────

func _on_target_destroyed(target_type: String, score_value: int) -> void:
	match target_type:
		"factory":
			_factory_alive = false
		"base":
			_base_alive = false
		"aa_gun", "aa_cluster":
			_aa_alive = false
	_score += score_value
	_update_target_icons()
	if score_label:
		score_label.text = "SCORE: %d" % _score


func _on_cycle_advanced(cycle: int) -> void:
	_mission_cycle = cycle
	_factory_alive = true
	_base_alive = true
	_aa_alive = true
	_update_target_icons()
	if mission_n_label:
		mission_n_label.text = "Mission %d" % _mission_cycle
	# Update score display to reflect cumulative score from MissionManager
	if score_label:
		score_label.text = "SCORE: %d" % MissionManager.total_score


func _on_mission_complete_with_score(cycle: int, total_score: int) -> void:
	if mission_n_label:
		mission_n_label.text = "MISSION %d COMPLETE" % cycle
	if score_label:
		score_label.text = "SCORE: %d" % total_score


func show_crashed() -> void:
	if mission_n_label:
		mission_n_label.text = "CRASHED — Press R"


# ────────────────────────────────────────────────────────────────────────────────
# Target icons renderer — shows alive/destroyed state per FR-V2-G-10
# ────────────────────────────────────────────────────────────────────────────────

func _update_target_icons() -> void:
	if target_icons_label == null:
		return
	var f_icon: String = "[F]" if _factory_alive else "[f]"
	var b_icon: String = "[B]" if _base_alive else "[b]"
	var aa_icon: String = "[AA]" if _aa_alive else "[aa]"
	target_icons_label.text = "%s %s %s" % [f_icon, b_icon, aa_icon]

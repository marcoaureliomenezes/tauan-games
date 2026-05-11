## hud.gd — Flight HUD. CanvasLayer with Labels and ProgressBars.
extends CanvasLayer

# --- Node references (set in HUD.tscn) ---
@onready var speed_label: Label = $TopBar/SpeedLabel
@onready var altitude_label: Label = $TopBar/AltLabel
@onready var throttle_bar: ProgressBar = $TopBar/ThrottleBar
@onready var score_label: Label = $TopBar/ScoreLabel
@onready var missiles_label: Label = $BottomBar/MissilesLabel
@onready var lives_label: Label = $BottomBar/LivesLabel
@onready var stall_label: Label = $Center/StallLabel
@onready var mission_label: Label = $Center/MissionLabel
@onready var overlay_panel: PanelContainer = $OverlayPanel
@onready var overlay_title: Label = $OverlayPanel/VBox/TitleLabel
@onready var overlay_sub: Label = $OverlayPanel/VBox/SubLabel
@onready var kills_label: Label = $TopBar/KillsLabel

var _overlay_hide_timer: float = 0.0
var _stall_blink_timer: float = 0.0

func _ready() -> void:
	GameState.score_changed.connect(_on_score_changed)
	GameState.lives_changed.connect(_on_lives_changed)
	GameState.mission_started.connect(_on_mission_started)
	overlay_panel.hide()
	stall_label.hide()

func _process(delta: float) -> void:
	_update_flight_data()
	_update_stall(delta)
	_update_overlay_timer(delta)

func _update_flight_data() -> void:
	var spd: float = GameState.player_speed
	var alt: float = 0.0
	var player = MissionManager.player_node
	if player and is_instance_valid(player):
		alt = player.global_position.y

	speed_label.text = "SPD: %d m/s" % int(spd)
	altitude_label.text = "ALT: %d m" % int(alt)
	throttle_bar.value = GameState.player_throttle * 100.0
	score_label.text = "SCORE: %d" % GameState.score
	kills_label.text = "KILLS: %d" % GameState.kills

	var light_m: int = GameState.player_missiles_light
	var nuc_m: int = GameState.player_missiles_nuclear
	missiles_label.text = "MSL: %d  NUC: %d" % [light_m, nuc_m]
	lives_label.text = "LIVES: %d" % GameState.player_lives

func _update_stall(delta: float) -> void:
	if GameState.player_stalled:
		_stall_blink_timer += delta
		stall_label.visible = fmod(_stall_blink_timer, 0.4) < 0.2
	else:
		stall_label.hide()
		_stall_blink_timer = 0.0

func _update_overlay_timer(delta: float) -> void:
	if _overlay_hide_timer > 0.0:
		_overlay_hide_timer -= delta
		if _overlay_hide_timer <= 0.0:
			overlay_panel.hide()

func show_overlay(title: String, subtitle: String, duration: float) -> void:
	overlay_title.text = title
	overlay_sub.text = subtitle
	overlay_panel.show()
	if duration > 0.0:
		_overlay_hide_timer = duration
	else:
		_overlay_hide_timer = 0.0  # stays until manually hidden

func hide_overlay() -> void:
	overlay_panel.hide()
	_overlay_hide_timer = 0.0

func _on_score_changed(new_score: int) -> void:
	score_label.text = "SCORE: %d" % new_score

func _on_lives_changed(new_lives: int) -> void:
	lives_label.text = "LIVES: %d" % new_lives

func _on_mission_started(mission_num: int) -> void:
	show_overlay(
		"MISSION %d" % mission_num,
		"%d targets detected — destroy all to advance" % GameState.targets_total,
		2.2
	)

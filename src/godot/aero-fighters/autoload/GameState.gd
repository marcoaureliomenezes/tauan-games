extends Node
## GameState — estado global do jogo (equivalente ao window.game do web-game).
## Single source of truth: todos os módulos leem/escrevem aqui.

signal score_changed(new_score: int)
signal lives_changed(new_lives: int)
signal game_over(reason: String)
signal act_changed(act: int)

enum Mode { MAP_SELECT, FLIGHT, DEFENSE }

var mode: Mode = Mode.MAP_SELECT
var running := false
var paused := false
var muted := false
var map_key := ""

# Estado do jogador (caça ou artilheiro)
var score := 0:
	set(v):
		score = v
		score_changed.emit(v)
var lives := GameConfig.P_LIVES:
	set(v):
		lives = v
		lives_changed.emit(v)
var hp := GameConfig.P_HP_PER_LIFE
var kills := 0
var cycle := 0

# Armamento do caça
var heavy_missiles := GameConfig.MSL_HEAVY_STOCK
var nukes := GameConfig.NUKE_STOCK
var rods := GameConfig.ROD_STOCK
var light_missiles_inf := true # desde T-C-08: míssil leve infinito

# Campanha Inhaúma
var campaign_act := 0: # 0 = não iniciada, 1 = SALVAR INHAÚMA, 2 = LIBERTE CACHOEIRA
	set(v):
		campaign_act = v
		act_changed.emit(v)
var city_integrity := 1.0 # 0..1 — modo defesa: -5% por impacto na cidade
var inhauma_fallen := false
var cachoeira_liberated := false

# Alvos
var targets_total := 0
var targets_destroyed := 0

# Referências vivas (preenchidas pelos modos)
var player: Node3D = null
var targets: Array[Node3D] = []


func reset_state() -> void:
	running = false
	paused = false
	score = 0
	lives = GameConfig.P_LIVES
	hp = GameConfig.P_HP_PER_LIFE
	kills = 0
	cycle = 0
	heavy_missiles = GameConfig.MSL_HEAVY_STOCK
	nukes = GameConfig.NUKE_STOCK
	rods = GameConfig.ROD_STOCK
	campaign_act = 0
	city_integrity = 1.0
	inhauma_fallen = false
	cachoeira_liberated = false
	targets_total = 0
	targets_destroyed = 0
	targets.clear()
	player = null


func add_score(points: int) -> void:
	score += points
	kills += 1
	# +1 nuke a cada 5 alvos destruídos (modo não-realismo)
	if kills % GameConfig.NUKE_PER_5_KILLS == 0:
		nukes += 1

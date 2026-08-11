extends Node
## AudioManager — motor de áudio do jogo (port do audio.js web: tudo sintetizado).
## Autoload. Loops (turbina, vento) seguem o estado do jogo; SFX one-shot com
## pool de players. Mudo global via GameState.muted (tecla M).

const SFX := {
	"cannon": "res://assets/audio/cannon.wav",
	"aa50": "res://assets/audio/aa50.wav",
	"explosion": "res://assets/audio/explosion.wav",
	"mega": "res://assets/audio/mega_explosion.wav",
	"missile": "res://assets/audio/missile.wav",
	"lock_search": "res://assets/audio/lock_search.wav",
	"lock_on": "res://assets/audio/lock_on.wav",
	"mayday": "res://assets/audio/mayday.wav",
	"hit": "res://assets/audio/hit.wav",
	"overheat": "res://assets/audio/overheat.wav",
	"pickup": "res://assets/audio/pickup.wav",
	"splash": "res://assets/audio/splash.wav",
	"incoming": "res://assets/audio/incoming.wav",
}

const POOL_SIZE := 10

var _streams := {}
var _pool: Array[AudioStreamPlayer] = []
var _pool_idx := 0
var _engine: AudioStreamPlayer
var _wind: AudioStreamPlayer
var _mayday_loop: AudioStreamPlayer


func _ready() -> void:
	for key in SFX:
		_streams[key] = load(SFX[key])
	for i in POOL_SIZE:
		var p := AudioStreamPlayer.new()
		p.bus = "Master"
		add_child(p)
		_pool.append(p)
	_engine = _make_loop("res://assets/audio/engine.wav", -14.0)
	_wind = _make_loop("res://assets/audio/wind.wav", -22.0)
	_mayday_loop = _make_loop("res://assets/audio/mayday.wav", -10.0)


func _make_loop(path: String, vol: float) -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	var stream: AudioStreamWAV = load(path)
	stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
	p.stream = stream
	p.volume_db = vol
	add_child(p)
	return p


func _process(_delta: float) -> void:
	# Mudo global (M)
	AudioServer.set_bus_mute(0, GameState.muted)
	# Turbina: pitch/volume seguem throttle+velocidade (audio.js#setEngineRPM)
	var jet: Node3D = GameState.player
	if GameState.running and is_instance_valid(jet) and jet is Jet:
		var t: float = jet.throttle
		_engine.pitch_scale = 0.7 + t * 0.9 + jet.speed / 200.0
		_engine.volume_db = -18.0 + t * 12.0
		if not _engine.playing:
			_engine.play()
		# Vento por altitude/velocidade
		_wind.volume_db = clampf(-30.0 + jet.speed / 6.0, -30.0, -8.0) \
			if jet.state == Jet.State.AIRBORNE else -40.0
		if not _wind.playing:
			_wind.play()
		# Mayday loop
		var in_mayday: bool = jet.state == Jet.State.MAYDAY
		if in_mayday and not _mayday_loop.playing:
			_mayday_loop.play()
		elif not in_mayday and _mayday_loop.playing:
			_mayday_loop.stop()
	else:
		if _engine.playing:
			_engine.stop()
		if _wind.playing:
			_wind.stop()
		if _mayday_loop.playing:
			_mayday_loop.stop()


## Toca um SFX one-shot (round-robin no pool). Wave M4: trim global −4 dB em
## todos os SFX (operador: mix geral alta); loops não passam por aqui.
const SFX_TRIM_DB := -4.0


func play(sfx: String, volume_db := 0.0, pitch := 1.0) -> void:
	if GameState.muted or not _streams.has(sfx):
		return
	var p := _pool[_pool_idx]
	_pool_idx = (_pool_idx + 1) % POOL_SIZE
	p.stream = _streams[sfx]
	p.volume_db = volume_db + SFX_TRIM_DB
	p.pitch_scale = pitch * randf_range(0.94, 1.06) # variação anti-repetição
	p.play()


## SFX posicional simples (Wave G): atenuação por distância da câmera (−1 dB a
## cada 120 m, cap −18) + leve queda de pitch com a distância — explosões
## distantes soam distantes. Sem custo de AudioStreamPlayer3D por emissor.
func play_far(sfx: String, pos: Vector3, volume_db := 0.0, pitch := 1.0) -> void:
	var cam := get_viewport().get_camera_3d()
	var d := pos.distance_to(cam.global_position) if cam else 0.0
	play(sfx, volume_db - clampf(d / 120.0, 0.0, 18.0),
		pitch * clampf(1.0 - d / 8000.0, 0.78, 1.0))

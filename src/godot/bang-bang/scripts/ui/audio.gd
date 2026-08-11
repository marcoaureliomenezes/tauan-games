# audio.gd — áudio sintetizado por gerador (SPEC §7): tiro, casco por andadura,
# fogueira. Sem arquivos — AudioStreamGenerator puro.
class_name BangAudio
extends Node3D

var _shot_gen: AudioStreamGenerator
var _shot_player: AudioStreamPlayer3D
var _fire_gen: AudioStreamGenerator
var _fire_player: AudioStreamPlayer3D
var _hoof_gen: AudioStreamGenerator
var _hoof_player: AudioStreamPlayer3D
var _rng := RandomNumberGenerator.new()

func _ready() -> void:
	_shot_gen = AudioStreamGenerator.new()
	_shot_gen.mix_rate = 22050
	_shot_player = AudioStreamPlayer3D.new()
	_shot_player.stream = _shot_gen
	_shot_player.max_distance = 120.0
	add_child(_shot_player)
	_fire_gen = AudioStreamGenerator.new()
	_fire_gen.mix_rate = 22050
	_fire_player = AudioStreamPlayer3D.new()
	_fire_player.stream = _fire_gen
	_fire_player.max_distance = 30.0
	add_child(_fire_player)
	_fire_player.play()
	_hoof_gen = AudioStreamGenerator.new()
	_hoof_gen.mix_rate = 22050
	_hoof_player = AudioStreamPlayer3D.new()
	_hoof_player.stream = _hoof_gen
	_hoof_player.max_distance = 40.0
	add_child(_hoof_player)
	_hoof_player.play()
	print("AUDIO_READY")

# estouro do tiro: ruído branco com decaimento exponencial
func shot(pos: Vector3, shotgun := false) -> void:
	_shot_player.global_position = pos
	_shot_player.play()
	var frames := int(22050 * (0.28 if shotgun else 0.18))
	var amp := 1.0
	var pb := _shot_player.get_stream_playback() as AudioStreamGeneratorPlayback
	for i in range(frames):
		var env := pow(1.0 - float(i) / frames, 2.2)
		pb.push_frame(Vector2.ONE * _rng.randf_range(-1.0, 1.0) * env * amp * 0.7)

# crackle da fogueira: pops aleatórios
func campfire_tick(pos: Vector3) -> void:
	_fire_player.global_position = pos
	var pb := _fire_player.get_stream_playback() as AudioStreamGeneratorPlayback
	if pb == null:
		return
	var frames := int(22050 * 0.05)
	for i in range(frames):
		var env := pow(1.0 - float(i) / frames, 1.5)
		pb.push_frame(Vector2.ONE * _rng.randf_range(-0.6, 0.6) * env * 0.4)

# batida de casco: baque GRAVE (~150 Hz) e volume baixo — o anterior era um
# apito de ~1400 Hz (irritante)
func hoof(pos: Vector3) -> void:
	_hoof_player.global_position = pos
	if not _hoof_player.playing:
		_hoof_player.play()
	var pb := _hoof_player.get_stream_playback() as AudioStreamGeneratorPlayback
	if pb == null:
		return
	var frames := int(22050 * 0.07)
	for i in range(frames):
		var t := float(i) / frames
		var env := pow(1.0 - t, 2.6)
		# baque grave + micro-transiente de impacto no 1º milissegundo
		var v := sin(float(i) * 0.043) * env * 0.16
		if i < 40:
			v += _rng.randf_range(-0.5, 0.5) * (1.0 - float(i) / 40.0) * 0.05
		pb.push_frame(Vector2.ONE * v)

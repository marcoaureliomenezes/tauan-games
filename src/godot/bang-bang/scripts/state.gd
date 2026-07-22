# state.gd — autoload `Game`: fonte única de verdade do estado do jogo.
# CONTRATO: cada campo tem UM writer documentado. Módulos leem livremente.
extends Node

# --- Fluxo ---
# CONTRATO: writer = scenes/main.gd
var phase: StringName = &"start"   # start | playing | paused | gameover | victory

# --- Player (preenchido por scenes/player/horse_rider.gd) ---
# CONTRATO: writer = player/horse_rider.gd
var player := {
	"pos": Vector3.ZERO,
	"speed": 0.0,
	"gait": &"stop",               # stop | walk | trot | gallop
	"hp": 100.0,
	"stamina": 100.0,
	"food": 100.0,
	"carrying": false,
	"weapon": &"revolver",         # revolver | shotgun
	"revolver_ammo": 8,            # tambor (SPEC: 8 balas, recarga infinita 3.0 s)
	"reloading": false,
	"mounted": true,               # sempre montado nesta release
}

# --- Campanha ---
# CONTRATO: writer = scripts/systems/capture_system.gd
var bandits_captured: int = 0
const BANDITS_TOTAL := 5

# --- Flags de mundo ---
# CONTRATO: writer = scenes/world/world.gd
var world_ready := false
var world_seed := 1876

func is_playing() -> bool:
	return phase == &"playing"

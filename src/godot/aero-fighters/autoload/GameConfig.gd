extends Node
## GameConfig — constantes de gameplay portadas 1:1 do web-game
## (repos/tauan-games/src/web-games/aero-fighters/src/config.js).
## Mudar "feel" de gameplay aqui, não nos scripts de jogo.

# ---------------------------------------------------------------------------
# PLAYER — modelo de voo arcade (config.js:6-58)
# ---------------------------------------------------------------------------
const P_MIN_SPD := 8.0
const P_MAX_SPD := 80.0
const P_SPD_CONVERGE := 1.6 # taxa de convergência p/ velocidade alvo (1/s)
const P_CLIMB_TRADE := 35.0 # dreno máx. de velocidade em subida (nariz > 0.18)
const P_CLIMB_NOSE := 0.18
const P_DIVE_OVERSPEED := 1.3 # mergulho permite até MAX_SPD * 1.3 = 104 m/s
const P_CEILING := 9500.0 # teto: empuxo cai acima
const P_GRAVITY := 14.0 # gravidade compensada por sustentação
const P_LIFT_SPD_REF := 20.0 # liftFactor = min(speed/20, 1)
const P_STALL_SPD := 14.0
const P_STALL_NOSE_DROP := 0.45 # rad/s
const P_STALL_CTL := 0.45 # comandos a 45% em stall
const P_PITCH_RATE := 1.45 # rad/s
const P_PITCH_MAX := 0.82
const P_PITCH_MIN := -0.70
const P_ROLL_RATE := 2.30
const P_COORD_YAW := 0.80 # guinada coordenada com roll
const P_RUDDER_FACTOR := 0.65 # leme = yaw puro x 0.65
const P_AUTO_TRIM := 0.22 # nivelamento automático (1/s)
const P_THROTTLE_UP := 1.3 # /s
const P_THROTTLE_DOWN := 0.9 # /s
const P_THROTTLE_FLOOR_AIR := 0.05
const P_THROTTLE_FLOOR_GROUND := 0.02
# Detentes (UX/FX)
const P_THROTTLE_IDLE_MAX := 0.10
const P_THROTTLE_TAXI_MAX := 0.35
const P_THROTTLE_MIL_MAX := 0.80
# Solo / decolagem / pouso
const P_GROUND_YAW := 0.55
const P_V_ROTATE := 32.0
const P_V_ROTATE_AUTO := 38.0
const P_ROTATE_LIFT := 15.0 # m/s²
const P_ROTATE_PITCH_SPOOL := 0.4 # s
const P_LIFTOFF_ALT := 4.0 # m acima do solo
const P_FLARE_ALT := 4.5
const P_TOUCHDOWN_ALT := 2.2
const P_TOUCHDOWN_DEBOUNCE := 0.4
const P_LAND_MAX_SPD := 62.0
const P_SINK_CRASH := -16.0
const P_SINK_CATASTROPHIC := -26.0
const P_CATASTROPHIC_ROLL := 1.4 # rad
const P_TAXI_HANDOFF_SPD := 34.0
# Colisão
const P_WATER_Y := 3.0
const P_MOUNTAIN_BUFFER := 5.0
# Dano / vidas
const P_LIVES := 3
const P_HP_PER_LIFE := 3
const P_HIT_INVULN := 1.4 # s
const P_HIT_SHAKE := 0.45 # s
const P_RESPAWN_INVULN := 3.0 # s (piscada 12 Hz)
const P_MAYDAY_MIN_FALL := 2.0 # s
# Ejeção
const P_CHUTE_DESCENT := 9.0 # m/s
# Barrel roll
const P_BARREL_TIME := 0.5
const P_BARREL_COOLDOWN := 1.5

# ---------------------------------------------------------------------------
# ARMAS DO CAÇA (config.js CANNON / mísseis / rod / pickups)
# ---------------------------------------------------------------------------
const CANNON_INTERVAL := 0.08 # 12.5 tiros/s
const CANNON_SPD := 110.0
const CANNON_LIFE := 2.0
const CANNON_BULLETS_PER_SHOT := 2
const CANNON_DAMAGE := 1
const CANNON_WING_OFFSET := 0.91 # flash nas asas ±0.91 m
const CANNON_NOSE_SPAWN := 3.08

const MSL_LIGHT_EXIT_SPD := 80.0
const MSL_LIGHT_CRUISE := 130.0
const MSL_LIGHT_TURN := 0.30
const MSL_LIGHT_TURN_CLOSE := 0.55 # < 40 m
const MSL_LIGHT_CLOSE_R := 40.0
const MSL_LIGHT_LIFE := 6.0
const MSL_LIGHT_DAMAGE := 4
const MSL_HIT_ROLL := 0.80 # 80% de acerto no disparo; miss = near-miss sem dano
const MSL_NEARMISS_MIN := 2.5 # x raio do alvo
const MSL_NEARMISS_MAX := 5.0

const MSL_HEAVY_STOCK := 10
const MSL_HEAVY_EXIT_SPD := 65.0
const MSL_HEAVY_CRUISE := 100.0
const MSL_HEAVY_TURN := 0.22
const MSL_HEAVY_TURN_CLOSE := 0.45
const MSL_HEAVY_LIFE := 8.0
const MSL_HEAVY_DAMAGE := 20
const MSL_HEAVY_SMOKE_INTERVAL := 0.04
const MSL_SMOKE_INTERVAL := 0.06
const MSL_HEAVY_EXPLOSION_SCALE := 1.5

const NUKE_STOCK := 3
const NUKE_EXIT_SPD := 60.0
const NUKE_CRUISE := 85.0
const NUKE_TURN := 0.18
const NUKE_TURN_CLOSE := 0.38
const NUKE_LIFE := 12.0
const NUKE_DAMAGE := 4000
const NUKE_RADIUS := 760.0
const NUKE_PLAYER_KILL_R := 300.0 # força mayday fatal
const NUKE_PLAYER_LIFE_R := 680.0 # tira 1 vida
const NUKE_SHAKE := 14.0
const NUKE_SHAKE_TIME := 5.0
const NUKE_SLOWMO := 0.35 # time_scale
const NUKE_SLOWMO_TIME := 1.5
const NUKE_SHOCKWAVE_SPD := 340.0 # delay físico distância/340
const NUKE_INCINERATE_MAX := 42
const NUKE_CRATER_R := 228.0
const NUKE_SCORCH_R := 399.0
const NUKE_SMOKE_COLUMN_TIME := 60.0
const NUKE_PER_5_KILLS := 5 # +1 nuke a cada 5 alvos (modo não-realismo)

const ROD_STOCK := 4
const ROD_EXIT_SPD := 160.0
const ROD_CRUISE := 260.0
const ROD_TURN := 0.65
const ROD_DAMAGE := 9999
const ROD_CHAIN_MAX := 3
const ROD_CHAIN_RANGE := 760.0

const PICKUP_HEAVY_AMOUNT := 3
const PICKUP_NUKE_CHANCE := 0.05
const PICKUP_COLLECT_R := 3.0
const PICKUP_LIFE := 18.0

# Lock-on (crosshair.js)
const LOCK_CONE_DEG := 15.0
const LOCK_RANGE := 1600.0
const LOCK_TIME := 0.35
const LOCK_BEEP_SEEK := 0.45 # s entre beeps procurando (crosshair.js)
const LOCK_BEEP_LOCKED := 0.12 # s entre beeps travado

# ---------------------------------------------------------------------------
# ALVOS DO CAÇA (config.js:134-145 TARGETS) — hp, score, hit radius, drop
# ---------------------------------------------------------------------------
const TARGETS := {
	"base": {"hp": 28, "score": 800, "hit_r": 6.0, "drop": 0.60},
	"factory": {"hp": 20, "score": 600, "hit_r": 5.3, "drop": 0.50},
	"building": {"hp": 14, "score": 450, "hit_r": 4.2, "drop": 0.30},
	"convoy": {"hp": 12, "score": 380, "hit_r": 7.7, "drop": 0.40},
	"armedConvoy": {"hp": 18, "score": 700, "hit_r": 9.7, "drop": 0.45,
		"speed": 9.0, "fire_range": 420.0, "fire_interval": 1.9, "burst": 2},
	"helicopter": {"hp": 10, "score": 650, "hit_r": 11.0, "drop": 0.35,
		"alt": 46.0, "speed": 14.0, "fire_range": 620.0, "fire_interval": 2.3,
		"rotor_rads": 26.0},
	"tank": {"hp": 22, "score": 550, "hit_r": 6.6, "drop": 0.40,
		"speed": 6.0, "fire_range": 470.0, "fire_interval": 2.6},
	"patrolAir": {"hp": 14, "score": 720, "hit_r": 12.2, "drop": 0.40,
		"alt": 95.0, "speed": 7.0, "fire_range": 700.0, "fire_interval": 3.0},
	"aaGun": {"hp": 6, "score": 250, "hit_r": 3.0, "drop": 0.10,
		"fire_range": 220.0, "fire_interval": 1.7},
	"warship": {"hp": 35, "score": 1200, "hit_r": 8.9, "drop": 0.50,
		"speed": 4.0, "patrol_r_min": 200.0, "patrol_r_max": 350.0,
		"fire_range": 1200.0, "fire_interval": 1.0, "burst": 2},
}

# Fogo inimigo legado (mapas ilhas/deserto/rio)
const ENEMY_BULLET_SPD := 56.0
const ENEMY_BULLET_LIFE := 2.0
const ENEMY_BULLET_DAMAGE := 1
const ENEMY_BULLET_HIT_R := 2.0
const ENEMY_CLOSEMISS_R := 8.0

# ---------------------------------------------------------------------------
# UNIDADES DE FORMAÇÃO — campanha/guarnição Inhaúma (config.js:153-163)
# ---------------------------------------------------------------------------
const UNIT_STATS := {
	"fTank": {"hp": 22, "score": 550, "range": 220.0, "speed": 6.0, "weapon": "cannon", "interval": 2.6, "alt": 0.0},
	"fApc": {"hp": 16, "score": 480, "range": 200.0, "speed": 9.0, "weapon": "mg", "interval": 1.9, "alt": 0.0},
	"fTruck": {"hp": 10, "score": 320, "range": 0.0, "speed": 10.0, "weapon": "", "interval": 0.0, "alt": 0.0},
	"fTroops": {"hp": 8, "score": 260, "range": 200.0, "speed": 3.5, "weapon": "mg", "interval": 2.2, "alt": 0.0},
	"fArtillery": {"hp": 14, "score": 600, "range": 0.0, "speed": 7.0, "weapon": "howitzer", "interval": 6.0, "alt": 0.0},
	"fSam": {"hp": 18, "score": 900, "range": 300.0, "speed": 0.0, "weapon": "sam", "interval": 4.0, "alt": 0.0},
	"fAaGun": {"hp": 6, "score": 250, "range": 300.0, "speed": 0.0, "weapon": "aa", "interval": 1.7, "alt": 0.0},
	"fHelicopter": {"hp": 10, "score": 650, "range": 220.0, "speed": 14.0, "weapon": "mg", "interval": 2.3, "alt": 46.0},
	"fZeppelin": {"hp": 16, "score": 720, "range": 0.0, "speed": 5.0, "weapon": "", "interval": 0.0, "alt": 95.0},
}

# Fogo de formação (config.js:174-181 ENEMY_FIRE) — modelo probabilístico
const EF_SPD := 80.0
const EF_LIFE := 4.5
const EF_AA_P0 := 0.80 # 80% < 50 m
const EF_AA_DECAY := 0.15 # por 50 m
const EF_AA_FLOOR := 0.05
const EF_GND_P0 := 0.50
const EF_GND_DECAY := 0.14
const EF_GND_FLOOR := 0.03
const EF_NEAR_R := 50.0
const EF_MISS_SPREAD_MIN_DEG := 2.0
const EF_MISS_SPREAD_MAX_DEG := 6.0

# ---------------------------------------------------------------------------
# GUARNIÇÃO DE CACHOEIRA DA PRATA (config.js:185-195 CACHOEIRA_GARRISON)
# ---------------------------------------------------------------------------
const CACHOEIRA_CENTER := Vector2(-950, 2050) # PORT-GODOT §D.4 — novo vale (~2 km de Inhaúma)
const CACHOEIRA_SHELF := Rect2(-1070, 1960, 240, 180) # x[-1070..-830], z[1960..2140]
const CACHOEIRA_SHELF_ALT := 71.0
const CACHOEIRA_CHURCH := Vector2(-928, 2018)
const CACHOEIRA_PRACA := Vector2(-962, 2072)
const GARRISON := {
	"armored_columns": {"count": 2, "units": 6}, # circulando na MG-060
	"helicopters": 2, # patrulha baixa
	"zeppelins": 1, # alto
	"aa_nests": {"count": 3, "guns_each": 5, "ring_min": 300.0, "ring_max": 800.0, "min_sep": 250.0},
	"hq": {"encampment": 8, "sam_site": 6}, # ao norte do shelf
}

# ---------------------------------------------------------------------------
# CAMPANHA INHAÚMA (config.js:202-234 CAMPAIGN)
# ---------------------------------------------------------------------------
const CAMP_ACT1_ARTILLERY := {"batteries": 3, "units_min": 5, "units_max": 8,
	"deploy_min": 600.0, "deploy_max": 1200.0, "shell_g": 25.0,
	"flight_min": 2.2, "flight_max": 3.4, "cycle_min": 6.0, "cycle_max": 11.0,
	"max_in_flight": 3}
const CAMP_ACT1_COLUMNS := [ # 4 colunas de invasão
	{"kind": "supplyConvoy", "units": 5},
	{"kind": "troopColumn", "units": 8},
	{"kind": "armoredColumn", "units": 10},
	{"kind": "tankPlatoon", "units": 12},
]
const CAMP_ACT1_ROUTES := ["north", "farNorth", "road"]
const CAMP_ACT1_FIRST_SPAWN := 5.0
const CAMP_ACT1_INTERVAL_MIN := 40.0
const CAMP_ACT1_INTERVAL_MAX := 75.0
const CAMP_ACT1_DURATION_MIN := 600.0 # ato de 10-15 min
const CAMP_ACT1_DURATION_MAX := 900.0

# ---------------------------------------------------------------------------
# MODO DEFESA — bateria antiaérea (config.js:260-280 AA_DEFENSE)
# ---------------------------------------------------------------------------
# Morro da bateria 2.5× (PORT-GODOT §D.1 — perfil cosseno elíptico somado em
# height_at; SOLDIER_POS = HILL_POS, bateria NO TOPO, cota ~250 m)
const HILL_POS := Vector2(-760, -480) # centro do morro (ombro DEM, base ~115 m)
const HILL_RADIUS_X_M := 340.0 # semi-eixo E-W da contribuição
const HILL_RADIUS_Z_M := 540.0 # semi-eixo N-S (alongado no eixo do vale)
const HILL_PEAK_M := 136.0 # pico da contribuição (115 + 136 ≈ 251 m)
const HILL_TOWN_KEEPOUT_M := 280.0 # keep-out de quarteirões no topo/encosta
const HILL_FOREST_KEEPOUT_M := 120.0 # keep-out de árvores no topo (visada limpa)
const AA_SOLDIER_POS := Vector2(-760, -480) # = HILL_POS — bateria no topo
const AA_LOOK_AT := Vector2(-250, 250) # centro da cidade
const AA_EYE_HEIGHT := 1.7
const AA_CAM_BACK := 3.2
const AA_CAM_UP := 1.2
const AA_FOV := 62.0
const AA_FOV_ZOOM := 32.0
const AA_ZOOM_LERP := 10.0
const AA_MOUSE_SENS := 0.0023 # rad/px
const AA_PITCH_MIN := -35.0 # graus (Wave M5 — olhar o chão logo abaixo da bateria)
const AA_PITCH_MAX := 85.0
# Vidas do artilheiro
const AA_LIVES := 5 # K5 (operador: "morro muito fácil" — web LIVES 3)
const AA_HP := 3
const AA_REGEN_DELAY := 8.0
const AA_REGEN_RATE := 4.0 # +1 HP a cada 4 s
const AA_PLAYER_HIT_R := 26.0 # míssil impactando a <=26 m
const AA_TRACER_HIT_R := 2.5
# .50
const AA50_RATE := 10.0 # tiros/s (spec do operador — web MG_RPS 15)
const AA50_SPD := 450.0
const AA50_GRAVITY := 3.5
const AA50_SPREAD := 0.0045 # rad
const AA50_RANGE := 1200.0
const AA50_DAMAGE := 1
const AA50_HEAT_PER_SHOT := 0.05 # 20 tiros = overheat
const AA50_COOL_RATE := 0.35
const AA50_REARM_AT := 0.55 # histerese: rearma ao cair a 55%
const AA50_TRACER_MIX := 4 # 1 tracer grande a cada 4
const AA50_RECOIL := 0.22 # m de tranco do cano por tiro
const AA50_CAM_KICK := 0.0035 # rad (~0,2°) de coice de câmera por tiro
# Míssil AA
const AAMSL_STOCK := 8
const AAMSL_RELOAD := 12.0 # 1 míssil a cada 12 s
const AAMSL_CADENCE := 0.5 # s — cadência máx 2/s (spec do operador)
const AAMSL_LOCK_CONE_DEG := 12.0
const AAMSL_LOCK_TIME := 1.2
const AAMSL_PN_N := 3.0 # navegação proporcional
const AAMSL_SPD := 220.0
const AAMSL_LATERAL_CAP := 55.0 # m/s²
const AAMSL_EXIT_SPD := 60.0
const AAMSL_LIFE := 8.0
const AAMSL_PROX_R := 6.0 # espoleta de proximidade
const AAMSL_LOCK_BOX_FROM := 46.0 # px
const AAMSL_LOCK_BOX_TO := 20.0
const AAMSL_RETARGET_CONE := 1.05 # rad (~60°) — cone de retarget de órfãos
# Mira por FASES (T-W-08): amarelo 1,5 s (50%) → vermelho 1,5 s (80%) →
# amarelo 1,5 s (50%); solta no fim do ciclo ou no 5º míssil no alvo
const LOCK_PHASE_S := 1.5
const LOCK_HIT_P := [0.5, 0.8, 0.5]
const LOCK_MAX_SHOTS := 5
const LOCK_MISS_OFFSET_MIN := 4.0 # m — offset terminal do míssil "miss"
const LOCK_MISS_OFFSET_MAX := 9.0
const AA_LOCK_HOLD := 2.5 # s de carência do lock após quebra de feixe
const AA_QUEUE_CAP := 4 # fila de disparos X pressionados na cadência
const AAD_BEEP_YELLOW := 0.42 # s entre beeps (fases amarelas)
const AAD_BEEP_RED := 0.22 # s entre beeps (fase vermelha, tom agudo)
# Míssil pesado (tecla B — tier 'b' do web): 1/s, 1-hit kill, 1,5×, corpo escuro
const AAHV_CADENCE := 1.0 # s (spec do operador)
const AAHV_SCALE := 1.5
# Nuke tática da bateria (tecla T — config.js AA_DEFENSE.NUKE_*)
const AAD_NUKE_CD := 60.0 # s de recarga (spec do operador — web NUKE_COOLDOWN 1 s)
const AAD_NUKE_SPD := 190.0 # m/s de cruzeiro
const AAD_NUKE_ARC_LIFT := 0.55 # componente vertical extra na saída
const AAD_NUKE_ARC_S := 1.4 # s de arco balístico antes do glide
const AAD_NUKE_GRAVITY := 16.0
const AAD_NUKE_LAT_ACCEL := 90.0 # m/s² do glide
const AAD_NUKE_CRUISE_ALT := 130.0 # m sobre o ponto de mira
const AAD_NUKE_TERMINAL := 260.0 # m — abre o mergulho terminal
const AAD_NUKE_LIFE := 25.0
const AAD_NUKE_RADIUS := 150.0 # m — raio do wipe (web NUKE_RADIUS da defesa)
# Arco frontal de spawn dos caças (Wave L3 — operador: "os inimigos precisam
# vir de UMA direção"): ±45° em torno do eixo bateria→cidade (~0,96 rad)
const AAD_DIR_ARC := PI / 4 # meio-arco de spawn (rad)
# Caças aliados (Wave L4 — patrulha + interceptação; cobertura aérea da bateria)
const ALLIED_FTR_COUNT := 3
# Bateria da retaguarda (PORT-GODOT §D.3 — allied-batteries.js)
const REAR_BATT_DIST := 340.0 # m atrás do soldado no eixo-traseiro
const REAR_BATT_RANGE := 900.0
const REAR_BATT_HIT_P := 0.55
const REAR_BATT_MSL_S := 3.5 # s entre mísseis
const REAR_BATT_RPS := 3.0 # tracers/s
const REAR_BATT_SPREAD := 0.03
const REAR_BATT_SECTOR_COS := 0.5 # cos(60°) — setor de ameaça traseira
# Fog do modo defesa (web inhauma-defense: Fog 1100/3400 — K6/K9: recuado
# para o horizonte de spawn dos caças ficar legível, mapa mais claro)
const AAD_FOG_NEAR := 1400.0
const AAD_FOG_FAR := 4500.0
# Horda (T-W-05 — boss: tropas do horizonte invadindo Inhaúma; config.js:484-491)
const HORDE_FIRST_S := 40.0 # s até a primeira horda
const HORDE_CYCLE_S := 110.0 # s entre hordas
const HORDE_SIZE := 28 # unidades (Wave L5 — bloco 6×4 terrestre + 4 helis)
const HORDE_COLS := 6 # largura do bloco terrestre
const HORDE_HELIS := 4 # helis flanqueando acima do bloco
const HORDE_SPACING := 20.0 # m entre unidades do bloco (grid apertado)
const HORDE_DIST := 2000.0 # m — spawn na borda do vale
const HORDE_SPEED := 24.0 # m/s de marcha (janela ≈ 83 s)
const HORDE_CITY_DAMAGE := 0.30 # integridade perdida na chegada
const HORDE_KILL_SCORE := 60 # score por unidade destruída
const HORDE_AIM_ASSIST_R := 250.0 # m — mira da nuke "gruda" na horda
const HORDE_AIM_ASSIST_CITY_R := 400.0 # m — horda dentro deste raio do centro
# da cidade NÃO recebe aim-assist (Wave M1 — a nuke nunca retargeta p/ a cidade)
const HORDE_BOMB_R := 25.0 # m — raio do wipe do míssil pesado em tropas
# Caça inimigo (modo defesa)
const AAF_COUNT := 3 # mínimo vivo (reposição imediata)
const AAF_SPAWN_DIST := 2300.0 # ±10%
# Bandas de aproximação (Wave M2 — "pelo alto e mais baixo"): sorteia uma por caça
const AAF_ALT_LOW_MIN := 120.0
const AAF_ALT_LOW_MAX := 180.0
const AAF_ALT_HIGH_MIN := 300.0
const AAF_ALT_HIGH_MAX := 350.0
const AAF_SPD_MIN := 54.0 # 90×0,6 (Wave G — operador: caças 40% mais lentos)
const AAF_SPD_MAX := 84.0 # 140×0,6
const AAF_HP_MIN := 8
const AAF_HP_MAX := 12 # balas .50; 1 míssil AA mata
const AAF_ATTACK_OPEN := 640.0
const AAF_RELEASE_FAR := 330.0
const AAF_RELEASE_NEAR := 120.0
const AAF_EGRESS_TIME := 5.5
const AAF_JINK := 0.9 # rad
const AAF_RUNS_MAX := 2
const AAF_EVADE_TIME := 2.4
const AAF_EVADE_RATE := 2.6 # rad/s
const AAF_TERRAIN_CLEAR := 15.0
const AAF_TERRAIN_CLEAR_DIVE := 6.0
const AAF_GUN_RATE := 11.0 # rajada contra o jogador
const AAF_GUN_BURST_TIME := 1.2
const AAF_STRAFE_SPD := 210.0
const AAF_EJECT_CHANCE := 0.20
# Pesos de alvo dos caças: cidade 45%, base 30%, baterias aliadas 15%, jogador 10%
const AAF_TARGET_WEIGHTS := {"city": 0.45, "base": 0.30, "battery": 0.15, "player": 0.10}
# Ordenança inimiga (modo defesa)
const AAORD_SPD := 135.0 # míssil ar-solo
const AAORD_G := 12.0
const AAORD_TERMINAL_ALT := 260.0
const AAORD_IMPACT_R := 9.0
const AAORD_LIFE := 14.0
const AAORD_CITY_DAMAGE := 0.05 # -5% integridade por impacto
const AAORD_BATTERY_DAMAGE := 8
const AAORD_INTERCEPT_R := 4.0 # .50 intercepta
# Baterias aliadas
const AAB_COUNT_MIN := 3
const AAB_COUNT_MAX := 5
const AAB_HP := 12
const AAB_ENGAGE_R := 620.0
const AAB_TRACER_RATE := 2.4
const AAB_TRACER_SPREAD := 0.05
const AAB_MSL_INTERVAL := 5.5
const AAB_MSL_HIT_CHANCE := 0.07
const AAB_MSL_DAMAGE := 5
# Score do modo defesa
const AA_SCORE_KILL := 100
const AA_SCORE_INTERCEPT := 250

# Diretor de defesa (defense-director.js — especificado, NÃO integrado no web;
# aqui já entra integrado: spawn infinito com escalonamento)
const AADIR_INTERVAL := 6.0
const AADIR_RAMP := 0.93 # a cada 5 kills
const AADIR_RAMP_EVERY := 5
const AADIR_INTERVAL_FLOOR := 1.5
const AADIR_SQUAD_STEPS := [0, 12, 30, 60] # kills → esquadrilha 1..4
const AADIR_MAX_ALIVE := 10
const AADIR_STREAK_EVERY := 10

# ---------------------------------------------------------------------------
# MAPA INHAÚMA (maps/inhauma-scene.js + heightmap.json)
# ---------------------------------------------------------------------------
const MAP_WORLD_SIZE := 20000.0
const MAP_WATER_Y := 4.5
const MAP_TOWN_SHELF := Rect2(-650, -60, 800, 620) # x[-650..150], z[-60..560]
const MAP_DOWNTOWN := Vector2(-370, -20)
const MAP_DOWNTOWN_R := 160.0
const MAP_CHURCH := Vector2(-330, -40)
const MAP_PRACA := Vector2(-390, 0)
# Aeródromo de Inhaúma (airport.js:18-26)
const AIRPORT_POS := Vector2(-560, 320)
const AIRPORT_RUNWAY := Vector2(620, 52)
const AIRPORT_HEADING := 0.0
const AIRPORT_TOUCHDOWN := Vector2(-560, 140)
const AIRPORT_TOUCHDOWN_SIZE := Vector2(160, 44)
const AIRPORT_TAXIWAY := Vector2(-560, 430)
const AIRPORT_SERVICE := Vector2(-560, 475)
const AIRPORT_SERVICE_SIZE := Vector2(76, 84)
const PLAYER_SPAWN := Vector2(-560, 475)
# Usina nuclear e zonas industriais
const NUCLEAR_PLANT := Vector2(620, 640)
const FACTORIES := [Vector2(1180, -260), Vector2(1080, -120), Vector2(-820, 300)]
# Biomas por altitude (m)
const BIOME_SAND_MAX := 6.0
const BIOME_FIELD_MAX := 18.0
const BIOME_FOREST_MAX := 48.0
const BIOME_SUBALPINE_MAX := 180.0
const BIOME_ROCK_SLOPE_DEG := 24.0
const BIOME_ROCK_ALT := 480.0
const BIOME_SNOW_LINE := 800.0
const BIOME_TREE_LINE := 620.0
# Rio
const RIVER_HALF_WIDTH_MIN := 7.0 # 14 m → 56 m de largura
const RIVER_HALF_WIDTH_MAX := 28.0
# Céu / ambiente
const DAY_CYCLE_SPEED := 0.003 # ciclo dia/noite ~5 min
const FOG_NEAR := 900.0
const FOG_FAR := 2600.0
const FOG_COLOR := Color(0.714, 0.816, 0.769) # 0xb6d0c4

# ---------------------------------------------------------------------------
# MAPAS LEGADOS — waves e dificuldade (config.js MISSION/WORLD/AA)
# ---------------------------------------------------------------------------
const MISSION_WAVE_SIZES := [10, 14, 20]
const MISSION_HP_BONUS_PER_CYCLE := 3
const MISSION_AA_SPEEDUP := 0.15 # -0.15 s/intervalo por ciclo
const MISSION_AA_MAX_SPEEDUP := 0.7
const MISSION_FLAK_GATE_CYCLE := 2 # flak ambiente só a partir da missão 2
# Boss GODZILLÃO (boss.js:20-36)
const BOSS_HP := 200
const BOSS_HIT_R := 24.0
const BOSS_TORSO_ALT := 38.0
const BOSS_SPEED := 16.0
const BOSS_ROCK_INTERVAL := 3.4
const BOSS_ROCK_WINDUP := 0.85
const BOSS_ROCK_RANGE := 1100.0
const BOSS_ROCK_R_MIN := 7.0
const BOSS_ROCK_R_MAX := 10.0
const BOSS_ROCK_SPD := 150.0
const BOSS_ROCK_G := 26.0
const BOSS_ROCK_HIT_R := 16.0
const BOSS_SCORE := 8000
const BOSS_SPAWN_AHEAD := 560.0
const BOSS_EMERGE_TIME := 2.2
const BOSS_DEATH_SINK_TIME := 3.2
